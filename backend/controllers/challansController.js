const Challan = require('../models/Challan');
const Pipe = require('../models/Pipe');
const Fitting = require('../models/Fitting');
const Motor = require('../models/Motor');
const { logActivity } = require('../utils/logger');

// GET /api/challans
exports.getAllChallans = async (req, res) => {
    try {
        const challans = await Challan.find({}).sort({ createdAt: -1 });
        res.json(challans);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// POST /api/challans - Create new challan
exports.createChallan = async (req, res) => {
    try {
        const { customer, sourceGodown, items, createdBy, type, date } = req.body;
        if (!customer || !items || items.length === 0) {
            return res.status(400).json({ message: 'customer and items are required' });
        }

        // Robust Challan ID Generation
        let challanId = '';
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
            const lastChallan = await Challan.findOne({}).sort({ createdAt: -1 });
            let nextNum = 1001;
            
            if (lastChallan && lastChallan.challanId) {
                const match = lastChallan.challanId.match(/CH-(\d+)/);
                if (match) nextNum = parseInt(match[1], 10) + 1;
            }
            
            // Add offset for concurrent attempts
            challanId = `CH-${nextNum + attempts}`;
            
            // Double check uniqueness
            const existing = await Challan.findOne({ challanId });
            if (!existing) {
                isUnique = true;
            } else {
                attempts++;
            }
        }

        const challan = new Challan({
            challanId,
            type: type || 'Outward',
            date: date || new Date().toISOString().split('T')[0],
            customer: customer.trim(),
            sourceGodown: sourceGodown || 'Main Godown',
            items,
            createdBy: createdBy || 'admin',
            status: 'pending'
        });

        // Validate stock before saving
        await validateStockForChallan(challan);

        await challan.save();
        await adjustStock(challan, 1);

        // Audit Logging
        await logActivity(
            'CREATE_CHALLAN',
            `Created ${challan.type} Challan ${challan.challanId} for ${challan.customer} with ${challan.items.length} items.`,
            createdBy || 'admin'
        );

        res.status(201).json(challan);
    } catch (err) {
        if (err.message.includes('Insufficient Stock') || err.message.includes('Quantity') || err.message.includes('Invalid serials') || err.message.includes('not found') || err.message.includes('Invalid item format')) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

exports.updateChallan = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        
        const oldChallan = await Challan.findById(req.params.id);
        if (!oldChallan) return res.status(404).json({ message: 'Challan not found' });

        const isRejectTransition = req.body.status === 'rejected' && oldChallan.status !== 'rejected';

        // Construct temporary updated challan data in memory for validation
        const updatedChallanData = {
            ...oldChallan.toObject(),
            ...req.body
        };

        if (isRejectTransition) {
            // Restore stock (cancel deductions) and save
            await adjustStock(oldChallan, -1);
            const challan = await Challan.findByIdAndUpdate(
                req.params.id,
                { $set: req.body },
                { new: true, runValidators: true }
            );
            await logActivity(
                'REJECT_CHALLAN',
                `Rejected/Cancelled Challan ${challan.challanId} (Party: ${challan.customer}).`,
                performedBy
            );
            return res.json(challan);
        }

        // For item edits, or status transition out of 'rejected':
        // Restore old stock deductions first (if old status was not already rejected)
        const oldStockWasDeducted = oldChallan.status !== 'rejected';
        if (oldStockWasDeducted) {
            await adjustStock(oldChallan, -1);
        }

        try {
            // Validate updated challan stock
            await validateStockForChallan(updatedChallanData);
        } catch (validationErr) {
            // If validation failed, roll back stock restoration (re-deduct old stock)
            if (oldStockWasDeducted) {
                await adjustStock(oldChallan, 1);
            }
            return res.status(400).json({ message: validationErr.message });
        }

        // Validation passed! Save the update
        const challan = await Challan.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        // Apply new stock deductions if not rejected
        if (challan.status !== 'rejected') {
            await adjustStock(challan, 1);
        }

        // Audit Logging
        if (req.body.status) {
            const actionType = req.body.status === 'approved' ? 'APPROVE_CHALLAN' : 'UPDATE_CHALLAN';
            await logActivity(
                actionType,
                `${actionType === 'APPROVE_CHALLAN' ? 'Approved' : 'Updated'} Challan ${challan.challanId} (Party: ${challan.customer}).`,
                performedBy
            );
        } else {
            await logActivity(
                'UPDATE_CHALLAN',
                `Updated details for Challan ${challan.challanId}.`,
                performedBy
            );
        }

        res.json(challan);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// DELETE /api/challans/:id - Delete challan
exports.deleteChallan = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const challan = await Challan.findByIdAndDelete(req.params.id);
        if (!challan) return res.status(404).json({ message: 'Challan not found' });

        // Restore stock levels if they were deducted (not rejected)
        if (challan.status !== 'rejected') {
            await adjustStock(challan, -1);
        }

        // Audit Logging
        await logActivity(
            'DELETE_CHALLAN',
            `Deleted Challan ${challan.challanId} (Party: ${challan.customer}).`,
            performedBy
        );

        res.json({ message: 'Challan deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// --- Helper Functions for Stock Adjustments ---

function parseItemString(itemStr) {
    if (itemStr.includes(' - ') && itemStr.includes('(') && itemStr.includes(')')) {
        const parts = itemStr.split(' - ');
        if (parts.length >= 2) {
            const type = parts[0].trim();
            const rest = parts[1].trim();
            const lastOpenParen = rest.lastIndexOf('(');
            const lastCloseParen = rest.lastIndexOf(')');
            if (lastOpenParen !== -1 && lastCloseParen !== -1) {
                const nameOrSize = rest.substring(0, lastOpenParen).trim();
                const col = rest.substring(lastOpenParen + 1, lastCloseParen).trim();
                return { type, nameOrSize, col };
            }
        }
    }
    return null;
}

function parseMotorItemString(itemStr) {
    if (itemStr.includes(' HP Motor - ') && itemStr.includes('(') && itemStr.includes(')')) {
        const parts = itemStr.split(' HP Motor - ');
        if (parts.length >= 2) {
            const hp = parts[0].trim();
            const rest = parts[1].trim();
            const lastOpenParen = rest.lastIndexOf('(');
            const lastCloseParen = rest.lastIndexOf(')');
            if (lastOpenParen !== -1 && lastCloseParen !== -1) {
                const type = rest.substring(0, lastOpenParen).trim();
                const phase = rest.substring(lastOpenParen + 1, lastCloseParen).trim();
                return { hp, type, phase };
            }
        }
    }
    return null;
}

async function checkMotorSerials(hp, type, phase, godown, serialsArray) {
    const motor = await Motor.findOne({
        type: { $regex: new RegExp("^" + type + "$", "i") },
        hp: { $regex: new RegExp("^" + hp + "$", "i") },
        phase: { $regex: new RegExp("^" + phase + "$", "i") }
    });
    if (!motor) return { valid: false, message: `Motor ${type} ${hp} HP not found` };

    const invalidSerials = [];
    serialsArray.forEach(sn => {
        const s = motor.serials.find(x => x.sn === sn);
        if (!s) {
            invalidSerials.push(`${sn} (not found)`);
        } else if (s.status === 'Dispatched') {
            invalidSerials.push(`${sn} (already dispatched)`);
        } else if (s.godown.toLowerCase() !== godown.toLowerCase()) {
            invalidSerials.push(`${sn} (in godown ${s.godown}, expected ${godown})`);
        }
    });

    if (invalidSerials.length > 0) {
        return { valid: false, message: `Invalid serials: ${invalidSerials.join(', ')}` };
    }
    return { valid: true, motor };
}

async function adjustMotorSerials(motor, typeOfAdjustment, godown, serialsArray, destGodown = null) {
    serialsArray.forEach(sn => {
        let s = motor.serials.find(x => x.sn === sn);
        if (!s) {
            if (typeOfAdjustment === 'inward_add') {
                motor.serials.push({ sn, godown, status: 'Available' });
            }
        } else {
            if (typeOfAdjustment === 'outward_dispatch') {
                s.status = 'Dispatched';
            } else if (typeOfAdjustment === 'outward_restore') {
                s.status = 'Available';
                s.godown = godown;
            } else if (typeOfAdjustment === 'internal_transfer') {
                s.godown = destGodown;
                s.status = 'Available';
            } else if (typeOfAdjustment === 'internal_restore') {
                s.godown = godown;
                s.status = 'Available';
            } else if (typeOfAdjustment === 'inward_remove') {
                motor.serials = motor.serials.filter(x => x.sn !== sn);
            }
        }
    });
    motor.markModified('serials');
    await motor.save();
}

async function checkPipeOrFittingStock(itemType, isPipe, nameOrSize, godown, col) {
    const Model = isPipe ? Pipe : Fitting;
    const query = isPipe ? { type: itemType, size: nameOrSize } : { type: itemType, name: nameOrSize.toUpperCase() };
    const product = await Model.findOne(query);
    if (!product) return 0;

    if (!product.stock || !product.stock[godown] || product.stock[godown][col] === undefined) {
        return 0;
    }
    return product.stock[godown][col];
}

async function adjustPipeOrFittingStock(itemType, isPipe, nameOrSize, godown, col, qty) {
    const Model = isPipe ? Pipe : Fitting;
    const query = isPipe ? { type: itemType, size: nameOrSize } : { type: itemType, name: nameOrSize.toUpperCase() };
    const product = await Model.findOne(query);
    if (!product) return;

    if (!product.stock) product.stock = {};
    if (!product.stock[godown]) product.stock[godown] = {};
    if (product.stock[godown][col] === undefined) product.stock[godown][col] = 0;

    product.stock[godown][col] = Math.max(0, product.stock[godown][col] + qty);

    if (!product.godownAllocations) product.godownAllocations = [];
    let alloc = product.godownAllocations.find(a => a.godownName.toLowerCase() === godown.toLowerCase());
    if (alloc) {
        alloc.quantity = Math.max(0, alloc.quantity + qty);
    } else {
        product.godownAllocations.push({
            godownId: 'godown-' + Math.random().toString(36).substr(2, 9),
            godownName: godown,
            quantity: Math.max(0, qty)
        });
    }

    product.markModified('stock');
    product.markModified('godownAllocations');
    await product.save();
}

const validateStockForChallan = async (challan) => {
    if (!challan.items || challan.items.length === 0) return;

    for (const item of challan.items) {
        const qty = item.qty || 0;
        const selectedGodowns = item.godown 
            ? item.godown.split(',').map(s => s.trim()).filter(Boolean) 
            : [challan.sourceGodown];
        const sourceGodown = selectedGodowns[0] || challan.sourceGodown || 'Main Godown';

        const serialsArray = item.serial 
            ? item.serial.split(',').map(s => s.trim()).filter(Boolean) 
            : [];

        if (challan.type === 'Inward') continue;

        const motorParsed = parseMotorItemString(item.item);
        if (motorParsed) {
            const { hp, type, phase } = motorParsed;
            const checkResult = await checkMotorSerials(hp, type, phase, sourceGodown, serialsArray);
            if (!checkResult.valid) {
                throw new Error(`Insufficient Stock / Invalid Serials for ${item.item}: ${checkResult.message}`);
            }
            if (serialsArray.length !== qty) {
                throw new Error(`Quantity (${qty}) for motor ${item.item} must match selected serial numbers count (${serialsArray.length})`);
            }
            continue;
        }

        const parsed = parseItemString(item.item);
        if (parsed) {
            const { type, nameOrSize, col } = parsed;
            let isPipe = true;
            let product = await Pipe.findOne({ type, size: nameOrSize });
            if (!product) {
                product = await Fitting.findOne({ type, name: nameOrSize.toUpperCase() });
                isPipe = false;
            }

            if (!product) {
                throw new Error(`Product not found: ${item.item}`);
            }

            const available = await checkPipeOrFittingStock(type, isPipe, nameOrSize, sourceGodown, col);
            if (available < qty) {
                throw new Error(`Insufficient Stock for ${item.item} in ${sourceGodown}. Available: ${available}, Requested: ${qty}`);
            }
        } else {
            throw new Error(`Invalid item format: ${item.item}`);
        }
    }
};

const adjustStock = async (challan, direction) => {
    if (!challan.items || challan.items.length === 0) return;

    for (const item of challan.items) {
        const qty = item.qty || 0;
        const selectedGodowns = item.godown 
            ? item.godown.split(',').map(s => s.trim()).filter(Boolean) 
            : [challan.sourceGodown];
        const sourceGodown = selectedGodowns[0] || challan.sourceGodown || 'Main Godown';

        const serialsArray = item.serial 
            ? item.serial.split(',').map(s => s.trim()).filter(Boolean) 
            : [];

        const motorParsed = parseMotorItemString(item.item);
        if (motorParsed) {
            const { hp, type, phase } = motorParsed;
            const motor = await Motor.findOne({
                type: { $regex: new RegExp("^" + type + "$", "i") },
                hp: { $regex: new RegExp("^" + hp + "$", "i") },
                phase: { $regex: new RegExp("^" + phase + "$", "i") }
            });
            if (motor) {
                if (challan.type === 'Outward') {
                    if (direction === 1) {
                        await adjustMotorSerials(motor, 'outward_dispatch', sourceGodown, serialsArray);
                    } else {
                        await adjustMotorSerials(motor, 'outward_restore', sourceGodown, serialsArray);
                    }
                } else if (challan.type === 'Inward') {
                    if (direction === 1) {
                        await adjustMotorSerials(motor, 'inward_add', sourceGodown, serialsArray);
                    } else {
                        await adjustMotorSerials(motor, 'inward_remove', sourceGodown, serialsArray);
                    }
                } else if (challan.type === 'Internal') {
                    const destGodown = challan.customer || 'Shop';
                    if (direction === 1) {
                        await adjustMotorSerials(motor, 'internal_transfer', sourceGodown, serialsArray, destGodown);
                    } else {
                        await adjustMotorSerials(motor, 'internal_restore', sourceGodown, serialsArray, destGodown);
                    }
                }
            }
            continue;
        }

        const parsed = parseItemString(item.item);
        if (parsed) {
            const { type, nameOrSize, col } = parsed;
            let isPipe = true;
            let product = await Pipe.findOne({ type, size: nameOrSize });
            if (!product) {
                product = await Fitting.findOne({ type, name: nameOrSize.toUpperCase() });
                isPipe = false;
            }

            if (product) {
                if (challan.type === 'Outward') {
                    const adjustQty = direction === 1 ? -qty : qty;
                    await adjustPipeOrFittingStock(type, isPipe, nameOrSize, sourceGodown, col, adjustQty);
                } else if (challan.type === 'Inward') {
                    const adjustQty = direction === 1 ? qty : -qty;
                    await adjustPipeOrFittingStock(type, isPipe, nameOrSize, sourceGodown, col, adjustQty);
                } else if (challan.type === 'Internal') {
                    const destGodown = challan.customer || 'Shop';
                    if (direction === 1) {
                        await adjustPipeOrFittingStock(type, isPipe, nameOrSize, sourceGodown, col, -qty);
                        await adjustPipeOrFittingStock(type, isPipe, nameOrSize, destGodown, col, qty);
                    } else {
                        await adjustPipeOrFittingStock(type, isPipe, nameOrSize, sourceGodown, col, qty);
                        await adjustPipeOrFittingStock(type, isPipe, nameOrSize, destGodown, col, -qty);
                    }
                }
            }
        }
    }
};

// Export these helpers so they can be tested/used elsewhere if needed
exports.adjustStock = adjustStock;
exports.validateStockForChallan = validateStockForChallan;
