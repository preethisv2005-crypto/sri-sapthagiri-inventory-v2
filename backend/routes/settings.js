const express = require('express');
const router = express.Router();
const { 
    getSettings, 
    updateSettings, 
    getRetentionCount, 
    performManualCleanup, 
    getAuditLogs 
} = require('../controllers/settingsController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', getSettings);
router.put('/', updateSettings);

// Retention and audit log endpoints (require Admin)
router.get('/retention-count', requireAdmin, getRetentionCount);
router.post('/cleanup', requireAdmin, performManualCleanup);
router.get('/audit-logs', requireAdmin, getAuditLogs);

module.exports = router;
