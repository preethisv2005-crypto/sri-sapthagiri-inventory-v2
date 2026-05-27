import { state } from './state.js';

export function initIcons() {
    if (window.lucide) lucide.createIcons();
}

export function renderAll() {
    renderDashboard();
    renderPipeDashboard();
    renderInventory('supreme');
    renderInventory('fitting');
    renderInventory('cri');
    renderInventoryList('supreme', 'supreme-monitor-list');
    renderInventoryList('fitting', 'fitting-monitor-list');
    renderInventoryList('cri', 'cri-monitor-list');
    renderRequests();
    renderLogs();
    initIcons();
}

function getId(obj) {
    return obj._id || obj.id;
}

function renderDashboard() {
    const criStock = state.products.filter(p => p.category === 'cri').reduce((acc, p) => acc + p.stock, 0);
    const supremeStock = state.products.filter(p => p.category === 'supreme').reduce((acc, p) => acc + p.stock, 0);
    const fittingStock = state.products.filter(p => p.category === 'fitting').reduce((acc, p) => acc + p.stock, 0);
    const lowStockItems = state.products.filter(p => p.stock <= (p.lowStockLimit || 10));
    const dispatched = state.requests.filter(r => r.status === 'approved' && isToday(r.date)).length;

    document.getElementById('stat-cri-stock').textContent = criStock;
    document.getElementById('stat-supreme-stock').textContent = supremeStock;
    
    const fittingStockEl = document.getElementById('stat-fitting-stock');
    if (fittingStockEl) fittingStockEl.textContent = fittingStock;

    document.getElementById('stat-low-stock-count').textContent = lowStockItems.length;
    document.getElementById('stat-dispatched').textContent = dispatched;

    const alertBox = document.getElementById('low-stock-alert-box');
    const alertList = document.getElementById('low-stock-list');
    if (alertBox && alertList) {
        if (lowStockItems.length > 0) {
            alertBox.classList.remove('hidden');
            alertList.innerHTML = lowStockItems.map(p => `
                <div style="margin-bottom: 4px;">
                    • <strong>${p.name}</strong> is at ${p.stock} units (Limit: ${p.lowStockLimit || 10})
                </div>
            `).join('');
        } else {
            alertBox.classList.add('hidden');
        }
    }

    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const recent = state.requests.slice(0, 5);
    const tbody = document.getElementById('recent-requests-table');
    if (tbody) {
        tbody.innerHTML = recent.map(r => `
            <tr>
                <td>${formatDate(r.date)}</td>
                <td style="font-size:13px;">${renderItemsSummary(r.items)}</td>
                <td>${r.source}</td>
                <td>${r.dest}</td>
                <td><span class="status-pill status-${r.status}">${r.status}</span></td>
                <td>
                    ${state.currentUser === 'admin' && r.status === 'approved' ? `
                        <button class="glass-btn" style="padding:4px;color:var(--primary);" data-action="print" data-id="${getId(r)}" title="Print">
                            <i data-lucide="printer" size="14"></i>
                        </button>
                    ` : ''}
                    ${state.currentUser === 'admin' ? `
                        <button class="glass-btn" style="padding:4px;color:var(--danger);background:rgba(239,68,68,0.05);" data-action="delete-request" data-id="${getId(r)}" title="Delete">
                            <i data-lucide="trash-2" size="14"></i>
                        </button>
                    ` : (r.status !== 'approved' ? '-' : '')}
                </td>
            </tr>
        `).join('');
    }
}

