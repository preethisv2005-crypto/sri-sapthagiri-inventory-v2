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

function parseMotorItemString(itemStr) {
    if (itemStr.includes(' HP Motor - ') && itemStr.includes('(') && itemStr.includes(')')) {
        const parts = itemStr.split(' HP Motor - ');
        if (parts.length >= 2) {
            const hp = parts[0].trim();
            const rest = parts[1].trim();
            const lastOpenParen = rest.lastIndexOf('(');
            const lastCloseParen = rest.lastIndexOf(')');
            if (lastOpenParen !== -1 && lastCloseParen !== -1) {
                const type = rest.substring(0, lastOpenParen).trim();
                const phase = rest.substring(lastOpenParen + 1, lastCloseParen).trim();
                return { hp, type, phase };
            }
        }
    }
    return null;
}

function getAdjustedProductStock(itemStr, godownName, editingChallanId, rowIdx) {
    let baseStock = getProductStock(itemStr, godownName);
    if (editingChallanId) {
        const oldChallan = state.challans.find(c => (c._id || c.id) === editingChallanId);
        if (oldChallan && oldChallan.status !== 'rejected') {
            const oldItem = oldChallan.items && oldChallan.items[rowIdx];
            if (oldItem && oldItem.item === itemStr && oldChallan.sourceGodown === godownName) {
                baseStock += oldItem.qty;
            }
        }
    }
    return baseStock;
}

window.updateSerialSelectionStatus = function (checkbox) {
    const rowEl = checkbox.closest('.challan-item-row');
    validateRowSerialsCount(rowEl);
};

window.validateRowSerialsCount = function (rowEl) {
    const qtyInput = rowEl.querySelector('.row-qty');
    const qty = parseInt(qtyInput.value, 10) || 0;
    const checked = rowEl.querySelectorAll('.serial-checkbox:checked');
    const count = checked.length;
    const labelSpan = rowEl.querySelector('.required-serial-count');
    
    if (count !== qty) {
        labelSpan.innerHTML = `${qty} <span style="color: var(--danger); font-weight: 700;">(Selected: ${count})</span>`;
    } else {
        labelSpan.innerHTML = `${qty} <span style="color: var(--success); font-weight: 700;">(Match!)</span>`;
    }
};

window.loadRowSerials = function (rowEl, preselectedSerials = []) {
    const categorySelect = rowEl.querySelector('.row-category');
    if (!categorySelect || categorySelect.value !== 'Motors') {
        const serialsContainer = rowEl.querySelector('.row-serials-container');
        if (serialsContainer) serialsContainer.style.display = 'none';
        return;
    }

    const productInput = rowEl.querySelector('.row-product');
    const productVal = productInput.value.trim();
    const qtyInput = rowEl.querySelector('.row-qty');
    const qty = parseInt(qtyInput.value, 10) || 0;
    
    const sourceGodown = document.getElementById('challanSourceGodown').value;
    const serialsContainer = rowEl.querySelector('.row-serials-container');
    const checkboxesDiv = rowEl.querySelector('.serials-checkboxes');
    const labelSpan = rowEl.querySelector('.required-serial-count');

    if (!productVal || qty <= 0) {
        if (serialsContainer) serialsContainer.style.display = 'none';
        return;
    }

    const motorParsed = parseMotorItemString(productVal);
    if (!motorParsed) {
        if (serialsContainer) serialsContainer.style.display = 'none';
        return;
    }

    const { hp, type, phase } = motorParsed;
    const motor = state.motors.find(m => m.hp === hp && m.type === type && m.phase === phase);
    if (!motor) {
        if (serialsContainer) serialsContainer.style.display = 'none';
        return;
    }

    // Filter available serial numbers
    const availableSerials = motor.serials.filter(s => {
        const isFromGodown = s.godown && s.godown.toLowerCase() === sourceGodown.toLowerCase();
        const isAvailable = !s.status || s.status === 'Available';
        const isPreselected = preselectedSerials.includes(s.sn);
        return isFromGodown && (isAvailable || isPreselected);
    });

    if (availableSerials.length === 0) {
        checkboxesDiv.innerHTML = '<span style="color: var(--danger); font-size: 0.85rem;">No available serial numbers in this godown.</span>';
        serialsContainer.style.display = 'block';
        labelSpan.textContent = qty.toString();
        return;
    }

    checkboxesDiv.innerHTML = availableSerials.map(s => {
        const isChecked = preselectedSerials.includes(s.sn) ? 'checked' : '';
        return `
            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.9rem; padding: 0.4rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: #f8fafc; user-select: none;">
                <input type="checkbox" class="serial-checkbox" value="${s.sn}" ${isChecked} onchange="updateSerialSelectionStatus(this)">
                <span>${s.sn}</span>
            </label>
        `;
    }).join('');

    serialsContainer.style.display = 'block';
    labelSpan.textContent = qty.toString();
    validateRowSerialsCount(rowEl);
};

