const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        trim: true
    },
    details: {
        type: String,
        required: true
    },
    performedBy: {
        type: String,
        required: true,
        default: 'system'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true // index for efficient range queries
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