function renderItemsSummary(items) {
    if (!items || !items.length) return '-';

    const getItemStock = (id) => {
        const p = state.products.find(prod => (prod._id || prod.id) === id);
        return p ? p.stock : 0;
    };

    const first = items[0].productName;
    const firstId = items[0].productId;
    const qty = items[0].qty;
    const sn = items[0].serialNumber;
    const stock = getItemStock(firstId);

    if (items.length === 1) {
        return `
            <div>
                <strong>${first}</strong> (x${qty})
                ${sn ? `<div style="color:var(--primary); font-family:monospace; font-size:11px; margin-top:2px;">SN: ${sn}</div>` : `<div style="color:var(--text-muted); font-size:11px;">Available: ${stock}</div>`}
            </div>
        `;
    }

    const fullList = items.map(it => {
        const s = getItemStock(it.productId);
        return `${it.productName} (x${it.qty})${it.serialNumber ? ` [SN: ${it.serialNumber}]` : ` [Avail: ${s}]`}`;
    }).join('\n');

    return `<span title="${fullList}" style="cursor:help; border-bottom:1px dotted var(--text-muted); font-weight:500;">${first} (x${qty}) +${items.length - 1} more</span>`;
}

let currentFittingTab = '';
let currentPipeTab = '';

function getPipeType(product) {
    const material = (product.specs?.material || product.material || '').toString().trim();
    if (material) return `${material.toUpperCase()} pipes`;
    if (product.name) {
        const firstWord = product.name.split(' ')[0];
        return `${firstWord.toUpperCase()} pipes`;
    }
    return 'Unknown pipes';
}

function getPipeSize(product) {
    return product.specs?.size || product.size || product.model || '—';
}

function getPipeWeightColumn(product) {
    const name = (product.name || '').toUpperCase();
    const material = (product.specs?.material || '').toString().toUpperCase();
    const weightCandidates = ['4KG', '6KG', '10KG', '15KG', 'SLOTTED'];
    const matches = weightCandidates.find(col => name.includes(col) || material.includes(col));
    if (matches) return matches;
    if (name.includes('PVC')) return '4KG';
    if (name.includes('GI')) return '6KG';
    if (name.includes('SWR')) return '10KG';
    if (name.includes('NU-DRAIN') || name.includes('NU DRAIN') || name.includes('DRAIN')) return '15KG';
    if (name.includes('ECO-DRAIN') || name.includes('DWC') || name.includes('HDP') || name.includes('COLUMN')) return 'SLOTTED';
    const size = getPipeSize(product);
    if (typeof size === 'string' && size.includes('4')) return '4KG';
    if (typeof size === 'string' && size.includes('6')) return '6KG';
    return 'SLOTTED';
}

