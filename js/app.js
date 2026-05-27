import { renderAll, renderInventory, renderRequests, initIcons } from './ui.js';
import { loginUser, fetchProducts, createProduct, updateProduct, addStock, deleteProduct, fetchRequests, createRequest, updateRequestStatus, returnRequest, deleteRequest, fetchLogs, fetchRetentionStats, purgeOldData, BASE_URL, fetchLocations, addLocation as apiAddLocation, deleteLocation as apiDeleteLocation, fetchPipeCategories, createPipeCategory, updatePipeCategory, deletePipeCategory, fetchPipeColumns, savePipeColumns } from './api.js';
import { state } from './state.js';

// ──────────────────────────────────────────
// INIT
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initIcons();
    checkServerConnection();
    
    // Check for existing session
    const savedUser = sessionStorage.getItem('ss_user');
    if (savedUser) {
        login(savedUser);
    }
});

async function loadAllData() {
    try {
        const [products, requests, logs, locations, pipeCategories, pipeColumns] = await Promise.all([
            fetchProducts(),
            fetchRequests(),
            fetchLogs(),
            fetchLocations(),
            fetchPipeCategories(),
            fetchPipeColumns(),
        ]);
        // Mutate in-place so ui.js (which imported the same object) sees the updates
        state.products.splice(0, state.products.length, ...products);
        state.requests.splice(0, state.requests.length, ...requests);
        state.logs.splice(0, state.logs.length, ...logs);
        state.locations.splice(0, state.locations.length, ...locations);
        state.pipeCategories.splice(0, state.pipeCategories.length, ...pipeCategories);
        state.pipeColumns.splice(0, state.pipeColumns.length, ...(pipeColumns || state.pipeColumns));
        renderAll();
    } catch (err) {
        console.error('Failed to load data from backend:', err);
    }
}

let connectionFailures = 0;
async function checkServerConnection() {
    const statusEl = document.getElementById('connection-status');
    const textEl = statusEl?.querySelector('.status-text');
    const updateStatus = (online) => {
        if (online) {
            connectionFailures = 0; // Reset on success
            statusEl.className = 'status-indicator status-online';
            if (textEl) textEl.textContent = 'Server Online';
        } else {
            connectionFailures++;
            // Only show offline if it fails 3 times in a row (30 seconds)
            if (connectionFailures >= 3) {
                statusEl.className = 'status-indicator status-offline';
                if (textEl) textEl.textContent = 'Server Offline';
            }
        }
    };
    try {
        const res = await fetch(`${BASE_URL}/ping`);
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
            const data = await res.json();
            updateStatus(data.status === 'ok');
        } else {
            throw new Error();
        }
    } catch (err) {
        updateStatus(false);
    }
    // Periodically re-check every 10 seconds
    if (!window._connectionInterval) {
        window._connectionInterval = setInterval(checkServerConnection, 10000);
    }
}

async function refreshPipeCategories() {
    try {
        const categories = await fetchPipeCategories();
        state.pipeCategories.splice(0, state.pipeCategories.length, ...categories);
        renderPipeCategoriesList();
    } catch (err) {
        console.error('Could not refresh pipe categories:', err);
    }
}

async function refreshPipeColumns() {
    try {
        const columns = await fetchPipeColumns();
        if (Array.isArray(columns)) {
            state.pipeColumns.splice(0, state.pipeColumns.length, ...columns);
        }
        const optionsContainer = document.getElementById('pipe-columns-options');
        if (optionsContainer) {
            optionsContainer.innerHTML = state.pipeColumns.map(name => `
                <label><input type="checkbox" name="pipe-column" value="${name}" ${state.pipeColumns.includes(name) ? 'checked' : ''}> ${name}</label>
            `).join('');
        }
    } catch (err) {
        console.error('Could not refresh pipe columns:', err);
    }
}

function createColumnRow(columnName) {
    const div = document.createElement('div');
    div.className = 'pipe-column-row';
    div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px; background:rgba(255,255,255,0.5); border-radius:8px;';
    div.innerHTML = `
        <label style="margin:0; display:flex; align-items:center; gap:8px; flex:1; cursor:pointer;" ondblclick="enableColumnEdit('${columnName}')">
            <input type="checkbox" name="pipe-column" value="${columnName}" checked> 
            <span class="column-name-display">${columnName}</span>
        </label>
        <div class="column-edit-controls" style="display:none; gap:4px;">
            <input type="text" class="column-name-input" value="${columnName}" style="padding:4px 8px; border-radius:4px; border:1px solid #ccc; width:80px;">
            <button type="button" class="glass-btn" onclick="saveColumnEdit('${columnName}')" style="padding:4px 8px; background:rgba(34,197,94,0.1); color:var(--success); font-size:12px;" title="Save">✓</button>
            <button type="button" class="glass-btn" onclick="cancelColumnEdit('${columnName}')" style="padding:4px 8px; background:rgba(107,114,128,0.1); color:#9ca3af; font-size:12px;" title="Cancel">✕</button>
        </div>
        <button type="button" class="glass-btn" style="padding:4px 8px; background:rgba(239,68,68,0.1); color:var(--danger);" onclick="deletePipeColumn('${columnName}')" title="Delete">
            <i data-lucide="trash-2" size="14"></i>
        </button>
    `;
    return div;
}

function addPipeColumnOption() {
    const input = document.getElementById('new-pipe-column-name');
    if (!input) return;
    const rawValue = input.value.trim();
    if (!rawValue) {
        return alert('Enter a new column name.');
    }
    const normalized = rawValue.toUpperCase();
    if (state.pipeColumns.includes(normalized)) {
        return alert('That column already exists.');
    }
    state.pipeColumns.push(normalized);
    const optionsContainer = document.getElementById('pipe-columns-options');
    if (optionsContainer) {
        optionsContainer.appendChild(createColumnRow(normalized));
        initIcons();
    }
    input.value = '';
}

function enableColumnEdit(oldName) {
    const row = document.querySelector(`[ondblclick*="${oldName}"]`)?.closest('.pipe-column-row');
    if (!row) return;
    row.querySelector('.column-name-display').style.display = 'none';
    row.querySelector('.column-edit-controls').style.display = 'flex';
    row.querySelector('.column-name-input').focus();
    row.querySelector('.column-name-input').select();
}

function saveColumnEdit(oldName) {
    const row = document.querySelector(`[ondblclick*="${oldName}"]`)?.closest('.pipe-column-row');
    if (!row) return;
    const newName = row.querySelector('.column-name-input').value.trim().toUpperCase();
    if (!newName) {
        alert('Column name cannot be empty.');
        return;
    }
    if (newName === oldName) {
        cancelColumnEdit(oldName);
        return;
    }
    if (state.pipeColumns.includes(newName)) {
        alert('Column already exists.');
        row.querySelector('.column-name-input').value = oldName;
        return;
    }
    const idx = state.pipeColumns.indexOf(oldName);
    if (idx > -1) {
        state.pipeColumns[idx] = newName;
    }
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.value = newName;
    }
    row.querySelector('.column-name-display').textContent = newName;
    row.querySelector('.column-name-display').style.display = 'inline';
    row.querySelector('.column-edit-controls').style.display = 'none';
}

function cancelColumnEdit(oldName) {
    const row = document.querySelector(`[ondblclick*="${oldName}"]`)?.closest('.pipe-column-row');
    if (!row) return;
    row.querySelector('.column-name-input').value = oldName;
    row.querySelector('.column-name-display').style.display = 'inline';
    row.querySelector('.column-edit-controls').style.display = 'none';
}

function deletePipeColumn(columnName) {
    const index = state.pipeColumns.indexOf(columnName);
    if (index > -1) {
        state.pipeColumns.splice(index, 1);
    }
    const optionsContainer = document.getElementById('pipe-columns-options');
    if (optionsContainer) {
        const rows = optionsContainer.querySelectorAll('.pipe-column-row');
        rows.forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.value === columnName) {
                row.remove();
            }
        });
    }
}

function updateProductSubcategoryOptions(category) {
    const select = document.getElementById('prod-subcategory');
    if (!select) return;
    const categories = state.pipeCategories.filter(c => c.type === category && c.active).sort((a, b) => (a.order || 0) - (b.order || 0));
    select.innerHTML = `
        <option value="">General</option>
        ${categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('')}
    `;
}

function renderPipeCategoriesList() {
    const tbody = document.getElementById('pipe-categories-list');
    if (!tbody) return;
    if (!state.pipeCategories.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted);">No categories defined yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = state.pipeCategories.sort((a, b) => (a.order || 0) - (b.order || 0)).map(cat => `
        <tr>
            <td><input class="pipe-category-name" data-id="${cat._id}" type="text" value="${cat.name}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px;"></td>
            <td>${cat.type}</td>
            <td><input class="pipe-category-order" data-id="${cat._id}" type="number" value="${cat.order || 0}" style="width:80px; padding:8px; border:1px solid #cbd5e1; border-radius:8px;"></td>
            <td style="text-align:center;"><input type="checkbox" ${cat.active ? 'checked' : ''} onchange="togglePipeCategoryActive('${cat._id}', this.checked)"></td>
            <td style="display:flex; gap:8px; justify-content:flex-end;">
                <button class="glass-btn" type="button" onclick="savePipeCategoryChanges('${cat._id}')">Save</button>
                <button class="glass-btn" type="button" onclick="deletePipeCategoryAction('${cat._id}')" style="background: rgba(239,68,68,0.1); color: var(--danger);">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openNewPipeCategoryModal(type = 'supreme') {
    document.getElementById('pipe-category-form')?.reset();
    const typeInput = document.getElementById('new-pipe-category-type');
    if (typeInput) typeInput.value = type;
    document.getElementById('pipe-category-modal').style.display = 'flex';
}

async function openManagePipeCategoriesModal() {
    await refreshPipeCategories();
    document.getElementById('pipe-categories-modal').style.display = 'flex';
}

async function openEditPipeColumnsModal() {
    await refreshPipeColumns();
    document.getElementById('pipe-columns-modal').style.display = 'flex';
}

function openQuickAddPipeModal() {
    document.getElementById('quick-add-pipe-form').reset();
    
    // Populate pipe categories
    const categorySelect = document.getElementById('quick-pipe-category');
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    state.pipeCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
        categorySelect.appendChild(option);
    });
    
    document.getElementById('quick-add-pipe-modal').style.display = 'flex';
    if (window.gsap) gsap.from('#quick-add-pipe-modal .modal-content', { scale: 0.88, opacity: 0, duration: 0.25, ease: 'power2.out' });
    initIcons();
}

