#!/usr/bin/env node

const http = require('http');

const FRONTEND_PORT = Number(process.env.DOCTOR_FRONTEND_PORT || 5173);
const BACKEND_PORT = Number(process.env.DOCTOR_BACKEND_PORT || 5000);
const TIMEOUT_MS = Number(process.env.DOCTOR_TIMEOUT_MS || 2500);

const checks = [
  { name: 'backend-health', url: `http://localhost:${BACKEND_PORT}/api/health` },
  { name: 'proxy-stores', url: `http://localhost:${FRONTEND_PORT}/api/stores` },
  { name: 'proxy-alerts', url: `http://localhost:${FRONTEND_PORT}/api/alerts` },
  { name: 'proxy-orders', url: `http://localhost:${FRONTEND_PORT}/api/orders-list` },
  { name: 'proxy-purchases', url: `http://localhost:${FRONTEND_PORT}/api/purchases` },
  { name: 'proxy-transfers', url: `http://localhost:${FRONTEND_PORT}/api/transfers` },
];

function requestOnce(url) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const req = http.get(url, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode, latencyMs: Date.now() - startedAt, error: '' });
    });

    req.on('error', (err) => {
      resolve({ ok: false, statusCode: null, latencyMs: Date.now() - startedAt, error: err?.message || 'request failed' });
    });

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      resolve({ ok: false, statusCode: null, latencyMs: Date.now() - startedAt, error: `timeout ${TIMEOUT_MS}ms` });
    });
  });
}

async function run() {
  console.log('[dev-doctor] startup diagnostics begin');
  let failed = 0;

  for (const check of checks) {
    const result = await requestOnce(check.url);
    const status = result.statusCode == null ? 'n/a' : String(result.statusCode);
    const suffix = result.ok
      ? `status=${status}, latency=${result.latencyMs}ms`
      : `status=${status}, latency=${result.latencyMs}ms, error=${result.error || 'unknown'}`;

    if (result.ok) {
      console.log(`[dev-doctor] OK   ${check.name}: ${suffix}`);
    } else {
      failed += 1;
      console.log(`[dev-doctor] FAIL ${check.name}: ${suffix}`);
    }
  }

  if (failed > 0) {
    console.log(`[dev-doctor] completed with ${failed} failed check(s)`);
    process.exit(1);
  }

  console.log('[dev-doctor] all checks passed');
}

run().catch((err) => {
  console.log(`[dev-doctor] fatal: ${err?.message || err}`);
  process.exit(1);
});