function renderPipeDashboard() {
    const products = state.products.filter(p => p.category === 'supreme');
    const columns = state.pipeColumns.length ? state.pipeColumns : ['4KG','6KG','10KG','15KG','SLOTTED'];
    const activeCategories = state.pipeCategories
        .filter(c => c.type === 'supreme' && c.active)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

    const tabs = activeCategories.length > 0
        ? ['General', ...activeCategories.map(c => c.name)]
        : [...new Set(products.map(getPipeType))];

    const headerRow = [`<th style="text-align:left; padding:18px 16px;">PIPE TYPE</th>`, `<th style="padding:18px 16px;">PIPE SIZE</th>`, ...columns.map(col => `<th style="padding:18px 16px;">${col}</th>`), `<th style="padding:18px 16px;">ACTION</th>`].join('');
    const header = document.querySelector('.pipe-dashboard-table thead');
    if (header) header.innerHTML = `<tr>${headerRow}</tr>`;

    if (tabs.length === 0) {
        document.getElementById('pipe-tabs-container').innerHTML = '';
        document.getElementById('pipe-dashboard-body').innerHTML = `<tr><td colspan="${3 + columns.length}" style="padding:24px; text-align:center; color:var(--text-muted);">No pipe records found.</td></tr>`;
        return;
    }
    if (!currentPipeTab || !tabs.includes(currentPipeTab)) {
        currentPipeTab = tabs[0];
    }

    const tabsContainer = document.getElementById('pipe-tabs-container');
    if (tabsContainer) {
        tabsContainer.innerHTML = tabs.map(tab => {
            const category = activeCategories.find(c => c.name === tab);
            const categoryId = category ? category._id : null;
            return `
                <button class="glass-btn pipe-category-btn" ${categoryId ? `data-category-id="${categoryId}"` : ''} data-category-name="${tab}" style="background:${tab === currentPipeTab ? '#2563eb' : 'white'}; color:${tab === currentPipeTab ? 'white' : '#2563eb'}; border: 1px solid #cbd5e1; padding: 10px 16px; font-weight:600;" onclick="window.setPipeTab('${tab.replace(/'/g, "\\'")}')">${tab}</button>
            `;
        }).join('');
        // Add double-click event listeners to category buttons
        document.querySelectorAll('.pipe-category-btn[data-category-id]').forEach(btn => {
            btn.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                window.enableCategoryEdit(this);
            });
        });
    }

    const filtered = activeCategories.length > 0
        ? products.filter(p => ((p.subCategory || 'General').trim()) === currentPipeTab)
        : products.filter(p => getPipeType(p) === currentPipeTab);

    const rows = filtered
        .sort((a, b) => (getPipeSize(a) || '').localeCompare(getPipeSize(b) || ''))
        .map(p => {
            const pipeType = activeCategories.length > 0 ? (p.subCategory || 'General') : getPipeType(p);
            const size = getPipeSize(p);
            const weight = getPipeWeightColumn(p);
            const values = columns.map(col => col === weight ? `<strong>${p.stock || 0}</strong>` : '-');
            const productId = p._id || p.id;
            return `
                <tr style="border-top:1px solid #e2e8f0;">
                    <td style="padding:18px 16px; color:#0f172a; font-weight:600;">${pipeType}</td>
                    <td style="padding:18px 16px; color:#475569;">${size}</td>
                    ${values.map(value => `<td style="padding:18px 16px; text-align:center;">${value}</td>`).join('')}
                    <td style="padding:18px 16px; text-align:center; display:flex; gap:6px; justify-content:center;">
                        <button class="glass-btn" onclick="openProductModal('supreme', '${productId}')" style="padding:4px 8px; background:rgba(59,130,246,0.1); color:#2563eb; border:none; font-size:12px;" title="Edit">
                            <i data-lucide="edit-2" size="14"></i>
                        </button>
                        <button class="glass-btn" onclick="handleDeleteProduct('${productId}')" style="padding:4px 8px; background:rgba(239,68,68,0.1); color:var(--danger); border:none; font-size:12px;" title="Delete">
                            <i data-lucide="trash-2" size="14"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

    const body = document.getElementById('pipe-dashboard-body');
    if (body) {
        body.innerHTML = rows.join('') || `<tr><td colspan="${3 + columns.length}" style="padding:24px; text-align:center; color:var(--text-muted);">No pipe items exist for ${currentPipeTab}.</td></tr>`;
    }
}

window.setPipeTab = function(tab) {
    currentPipeTab = tab;
    renderPipeDashboard();
};

export function renderFittingMatrix() {
    const fittingProducts = state.products.filter(p => p.category === 'fitting');
    
    const getTabName = (p) => p.subCategory || (p.name ? p.name.split(' ')[0] + ' FITTINGS' : 'UNCATEGORIZED');
    
    const tabs = [...new Set(fittingProducts.map(getTabName))].sort();
    
    if (tabs.length > 0 && !currentFittingTab) {
        currentFittingTab = tabs[0];
    }
    
    const tabsContainer = document.getElementById('fitting-tabs-container');
    if (tabsContainer) {
        tabsContainer.innerHTML = tabs.map(tab => `
            <button class="fitting-tab ${tab === currentFittingTab ? 'active' : ''}" onclick="window.setFittingTab('${tab}')">
                ${tab}
            </button>
        `).join('');
    }
    
    const tabProducts = fittingProducts.filter(p => getTabName(p) === currentFittingTab);
    
    const getSize = (p) => p.size || p.specs?.size || '-';
    
    const getItemName = (p) => {
        let n = p.name || '';
        const tabStr = currentFittingTab.replace(' FITTINGS', '');
        if (n.toUpperCase().startsWith(tabStr.toUpperCase())) {
            n = n.substring(tabStr.length).trim();
        }
        if (n.toUpperCase().startsWith('FITTINGS')) {
            n = n.substring(8).trim();
        }
        if (n.toUpperCase().startsWith('FITTING')) {
            n = n.substring(7).trim();
        }
        const sz = getSize(p);
        if (sz !== '-' && n.endsWith(sz)) {
            n = n.substring(0, n.length - sz.length).trim();
        }
        return n.toUpperCase() || 'UNKNOWN';
    };

    const sizes = [...new Set(tabProducts.map(getSize))].filter(s => s !== '-').sort((a,b) => {
        const parseSize = (s) => {
            let val = 0;
            const parts = s.replace(/["']/g, '').split(' ');
            for (let part of parts) {
                if (part.includes('/')) {
                    const [num, den] = part.split('/');
                    val += parseFloat(num) / parseFloat(den);
                } else {
                    val += parseFloat(part);
                }
            }
            return val || 999;
        };
        return parseSize(a) - parseSize(b);
    });
    
    if (sizes.length === 0) sizes.push('-'); 
    
    const itemNames = [...new Set(tabProducts.map(getItemName))].sort();
    
    const thead = document.getElementById('fitting-matrix-head');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>ITEM NAME</th>
                ${sizes.map(s => `<th>${s}</th>`).join('')}
            </tr>
        `;
    }
    
    const tbody = document.getElementById('fitting-matrix-body');
    if (tbody) {
        if (itemNames.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${sizes.length + 1}" style="padding: 24px;">No fittings found for this category.</td></tr>`;
        } else {
            tbody.innerHTML = itemNames.map(itemName => {
                let rowHtml = `<tr><td class="item-name">${itemName}</td>`;
                
                for (let size of sizes) {
                    const product = tabProducts.find(p => getItemName(p) === itemName && getSize(p) === size);
                    const stockVal = product ? product.stock : 0;
                    const stockClass = product && stockVal <= (product.lowStockLimit || 10) ? 'color: var(--danger); font-weight: 700;' : '';
                    
                    rowHtml += `<td style="${stockClass}" ${product ? `data-id="${getId(product)}" onclick="window.editFittingStock('${getId(product)}', '${product.name.replace(/'/g, "\\'")}')"` : ''}>
                        ${stockVal}
                    </td>`;
                }
                
                rowHtml += '</tr>';
                return rowHtml;
            }).join('');
        }
    }
}

window.setFittingTab = function(tab) {
    currentFittingTab = tab;
    renderFittingMatrix();
};

window.editFittingStock = function(productId, productName) {
    if (state.currentUser !== 'admin') {
        alert('Only administrators can edit stock values directly.');
        return;
    }
    const product = state.products.find(p => getId(p) === productId);
    if (!product) return;
    
    const newStock = prompt(`Update stock for ${productName}:`, product.stock);
    if (newStock !== null) {
        const val = parseInt(newStock);
        if (!isNaN(val) && val >= 0) {
            product.stock = val;
            renderFittingMatrix();
            renderDashboard(); 
        } else {
            alert('Invalid stock value');
        }
    }
};

export function renderInventory(category) {
    if (category === 'fitting') {
        renderFittingMatrix();
        return;
    }
    const container = document.getElementById(category + '-inventory');
    if (!container) return;
    const searchEl = document.getElementById(category + '-search');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    const prods = state.products.filter(p =>
        p.category === category &&
        (p.name.toLowerCase().includes(searchTerm) ||
            Object.values(p.specs || {}).some(v => String(v).toLowerCase().includes(searchTerm)) ||
            (p.units || []).some(u => u.serialNumber.toLowerCase().includes(searchTerm)))
    );
    if (category === 'cri') {
        container.innerHTML = prods.map(p => {
            const units = (p.units || []).filter(u => u.serialNumber && u.serialNumber.trim());
            const locationGroups = Object.entries(units.reduce((acc, u) => {
                const loc = u.location || 'Main Godown';
                if (!acc[loc]) acc[loc] = [];
                acc[loc].push(u.serialNumber);
                return acc;
            }, {}));
            const hp = p.specs?.hp || '';
            const phase = p.specs?.phase || '';
            const type = p.specs?.type || '';
            const name = p.name || `${hp ? hp + ' HP' : ''}${hp && phase ? ' ' : ''}${phase ? phase : ''} Motor`;
            const qty = p.stock || units.length;
            const totalLocations = locationGroups.length;
            const visibleLimit = 3;
            return `
                <div class="glass product-card cri-card">
                    <div class="cri-card-header">
                        <div class="cri-card-title">
                            <div class="motor-icon"><i data-lucide="zap"></i></div>
                            <div>
                                <h3>${name}</h3>
                                <div class="cri-tag-row">
                                    ${phase ? `<span class="pill pill-primary">${phase}</span>` : ''}
                                    ${type ? `<span class="pill pill-secondary">${type}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="cri-card-total">
                            <div class="qty-label">Total Qty:</div>
                            <div class="qty-value">${qty}</div>
                        </div>
                    </div>
                    <div class="cri-card-body">
                        <div class="cri-card-serials">
                            ${locationGroups.length ? locationGroups.map(([loc, sns]) => {
                                const visibleSerials = sns.slice(0, visibleLimit);
                                const hiddenSerials = sns.slice(visibleLimit);
                                const groupId = `group-${getId(p)}-${loc.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '')}`;
                                return `
                                    <div class="serial-group">
                                        <div class="serial-group-header"><span><i data-lucide="home"></i> ${loc}</span><span>Qty: ${sns.length}</span></div>
                                        ${visibleSerials.map(sn => `<div class="serial-item-wrapper"><div class="serial-item">${sn}</div><button class="serial-delete-btn" data-action="delete-serial" data-product-id="${getId(p)}" data-serial="${sn}" title="Delete Serial"><i data-lucide="x"></i></button></div>`).join('')}
                                        ${hiddenSerials.length ? `
                                            <div class="serial-hidden-items hidden" id="${groupId}">
                                                ${hiddenSerials.map(sn => `<div class="serial-item-wrapper"><div class="serial-item">${sn}</div><button class="serial-delete-btn" data-action="delete-serial" data-product-id="${getId(p)}" data-serial="${sn}" title="Delete Serial"><i data-lucide="x"></i></button></div>`).join('')}
                                            </div>
                                            <button type="button" class="glass-btn see-more-btn" data-action="toggle-serials" data-target="${groupId}">See more (${hiddenSerials.length})</button>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('') : '<div class="serial-empty">No serials added yet.</div>'}
                        </div>
                        <div class="cri-card-actions">
                            <button class="glass-btn" data-action="add-stock" data-id="${getId(p)}" title="Add Serials">Add Serials</button>
                            <button class="glass-btn" data-action="prompt-delete-serial" data-id="${getId(p)}" title="Remove Serial" style="background: rgba(239,68,68,0.04); color: var(--danger); border: 1px solid rgba(239,68,68,0.08);">Remove Serial</button>
                            <button class="glass-btn" data-action="edit" data-id="${getId(p)}" data-category="${category}" title="Edit Motor" style="background: rgba(255,255,255,0.9); color: var(--primary); border: 1px solid rgba(37, 99, 235, 0.15);">Edit Motor</button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        initIcons();
        return;
    }
    container.innerHTML = prods.map(p => `
        <div class="glass product-card ${category}">
            <div class="product-info">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 style="margin:0;">${p.name}</h3>
                    </div>
                    <div class="flex gap-1">
                            <button class="glass-btn" style="padding:5px; color:var(--primary);" data-action="view-units" data-id="${getId(p)}" title="View Serial Numbers"><i data-lucide="list" size="14"></i></button>
                            ${state.currentUser === 'admin' ? `
                                <button class="glass-btn" style="padding:5px; background:rgba(16,185,129,0.1); color:var(--secondary);" data-action="add-stock" data-id="${getId(p)}" title="Add Stock"><i data-lucide="plus-circle" size="14"></i></button>
                                <button class="glass-btn" style="padding:5px; color:var(--primary);" data-action="edit" data-id="${getId(p)}" data-category="${category}" title="Edit"><i data-lucide="edit-2" size="14"></i></button>
                                <button class="glass-btn" style="padding:5px; color:var(--danger); background:rgba(239,68,68,0.1);" data-action="delete" data-id="${getId(p)}" title="Delete"><i data-lucide="trash-2" size="14"></i></button>
                            ` : ''}
                        </div>
                </div>
                ${(() => {
            const items = [];
            const model = p.model || p.specs?.model;
            const unit = p.unit || p.specs?.unit || '-';
            
            if (model) items.push({ key: 'Model', val: model });
            if (p.category === 'cri') items.push({ key: 'Unit', val: unit });
            
            return items.map(({ key, val }) => `
                        <div class="spec-item">
                            <span style="text-transform:capitalize;">${key}:</span>
                            <span class="spec-value">${val}</span>
                        </div>
                    `).join('');
        })()}
            </div>
            <div class="stock-indicator">
                <div class="stock-main" style="margin-bottom: 12px;">
                    <span class="stat-label">In Stock</span>
                    <span class="stock-level ${p.stock <= (p.lowStockLimit || 10) ? 'text-danger' : 'text-primary'}">${p.stock}</span>
                </div>
                ${(() => {
                    const sns = (p.units || []).map(u => u.serialNumber).filter(s => s && s.trim());
                    if (sns.length === 0) return '';
                    const summary = sns.length > 3 ? `${sns.slice(0, 3).join(', ')} ...` : sns.join(', ');
                    return `
                        <div class="sn-nearby" title="${sns.join(', ')}" style="background: rgba(37, 99, 235, 0.05); border: 1px solid rgba(37, 99, 235, 0.1); border-radius: 8px; padding: 6px 10px;">
                            <span class="sn-label" style="font-size:10px; color: var(--primary); font-weight: 800;">SERIALS:</span>
                            <span class="sn-list" style="font-size:12px; font-weight:600; color: var(--text-main); font-family: monospace;">${summary}</span>
                        </div>
                    `;
                })()}
            </div>
            <div class="location-stock-breakdown">
                ${Object.entries((p.units || []).filter(u => u.status === 'available').reduce((acc, u) => {
            const loc = u.location || 'Main Godown';
            acc[loc] = (acc[loc] || 0) + 1;
            return acc;
        }, {})).map(([loc, count]) => `
                    <span class="loc-pill" title="${loc}">${loc.split(' ')[0]}: ${count}</span>
                `).join('')}
            </div>
        </div>
    `).join('');
    initIcons();
}

function renderInventoryList(category, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;
    const prods = state.products.filter(p => p.category === category);
    container.innerHTML = prods.map(p => {
        const sns = (p.units || []).map(u => u.serialNumber).filter(s => s && s.trim());
        const snSummary = sns.length > 0 
            ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px; font-family:monospace;">SN: ${sns.length > 3 ? sns.slice(0, 3).join(', ') + '...' : sns.join(', ')}</div>`
            : '';
            
        return `
            <tr>
                <td>
                    <div style="font-weight:600;">${p.name}</div>
                    ${snSummary}
                </td>
                <td style="color:var(--text-muted);font-size:13px;">
                    ${Object.entries(p.specs || {}).filter(([k]) => k !== 'size' && k !== 'material').map(([k, v]) => `<span style="text-transform:capitalize;">${k}</span>: ${v}`).join(' | ')}
                </td>
                <td>
                    <span style="font-size:16px;font-weight:700;color:${p.stock <= (p.lowStockLimit || 10) ? 'var(--danger)' : 'var(--primary)'}">
                        ${p.stock} Units
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

export function renderRequests() {
    const tbody = document.getElementById('all-requests-table');
    if (!tbody) return;
    tbody.innerHTML = state.requests.map(r => `
        <tr>
            <td style="font-size:12px;color:var(--text-muted);">
                <strong>#${String(getId(r)).slice(-6)}</strong>
                ${r.customerName ? `<div style="font-size:13px;color:var(--primary);font-weight:600;margin-top:4px;">${r.customerName}</div>` : ''}
            </td>
            <td>${formatDate(r.date)}</td>
            <td style="font-size:13px;">${renderItemsSummary(r.items)}</td>
            <td>${r.source}</td>
            <td>${r.dest}</td>
            <td>
                <span class="status-pill status-${r.status}" style="display:inline-flex;align-items:center;gap:4px;">
                    <i data-lucide="${r.status === 'approved' ? 'check' : (r.status === 'rejected' ? 'x' : (r.status === 'returned' ? 'rotate-ccw' : 'clock'))}" size="12"></i>
                    ${r.status}
                </span>
            </td>
            <td>
                <div class="flex gap-2" style="justify-content:center;">
                    ${state.currentUser === 'admin' && r.status !== 'returned' ? `
                        <button class="glass-btn" style="padding:6px;color:var(--primary);" data-action="print" data-id="${getId(r)}" title="Print Challan">
                            <i data-lucide="printer" size="16"></i>
                        </button>
                    ` : ''}

                    ${state.currentUser === 'admin' && r.status === 'approved' ? `
                        <button class="glass-btn" style="padding:6px;color:var(--secondary);background:rgba(16,185,129,0.1);" data-action="return" data-id="${getId(r)}" title="Return Stock">
                            <i data-lucide="rotate-ccw" size="16"></i>
                        </button>
                    ` : ''}
                    
                    ${state.currentUser === 'transporter' && r.status === 'pending' ? `
                        <button class="glass-btn" style="padding:6px;background:rgba(16,185,129,0.2);color:#10b981;" data-action="approve" data-id="${getId(r)}" title="Accept">
                            <i data-lucide="check-circle" size="16"></i>
                        </button>
                        <button class="glass-btn" style="padding:6px;background:rgba(239,68,68,0.2);color:#ef4444;" data-action="reject" data-id="${getId(r)}" title="Reject">
                            <i data-lucide="x-circle" size="16"></i>
                        </button>
                    ` : ''}

                    ${state.currentUser === 'admin' && r.status === 'pending' ? `
                        <span style="font-size:11px;color:var(--text-muted);font-style:italic;">Waiting for Transporter</span>
                    ` : ''}

                    ${state.currentUser === 'admin' ? `
                        <button class="glass-btn" style="padding:6px;background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.2);" data-action="delete-request" data-id="${getId(r)}" title="Delete Challan">
                            <i data-lucide="trash-2" size="16"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
    initIcons();
}

function renderLogs() {
    const tbody = document.getElementById('logs-table');
    if (!tbody) return;
    tbody.innerHTML = state.logs.map(l => `
        <tr>
            <td style="color:var(--text-muted);font-size:12px;">${new Date(l.timestamp).toLocaleString()}</td>
            <td>${l.type}</td>
            <td>${l.item}</td>
            <td>${l.before}</td>
            <td class="${l.change >= 0 ? 'text-primary' : 'text-danger'}">${l.change > 0 ? '+' : ''}${l.change}</td>
            <td style="font-weight:600;">${l.after}</td>
            <td>${l.user}</td>
        </tr>
    `).join('');
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString();
}

function isToday(iso) {
    const d = new Date(iso);
    const today = new Date();
    return d.toDateString() === today.toDateString();
}