async function handleQuickAddPipe(e) {
    e.preventDefault();
    const category = document.getElementById('quick-pipe-category').value.trim();
    const size = document.getElementById('quick-pipe-size').value.trim();
    const stock = 0;
    
    if (!category) {
        alert('Pipe category is required.');
        return;
    }
    
    if (!size) {
        alert('Pipe size is required.');
        return;
    }
    
    try {
        // Get the weight column for this pipe size
        const weight = size.includes('KG') ? size : (size.includes('SLOTTED') ? 'SLOTTED' : '4KG');
        
        const productData = {
            category: 'supreme',
            name: `Pipe ${size}`,
            model: size,
            unit: '',
            specs: { size },
            stock: stock,
            lowStockLimit: 10,
            serialNumbers: [],
            subCategory: category
        };
        
        await createProduct(productData);
        await loadAllData();
        document.getElementById('quick-add-pipe-modal').style.display = 'none';
        alert('Pipe added successfully!');
    } catch (err) {
        console.error('Error adding pipe:', err);
        alert('Could not add pipe. Please try again.');
    }
}

async function handleCreatePipeCategory(e) {
    e.preventDefault();
    const name = document.getElementById('new-pipe-category-name')?.value.trim();
    const type = document.getElementById('new-pipe-category-type')?.value || 'supreme';
    if (!name) return alert('Category name is required.');
    try {
        await createPipeCategory(name, type);
        await refreshPipeCategories();
        updateProductSubcategoryOptions(type);
        renderAll();
        document.getElementById('pipe-category-modal').style.display = 'none';
    } catch (err) {
        console.error('Could not create pipe category:', err);
        alert('Could not create category. Please try again.');
    }
}

async function handleSavePipeColumns(e) {
    e.preventDefault();
    const checked = Array.from(document.querySelectorAll('#pipe-columns-form input[name="pipe-column"]:checked')).map(el => el.value);
    if (!checked.length) return alert('Select at least one column.');
    try {
        await savePipeColumns(checked);
        state.pipeColumns.splice(0, state.pipeColumns.length, ...checked);
        document.getElementById('pipe-columns-modal').style.display = 'none';
        renderAll();
    } catch (err) {
        console.error('Could not save pipe columns:', err);
        alert('Could not save columns. Please try again.');
    }
}

async function togglePipeCategoryActive(id, active) {
    try {
        await updatePipeCategory(id, { active });
        await refreshPipeCategories();
        renderAll();
    } catch (err) {
        console.error('Could not update category active state:', err);
        alert('Could not update category.');
    }
}

async function savePipeCategoryChanges(id) {
    const nameInput = document.querySelector(`.pipe-category-name[data-id="${id}"]`);
    const orderInput = document.querySelector(`.pipe-category-order[data-id="${id}"]`);
    if (!nameInput || !orderInput) return;
    const name = nameInput.value.trim();
    const order = parseInt(orderInput.value) || 0;
    if (!name) return alert('Category name cannot be empty.');
    try {
        await updatePipeCategory(id, { name, order });
        await refreshPipeCategories();
        renderAll();
    } catch (err) {
        console.error('Could not save category changes:', err);
        alert('Could not save category changes.');
    }
}

async function deletePipeCategoryAction(id) {
    if (!confirm('Delete this category? This cannot be undone.')) return;
    try {
        await deletePipeCategory(id);
        await refreshPipeCategories();
        renderAll();
    } catch (err) {
        console.error('Could not delete category:', err);
        alert('Could not delete category.');
    }
}

// ──────────────────────────────────────────
// CATEGORY INLINE EDITING
// ──────────────────────────────────────────
function enableCategoryEdit(button) {
    const categoryId = button.getAttribute('data-category-id');
    const categoryName = button.getAttribute('data-category-name');
    
    if (!categoryId || categoryName === 'General') return;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = categoryName;
    input.className = 'category-edit-input';
    input.style.cssText = `
        padding: 8px 12px;
        border: 2px solid #2563eb;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        background: white;
        color: #0f172a;
        width: 150px;
        outline: none;
    `;
    
    // Replace button with input
    button.replaceWith(input);
    input.focus();
    input.select();
    
    // Handle Enter key
    const handleEnter = async (e) => {
        if (e.key === 'Enter') {
            const newName = input.value.trim();
            if (newName && newName !== categoryName) {
                await saveCategoryEdit(categoryId, newName);
            } else {
                cancelCategoryEdit(input, categoryName, categoryId);
            }
        }
    };
    
    // Handle Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            cancelCategoryEdit(input, categoryName, categoryId);
        }
    };
    
    input.addEventListener('keydown', handleEnter);
    input.addEventListener('keydown', handleEscape);
    input.addEventListener('blur', () => {
        // Auto-cancel on blur if still in edit mode
        if (input.parentElement) {
            cancelCategoryEdit(input, categoryName, categoryId);
        }
    });
}

async function saveCategoryEdit(categoryId, newName) {
    try {
        await updatePipeCategory(categoryId, { name: newName });
        await refreshPipeCategories();
        renderAll();
    } catch (err) {
        console.error('Could not update category:', err);
        alert('Could not update category. Please try again.');
    }
}

function cancelCategoryEdit(input, originalName, categoryId) {
    // Create a new button to replace the input
    const button = document.createElement('button');
    button.className = 'glass-btn pipe-category-btn';
    button.setAttribute('data-category-id', categoryId);
    button.setAttribute('data-category-name', originalName);
    button.style.cssText = `
        background: white;
        color: #2563eb;
        border: 1px solid #cbd5e1;
        padding: 10px 16px;
        font-weight: 600;
    `;
    button.textContent = originalName;
    button.onclick = (e) => {
        e.preventDefault();
        window.setPipeTab(originalName);
    };
    
    // Add double-click listener
    button.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        window.enableCategoryEdit(this);
    });
    
    input.replaceWith(button);
}

