/**
 * motors.js - Motor Inventory Module
 * Sri Sapthagiri Logistics Inventory System
 */

// ─── Render ───────────────────────────────────────────────────────────────────

function renderMotors() {
    const titleEl = document.getElementById('motorsViewTitle');
    if (titleEl) {
        const godownText = currentGodownFilter === 'all' ? 'Global' : currentGodownFilter;
        titleEl.textContent = `Motors Inventory (${godownText})`;
    }

    const container = document.getElementById('motorsList');
    container.innerHTML = '';

    const activeGodowns = currentGodownFilter === 'all'
        ? (state.godowns || ['Main Godown', 'Shop', 'Godown 3'])
        : [currentGodownFilter];

    state.motors.forEach(motor => {
        const card = document.createElement('div');
        card.className = 'motor-card-premium';
        const motorId = motor._id || motor.id;

        let locationsHtml = '';
        activeGodowns.forEach(g => {
            const sns = motor.serials.filter(item => item.godown === g).map(item => item.sn);
            const qty = sns.length;

            let serialsBoxHtml = '';
            if (qty === 0) {
                serialsBoxHtml = `
                    <div style="border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 1.5rem; background: #f8fafc; text-align: center; color: #64748b; font-style: italic; font-size: 0.95rem; width: 100%;">
                        No serials available for this motor.
                    </div>
                `;
            } else {
                serialsBoxHtml = `
                    <div class="motor-serials-list">
                        ${sns.map(sn => `
                            <div class="motor-serial-row">
                                <span class="motor-serial-number">${sn}</span>
                                <span class="motor-serial-status">In Stock</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            locationsHtml += `
                <div class="motor-location-panel" style="margin-bottom: 1.5rem;">
                    <div class="motor-location-header" style="font-size: 1rem; font-weight: 700; color: #2563eb; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-warehouse" style="color: #2563eb;"></i>
                        <span>${g} (Qty: ${qty})</span>
                    </div>
                    ${serialsBoxHtml}
                </div>
            `;
        });

        const activeSerials = currentGodownFilter === 'all'
            ? motor.serials
            : motor.serials.filter(item => item.godown === currentGodownFilter);
        const totalQty = activeSerials.length;

        card.innerHTML = `
            <div class="motor-card-header" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
                <div class="motor-card-title-area" style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div class="motor-card-title" style="font-size: 1.25rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                        <i class="fa-solid fa-bolt" style="color: #3b82f6;"></i>
                        <span>${motor.type}</span>
                    </div>
                    <div class="motor-card-subtitle" style="font-size: 0.9rem; color: #64748b; font-weight: 500; margin-left: 1.5rem;">
                        Type: ${motor.hp} | Phase: ${motor.phase}
                    </div>
                </div>
                <div class="motor-card-qty" style="font-weight: 700; color: #0f172a; font-size: 1rem;">Total Qty: ${totalQty}</div>
            </div>
            <div class="motor-card-body" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem;">
                <div class="motor-card-locations" style="flex: 1;">
                    ${locationsHtml}
                </div>
                <div class="motor-card-actions admin-only" style="display: flex; flex-direction: column; gap: 0.75rem; width: 160px; flex-shrink: 0;">
                    <button class="btn-outline-pill" onclick="openAddSerialModal('${motorId}')">Add Serials</button>
                    <button class="btn-outline-pill danger" onclick="removeSerial('${motorId}')">Remove Serial</button>
                    <button class="btn-outline-pill" onclick="openEditMotorModal('${motorId}')">Edit Motor</button>
                    <button class="btn-outline-pill danger" onclick="deleteMotor('${motorId}')">Delete Motor</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = state.currentUser.role === 'admin' ? '' : 'none';
    });
}

// ─── Modal Handlers ───────────────────────────────────────────────────────────

window.openAddSerialModal = function (motorId) {
    document.getElementById('addSerialMotorId').value = motorId;
    document.getElementById('addSerialInput').value = '';
    openModal('addSerialModal');
    setTimeout(() => document.getElementById('addSerialInput').focus(), 50);
};

window.openEditMotorModal = function (motorId) {
    const motor = state.motors.find(m => (m._id || m.id) === motorId);
    if (!motor) return;
    document.getElementById('editMotorId').value = motorId;
    document.getElementById('editMotorName').value = motor.type;
    document.getElementById('editMotorHp').value = motor.hp;
    const phaseSelect = document.getElementById('editMotorPhase');
    if (phaseSelect) phaseSelect.value = motor.phase;
    document.getElementById('editMotorLimit').value = motor.lowStockLimit || 5;
    openModal('editMotorModal');
};

window.removeSerial = function (motorId) {
    const motor = state.motors.find(m => (m._id || m.id) === motorId);
    if (!motor) return;

    if (motor.serials.length === 0) { alert("No serials to remove."); return; }

    const container = document.getElementById('motorsList');
    const card = container.querySelector(`[data-motor-id="${motorId}"]`) || container.children[state.motors.indexOf(motor)];

    const snToRemove = prompt("Enter the serial number to remove:");
    if (!snToRemove) return;

    const exists = motor.serials.find(s => s.sn === snToRemove.trim());
    if (!exists) { alert(`Serial "${snToRemove}" not found.`); return; }

    if (confirm(`Remove serial "${snToRemove.trim()}" from ${motor.type}?`)) {
        API.removeMotorSerial(motorId, snToRemove.trim()).then(updated => {
            const idx = state.motors.findIndex(m => (m._id || m.id) === motorId);
            if (idx !== -1) state.motors[idx] = updated;
            saveState();
            renderMotors();
        }).catch(err => alert('Error removing serial: ' + err.message));
    }
};

// ─── Form Handlers ────────────────────────────────────────────────────────────

document.getElementById('motorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hp = document.getElementById('motorHp').value.trim();
    const phase = document.getElementById('motorPhase').value;
    const type = document.getElementById('motorName').value.trim();
    const limit = parseInt(document.getElementById('motorLimit').value, 10) || 10;

    try {
        const newMotor = await API.createMotor({ type, hp, phase, lowStockLimit: limit });
        state.motors.push(newMotor);
        saveState();
        renderMotors();
        closeModal('motorModal');
        e.target.reset();
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById('addSerialForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motorId = document.getElementById('addSerialMotorId').value;
    const godown = document.getElementById('motorGodown').value;
    const rawInput = document.getElementById('addSerialInput').value;

    const serials = rawInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
    if (serials.length === 0) { alert("Please enter at least one serial number."); return; }

    try {
        const updatedMotor = await API.addMotorSerials(motorId, serials, godown);
        const idx = state.motors.findIndex(m => (m._id || m.id) === motorId);
        if (idx !== -1) state.motors[idx] = updatedMotor;
        saveState();
        renderMotors();
        closeModal('addSerialModal');
        e.target.reset();
    } catch (err) {
        alert('Error adding serials: ' + err.message);
    }
});

document.getElementById('editMotorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motorId = document.getElementById('editMotorId').value;
    const type = document.getElementById('editMotorName').value.trim();
    const hp = document.getElementById('editMotorHp').value.trim();
    const phase = document.getElementById('editMotorPhase').value;
    const limit = parseInt(document.getElementById('editMotorLimit').value, 10) || 5;

    try {
        const updatedMotor = await API.updateMotor(motorId, { type, hp, phase, lowStockLimit: limit });
        const idx = state.motors.findIndex(m => (m._id || m.id) === motorId);
        if (idx !== -1) state.motors[idx] = updatedMotor;
        saveState();
        renderMotors();
        closeModal('editMotorModal');
    } catch (err) {
        alert('Error updating motor: ' + err.message);
    }
});

window.deleteMotor = function (id) {
    if (state.currentUser.role !== 'admin') { alert("Only admin users can delete motors."); return; }
    const motor = state.motors.find(m => (m._id || m.id) === id);
    if (!motor) return;
    if (confirm(`Are you sure you want to delete the motor "${motor.hp} HP ${motor.type} (${motor.phase})" and all its serials?`)) {
        API.deleteMotorApi(id).then(() => {
            state.motors = state.motors.filter(m => (m._id || m.id) !== id);
            saveState();
            renderMotors();
            updateDashboard();
        }).catch(err => alert('Error deleting motor: ' + err.message));
    }
};

// Expose
window.renderMotors = renderMotors;
