/**
 * challans.js - Transport Challans Module
 * Sri Sapthagiri Logistics Inventory System
 */

let currentChallanTab = 'pendingChallans';

// ─── Challan Tab Switching ────────────────────────────────────────────────────

document.querySelectorAll('#challansView .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#challansView .tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentChallanTab = e.target.getAttribute('data-tab');
        renderChallans();
    });
});

// ─── Challan Modal ────────────────────────────────────────────────────────────

window.openNewChallanModal = function () {
    document.getElementById('challanForm').reset();
    document.getElementById('challanItemsContainer').innerHTML = '';
    populateGodownDropdowns();
    addChallanItemRow();
    openModal('challanModal');
};

window.addChallanItemRow = function () {
    const container = document.getElementById('challanItemsContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'challan-item-row';
    row.innerHTML = `
        <div style="width: 180px;">
            <select class="row-category" required style="width: 100%;" onchange="updateRowProducts(this)">
                <option value="">Select Category...</option>
                <option value="Pipes">Supreme</option>
                <option value="Fittings">Fittings</option>
                <option value="Motors">CRI</option>
            </select>
        </div>
        <div style="flex: 1;">
            <input type="text" class="row-product" list="productsDatalist" required placeholder="Enter or select product..." style="width: 100%;" onfocus="updateDatalistOptions(this)">
        </div>
        <div style="width: 80px;">
            <input type="number" class="row-qty" min="1" value="1" required style="width: 100%;">
        </div>
        <button type="button" class="btn-delete-row" onclick="this.closest('.challan-item-row').remove();" title="Remove Product">
            <i class="fa-regular fa-trash-can"></i>
        </button>
    `;
    container.appendChild(row);
};

window.updateRowProducts = function (selectEl) {
    const row = selectEl.closest('.challan-item-row');
    const productInput = row.querySelector('.row-product');
    if (productInput) productInput.value = '';
};

window.updateDatalistOptions = function (inputEl) {
    const row = inputEl.closest('.challan-item-row');
    const categorySelect = row.querySelector('.row-category');
    const category = categorySelect ? categorySelect.value : '';

    const datalist = document.getElementById('productsDatalist');
    if (!datalist) return;
    datalist.innerHTML = '';

    const products = [];
    if (category === 'Pipes' || category === '') {
        state.pipes.forEach(pipe => {
            const columns = state.pipeSchemas[pipe.type] || [];
            columns.forEach(col => products.push(`${pipe.type} - ${pipe.size} (${col})`));
        });
    }
    if (category === 'Fittings' || category === '') {
        state.fittings.forEach(fitting => {
            const columns = state.fittingSchemas[fitting.type] || [];
            columns.forEach(col => products.push(`${fitting.type} - ${fitting.name} (${col})`));
        });
    }
    if (category === 'Motors' || category === '') {
        state.motors.forEach(motor => {
            products.push(`${motor.hp} HP Motor - ${motor.type} (${motor.phase})`);
        });
    }

    Array.from(new Set(products)).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        datalist.appendChild(opt);
    });
};

// ─── Product Stock Lookup ─────────────────────────────────────────────────────

