/**
 * challans.js - Transport Challans Module
 * Sri Sapthagiri Logistics Inventory System
 */

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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

window.loadRowSerials = function (rowEl, preselectedSerials = []) {
    const rowCategory = rowEl.querySelector('.row-category').value;
    const serialsContainer = rowEl.querySelector('.row-serials-container');

    if (rowCategory !== 'Motors') {
        if (serialsContainer) {
            serialsContainer.style.display = 'flex';
            serialsContainer.innerHTML = `
                <select class="row-serial-select" disabled>
                    <option value="">Not required</option>
                </select>
            `;
        }
        return;
    }

    const productInput = rowEl.querySelector('.row-product');
    const productVal = productInput.value.trim();
    const qtyInput = rowEl.querySelector('.row-qty');
    const qty = parseInt(qtyInput.value, 10) || 0;
    
    const sourceGodown = rowEl.querySelector('.row-source').value;

    if (!productVal || qty <= 0) {
        if (serialsContainer) {
            serialsContainer.style.display = 'block';
            serialsContainer.innerHTML = `
                <select class="row-serial-select" disabled>
                    <option value="">Select product first</option>
                </select>
            `;
        }
        return;
    }

    const motorParsed = parseMotorItemString(productVal);
    if (!motorParsed) {
        if (serialsContainer) {
            serialsContainer.style.display = 'block';
            serialsContainer.innerHTML = `
                <select class="row-serial-select" disabled>
                    <option value="">Choose a CRI motor</option>
                </select>
            `;
        }
        return;
    }

    const { hp, type, phase } = motorParsed;
    const motor = state.motors.find(m => m.hp === hp && m.type === type && m.phase === phase);
    if (!motor) {
        if (serialsContainer) {
            serialsContainer.style.display = 'block';
            serialsContainer.innerHTML = `
                <select class="row-serial-select" disabled>
                    <option value="">Motor not found</option>
                </select>
            `;
        }
        return;
    }

    // Filter available serial numbers
    const availableSerials = motor.serials.filter(s => {
        const isFromGodown = s.godown && s.godown.toLowerCase().trim() === sourceGodown.toLowerCase().trim();
        const isAvailable = !s.status || s.status === 'Available';
        const isPreselected = preselectedSerials.includes(s.sn);
        return isFromGodown && (isAvailable || isPreselected);
    });

    if (availableSerials.length === 0) {
        serialsContainer.innerHTML = `
            <select class="row-serial-select" disabled>
                <option value="">No serials available</option>
            </select>
        `;
        serialsContainer.style.display = 'block';
        return;
    }

    const dropdownCount = Math.max(qty, 1);
    const selectors = Array.from({ length: dropdownCount }, (_, idx) => {
        const selectedSerial = preselectedSerials[idx] || '';
        const options = availableSerials.map(s => {
            const sn = escapeHtml(s.sn);
            const isSelected = selectedSerial === s.sn ? 'selected' : '';
            return `<option value="${sn}" ${isSelected}>${sn}</option>`;
        }).join('');

        return `
            <select class="row-serial-select" required aria-label="Serial number ${idx + 1}">
                <option value="">Select serial no.</option>
                ${options}
            </select>
        `;
    }).join('');

    serialsContainer.innerHTML = selectors;

    serialsContainer.style.display = 'block';
};

