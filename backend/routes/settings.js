const express = require('express');
const router = express.Router();
const { 
    getSettings, 
    updateSettings, 
    verifyAdminPassword,
    verifyDeletePassword,
    getRetentionCount, 
    performManualCleanup, 
    getAuditLogs 
} = require('../controllers/settingsController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', getSettings);
router.put('/', requireAdmin, updateSettings);
router.post('/verify-admin-password', verifyAdminPassword);
router.post('/verify-delete-password', verifyDeletePassword);

// Retention and audit log endpoints (require Admin)
router.get('/retention-count', requireAdmin, getRetentionCount);
router.post('/cleanup', requireAdmin, performManualCleanup);
router.get('/audit-logs', requireAdmin, getAuditLogs);

module.exports = router;