window.addChallanItemRowWithData = function (itemData) {
    const container = document.getElementById('challanItemsContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'challan-item-row';
    row.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 0.75rem;';

    let category = '';
    if (itemData.item.includes(' HP Motor - ')) {
        category = 'Motors';
    } else {
        const parts = itemData.item.split(' - ');
        if (parts.length >= 2) {
            const type = parts[0].trim();
            if (state.pipeSchemas[type]) {
                category = 'Pipes';
            } else if (state.fittingSchemas[type]) {
                category = 'Fittings';
            }
        }
    }

    row.innerHTML = `
        <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div style="width: 180px;">
                <select class="row-category" required style="width: 100%;" onchange="updateRowProducts(this)">
                    <option value="">Select Category...</option>
                    <option value="Pipes" ${category === 'Pipes' ? 'selected' : ''}>Supreme</option>
                    <option value="Fittings" ${category === 'Fittings' ? 'selected' : ''}>Fittings</option>
                    <option value="Motors" ${category === 'Motors' ? 'selected' : ''}>CRI</option>
                </select>
            </div>
            <div style="flex: 1;">
                <input type="text" class="row-product" list="productsDatalist" required placeholder="Enter or select product..." value="${itemData.item}" style="width: 100%;" onfocus="updateDatalistOptions(this)">
            </div>
            <div style="width: 80px;">
                <input type="number" class="row-qty" min="1" value="${itemData.qty}" required style="width: 100%;">
            </div>
            <button type="button" class="btn-delete-row" onclick="this.closest('.challan-item-row').remove();" title="Remove Product">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        </div>
        <div class="row-serials-container" style="display: none; padding-left: 1rem;">
            <label style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 0.25rem; display: block;">Select Serial Numbers (Select <span class="required-serial-count">1</span>):</label>
            <div class="serials-checkboxes" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                <!-- Loaded dynamically -->
            </div>
        </div>
    `;
    container.appendChild(row);

    const qtyInput = row.querySelector('.row-qty');
    const productInput = row.querySelector('.row-product');
    const categorySelect = row.querySelector('.row-category');

    const preselected = itemData.serial ? itemData.serial.split(',').map(s => s.trim()).filter(Boolean) : [];

    qtyInput.addEventListener('input', () => {
        loadRowSerials(row);
    });

    productInput.addEventListener('input', () => {
        loadRowSerials(row);
    });

    categorySelect.addEventListener('change', () => {
        loadRowSerials(row);
    });

    if (category === 'Motors') {
        loadRowSerials(row, preselected);
    }
};

window.openNewChallanModal = function (isInternal = false) {
    document.getElementById('editingChallanId').value = '';
    document.getElementById('challanModalTitle').textContent = 'New Transportation Request';
    
    document.getElementById('challanForm').reset();
    document.getElementById('challanItemsContainer').innerHTML = '';
    
    const customerGroup = document.getElementById('challanCustomerGroup');
    const destGodownGroup = document.getElementById('challanDestinationGodownGroup');
    const customerInput = document.getElementById('challanCustomerName');
    const destGodownSelect = document.getElementById('challanDestinationGodown');
    const typeInput = document.getElementById('challanType');
    
    if (isInternal) {
        if (customerGroup) customerGroup.style.display = 'none';
        if (destGodownGroup) destGodownGroup.style.display = 'block';
        if (customerInput) customerInput.required = false;
        if (destGodownSelect) destGodownSelect.required = true;
    } else {
        if (customerGroup) customerGroup.style.display = 'block';
        if (destGodownGroup) destGodownGroup.style.display = 'none';
        if (customerInput) customerInput.required = true;
        if (destGodownSelect) destGodownSelect.required = false;
    }

    if (typeInput) {
        typeInput.value = isInternal ? 'Internal' : 'Outward';
    }

    populateGodownDropdowns();
    addChallanItemRow();
    updateDestinationGodownSuggestions();
    openModal('challanModal');
};

window.openEditChallanModal = function (id) {
    const ch = state.challans.find(c => (c._id || c.id) === id);
    if (!ch) return;

    document.getElementById('editingChallanId').value = id;
    document.getElementById('challanModalTitle').textContent = `Edit Challan ${ch.challanId || ch.id}`;
    
    const typeInput = document.getElementById('challanType');
    if (typeInput) typeInput.value = ch.type || 'Outward';

    const sourceGodown = document.getElementById('challanSourceGodown');
    if (sourceGodown) sourceGodown.value = ch.sourceGodown || 'Main Godown';

    if (typeof updateDestinationGodownSuggestions === 'function') {
        updateDestinationGodownSuggestions();
    }

    const customerGroup = document.getElementById('challanCustomerGroup');
    const destGodownGroup = document.getElementById('challanDestinationGodownGroup');
    const customerInput = document.getElementById('challanCustomerName');
    const destGodownSelect = document.getElementById('challanDestinationGodown');

    if (ch.type === 'Internal') {
        if (customerGroup) customerGroup.style.display = 'none';
        if (destGodownGroup) destGodownGroup.style.display = 'block';
        if (customerInput) { customerInput.required = false; customerInput.value = ''; }
        if (destGodownSelect) { destGodownSelect.required = true; destGodownSelect.value = ch.customer; }
    } else {
        if (customerGroup) customerGroup.style.display = 'block';
        if (destGodownGroup) destGodownGroup.style.display = 'none';
        if (customerInput) { customerInput.required = true; customerInput.value = ch.customer; }
        if (destGodownSelect) { destGodownSelect.required = false; destGodownSelect.value = ''; }
    }

    const container = document.getElementById('challanItemsContainer');
    container.innerHTML = '';

    if (ch.items && ch.items.length > 0) {
        ch.items.forEach(item => {
            addChallanItemRowWithData(item);
        });
    } else if (ch.item) {
        addChallanItemRowWithData({
            item: ch.item,
            qty: ch.qty,
            serial: ch.serial
        });
    }

    openModal('challanModal');
};

window.addChallanItemRow = function () {
    addChallanItemRowWithData({ item: '', qty: 1, serial: '' });
};

window.updateRowProducts = function (selectEl) {
    const row = selectEl.closest('.challan-item-row');
    const productInput = row.querySelector('.row-product');
    if (productInput) productInput.value = '';
    const serialsContainer = row.querySelector('.row-serials-container');
    if (serialsContainer) serialsContainer.style.display = 'none';
};

window.updateDatalistOptions = function (inputEl) {
    const row = inputEl.closest('.challan-item-row');
    const categorySelect = row.querySelector('.row-category');
    const category = categorySelect ? categorySelect.value : '';

    const datalist = document.getElementById('productsDatalist');
    if (!datalist) return;
    datalist.innerHTML = '';

    if (category === 'Pipes') {
        const pipeProducts = [];
        state.pipes.forEach(pipe => {
            const columns = state.pipeSchemas[pipe.type] || [];
            columns.forEach(col => pipeProducts.push(`${pipe.type} - ${pipe.size} (${col})`));
        });
        Array.from(new Set(pipeProducts)).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            datalist.appendChild(opt);
        });
    }
    if (category === 'Fittings') {
        const fittingProducts = [];
        state.fittings.forEach(fitting => {
            const columns = state.fittingSchemas[fitting.type] || [];
            columns.forEach(col => fittingProducts.push(`${fitting.type} - ${fitting.name} (${col})`));
        });
        Array.from(new Set(fittingProducts)).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            datalist.appendChild(opt);
        });
    }
    if (category === 'Motors' || category === '') {
        const sourceGodown = document.getElementById('challanSourceGodown')?.value || 'Main Godown';
        state.motors.forEach(motor => {
            const motorValue = `${motor.hp} HP Motor - ${motor.type} (${motor.phase})`;
            const availableSerials = motor.serials ? motor.serials.filter(s => {
                const isFromGodown = s.godown && s.godown.toLowerCase() === sourceGodown.toLowerCase();
                const isAvailable = !s.status || s.status === 'Available';
                return isFromGodown && isAvailable;
            }) : [];
            const available = availableSerials.length;
            const motorDisplayName = `${motor.type} ${motor.hp}`;
            
            if (available > 0) {
                availableSerials.forEach(serial => {
                    const opt = document.createElement('option');
                    opt.value = motorValue;
                    const labelText = `${motorDisplayName} | Available: ${available} | SN: ${serial.sn}`;
                    opt.label = labelText;
                    opt.textContent = labelText;
                    datalist.appendChild(opt);
                });
            } else {
                const opt = document.createElement('option');
                opt.value = motorValue;
                const labelText = `${motorDisplayName} | Available: 0 | SN: N/A`;
                opt.label = labelText;
                opt.textContent = labelText;
                datalist.appendChild(opt);
            }
        });
    }
};

