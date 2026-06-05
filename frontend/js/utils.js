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
