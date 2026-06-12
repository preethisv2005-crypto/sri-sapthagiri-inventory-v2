const Fitting = require('../models/Fitting');
const { logActivity } = require('../utils/logger');

// GET /api/fittings
exports.getAllFittings = async (req, res) => {
    try {
        const fittings = await Fitting.find({});
        res.json(fittings);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// POST /api/fittings
exports.createFitting = async (req, res) => {
    try {
        const { type, name, stock, lowStockLimit, lowStockLimits, unit, godownAllocations } = req.body;
        const performedBy = req.headers['x-user-role'] || 'admin';
        
        if (!type || !name) {
            return res.status(400).json({ message: 'type and name are required' });
        }

        // Check for duplicate (case-insensitive)
        const existing = await Fitting.findOne({
            type: { $regex: new RegExp(`^${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (existing) {
            return res.status(409).json({ message: 'This fitting already exists.' });
        }
        
        const fitting = new Fitting({ type, name: name.toUpperCase(), stock: stock || {}, lowStockLimit, lowStockLimits, unit, godownAllocations: godownAllocations || [] });
        await fitting.save();
        
        // Log action
        await logActivity(
            'CREATE_FITTING',
            `Added new fitting: ${fitting.name} under ${type}.`,
            performedBy
        );
        
        res.status(201).json(fitting);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// PUT /api/fittings/:id
exports.updateFitting = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const oldFitting = await Fitting.findById(req.params.id);
        
        const fitting = await Fitting.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!fitting) return res.status(404).json({ message: 'Fitting not found' });
        
        // Log action
        if (req.body.stock && oldFitting) {
            await logActivity(
                'UPDATE_STOCK_FITTING',
                `Adjusted stock for Fitting: ${fitting.name} (${fitting.type}).`,
                performedBy
            );
        } else {
            await logActivity(
                'UPDATE_FITTING',
                `Updated details for Fitting: ${fitting.name} (${fitting.type}).`,
                performedBy
            );
        }
        
        res.json(fitting);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// DELETE /api/fittings/:id
exports.deleteFitting = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const fitting = await Fitting.findByIdAndDelete(req.params.id);
        if (!fitting) return res.status(404).json({ message: 'Fitting not found' });
        
        // Log action
        await logActivity(
            'DELETE_FITTING',
            `Deleted Fitting: ${fitting.name} from category ${fitting.type}.`,
            performedBy
        );
        
        res.json({ message: 'Fitting deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};
