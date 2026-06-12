const mongoose = require('mongoose');

// Per-godown stock: { 'Main Godown': { '1/2"': 900, '3/4"': 2820 }, 'Shop': {} }
const FittingSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    stock: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    lowStockLimit: {
        type: Number,
        default: 10
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

module.exports = mongoose.model('Fitting', FittingSchema);
