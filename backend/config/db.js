const mongoose = require('mongoose');

const connectDB = async (retryCount = 5) => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!uri) {
        console.error('❌ Error: MONGO_URI is not defined in the .env file.');
        process.exit(1);
    }

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,  // Wait up to 15s for server selection
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,          // Wait up to 15s for initial connection
            heartbeatFrequencyMS: 10000,      // Check server health every 10s
            family: 4,                        // Force IPv4 to avoid potential local DNS issues
            maxPoolSize: 10,                  // Connection pool size
            minPoolSize: 2,                   // Keep at least 2 connections alive
            retryWrites: true,
            retryReads: true,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📦 Database: ${conn.connection.name}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        
        if (retryCount > 0) {
            const delay = Math.min(5000 * (6 - retryCount), 30000); // Progressive backoff: 5s, 10s, 15s, 20s, 25s
            console.log(`🔄 Retrying connection in ${delay / 1000}s... (${retryCount} retries left)`);
            setTimeout(() => connectDB(retryCount - 1), delay);
        } else {
            console.error('🛑 Max retries reached. Exiting...');
            process.exit(1);
        }
    }
};

module.exports = connectDB;