// ──────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────
function setupEventListeners() {
    // Auth — Admin uses inline password panel (prompt() blocked in modules)
    document.getElementById('btn-admin-login')?.addEventListener('click', () => {
        document.getElementById('admin-pass-panel').style.display = 'block';
        document.getElementById('admin-login-error').style.display = 'none';
        document.getElementById('admin-password-input').value = '';
        document.getElementById('admin-password-input').focus();
    });

    document.getElementById('btn-admin-confirm')?.addEventListener('click', async () => {
        const pass = document.getElementById('admin-password-input').value;
        try {
            const result = await loginUser('admin', pass);
            if (result.success) {
                document.getElementById('admin-pass-panel').style.display = 'none';
                login('admin');
            } else {
                document.getElementById('admin-login-error').style.display = 'block';
                document.getElementById('admin-login-error').textContent = '❌ ' + (result.message || 'Incorrect password. Try again.');
            }
        } catch (err) {
            console.error('Login error:', err);
            alert('⚠️ Connection Error: Could not reach the backend server. Please make sure the server is running.');
        }
    });

    document.getElementById('admin-password-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-admin-confirm').click();
    });

    document.getElementById('btn-admin-cancel')?.addEventListener('click', () => {
        document.getElementById('admin-pass-panel').style.display = 'none';
    });

    document.getElementById('btn-transporter-login')?.addEventListener('click', async () => {
        try {
            const result = await loginUser('transporter');
            if (result.success) login('transporter');
        } catch (err) {
            console.error('Login error:', err);
            alert('⚠️ Connection Error: Could not reach the backend server.');
        }
    });

    document.getElementById('btn-logout')?.addEventListener('click', logout);
    document.getElementById('btn-export-csv')?.addEventListener('click', exportLogsToCSV);

    // Retention Panel
    document.getElementById('btn-show-retention')?.addEventListener('click', async () => {
        const panel = document.getElementById('retention-panel');
        panel.classList.remove('hidden');
        // Load live stats from backend
        try {
            const stats = await fetchRetentionStats();
            document.getElementById('ret-total-logs').textContent = stats.logs.total;
            document.getElementById('ret-old-logs').textContent   = stats.logs.old;
            document.getElementById('ret-old-reqs').textContent   = stats.requests.old;
        } catch (e) {
            console.error('Could not load retention stats', e);
        }
        initIcons();
    });

    document.getElementById('btn-hide-retention')?.addEventListener('click', () => {
        document.getElementById('retention-panel').classList.add('hidden');
        document.getElementById('purge-result').classList.add('hidden');
    });

    document.getElementById('btn-manual-purge')?.addEventListener('click', async () => {
        if (!confirm('⚠️ Are you sure? This will permanently delete all logs and challans older than 18 months. This cannot be undone.')) return;
        const btn = document.getElementById('btn-manual-purge');
        btn.textContent = 'Purging...';
        btn.disabled = true;
        try {
            const result = await purgeOldData();
            const resultEl = document.getElementById('purge-result');
            resultEl.classList.remove('hidden');
            resultEl.style.background = 'rgba(16,185,129,0.1)';
            resultEl.style.color = 'var(--secondary)';
            resultEl.textContent = `✅ ${result.message}`;
            await loadAllData();
            // Refresh stats
            const stats = await fetchRetentionStats();
            document.getElementById('ret-total-logs').textContent = stats.logs.total;
            document.getElementById('ret-old-logs').textContent   = stats.logs.old;
            document.getElementById('ret-old-reqs').textContent   = stats.requests.old;
        } catch (e) {
            const resultEl = document.getElementById('purge-result');
            resultEl.classList.remove('hidden');
            resultEl.style.background = 'rgba(239,68,68,0.1)';
            resultEl.style.color = 'var(--danger)';
            resultEl.textContent = '❌ Purge failed. Please try again.';
        }
        btn.innerHTML = '<i data-lucide="trash-2"></i> Purge Old Records';
        btn.disabled = false;
        initIcons();
    });

    loadLocations();

    // Location Manager listeners
    document.getElementById('btn-add-location')?.addEventListener('click', () => addLocation());
    document.getElementById('new-location-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addLocation(); });

    // Mobile Menu
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));

    document.querySelectorAll('.nav-item, .nav-subitem').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.currentTarget.id === 'supreme-menu-toggle') {
                e.currentTarget.classList.toggle('open');
                document.getElementById('supreme-submenu').classList.toggle('open');
                return;
            }
            const view = e.currentTarget.getAttribute('data-view');
            if (view) {
                showView(view, e.currentTarget);
                if (window.innerWidth <= 1024) sidebar.classList.remove('open');
            }
        });
    });

    // Search
    document.getElementById('supreme-search')?.addEventListener('input', () => renderInventory('supreme'));
    document.getElementById('fitting-search')?.addEventListener('input', () => renderInventory('fitting'));
    document.getElementById('cri-search')?.addEventListener('input', () => renderInventory('cri'));

    // Expose globals for inline onclick in HTML
    window.openProductModal = openProductModal;
    window.openStockModal = openStockModal;
    window.openRequestModal = openRequestModal;
    window.addRequestItemRow = addRequestItemRow;
    window.openSerialManager = openSerialManager;
    window.openModelManager = openModelManager;
    window.openLocationManager = openLocationManager;
    window.addLocation = addLocation;
    window.deleteLocation = deleteLocation;
    window.handleDeleteProduct = handleDeleteProduct;
    window.removeManagerSerial = removeManagerSerial;
    window.closeModal = (id) => document.getElementById(id).style.display = 'none';
    window.refreshAllProductDropdowns = refreshAllProductDropdowns;
    window.toggleDestInput = toggleDestInput;
    window.openRequestModal = openRequestModal;
    window.openCompleteStockReport = openCompleteStockReport;
    window.printInlineStockReport = printInlineStockReport;
    window.openTransportHistory = openTransportHistory;
    window.switchHistoryTab = switchHistoryTab;
    window.renderTransportHistoryTables = renderTransportHistoryTables;
    window.openNewPipeCategoryModal = openNewPipeCategoryModal;
    window.openManagePipeCategoriesModal = openManagePipeCategoriesModal;
    window.openEditPipeColumnsModal = openEditPipeColumnsModal;
    window.openQuickAddPipeModal = openQuickAddPipeModal;
    window.handleQuickAddPipe = handleQuickAddPipe;
    window.addPipeColumnOption = addPipeColumnOption;
    window.enableColumnEdit = enableColumnEdit;
    window.saveColumnEdit = saveColumnEdit;
    window.cancelColumnEdit = cancelColumnEdit;
    window.deletePipeColumn = deletePipeColumn;
    window.savePipeCategoryChanges = savePipeCategoryChanges;
    window.togglePipeCategoryActive = togglePipeCategoryActive;
    window.deletePipeCategoryAction = deletePipeCategoryAction;
    window.enableCategoryEdit = enableCategoryEdit;
    window.saveCategoryEdit = saveCategoryEdit;
    window.cancelCategoryEdit = cancelCategoryEdit;

    // Serial Manager Tab switching
    document.querySelectorAll('.manager-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.manager-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.manager-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('pane-' + tab.dataset.pane).classList.add('active');
        };
    });

    // Manual Add
    document.getElementById('btn-manager-add')?.addEventListener('click', () => addSerialToManager());
    document.getElementById('manager-sn-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSerialToManager(); });

    // Range Gen
    document.getElementById('btn-manager-gen')?.addEventListener('click', () => generateRange());

    // Clear All
    document.getElementById('btn-manager-clear')?.addEventListener('click', () => {
        serialManagerState = [];
        renderManagerSerials();
    });

    // Apply
    document.getElementById('btn-manager-apply')?.addEventListener('click', () => applySerialsToProduct());

    // Autocomplete
    const snInput = document.getElementById('manager-sn-input');
    snInput?.addEventListener('input', async (e) => {
        const val = e.target.value.trim();
        const suggestionsDiv = document.getElementById('manager-suggestions');
        if (val.length < 2) { suggestionsDiv.style.display = 'none'; return; }
        
        try {
            const res = await fetch(`${BASE_URL}/serials/search?q=${val}`);
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const suggestions = await res.json();
                if (suggestions.length > 0) {
                    suggestionsDiv.innerHTML = suggestions.slice(0, 5).map(s => `
                        <div class="suggestion-item" onclick="selectManagerSuggestion('${s.serialNumber}')">${s.serialNumber} <small style="color:var(--text-muted)">(${s.productName})</small></div>
                    `).join('');
                    suggestionsDiv.style.display = 'block';
                } else {
                    suggestionsDiv.style.display = 'none';
                }
            } else {
                suggestionsDiv.style.display = 'none';
            }
        } catch (err) { console.error(err); }
    });
    window.selectManagerSuggestion = (val) => {
        document.getElementById('manager-sn-input').value = val;
        document.getElementById('manager-suggestions').style.display = 'none';
        addSerialToManager();
    };

    // Form Submissions
    document.getElementById('product-form')?.addEventListener('submit', handleProductSubmit);
    document.getElementById('request-form')?.addEventListener('submit', handleRequestSubmit);
    document.getElementById('stock-form')?.addEventListener('submit', handleStockSubmit);
    document.getElementById('pipe-category-form')?.addEventListener('submit', handleCreatePipeCategory);
    document.getElementById('pipe-columns-form')?.addEventListener('submit', handleSavePipeColumns);

    // Global Action Delegate
    document.addEventListener('click', (e) => {
        // Handle serial delete button
        const serialDeleteBtn = e.target.closest('.serial-delete-btn');
        if (serialDeleteBtn) {
            const productId = serialDeleteBtn.getAttribute('data-product-id');
            const serialNumber = serialDeleteBtn.getAttribute('data-serial');
            if (confirm(`Delete serial number "${serialNumber}"?`)) {
                handleDeleteSerial(productId, serialNumber);
            }
            return;
        }

        const btn = e.target.closest('.glass-btn');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const category = btn.getAttribute('data-category');
        if (action === 'edit') openProductModal(category, id);
        if (action === 'delete') handleDeleteProduct(id);
        if (action === 'add-stock') openStockModal(id);
        if (action === 'delete-serial') {
            if (state.currentUser !== 'admin') { alert('Access Denied: Admin privileges required.'); return; }
            const serial = btn.getAttribute('data-serial');
            const prodId = btn.getAttribute('data-product-id');
            if (!serial || !prodId) return;
            if (confirm(`Delete serial number "${serial}" from this product?`)) {
                handleDeleteSerial(prodId, serial);
            }
            return;
        }
        if (action === 'prompt-delete-serial') {
            if (state.currentUser !== 'admin') { alert('Access Denied: Admin privileges required.'); return; }
            const prodId = id;
            const q = prompt('Enter the exact serial number to delete (e.g. SN-1001):');
            if (q && q.trim()) {
                const sn = q.trim();
                if (confirm(`Delete serial "${sn}" from this product?`)) {
                    handleDeleteSerial(prodId, sn);
                }
            }
        }
        if (action === 'view-units') openUnitModal(id);
        if (action === 'toggle-serials') {
            const targetId = btn.getAttribute('data-target');
            const hiddenGroup = document.getElementById(targetId);
            if (hiddenGroup) {
                const isHidden = hiddenGroup.classList.toggle('hidden');
                btn.textContent = isHidden ? `See more (${hiddenGroup.children.length})` : 'Show less';
            }
        }
        if (action === 'delete-request') handleDeleteRequest(id);
        if (action === 'approve') handleRequest(id, 'approved');
        if (action === 'reject') handleRequest(id, 'rejected');
        if (action === 'return') handleReturnRequest(id);
        if (action === 'print') printChallan(id);
    });

    // Serial number search
    document.getElementById('btn-serial-search')?.addEventListener('click', handleSerialSearch);
    document.getElementById('serial-search-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSerialSearch(); });

    // document.getElementById('req-category')?.addEventListener('change', updateRequestProductList); // Handled dynamically per row now
}

// ──────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────
function login(role) {
    state.currentUser = role;
    sessionStorage.setItem('ss_user', role);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-role-name').textContent = role.charAt(0).toUpperCase() + role.slice(1);
    document.body.classList.toggle('role-admin', role === 'admin');
    document.body.classList.toggle('role-transporter', role === 'transporter');
    if (role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.transporter-only').forEach(el => el.classList.add('hidden'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.transporter-only').forEach(el => el.classList.remove('hidden'));
    }
    loadAllData();
}

