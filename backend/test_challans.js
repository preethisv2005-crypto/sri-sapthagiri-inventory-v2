require('dotenv').config();
const mongoose = require('mongoose');
const Challan = require('./models/Challan');

async function test() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const approved = await Challan.find({ status: 'approved' });
    console.log("=== APPROVED CHALLANS ===");
    console.log(JSON.stringify(approved, null, 2));
    await mongoose.disconnect();
}

test().catch(console.error);
