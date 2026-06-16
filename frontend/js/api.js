/**
 * api.js - All API calls to the backend
 * Includes retry logic, timeout handling, and keep-alive to prevent
 * Render free-tier cold-start "server offline" issues.
 */

// ─── API Configuration ───────────────────────────────────────────────────────

const getApiBase = () => {
    // 1. Check for manual override in localStorage
    const override = localStorage.getItem('SAPTHAGIRI_API_OVERRIDE');
    if (override) return override;

    const host = window.location.hostname;

    // 2. If running on localhost, 127.0.0.1, or opening as a local file (null/empty host)
    if (host === 'localhost' || host === '127.0.0.1' || !host) {
        return 'http://127.0.0.1:3001/api';
    }

    // 3. If running on a local network IP (192.168.x.x)
    if (/^192\.168\.\d+\.\d+$/.test(host)) {
        return `http://${host}:3001/api`;
    }

    // 4. Default to production (Vercel relative API path)
    return window.location.origin + '/api';
};

const API_BASE = getApiBase();
console.log(`🔌 API Base URL: ${API_BASE}`);

// ─── Retry & Timeout Configuration ───────────────────────────────────────────

const API_CONFIG = {
    maxRetries: 3,              // Number of retries on failure
    retryDelayMs: 1000,         // Base delay (doubles each retry)
    requestTimeoutMs: 15000,    // 15s timeout per request
    coldStartTimeoutMs: 45000,  // 45s timeout for cold-start wake-up
    keepAliveIntervalMs: 4 * 60 * 1000,  // Ping every 4 minutes to prevent Render sleep
    healthCheckRetries: 2,      // Retries specifically for health checks
};

// Track server state for smarter retry behavior
let _serverAwake = false;
let _keepAliveTimer = null;

// ─── Helper: Fetch with Timeout ──────────────────────────────────────────────

function fetchWithTimeout(url, options = {}, timeoutMs = API_CONFIG.requestTimeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
}

// ─── Helper: Sleep ───────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Headers ─────────────────────────────────────────────────────────────────

function getHeaders() {
    const role = window.state && window.state.currentUser ? window.state.currentUser.role : '';
    return {
        'Content-Type': 'application/json',
        'X-User-Role': role
    };
}

// ─── Core API Call with Retry + Timeout ──────────────────────────────────────

async function apiCall(method, path, body = null, retryCount = API_CONFIG.maxRetries) {
    const url = `${API_BASE}${path}`;
    const options = {
        method,
        headers: getHeaders()
    };
    if (body) options.body = JSON.stringify(body);

    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
            // Use longer timeout if server hasn't been confirmed awake yet
            const timeout = _serverAwake
                ? API_CONFIG.requestTimeoutMs
                : API_CONFIG.coldStartTimeoutMs;

            const res = await fetchWithTimeout(url, options, timeout);

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Unknown error' }));

                // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
                if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
                    throw new Error(err.message || `API Error: ${res.status}`);
                }

                throw new Error(err.message || `Server Error: ${res.status}`);
            }

            // Success — server is awake
            _serverAwake = true;
            return res.json();

        } catch (err) {
            lastError = err;

            // Identify retryable errors
            const isNetworkError = err.name === 'TypeError' && err.message.includes('fetch');
            const isAbortError = err.name === 'AbortError';
            const isServerError = err.message && /Server Error: 5\d\d/.test(err.message);

            const isRetryable = isNetworkError || isAbortError || isServerError;

            if (isRetryable && attempt < retryCount) {
                const delay = API_CONFIG.retryDelayMs * Math.pow(2, attempt);
                console.warn(`🔄 API retry ${attempt + 1}/${retryCount} for ${method} ${path} in ${delay}ms...`);
                await sleep(delay);
                continue;
            }

            // Non-retryable or exhausted retries — throw
            break;
        }
    }

    throw lastError;
}

// ─── Health Check (with its own retry logic) ─────────────────────────────────

async function checkServerHealth() {
    // Try multiple times before declaring offline
    for (let attempt = 0; attempt <= API_CONFIG.healthCheckRetries; attempt++) {
        try {
            const timeout = _serverAwake
                ? API_CONFIG.requestTimeoutMs
                : API_CONFIG.coldStartTimeoutMs;

            const res = await fetchWithTimeout(
                `${API_BASE}/health`,
                { method: 'GET', headers: getHeaders() },
                timeout
            );

            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                    _serverAwake = true;
                    return true;
                }
            }
        } catch (err) {
            console.warn(`📡 Health check attempt ${attempt + 1} failed:`, err.message);

            if (attempt < API_CONFIG.healthCheckRetries) {
                await sleep(API_CONFIG.retryDelayMs * Math.pow(2, attempt));
                continue;
            }
        }
    }

    _serverAwake = false;
    return false;
}

// ─── Keep-Alive Pinger (prevents Render free-tier cold starts) ───────────────

function startKeepAlive() {
    // Don't start multiple timers
    if (_keepAliveTimer) return;

    _keepAliveTimer = setInterval(async () => {
        try {
            await fetchWithTimeout(
                `${API_BASE}/health`,
                { method: 'GET' },
                10000
            );
            _serverAwake = true;
        } catch {
            // Silent fail — the periodic connection status check will handle UI
            console.warn('💤 Keep-alive ping failed (server may be sleeping)');
        }
    }, API_CONFIG.keepAliveIntervalMs);

    console.log('🏓 Keep-alive pinger started (every 4 minutes)');
}

function stopKeepAlive() {
    if (_keepAliveTimer) {
        clearInterval(_keepAliveTimer);
        _keepAliveTimer = null;
        console.log('🏓 Keep-alive pinger stopped');
    }
}

// ─── Wake Server (call on app init to pre-warm) ─────────────────────────────

async function wakeServer() {
    console.log('⏰ Waking up server...');
    try {
        const isOnline = await checkServerHealth();
        if (isOnline) {
            console.log('✅ Server is awake and responding');
            startKeepAlive();
            return true;
        }
    } catch {
        // Ignore
    }
    console.warn('⚠️ Server did not respond to wake-up');
    // Still start keep-alive so it keeps trying
    startKeepAlive();
    return false;
}

// ─── Settings (schemas + godowns) ─────────────────────────────────────────────

async function fetchSettings() {
    return apiCall('GET', '/settings');
}

async function saveSettings(settings) {
    return apiCall('PUT', '/settings', settings);
}

async function verifyAdminPassword(password) {
    return apiCall('POST', '/settings/verify-admin-password', { password }, 0);
}

async function verifyDeletePassword(password) {
    return apiCall('POST', '/settings/verify-delete-password', { password }, 0);
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
    checkServerHealth, wakeServer,
    startKeepAlive, stopKeepAlive,
    fetchSettings, saveSettings, verifyAdminPassword, verifyDeletePassword,
    fetchRetentionCount, triggerManualCleanup, fetchAuditLogs,
    fetchPipes, createPipe, updatePipe, deletePipeApi,
    fetchFittings, createFitting, updateFitting, deleteFittingApi,
    fetchMotors, createMotor, updateMotor, addMotorSerials, removeMotorSerial, deleteMotorApi,
    fetchChallans, createChallan, updateChallan, deleteChallanApi
};
