const Challan = require('../models/Challan');
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

        // Auto-generate Challan ID (CH-XXXX)
        const lastChallan = await Challan.findOne({}).sort({ createdAt: -1 });
        let nextNum = 1001;
        if (lastChallan && lastChallan.challanId) {
            const match = lastChallan.challanId.match(/CH-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const challanId = `CH-${nextNum}`;

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

        await challan.save();

        // Audit Logging
        await logActivity(
            'CREATE_CHALLAN',
            `Created ${challan.type} Challan ${challan.challanId} for ${challan.customer} with ${challan.items.length} items.`,
            createdBy || 'admin'
        );

        res.status(201).json(challan);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// PUT /api/challans/:id - Update challan (approve/reject, update items)
exports.updateChallan = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const challan = await Challan.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!challan) return res.status(404).json({ message: 'Challan not found' });

        // Audit Logging
        if (req.body.status) {
            const actionType = req.body.status === 'approved' ? 'APPROVE_CHALLAN' : 'REJECT_CHALLAN';
            await logActivity(
                actionType,
                `${actionType === 'APPROVE_CHALLAN' ? 'Approved' : 'Rejected'} Challan ${challan.challanId} (Party: ${challan.customer}).`,
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
