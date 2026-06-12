const mongoose = require('mongoose');

const ChallanItemSchema = new mongoose.Schema({
    sno: String,
    item: String,
    serial: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    godown: { type: String, default: '' }
}, { _id: false });

const ChallanSchema = new mongoose.Schema({
    challanId: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['Inward', 'Outward', 'Internal'],
        default: 'Outward'
    },
    date: {
        type: String,
        required: true
    },
    customer: {
        type: String,
        required: true,
        trim: true
    },
    sourceGodown: {
        type: String,
        default: 'Main Godown'
    },
    items: {
        type: [ChallanItemSchema],
        default: []
    },
    // Legacy single-item fields (kept for backward compat)
    item: { type: String, default: '' },
    qty: { type: Number, default: 0 },
    godown: { type: String, default: '' },
    serial: { type: String, default: '' },
    createdBy: {
        type: String,
        default: 'admin'
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Challan', ChallanSchema);
