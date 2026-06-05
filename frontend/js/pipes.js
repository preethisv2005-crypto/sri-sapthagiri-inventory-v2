/**
 * pipes.js - Pipe Inventory Module
 * Sri Sapthagiri Logistics Inventory System
 */

let currentPipeTypeTab = 'PVC pipes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPipeStockVal(pipe, col, godownFilter) {
    if (!pipe.stock) return 0;
    if (godownFilter === 'all') {
        let sum = 0;
        state.godowns.forEach(g => {
            if (pipe.stock[g] && pipe.stock[g][col] !== undefined) {
                sum += pipe.stock[g][col];
            }
        });
        return sum;
    } else {
        if (pipe.stock[godownFilter] && pipe.stock[godownFilter][col] !== undefined) {
            return pipe.stock[godownFilter][col];
        }
        return 0;
    }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderPipeTabs() {
    const container = document.getElementById('pipeTabsContainer');
    const select = document.getElementById('pipeTypeInput');
    if (!container || !select) return;

    container.innerHTML = '';
    select.innerHTML = '';

    const keys = Object.keys(state.pipeSchemas);
    if (!keys.includes(currentPipeTypeTab) && keys.length > 0) {
        currentPipeTypeTab = keys[0];
    }

    keys.forEach(type => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${type === currentPipeTypeTab ? 'active' : ''}`;
        btn.setAttribute('data-type', type);
        btn.textContent = type;
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#pipeTabsContainer .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentPipeTypeTab = type;
            renderPipes();
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

function renderPipes() {
    const titleEl = document.getElementById('pipesViewTitle');
    if (titleEl) {
        const godownText = currentGodownFilter === 'all' ? 'Global' : currentGodownFilter;
        titleEl.textContent = `Pipes Inventory (${godownText})`;
    }

    const tableHeadRow = document.getElementById('pipesTableHeadRow');
    const tbody = document.getElementById('pipesTableBody');
    tbody.innerHTML = '';

    const columns = state.pipeSchemas[currentPipeTypeTab] || ["Stock"];

    let thHtml = `<th style="text-align: left;">Pipe Size</th>`;
    columns.forEach(col => {
        thHtml += `<th style="text-align: center;">${col}</th>`;
    });
    thHtml += `<th style="text-align: center;">Actions</th>`;
    tableHeadRow.innerHTML = thHtml;

    const filteredPipes = state.pipes.filter(p => p.type === currentPipeTypeTab);

    filteredPipes.forEach(pipe => {
        const tr = document.createElement('tr');
        const pipeId = pipe._id || pipe.id;

        let trHtml = `
            <td>
                <strong>${pipe.size}</strong>
                <i class="fa-solid fa-pencil admin-only" style="color: #3b82f6; cursor: pointer; margin-left: 0.5rem;" onclick="editPipeSize('${pipeId}')" title="Edit Size"></i>
            </td>
        `;

        columns.forEach(col => {
            const val = getPipeStockVal(pipe, col, currentGodownFilter);
            const escapedCol = col.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            trHtml += `<td class="editable" onclick="handlePipeStockClick(this, '${pipeId}', '${escapedCol}')"><div class="pipe-stock-box">${val}</div></td>`;
        });

        trHtml += `
            <td style="text-align: center;">
                <button class="btn-delete-pipe admin-only" onclick="deletePipe('${pipeId}')" title="Delete Pipe"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        `;

        tr.innerHTML = trHtml;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = state.currentUser.role === 'admin' ? '' : 'none';
    });
}

// ─── Stock Click / Add Stock ──────────────────────────────────────────────────

window.handlePipeStockClick = function (cellElement, id, col) {
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

    const pipe = state.pipes.find(p => (p._id || p.id) === id);
    if (!pipe.stock) pipe.stock = {};
    if (!pipe.stock[currentGodownFilter]) pipe.stock[currentGodownFilter] = {};

    const currentVal = pipe.stock[currentGodownFilter][col] || 0;

    pendingStockAddition = { type: 'pipe', id, col, currentVal, godown: currentGodownFilter };

    document.getElementById('addStockModalTitle').innerText = `Add Stock: ${pipe.size} (${col})`;
    document.getElementById('addStockGodown').innerText = currentGodownFilter;
    document.getElementById('addStockCurrentValue').innerText = currentVal;

    const qtyInput = document.getElementById('addStockQuantityInput');
    qtyInput.value = '';
    const errorBlock = document.getElementById('addStockErrorBlock');
    errorBlock.style.display = 'none';
    errorBlock.innerText = '';

    const submitBtn = document.getElementById('addStockSubmitBtn');
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Stock';

    openModal('addStockModal');
    setTimeout(() => qtyInput.focus(), 50);
};

window.editPipeSize = function (id) {
    if (state.currentUser.role !== 'admin') return;
    const pipe = state.pipes.find(p => (p._id || p.id) === id);
    const newSize = prompt(`Enter new size for this pipe:`, pipe.size);
    if (newSize !== null && newSize.trim() !== '') {
        pipe.size = newSize.trim();
        API.updatePipe(id, { size: pipe.size }).then(() => {
            saveState();
            renderPipes();
        }).catch(err => alert('Error updating pipe: ' + err.message));
    }
};

window.deletePipe = function (id) {
    if (state.currentUser.role !== 'admin') { alert("Only admin users can delete pipes."); return; }
    const pipe = state.pipes.find(p => (p._id || p.id) === id);
    if (!pipe) return;
    if (confirm(`Are you sure you want to delete the pipe size "${pipe.size}" and all its stock?`)) {
        API.deletePipeApi(id).then(() => {
            state.pipes = state.pipes.filter(p => (p._id || p.id) !== id);
            saveState();
            renderPipes();
        }).catch(err => alert('Error deleting pipe: ' + err.message));
    }
};

// ─── Form Handlers ────────────────────────────────────────────────────────────

document.getElementById('pipeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const size = document.getElementById('pipeSizeInput').value;
    const type = document.getElementById('pipeTypeInput').value;

    const columns = state.pipeSchemas[type] || ["Stock"];
    let initialStock = {};
    state.godowns.forEach(g => {
        initialStock[g] = {};
        columns.forEach(c => { initialStock[g][c] = 0; });
    });

    try {
        const newPipe = await API.createPipe({ type, size, stock: initialStock });
        state.pipes.push(newPipe);
        currentPipeTypeTab = type;
        renderPipeTabs();
        saveState();
        renderPipes();
        closeModal('pipeModal');
        e.target.reset();
    } catch (err) {
        alert('Error adding pipe: ' + err.message);
    }
});

document.getElementById('pipeTypeInput')?.addEventListener('change', async (e) => {
    if (e.target.value === 'ADD_NEW_CATEGORY') {
        const catName = prompt("Enter new Pipe Category Name (e.g. HDPE pipes):");
        if (catName && catName.trim() !== '') {
            const name = catName.trim();
            if (state.pipeSchemas[name]) { alert("Category already exists!"); e.target.value = currentPipeTypeTab; return; }
            state.pipeSchemas[name] = ["Stock"];
            await API.saveSettings({ pipeSchemas: state.pipeSchemas }).catch(err => console.error(err));
            saveState();
            currentPipeTypeTab = name;
            renderPipeTabs();
            renderPipes();
            e.target.value = name;
        } else {
            e.target.value = currentPipeTypeTab;
        }
    }
});

window.addPipeCategory = function () {
    if (state.currentUser.role !== 'admin') return;
    const catName = prompt("Enter new Pipe Category Name (e.g. 'PPR Pipes'):");
    if (catName && catName.trim() !== '') {
        const name = catName.trim();
        if (state.pipeSchemas[name]) { alert("Category already exists!"); return; }
        state.pipeSchemas[name] = ["Stock"];
        API.saveSettings({ pipeSchemas: state.pipeSchemas }).then(() => {
            saveState();
            currentPipeTypeTab = name;
            renderPipeTabs();
            renderPipes();
        }).catch(err => alert('Error: ' + err.message));
    }
};

window.openEditColumnsModal = function () {
    const cols = state.pipeSchemas[currentPipeTypeTab] || [];
    const list = document.getElementById('columnsEditList');
    list.innerHTML = '';
    cols.forEach((c) => {
        list.innerHTML += `
            <div>
                <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600; color:#475569; font-size:1rem; padding: 0.25rem 0;">
                    <input type="checkbox" name="activeColumns" value="${c}" checked style="display:none;" onchange="this.nextElementSibling.style.color = this.checked ? '#3b82f6' : '#cbd5e1'">
                    <i class="fa-solid fa-circle-check checkbox-icon" style="color:#3b82f6; font-size:1.2rem; transition: color 0.2s;"></i>
                    <span>${c}</span>
                </label>
            </div>
        `;
    });
    document.getElementById('newColumnInputName').value = '';
    openModal('editColumnsModal');
};

window.addNewColumnItem = function () {
    const input = document.getElementById('newColumnInputName');
    const name = input.value.trim();
    if (!name) return;
    const checklist = document.getElementById('columnsEditList');
    const existingLabels = Array.from(checklist.querySelectorAll('span')).map(s => s.textContent.toLowerCase());
    if (existingLabels.includes(name.toLowerCase())) { alert("This column already exists."); return; }
    const div = document.createElement('div');
    div.innerHTML = `
        <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600; color:#475569; font-size:1rem; padding: 0.25rem 0;">
            <input type="checkbox" name="activeColumns" value="${name}" checked style="display:none;" onchange="this.nextElementSibling.style.color = this.checked ? '#3b82f6' : '#cbd5e1'">
            <i class="fa-solid fa-circle-check checkbox-icon" style="color:#3b82f6; font-size:1.2rem; transition: color 0.2s;"></i>
            <span>${name}</span>
        </label>
    `;
    checklist.appendChild(div);
    input.value = '';
};

document.getElementById('editColumnsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSchema = [];
    e.target.querySelectorAll('input[name="activeColumns"]:checked').forEach(cb => newSchema.push(cb.value));
    if (newSchema.length === 0) { alert("You must keep at least one column active."); return; }

    state.pipes.filter(p => p.type === currentPipeTypeTab).forEach(pipe => {
        if (!pipe.stock) pipe.stock = {};
        state.godowns.forEach(g => {
            if (!pipe.stock[g]) pipe.stock[g] = {};
            const newStock = {};
            newSchema.forEach(colName => {
                newStock[colName] = pipe.stock[g][colName] !== undefined ? pipe.stock[g][colName] : 0;
            });
            pipe.stock[g] = newStock;
        });
    });

    state.pipeSchemas[currentPipeTypeTab] = newSchema;

    try {
        await API.saveSettings({ pipeSchemas: state.pipeSchemas });
        // Update all affected pipes in DB
        await Promise.all(state.pipes.filter(p => p.type === currentPipeTypeTab).map(pipe =>
            API.updatePipe(pipe._id || pipe.id, { stock: pipe.stock })
        ));
        saveState();
        renderPipes();
        closeModal('editColumnsModal');
    } catch (err) {
        alert('Error updating schema: ' + err.message);
    }
});

window.openManageCategoriesModal = function () {
    if (state.currentUser.role !== 'admin') return;
    const list = document.getElementById('categoriesEditList');
    list.innerHTML = '';
    Object.keys(state.pipeSchemas).forEach((c, idx) => {
        list.innerHTML += `
            <div class="form-group" style="display:flex; flex-direction:row; gap:0.5rem; align-items:center; margin-bottom:0;">
                <input type="hidden" name="oldCat_${idx}" value="${c}">
                <input type="text" name="newCat_${idx}" value="${c}" required style="flex:1;">
                <button type="button" class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:0.5rem;" onclick="this.parentElement.remove()" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
    openModal('manageCategoriesModal');
};

window.addNewPipeCategoryItem = function () {
    const input = document.getElementById('newPipeCategoryInputName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    const list = document.getElementById('categoriesEditList');
    if (!list) return;
    const existingInputs = Array.from(list.querySelectorAll('input[type="text"]')).map(inp => inp.value.trim().toLowerCase());
    if (existingInputs.includes(name.toLowerCase())) { alert("This category is already listed."); return; }
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

document.getElementById('manageCategoriesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSchemas = {};
    const mapping = {};
    const categoriesToKeep = new Set();

    e.target.querySelectorAll('.form-group').forEach(fg => {
        const oldCat = fg.querySelector('input[type="hidden"]').value;
        const newCat = fg.querySelector('input[type="text"]').value.trim();
        if (newCat) {
            categoriesToKeep.add(oldCat);
            newSchemas[newCat] = state.pipeSchemas[oldCat] || ["Stock"];
            if (oldCat && oldCat !== newCat) mapping[oldCat] = newCat;
        }
    });

    Object.keys(state.pipeSchemas).forEach(oldCat => {
        if (!categoriesToKeep.has(oldCat)) {
            state.pipes = state.pipes.filter(p => p.type !== oldCat);
        }
    });

    state.pipes.forEach(p => { if (mapping[p.type]) p.type = mapping[p.type]; });
    state.pipeSchemas = newSchemas;

    if (mapping[currentPipeTypeTab]) currentPipeTypeTab = mapping[currentPipeTypeTab];
    else if (!newSchemas[currentPipeTypeTab]) {
        const keys = Object.keys(newSchemas);
        currentPipeTypeTab = keys.length > 0 ? keys[0] : null;
    }

    try {
        await API.saveSettings({ pipeSchemas: state.pipeSchemas });
        saveState();
        renderPipeTabs();
        renderPipes();
        closeModal('manageCategoriesModal');
    } catch (err) {
        alert('Error saving categories: ' + err.message);
    }
});

// Expose for use in other modules
window.getPipeStockVal = getPipeStockVal;
window.renderPipeTabs = renderPipeTabs;
window.renderPipes = renderPipes;
window.currentPipeTypeTab = currentPipeTypeTab;
