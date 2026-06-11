require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const connectDB = require('./config/db');

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
    'https://app.srisapthagirisystems.in',      // ← Inventory app subdomain (Vercel)
    // Alternate spellings (without trailing 's')
    'https://srisapthagirisystem.in',
    'https://www.srisapthagirisystem.in',
    'https://app.srisapthagirisystem.in',
    // Local development
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5500',  // VS Code Live Server
    'http://127.0.0.1:5501',
    'http://127.0.0.1:3000',
];

app.use(cors({
    origin: function (origin, callback) {
        // In development, allow everything to prevent connection issues
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // Allow requests with no origin (curl, Postman, mobile apps)
        if (!origin) return callback(null, true);

        // Allow any Vercel preview deployment
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);

        // Allow listed origins
        if (allowedOrigins.includes(origin)) return callback(null, true);
        
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

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Sri Sapthagiri Logistics API is running',
        environment: process.env.NODE_ENV || 'development',
        time: new Date().toISOString()
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

// --- Connect to MongoDB and Start Server ---
const startServer = async () => {
    try {
        await connectDB();
        
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`🚀 Sri Sapthagiri Backend running on port ${PORT}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`❤️  Health Check: /api/health`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
};

startServer();

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
