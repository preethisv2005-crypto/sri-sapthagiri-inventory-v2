/**
 * fittings.js - Fittings Inventory Module
 * Sri Sapthagiri Logistics Inventory System
 */

let currentFittingTypeTab = 'CPVC FITTINGS';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFittingStockVal(fitting, col, godownFilter) {
    if (!fitting.stock) return 0;
    if (godownFilter === 'all') {
        let sum = 0;
        state.godowns.forEach(g => {
            if (fitting.stock[g] && fitting.stock[g][col] !== undefined) {
                sum += fitting.stock[g][col];
            }
        });
        return sum;
    } else {
        if (fitting.stock[godownFilter] && fitting.stock[godownFilter][col] !== undefined) {
            return fitting.stock[godownFilter][col];
        }
        return 0;
    }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderFittingTabs() {
    const container = document.getElementById('fittingTabsContainer');
    const select = document.getElementById('fittingTypeInput');
    if (!container || !select) return;

    container.innerHTML = '';
    select.innerHTML = '';

    const keys = Object.keys(state.fittingSchemas);
    if (!keys.includes(currentFittingTypeTab) && keys.length > 0) {
        currentFittingTypeTab = keys[0];
    }

    keys.forEach(type => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${type === currentFittingTypeTab ? 'active' : ''}`;
        btn.setAttribute('data-type', type);
        btn.textContent = type;
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#fittingTabsContainer .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFittingTypeTab = type;
            renderFittings();
        });
        container.appendChild(btn);

        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        select.appendChild(opt);
    });

    const optAddNew = document.createElement('option');
    optAddNew.value = 'ADD_NEW_CATEGORY';
    optAddNew.textContent = '+ Add New Category...';
    optAddNew.style.fontWeight = 'bold';
    optAddNew.style.color = 'var(--primary)';
    select.appendChild(optAddNew);
}

function renderFittings() {
    const titleEl = document.getElementById('fittingsViewTitle');
    if (titleEl) {
        const godownText = currentGodownFilter === 'all' ? 'Global' : currentGodownFilter;
        titleEl.textContent = `Fittings Inventory (${godownText})`;
    }

    const tableHeadRow = document.getElementById('fittingsTableHeadRow');
    const tbody = document.getElementById('fittingsTableBody');
    if (!tableHeadRow || !tbody) return;
    tbody.innerHTML = '';

    const columns = state.fittingSchemas[currentFittingTypeTab] || ["Size"];

    let thHtml = `<th style="text-align: left;">Item Name</th>`;
    columns.forEach(col => { thHtml += `<th style="text-align: center;">${col}</th>`; });
    thHtml += `<th style="text-align: center;">Actions</th>`;
    tableHeadRow.innerHTML = thHtml;

    const filteredFittings = state.fittings.filter(f => {
        if (f.type !== currentFittingTypeTab) return false;
        if (currentGodownFilter === 'all') return true;
        
        const gFilter = currentGodownFilter.toLowerCase();
        
        // Check for non-zero stock in this godown
        let hasStock = false;
        if (f.stock) {
            const gKey = Object.keys(f.stock).find(k => k.toLowerCase() === gFilter);
            if (gKey) {
                hasStock = Object.values(f.stock[gKey]).some(v => v > 0);
            }
        }
        
        // Check for allocation
        const hasAllocation = f.godownAllocations && f.godownAllocations.some(a => a.godownName.toLowerCase() === gFilter);
        
        return hasStock || hasAllocation;
    });

    filteredFittings.forEach(fitting => {
        const tr = document.createElement('tr');
        const fitId = fitting._id || fitting.id;
        let trHtml = `
            <td>
                <strong>${fitting.name}</strong>
                <i class="fa-solid fa-pencil admin-only" style="color: #3b82f6; cursor: pointer; margin-left: 0.5rem;" onclick="openEditFittingModal('${fitId}')" title="Edit Fitting"></i>
            </td>
        `;

        columns.forEach(col => {
            const val = getFittingStockVal(fitting, col, currentGodownFilter);
            const escapedCol = col.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const unit = fitting.unit || "NO'S";
            trHtml += `<td class="editable" onclick="handleFittingStockClick(this, '${fitId}', '${escapedCol}')"><div class="pipe-stock-box">${val} ${unit}</div></td>`;
        });

        trHtml += `
            <td style="text-align: center;">
                <button class="btn-delete-fitting admin-only" onclick="deleteFitting('${fitId}')" title="Delete Fitting"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        `;
        tr.innerHTML = trHtml;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = state.currentUser.role === 'admin' ? '' : 'none';
    });
}

// ─── Stock Click ──────────────────────────────────────────────────────────────

window.handleFittingStockClick = function (cellElement, id, col) {
    if (state.currentUser.role !== 'admin') return;

    if (currentGodownFilter === 'all') {
        alert("Please select a specific godown first to add stock.");
        return;
    }

    const now = Date.now();
    const lastClick = parseInt(cellElement.dataset.lastClick || "0", 10);
    const isDoubleTap = (now - lastClick < 300);
    cellElement.dataset.lastClick = now.toString();

    if (!isDoubleTap && !cellElement.classList.contains('selected')) {
        document.querySelectorAll('.excel-table td.editable').forEach(td => td.classList.remove('selected'));
        cellElement.classList.add('selected');
        return;
    }

    cellElement.classList.add('selected');

    const fitting = state.fittings.find(f => (f._id || f.id) === id);
    if (!fitting.stock) fitting.stock = {};
    if (!fitting.stock[currentGodownFilter]) fitting.stock[currentGodownFilter] = {};

    const currentVal = fitting.stock[currentGodownFilter][col] || 0;

    pendingStockAddition = { type: 'fitting', id, col, currentVal, godown: currentGodownFilter };

    document.getElementById('addStockModalTitle').innerText = `Add Stock: ${fitting.name} (${col})`;
    document.getElementById('addStockGodown').innerText = currentGodownFilter;
    document.getElementById('addStockCurrentValue').innerText = currentVal;

    const qtyInput = document.getElementById('addStockQuantityInput');
    qtyInput.value = '';
    const limitInput = document.getElementById('addStockLimitInput');
    if (limitInput) {
        const limitVal = (fitting.lowStockLimits && fitting.lowStockLimits[col] !== undefined)
            ? fitting.lowStockLimits[col]
            : (fitting.lowStockLimit !== undefined ? fitting.lowStockLimit : 10);
        limitInput.value = limitVal;
    }
    const errorBlock = document.getElementById('addStockErrorBlock');
    errorBlock.style.display = 'none';
    errorBlock.innerText = '';

    const submitBtn = document.getElementById('addStockSubmitBtn');
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Stock';

    openModal('addStockModal');
    setTimeout(() => qtyInput.focus(), 50);
};

window.editFittingName = function (id) {
    if (state.currentUser.role !== 'admin') return;
    const fitting = state.fittings.find(f => (f._id || f.id) === id);
    if (!fitting) return;
    const newName = prompt(`Enter new name/size for this fitting:`, fitting.name);
    if (newName !== null && newName.trim() !== '') {
        fitting.name = newName.trim().toUpperCase();
        API.updateFitting(id, { name: fitting.name }).then(() => {
            saveState();
            renderFittings();
        }).catch(err => alert('Error updating fitting: ' + err.message));
    }
};

window.deleteFitting = function (id) {
    if (state.currentUser.role !== 'admin') return;
    const fitting = state.fittings.find(f => (f._id || f.id) === id);
    if (!fitting) return;
    
    confirmDeletion(() => {
        API.deleteFittingApi(id).then(() => {
            state.fittings = state.fittings.filter(f => (f._id || f.id) !== id);
            saveState();
            renderFittings();
        }).catch(err => alert('Error deleting fitting: ' + err.message));
    }, `Are you sure you want to delete the fitting "${fitting.name}" and all its stock?`);
};

// Add event listener for adding godown allocation row
document.getElementById('addFittingGodownBtn')?.addEventListener('click', () => {
    addGodownAllocationRow('fittingGodownAllocationsContainer');
});

function syncStockWithAllocations(oldStock, godownAllocations, columns) {
    const stock = { ...oldStock };
    const allocatedGodownNames = godownAllocations.map(a => a.godownName);
    
    // Ensure all allocated godowns exist in stock
    allocatedGodownNames.forEach(g => {
        if (!stock[g]) {
            stock[g] = {};
        }
        columns.forEach(col => {
            if (stock[g][col] === undefined) {
                stock[g][col] = 0;
            }
        });
    });
    
    // Zero out godowns NOT in the allocation list
    Object.keys(stock).forEach(g => {
        if (!allocatedGodownNames.includes(g)) {
            columns.forEach(col => {
                stock[g][col] = 0;
            });
        }
    });
    
    return stock;
}

window.openAddFittingModal = function () {
    document.getElementById('editingFittingId').value = '';
    document.getElementById('fittingModalTitle').textContent = 'Add New Fitting';
    document.getElementById('fittingSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Fitting';
    
    document.getElementById('fittingForm').reset();
    document.getElementById('fittingTypeInput').disabled = false;
    document.getElementById('fittingLimit').value = 10;
    
    const container = document.getElementById('fittingGodownAllocationsContainer');
    if (container) {
        container.innerHTML = '';
        addGodownAllocationRow('fittingGodownAllocationsContainer', null, 0);
    }
    
    openModal('fittingModal');
};

window.openEditFittingModal = function (id) {
    const fitting = state.fittings.find(f => (f._id || f.id) === id);
    if (!fitting) return;
    
    document.getElementById('editingFittingId').value = id;
    document.getElementById('fittingModalTitle').textContent = 'Edit Fitting Details';
    document.getElementById('fittingSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
    
    document.getElementById('fittingTypeInput').value = fitting.type;
    document.getElementById('fittingTypeInput').disabled = true;
    document.getElementById('fittingNameInput').value = fitting.name;
    document.getElementById('fittingLimit').value = fitting.lowStockLimit || 10;
    document.getElementById('fittingUnit').value = fitting.unit || "NO'S";
    
    let allocations = [];
    if (fitting.godownAllocations && fitting.godownAllocations.length > 0) {
        allocations = fitting.godownAllocations;
    } else if (fitting.stock) {
        const columns = state.fittingSchemas[fitting.type] || ["Size"];
        Object.entries(fitting.stock).forEach(([g, cols]) => {
            let sum = 0;
            columns.forEach(col => sum += (cols[col] || 0));
            if (sum > 0) {
                allocations.push({ godownName: g });
            }
        });
    }
    
    const container = document.getElementById('fittingGodownAllocationsContainer');
    if (container) {
        container.innerHTML = '';
        if (allocations.length > 0) {
            allocations.forEach(alloc => {
                addGodownAllocationRow('fittingGodownAllocationsContainer', alloc.godownName);
            });
        } else {
            addGodownAllocationRow('fittingGodownAllocationsContainer');
        }
    }
    
    openModal('fittingModal');
};

document.getElementById('fittingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editingId = document.getElementById('editingFittingId').value;
    const name = document.getElementById('fittingNameInput').value.trim();
    const type = document.getElementById('fittingTypeInput').value;
    const limit = parseInt(document.getElementById('fittingLimit').value, 10) || 10;
    const unit = document.getElementById('fittingUnit').value;

    const allocations = [];
    const allocationRows = document.querySelectorAll('#fittingGodownAllocationsContainer .godown-allocation-row');
    let hasErrors = false;
    const selectedGodowns = [];
    
    allocationRows.forEach(row => {
        const godownName = row.querySelector('.godown-select').value;
        
        if (selectedGodowns.includes(godownName)) {
            alert("Duplicate godown selection is not allowed.");
            hasErrors = true;
            return;
        }
        selectedGodowns.push(godownName);
        
        allocations.push({
            godownId: 'godown-' + Math.random().toString(36).substr(2, 9),
            godownName,
            quantity: 0
        });
    });
    
    if (hasErrors) return;
    
    const columns = state.fittingSchemas[type] || ["Size"];

    try {
        if (editingId) {
            const existingFitting = state.fittings.find(f => (f._id || f.id) === editingId);
            const stock = syncStockWithAllocations(existingFitting.stock || {}, allocations, columns);
            
            const updatedFitting = await API.updateFitting(editingId, { type, name, stock, lowStockLimit: limit, unit, godownAllocations: allocations });
            
            const idx = state.fittings.findIndex(f => (f._id || f.id) === editingId);
            if (idx !== -1) state.fittings[idx] = updatedFitting;
            
            showToast("Fitting details updated successfully.");
        } else {
            let initialStock = {};
            state.godowns.forEach(g => {
                initialStock[g] = {};
                columns.forEach(c => {
                    initialStock[g][c] = 0;
                });
            });

            const newFitting = await API.createFitting({ type, name, stock: initialStock, lowStockLimit: limit, unit, godownAllocations: allocations });
            state.fittings.push(newFitting);
            currentFittingTypeTab = type;
            renderFittingTabs();
        }

        saveState(); 
        renderFittings(); 
        closeModal('fittingModal');
        e.target.reset();
        document.getElementById('editingFittingId').value = '';
        document.getElementById('fittingLimit').value = 10;
    } catch (err) {
        alert('Error saving fitting: ' + err.message);
    }
});

document.getElementById('fittingTypeInput')?.addEventListener('change', async (e) => {
    if (e.target.value === 'ADD_NEW_CATEGORY') {
        const catName = prompt("Enter new Fitting Category Name (e.g. PPR FITTINGS):");
        if (catName && catName.trim() !== '') {
            const name = catName.trim().toUpperCase();
            if (state.fittingSchemas[name]) {
                alert("Category already exists!");
                e.target.value = currentFittingTypeTab;
                return;
            }

            try {
                // 1. Update state
                state.fittingSchemas[name] = ["1/2\""];
                
                // 2. Save to backend
                await API.saveSettings({ fittingSchemas: state.fittingSchemas });
                
                // 3. Update UI
                currentFittingTypeTab = name;
                renderFittingTabs(); // This rebuilds the dropdown
                
                // 4. Select the new one in the dropdown
                const select = document.getElementById('fittingTypeInput');
                if (select) select.value = name;

                saveState();
                renderFittings();
            } catch (err) {
                alert("Error saving category: " + err.message);
                e.target.value = currentFittingTypeTab;
            }
        } else {
            e.target.value = currentFittingTypeTab;
        }
    }
});

window.addFittingCategory = function () {
    if (state.currentUser.role !== 'admin') return;
    const catName = prompt("Enter new Fitting Category Name (e.g. 'UPVC FITTINGS'):");
    if (catName && catName.trim() !== '') {
        const name = catName.trim().toUpperCase();
        if (state.fittingSchemas[name]) { alert("Category already exists!"); return; }
        state.fittingSchemas[name] = ["1/2\""];
        API.saveSettings({ fittingSchemas: state.fittingSchemas }).then(() => {
            saveState();
            currentFittingTypeTab = name;
            renderFittingTabs();
            renderFittings();
        }).catch(err => alert('Error: ' + err.message));
    }
};

window.openEditFittingColumnsModal = function () {
    const cols = state.fittingSchemas[currentFittingTypeTab] || [];
    const list = document.getElementById('fittingColumnsEditList');
    list.innerHTML = '';
    cols.forEach((c) => {
        list.innerHTML += `
            <div>
                <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600; color:#475569; font-size:1rem; padding: 0.25rem 0;">
                    <input type="checkbox" name="activeFittingColumns" value="${c.replace(/"/g, '&quot;')}" checked style="display:none;" onchange="this.nextElementSibling.style.color = this.checked ? '#3b82f6' : '#cbd5e1'">
                    <i class="fa-solid fa-circle-check checkbox-icon" style="color:#3b82f6; font-size:1.2rem; transition: color 0.2s;"></i>
                    <span>${c}</span>
                </label>
            </div>
        `;
    });
    document.getElementById('newFittingColumnInputName').value = '';
    openModal('editFittingColumnsModal');
};

window.addNewFittingColumnItem = function () {
    const input = document.getElementById('newFittingColumnInputName');
    const name = input.value.trim();
    if (!name) return;
    const checklist = document.getElementById('fittingColumnsEditList');
    const existingLabels = Array.from(checklist.querySelectorAll('span')).map(s => s.textContent.toLowerCase());
    if (existingLabels.includes(name.toLowerCase())) { alert("This size already exists."); return; }
    const div = document.createElement('div');
    div.innerHTML = `
        <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600; color:#475569; font-size:1rem; padding: 0.25rem 0;">
            <input type="checkbox" name="activeFittingColumns" value="${name.replace(/"/g, '&quot;')}" checked style="display:none;" onchange="this.nextElementSibling.style.color = this.checked ? '#3b82f6' : '#cbd5e1'">
            <i class="fa-solid fa-circle-check checkbox-icon" style="color:#3b82f6; font-size:1.2rem; transition: color 0.2s;"></i>
            <span>${name}</span>
        </label>
    `;
    checklist.appendChild(div);
    input.value = '';
};

document.getElementById('editFittingColumnsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSchema = [];
    e.target.querySelectorAll('input[name="activeFittingColumns"]:checked').forEach(cb => newSchema.push(cb.value));
    if (newSchema.length === 0) { alert("You must keep at least one size active."); return; }

    state.fittings.filter(f => f.type === currentFittingTypeTab).forEach(fitting => {
        if (!fitting.stock) fitting.stock = {};
        state.godowns.forEach(g => {
            if (!fitting.stock[g]) fitting.stock[g] = {};
            const newStock = {};
            newSchema.forEach(colName => {
                newStock[colName] = fitting.stock[g][colName] !== undefined ? fitting.stock[g][colName] : 0;
            });
            fitting.stock[g] = newStock;
        });
    });

    state.fittingSchemas[currentFittingTypeTab] = newSchema;

    try {
        await API.saveSettings({ fittingSchemas: state.fittingSchemas });
        await Promise.all(state.fittings.filter(f => f.type === currentFittingTypeTab).map(fitting =>
            API.updateFitting(fitting._id || fitting.id, { stock: fitting.stock })
        ));
        saveState();
        renderFittings();
        closeModal('editFittingColumnsModal');
    } catch (err) {
        alert('Error updating schema: ' + err.message);
    }
});

window.openManageFittingCategoriesModal = function () {
    if (state.currentUser.role !== 'admin') return;
    const list = document.getElementById('fittingCategoriesEditList');
    list.innerHTML = '';
    Object.keys(state.fittingSchemas).forEach((c, idx) => {
        list.innerHTML += `
            <div class="form-group" style="display:flex; flex-direction:row; gap:0.5rem; align-items:center; margin-bottom:0;">
                <input type="hidden" name="oldCat_${idx}" value="${c.replace(/"/g, '&quot;')}">
                <input type="text" name="newCat_${idx}" value="${c.replace(/"/g, '&quot;')}" required style="flex:1;">
                <button type="button" class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:0.5rem;" onclick="this.parentElement.remove()" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
    openModal('manageFittingCategoriesModal');
};