window.addChallanItemRowWithData = function (itemData) {
    const container = document.getElementById('challanItemsContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'challan-item-row';

    const godowns = state.godowns || ['Main Godown', 'Shop', 'Godown 3'];
    const sourceValue = itemData.source || itemData.godown || godowns[0];
    const sourceOptions = godowns.map(g => `<option value="${escapeHtml(g)}" ${sourceValue === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('');

    // Detect category if itemData has item
    let category = itemData.category || '';
    if (!category && itemData.item) {
        if (itemData.item.includes(' HP Motor - ')) category = 'Motors';
        else {
            const typePart = itemData.item.split(' - ')[0].trim();
            const isFitting = state.fittings.some(f => f.type === typePart || f.type === `${typePart} fittings`);
            category = isFitting ? 'Fittings' : 'Pipes';
        }
    }

    row.innerHTML = `
        <div class="challan-item-grid ${category === 'Motors' ? 'has-serial' : ''}">
            <div class="challan-row-field challan-source-field">
                <select class="row-source" required>
                    ${sourceOptions}
                </select>
            </div>
            <div class="challan-row-field challan-category-field">
                <select class="row-category" required>
                    <option value="">Category...</option>
                    <option value="Pipes" ${category === 'Pipes' ? 'selected' : ''}>Supreme(pipes)</option>
                    <option value="Fittings" ${category === 'Fittings' ? 'selected' : ''}>Supreme(Fitting)</option>
                    <option value="Motors" ${category === 'Motors' ? 'selected' : ''}>CRI(Motors)</option>
                </select>
            </div>
            <div class="challan-row-field challan-product-field">
                <input type="text" class="row-product" list="productsDatalist" required placeholder="Product..." value="${escapeHtml(itemData.item)}" onfocus="updateDatalistOptions(this)">
            </div>
            <div class="challan-row-field challan-serial-field row-serials-container">
                <select class="row-serial-select" disabled>
                    <option value="">Select motor first</option>
                </select>
            </div>
            <div class="challan-row-field challan-qty-field">
                <input type="number" class="row-qty" min="1" value="${itemData.qty}" required>
            </div>
            <button type="button" class="btn-delete-row" onclick="this.closest('.challan-item-row').remove();" title="Remove Product">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        </div>
    `;
    container.appendChild(row);

    const qtyInput = row.querySelector('.row-qty');
    const productInput = row.querySelector('.row-product');
    const categorySelect = row.querySelector('.row-category');
    const sourceSelect = row.querySelector('.row-source');

    const preselected = itemData.serial ? itemData.serial.split(',').map(s => s.trim()).filter(Boolean) : [];

    const refreshSerials = () => {
        const grid = row.querySelector('.challan-item-grid');
        if (categorySelect.value === 'Motors') {
            const currentSelectedSerials = Array.from(row.querySelectorAll('.row-serial-select'))
                .map(select => select.value)
                .filter(Boolean);
            if (grid) grid.classList.add('has-serial');
            loadRowSerials(row, currentSelectedSerials.length ? currentSelectedSerials : preselected);
        } else {
            const serialsContainer = row.querySelector('.row-serials-container');
            if (grid) grid.classList.remove('has-serial');
            if (serialsContainer) {
                serialsContainer.style.display = 'flex';
                serialsContainer.innerHTML = `
                    <select class="row-serial-select" disabled>
                        <option value="">Not required</option>
                    </select>
                `;
            }
        }
    };

    qtyInput.addEventListener('input', refreshSerials);
    productInput.addEventListener('input', refreshSerials);
    categorySelect.addEventListener('change', () => {
        productInput.value = '';
        refreshSerials();
    });
    sourceSelect.addEventListener('change', () => {
        refreshSerials();
        if (typeof updateDestinationGodownSuggestions === 'function') {
            updateDestinationGodownSuggestions();
        }
    });

    // Initial load
    refreshSerials();
};

window.openNewChallanModal = function (isInternal = false) {
    document.getElementById('editingChallanId').value = '';
    document.getElementById('challanModalTitle').textContent = isInternal ? 'Internal Transportation Request' : 'New Transportation Request';
    
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
            if (!item.source) item.source = ch.sourceGodown;
            addChallanItemRowWithData(item);
        });
    } else if (ch.item) {
        addChallanItemRowWithData({
            item: ch.item,
            qty: ch.qty,
            serial: ch.serial,
            source: ch.sourceGodown
        });
    }

    openModal('challanModal');
};

window.addChallanItemRow = function () {
    const godowns = state.godowns || ['Main Godown', 'Shop', 'Godown 3'];
    addChallanItemRowWithData({ item: '', qty: 1, serial: '', source: godowns[0] });
};

// Removed global category change listener

window.updateDatalistOptions = function (inputEl) {
    const rowEl = inputEl.closest('.challan-item-row');
    const rowCategory = rowEl.querySelector('.row-category').value;
    const sourceGodown = (rowEl.querySelector('.row-source').value || 'Main Godown').toLowerCase().trim();

    const datalist = document.getElementById('productsDatalist');
    if (!datalist) return;
    datalist.innerHTML = '';

    if (!rowCategory) return;

    if (rowCategory === 'Pipes') {
        state.pipes.forEach(pipe => {
            const columns = state.pipeSchemas[pipe.type] || [];
            columns.forEach(col => {
                const gKey = Object.keys(pipe.stock || {}).find(k => k.toLowerCase().trim() === sourceGodown);
                const stockObj = gKey ? pipe.stock[gKey] : null;
                const colKey = stockObj ? Object.keys(stockObj).find(k => k.toLowerCase().trim() === col.toLowerCase().trim()) : null;
                const available = colKey ? stockObj[colKey] : 0;
                
                // ONLY suggest if stock > 0
                if (available > 0) {
                    const typeDisplay = pipe.type.replace(/ pipes$/i, '').trim();
                    let pipeValue = `${typeDisplay} - ${pipe.size}`;
                    if (col !== 'Stock' && !pipe.size.toLowerCase().includes(col.toLowerCase())) {
                        pipeValue += ` (${col})`;
                    }
                    
                    const opt = document.createElement('option');
                    opt.value = pipeValue;
                    opt.textContent = `Available NO'S: ${available}`;
                    datalist.appendChild(opt);
                }
            });
        });
    } else if (rowCategory === 'Fittings') {
        state.fittings.forEach(fitting => {
            const columns = state.fittingSchemas[fitting.type] || [];
            columns.forEach(col => {
                const gKey = Object.keys(fitting.stock || {}).find(k => k.toLowerCase().trim() === sourceGodown);
                const stockObj = gKey ? fitting.stock[gKey] : null;
                const colKey = stockObj ? Object.keys(stockObj).find(k => k.toLowerCase().trim() === col.toLowerCase().trim()) : null;
                const available = colKey ? stockObj[colKey] : 0;

                // ONLY suggest if stock > 0
                if (available > 0) {
                    const typeDisplay = fitting.type.replace(/ fittings$/i, '').trim();
                    let fittingValue = `${typeDisplay} - ${fitting.name}`;
                    if (col !== 'Size' && col !== 'Stock' && !fitting.name.toLowerCase().includes(col.toLowerCase())) {
                        fittingValue += ` (${col})`;
                    }

                    const opt = document.createElement('option');
                    opt.value = fittingValue;
                    opt.textContent = `Available NO'S: ${available}`;
                    datalist.appendChild(opt);
                }
            });
        });
    } else if (rowCategory === 'Motors') {
        state.motors.forEach(motor => {
            const availableSerials = motor.serials ? motor.serials.filter(s => {
                const isFromGodown = s.godown && s.godown.toLowerCase().trim() === sourceGodown;
                const isAvailable = !s.status || s.status === 'Available';
                return isFromGodown && isAvailable;
            }) : [];
            
            // ONLY suggest if there are available serials
            if (availableSerials.length > 0) {
                const motorValue = `${motor.hp} HP Motor - ${motor.type} (${motor.phase})`;
                const opt = document.createElement('option');
                opt.value = motorValue;
                opt.textContent = `Available Serials: ${availableSerials.length}`;
                datalist.appendChild(opt);
            }
        });
    }
};

