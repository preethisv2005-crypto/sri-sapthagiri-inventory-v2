const Motor = require('../models/Motor');
const { logActivity } = require('../utils/logger');

// GET /api/motors
exports.getAllMotors = async (req, res) => {
    try {
        const motors = await Motor.find({});
        res.json(motors);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// POST /api/motors - Add new motor type
exports.createMotor = async (req, res) => {
    try {
        const { type, hp, phase, lowStockLimit } = req.body;
        const performedBy = req.headers['x-user-role'] || 'admin';
        
        if (!type || !hp || !phase) {
            return res.status(400).json({ message: 'type, hp, and phase are required' });
        }
        // Check for duplicate
        const existing = await Motor.findOne({
            type: type.toLowerCase(),
            hp: hp.toLowerCase(),
            phase
        });
        if (existing) {
            return res.status(409).json({ message: 'This motor specification already exists.' });
        }
        const motor = new Motor({ type, hp, phase, serials: [], lowStockLimit });
        await motor.save();
        
        // Log action
        await logActivity(
            'CREATE_MOTOR',
            `Created motor spec: ${type} - ${hp} HP (${phase}).`,
            performedBy
        );
        
        res.status(201).json(motor);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// PUT /api/motors/:id - Update motor details or serials
exports.updateMotor = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const motor = await Motor.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!motor) return res.status(404).json({ message: 'Motor not found' });
        
        // Log action
        await logActivity(
            'UPDATE_MOTOR',
            `Updated specs/details for Motor: CRI ${motor.hp} HP (${motor.phase}).`,
            performedBy
        );
        
        res.json(motor);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// POST /api/motors/:id/serials - Add serial numbers to a motor
exports.addSerials = async (req, res) => {
    try {
        const { serials, godown } = req.body;
        const performedBy = req.headers['x-user-role'] || 'admin';
        
        if (!serials || !Array.isArray(serials) || serials.length === 0) {
            return res.status(400).json({ message: 'serials array is required' });
        }
        const motor = await Motor.findById(req.params.id);
        if (!motor) return res.status(404).json({ message: 'Motor not found' });

        // Add new serials, skip duplicates
        let addedCount = 0;
        serials.forEach(sn => {
            const exists = motor.serials.some(s => s.sn === sn);
            if (!exists) {
                motor.serials.push({ sn, godown: godown || 'Main Godown' });
                addedCount++;
            }
        });

        await motor.save();
        
        // Log action
        if (addedCount > 0) {
            await logActivity(
                'ADD_MOTOR_SERIALS',
                `Added ${addedCount} serials to Motor: CRI ${motor.hp} HP (${motor.phase}) at godown: ${godown || 'Main Godown'}.`,
                performedBy
            );
        }
        
        res.json(motor);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// DELETE /api/motors/:id/serials/:sn - Remove a serial number
exports.removeSerial = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const motor = await Motor.findById(req.params.id);
        if (!motor) return res.status(404).json({ message: 'Motor not found' });

        const exists = motor.serials.some(s => s.sn === req.params.sn);
        motor.serials = motor.serials.filter(s => s.sn !== req.params.sn);
        await motor.save();
        
        // Log action
        if (exists) {
            await logActivity(
                'REMOVE_MOTOR_SERIAL',
                `Removed serial ${req.params.sn} from Motor: CRI ${motor.hp} HP (${motor.phase}).`,
                performedBy
            );
        }
        
        res.json(motor);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// DELETE /api/motors/:id - Delete motor entirely
exports.deleteMotor = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const motor = await Motor.findByIdAndDelete(req.params.id);
        if (!motor) return res.status(404).json({ message: 'Motor not found' });
        
        // Log action
        await logActivity(
            'DELETE_MOTOR',
            `Deleted Motor spec: CRI ${motor.hp} HP (${motor.phase}).`,
            performedBy
        );
        
        res.json({ message: 'Motor deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};
