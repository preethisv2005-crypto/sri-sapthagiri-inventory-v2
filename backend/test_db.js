require('dotenv').config();
const mongoose = require('mongoose');
const Pipe = require('./models/Pipe');
const Fitting = require('./models/Fitting');

async function test() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const pipes = await Pipe.find({});
    console.log("=== PIPES ===");
    console.log(JSON.stringify(pipes, null, 2));
    
    const fittings = await Fitting.find({});
    console.log("=== FITTINGS ===");
    console.log(JSON.stringify(fittings, null, 2));
    
    await mongoose.disconnect();
}

test().catch(console.error);