function logout() {
    state.currentUser = null;
    sessionStorage.removeItem('ss_user');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

// ──────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────
function showView(viewId, navItem) {
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    document.querySelectorAll('.nav-item, .nav-subitem').forEach(item => item.classList.remove('active'));
    navItem.classList.add('active');
    if (navItem.classList.contains('nav-subitem')) {
        document.getElementById('supreme-menu-toggle').classList.add('active');
    }
    renderAll();
    if (viewId === 'reports') {
        openCompleteStockReport();
    }
}

// ──────────────────────────────────────────
// PRODUCT MODAL
// ──────────────────────────────────────────
function openProductModal(category, id = null) {
    if (state.currentUser !== 'admin') { alert('Access Denied: Admin privileges required.'); return; }
    
    // Secondary password check for Edit
    if (id) {
        const pass = prompt('Enter Admin Password to EDIT this product:');
        if (pass !== '12345678') {
            if (pass !== null) alert('❌ Incorrect password. Access denied.');
            return;
        }
    }
    const modal = document.getElementById('product-modal');
    document.getElementById('prod-category').value = category;
    document.getElementById('prod-id').value = id || '';
    
    const isMotor = category === 'cri';
    const isSupreme = category === 'supreme' || category === 'fitting';
    document.getElementById('prod-cri-unit-group').style.display = 'none';
    document.getElementById('motor-fields').style.display = isMotor ? 'block' : 'none';
    document.getElementById('prod-name-group').style.display = isMotor ? 'none' : 'block';
    document.getElementById('prod-model-group').style.display = isMotor ? 'none' : 'block';
    document.getElementById('prod-subcategory-group').style.display = isSupreme ? 'block' : 'none';
    updateProductSubcategoryOptions(category);
    
    document.getElementById('product-form-error').style.display = 'none';
    // Clear all field errors
    ['err-name','err-model','err-hp','err-phase','err-type','err-serials','err-stock','err-low-limit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
    ['prod-name','prod-model','prod-hp','prod-phase','prod-type','prod-serials','prod-low-limit'].forEach(id => {
        document.getElementById(id)?.classList.remove('invalid');
    });

    if (id) {
        const p = state.products.find(x => x._id === id || x.id === id);
        document.getElementById('prod-name').value = p?.name || '';
        document.getElementById('prod-model').value = p?.model || p?.specs?.model || '';
        document.getElementById('prod-unit').value = p?.unit || p?.specs?.unit || '';
        document.getElementById('prod-subcategory').value = p?.subCategory || '';
        if (isMotor) {
            document.getElementById('prod-hp').value = p?.specs?.hp || '';
            document.getElementById('prod-phase').value = p?.specs?.phase || 'Single Phase';
            document.getElementById('prod-type').value = p?.specs?.type || p?.model || '';
        }
        document.getElementById('prod-stock').value = p?.stock || '';
        document.getElementById('prod-low-limit').value = p?.lowStockLimit || 10;
        document.getElementById('modal-title').textContent = 'Edit Product';
        document.getElementById('modal-submit-button').innerHTML = '<i data-lucide="save"></i> Update Product';
        // Hide serial fields on edit (serials managed via Add Stock)
        document.getElementById('prod-serial-group').style.display = 'none';
        document.getElementById('prod-stock-group').style.display = 'block';
        document.getElementById('prod-stock').readOnly = false;
        document.getElementById('prod-stock').style.background = '';
        document.getElementById('prod-stock').style.color = '';
        document.getElementById('prod-stock-hint').style.display = 'none';
    } else {
        document.getElementById('product-form').reset();
        document.getElementById('prod-unit').value = '';
        document.getElementById('prod-subcategory').value = '';
        document.getElementById('prod-hp').value = '';
        document.getElementById('prod-phase').value = 'Single Phase';
        document.getElementById('prod-type').value = '';
        document.getElementById('prod-low-limit').value = 10;
        document.getElementById('prod-stock').value = '';
        document.getElementById('prod-stock').readOnly = false;
        document.getElementById('prod-stock').style.background = '';
        document.getElementById('prod-stock').style.color = '';
        document.getElementById('prod-stock-hint').style.display = 'none';
        document.getElementById('modal-title').textContent = isMotor ? 'Create New Motor Entry' : 'Add New Product';
        document.getElementById('modal-submit-button').innerHTML = isMotor ? '<i data-lucide="save"></i> Create Motor' : '<i data-lucide="save"></i> Save Product';
        const isSupreme = category === 'supreme' || category === 'fitting';
        document.getElementById('prod-serial-group').style.display = (isSupreme || isMotor) ? 'none' : 'block';
        document.getElementById('prod-stock-group').style.display = 'block';
        const serialsWrapper = document.getElementById('modal-serials-list-wrapper');
        if (serialsWrapper) serialsWrapper.style.display = 'none';
        // Reset serial count badge
        const badge = document.getElementById('serial-count-badge');
        if (badge) { badge.textContent = '0 entered'; badge.classList.remove('has-count'); }
        // Wire live serial counter
        const textarea = document.getElementById('prod-serials');
        textarea.oninput = () => {
            const val = textarea.value;
            const sns = val.split(/[\s,]+/).filter(s => s);
            const badge = document.getElementById('serial-count-badge');
            document.getElementById('prod-stock').value = sns.length || '';
            if (badge) {
                badge.textContent = `${sns.length} entered`;
                badge.classList.toggle('has-count', sns.length > 0);
            }
            
            // Update integrated list
            const searchVal = document.getElementById('modal-serials-search')?.value.toLowerCase() || '';
            renderModalSerialChips(sns, searchVal);
            document.getElementById('modal-serials-list-wrapper').style.display = sns.length > 0 ? 'block' : 'none';

            // Clear errors on change
            document.getElementById('err-serials').textContent = '';
            textarea.classList.remove('invalid');
        };

        const modalSearchInput = document.getElementById('modal-serials-search');
        if (modalSearchInput) {
            modalSearchInput.value = ''; // Reset search
            modalSearchInput.oninput = (e) => {
                const sns = textarea.value.split(/[\s,]+/).filter(s => s);
                renderModalSerialChips(sns, e.target.value.toLowerCase());
            };
        }
    }

    modal.style.display = 'flex';
    if (window.gsap) gsap.from('#product-modal .modal-content', { scale: 0.88, opacity: 0, duration: 0.25, ease: 'power2.out' });
    initIcons();
}


// ──────────────────────────────────────────
// PRODUCT FORM SUBMIT
// ──────────────────────────────────────────
async function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const category = document.getElementById('prod-category').value;
    const isMotor = category === 'cri';
    let name = document.getElementById('prod-name').value.trim();
    const model = document.getElementById('prod-model')?.value.trim() || '';
    const unit = document.getElementById('prod-unit')?.value.trim() || '';
    const hp = document.getElementById('prod-hp')?.value.trim() || '';
    const phase = document.getElementById('prod-phase')?.value || 'Single Phase';
    const type = document.getElementById('prod-type')?.value.trim() || '';
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const lowStockLimit = parseInt(document.getElementById('prod-low-limit').value) || 10;
    const subCategory = document.getElementById('prod-subcategory')?.value.trim() || '';

    // Build specs for backward compat
    const specs = isMotor ? { hp, phase, type, model, unit } : { model, unit };

    // Clear all errors
    const clearErrors = () => {
        ['err-name','err-model','err-hp','err-phase','err-type','err-serials','err-stock','err-low-limit'].forEach(eid => {
            const el = document.getElementById(eid);
            if (el) el.textContent = '';
        });
        ['prod-name','prod-model','prod-hp','prod-phase','prod-type','prod-serials'].forEach(eid => {
            document.getElementById(eid)?.classList.remove('invalid');
        });
        document.getElementById('product-form-error').style.display = 'none';
    };
    clearErrors();

    const showError = (fieldId, errId, msg) => {
        const field = document.getElementById(fieldId);
        const errEl = document.getElementById(errId);
        if (field) field.classList.add('invalid');
        if (errEl) errEl.textContent = msg;
    };

    let hasError = false;

    if (isMotor) {
        if (!hp) { showError('prod-hp', 'err-hp', 'Horsepower is required.'); hasError = true; }
        if (!type) { showError('prod-type', 'err-type', 'Motor type is required.'); hasError = true; }
        if (!name && !type) { showError('prod-name', 'err-name', 'Motor name is required.'); hasError = true; }
    } else {
        if (!name) { showError('prod-name', 'err-name', 'Product name is required.'); hasError = true; }
    }
    if (lowStockLimit < 0) {
        document.getElementById('err-low-limit').textContent = 'Alert limit cannot be negative.';
        hasError = true;
    }

    try {
        if (id) {
            if (hasError) return;
            await updateProduct(id, { name, model, unit, stock, lowStockLimit, specs, subCategory });
        } else {
            const serialRaw = document.getElementById('prod-serials').value;
            const serialNumbers = serialRaw.split(/[\s,]+/).map(s => s.trim()).filter(s => s);

            if (isMotor && !name) {
                // When creating motors, use type as the product title if no name is visible.
                const normalizedName = type || `Motor ${hp}${phase ? ' ' + phase : ''}`;
                if (normalizedName) {
                    name = normalizedName;
                }
            }

            // Client-side unique check
            const unique = new Set(serialNumbers);
            if (unique.size !== serialNumbers.length) {
                showError('prod-serials', 'err-serials', 'You have duplicate serial numbers in your list. Please remove them.');
                hasError = true;
            }
            if (hasError) return;

            await createProduct({ category, name, model, unit: isMotor ? `${hp}HP / ${phase}` : unit, specs, stock, lowStockLimit, serialNumbers, subCategory });
        }
        document.getElementById('product-modal').style.display = 'none';
        await loadAllData();
    } catch (err) {
        const errBox = document.getElementById('product-form-error');
        errBox.textContent = '⚠️ ' + (err.message || 'Could not save product. Please try again.');
        errBox.style.display = 'block';
        errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ──────────────────────────────────────────
// ADD STOCK MODAL
// ──────────────────────────────────────────
function openStockModal(id) {
    if (state.currentUser !== 'admin') { alert('Access Denied: Admin privileges required.'); return; }
    const modal = document.getElementById('stock-modal');
    
    document.getElementById('stock-form').reset();
    document.getElementById('stock-serials').value = '';
    
    const nameContainer = document.getElementById('stock-modal-prod-name-container');
    const selectContainer = document.getElementById('stock-modal-prod-select-container');
    const serialGroup = document.getElementById('stock-serials-group');
    
    if (id) {
        const product = state.products.find(p => (p._id || p.id) == id);
        if (!product) return;
        
        document.getElementById('stock-prod-id').value = id;
        
        if (nameContainer) nameContainer.style.display = 'block';
        if (selectContainer) selectContainer.style.display = 'none';
        
        document.getElementById('stock-modal-prod-name').textContent = product.name;
        document.getElementById('stock-modal-prod-meta').textContent = 
            Object.entries(product.specs || {}).map(([k, v]) => `${k}: ${v}`).join(' | ');
            
        const isSupreme = product.category === 'supreme' || product.category === 'fitting';
        if (serialGroup) serialGroup.style.display = isSupreme ? 'none' : 'block';
    } else {
        document.getElementById('stock-prod-id').value = '';
        
        if (nameContainer) nameContainer.style.display = 'none';
        if (selectContainer) selectContainer.style.display = 'block';
        
        const searchInput = document.getElementById('stock-modal-prod-search');
        if (searchInput) searchInput.value = '';
        
        const datalist = document.getElementById('stock-modal-prod-list');
        if (datalist) {
            datalist.innerHTML = state.products.map(p => {
                const specStr = Object.entries(p.specs || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
                const label = `[${p.category.toUpperCase()}] ${p.name} ${specStr ? `(${specStr})` : ''}`;
                return `<option value="${label}" data-id="${p._id || p.id}"></option>`;
            }).join('');
        }
        
        if (serialGroup) serialGroup.style.display = 'none';
        
        if (searchInput && !searchInput.dataset.listenerAdded) {
            searchInput.dataset.listenerAdded = "true";
            searchInput.addEventListener('change', () => {
                const opt = Array.from(datalist.options).find(o => o.value === searchInput.value);
                if (opt) {
                    const prodId = opt.getAttribute('data-id');
                    const selectedProduct = state.products.find(p => (p._id || p.id) == prodId);
                    if (selectedProduct) {
                        const isSupreme = selectedProduct.category === 'supreme' || selectedProduct.category === 'fitting';
                        if (serialGroup) serialGroup.style.display = isSupreme ? 'none' : 'block';
                    }
                }
            });
        }
    }
    
    modal.style.display = 'flex';
    if (window.gsap) gsap.from('#stock-modal .modal-content', { scale: 0.8, opacity: 0, duration: 0.3 });
    initIcons();
}

async function handleStockSubmit(e) {
    e.preventDefault();
    let id = document.getElementById('stock-prod-id').value;
    
    if (!id) {
        const searchVal = document.getElementById('stock-modal-prod-search').value;
        const datalist = document.getElementById('stock-modal-prod-list');
        const option = Array.from(datalist.options).find(opt => opt.value === searchVal);
        if (!option) {
            alert('Please select a valid product from the dropdown list.');
            return;
        }
        id = option.getAttribute('data-id');
    }

    const qty = parseInt(document.getElementById('stock-add-qty').value);
    const location = document.getElementById('stock-location').value;
    const serialRaw = document.getElementById('stock-serials').value;
    const serialNumbers = serialRaw.split(/[\n,]+/).map(s => s.trim()).filter(s => s);

    if (serialNumbers.length > 0 && serialNumbers.length !== qty) {
        alert(`Error: You entered ${serialNumbers.length} serial numbers but specified quantity to add as ${qty}.`);
        return;
    }

    try {
        const updated = await addStock(id, qty, serialNumbers, location);
        alert(`✅ Successfully added ${qty} units to ${updated.name} at ${location}`);
        document.getElementById('stock-modal').style.display = 'none';
        await loadAllData();
    } catch (err) {
        alert('Error adding stock: ' + err.message);
    }
}

// ──────────────────────────────────────────
// UNIT MODAL
// ──────────────────────────────────────────
function openUnitModal(id) {
    const modal = document.getElementById('unit-modal');
    const product = state.products.find(p => (p._id || p.id) == id);
    if (!product) return;

    document.getElementById('unit-modal-prod-name').textContent = product.name;
    const modelStr = product.model || product.specs?.model || '';
    const sizeStr = product.size || product.specs?.size || '';
    const metaParts = [modelStr, sizeStr].filter(Boolean);
    document.getElementById('unit-modal-prod-meta').textContent = metaParts.join(' | ') || 'No specs';
    
    // Render Units
    const tbody = document.getElementById('unit-list-table');
    const units = (product.units || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const statusIcon = { available: '🟢', sold: '🔴', 'in-transit': '🟡', dispatched: '⬛' };

    const isSupreme = product.category === 'supreme' || product.category === 'fitting';
    const titleEl = document.getElementById('unit-list-title');
    const sectionEl = document.getElementById('unit-list-section');
    if (titleEl) titleEl.style.display = isSupreme ? 'none' : 'block';
    if (sectionEl) sectionEl.style.display = isSupreme ? 'none' : 'block';

    if (units.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No units registered yet. Add stock to register serial numbers.</td></tr>`;
    } else {
        tbody.innerHTML = units.map(u => `
            <tr>
                <td style="font-family:monospace; font-weight:600; color:var(--primary);">${u.serialNumber || '—'}</td>
                <td>
                    <span class="unit-status-pill unit-${u.status}">
                        ${statusIcon[u.status] || ''} ${u.status.toUpperCase()}
                    </span>
                </td>
                <td><span class="location-badge">${u.location || 'Main Godown'}</span></td>
                <td style="color:var(--text-muted); font-size:12px;">${new Date(u.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    // Render History (Moved to Unit Modal)
    const history = (product.stockHistory || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const summaryContainer = document.getElementById('stock-summary-container');
    if (summaryContainer) {
        const totalInflow = history.reduce((acc, curr) => acc + (curr.added || 0), 0);
        const lastEntry = history.length > 0 ? new Date(history[0].timestamp).toLocaleDateString() : 'N/A';
        summaryContainer.innerHTML = `
            <div class="stock-summary-card">
                <div class="summary-stat">
                    <span class="label">Total Inflow</span>
                    <span class="value">${totalInflow}</span>
                </div>
                <div class="summary-stat">
                    <span class="label">Current Stock</span>
                    <span class="value">${product.stock}</span>
                </div>
                <div class="summary-stat">
                    <span class="label">Last Update</span>
                    <span class="value">${lastEntry}</span>
                </div>
            </div>
        `;
    }
    
    const historyTbody = document.getElementById('stock-history-table');
    
    if (history.length === 0) {
        historyTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 20px;">No historical entries found.</td></tr>`;
    } else {
        historyTbody.innerHTML = history.map((h, index) => `
            <tr class="history-row ${index === 0 ? 'latest-entry' : ''}">
                <td class="stock-history-date">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i data-lucide="${h.type === 'inflow' ? 'arrow-up-circle' : (h.type === 'adjustment' ? 'settings' : 'play-circle')}" size="14" style="color:${h.type === 'inflow' ? 'var(--secondary)' : 'var(--text-muted)'}"></i>
                        <div>
                            ${new Date(h.timestamp).toLocaleDateString()} <br>
                            <span style="font-size:10px; opacity:0.7;">${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                </td>
                <td style="color:var(--text-muted);">${h.before}</td>
                <td class="stock-history-qty">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span>+${h.added}</span>
                        <span class="history-type-badge badge-${h.type || 'inflow'}">${h.type || 'inflow'}</span>
                    </div>
                </td>
                <td style="font-weight:600; color:var(--primary);">${h.after}</td>
            </tr>
        `).join('');
    }

    modal.style.display = 'flex';
    if (window.gsap) gsap.from('#unit-modal .modal-content', { scale: 0.88, opacity: 0, duration: 0.25 });
    initIcons();
}

// ──────────────────────────────────────────
// DELETE PRODUCT
// ──────────────────────────────────────────
async function handleDeleteProduct(id) {
    if (state.currentUser !== 'admin') { alert('Access Denied: Admin privileges required.'); return; }
    
    const pass = prompt('Enter Admin Password to DELETE this product:');
    if (pass !== '12345678') {
        if (pass !== null) alert('❌ Incorrect password. Access denied.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
        await deleteProduct(id);
        await loadAllData();
    } catch (err) {
        alert('Error deleting product: ' + err.message);
    }
}

async function handleDeleteRequest(id) {
    if (!confirm('Are you sure you want to delete this transport challan? Any in-transit stock will be automatically restored to the source godown.')) return;
    try {
        await deleteRequest(id);
        await loadAllData();
    } catch (err) {
        alert('Error deleting challan: ' + err.message);
    }
}

async function handleDeleteSerial(productId, serialNumber) {
    try {
        const product = state.products.find(p => p._id === productId || p.id === productId);
        if (!product) {
            alert('Product not found');
            return;
        }

        // Remove the serial from the units array
        const indexToRemove = product.units.findIndex(u => u.serialNumber === serialNumber);
        if (indexToRemove !== -1) {
            product.units.splice(indexToRemove, 1);
            product.stock = product.units.length;

            // Save updated product
            const response = await fetch(`${BASE_URL}/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });

            if (!response.ok) {
                throw new Error('Failed to delete serial number');
            }

            alert('Serial number deleted successfully');
            await loadAllData();
        }
    } catch (err) {
        alert('Error deleting serial: ' + err.message);
    }
}

// ──────────────────────────────────────────
// SERIAL NUMBER SEARCH
// ──────────────────────────────────────────
async function handleSerialSearch() {
    const q = (document.getElementById('serial-search-input')?.value || '').trim();
    const container = document.getElementById('serial-search-results');
    if (!q) { container.style.display = 'none'; return; }

    container.style.display = 'block';
    container.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">Searching...</div>';

    try {
        const res = await fetch(`${BASE_URL}/serials/search?q=${encodeURIComponent(q)}`);
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned an unexpected response (HTML).');
        }
        const results = await res.json();

        if (!results.length) {
            container.innerHTML = `<div style="color:var(--text-muted); font-size:13px; padding:8px 0;">No unit found with serial number matching "<strong>${q}</strong>".</div>`;
            return;
        }

        const statusIcon = { available: '🟢', sold: '🔴', 'in-transit': '🟡', dispatched: '⬛' };
        container.innerHTML = results.map(r => `
            <div class="serial-result-card">
                <div style="flex:1;">
                    <div class="serial-mono">${r.serialNumber}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${r.productName}${r.model ? ` · ${r.model}` : ''} · <strong>${r.category?.toUpperCase()}</strong></div>
                </div>
                <div style="text-align:right;">
                    <span class="unit-status-pill unit-${r.status}">${statusIcon[r.status] || ''} ${r.status?.toUpperCase()}</span>
                    <div class="location-badge" style="margin-top:4px; display:inline-block;">${r.location}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); font-size:13px;">Search failed: ${err.message}</div>`;
    }
}

// ──────────────────────────────────────────
// REQUEST MODAL (CHALLAN)
// ──────────────────────────────────────────
function toggleDestInput() {
    const type = document.getElementById('req-dest-type').value;
    const container = document.getElementById('dest-container');
    const label = document.getElementById('lbl-dest-name');
    const isInternal = document.getElementById('request-modal')?.dataset.isInternal === 'true';
    
    const locs = state.locations.map(l => l.name);
    
    if (type === 'godown') {
        label.textContent = isInternal ? 'TO (Destination Godown)' : 'Destination Godown';
        container.innerHTML = `
            <select id="req-dest" class="form-control" required>
                ${locs.map(loc => `<option value="${loc}">${loc}</option>`).join('')}
            </select>
        `;
    } else {
        label.textContent = isInternal ? 'TO (Store Name)' : 'Store Name';
        container.innerHTML = `
            <input type="text" id="req-dest" class="form-control" placeholder="e.g. City Retail Branch" required>
        `;
    }
}

function openRequestModal(isInternal = false) {
    const modal = document.getElementById('request-modal');
    document.getElementById('request-form').reset();
    
    // Populate customer names list datalist
    const datalist = document.getElementById('req-customer-names-list');
    if (datalist) {
        const prefilled = ['hari', 'satheesh', 'priya ambeth', 'manikandan', 'sandy'];
        const dbNames = state.requests ? state.requests.map(r => r.customerName).filter(Boolean) : [];
        const customerNames = [...new Set([...prefilled, ...dbNames])].sort();
        datalist.innerHTML = customerNames.map(name => `<option value="${name}"></option>`).join('');
    }
    
    modal.dataset.isInternal = isInternal ? 'true' : 'false';
    
    // Set Title and Source Label
    const titleEl = document.getElementById('request-modal-title');
    const sourceLabel = document.getElementById('lbl-source-name');
    if (titleEl) {
        titleEl.textContent = isInternal ? 'Internal Transaction' : 'New Transportation Request';
    }
    if (sourceLabel) {
        sourceLabel.textContent = isInternal ? 'FROM (Source Godown)' : 'Source Godown';
    }
    
    // Reset destination type
    const destTypeGroup = document.getElementById('req-dest-type-group');
    if (isInternal) {
        document.getElementById('req-dest-type').value = 'godown';
        if (destTypeGroup) destTypeGroup.style.display = 'none';
        
        // Adjust grid for single column if Dest Type is hidden
        const destGrid = document.getElementById('req-dest-grid');
        if (destGrid) destGrid.style.gridTemplateColumns = '1fr';
    } else {
        document.getElementById('req-dest-type').value = 'store';
        if (destTypeGroup) destTypeGroup.style.display = 'block';
        
        const destGrid = document.getElementById('req-dest-grid');
        if (destGrid) destGrid.style.gridTemplateColumns = '140px 1fr';
    }
    toggleDestInput();
    
    // Populate source godowns
    const sourceSelect = document.getElementById('req-source');
    if (sourceSelect) {
        const locs = state.locations.map(l => l.name);
        sourceSelect.innerHTML = locs.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    }
    
    // Clear and init items container
    const container = document.getElementById('request-items-container');
    container.innerHTML = '';
    addRequestItemRow(); // Add first row
    
    modal.style.display = 'flex';
    if (window.gsap) gsap.from('#request-modal .modal-content', { scale: 0.8, opacity: 0, duration: 0.3 });
    initIcons();
}

function addRequestItemRow() {
    const container = document.getElementById('request-items-container');
    const rowId = 'row-' + Date.now();
    const row = document.createElement('div');
    row.className = 'glass-row mb-4';
    row.id = rowId;
    row.style.padding = '12px; border:1px solid var(--border-light); border-radius:12px; background:#fff;';
    
    row.innerHTML = `
        <div style="display:grid; grid-template-columns: 140px 1fr 80px 40px; gap:12px; align-items:end;">
            <div class="form-group" style="margin:0;">
                <label style="font-size:11px;">Category</label>
                <select class="form-control req-item-category" style="padding:6px; font-size:13px;" required>
                    <option value="">Select</option>
                    <option value="all">All Products</option>
                    <option value="supreme">Supreme</option>
                    <option value="fitting">Fittings</option>
                    <option value="cri">CRI</option>
                </select>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-size:11px;">Product</label>
                <input type="text" class="form-control req-item-product-search" list="${rowId}-list" placeholder="Search or type product..." style="padding:6px; font-size:13px;" required>
                <datalist id="${rowId}-list"></datalist>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-size:11px;">Qty</label>
                <input type="number" class="form-control req-item-qty" min="1" value="1" style="padding:6px; font-size:13px;" required>
            </div>
            <button type="button" class="glass-btn" style="padding:8px; color:var(--danger); border-color:var(--danger); background:transparent;" onclick="document.getElementById('${rowId}').remove()">
                <i data-lucide="trash-2" size="14"></i>
            </button>
        </div>
    `;
    
    container.appendChild(row);
    
    // Wire category change for this row
    const catSelect = row.querySelector('.req-item-category');
    const prodInput = row.querySelector('.req-item-product-search');
    const prodList = row.querySelector('datalist');
    
    catSelect.onchange = () => {
        prodInput.value = '';
        prodList.innerHTML = '';
        if (catSelect.value) {
            const filtered = catSelect.value === 'all' 
                ? state.products 
                : state.products.filter(p => p.category === catSelect.value);
            
            filtered.forEach(p => {
                const model = p.model || p.specs?.model || '';
                const sourceLoc = document.getElementById('req-source').value;
                const availableUnits = (p.units || []).filter(u => u.location === sourceLoc && u.status === 'available');
                
                // 1. Units with serial numbers get individual lines
                const withSN = availableUnits.filter(u => u.serialNumber && u.serialNumber.trim());
                // 2. Units without serial numbers (blank) get a single bulk line
                const withoutSN = availableUnits.filter(u => !u.serialNumber || !u.serialNumber.trim());

                withSN.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = `${p.name} ${model ? `[${model}]` : ''} (Avail: 1) SN: ${u.serialNumber}`;
                    opt.setAttribute('data-id', p._id || p.id);
                    opt.setAttribute('data-sn', u.serialNumber);
                    prodList.appendChild(opt);
                });

                if (withoutSN.length > 0 || (withSN.length === 0 && (p.category === 'supreme' || p.category === 'fitting'))) {
                    const opt = document.createElement('option');
                    opt.value = `${p.name} ${model ? `[${model}]` : ''} (Avail: ${withoutSN.length})`;
                    opt.setAttribute('data-id', p._id || p.id);
                    prodList.appendChild(opt);
                }
            });
        }
    };
    
    initIcons();
}

function refreshAllProductDropdowns() {
    const rows = document.querySelectorAll('#request-items-container .glass-row');
    rows.forEach(row => {
        const catSelect = row.querySelector('.req-item-category');
        if (catSelect && catSelect.value) {
            catSelect.dispatchEvent(new Event('change'));
        }
    });
}

async function handleRequestSubmit(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('#request-items-container .glass-row');
    const items = [];
    
    rows.forEach(row => {
        const input = row.querySelector('.req-item-product-search');
        const list = row.querySelector('datalist');
        const option = Array.from(list.options).find(opt => opt.value === input.value);
        const productId = option ? option.getAttribute('data-id') : null;
        const serialNumber = option ? option.getAttribute('data-sn') : null;
        
        const qty = parseInt(row.querySelector('.req-item-qty').value);
        if (productId && qty > 0) {
            items.push({ productId, qty, serialNumber });
        }
    });

    if (items.length === 0) {
        alert('Please add at least one product to the challan.');
        return;
    }

    const source = document.getElementById('req-source').value;
    const dest = document.getElementById('req-dest').value;
    const customerName = document.getElementById('req-customer-name')?.value || '';
    
    try {
        await createRequest({ items, source, dest, customerName });
        document.getElementById('request-modal').style.display = 'none';
        await loadAllData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ──────────────────────────────────────────
// HANDLE APPROVE / REJECT
// ──────────────────────────────────────────
async function handleRequest(id, status) {
    if (state.currentUser === 'admin' && status === 'approved') { 
        alert('Action Blocked: Only the Transporter can accept/approve this challan.'); 
        return; 
    }

    const confirmMsg = status === 'approved' 
        ? 'Are you sure you want to ACCEPT this transport challan? This will officially move the stock to in-transit.' 
        : 'Are you sure you want to REJECT this transport challan?';

    if (!confirm(confirmMsg)) return;
    try {
        await updateRequestStatus(id, status);
        await loadAllData();
        if (status === 'approved') {
            alert('✅ Challan accepted and stock moved. It is now ready for Admin to print.');
        } else if (status === 'rejected') {
            alert('❌ Challan rejected.');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function handleReturnRequest(id) {
    if (!confirm('Are you sure you want to RETURN this challan? This will move the units back from "in-transit" to "available" at the source location.')) return;
    try {
        await returnRequest(id);
        await loadAllData();
        alert('✅ Challan returned successfully. Stock has been restored.');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ──────────────────────────────────────────
// EXPORT CSV
// ──────────────────────────────────────────
function exportLogsToCSV() {
    if (!state.logs.length) { alert('No logs available to export.'); return; }
    const headers = ['Timestamp', 'Type', 'Item', 'Before', 'Change', 'After', 'User'];
    const rows = state.logs.map(l => [
        new Date(l.timestamp).toLocaleString(), l.type, l.item, l.before, l.change, l.after, l.user
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `sri_sapthagiri_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ──────────────────────────────────────────
// PRINT CHALLAN
// ──────────────────────────────────────────
function printChallan(id) {
    const req = state.requests.find(r => (r._id || r.id) == id);
    if (!req) { alert('Challan data not found.'); return; }
    
    const printWindow = window.open('', '_blank');
    const items = req.items || [{ category: req.category, productName: req.productName, qty: req.qty }];
    
    printWindow.document.write(`
        <html><head><title>Transport Challan #${req._id || req.id}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
            @page { size: 80mm auto; margin: 0; }
            body { 
                font-family: 'Inter', sans-serif; 
                width: 72mm; 
                margin: 0 auto; 
                padding: 5mm 0; 
                color: #000; 
                font-size: 11px; 
                line-height: 1.3;
            }
            .shop-header { text-align: center; margin-bottom: 10px; }
            .shop-name { font-size: 14px; font-weight: 800; margin-bottom: 2px; text-transform: uppercase; }
            .shop-info { font-size: 10px; font-weight: 400; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .challan-meta { margin-bottom: 10px; font-size: 10px; }
            .challan-meta div { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 4px 0; font-size: 10px; text-transform: uppercase; }
            td { padding: 6px 0; font-size: 10px; vertical-align: top; border-bottom: 0.5px solid #eee; }
            .qty-col { text-align: right; }
            .footer { margin-top: 20px; text-align: center; font-size: 10px; font-style: italic; }
            .sign-section { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; text-transform: uppercase; }
            .sign-box { border-top: 1px solid #000; padding-top: 4px; width: 30mm; text-align: center; }
        </style></head><body>
        <div class="shop-header">
            <div class="shop-name">SRISAPTHAGIRIELECTRICALS&HARDWARES</div>
            <div class="shop-info">
                123, Nethaji Road, TIRUPATI-517501.<br>
                Ph: 2229091, 7680848620, (M)9848048620
            </div>
        </div>
        <div class="divider"></div>
        <div class="challan-meta">
            <div><span><strong>Date:</strong> ${new Date(req.date).toLocaleDateString()}</span><span><strong>ID:</strong> ${req._id?.slice(-6) || req.id?.slice(-6)}</span></div>
            <div><span><strong>From:</strong> ${req.source}</span></div>
            <div><span><strong>To:</strong> ${req.dest}</span></div>
            ${req.customerName ? `<div><span><strong>Customer:</strong> ${req.customerName}</span></div>` : ''}
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width: 60%;">Description</th>
                    <th style="width: 20%;">UOM</th>
                    <th class="qty-col" style="width: 20%;">Qty</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => {
                    const uom = (item.category === 'supreme' || item.category === 'fitting') ? 'LENGTH/PCS' : 'NOS';
                    return `
                    <tr>
                        <td>${item.productName}${item.serialNumber ? `<br><span style="font-size:8px; color:#555;">SN: ${item.serialNumber}</span>` : ''}</td>
                        <td>${uom}</td>
                        <td class="qty-col">${item.qty}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div class="divider"></div>
        <div class="sign-section">
            <div class="sign-box">Transporter</div>
            <div class="sign-box">Authorized</div>
        </div>
        <div class="footer">Thank You! Visit Again</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body></html>
    `);
    printWindow.document.close();
}
// ──────────────────────────────────────────
// SERIAL NUMBER MANAGER
// ──────────────────────────────────────────
let serialManagerState = [];

function openSerialManager() {
    const mainSerials = document.getElementById('prod-serials').value;
    serialManagerState = mainSerials.split(/[\s,]+/).filter(s => s);
    
    renderManagerSerials();
    
    document.getElementById('serial-manager-modal').style.display = 'flex';
    initIcons();
}

function renderManagerSerials() {
    const container = document.getElementById('manager-chips');
    const countEl = document.getElementById('manager-count');
    
    if (!container) return;
    
    container.innerHTML = serialManagerState.map((sn, index) => `
        <div class="sn-tag">
            ${sn}
            <i data-lucide="x-circle" onclick="removeManagerSerial(${index})" style="width:14px; height:14px;"></i>
        </div>
    `).join('');

    document.getElementById('prod-stock').value = serialManagerState.length;
    countEl.textContent = serialManagerState.length;
    initIcons();
}

function removeManagerSerial(index) {
    serialManagerState.splice(index, 1);
    renderManagerSerials();
}

function addSerialToManager() {
    const input = document.getElementById('manager-sn-input');
    const val = input.value.trim();
    if (!val) return;
    
    if (val.includes(' ') || val.includes(',')) {
        alert('Each serial number must be a single word (no spaces or commas).');
        return;
    }
    
    if (serialManagerState.includes(val)) {
        alert('Serial number already added to this list.');
        return;
    }
    
    serialManagerState.push(val);
    input.value = '';
    renderManagerSerials();
}

function generateRange() {
    const prefix = document.getElementById('range-prefix').value.trim();
    const startNum = parseInt(document.getElementById('range-start').value);
    const count = parseInt(document.getElementById('range-count').value);
    
    if (isNaN(startNum) || isNaN(count) || count < 1) {
        alert('Please enter a valid start number and count.');
        return;
    }
    
    if (count > 500) {
        alert('Maximum 500 serials can be generated at once.');
        return;
    }
    
    for (let i = 0; i < count; i++) {
        const sn = prefix + (startNum + i);
        if (!serialManagerState.includes(sn)) {
            serialManagerState.push(sn);
        }
    }
    
    renderManagerSerials();
}

function applySerialsToProduct() {
    const input = document.getElementById('prod-serials');
    input.value = serialManagerState.join(', ');
    
    // Trigger input event to update main form badges/counters
    input.dispatchEvent(new Event('input'));
    
    document.getElementById('serial-manager-modal').style.display = 'none';
}

function renderModalSerialChips(serials, filter = '') {
    const container = document.getElementById('modal-serials-chips');
    if (!container) return;
    
    const filtered = filter ? serials.filter(s => s.toLowerCase().includes(filter)) : serials;
    
    container.innerHTML = filtered.map(sn => `
        <div class="sn-tag" style="font-size:11px; padding:4px 10px;">
            ${sn}
            <i data-lucide="x-circle" onclick="removeModalSerialChip('${sn}')" style="width:12px; height:12px;"></i>
        </div>
    `).join('') || (filter ? '<div style="font-size:11px; color:var(--text-muted); padding:8px;">No matches found</div>' : '');
    
    initIcons();
}

function removeModalSerialChip(snToRemove) {
    const textarea = document.getElementById('prod-serials');
    const sns = textarea.value.split(/[\s,]+/).filter(s => s);
    const updated = sns.filter(s => s !== snToRemove);
    textarea.value = updated.join(', ');
    textarea.dispatchEvent(new Event('input'));
}

async function syncLocationDropdowns() {
    const locs = state.locations.map(l => l.name);
    const dropdowns = ['req-source', 'stock-location'];
    dropdowns.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const current = el.value;
            el.innerHTML = locs.map(l => `<option value="${l}">${l}</option>`).join('');
            if (locs.includes(current)) el.value = current;
        }
    });
}

function renderLocationList() {
    const list = document.getElementById('location-list');
    if (!list) return;
    list.innerHTML = state.locations.map(loc => `
        <div class="flex justify-between items-center glass-row" style="padding:10px; border:1px solid var(--border-light); border-radius:12px; background:rgba(255,255,255,0.4); margin-bottom:4px;">
            <span style="font-weight:600;">${loc.name}</span>
            <button class="glass-btn" style="padding:6px; color:var(--danger); background:rgba(239,68,68,0.05);" onclick="deleteLocation('${loc.name}')">
                <i data-lucide="trash-2" size="16"></i>
            </button>
        </div>
    `).join('') || '<div style="text-align:center; color:var(--text-muted); font-size:13px; padding:20px;">No locations added yet.</div>';
    initIcons();
}

function openModelManager() {
    const category = document.getElementById('prod-category')?.value;
    if (!category) {
        alert('Please select a category (Supreme or CRI) first.');
        return;
    }
    const datalist = document.getElementById('model-suggestions');
    if (!datalist) return;
    const models = [...new Set(state.products
        .filter(p => p.category === category)
        .map(p => p.model || p.specs?.model)
        .filter(Boolean)
    )];
    datalist.innerHTML = models.map(m => `<option value="${m}">`).join('');
    document.getElementById('prod-model').focus();
}

async function loadLocations() {
    try {
        const locations = await fetchLocations();
        state.locations.splice(0, state.locations.length, ...locations);
        syncLocationDropdowns();
    } catch (e) { console.error("Error loading locations", e); }
}

async function addLocation() {
    const input = document.getElementById('new-location-input');
    const name = input.value.trim();
    if (!name) return;
    if (state.locations.some(l => l.name === name)) {
        alert('Location already exists.');
        return;
    }
    try {
        await apiAddLocation(name);
        input.value = '';
        await loadAllData();
        renderLocationList();
    } catch (err) {
        alert('Error adding location: ' + err.message);
    }
}

async function deleteLocation(name) {
    if (state.locations.length <= 1) {
        alert('You must have at least one location in the system.');
        return;
    }
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
        await apiDeleteLocation(name);
        await loadAllData();
        renderLocationList();
    } catch (err) {
        alert('Error deleting location: ' + err.message);
    }
}

function openLocationManager() {
    renderLocationList();
    document.getElementById('location-manager-modal').style.display = 'flex';
    if (window.gsap) gsap.from('#location-manager-modal .modal-content', { scale: 0.88, opacity: 0, duration: 0.25 });
}

// ──────────────────────────────────────────
// REPORTS & ANALYTICS
// ──────────────────────────────────────────
function openCompleteStockReport() {
    const container = document.getElementById('inline-stock-report-container');
    const tbody = document.getElementById('complete-stock-report-table-body');
    if (!container || !tbody) return;

    container.style.display = 'block';
    
    const sortedProducts = [...(state.products || [])].sort((a, b) => {
        const catA = a.category || '';
        const catB = b.category || '';
        if (catA !== catB) return catA.localeCompare(catB);
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
    });

    tbody.innerHTML = sortedProducts.map(p => {
        if (!p) return '';
        const locationCounts = {};
        if (p.units) {
            p.units.forEach(u => {
                if (!u) return;
                const loc = u.location ? u.location.trim() : 'Unknown';
                const status = u.status || 'available';
                if (status === 'available' || status === 'in-transit') {
                    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
                }
            });
        }
        
        let breakdownStr = '';
        if (Object.keys(locationCounts).length > 0) {
            breakdownStr = Object.entries(locationCounts)
                .map(([loc, qty]) => `<span class="status-pill status-approved" style="background:rgba(37,99,235,0.08); color:var(--primary); font-size:12px; font-weight:600; padding:3px 8px; border-radius:6px; border:1px solid rgba(37,99,235,0.15); margin-right:6px; display:inline-block; margin-bottom:4px;">${loc}: ${qty}</span>`)
                .join('');
        } else {
            breakdownStr = `<span style="color:var(--text-muted); font-style:italic;">No stock breakdown</span>`;
        }

        const modelOrSpec = p.category === 'cri' ? (p.model || p.specs?.model || p.unit || 'Standard') : (p.size || p.specs?.size || 'Standard');
        const pCategory = p.category || 'supreme';
        const pStock = p.stock || 0;
        const lowLimit = p.lowStockLimit || 10;

        return `
            <tr>
                <td style="text-transform: uppercase; font-weight:700; font-size:12px; color:var(--text-muted);">
                    <span class="brand-badge badge-${pCategory}">${pCategory}</span>
                </td>
                <td style="font-weight:600;">${p.name || 'Unnamed Product'}</td>
                <td>${modelOrSpec}</td>
                <td>${breakdownStr}</td>
                <td style="text-align: right; font-weight: 700; font-size: 15px; color: ${pStock <= lowLimit ? 'var(--danger)' : 'var(--success)'};">
                    ${pStock}
                </td>
            </tr>
        `;
    }).join('');
    
    if (window.lucide) lucide.createIcons();
}

function printInlineStockReport() {
    const reportHtml = document.getElementById('inline-stock-report-container').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Complete Stock Level Report</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
                h2 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 12px 10px; text-align: left; }
                th { background-color: #f3f4f6; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9fafb; }
                .badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
                .badge-cri { background: #fee2e2; color: #991b1b; }
                .badge-supreme { background: #dbeafe; color: #1e40af; }
                .badge-fitting { background: #dcfce7; color: #166534; }
                .breakdown-pill { display: inline-block; padding: 2px 6px; font-size: 11px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; margin-right: 4px; margin-bottom: 4px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <h2>Sri Sapthagiri Systems - Complete Stock Level Report</h2>
            <div style="font-size: 13px; color: #666; margin-bottom: 20px;">Generated on: ${new Date().toLocaleString()}</div>
            ${reportHtml}
        </body>
        </html>
    `);
    printWindow.document.close();
}

let currentHistoryTab = 'inverts';

function openTransportHistory() {
    const modal = document.getElementById('transport-history-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    if (window.gsap) gsap.from('#transport-history-modal .modal-content', { scale: 0.88, opacity: 0, duration: 0.25 });
    
    const filterSelect = document.getElementById('history-location-filter');
    if (filterSelect) {
        const locationsSet = new Set();
        if (state.requests) {
            state.requests.forEach(r => {
                if (r.source) locationsSet.add(r.source.trim());
                if (r.dest) locationsSet.add(r.dest.trim());
            });
        }
        if (state.locations) {
            state.locations.forEach(loc => {
                if (loc.name) locationsSet.add(loc.name.trim());
            });
        }
        
        const sortedLocations = [...locationsSet].sort();
        filterSelect.innerHTML = '<option value="all">All Locations</option>' + 
            sortedLocations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    }

    currentHistoryTab = 'inverts';
    switchHistoryTab('inverts');
}

function switchHistoryTab(tab) {
    currentHistoryTab = tab;
    
    const tabInverts = document.getElementById('tab-inverts');
    const tabOutverts = document.getElementById('tab-outverts');
    const paneInverts = document.getElementById('pane-inverts');
    const paneOutverts = document.getElementById('pane-outverts');

    if (tab === 'inverts') {
        tabInverts.classList.add('active');
        tabOutverts.classList.remove('active');
        paneInverts.classList.add('active');
        paneOutverts.classList.remove('active');
    } else {
        tabOutverts.classList.add('active');
        tabInverts.classList.remove('active');
        paneOutverts.classList.add('active');
        paneInverts.classList.remove('active');
    }

    renderTransportHistoryTables();
}

function renderTransportHistoryTables() {
    const filterLoc = document.getElementById('history-location-filter')?.value || 'all';
    
    const tbodyInverts = document.getElementById('inverts-history-table-body');
    const tbodyOutverts = document.getElementById('outverts-history-table-body');
    
    if (!state.requests) return;

    const invertsRequests = state.requests.filter(r => {
        const matchesLoc = filterLoc === 'all' || (r.dest && r.dest.trim().toLowerCase() === filterLoc.trim().toLowerCase());
        return matchesLoc && r.status === 'approved';
    });

    const outvertsRequests = state.requests.filter(r => {
        const matchesLoc = filterLoc === 'all' || (r.source && r.source.trim().toLowerCase() === filterLoc.trim().toLowerCase());
        return matchesLoc;
    });

    const formatDateStr = (d) => {
        try { return new Date(d).toLocaleDateString('en-GB'); } 
        catch (e) { return '-'; }
    };

    if (tbodyInverts) {
        if (invertsRequests.length === 0) {
            tbodyInverts.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); font-style:italic; padding: 20px;">No inbound transfers found.</td></tr>`;
        } else {
            tbodyInverts.innerHTML = invertsRequests.map(r => `
                <tr>
                    <td>${formatDateStr(r.date)}</td>
                    <td style="font-size:12px; font-weight:700; color:var(--primary);">#${r._id ? String(r._id).slice(-6) : '-'}</td>
                    <td>${r.source || '-'}</td>
                    <td style="font-weight:600; color:var(--text-main);">${r.customerName || '-'}</td>
                    <td style="font-weight:600; color:var(--secondary);">${r.dest || '-'}</td>
                    <td style="font-size:12px;">${(r.items || []).map(item => `<div>${item ? (item.productName || 'Unknown') : 'Unknown'} (x${item ? (item.qty || 0) : 0})</div>`).join('')}</td>
                    <td><span class="status-pill status-${r.status || 'pending'}">${r.status || 'pending'}</span></td>
                </tr>
            `).join('');
        }
    }

    if (tbodyOutverts) {
        if (outvertsRequests.length === 0) {
            tbodyOutverts.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); font-style:italic; padding: 20px;">No outbound transfers found.</td></tr>`;
        } else {
            tbodyOutverts.innerHTML = outvertsRequests.map(r => `
                <tr>
                    <td>${formatDateStr(r.date)}</td>
                    <td style="font-size:12px; font-weight:700; color:var(--primary);">#${r._id ? String(r._id).slice(-6) : '-'}</td>
                    <td style="font-weight:600; color:var(--secondary);">${r.source || '-'}</td>
                    <td style="font-weight:600; color:var(--text-main);">${r.customerName || '-'}</td>
                    <td>${r.dest || '-'}</td>
                    <td style="font-size:12px;">${(r.items || []).map(item => `<div>${item ? (item.productName || 'Unknown') : 'Unknown'} (x${item ? (item.qty || 0) : 0})</div>`).join('')}</td>
                    <td><span class="status-pill status-${r.status || 'pending'}">${r.status || 'pending'}</span></td>
                </tr>
            `).join('');
        }
    }

    if (window.lucide) lucide.createIcons();
}
