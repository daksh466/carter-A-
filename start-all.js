// Deterministic dev launcher: cleans stale ports and starts backend + frontend once.

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const isWindows = process.platform === 'win32';
const rootDir = __dirname;
const backendCwd = path.join(rootDir, 'backend');
const frontendCwd = path.join(rootDir, 'frontend');
const viteCliPath = path.join(frontendCwd, 'node_modules', 'vite', 'bin', 'vite.js');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;
const FRONTEND_CLEANUP_PORTS = [5173, 5174, 5175, 3000, 3001, 3002, 3003, 3004, 3005];

const HEALTH_POLL_TIMEOUT_MS = Number(process.env.DEV_BACKEND_HEALTH_TIMEOUT_MS || 1500);
const HEALTH_READY_ATTEMPTS = Number(process.env.DEV_BACKEND_READY_ATTEMPTS || 40);
const HEALTH_READY_INTERVAL_MS = Number(process.env.DEV_BACKEND_READY_INTERVAL_MS || 500);

const services = {};
let shuttingDown = false;
const startupState = {
  phase: 'init',
  startedAt: Date.now(),
  lastHealthError: '',
  lastHealthStatus: null,
  lastHealthLatencyMs: null,
  healthAttempts: 0,
};

function log(message) {
  console.log(`[dev-manager] ${message}`);
}

function logPhase(phase, message) {
  startupState.phase = phase;
  log(`[${phase}] ${message}`);
}

function runStopPorts(ports = []) {
  const validPorts = ports
    .map((port) => Number(port))
    .filter((port) => Number.isInteger(port) && port > 0)
    .map((port) => String(port));

  if (validPorts.length === 0) {
    return;
  }

  try {
    execSync(`node scripts/kill-ports.js ${validPorts.join(' ')}`, {
      cwd: rootDir,
      stdio: 'inherit'
    });
  } catch (_) {
    // Best effort cleanup only.
  }
}

function startService(name, command, args, cwd) {
  logPhase(`${name}-spawn`, `starting ${name}...`);

  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env
  });

  services[name] = child;

  child.on('error', (err) => {
    log(`${name} failed to start: ${err.message}`);
    shutdown(1);
  });

  child.on('close', (code, signal) => {
    services[name] = null;
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    log(`${name} stopped (${reason}). shutting down all services.`);
    shutdown(code || 1);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pingBackendHealth({ requestTimeoutMs = HEALTH_POLL_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const req = http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
      res.resume();
      resolve({
        ok: res.statusCode >= 200 && res.statusCode < 500,
        statusCode: res.statusCode,
        error: '',
        latencyMs: Date.now() - startedAt,
      });
    });

    req.on('error', (err) => resolve({
      ok: false,
      statusCode: null,
      error: err?.message || 'health request error',
      latencyMs: Date.now() - startedAt,
    }));

    req.setTimeout(requestTimeoutMs, () => {
      req.destroy();
      resolve({
        ok: false,
        statusCode: null,
        error: `health timeout after ${requestTimeoutMs}ms`,
        latencyMs: Date.now() - startedAt,
      });
    });
  });
}

async function waitForBackendReady({
  attempts = HEALTH_READY_ATTEMPTS,
  intervalMs = HEALTH_READY_INTERVAL_MS,
  probe = pingBackendHealth,
  requireBackendProcess = true,
} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    if (shuttingDown) {
      return false;
    }
    // Exit early if backend process died before becoming healthy.
    if (requireBackendProcess && !services.backend) {
      return false;
    }
    const health = await probe();
    startupState.healthAttempts = i + 1;
    startupState.lastHealthError = health?.error || '';
    startupState.lastHealthStatus = Number.isInteger(health?.statusCode) ? health.statusCode : null;
    startupState.lastHealthLatencyMs = Number.isFinite(health?.latencyMs) ? health.latencyMs : null;

    if (health?.ok) {
      logPhase('backend-ready', `health check passed on attempt ${i + 1}/${attempts} (${startupState.lastHealthLatencyMs}ms)`);
      return true;
    }

    const failureHint = startupState.lastHealthError || `status=${startupState.lastHealthStatus || 'n/a'}`;
    logPhase('backend-wait', `health check ${i + 1}/${attempts} failed (${failureHint})`);
    await sleep(intervalMs);
  }
  return false;
}

function buildStartupDiagnostics() {
  const elapsedMs = Date.now() - startupState.startedAt;
  const parts = [
    `phase=${startupState.phase}`,
    `elapsedMs=${elapsedMs}`,
    `healthAttempts=${startupState.healthAttempts}`,
    `lastHealthStatus=${startupState.lastHealthStatus ?? 'n/a'}`,
    `lastHealthLatencyMs=${startupState.lastHealthLatencyMs ?? 'n/a'}`,
    `lastHealthError=${startupState.lastHealthError || 'n/a'}`,
  ];
  return parts.join(', ');
}

function stopChild(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    if (isWindows) {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false
      });
    } else {
      child.kill('SIGTERM');
    }
  } catch (_) {
    // Ignore shutdown errors.
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  log('shutting down backend and frontend...');
  stopChild(services.backend);
  stopChild(services.frontend);

  setTimeout(() => process.exit(exitCode), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function runDevManager() {
  startupState.startedAt = Date.now();
  log('===== Carter CRM Dev Manager Started =====');
  logPhase('cleanup', 'cleaning previous dev listeners...');
  runStopPorts([...FRONTEND_CLEANUP_PORTS, BACKEND_PORT]);

  startService('backend', process.execPath, ['server.js'], backendCwd);

  const ready = await waitForBackendReady();
  if (!ready) {
    logPhase('startup-failed', `backend did not become healthy on http://localhost:${BACKEND_PORT} in time.`);
    log(`startup diagnostics: ${buildStartupDiagnostics()}`);
    shutdown(1);
    return;
  }

  startService('frontend', process.execPath, [viteCliPath, '--port', String(FRONTEND_PORT), '--strictPort'], frontendCwd);

  logPhase('ready', `Backend API: http://localhost:${BACKEND_PORT}`);
  logPhase('ready', `Frontend (hot reload): http://localhost:${FRONTEND_PORT}`);
}

if (require.main === module) {
  runDevManager().catch((err) => {
    logPhase('startup-failed', err?.message || 'unhandled startup error');
    log(`startup diagnostics: ${buildStartupDiagnostics()}`);
    shutdown(1);
  });
}

module.exports = {
  runDevManager,
  waitForBackendReady,
  pingBackendHealth,
  buildStartupDiagnostics,
};
