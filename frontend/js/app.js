/**
 * app.js - Main Application Entry Point
 * Sri Sapthagiri Logistics Inventory System
 *
 * Loads data from backend API, manages state, handles auth & navigation.
 * All module functions (pipes, fittings, motors, challans, dashboard) are
 * defined in their respective JS files and exposed on window.
 */

// ─── Default Schemas (used if backend unavailable) ────────────────────────────

const defaultSchemas = {
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

const defaultFittingSchemas = {
    "CPVC FITTINGS": ["1/2\"", "3/4\"", "1\"", "1 1/4\"", "1 1/2\"", "2\"", "2 1/2\"", "3\"", "4\"", "6\""]
};

// ─── Global State ─────────────────────────────────────────────────────────────

window.state = {
    currentUser: null,
    pipes: [],
    motors: [],
    challans: [],
    pipeSchemas: defaultSchemas,
    fittings: [],
    fittingSchemas: defaultFittingSchemas,
    godowns: ['Main Godown', 'Shop', 'Godown 3']
};

window.currentGodownFilter = localStorage.getItem('sapthagiri_current_godown_filter') || 'all';
window.pendingStockAddition = null;

// ─── State Save (localStorage cache + backend sync) ───────────────────────────

window.saveState = function () {
    // Cache to localStorage as backup
    localStorage.setItem('sapthagiri_schemas', JSON.stringify(state.pipeSchemas));
    localStorage.setItem('sapthagiri_pipes', JSON.stringify(state.pipes));
    localStorage.setItem('sapthagiri_motors', JSON.stringify(state.motors));
    localStorage.setItem('sapthagiri_challans', JSON.stringify(state.challans));
    localStorage.setItem('sapthagiri_fittings', JSON.stringify(state.fittings));
    localStorage.setItem('sapthagiri_fitting_schemas', JSON.stringify(state.fittingSchemas));
    localStorage.setItem('sapthagiri_godowns', JSON.stringify(state.godowns));
    updateDashboard();
    renderLogs();
};

// ─── Server Status Indicator (with failure tolerance) ─────────────────────────

let _healthFailCount = 0;
const HEALTH_FAIL_THRESHOLD = 3; // Show offline only after 3 consecutive failures

async function updateConnectionStatus() {
    const indicator = document.getElementById('connection-status');
    if (!indicator) return;

    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');

    try {
        const isOnline = await API.checkServerHealth();

        if (isOnline) {
            _healthFailCount = 0;
            indicator.className = 'status-indicator online';
            if (dot) dot.style.background = '#10b981';
            if (text) text.textContent = 'Server Online';
        } else {
            throw new Error('Health check returned not-ok');
        }
    } catch (err) {
        _healthFailCount++;
        console.warn(`📡 Health check failed (${_healthFailCount}/${HEALTH_FAIL_THRESHOLD}):`, err.message);

        if (_healthFailCount < HEALTH_FAIL_THRESHOLD) {
            // Show a "reconnecting" intermediate state, not yet offline
            indicator.className = 'status-indicator reconnecting';
            if (dot) dot.style.background = '#f59e0b';
            if (text) text.textContent = 'Reconnecting...';
        } else {
            // Confirmed offline after multiple failures
            indicator.className = 'status-indicator offline';
            if (dot) dot.style.background = '#ef4444';
            if (text) text.textContent = 'Server Offline';
        }
    }
}

// ─── Load Data From Backend ───────────────────────────────────────────────────
window.loadDataFromBackend = loadDataFromBackend;

async function loadDataFromBackend() {
    try {
        // Pre-warm the server (handles Render cold-start)
        await API.wakeServer();

        // Load settings first (schemas + godowns)
        const settings = await API.fetchSettings();
        state.pipeSchemas = settings.pipeSchemas || defaultSchemas;
        state.fittingSchemas = settings.fittingSchemas || defaultFittingSchemas;
        state.godowns = settings.godowns || ['Main Godown', 'Shop', 'Godown 3'];

        // Load all data in parallel
        const [pipes, fittings, motors, challans] = await Promise.all([
            API.fetchPipes(),
            API.fetchFittings(),
            API.fetchMotors(),
            API.fetchChallans()
        ]);

        state.pipes = pipes;
        state.fittings = fittings;
        state.motors = motors;
        state.challans = challans;

        console.log('✅ Data loaded from backend:', {
            pipes: pipes.length,
            fittings: fittings.length,
            motors: motors.length,
            challans: challans.length
        });

        // Update connection status immediately after successful load
        updateConnectionStatus();

        return true;
    } catch (err) {
        console.warn('⚠️ Backend unavailable, loading from localStorage cache:', err.message);

        // Fallback to localStorage
        state.pipes = JSON.parse(localStorage.getItem('sapthagiri_pipes')) || [];
        state.motors = JSON.parse(localStorage.getItem('sapthagiri_motors')) || [];
        state.challans = JSON.parse(localStorage.getItem('sapthagiri_challans')) || [];
        state.pipeSchemas = JSON.parse(localStorage.getItem('sapthagiri_schemas')) || defaultSchemas;
        state.fittings = JSON.parse(localStorage.getItem('sapthagiri_fittings')) || [];
        state.fittingSchemas = JSON.parse(localStorage.getItem('sapthagiri_fitting_schemas')) || defaultFittingSchemas;
        state.godowns = JSON.parse(localStorage.getItem('sapthagiri_godowns')) || ['Main Godown', 'Shop', 'Godown 3'];

        showToast('⚠️ Backend offline — using cached data. Changes may not be saved.', 'warning');
        return false;
    }
}

// ─── Authentication ───────────────────────────────────────────────────────────

const loginScreen = document.getElementById('loginScreen');
const appLayout = document.getElementById('appLayout');
const logoutBtn = document.getElementById('logoutBtn');

const roleSelector = document.getElementById('roleSelector');
const btnAdminLogin = document.getElementById('btn-admin-login');
const btnTransporterLogin = document.getElementById('btn-transporter-login');

const adminPassPanel = document.getElementById('admin-pass-panel');
const transporterPassPanel = document.getElementById('transporter-pass-panel');

const adminPasswordInput = document.getElementById('admin-password-input');
const transporterPasswordInput = document.getElementById('transporter-password-input');

const btnAdminConfirm = document.getElementById('btn-admin-confirm');
const btnAdminCancel = document.getElementById('btn-admin-cancel');
const btnTransporterConfirm = document.getElementById('btn-transporter-confirm');
const btnTransporterCancel = document.getElementById('btn-transporter-cancel');

const adminLoginError = document.getElementById('admin-login-error');
const transporterLoginError = document.getElementById('transporter-login-error');

btnAdminLogin.addEventListener('click', () => {
    roleSelector.style.display = 'none';
    adminPassPanel.style.display = 'block';
    adminLoginError.style.display = 'none';
    adminPasswordInput.value = '';
    adminPasswordInput.focus();
});

btnAdminCancel.addEventListener('click', () => {
    adminPassPanel.style.display = 'none';
    roleSelector.style.display = 'flex';
});

btnTransporterLogin.addEventListener('click', () => {
    roleSelector.style.display = 'none';
    transporterPassPanel.style.display = 'block';
    transporterLoginError.style.display = 'none';
    transporterPasswordInput.value = '';
    transporterPasswordInput.focus();
});

btnTransporterCancel.addEventListener('click', () => {
    transporterPassPanel.style.display = 'none';
    roleSelector.style.display = 'flex';
});

async function doLogin(username, role) {
    state.currentUser = { username, role };

    adminPassPanel.style.display = 'none';
    transporterPassPanel.style.display = 'none';
    roleSelector.style.display = 'flex';
    adminPasswordInput.value = '';
    transporterPasswordInput.value = '';

    // Show loading state
    loginScreen.classList.add('hidden');
    appLayout.classList.remove('hidden');

    await loadDataFromBackend();
    initApp();
}

btnAdminConfirm.addEventListener('click', async () => {
    const pass = adminPasswordInput.value;
    
    // Add loading state to button
    const originalText = btnAdminConfirm.innerHTML;
    btnAdminConfirm.disabled = true;
    btnAdminConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    adminLoginError.style.display = 'none';

    try {
        const result = await API.verifyAdminPassword(pass);
        if (result.valid) {
            doLogin('admin', 'admin');
        } else {
            adminLoginError.style.display = 'block';
            adminLoginError.textContent = '❌ Incorrect admin password.';
        }
    } catch (err) {
        console.error('Login error:', err);
        adminLoginError.style.display = 'block';
        adminLoginError.textContent = '❌ Server error. Please check connection.';
    } finally {
        btnAdminConfirm.disabled = false;
        btnAdminConfirm.innerHTML = originalText;
    }
});

btnTransporterConfirm.addEventListener('click', () => {
    const pass = transporterPasswordInput.value.toLowerCase();
    if (pass === 'transporter123' || pass === 'transporter') {
        doLogin('transporter', 'transporter');
    } else {
        transporterLoginError.style.display = 'block';
    }
});

adminPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnAdminConfirm.click(); });
transporterPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnTransporterConfirm.click(); });