// ─── Product Stock Lookup ─────────────────────────────────────────────────────

function getProductStock(itemStr, godownName) {
    if (!itemStr) return 0;
    
    // Determine the godown to use
    let godown = godownName;
    if (!godown) {
        if (window.currentGodownFilter && window.currentGodownFilter !== 'all') {
            godown = window.currentGodownFilter;
        } else {
            godown = (state.godowns && state.godowns[0]) || 'Main Godown';
        }
    }

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
                if (pipe && pipe.stock && pipe.stock[godown] && pipe.stock[godown][col] !== undefined) {
                    return pipe.stock[godown][col];
                }

                const fitting = state.fittings.find(f => f.type === type && f.name === size);
                if (fitting && fitting.stock && fitting.stock[godown] && fitting.stock[godown][col] !== undefined) {
                    return fitting.stock[godown][col];
                }
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
                if (motor && motor.serials) {
                    return motor.serials.filter(s => s.godown && s.godown.toLowerCase() === godown.toLowerCase()).length;
                }
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
                <div><span class="details-label">${ch.type === 'Internal' ? 'Destination' : 'Customer'}:</span> ${ch.customer || 'Customer'}</div>
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
                const avail = getProductStock(i.item, ch.sourceGodown);
                return `
                    <div style="margin-bottom: 0.5rem; line-height: 1.3;">
                        <div style="color: #0f172a; font-weight: 700; font-size: 0.95rem;">${i.item} (x${i.qty})</div>
                        <div style="color: #64748b; font-size: 0.8rem; font-weight: 500;">Available: ${avail}</div>
                    </div>
                `;
            }).join('');
        } else {
            const avail = getProductStock(ch.item, ch.sourceGodown);
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
                <button class="btn-action-square edit" onclick="openEditChallanModal('${chId}')" title="Edit Challan" ${(!isAdmin || !isPending) ? 'disabled' : ''}><i class="fa-solid fa-pencil"></i></button>
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
            <td>
                <div style="font-size: 0.75rem; font-weight: 700; color: ${ch.type === 'Internal' ? '#8b5cf6' : '#64748b'}; text-transform: uppercase; margin-bottom: 0.2rem;">
                    ${ch.type === 'Internal' ? 'Internal Transfer' : 'Customer'}
                </div>
                <div style="font-weight: 600; color: #334155;">${ch.customer || 'Customer'}</div>
            </td>
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
        API.updateChallan(id, { status: 'rejected' }).then(async (updated) => {
            const idx = state.challans.findIndex(c => (c._id || c.id) === id);
            if (idx !== -1) state.challans[idx] = updated;
            
            if (window.loadDataFromBackend) {
                await window.loadDataFromBackend();
            }
            if (window.populateGodownDropdowns) window.populateGodownDropdowns();
            if (window.renderPipes) window.renderPipes();
            if (window.renderFittings) window.renderFittings();
            if (window.renderMotors) window.renderMotors();
            if (window.renderChallans) window.renderChallans();
            if (window.updateDashboard) window.updateDashboard();
            if (window.renderLogs) window.renderLogs();
            
            saveState();
        }).catch(err => alert('Error: ' + err.message));
    }
};