window.addNewFittingCategoryItem = function () {
    const input = document.getElementById('newFittingCategoryInputName');
    if (!input) return;
    const name = input.value.trim().toUpperCase();
    if (!name) return;
    const list = document.getElementById('fittingCategoriesEditList');
    if (!list) return;
    const existingInputs = Array.from(list.querySelectorAll('input[type="text"]')).map(inp => inp.value.trim().toUpperCase());
    if (existingInputs.includes(name)) { alert("This category is already listed."); return; }
    const idx = list.querySelectorAll('.form-group').length + Date.now();
    const div = document.createElement('div');
    div.className = 'form-group';
    div.style.cssText = 'display:flex; flex-direction:row; gap:0.5rem; align-items:center; margin-bottom:0;';
    div.innerHTML = `
        <input type="hidden" name="oldCat_${idx}" value="">
        <input type="text" name="newCat_${idx}" value="${name}" required style="flex:1;">
        <button type="button" class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:0.5rem;" onclick="this.parentElement.remove()" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
    `;
    list.appendChild(div);
    input.value = '';
};

document.getElementById('manageFittingCategoriesForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    confirmDeletion(async () => {
        const newSchemas = {};
        const mapping = {};
        const categoriesToKeep = new Set();

        e.target.querySelectorAll('.form-group').forEach(fg => {
            const oldCat = fg.querySelector('input[type="hidden"]').value;
            const newCat = fg.querySelector('input[type="text"]').value.trim().toUpperCase();
            if (newCat) {
                categoriesToKeep.add(oldCat);
                newSchemas[newCat] = state.fittingSchemas[oldCat] || ["Size"];
                if (oldCat && oldCat !== newCat) mapping[oldCat] = newCat;
            }
        });

        Object.keys(state.fittingSchemas).forEach(oldCat => {
            if (!categoriesToKeep.has(oldCat)) state.fittings = state.fittings.filter(f => f.type !== oldCat);
        });
        state.fittings.forEach(f => { if (mapping[f.type]) f.type = mapping[f.type]; });
        state.fittingSchemas = newSchemas;

        if (mapping[currentFittingTypeTab]) currentFittingTypeTab = mapping[currentFittingTypeTab];
        else if (!newSchemas[currentFittingTypeTab]) {
            const keys = Object.keys(newSchemas);
            currentFittingTypeTab = keys.length > 0 ? keys[0] : null;
        }

        try {
            await API.saveSettings({ fittingSchemas: state.fittingSchemas });
            saveState();
            renderFittingTabs();
            renderFittings();
            closeModal('manageFittingCategoriesModal');
        } catch (err) {
            alert('Error saving fitting categories: ' + err.message);
        }
    }, "Are you sure you want to save these category changes? This may delete items in removed categories.");
});

// Expose
window.getFittingStockVal = getFittingStockVal;
window.renderFittingTabs = renderFittingTabs;
window.renderFittings = renderFittings;