logoutBtn.addEventListener('click', () => {
    state.currentUser = null;
    appLayout.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    adminPassPanel.style.display = 'none';
    transporterPassPanel.style.display = 'none';
    roleSelector.style.display = 'flex';
    adminPasswordInput.value = '';
    transporterPasswordInput.value = '';
});

// ─── Godown Dropdowns ─────────────────────────────────────────────────────────

window.populateGodownDropdowns = function () {
    const godowns = state.godowns || ['Main Godown', 'Shop', 'Godown 3'];

    const motorGodown = document.getElementById('motorGodown');
    if (motorGodown) motorGodown.innerHTML = godowns.map(g => `<option value="${g}">${g}</option>`).join('');

    const editMotorGodown = document.getElementById('editMotorGodown');
    if (editMotorGodown) {
        editMotorGodown.innerHTML = '<option value="">-- Do Not Change Godown --</option>' +
            godowns.map(g => `<option value="${g}">${g}</option>`).join('');
    }

    const newMotorGodown = document.getElementById('newMotorGodown');
    if (newMotorGodown) newMotorGodown.innerHTML = godowns.map(g => `<option value="${g}">${g}</option>`).join('');

    const challanSourceGodown = document.getElementById('challanSourceGodown');
    if (challanSourceGodown) {
        challanSourceGodown.innerHTML = godowns.map(g => `<option value="${g}">${g}</option>`).join('');
    }
};

