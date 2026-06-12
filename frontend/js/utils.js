/**
 * utils.js - Toast notifications, modal helpers, and common utilities
 * Sri Sapthagiri Logistics Inventory System
 */

// ─── Toast Notification System ───────────────────────────────────────────────

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    else if (type === 'error') iconClass = 'fa-circle-exclamation';
    else if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.classList.add('dismissing'); setTimeout(() => this.parentElement.remove(), 300);"><i class="fa-solid fa-xmark"></i></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('dismissing');
            setTimeout(() => toast.remove(), 300);
        }
    }, 3500);
}

// Override window.alert to use toast
window.alert = function (msg) {
    const lower = msg.toLowerCase();
    let type = 'info';
    if (lower.includes('error') || lower.includes('cannot') || lower.includes('failed') || lower.includes('not found') || lower.includes('only admin') || lower.includes('limit')) {
        type = 'error';
    } else if (lower.includes('success') || lower.includes('updated') || lower.includes('saved') || lower.includes('added') || lower.includes('successfully')) {
        type = 'success';
    } else if (lower.includes('already exists') || lower.includes('alert') || lower.includes('warning')) {
        type = 'warning';
    }
    showToast(msg, type);
};

// ─── Modal Helpers ────────────────────────────────────────────────────────────

window.openModal = function (id) {
    document.getElementById(id).classList.add('active');
};

window.closeModal = function (id) {
    document.getElementById(id).classList.remove('active');
};

// ─── View Switcher ────────────────────────────────────────────────────────────

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');

    if (viewId !== 'reportsView') {
        const reportContentArea = document.getElementById('reportContentArea');
        if (reportContentArea) reportContentArea.classList.add('hidden');
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
window.showToast = showToast;
window.switchView = switchView;

window.addGodownAllocationRow = function (containerId, initialValue = null, initialQty = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'godown-allocation-row';
    row.style.cssText = 'display: flex; gap: 0.75rem; align-items: center;';

    const godowns = state.godowns || ['Main Godown', 'Shop', 'Godown 3'];
    
    // Determine default value
    let defaultVal = godowns[0];
    if (initialValue) {
        defaultVal = initialValue;
    } else if (currentGodownFilter && currentGodownFilter !== 'all') {
        defaultVal = currentGodownFilter;
    }

    const optionsHtml = godowns.map(g => `<option value="${g}" ${g === defaultVal ? 'selected' : ''}>${g}</option>`).join('');

    row.innerHTML = `
        <select class="godown-select" required style="flex: 2; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 10px; outline: none; font-size: 0.95rem; color: #0f172a; transition: border-color 0.2s;">
            ${optionsHtml}
        </select>
        <input type="number" class="godown-qty" required min="0" placeholder="Qty" value="${initialQty}" style="flex: 1; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 10px; outline: none; font-size: 0.95rem; color: #0f172a; transition: border-color 0.2s;">
        <button type="button" class="btn-delete-row" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1.1rem; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: var(--transition);">
            <i class="fa-regular fa-trash-can"></i>
        </button>
    `;

    row.querySelector('.btn-delete-row').addEventListener('click', () => {
        row.remove();
    });

    container.appendChild(row);
};