function getProductStock(itemStr) {
    if (!itemStr) return 0;

    if (itemStr.includes(' - ') && itemStr.includes('(') && itemStr.includes(')')) {
        const parts = itemStr.split(' - ');
        if (parts.length >= 2) {
            const type = parts[0].trim();
            const rest = parts[1].trim();
            const lastOpenParen = rest.lastIndexOf('(');
            const lastCloseParen = rest.lastIndexOf(')');
            if (lastOpenParen !== -1 && lastCloseParen !== -1) {
                const size = rest.substring(0, lastOpenParen).trim();
                const col = rest.substring(lastOpenParen + 1, lastCloseParen).trim();

                const pipe = state.pipes.find(p => p.type === type && p.size === size);
                if (pipe && pipe.stock && pipe.stock[col] !== undefined) return pipe.stock[col];

                const fitting = state.fittings.find(f => f.type === type && f.name === size);
                if (fitting && fitting.stock && fitting.stock[col] !== undefined) return fitting.stock[col];
            }
        }
    }

    if (itemStr.includes(' HP Motor - ')) {
        const parts = itemStr.split(' HP Motor - ');
        if (parts.length >= 2) {
            const hp = parts[0].trim();
            const rest = parts[1].trim();
            const lastOpenParen = rest.lastIndexOf('(');
            const lastCloseParen = rest.lastIndexOf(')');
            if (lastOpenParen !== -1 && lastCloseParen !== -1) {
                const type = rest.substring(0, lastOpenParen).trim();
                const phase = rest.substring(lastOpenParen + 1, lastCloseParen).trim();
                const motor = state.motors.find(m => m.hp === hp && m.type === type && m.phase === phase);
                if (motor && motor.serials) return motor.serials.length;
            }
        }
    }

    return 0;
}

// ─── Print Challan ────────────────────────────────────────────────────────────

