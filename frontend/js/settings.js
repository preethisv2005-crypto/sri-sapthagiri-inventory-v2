/**
 * settings.js - Data Retention & System Settings Module
 * Sri Sapthagiri Logistics Inventory System
 */

// Initialize the settings view
async function initSettingsView() {
    if (state.currentUser.role !== 'admin') {
        alert("Only administrators can access Data Retention settings.");
        switchView('dashboardView');
        return;
    }
    
    await loadRetentionSettings();
    await loadRetentionCount();
    await loadAuditLogs();
}

// Fetch retention settings from the backend and populate the form fields
async function loadRetentionSettings() {
    try {
        const settings = await API.fetchSettings();
        const retention = settings.dataRetention || { retentionPeriod: 24, retentionOption: 'permanent' };
        
        // Populate inputs
        const radioPermanent = document.querySelector('input[name="retentionOption"][value="permanent"]');
        const radioDelete = document.querySelector('input[name="retentionOption"][value="auto-delete"]');
        const periodInput = document.getElementById('retentionPeriodInput');
        const periodContainer = document.getElementById('retentionPeriodContainer');
        const radioPermanentIcon = document.getElementById('radioPermanentIcon');
        const radioDeleteIcon = document.getElementById('radioDeleteIcon');
        
        if (retention.retentionOption === 'auto-delete') {
            radioDelete.checked = true;
            periodInput.disabled = false;
            periodContainer.style.opacity = '1';
            
            // Adjust custom icons
            if (radioDeleteIcon) {
                radioDeleteIcon.className = 'fa-solid fa-circle-dot';
                radioDeleteIcon.style.color = 'var(--primary)';
            }
            if (radioPermanentIcon) {
                radioPermanentIcon.className = 'fa-regular fa-circle';
                radioPermanentIcon.style.color = 'var(--text-muted)';
            }
        } else {
            radioPermanent.checked = true;
            periodInput.disabled = true;
            periodContainer.style.opacity = '0.5';
            
            // Adjust custom icons
            if (radioPermanentIcon) {
                radioPermanentIcon.className = 'fa-solid fa-circle-dot';
                radioPermanentIcon.style.color = 'var(--primary)';
            }
            if (radioDeleteIcon) {
                radioDeleteIcon.className = 'fa-regular fa-circle';
                radioDeleteIcon.style.color = 'var(--text-muted)';
            }
        }
        
        periodInput.value = retention.retentionPeriod || 24;
        document.getElementById('lblConfiguredRetention').textContent = `${retention.retentionPeriod || 24} Months`;
        
    } catch (err) {
        console.error("Error loading retention settings:", err);
        showToast("Error loading retention settings: " + err.message, "error");
    }
}

// Fetch deletion candidate count
async function loadRetentionCount() {
    try {
        const countInfo = await API.fetchRetentionCount();
        
        document.getElementById('lblCleanupCutoffDate').textContent = countInfo.cutoffDate || '-';
        document.getElementById('lblPrunableRecordsCount').textContent = 
            `${countInfo.totalCount} records (${countInfo.challansCount} challans, ${countInfo.logsCount} activity logs)`;
            
        const btnCleanup = document.getElementById('btnTriggerManualCleanup');
        if (btnCleanup) {
            btnCleanup.disabled = countInfo.totalCount === 0;
        }
    } catch (err) {
        console.error("Error fetching retention counts:", err);
        document.getElementById('lblPrunableRecordsCount').textContent = "Error calculating";
    }
}

// Save retention policy settings
document.getElementById('retentionSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const option = document.querySelector('input[name="retentionOption"]:checked').value;
    const period = parseInt(document.getElementById('retentionPeriodInput').value, 10);
    
    if (isNaN(period) || period < 1 || period > 120) {
        alert("Please enter a retention period between 1 and 120 months.");
        return;
    }
    
    try {
        const payload = {
            dataRetention: {
                retentionOption: option,
                retentionPeriod: period
            }
        };
        
        const updatedSettings = await API.saveSettings(payload);
        showToast("Retention policy updated successfully", "success");
        
        // Update local labels
        const retention = updatedSettings.dataRetention || payload.dataRetention;
        document.getElementById('lblConfiguredRetention').textContent = `${retention.retentionPeriod} Months`;
        
        await loadRetentionCount();
        await loadAuditLogs();
        
    } catch (err) {
        alert("Error saving retention settings: " + err.message);
    }
});

