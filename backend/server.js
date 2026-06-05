require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// --- Connect to MongoDB ---
connectDB();

const app = express();

// --- Middleware ---
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            'https://srisapthagirisystems.in',
            'https://www.srisapthagirisystems.in',
            'https://srisapthagirisystem.in',
            'https://www.srisapthagirisystem.in',
            'http://localhost:8080',
            'http://localhost:3000',
            'http://localhost:5173',
        ];
        // Allow Vercel preview deployments (*.vercel.app)
        if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS: ' + origin));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-User-Role'],
    credentials: false
}));
app.use(express.json());

// --- API Routes ---
app.use('/api/pipes',    require('./routes/pipes'));
app.use('/api/fittings', require('./routes/fittings'));
app.use('/api/motors',   require('./routes/motors'));
app.use('/api/challans', require('./routes/challans'));
app.use('/api/settings', require('./routes/settings'));

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Sri Sapthagiri Logistics API is running', time: new Date() });
});

// --- 404 Handler ---
app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// --- Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Sri Sapthagiri Backend running on http://localhost:${PORT}`);
    console.log(`📋 API Base URL: http://localhost:${PORT}/api`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
});

// --- Background Data Retention Scheduler ---
const Settings = require('./models/Settings');
const { deleteOldRecordsInternal } = require('./controllers/settingsController');

const checkAndCleanupData = async () => {
    try {
        const dataRetentionDoc = await Settings.findOne({ key: 'dataRetention' });
        const retention = dataRetentionDoc ? dataRetentionDoc.value : { retentionPeriod: 24, retentionOption: 'permanent' };
        
        if (retention.retentionOption === 'auto-delete') {
            const months = retention.retentionPeriod || 24;
            console.log(`[RETENTION] Auto-delete check: cleaning records older than ${months} months...`);
            const result = await deleteOldRecordsInternal(months, 'system-auto-delete');
            if (result.totalDeleted > 0) {
                console.log(`[RETENTION] Auto-delete successful. Pruned: ${result.totalDeleted} records.`);
            }
        }
    } catch (err) {
        console.error('❌ [RETENTION] Scheduled cleanup error:', err.message);
    }
};

// Run check 15 seconds after startup, and repeat every 24 hours
setTimeout(checkAndCleanupData, 15000);
setInterval(checkAndCleanupData, 24 * 60 * 60 * 1000);

