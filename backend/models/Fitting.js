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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Fitting', FittingSchema);
