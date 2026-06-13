require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// --- Connect to MongoDB ---
connectDB();

// --- MongoDB Auto-Reconnect on Disconnect ---
mongoose.connection.on('connected', () => {
    console.log('✅ [MongoDB] Connection established');
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB] Disconnected — attempting reconnect in 5s...');
    setTimeout(() => {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (uri) {
            mongoose.connect(uri, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                family: 4
            }).catch(err => {
                console.error('❌ [MongoDB] Reconnect failed:', err.message);
            });
        }
    }, 5000);
});

mongoose.connection.on('error', (err) => {
    console.error('❌ [MongoDB] Connection error:', err.message);
});

const app = express();

// --- Security Headers ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// --- Request Logging ---
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

// --- CORS ---
const allowedOrigins = [
    // Production domains
    'https://srisapthagirisystems.in',
    'https://www.srisapthagirisystems.in',
    'https://app.srisapthagirisystems.in',
    'https://srisapthagirisystem.in',
    'https://www.srisapthagirisystem.in',
    'https://app.srisapthagirisystem.in',
    // Local development
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5500',
    'http://localhost:5501',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];

app.use(cors({
    origin: function (origin, callback) {
        // In development, allow everything to prevent connection issues
        if (process.env.NODE_ENV !== 'production' || !origin) {
            return callback(null, true);
        }

        const isVercel = /\.vercel\.app$/.test(origin);
        const isWhitelisted = allowedOrigins.includes(origin);

        if (isVercel || isWhitelisted) {
            return callback(null, true);
        }
        
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS: ' + origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-User-Role'],
    credentials: false
}));

// --- Body Parser ---
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// --- API Routes ---
app.use('/api/pipes',    require('./routes/pipes'));
app.use('/api/fittings', require('./routes/fittings'));
app.use('/api/motors',   require('./routes/motors'));
app.use('/api/challans', require('./routes/challans'));
app.use('/api/settings', require('./routes/settings'));

// --- Health Check (includes MongoDB status) ---
app.get('/api/health', (req, res) => {
    const mongoState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const mongoStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] || 'unknown';
    const isHealthy = mongoState === 1;

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        message: 'Sri Sapthagiri Logistics API is running',
        mongo: mongoStatus,
        environment: process.env.NODE_ENV || 'development',
        time: new Date().toISOString(),
        uptime: Math.floor(process.uptime()) + 's'
    });
});

// --- Root ---
app.get('/', (req, res) => {
    res.json({ message: 'Sri Sapthagiri Inventory API', docs: '/api/health' });
});

// --- 404 Handler ---
app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    // Handle CORS errors specifically
    if (err.message && err.message.startsWith('Not allowed by CORS')) {
        return res.status(403).json({ message: err.message });
    }
    console.error('[ERROR]', err.stack);
    res.status(500).json({ message: 'Internal Server Error', error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message });
});

// --- Start Server ---
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 Sri Sapthagiri Backend running on port ${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`❤️  Health Check: /api/health`);
    });
}

// --- Background Data Retention Scheduler ---
const Settings = require('./models/Settings');
const { deleteOldRecordsInternal } = require('./controllers/settingsController');

const checkAndCleanupData = async () => {
    try {
        const dataRetentionDoc = await Settings.findOne({ key: 'dataRetention' });
        const retention = dataRetentionDoc
            ? dataRetentionDoc.value
            : { retentionPeriod: 24, retentionOption: 'permanent' };

        if (retention.retentionOption === 'auto-delete') {
            const months = retention.retentionPeriod || 24;
            console.log(`[RETENTION] Auto-delete: cleaning records older than ${months} months...`);
            const result = await deleteOldRecordsInternal(months, 'system-auto-delete');
            if (result.totalDeleted > 0) {
                console.log(`[RETENTION] Pruned ${result.totalDeleted} records.`);
            }
        }
    } catch (err) {
        console.error('❌ [RETENTION] Scheduled cleanup error:', err.message);
    }
};

// Run 15s after startup, then every 24 hours
setTimeout(checkAndCleanupData, 15000);
setInterval(checkAndCleanupData, 24 * 60 * 60 * 1000);

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 [${signal}] Shutting down gracefully...`);
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed.');
    } catch (err) {
        console.error('❌ Error closing MongoDB:', err.message);
    }
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