window.printChallan = function (id) {
    const ch = state.challans.find(c => (c._id || c.id || c.challanId) === id);
    if (!ch) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    function getItemUom(itemStr) {
        if (!itemStr) return 'PCS';
        const lower = itemStr.toLowerCase();
        if (lower.includes('pipe') || lower.includes('supreme')) return 'LENGTH/PCS';
        if (lower.includes('fitting')) return 'PCS';
        if (lower.includes('motor') || lower.includes('cri')) return 'NOS';
        return 'LENGTH/PCS';
    }

    const dateParts = ch.date.split('-');
    const formattedDate = dateParts.length === 3
        ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0]}`
        : ch.date;

    let itemsHtml = '';
    if (ch.items && ch.items.length > 0) {
        itemsHtml = ch.items.map(i => {
            const uom = getItemUom(i.item);
            const serialHtml = i.serial ? `<div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem; font-weight: normal;">SN: ${i.serial}</div>` : '';
            return `
                <tr>
                    <td style="padding: 0.6rem 0; text-align: left; vertical-align: top;">
                        <div style="font-weight: 600; font-size: 0.95rem;">${i.item}</div>
                        ${serialHtml}
                    </td>
                    <td style="padding: 0.6rem 0; text-align: center; vertical-align: top; font-weight: 500;">${uom}</td>
                    <td style="padding: 0.6rem 0; text-align: right; vertical-align: top; font-weight: 600;">${i.qty}</td>
                </tr>
            `;
        }).join('');
    } else {
        const uom = getItemUom(ch.item);
        const serialHtml = ch.serial ? `<div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">SN: ${ch.serial}</div>` : '';
        itemsHtml = `
            <tr>
                <td style="padding: 0.6rem 0; text-align: left; vertical-align: top;">
                    <div style="font-weight: 600; font-size: 0.95rem;">${ch.item}</div>
                    ${serialHtml}
                </td>
                <td style="padding: 0.6rem 0; text-align: center; vertical-align: top; font-weight: 500;">${uom}</td>
                <td style="padding: 0.6rem 0; text-align: right; vertical-align: top; font-weight: 600;">${ch.qty}</td>
            </tr>
        `;
    }

    const displayId = ch.challanId || ch.id || ch._id;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Delivery Challan - ${displayId}</title>
    <style>
        @media print { @page { size: A4 portrait; margin: 20mm 15mm; } body { background-color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #000; margin: 0; padding: 0; line-height: 1.3; background-color: #fff; }
        .container { max-width: 90mm; margin: 0 auto; padding: 5mm; box-sizing: border-box; }
        .header { text-align: center; margin-bottom: 0.5rem; }
        .company-name { font-size: 1.1rem; font-weight: 800; margin: 0 0 0.2rem 0; letter-spacing: 0.3px; color: #000; }
        .company-address { font-size: 0.75rem; font-weight: 600; margin: 0; line-height: 1.35; }
        .dashed-line { border-top: 1px dashed #000; margin: 0.5rem 0; }
        .details-grid { font-size: 0.8rem; margin-bottom: 0.75rem; line-height: 1.4; }
        .details-row { display: flex; justify-content: space-between; }
        .details-label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 0.4rem; }
        th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 0.4rem 0; font-size: 0.75rem; font-weight: bold; color: #000; }
        td { font-size: 0.8rem; }
        .footer-signatures { display: flex; justify-content: space-between; margin-top: 3rem; margin-bottom: 1.5rem; padding: 0 5px; }
        .sig-block { text-align: center; width: 110px; }
        .sig-line { border-top: 1.2px solid #000; margin-bottom: 0.4rem; }
        .sig-label { font-weight: bold; font-size: 0.75rem; letter-spacing: 0.3px; }
        .thank-you { text-align: center; font-style: italic; font-size: 0.8rem; margin-top: 1.5rem; }
    </style></head>
    <body onload="window.print(); window.close();">
        <div class="container">
            <div class="header">
                <h1 class="company-name">SRI SAPTHAGIRI ELECTRICAL & H/W</h1>
                <p class="company-address">123, Nethaji Road, TIRUPATI-517501.<br>Ph: 222909, 7680848620, (M)9848048620</p>
            </div>
            <div class="dashed-line"></div>
            <div class="details-grid">
                <div class="details-row">
                    <div><span class="details-label">Date:</span> ${formattedDate}</div>
                    <div><span class="details-label">ID:</span> ${displayId}</div>
                </div>
                <div><span class="details-label">From:</span> ${ch.sourceGodown || 'Main Godown'}</div>
                <div><span class="details-label">To:</span> ${ch.godown || ''}</div>
                <div><span class="details-label">Customer:</span> ${ch.customer || 'Customer'}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="text-align: left; width: 60%;">DESCRIPTION</th>
                        <th style="text-align: center; width: 25%;">UOM</th>
                        <th style="text-align: right; width: 15%;">QTY</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="dashed-line"></div>
            <div class="footer-signatures">
                <div class="sig-block"><div class="sig-line"></div><span class="sig-label">TRANSPORTER</span></div>
                <div class="sig-block"><div class="sig-line"></div><span class="sig-label">AUTHORIZED</span></div>
            </div>
            <div class="thank-you">Thank You! Visit Again</div>
        </div>
    </body></html>`);
    printWindow.document.close();
};

// ─── Render Challans Table ────────────────────────────────────────────────────

function renderChallans() {
    const tbody = document.getElementById('challansTableBody');
    tbody.innerHTML = '';

    const filterStatus = currentChallanTab === 'pendingChallans' ? ['pending'] : ['approved', 'rejected'];
    const filtered = state.challans.filter(c => filterStatus.includes(c.status));

    filtered.forEach(ch => {
        const dateParts = ch.date.split('-');
        const formattedDate = dateParts.length === 3
            ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0]}`
            : ch.date;

        let itemsHtml = '';
        if (ch.items && ch.items.length > 0) {
            itemsHtml = ch.items.map(i => {
                const avail = getProductStock(i.item);
                return `
                    <div style="margin-bottom: 0.5rem; line-height: 1.3;">
                        <div style="color: #0f172a; font-weight: 700; font-size: 0.95rem;">${i.item} (x${i.qty})</div>
                        <div style="color: #64748b; font-size: 0.8rem; font-weight: 500;">Available: ${avail}</div>
                    </div>
                `;
            }).join('');
        } else {
            const avail = getProductStock(ch.item);
            itemsHtml = `
                <div style="line-height: 1.3;">
                    <div style="color: #0f172a; font-weight: 700; font-size: 0.95rem;">${ch.item} (x${ch.qty})</div>
                    <div style="color: #64748b; font-size: 0.8rem; font-weight: 500;">Available: ${avail}</div>
                </div>
            `;
        }

        const isAdmin = state.currentUser.role === 'admin';
        const isPending = ch.status === 'pending';
        const chId = ch._id || ch.id;
        const displayId = ch.challanId || ch.id || ch._id;

        const actionHtml = `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="btn-action-square print" onclick="printChallan('${chId}')" title="Print Challan"><i class="fa-solid fa-print"></i></button>
                <button class="btn-action-square approve" onclick="openApproveChallanModal('${chId}')" title="Approve Challan" ${(!isAdmin || !isPending) ? 'disabled' : ''}><i class="fa-solid fa-check"></i></button>
                <button class="btn-action-square reject" onclick="rejectChallan('${chId}')" title="Reject Challan" ${(!isAdmin || !isPending) ? 'disabled' : ''}><i class="fa-solid fa-xmark"></i></button>
                <button class="btn-action-square delete" onclick="deleteChallan('${chId}')" title="Delete Challan" ${(!isAdmin) ? 'disabled' : ''}><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight: 700; color: #475569; font-size: 0.95rem;">#${displayId.toString().replace('CH-', '')}</div>
                <div style="color: #2563eb; font-weight: 600; font-size: 0.875rem; margin-top: 0.15rem;">${ch.createdBy}</div>
            </td>
            <td><div style="font-weight: 500; color: #334155;">${formattedDate}</div></td>
            <td>${itemsHtml}</td>
            <td><div style="font-weight: 600; color: #334155;">${ch.sourceGodown || 'Main Godown'}</div></td>
            <td><div style="font-weight: 500; color: #334155;">${ch.customer || 'Customer'}</div></td>
            <td>
                <span class="challan-status-pill ${ch.status}">
                    <i class="${ch.status === 'pending' ? 'fa-regular fa-clock' : (ch.status === 'approved' ? 'fa-regular fa-circle-check' : 'fa-regular fa-circle-xmark')}" style="margin-right: 0.35rem;"></i>
                    ${ch.status}
                </span>
            </td>
            <td>${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = state.currentUser.role === 'admin' ? '' : 'none';
    });
}

// ─── Challan Actions ──────────────────────────────────────────────────────────

window.rejectChallan = function (id) {
    const ch = state.challans.find(c => (c._id || c.id) === id);
    if (!ch) return;
    const displayId = ch.challanId || ch.id || ch._id;
    if (confirm(`Are you sure you want to reject challan ${displayId}?`)) {
        API.updateChallan(id, { status: 'rejected' }).then(updated => {
            const idx = state.challans.findIndex(c => (c._id || c.id) === id);
            if (idx !== -1) state.challans[idx] = updated;
            saveState();
            renderChallans();
        }).catch(err => alert('Error: ' + err.message));
    }
};

window.deleteChallan = function (id) {
    const ch = state.challans.find(c => (c._id || c.id) === id);
    if (!ch) return;
    const displayId = ch.challanId || ch.id || ch._id;
    if (confirm(`Are you sure you want to delete challan ${displayId}?`)) {
        API.deleteChallanApi(id).then(() => {
            state.challans = state.challans.filter(c => (c._id || c.id) !== id);
            saveState();
            renderChallans();
        }).catch(err => alert('Error: ' + err.message));
    }
};

// ─── Challan Form Submit ──────────────────────────────────────────────────────

document.getElementById('challanForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const items = [];
    const rows = document.querySelectorAll('#challanItemsContainer .challan-item-row');
    if (rows.length === 0) { alert("Please add at least one item."); return; }

    let hasEmptyProduct = false;
    rows.forEach((row, idx) => {
        const productVal = row.querySelector('.row-product').value;
        if (!productVal) { hasEmptyProduct = true; return; }
        items.push({
            sno: (idx + 1).toString(),
            item: productVal,
            serial: '',
            qty: parseInt(row.querySelector('.row-qty').value, 10)
        });
    });

    if (hasEmptyProduct) { alert("Please select a product for all rows."); return; }

    try {
        const newChallan = await API.createChallan({
            customer: document.getElementById('challanCustomerName').value.trim(),
            sourceGodown: document.getElementById('challanSourceGodown').value,
            items,
            createdBy: state.currentUser.username,
            type: 'Outward',
            date: new Date().toISOString().split('T')[0]
        });
        state.challans.unshift(newChallan);
        saveState();
        renderChallans();
        closeModal('challanModal');
        e.target.reset();
        document.getElementById('challanItemsContainer').innerHTML = '';
    } catch (err) {
        alert('Error creating challan: ' + err.message);
    }
});

// ─── Approve Challan ──────────────────────────────────────────────────────────

window.openApproveChallanModal = function (id) {
    const ch = state.challans.find(c => (c._id || c.id) === id);
    if (!ch) return;

    document.getElementById('approveChallanId').value = id;
    const tbody = document.getElementById('approveChallanItemsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (ch.items && ch.items.length > 0) {
        ch.items.forEach((item, idx) => {
            const tr = document.createElement('tr');
            let checkboxesHtml = state.godowns.map(g => `
                <label style="margin-right: 0.5rem; font-size: 0.85rem; white-space: nowrap; cursor: pointer;">
                    <input type="checkbox" name="godown_${idx}" value="${g}" ${ch.sourceGodown === g ? 'checked' : ''}> ${g}
                </label>
            `).join('');
            tr.innerHTML = `
                <td>${item.sno}</td>
                <td>${item.item} ${item.serial ? `(SN: ${item.serial})` : ''}</td>
                <td>${item.qty}</td>
                <td><div style="display: flex; flex-wrap: wrap; gap: 0.2rem;">${checkboxesHtml}</div></td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        const tr = document.createElement('tr');
        let checkboxesHtml = state.godowns.map(g => `
            <label style="margin-right: 0.5rem; font-size: 0.85rem; white-space: nowrap; cursor: pointer;">
                <input type="checkbox" name="godown_0" value="${g}"> ${g}
            </label>
        `).join('');
        tr.innerHTML = `<td>1</td><td>${ch.item}</td><td>${ch.qty}</td><td><div style="display: flex; flex-wrap: wrap; gap: 0.2rem;">${checkboxesHtml}</div></td>`;
        tbody.appendChild(tr);
    }

    openModal('approveChallanModal');
};

document.getElementById('approveChallanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('approveChallanId').value;
    const ch = state.challans.find(c => (c._id || c.id) === id);
    if (!ch) return;

    const tbody = document.getElementById('approveChallanItemsBody');
    const rows = tbody.querySelectorAll('tr');

    const updatedItems = ch.items ? [...ch.items] : [];

    if (ch.items && ch.items.length > 0) {
        rows.forEach((row, idx) => {
            const checked = Array.from(row.querySelectorAll(`input[name="godown_${idx}"]:checked`)).map(cb => cb.value);
            if (updatedItems[idx]) updatedItems[idx].godown = checked.join(', ');
        });
    } else {
        const checked = Array.from(rows[0].querySelectorAll(`input[name="godown_0"]:checked`)).map(cb => cb.value);
        ch.godown = checked.join(', ');
    }

    if (confirm('Approve this challan and lock Godown selections?')) {
        try {
            const updated = await API.updateChallan(id, { status: 'approved', items: updatedItems, godown: ch.godown });
            const idx = state.challans.findIndex(c => (c._id || c.id) === id);
            if (idx !== -1) state.challans[idx] = updated;
            saveState();
            renderChallans();
            closeModal('approveChallanModal');
        } catch (err) {
            alert('Error approving challan: ' + err.message);
        }
    }
});

// Expose
window.renderChallans = renderChallans;
window.getProductStock = getProductStock;
