const mongoose = require('mongoose');

// Per-godown stock: { 'Main Godown': { '4KG': 150, '6KG': 120 }, 'Shop': { '4KG': 50 } }
const PipeSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        trim: true
    },
    size: {
        type: String,
        required: true,
        trim: true
    },
    // stock is a flexible Map of godown -> col -> qty
    stock: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    lowStockLimit: {
        type: Number,
        default: 20
    },
    lowStockLimits: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    unit: {
        type: String,
        enum: ['LENGTH', 'MTR', "NO'S", 'FEETS', 'LITR', 'KG'],
        default: "NO'S"
    },
    godownAllocations: {
        type: [{
            godownId: { type: String, required: true },
            godownName: { type: String, required: true },
            quantity: { type: Number, required: true, default: 0 }
        }],
        default: []
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Pipe', PipeSchema);