// ─── Product Stock Lookup ─────────────────────────────────────────────────────

function getProductStock(itemStr, godownName) {
    if (!itemStr) return 0;
    
    let godown = (godownName || window.currentGodownFilter || 'Main Godown').toLowerCase().trim();
    if (godown === 'all') godown = (state.godowns && state.godowns[0] ? state.godowns[0].toLowerCase().trim() : 'main godown');

    if (itemStr.includes(' - ')) {
        const parts = itemStr.split(' - ');
        if (parts.length >= 2) {
            const typeIn = parts[0].trim();
            const rest = parts[1].trim();
            
            let nameOrSize = rest;
            let col = '';
            
            const lastOpenParen = rest.lastIndexOf('(');
            const lastCloseParen = rest.lastIndexOf(')');
            if (lastOpenParen !== -1 && lastCloseParen !== -1 && lastCloseParen === rest.length - 1) {
                nameOrSize = rest.substring(0, lastOpenParen).trim();
                col = rest.substring(lastOpenParen + 1, lastCloseParen).trim();
            }

            const findItem = (list, isP) => {
                return list.find(p => {
                    const matchType = p.type.toLowerCase() === typeIn.toLowerCase() || 
                                    p.type.toLowerCase() === `${typeIn.toLowerCase()} pipes` || 
                                    p.type.toLowerCase() === `${typeIn.toLowerCase()} fittings`;
                    const matchName = isP ? 
                                    (p.size.toLowerCase() === nameOrSize.toLowerCase() || p.size.toLowerCase() === rest.toLowerCase()) : 
                                    (p.name.toLowerCase() === nameOrSize.toLowerCase() || p.name.toLowerCase() === rest.toLowerCase());
                    return matchType && matchName;
                });
            };

            let product = findItem(state.pipes, true);
            let isPipe = true;
            if (!product) {
                product = findItem(state.fittings, false);
                isPipe = false;
            }

            if (product && product.stock) {
                const gKey = Object.keys(product.stock).find(k => k.toLowerCase().trim() === godown);
                if (gKey) {
                    const stockObj = product.stock[gKey];
                    if (col) {
                        const colKey = Object.keys(stockObj).find(k => k.toLowerCase().trim() === col.toLowerCase().trim());
                        if (colKey) return stockObj[colKey];
                    }
                    
                    const schemas = isPipe ? state.pipeSchemas : state.fittingSchemas;
                    const cols = schemas[product.type] || (isPipe ? ["Stock"] : ["Size"]);
                    for (let c of cols) {
                        if (rest.toLowerCase().includes(c.toLowerCase())) {
                            const cKey = Object.keys(stockObj).find(k => k.toLowerCase().trim() === c.toLowerCase().trim());
                            if (cKey) return stockObj[cKey];
                        }
                    }
                    const firstKey = Object.keys(stockObj).find(k => k.toLowerCase().trim() === cols[0]?.toLowerCase().trim());
                    return firstKey ? stockObj[firstKey] : 0;
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
                const motor = state.motors.find(m => 
                    m.hp.toLowerCase() === hp.toLowerCase() && 
                    m.type.toLowerCase() === type.toLowerCase() && 
                    m.phase.toLowerCase() === phase.toLowerCase()
                );
                if (motor && motor.serials) {
                    return motor.serials.filter(s => s.godown && s.godown.toLowerCase().trim() === godown).length;
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

    // Show all challans (no status filtering)
    state.challans.forEach(ch => {
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
    
    confirmDeletion(() => {
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
    }, `Are you sure you want to reject challan ${displayId}?`);
};

window.deleteChallan = function (id) {
    const ch = state.challans.find(c => (c._id || c.id) === id);
    if (!ch) return;
    const displayId = ch.challanId || ch.id || ch._id;
    
    confirmDeletion(() => {
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
    }, `Are you sure you want to delete challan ${displayId}?`);
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

    rows.forEach((row, idx) => {
        const productVal = row.querySelector('.row-product').value.trim();
        const qtyVal = row.querySelector('.row-qty').value.trim();
        const rowSource = row.querySelector('.row-source').value;
        const rowCategory = row.querySelector('.row-category').value;
        
        if (!rowCategory) { alert(`Please select a category for item ${idx + 1}.`); hasSerialError = true; return; }
        if (!productVal) { hasEmptyProduct = true; return; }
        if (!qtyVal) { 
            alert(`Quantity cannot be empty for row ${idx + 1}.`);
            hasSerialError = true;
            return;
        }
        const qty = parseInt(qtyVal, 10);
        if (isNaN(qty) || qty <= 0) {
            alert(`Quantity must be a positive number for row ${idx + 1}.`);
            hasSerialError = true;
            return;
        }

        // Validate stock if Outward or Internal
        if (type !== 'Inward') {
            const avail = getAdjustedProductStock(productVal, rowSource, editingId, idx);
            if (qty > avail) {
                hasStockError = true;
                errorMsg = `Insufficient Stock for ${productVal} in ${rowSource}. Available: ${avail}, Requested: ${qty}`;
                return;
            }
        }

        // Handle serials for Motors
        let serials = '';
        if (rowCategory === 'Motors') {
            const serialSelects = Array.from(row.querySelectorAll('.row-serial-select'));
            const selectedSerials = serialSelects.map(select => select.value).filter(Boolean);
            const uniqueSerials = new Set(selectedSerials);

            if (selectedSerials.length !== qty) {
                alert(`Please select exactly ${qty} serial number${qty === 1 ? '' : 's'} for motor ${productVal} (selected: ${selectedSerials.length}).`);
                hasSerialError = true;
                return;
            }

            if (uniqueSerials.size !== selectedSerials.length) {
                alert(`Please do not select the same serial number twice for motor ${productVal}.`);
                hasSerialError = true;
                return;
            }

            serials = selectedSerials.join(', ');
        }

        items.push({
            sno: (idx + 1).toString(),
            item: productVal,
            serial: serials,
            qty: qty,
            source: rowSource,
            godown: rowSource, // Kept for backend approval/source compatibility
            category: rowCategory
        });
    });

    if (hasEmptyProduct) { alert("Please select a product for all rows."); return; }
    if (hasStockError) { alert(errorMsg); return; }
    if (hasSerialError) return;

    const customerValue = type === 'Internal'
        ? document.getElementById('challanDestinationGodown').value
        : document.getElementById('challanCustomerName').value.trim();

    // Primary source for legacy/header display
    const mainSource = items[0].source || items[0].godown;

    if (type === 'Internal' && mainSource === customerValue) {
        alert("Source and Destination Godown cannot be the same.");
        return;
    }

    try {
        if (editingId) {
            await API.updateChallan(editingId, {
                customer: customerValue,
                sourceGodown: mainSource,
                items,
                type: type
            });
            alert("Challan updated successfully.");
        } else {
            const newChallan = await API.createChallan({
                customer: customerValue,
                sourceGodown: mainSource,
                items,
                createdBy: state.currentUser.username,
                type: type,
                date: new Date().toISOString().split('T')[0]
            });
            state.challans.unshift(newChallan);
            alert("Challan created successfully.");
        }

        if (window.loadDataFromBackend) await window.loadDataFromBackend();
        
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
        // Use source from first row if available
        const firstRowSource = document.querySelector('#challanItemsContainer .row-source');
        const sourceGodown = firstRowSource ? firstRowSource.value : (state.godowns[0] || 'Main Godown');
        
        const godownsList = state.godowns || ['Main Godown', 'Shop', 'Godown 3'];
        const suggestions = godownsList.filter(g => g !== sourceGodown);
        destGodownSelect.innerHTML = suggestions.map(g => `<option value="${g}">${g}</option>`).join('');
    }
};

// Removed stale event listeners for challanSourceGodown

document.getElementById('challanDestinationGodown')?.addEventListener('focus', () => {
    updateDestinationGodownSuggestions();
});

document.getElementById('challanDestinationGodown')?.addEventListener('click', () => {
    updateDestinationGodownSuggestions();
});

// Expose
window.renderChallans = renderChallans;
window.getProductStock = getProductStock;
