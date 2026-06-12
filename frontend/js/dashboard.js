/**
 * dashboard.js - Dashboard, Reports, Logs, Godown Management, Serial Search
 * Sri Sapthagiri Logistics Inventory System
 */

// ─── Dashboard Update ─────────────────────────────────────────────────────────

function updateDashboard() {
    if (document.getElementById('dashboardDate')) {
        document.getElementById('dashboardDate').textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    let totalMotors = 0, totalPipes = 0, totalFittings = 0, lowStockCount = 0;
    let lowStockAlerts = [];

    state.pipes.forEach(p => {
        if (p.stock) {
            Object.keys(p.stock).forEach(g => {
                if (currentGodownFilter !== 'all' && g !== currentGodownFilter) return;
                const godownStock = p.stock[g] || {};
                Object.entries(godownStock).forEach(([col, val]) => {
                    totalPipes += val;
                    const limit = (p.lowStockLimits && p.lowStockLimits[col] !== undefined)
                        ? p.lowStockLimits[col]
                        : (p.lowStockLimit !== undefined ? p.lowStockLimit : 20);
                    if (val < limit) {
                        lowStockCount++;
                        const unit = p.unit || "NO'S";
                        lowStockAlerts.push(`Pipe ${p.type} ${p.size} (${g} - ${col}) is low: ${val} ${unit}`);
                    }
                });
            });
        }
    });

    state.motors.forEach(m => {
        const activeSerials = currentGodownFilter === 'all'
            ? m.serials
            : m.serials.filter(s => s.godown && s.godown.toLowerCase() === currentGodownFilter.toLowerCase());
        const count = activeSerials.length;
        totalMotors += count;
        const limit = m.lowStockLimit !== undefined ? m.lowStockLimit : 5;
        if (count < limit) {
            lowStockCount++;
            const unit = m.unit || "NO'S";
            const godownText = currentGodownFilter === 'all' ? 'All Godowns' : currentGodownFilter;
            lowStockAlerts.push(`${m.hp} HP Motor (${m.phase}) in ${godownText} is low: ${count} ${unit}`);
        }
    });

    state.fittings.forEach(f => {
        if (f.stock) {
            Object.keys(f.stock).forEach(g => {
                if (currentGodownFilter !== 'all' && g !== currentGodownFilter) return;
                const godownStock = f.stock[g] || {};
                Object.entries(godownStock).forEach(([col, val]) => {
                    totalFittings += val;
                    const limit = (f.lowStockLimits && f.lowStockLimits[col] !== undefined)
                        ? f.lowStockLimits[col]
                        : (f.lowStockLimit !== undefined ? f.lowStockLimit : 10);
                    if (val < limit) {
                        lowStockCount++;
                        const unit = f.unit || "NO'S";
                        lowStockAlerts.push(`Fitting ${f.name} ${f.type} (${g} - ${col}) is low: ${val} ${unit}`);
                    }
                });
            });
        }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    let dispatchedToday = 0;
    state.challans.forEach(ch => {
        if (ch.status === 'approved' && ch.date === todayStr) {
            if (ch.items) ch.items.forEach(i => dispatchedToday += i.qty);
            else if (ch.qty) dispatchedToday += ch.qty;
        }
    });

    const totalItems = totalMotors + totalPipes + totalFittings;
    if (document.getElementById('dashTotalItems')) document.getElementById('dashTotalItems').textContent = totalItems;
    if (document.getElementById('dashLowStock')) document.getElementById('dashLowStock').textContent = lowStockCount;
    if (document.getElementById('dashPendingChallans')) {
        document.getElementById('dashPendingChallans').textContent = state.challans.filter(c => c.status === 'pending').length;
    }
    if (document.getElementById('dashTotalMotors')) document.getElementById('dashTotalMotors').textContent = totalMotors;
    if (document.getElementById('dashTotalPipes')) document.getElementById('dashTotalPipes').textContent = totalPipes;
    if (document.getElementById('dashTotalFittings')) document.getElementById('dashTotalFittings').textContent = totalFittings;
    if (document.getElementById('dashCriticalAlerts')) document.getElementById('dashCriticalAlerts').textContent = lowStockCount;
    if (document.getElementById('dashDispatchedToday')) document.getElementById('dashDispatchedToday').textContent = dispatchedToday;

    const alertCard = document.querySelector('.dashboard-stat-card.alert-card');
    if (alertCard) {
        alertCard.style.borderColor = lowStockCount > 0 ? '#ef4444' : 'var(--border)';
        alertCard.style.boxShadow = lowStockCount > 0 ? '0 0 10px rgba(239, 68, 68, 0.15)' : 'none';
    }

    const alertContainer = document.getElementById('lowStockAlertList');
    if (alertContainer) {
        alertContainer.innerHTML = lowStockAlerts.length === 0
            ? '<p class="text-muted">Stock levels are healthy.</p>'
            : lowStockAlerts.map(msg => `<div class="alert-item ${msg.includes(' 0') ? 'critical' : ''}">${msg}</div>`).join('');
    }

    const actContainer = document.getElementById('recentActivityList');
    if (actContainer) {
        const recentChallans = [...state.challans].reverse().slice(0, 5);
        actContainer.innerHTML = recentChallans.length === 0
            ? '<p class="text-muted">No recent activity.</p>'
            : recentChallans.map(ch => `
                <div style="padding: 1rem; border-left: 2px solid var(--border); position: relative; padding-left: 1.5rem; margin-left: 0.5rem; font-size: 0.92rem; transition: var(--transition);">
                    <div style="position: absolute; left: -6px; top: 1.25rem; width: 10px; height: 10px; border-radius: 50%; background: ${ch.status === 'pending' ? 'var(--warning)' : 'var(--success)'}; border: 2px solid white; box-shadow: 0 0 0 2px ${ch.status === 'pending' ? 'var(--warning-light)' : 'var(--success-light)'};"></div>
                    <div style="font-weight: 700; color: var(--text-dark); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <span>${ch.challanId || ch.id}</span>
                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">${ch.date}</span>
                    </div>
                    <div style="color: var(--text-muted); font-size: 0.88rem;">
                        ${ch.status === 'pending' ? 'Created by' : 'Approved by'} admin - <span style="font-weight: 600; color: var(--text-dark);">${ch.item || (ch.items && ch.items[0] ? ch.items[0].item : 'Multiple items')}</span>
                    </div>
                </div>
            `).join('');
    }

    // Dashboard inventory overviews
    const dashPipeBody = document.getElementById('dashPipeOverviewBody');
    if (dashPipeBody) {
        dashPipeBody.innerHTML = '';
        state.pipes.forEach(pipe => {
            const columns = state.pipeSchemas[pipe.type] || [];
            columns.forEach(col => {
                const val = getPipeStockVal(pipe, col, currentGodownFilter);
                const limit = (pipe.lowStockLimits && pipe.lowStockLimits[col] !== undefined)
                    ? pipe.lowStockLimits[col]
                    : (pipe.lowStockLimit !== undefined ? pipe.lowStockLimit : 20);
                const unit = pipe.unit || "NO'S";
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align: left;"><strong>${pipe.type} - ${pipe.size}</strong></td>
                    <td style="text-align: left;">${col}</td>
                    <td style="text-align: center;"><span class="badge ${val < limit ? 'badge-danger' : 'badge-success'}">${val} ${unit}</span></td>
                `;
                dashPipeBody.appendChild(tr);
            });
        });
    }

    const dashFittingBody = document.getElementById('dashFittingOverviewBody');
    if (dashFittingBody) {
        dashFittingBody.innerHTML = '';
        state.fittings.forEach(fitting => {
            const columns = state.fittingSchemas[fitting.type] || [];
            columns.forEach(col => {
                const val = getFittingStockVal(fitting, col, currentGodownFilter);
                const limit = (fitting.lowStockLimits && fitting.lowStockLimits[col] !== undefined)
                    ? fitting.lowStockLimits[col]
                    : (fitting.lowStockLimit !== undefined ? fitting.lowStockLimit : 10);
                const unit = fitting.unit || "NO'S";
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align: left;"><strong>${fitting.type} ${fitting.name}</strong></td>
                    <td style="text-align: left;">${col}</td>
                    <td style="text-align: center;"><span class="badge ${val < limit ? 'badge-danger' : 'badge-success'}">${val} ${unit}</span></td>
                `;
                dashFittingBody.appendChild(tr);
            });
        });
    }

    const dashMotorBody = document.getElementById('dashMotorOverviewBody');
    if (dashMotorBody) {
        dashMotorBody.innerHTML = '';
        state.motors.forEach(motor => {
            const activeSerials = currentGodownFilter === 'all'
                ? motor.serials
                : motor.serials.filter(s => s.godown && s.godown.toLowerCase() === currentGodownFilter.toLowerCase());
            const val = activeSerials.length;
            const limit = motor.lowStockLimit !== undefined ? motor.lowStockLimit : 5;
            const unit = motor.unit || "NO'S";
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: left;"><strong>CRI MOTOR - ${motor.hp} HP</strong></td>
                <td style="text-align: left;">${motor.type} (${motor.phase})</td>
                <td style="text-align: center;"><span class="badge ${val < limit ? 'badge-danger' : 'badge-success'}">${val} ${unit}</span></td>
            `;
            dashMotorBody.appendChild(tr);
        });
    }
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

function renderLogs() {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sortedChallans = [...state.challans].reverse();

    sortedChallans.forEach(ch => {
        let itemsSummary = ch.items ? ch.items.map(i => {
            const godownStr = i.godown ? `[${i.godown}] ` : '';
            const snStr = i.serial ? `(SN: ${i.serial})` : '';
            return `${i.sno}. ${godownStr}${i.item} ${snStr} (Qty: ${i.qty})`;
        }).join('<br>') : '';
        if (!ch.items && ch.item) itemsSummary = `1. ${ch.item} (Qty: ${ch.qty})`;

        const typeBadge = ch.type === 'Inward'
            ? `<span class="badge" style="background-color: var(--success); color: white;">INWARD</span>`
            : `<span class="badge" style="background-color: var(--warning); color: white;">OUTWARD</span>`;

        const displayId = ch.challanId || ch.id || ch._id;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${displayId}</strong></td>
            <td>${ch.date}</td>
            <td>${ch.customer}</td>
            <td>${typeBadge}</td>
            <td><div style="font-size:0.85em; white-space: nowrap;">${itemsSummary}</div></td>
            <td><span class="badge ${ch.status === 'pending' ? 'badge-pending' : 'badge-approved'}">${ch.status.toUpperCase()}</span></td>
            <td>${ch.createdBy}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

let currentTransportHistoryTab = 'Inward';

window.openCompleteStockReport = function () {
    const reportContentArea = document.getElementById('reportContentArea');
    const stockSection = document.getElementById('stockReportSection');
    const transportSection = document.getElementById('transportHistorySection');
    if (!reportContentArea || !stockSection || !transportSection) return;
    reportContentArea.classList.remove('hidden');
    stockSection.classList.remove('hidden');
    transportSection.classList.add('hidden');
    renderCompleteStockTable();
};

window.openTransportHistoryReport = function () {
    const reportContentArea = document.getElementById('reportContentArea');
    const stockSection = document.getElementById('stockReportSection');
    const transportSection = document.getElementById('transportHistorySection');
    if (!reportContentArea || !stockSection || !transportSection) return;
    reportContentArea.classList.remove('hidden');
    stockSection.classList.add('hidden');
    transportSection.classList.remove('hidden');
    renderTransportHistoryTable();
};

window.closeReport = function () {
    const reportContentArea = document.getElementById('reportContentArea');
    if (reportContentArea) reportContentArea.classList.add('hidden');
};

window.openTransportHistoryModal = function () {
    currentTransportHistoryTab = 'Inward';
    renderTransportHistory('Inward');
    openModal('transportHistoryModal');
};

window.renderTransportHistory = function (type) {
    currentTransportHistoryTab = type;
    document.getElementById('tabInwardHistory').classList.toggle('active', type === 'Inward');
    document.getElementById('tabOutwardHistory').classList.toggle('active', type === 'Outward');

    const tbody = document.getElementById('transportHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const history = state.challans.filter(c => c.status === 'approved' && (c.type || 'Outward') === type);

    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">No ${type.toLowerCase()} history found.</td></tr>`;
        return;
    }

    history.forEach(ch => {
        let summary = '';
        if (ch.items) {
            summary = ch.items.map(i => {
                const godownStr = i.godown ? `[${i.godown}] ` : '';
                const snStr = i.serial ? `(SN: ${i.serial})` : '';
                return `${godownStr}${i.item} ${snStr} (Qty: ${i.qty})`;
            }).join('<br>');
        } else if (ch.item) {
            summary = `${ch.item} (Qty: ${ch.qty})`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${ch.challanId || ch.id}</strong></td>
            <td>${ch.date}</td>
            <td>${ch.customer}</td>
            <td><div style="font-size:0.85em; max-height: 80px; overflow-y: auto;">${summary}</div></td>
        `;
        tbody.appendChild(tr);
    });
};

function renderCompleteStockTable() {
    const tbody = document.getElementById('stockReportTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const motorRows = state.motors.map(motor => {
        const locCounts = {};
        motor.serials.forEach(s => {
            const loc = s.godown ? s.godown.toUpperCase() : 'MAIN GODOWN';
            locCounts[loc] = (locCounts[loc] || 0) + 1;
        });
        const breakdownStr = Object.keys(locCounts).length > 0
            ? Object.entries(locCounts).map(([loc, count]) => `<span class="location-pill">${loc}: ${count}</span>`).join('')
            : `<span class="location-pill-empty">No stock breakdown</span>`;
        const totalStock = motor.serials.length;
        const totalStockClass = totalStock <= (motor.lowStockLimit || 5) ? 'stock-value-red' : '';
        const unit = motor.unit || "NO'S";
        return `
            <tr>
                <td><span class="badge-cri">CRI</span></td>
                <td style="font-weight: 600;">${motor.type || 'Motor'}</td>
                <td>${motor.hp || 'Standard'} / ${motor.phase || 'Single Phase'}</td>
                <td>${breakdownStr}</td>
                <td style="font-weight: 700; text-align: right;" class="${totalStockClass}">${totalStock} ${unit}</td>
            </tr>
        `;
    });

    const pipeRows = [];
    state.pipes.forEach(pipe => {
        const columns = state.pipeSchemas[pipe.type] || ["Stock"];
        columns.forEach(col => {
            let totalStock = 0;
            const locCounts = {};
            if (pipe.stock) {
                Object.keys(pipe.stock).forEach(g => {
                    const godownStock = pipe.stock[g] || {};
                    const val = godownStock[col] || 0;
                    if (val > 0) {
                        locCounts[g.toUpperCase()] = (locCounts[g.toUpperCase()] || 0) + val;
                        totalStock += val;
                    }
                });
            }
            const breakdownStr = Object.keys(locCounts).length > 0
                ? Object.entries(locCounts).map(([loc, count]) => `<span class="location-pill">${loc}: ${count}</span>`).join('')
                : `<span class="location-pill-empty">No stock breakdown</span>`;
            const limit = (pipe.lowStockLimits && pipe.lowStockLimits[col] !== undefined)
                ? pipe.lowStockLimits[col]
                : (pipe.lowStockLimit !== undefined ? pipe.lowStockLimit : 20);
            const totalStockClass = totalStock < limit ? 'stock-value-red' : '';
            const unit = pipe.unit || "NO'S";
            pipeRows.push(`
                <tr>
                    <td><span class="badge-supreme">Supreme</span></td>
                    <td style="font-weight: 600;">${pipe.type || 'Pipe'}</td>
                    <td>${pipe.size} (${col})</td>
                    <td>${breakdownStr}</td>
                    <td style="font-weight: 700; text-align: right;" class="${totalStockClass}">${totalStock} ${unit}</td>
                </tr>
            `);
        });
    });

    const fittingRows = [];
    state.fittings.forEach(fit => {
        const columns = state.fittingSchemas[fit.type] || ["Size"];
        columns.forEach(col => {
            let totalStock = 0;
            const locCounts = {};
            if (fit.stock) {
                Object.keys(fit.stock).forEach(g => {
                    const godownStock = fit.stock[g] || {};
                    const val = godownStock[col] || 0;
                    if (val > 0) {
                        locCounts[g.toUpperCase()] = (locCounts[g.toUpperCase()] || 0) + val;
                        totalStock += val;
                    }
                });
            }
            const breakdownStr = Object.keys(locCounts).length > 0
                ? Object.entries(locCounts).map(([loc, count]) => `<span class="location-pill">${loc}: ${count}</span>`).join('')
                : `<span class="location-pill-empty">No stock breakdown</span>`;
            const limit = (fit.lowStockLimits && fit.lowStockLimits[col] !== undefined)
                ? fit.lowStockLimits[col]
                : (fit.lowStockLimit !== undefined ? fit.lowStockLimit : 10);
            const totalStockClass = totalStock < limit ? 'stock-value-red' : '';
            const unit = fit.unit || "NO'S";
            fittingRows.push(`
                <tr>
                    <td><span class="badge-fittings">Fittings</span></td>
                    <td style="font-weight: 600;">${fit.name || 'Fitting'}</td>
                    <td>${fit.type || 'CPVC Fittings'} (${col})</td>
                    <td>${breakdownStr}</td>
                    <td style="font-weight: 700; text-align: right;" class="${totalStockClass}">${totalStock} ${unit}</td>
                </tr>
            `);
        });
    });

    tbody.innerHTML = [...motorRows, ...pipeRows, ...fittingRows].join('') ||
        '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No inventory records found.</td></tr>';
}

function renderTransportHistoryTable() {
    const tbody = document.getElementById('transportReportTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const approvedChallans = state.challans.filter(c => c.status === 'approved');
    if (approvedChallans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No approved transport history found.</td></tr>';
        return;
    }

    const sorted = [...approvedChallans].sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.map(ch => {
        let summaryStr = '', godownList = [];
        if (ch.items) {
            summaryStr = ch.items.map(i => `${i.item} (Qty: ${i.qty})`).join(', ');
            ch.items.forEach(i => { if (i.godown && !godownList.includes(i.godown)) godownList.push(i.godown); });
        } else if (ch.item) {
            summaryStr = `${ch.item} (Qty: ${ch.qty})`;
            if (ch.godown) godownList.push(ch.godown);
        }
        const typeBadgeClass = ch.type === 'Inward' ? 'badge-approved' : 'badge-pending';
        const typeLabel = ch.type || 'Outward';
        return `
            <tr>
                <td>${ch.date}</td>
                <td style="font-weight: 600;">${ch.challanId || ch.id}</td>
                <td><span class="badge ${typeBadgeClass}">${typeLabel.toUpperCase()}</span></td>
                <td>${ch.customer || '-'}</td>
                <td>${godownList.join(', ') || '-'}</td>
                <td style="font-size: 0.9rem;">${summaryStr}</td>
            </tr>
        `;
    }).join('');
}

window.generateReport = function (type, format) {
    if (format !== 'pdf') { alert(`Exporting ${type} as ${format} is not yet implemented.`); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Sri Sapthagiri Logistics", 14, 15);
    doc.setFontSize(12);

    if (type === 'challans' || type === 'challans_all') {
        let typeFilter = typeof currentTransportHistoryTab !== 'undefined' ? currentTransportHistoryTab : 'Outward';
        if (type === 'challans_all') typeFilter = 'All';
        let approvedChallans = state.challans.filter(c => c.status === 'approved');
        if (type !== 'challans_all') approvedChallans = approvedChallans.filter(c => (c.type || 'Outward') === typeFilter);
        doc.text(`${typeFilter} Transport History`, 14, 25);
        const tableRows = approvedChallans.map(ch => {
            let summary = ch.items ? ch.items.map(i => `${i.item} (Qty: ${i.qty})`).join('\n') : `${ch.item} (Qty: ${ch.qty})`;
            let godowns = ch.items ? [...new Set(ch.items.filter(i => i.godown).map(i => i.godown))] : [ch.godown].filter(Boolean);
            return [ch.challanId || ch.id, ch.type || 'Outward', ch.date, ch.customer, godowns.join(', ') || '-', summary];
        });
        doc.autoTable({ head: [["Challan No", "Type", "Date", "Party Name", "Godown", "Items Summary"]], body: tableRows, startY: 30, styles: { fontSize: 9 }, columnStyles: { 5: { cellWidth: 70 } } });
        doc.save(`${typeFilter}_Transport_History_${Date.now()}.pdf`);
    }
};

window.printReport = function () {
    const isStockVisible = !document.getElementById('stockReportSection').classList.contains('hidden');
    const reportTitle = isStockVisible ? 'Complete Stock Level Report' : 'Transport History Report';
    const sectionId = isStockVisible ? 'stockReportSection' : 'transportHistorySection';
    const reportContent = document.getElementById(sectionId).querySelector('.table-responsive').innerHTML;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>${reportTitle}</title>
    <style>body{font-family:'Inter',-apple-system,sans-serif;padding:30px;color:#0f172a;}h2{color:#0f172a;margin:0 0 5px 0;font-size:24px;}.subtitle{color:#64748b;font-size:13px;margin-bottom:25px;border-bottom:1px solid #e2e8f0;padding-bottom:15px;}table{width:100%;border-collapse:collapse;margin-top:15px;}th,td{border:1px solid #e2e8f0;padding:10px 12px;text-align:left;font-size:12px;}th{background-color:#f8fafc;font-weight:600;color:#475569;text-transform:uppercase;font-size:10px;letter-spacing:.05em;}tr:nth-child(even){background-color:#f8fafc;}.badge-cri{background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;}.badge-supreme{background:#475569;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;}.badge-fittings{background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;}.location-pill{background:rgba(37,99,235,.08);color:#2563eb;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;border:1px solid rgba(37,99,235,.15);margin-right:4px;display:inline-block;}.location-pill-empty{color:#94a3b8;font-style:italic;}.stock-value-red{color:#ef4444;font-weight:700;}.badge{padding:3px 6px;border-radius:4px;font-size:10px;font-weight:600;}.badge-approved{background:#d1fae5;color:#059669;}.badge-pending{background:#fef3c7;color:#d97706;}</style>
    </head><body onload="window.print();window.close();">
    <h2>Sri Sapthagiri Systems</h2>
    <div class="subtitle">Report: ${reportTitle} | Generated on: ${new Date().toLocaleString('en-IN')}</div>
    ${reportContent}</body></html>`);
    printWindow.document.close();
};

// ─── Godown Management ────────────────────────────────────────────────────────

window.openManageGodownsModal = function () {
    if (state.currentUser.role !== 'admin') { alert("Only admin users can manage godowns."); return; }
    openModal('manageGodownsModal');
    renderGodownsList();
};

window.selectGodownFilter = function (name) {
    currentGodownFilter = name;
    localStorage.setItem('sapthagiri_current_godown_filter', currentGodownFilter);
    renderGodownsList();
    renderPipes();
    renderFittings();
    renderMotors();
};

window.renderGodownsList = function () {
    const container = document.getElementById('godownsListContainer');
    if (!container) return;
    container.innerHTML = '';

    const globalDiv = document.createElement('div');
    const isGlobalSelected = currentGodownFilter === 'all';
    globalDiv.className = `godown-row ${isGlobalSelected ? 'selected' : ''}`;
    globalDiv.onclick = () => selectGodownFilter('all');
    globalDiv.innerHTML = `
        <span class="godown-name">All Godowns (Global Inventory)</span>
        ${isGlobalSelected ? '<i class="fa-solid fa-check check-icon"></i>' : '<i class="fa-solid fa-chevron-right chevron-icon"></i>'}
    `;
    container.appendChild(globalDiv);

    const godowns = state.godowns || ['Main Godown', 'Shop', 'Godown 3'];
    godowns.forEach(g => {
        const div = document.createElement('div');
        const isSelected = currentGodownFilter === g;
        div.className = `godown-row ${isSelected ? 'selected' : ''}`;
        div.onclick = () => selectGodownFilter(g);
        div.innerHTML = `
            <span class="godown-name">${g}</span>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                ${isSelected ? '<i class="fa-solid fa-check check-icon"></i>' : '<i class="fa-solid fa-chevron-right chevron-icon"></i>'}
                <button class="btn-delete-godown" onclick="event.stopPropagation(); deleteGodown('${g}');" title="Delete Location">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
};

window.deleteGodown = function (name) {
    if (state.currentUser.role !== 'admin') { alert("Only admin users can delete godowns."); return; }
    const motorInUse = state.motors.some(m => m.serials && m.serials.some(s => s.godown === name));
    if (motorInUse) { alert(`Cannot delete godown "${name}" because it currently has motor serials assigned to it.`); return; }
    if (state.godowns.length <= 1) { alert("You must have at least one godown in the system."); return; }

    if (confirm(`Are you sure you want to delete the godown "${name}"?`)) {
        state.godowns = state.godowns.filter(g => g !== name);
        state.pipes.forEach(p => { if (p.stock && p.stock[name]) delete p.stock[name]; });
        state.fittings.forEach(f => { if (f.stock && f.stock[name]) delete f.stock[name]; });
        if (currentGodownFilter === name) {
            currentGodownFilter = 'all';
            localStorage.setItem('sapthagiri_current_godown_filter', 'all');
        }

        API.saveSettings({ godowns: state.godowns }).then(() => {
            saveState();
            populateGodownDropdowns();
            renderGodownsList();
            renderPipes();
            renderFittings();
            renderMotors();
        }).catch(err => alert('Error deleting godown: ' + err.message));
    }
};

document.getElementById('addGodownForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newGodownName').value.trim();
    if (!name) return;

    if (state.godowns.some(g => g.toLowerCase() === name.toLowerCase())) {
        alert("A godown with this name already exists.");
        return;
    }

    state.godowns.push(name);
    state.pipes.forEach(p => { if (!p.stock) p.stock = {}; if (!p.stock[name]) p.stock[name] = {}; });
    state.fittings.forEach(f => { if (!f.stock) f.stock = {}; if (!f.stock[name]) f.stock[name] = {}; });

    try {
        await API.saveSettings({ godowns: state.godowns });
        saveState();
        populateGodownDropdowns();
        renderGodownsList();
        renderPipes();
        renderFittings();
        renderMotors();
        document.getElementById('newGodownName').value = '';
    } catch (err) {
        alert('Error adding godown: ' + err.message);
    }
});

// ─── Serial Number Search ─────────────────────────────────────────────────────

function setupSerialSearch() {
    const searchInput = document.getElementById('serial-search-input');
    const searchBtn = document.getElementById('btn-serial-search');
    const searchResults = document.getElementById('serial-search-results');

    if (!searchBtn || !searchInput || !searchResults) return;
    if (searchBtn.dataset.listenerAttached) return;
    searchBtn.dataset.listenerAttached = 'true';

    searchBtn.addEventListener('click', performSerialSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSerialSearch(); });

    function performSerialSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) { searchResults.style.display = 'none'; searchResults.innerHTML = ''; return; }

        let found = [];
        state.motors.forEach(m => {
            if (m.serials) {
                m.serials.forEach(s => {
                    if (s.sn && s.sn.toLowerCase().includes(query)) {
                        found.push({ sn: s.sn, godown: s.godown || 'Main Godown', motorType: m.type, motorHp: m.hp, motorPhase: m.phase });
                    }
                });
            }
        });

        searchResults.style.display = 'block';
        searchResults.innerHTML = found.length === 0
            ? `<div style="color: var(--danger); font-size: 0.9rem; margin-top: 0.5rem; font-weight: 500; text-align: left;">Search failed: Serial not found</div>`
            : found.map(item => `
                <div style="background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 8px; padding: 12px; font-size: 0.9rem; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: 700; color: #16a34a; font-size: 0.95rem;">✅ Serial Number: ${item.sn}</span>
                        <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">Motor: ${item.motorType} (${item.motorHp} HP, ${item.motorPhase})</div>
                    </div>
                    <div style="background: rgba(37, 99, 235, 0.08); color: var(--primary); font-weight: 600; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem;">📍 Location: ${item.godown.toUpperCase()}</div>
                </div>
            `).join('');
    }
}

// Expose
window.updateDashboard = updateDashboard;
window.renderLogs = renderLogs;
window.setupSerialSearch = setupSerialSearch;
