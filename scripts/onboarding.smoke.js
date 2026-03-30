const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const METRICS_REQUIRE_AUTH = /^(1|true|yes|on)$/i.test(String(process.env.METRICS_REQUIRE_AUTH || '').trim());
const METRICS_AUTH_TOKEN = String(process.env.METRICS_AUTH_TOKEN || '').trim();

const nowIso = () => new Date().toISOString();

const toBodySnippet = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 280);

const requestJson = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  const text = await response.text();

  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = null;
  }

  return {
    url,
    status: Number(response.status || 0),
    ok: response.ok,
    text,
    body
  };
};

const run = async () => {
  const report = {
    timestamp: nowIso(),
    baseUrl: BASE_URL,
    checks: [],
    pass: true
  };

  const addResult = (name, passed, details) => {
    report.checks.push({ name, passed, details });
    if (!passed) {
      report.pass = false;
    }
  };

  try {
    const health = await requestJson('/api/health');
    const healthDbConnected = Boolean(health.body?.dbConnected);
    addResult('health_endpoint', health.ok && healthDbConnected, {
      status: health.status,
      url: health.url,
      dbConnected: healthDbConnected,
      bodySnippet: toBodySnippet(health.text)
    });

    const metricsHeaders = {};
    if (METRICS_REQUIRE_AUTH && METRICS_AUTH_TOKEN) {
      metricsHeaders.Authorization = `Bearer ${METRICS_AUTH_TOKEN}`;
    }

    const metrics = await requestJson('/api/metrics', {
      method: 'GET',
      headers: metricsHeaders
    });

    const metricsSchemaOk = Boolean(
      metrics.body
      && metrics.body.success === true
      && metrics.body.data
      && metrics.body.data.totals
      && metrics.body.data.thresholds
    );

    addResult('metrics_endpoint', metrics.ok && metricsSchemaOk, {
      status: metrics.status,
      url: metrics.url,
      authMode: METRICS_REQUIRE_AUTH ? 'token_required' : 'open',
      bodySnippet: toBodySnippet(metrics.text)
    });

    const perfGuard = await requestJson('/api/metrics');
    const p95 = Number(perfGuard.body?.data?.totals?.p95Ms || 0);
    const p95Threshold = Number(process.env.P95_THRESHOLD_MS || 250);
    const p95Ok = p95 <= p95Threshold;

    addResult('latency_threshold_snapshot', p95Ok, {
      p95Ms: p95,
      thresholdMs: p95Threshold
    });
  } catch (error) {
    addResult('onboarding_smoke_runtime', false, {
      error: error.message
    });
  }

  console.log('Onboarding Smoke Report:');
  console.log(JSON.stringify(report, null, 2));

  if (!report.pass) {
    process.exitCode = 1;
  }
};

run();