window.deleteChallan = function (id) {
    const ch = state.challans.find(c => (c._id || c.id) === id);
    if (!ch) return;
    const displayId = ch.challanId || ch.id || ch._id;
    if (confirm(`Are you sure you want to delete challan ${displayId}?`)) {
        API.deleteChallanApi(id).then(async () => {
            state.challans = state.challans.filter(c => (c._id || c.id) !== id);
            
            if (window.loadDataFromBackend) {
                await window.loadDataFromBackend();
            }
            if (window.populateGodownDropdowns) window.populateGodownDropdowns();
            if (window.renderPipes) window.renderPipes();
            if (window.renderFittings) window.renderFittings();
            if (window.renderMotors) window.renderMotors();
            if (window.renderChallans) window.renderChallans();
            if (window.updateDashboard) window.updateDashboard();
            if (window.renderLogs) window.renderLogs();
            
            saveState();
        }).catch(err => alert('Error: ' + err.message));
    }
};

// ─── Challan Form Submit ──────────────────────────────────────────────────────

document.getElementById('challanForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const editingId = document.getElementById('editingChallanId').value;
    const items = [];
    const rows = document.querySelectorAll('#challanItemsContainer .challan-item-row');
    if (rows.length === 0) { alert("Please add at least one item."); return; }

    let hasEmptyProduct = false;
    let hasStockError = false;
    let errorMsg = '';
    let hasSerialError = false;

    const type = document.getElementById('challanType').value;
    const sourceGodown = document.getElementById('challanSourceGodown').value;

    rows.forEach((row, idx) => {
        const category = row.querySelector('.row-category').value;
        const productVal = row.querySelector('.row-product').value.trim();
        const qtyVal = row.querySelector('.row-qty').value.trim();
        
        if (!productVal) { hasEmptyProduct = true; return; }
        if (!qtyVal) { 
            alert("Quantity cannot be empty.");
            hasSerialError = true;
            return;
        }
        const qty = parseInt(qtyVal, 10);
        if (isNaN(qty) || qty <= 0) {
            alert("Quantity must be a positive number.");
            hasSerialError = true;
            return;
        }

        // Validate stock if Outward or Internal
        if (type !== 'Inward') {
            const avail = getAdjustedProductStock(productVal, sourceGodown, editingId, idx);
            if (qty > avail) {
                hasStockError = true;
                errorMsg = `Insufficient Stock for ${productVal} in ${sourceGodown}. Available: ${avail}, Requested: ${qty}`;
                return;
            }
        }

        // Handle serials for Motors
        let serials = '';
        if (category === 'Motors') {
            const checked = row.querySelectorAll('.serial-checkbox:checked');
            if (checked.length !== qty) {
                alert(`Please select exactly ${qty} serial numbers for motor ${productVal} (selected: ${checked.length}).`);
                hasSerialError = true;
                return;
            }
            serials = Array.from(checked).map(cb => cb.value).join(', ');
        }

        items.push({
            sno: (idx + 1).toString(),
            item: productVal,
            serial: serials,
            qty: qty
        });
    });

    if (hasEmptyProduct) { alert("Please select a product for all rows."); return; }
    if (hasStockError) { alert(errorMsg); return; }
    if (hasSerialError) return;

    const customerValue = type === 'Internal'
        ? document.getElementById('challanDestinationGodown').value
        : document.getElementById('challanCustomerName').value.trim();

    if (type === 'Internal' && sourceGodown === customerValue) {
        alert("Source and Destination Godown cannot be the same.");
        return;
    }

    try {

        if (editingId) {
            // Update existing Challan
            const updatedChallan = await API.updateChallan(editingId, {
                customer: customerValue,
                sourceGodown: sourceGodown,
                items,
                type: type
            });
            const idx = state.challans.findIndex(c => (c._id || c.id) === editingId);
            if (idx !== -1) state.challans[idx] = updatedChallan;
            alert("Challan updated successfully.");
        } else {
            // Create new Challan
            const newChallan = await API.createChallan({
                customer: customerValue,
                sourceGodown: sourceGodown,
                items,
                createdBy: state.currentUser.username,
                type: type,
                date: new Date().toISOString().split('T')[0]
            });
            state.challans.unshift(newChallan);
            alert("Challan created successfully.");
        }

        // Full reload of data from backend to ensure all inventory/dashboard/reports sync
        if (window.loadDataFromBackend) {
            await window.loadDataFromBackend();
        }
        
        if (window.populateGodownDropdowns) window.populateGodownDropdowns();
        if (window.renderPipes) window.renderPipes();
        if (window.renderFittings) window.renderFittings();
        if (window.renderMotors) window.renderMotors();
        if (window.renderChallans) window.renderChallans();
        if (window.updateDashboard) window.updateDashboard();
        if (window.renderLogs) window.renderLogs();

        saveState();
        closeModal('challanModal');
        e.target.reset();
        document.getElementById('challanItemsContainer').innerHTML = '';
        document.getElementById('editingChallanId').value = '';
    } catch (err) {
        alert('Error saving challan: ' + err.message);
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

            if (window.loadDataFromBackend) {
                await window.loadDataFromBackend();
            }
            if (window.populateGodownDropdowns) window.populateGodownDropdowns();
            if (window.renderPipes) window.renderPipes();
            if (window.renderFittings) window.renderFittings();
            if (window.renderMotors) window.renderMotors();
            if (window.renderChallans) window.renderChallans();
            if (window.updateDashboard) window.updateDashboard();
            if (window.renderLogs) window.renderLogs();

            saveState();
            closeModal('approveChallanModal');
        } catch (err) {
            alert('Error approving challan: ' + err.message);
        }
    }
});

window.updateDestinationGodownSuggestions = function () {
    const isInternal = document.getElementById('challanType')?.value === 'Internal';
    const destGodownSelect = document.getElementById('challanDestinationGodown');
    if (!destGodownSelect) return;
    destGodownSelect.innerHTML = '';
    if (isInternal) {
        const sourceGodown = document.getElementById('challanSourceGodown')?.value;
        const godownsList = state.godowns || ['Main Godown', 'Shop', 'Godown 3'];
        const suggestions = godownsList.filter(g => g !== sourceGodown);
        destGodownSelect.innerHTML = suggestions.map(g => `<option value="${g}">${g}</option>`).join('');
    }
};

document.getElementById('challanSourceGodown')?.addEventListener('change', () => {
    updateDestinationGodownSuggestions();
});

document.getElementById('challanDestinationGodown')?.addEventListener('focus', () => {
    updateDestinationGodownSuggestions();
});

document.getElementById('challanDestinationGodown')?.addEventListener('click', () => {
    updateDestinationGodownSuggestions();
});

// Expose
window.renderChallans = renderChallans;
window.getProductStock = getProductStock;
