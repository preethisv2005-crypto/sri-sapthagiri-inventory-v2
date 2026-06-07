const mongoose = require('mongoose');

const connectDB = async (retryCount = 5) => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!uri) {
        console.error('❌ Error: MONGO_URI is not defined in the .env file.');
        process.exit(1);
    }

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000, 
            socketTimeoutMS: 45000,
            family: 4 // Force IPv4 to avoid potential local DNS issues
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📦 Database: ${conn.connection.name}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        
        if (retryCount > 0) {
            console.log(`🔄 Retrying connection in 5 seconds... (${retryCount} retries left)`);
            setTimeout(() => connectDB(retryCount - 1), 5000);
        } else {
            console.error('🛑 Max retries reached. Exiting...');
            process.exit(1);
        }
    }
};

module.exports = connectDB;
