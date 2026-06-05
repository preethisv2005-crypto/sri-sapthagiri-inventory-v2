const Settings = require('../models/Settings');
const Challan = require('../models/Challan');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../utils/logger');

// Default schemas and godowns (used when DB is empty)
const DEFAULT_PIPE_SCHEMAS = {
    "PVC pipes": ["4KG", "6KG", "10KG", "15KG", "Slotted"],
    "GI pipes": ["TATA-B", "TATA-C", "APPOLO", "SURYA", "ZINDHAL"],
    "SWR pipe": ["TYPE-A", "TYPE-B"],
    "NU-DRAIN pipe": ["SN-4", "SN-8"],
    "ECO-DRAIN pipe": ["SN-4", "SN-8"],
    "DWC pipe": ["SN-4", "SN-8"],
    "HDP pipes ROOLLS": ["PN-10", "PN-16", "PN-12.5"],
    "CPVC pipes": ["SDR 11", "SDR 13.5"],
    "UPVC pipes": ["Sch 40", "Sch 80"],
    "COLUMN pipes": ["Medium", "Heavy", "Super Heavy"]
};

const DEFAULT_FITTING_SCHEMAS = {
    "CPVC FITTINGS": ["1/2\"", "3/4\"", "1\"", "1 1/4\"", "1 1/2\"", "2\"", "2 1/2\"", "3\"", "4\"", "6\""]
};

const DEFAULT_GODOWNS = ['Main Godown', 'Shop', 'Godown 3'];

const DEFAULT_DATA_RETENTION = {
    retentionPeriod: 24, // in months
    retentionOption: 'permanent' // 'permanent' or 'auto-delete'
};

// GET /api/settings - Returns pipeSchemas, fittingSchemas, godowns, dataRetention
exports.getSettings = async (req, res) => {
    try {
        const [pipeSchemaDoc, fittingSchemaDoc, godownsDoc, dataRetentionDoc] = await Promise.all([
            Settings.findOne({ key: 'pipeSchemas' }),
            Settings.findOne({ key: 'fittingSchemas' }),
            Settings.findOne({ key: 'godowns' }),
            Settings.findOne({ key: 'dataRetention' })
        ]);

        res.json({
            pipeSchemas: pipeSchemaDoc ? pipeSchemaDoc.value : DEFAULT_PIPE_SCHEMAS,
            fittingSchemas: fittingSchemaDoc ? fittingSchemaDoc.value : DEFAULT_FITTING_SCHEMAS,
            godowns: godownsDoc ? godownsDoc.value : DEFAULT_GODOWNS,
            dataRetention: dataRetentionDoc ? dataRetentionDoc.value : DEFAULT_DATA_RETENTION
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// PUT /api/settings - Update one or more setting keys
exports.updateSettings = async (req, res) => {
    try {
        const { pipeSchemas, fittingSchemas, godowns, dataRetention } = req.body;
        const updates = [];

        if (pipeSchemas !== undefined) {
            updates.push(Settings.findOneAndUpdate(
                { key: 'pipeSchemas' },
                { value: pipeSchemas },
                { upsert: true, new: true }
            ));
        }
        if (fittingSchemas !== undefined) {
            updates.push(Settings.findOneAndUpdate(
                { key: 'fittingSchemas' },
                { value: fittingSchemas },
                { upsert: true, new: true }
            ));
        }
        if (godowns !== undefined) {
            updates.push(Settings.findOneAndUpdate(
                { key: 'godowns' },
                { value: godowns },
                { upsert: true, new: true }
            ));
        }
        if (dataRetention !== undefined) {
            updates.push(Settings.findOneAndUpdate(
                { key: 'dataRetention' },
                { value: dataRetention },
                { upsert: true, new: true }
            ));
            
            // Log setting update
            await logActivity(
                'UPDATE_SETTINGS',
                `Updated data retention setting to ${dataRetention.retentionPeriod} months (${dataRetention.retentionOption === 'permanent' ? 'Keep Permanently' : 'Auto Delete'}).`,
                req.headers['x-user-role'] || 'admin'
            );
        }

        await Promise.all(updates);

        // Return updated settings
        const [pipeSchemaDoc, fittingSchemaDoc, godownsDoc, updatedDataRetentionDoc] = await Promise.all([
            Settings.findOne({ key: 'pipeSchemas' }),
            Settings.findOne({ key: 'fittingSchemas' }),
            Settings.findOne({ key: 'godowns' }),
            Settings.findOne({ key: 'dataRetention' })
        ]);

        res.json({
            pipeSchemas: pipeSchemaDoc ? pipeSchemaDoc.value : DEFAULT_PIPE_SCHEMAS,
            fittingSchemas: fittingSchemaDoc ? fittingSchemaDoc.value : DEFAULT_FITTING_SCHEMAS,
            godowns: godownsDoc ? godownsDoc.value : DEFAULT_GODOWNS,
            dataRetention: updatedDataRetentionDoc ? updatedDataRetentionDoc.value : DEFAULT_DATA_RETENTION
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// GET /api/settings/retention-count - Get count of records older than retention period
exports.getRetentionCount = async (req, res) => {
    try {
        const dataRetentionDoc = await Settings.findOne({ key: 'dataRetention' });
        const retention = dataRetentionDoc ? dataRetentionDoc.value : DEFAULT_DATA_RETENTION;
        const months = retention.retentionPeriod || 24;

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        // Count old Challans
        const challansCount = await Challan.countDocuments({
            $or: [
                { createdAt: { $lt: cutoffDate } },
                { date: { $lt: cutoffDateStr } }
            ]
        });

        // Count old Activity Logs
        const logsCount = await ActivityLog.countDocuments({
            createdAt: { $lt: cutoffDate }
        });

        res.json({
            retentionPeriod: months,
            retentionOption: retention.retentionOption,
            challansCount,
            logsCount,
            totalCount: challansCount + logsCount,
            cutoffDate: cutoffDateStr
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// Internal function to clean up records
const deleteOldRecordsInternal = async (months, performedBy) => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Delete old Challans
    const challanResult = await Challan.deleteMany({
        $or: [
            { createdAt: { $lt: cutoffDate } },
            { date: { $lt: cutoffDateStr } }
        ]
    });

    // Delete old Activity Logs
    const logsResult = await ActivityLog.deleteMany({
        createdAt: { $lt: cutoffDate }
    });

    const totalDeleted = challanResult.deletedCount + logsResult.deletedCount;

    // Log deletion activity in the audit trail (make sure this is logged *after* pruning so it isn't pruned itself)
    if (totalDeleted > 0) {
        await logActivity(
            'DELETE_OLD_RECORDS',
            `Deleted ${challanResult.deletedCount} challans and ${logsResult.deletedCount} activity logs older than ${months} months.`,
            performedBy
        );
    }

    return {
        challansDeleted: challanResult.deletedCount,
        logsDeleted: logsResult.deletedCount,
        totalDeleted
    };
};

exports.deleteOldRecordsInternal = deleteOldRecordsInternal;

// POST /api/settings/cleanup - Manually trigger deletion of old records
exports.performManualCleanup = async (req, res) => {
    try {
        const dataRetentionDoc = await Settings.findOne({ key: 'dataRetention' });
        const retention = dataRetentionDoc ? dataRetentionDoc.value : DEFAULT_DATA_RETENTION;
        const months = retention.retentionPeriod || 24;
        const performedBy = req.headers['x-user-role'] || 'admin';

        const result = await deleteOldRecordsInternal(months, performedBy);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// GET /api/settings/audit-logs - Get audit trails (newest first)
exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await ActivityLog.find({}).sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};
