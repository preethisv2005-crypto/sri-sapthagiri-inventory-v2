require('dotenv').config();
const mongoose = require('mongoose');
const Pipe = require('./models/Pipe');

async function test() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const pipes = await Pipe.find({});

    let lowStockCount = 0;
    let lowStockAlerts = [];

    pipes.forEach(p => {
        if (p.stock) {
            Object.keys(p.stock).forEach(g => {
                const godownStock = p.stock[g] || {};
                Object.entries(godownStock).forEach(([col, val]) => {
                    const limit = (p.lowStockLimits && p.lowStockLimits[col] !== undefined)
                        ? p.lowStockLimits[col]
                        : (p.lowStockLimit !== undefined ? p.lowStockLimit : 20);
                    if (val < limit) {
                        lowStockCount++;
                        lowStockAlerts.push(`Pipe ${p.type} ${p.size} (${g} - ${col}) is low: ${val}`);
                    }
                });
            });
        }
    });

    console.log("Generated Alerts Count:", lowStockCount);
    console.log("Alerts:", lowStockAlerts);

    await mongoose.disconnect();
}

test().catch(console.error);
