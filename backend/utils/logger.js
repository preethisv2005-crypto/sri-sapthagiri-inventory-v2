const ActivityLog = require('../models/ActivityLog');

/**
 * Log a system activity/audit event
 * @param {string} action - Action name (e.g. 'ADD_STOCK', 'DELETE_RECORD')
 * @param {string} details - Detailed description
 * @param {string} performedBy - User who performed the action (default 'system')
 */
exports.logActivity = async (action, details, performedBy = 'system') => {
    try {
        const log = new ActivityLog({
            action,
            details,
            performedBy
        });
        await log.save();
        console.log(`[AUDIT LOG] ${action}: ${details} (by ${performedBy})`);
        return log;
    } catch (err) {
        console.error('Error saving activity log:', err.message);
    }
};
