const mongoose = require('mongoose');

// Stores pipe schemas, fitting schemas, and godowns list
const SettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Settings', SettingsSchema);