// ─── App Init ─────────────────────────────────────────────────────────────────

function initApp() {
    document.getElementById('displayUsername').textContent = state.currentUser.role === 'admin' ? 'Administrator' : 'Transporter';
    document.getElementById('displayRole').textContent = state.currentUser.role === 'admin' ? 'Full Access' : 'Transport Ops';

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = state.currentUser.role === 'admin' ? '' : 'none';
    });

    switchView('dashboardView');

    populateGodownDropdowns();
    renderPipeTabs();
    renderPipes();
    renderFittingTabs();
    renderFittings();
    renderMotors();
    renderChallans();
    updateDashboard();
    renderLogs();
    setupSerialSearch();
}

// ─── Navigation ───────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        if (e.currentTarget.classList.contains('has-dropdown')) {
            const submenu = e.currentTarget.nextElementSibling;
            submenu.classList.toggle('hidden');
            e.currentTarget.classList.toggle('open');
            return;
        }

        const target = e.currentTarget.getAttribute('data-target');
        if (target === 'internalTransactions') {
            openNewChallanModal(true);
            return;
        }
        if (target === 'settingsView' || target === 'dataRetentionView') {
            if (typeof initSettingsView === 'function') {
                initSettingsView();
            }
        }
        if (target) switchView(target);

        document.querySelectorAll('.nav-item:not(.has-dropdown)').forEach(n => n.classList.remove('active'));
        e.currentTarget.classList.add('active');
    });
});

// ─── Add Stock Modal Form ─────────────────────────────────────────────────────