// Trigger manual cleanup operation
async function checkAndTriggerCleanup() {
    try {
        const countInfo = await API.fetchRetentionCount();
        if (countInfo.totalCount === 0) {
            alert("No records are older than the configured retention period of " + countInfo.retentionPeriod + " months.");
            return;
        }
        
        const confirmMessage = 
            `⚠️ WARNING: IRREVERSIBLE DELETION\n\n` +
            `Are you sure you want to delete ${countInfo.totalCount} records?\n` +
            `- ${countInfo.challansCount} old delivery challans\n` +
            `- ${countInfo.logsCount} system activity logs\n\n` +
            `This will remove all records created before ${countInfo.cutoffDate} (older than ${countInfo.retentionPeriod} months).\n` +
            `Active stock levels and inventory lists will NOT be modified.\n\n` +
            `Do you want to proceed?`;
            
        confirmDeletion(async () => {
            const btn = document.getElementById('btnTriggerManualCleanup');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cleaning Database...';
            }
            
            const result = await API.triggerManualCleanup();
            
            showToast(`Database cleaned successfully. Pruned ${result.totalDeleted} old records.`, "success");
            
            await loadRetentionCount();
            await loadAuditLogs();
            
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-broom"></i> Delete Old Records';
            }
        }, confirmMessage);
    } catch (err) {
        alert("Error during cleanup operation: " + err.message);
        const btn = document.getElementById('btnTriggerManualCleanup');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-broom"></i> Delete Old Records';
        }
    }
}

// Fetch and render system audit logs in the table
async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading audit logs...</td></tr>';
    
    try {
        const logs = await API.fetchAuditLogs();
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No audit logs recorded yet.</td></tr>';
            return;
        }
        
        tbody.innerHTML = logs.map(log => {
            const dateStr = new Date(log.timestamp).toLocaleString('en-IN');
            
            let badgeColor = 'background-color: #f1f5f9; color: #475569;'; // default
            if (log.action.includes('DELETE')) {
                badgeColor = 'background-color: #fef2f2; color: #dc2626;'; // red
            } else if (log.action.includes('CREATE') || log.action.includes('ADD')) {
                badgeColor = 'background-color: #f0fdf4; color: #16a34a;'; // green
            } else if (log.action.includes('UPDATE')) {
                badgeColor = 'background-color: #eff6ff; color: #2563eb;'; // blue
            }
            
            return `
                <tr>
                    <td style="font-weight: 500; font-size: 0.9rem; color: var(--text-dark);">${dateStr}</td>
                    <td><span class="badge" style="font-size: 0.75rem; letter-spacing: 0.05em; font-weight: 700; ${badgeColor}">${log.action}</span></td>
                    <td style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.4;">${log.details}</td>
                    <td style="text-align: center; font-weight: 600; font-size: 0.85rem; color: var(--text-dark);">${log.performedBy.toUpperCase()}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading audit logs:", err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--danger);">Error loading audit logs: ' + err.message + '</td></tr>';
    }
}

// Custom UI handling for Radio selection styling
document.addEventListener('DOMContentLoaded', () => {
    const radioButtons = document.querySelectorAll('input[name="retentionOption"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const permanentIcon = document.getElementById('radioPermanentIcon');
            const deleteIcon = document.getElementById('radioDeleteIcon');
            
            if (e.target.value === 'permanent') {
                if (permanentIcon) {
                    permanentIcon.className = 'fa-solid fa-circle-dot';
                    permanentIcon.style.color = 'var(--primary)';
                }
                if (deleteIcon) {
                    deleteIcon.className = 'fa-regular fa-circle';
                    deleteIcon.style.color = 'var(--text-muted)';
                }
            } else {
                if (deleteIcon) {
                    deleteIcon.className = 'fa-solid fa-circle-dot';
                    deleteIcon.style.color = 'var(--primary)';
                }
                if (permanentIcon) {
                    permanentIcon.className = 'fa-regular fa-circle';
                    permanentIcon.style.color = 'var(--text-muted)';
                }
            }
        });
    });
});

// Expose functions to window
window.initSettingsView = initSettingsView;
window.loadAuditLogs = loadAuditLogs;
window.checkAndTriggerCleanup = checkAndTriggerCleanup;
