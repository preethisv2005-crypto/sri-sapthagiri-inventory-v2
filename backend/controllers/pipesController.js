const Pipe = require('../models/Pipe');
const Settings = require('../models/Settings');
const { logActivity } = require('../utils/logger');

// GET /api/pipes - Get all pipes
exports.getAllPipes = async (req, res) => {
    try {
        const pipes = await Pipe.find({});
        res.json(pipes);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// POST /api/pipes - Create new pipe
exports.createPipe = async (req, res) => {
    try {
        const { type, size, stock, lowStockLimit } = req.body;
        const performedBy = req.headers['x-user-role'] || 'admin';
        
        if (!type || !size) {
            return res.status(400).json({ message: 'type and size are required' });
        }

        // Check for duplicate (case-insensitive)
        const existing = await Pipe.findOne({
            type: { $regex: new RegExp(`^${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            size: { $regex: new RegExp(`^${size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (existing) {
            return res.status(409).json({ message: 'This pipe specification already exists.' });
        }
        
        const pipe = new Pipe({ type, size, stock: stock || {}, lowStockLimit });
        await pipe.save();
        
        // Log activity
        await logActivity(
            'CREATE_PIPE',
            `Added new pipe category: ${type} (Size: ${size}).`,
            performedBy
        );
        
        res.status(201).json(pipe);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// PUT /api/pipes/:id - Update pipe (stock or details)
exports.updatePipe = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        
        // Fetch old pipe to log stock adjustment detail
        const oldPipe = await Pipe.findById(req.params.id);
        
        const pipe = await Pipe.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!pipe) return res.status(404).json({ message: 'Pipe not found' });
        
        // Log activity (e.g. manual stock adjustment or size changes)
        if (req.body.stock && oldPipe) {
            await logActivity(
                'UPDATE_STOCK_PIPE',
                `Adjusted stock for Pipe: ${pipe.type} - Size: ${pipe.size}.`,
                performedBy
            );
        } else {
            await logActivity(
                'UPDATE_PIPE',
                `Updated pipe details for: ${pipe.type} - Size: ${pipe.size}.`,
                performedBy
            );
        }
        
        res.json(pipe);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// DELETE /api/pipes/:id - Delete pipe
exports.deletePipe = async (req, res) => {
    try {
        const performedBy = req.headers['x-user-role'] || 'admin';
        const pipe = await Pipe.findByIdAndDelete(req.params.id);
        if (!pipe) return res.status(404).json({ message: 'Pipe not found' });
        
        // Log activity
        await logActivity(
            'DELETE_PIPE',
            `Deleted Pipe size: ${pipe.size} from category: ${pipe.type}.`,
            performedBy
        );
        
        res.json({ message: 'Pipe deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};
