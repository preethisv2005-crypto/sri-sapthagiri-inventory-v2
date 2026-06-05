/**
 * api.js - All API calls to the backend
 * Sri Sapthagiri Logistics Inventory System
 *
 * Base URL: http://localhost:5000/api
 * All requests include X-User-Role header for auth.
 */

const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api' 
    : 'https://sapthagiri-api.onrender.com/api';  // ← Update this after deploying backend on Render

// ─── Helper ───────────────────────────────────────────────────────────────────

function getHeaders() {
    const role = window.state && window.state.currentUser ? window.state.currentUser.role : '';
    return {
        'Content-Type': 'application/json',
        'X-User-Role': role
    };
}

async function apiCall(method, path, body = null) {
    const options = {
        method,
        headers: getHeaders()
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || `API Error: ${res.status}`);
    }
    return res.json();
}

// ─── Health Check ─────────────────────────────────────────────────────────────

async function checkServerHealth() {
    try {
        const data = await apiCall('GET', '/health');
        return data.status === 'ok';
    } catch {
        return false;
    }
}

// ─── Settings (schemas + godowns) ─────────────────────────────────────────────

async function fetchSettings() {
    return apiCall('GET', '/settings');
}

async function saveSettings(settings) {
    return apiCall('PUT', '/settings', settings);
}

// ─── Pipes ────────────────────────────────────────────────────────────────────

async function fetchPipes() {
    return apiCall('GET', '/pipes');
}

async function createPipe(pipeData) {
    return apiCall('POST', '/pipes', pipeData);
}

async function updatePipe(id, data) {
    return apiCall('PUT', `/pipes/${id}`, data);
}

async function deletePipeApi(id) {
    return apiCall('DELETE', `/pipes/${id}`);
}

// ─── Fittings ─────────────────────────────────────────────────────────────────

async function fetchFittings() {
    return apiCall('GET', '/fittings');
}

async function createFitting(fittingData) {
    return apiCall('POST', '/fittings', fittingData);
}

async function updateFitting(id, data) {
    return apiCall('PUT', `/fittings/${id}`, data);
}

async function deleteFittingApi(id) {
    return apiCall('DELETE', `/fittings/${id}`);
}

// ─── Motors ───────────────────────────────────────────────────────────────────

async function fetchMotors() {
    return apiCall('GET', '/motors');
}

async function createMotor(motorData) {
    return apiCall('POST', '/motors', motorData);
}

async function updateMotor(id, data) {
    return apiCall('PUT', `/motors/${id}`, data);
}

async function addMotorSerials(id, serials, godown) {
    return apiCall('POST', `/motors/${id}/serials`, { serials, godown });
}

async function removeMotorSerial(motorId, sn) {
    return apiCall('DELETE', `/motors/${motorId}/serials/${encodeURIComponent(sn)}`);
}

async function deleteMotorApi(id) {
    return apiCall('DELETE', `/motors/${id}`);
}

// ─── Challans ─────────────────────────────────────────────────────────────────

async function fetchChallans() {
    return apiCall('GET', '/challans');
}

async function createChallan(challanData) {
    return apiCall('POST', '/challans', challanData);
}

async function updateChallan(id, data) {
    return apiCall('PUT', `/challans/${id}`, data);
}

async function deleteChallanApi(id) {
    return apiCall('DELETE', `/challans/${id}`);
}

// ─── Data Retention and Audit Log APIs ─────────────────────────────────────────

async function fetchRetentionCount() {
    return apiCall('GET', '/settings/retention-count');
}

async function triggerManualCleanup() {
    return apiCall('POST', '/settings/cleanup');
}

async function fetchAuditLogs() {
    return apiCall('GET', '/settings/audit-logs');
}

// ─── Expose to window ─────────────────────────────────────────────────────────

window.API = {
    checkServerHealth,
    fetchSettings, saveSettings,
    fetchRetentionCount, triggerManualCleanup, fetchAuditLogs,
    fetchPipes, createPipe, updatePipe, deletePipeApi,
    fetchFittings, createFitting, updateFitting, deleteFittingApi,
    fetchMotors, createMotor, updateMotor, addMotorSerials, removeMotorSerial, deleteMotorApi,
    fetchChallans, createChallan, updateChallan, deleteChallanApi
};
