const mongoose = require('mongoose');

const getMongoTarget = (uri) => {
    try {
        const parsed = new URL(uri);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch (error) {
        return 'the configured MongoDB URI';
    }
};

const isAuthError = (error) => {
    return error?.code === 8000
        || /bad auth|authentication failed|auth failed/i.test(error?.message || '');
};

const connectDB = async (retryCount = 5) => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!uri) {
        console.error('[MongoDB] Error: MONGO_URI is not defined in the .env file.');
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
        console.log(`[MongoDB] Connected: ${conn.connection.host}`);
        console.log(`[MongoDB] Database: ${conn.connection.name}`);
    } catch (error) {
        console.error(`[MongoDB] Connection Error: ${error.message}`);

        if (isAuthError(error)) {
            console.error(`[MongoDB] Authentication failed for ${getMongoTarget(uri)}.`);
            console.error('[MongoDB] Update backend/.env with the current Atlas database username/password, then restart the backend.');
            console.error('[MongoDB] If the password contains special characters, URL-encode it before putting it in MONGO_URI.');
            process.exit(1);
        }
        
        if (retryCount > 0) {
            const delay = Math.min(5000 * (6 - retryCount), 30000); // Progressive backoff: 5s, 10s, 15s, 20s, 25s
            console.log(`[MongoDB] Retrying connection in ${delay / 1000}s... (${retryCount} retries left)`);
            setTimeout(() => connectDB(retryCount - 1), delay);
        } else {
            console.error('[MongoDB] Max retries reached. Exiting...');
            process.exit(1);
        }
    }
};

module.exports = connectDB;
