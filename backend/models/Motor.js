const mongoose = require('mongoose');

const SerialSchema = new mongoose.Schema({
    sn: { type: String, required: true },
    godown: { type: String, default: 'Main Godown' },
    status: { type: String, enum: ['Available', 'Dispatched'], default: 'Available' }
}, { _id: false });

const MotorSchema = new mongoose.Schema({
    // 'type' field holds the Motor Name (e.g. "CRI Motor 7.5 HP")
    type: {
        type: String,
        required: true,
        trim: true
    },
    // 'hp' holds the Motor Type/Model (e.g. "Openwell Pump")
    hp: {
        type: String,
        required: true,
        trim: true
    },
    phase: {
        type: String,
        required: true,
        trim: true
    },
    serials: {
        type: [SerialSchema],
        default: []
    },
    lowStockLimit: {
        type: Number,
        default: 5
    },
    unit: {
        type: String,
        enum: ['LENGTH', 'MTR', "NO'S", 'FEETS', 'LITR', 'KG'],
        default: "NO'S"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Motor', MotorSchema);