document.getElementById('addStockForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingStockAddition) return;

    const qtyInput = document.getElementById('addStockQuantityInput');
    const limitInput = document.getElementById('addStockLimitInput');
    const errorBlock = document.getElementById('addStockErrorBlock');
    errorBlock.style.display = 'none';
    errorBlock.innerText = '';

    const qtyStr = qtyInput.value.trim();
    if (qtyStr === '') { errorBlock.innerText = "Please enter a valid numeric quantity."; errorBlock.style.display = 'block'; return; }

    const qtyVal = parseInt(qtyStr, 10);
    if (isNaN(qtyVal)) { errorBlock.innerText = "Please enter a valid numeric quantity."; errorBlock.style.display = 'block'; return; }

    const limitStr = limitInput ? limitInput.value.trim() : '';
    if (limitStr === '') { errorBlock.innerText = "Please enter a valid low stock limit."; errorBlock.style.display = 'block'; return; }

    const limitVal = parseInt(limitStr, 10);
    if (isNaN(limitVal) || limitVal < 0) { errorBlock.innerText = "Low stock limit must be 0 or greater."; errorBlock.style.display = 'block'; return; }

    const { type, id, col, currentVal, godown } = pendingStockAddition;

    if (currentVal + qtyVal < 0) {
        errorBlock.innerText = `Stock cannot be reduced below 0 (Current Stock: ${currentVal}).`;
        errorBlock.style.display = 'block';
        return;
    }

    try {
        if (type === 'pipe') {
            const pipe = state.pipes.find(p => (p._id || p.id) === id);
            if (pipe) {
                if (!pipe.stock) pipe.stock = {};
                if (!pipe.stock[godown]) pipe.stock[godown] = {};
                pipe.stock[godown][col] = currentVal + qtyVal;

                if (!pipe.lowStockLimits) pipe.lowStockLimits = {};
                pipe.lowStockLimits[col] = limitVal;

                // Sync godownAllocations
                if (!pipe.godownAllocations) pipe.godownAllocations = [];
                let alloc = pipe.godownAllocations.find(a => a.godownName === godown);
                if (alloc) {
                    alloc.quantity = Math.max(0, alloc.quantity + qtyVal);
                } else {
                    pipe.godownAllocations.push({
                        godownId: 'godown-' + Math.random().toString(36).substr(2, 9),
                        godownName: godown,
                        quantity: Math.max(0, qtyVal)
                    });
                }

                await API.updatePipe(id, { stock: pipe.stock, lowStockLimits: pipe.lowStockLimits, godownAllocations: pipe.godownAllocations });
                saveState();
                renderPipes();
            }
        } else if (type === 'fitting') {
            const fitting = state.fittings.find(f => (f._id || f.id) === id);
            if (fitting) {
                if (!fitting.stock) fitting.stock = {};
                if (!fitting.stock[godown]) fitting.stock[godown] = {};
                fitting.stock[godown][col] = currentVal + qtyVal;

                if (!fitting.lowStockLimits) fitting.lowStockLimits = {};
                fitting.lowStockLimits[col] = limitVal;

                // Sync godownAllocations
                if (!fitting.godownAllocations) fitting.godownAllocations = [];
                let alloc = fitting.godownAllocations.find(a => a.godownName === godown);
                if (alloc) {
                    alloc.quantity = Math.max(0, alloc.quantity + qtyVal);
                } else {
                    fitting.godownAllocations.push({
                        godownId: 'godown-' + Math.random().toString(36).substr(2, 9),
                        godownName: godown,
                        quantity: Math.max(0, qtyVal)
                    });
                }

                await API.updateFitting(id, { stock: fitting.stock, lowStockLimits: fitting.lowStockLimits, godownAllocations: fitting.godownAllocations });
                saveState();
                renderFittings();
            }
        }

        closeModal('addStockModal');
        pendingStockAddition = null;
    } catch (err) {
        errorBlock.innerText = 'Error saving stock: ' + err.message;
        errorBlock.style.display = 'block';
    }
});

document.getElementById('addStockQuantityInput')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    const submitBtn = document.getElementById('addStockSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = (!isNaN(val) && val < 0)
            ? '<i class="fa-solid fa-minus"></i> Subtract Stock'
            : '<i class="fa-solid fa-plus"></i> Add Stock';
    }
});

// ─── Clear Selected Cells ─────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
    if (!e.target.closest('.excel-table td.editable')) {
        document.querySelectorAll('.excel-table td.editable').forEach(td => td.classList.remove('selected'));
    }
});

// ─── Init Connection Status on Page Load ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Initial wake-up + health check
    API.wakeServer().then(() => {
        updateConnectionStatus();
    });

    // Check connection every 30 seconds (less aggressive than 10s, but with retry tolerance)
    setInterval(updateConnectionStatus, 30000);

    // Start keep-alive pinger to prevent Render free-tier cold starts
    API.startKeepAlive();

    setupSerialSearch();

    // Also re-check when the browser tab becomes visible again (user returns)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('👁️ Tab visible — re-checking server status...');
            _healthFailCount = 0; // Reset so we don't flash offline
            updateConnectionStatus();
        }
    });
});

// Mobile navigation sidebar toggler helper
function initMobileNavigation() {
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebar = document.querySelector('.sidebar');

    if (mobileSidebarToggle && sidebarOverlay && sidebar) {
        mobileSidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });

        document.querySelectorAll('.sidebar .nav-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            });
        });
    }
}
initMobileNavigation();

