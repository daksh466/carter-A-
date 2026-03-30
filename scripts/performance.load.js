const { performance } = require('perf_hooks');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 20));
const DURATION_SECONDS = Math.max(10, Math.min(20, Number(process.env.DURATION_SECONDS || 12)));
const AUTH_TOKEN = String(process.env.AUTH_TOKEN || '').trim();
const P95_THRESHOLD_MS = Math.max(1, Number(process.env.P95_THRESHOLD_MS || 250));
const PREFLIGHT_RETRIES = Math.max(1, Number(process.env.PREFLIGHT_RETRIES || 20));
const PREFLIGHT_RETRY_DELAY_MS = Math.max(100, Number(process.env.PREFLIGHT_RETRY_DELAY_MS || 500));
const ENDPOINT_CANDIDATES = [
  ['/api/transfers', '/api/spares'],
  ['/api/transfers', '/api/spareparts']
];
const ERROR_SAMPLE_LIMIT = 5;

const withQuery = (endpoint, query) => {
  if (!query) return endpoint;
  return endpoint.includes('?') ? `${endpoint}&${query}` : `${endpoint}?${query}`;
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
};

const toSnippet = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 220);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeHeaders = () => {
  const headers = { Accept: 'application/json' };
  if (AUTH_TOKEN) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
};

const requestEndpoint = async (endpoint) => {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: makeHeaders()
    });

    const bodyText = await response.text();
    return {
      endpoint,
      ok: response.ok,
      status: Number(response.status || 0),
      bodySnippet: toSnippet(bodyText)
    };
  } catch (error) {
    return {
      endpoint,
      ok: false,
      status: 'NETWORK_ERROR',
      bodySnippet: toSnippet(error.message)
    };
  }
};

const extractStoreIdFromBodySnippet = (bodySnippet) => {
  const match = String(bodySnippet || '').match(/"store_id"\s*:\s*"([^"]+)"/i);
  return match?.[1] || '';
};

const resolveWorkingEndpoints = async () => {
  let latestHealthCheck = { status: 'UNKNOWN' };
  let latestCandidateResults = [];

  for (let attempt = 1; attempt <= PREFLIGHT_RETRIES; attempt += 1) {
    latestHealthCheck = await requestEndpoint('/api/health');

    const candidateResults = [];
    for (const candidate of ENDPOINT_CANDIDATES) {
      const checks = await Promise.all(candidate.map((endpoint) => requestEndpoint(endpoint)));
      candidateResults.push({ endpoints: candidate, checks });
    }
    latestCandidateResults = candidateResults;

    const working = candidateResults.find((entry) => entry.checks.every((check) => check.ok));
    if (working) {
      const optimizedEndpoints = working.endpoints.map((endpoint) => {
        if (endpoint.startsWith('/api/transfers')) {
          return withQuery(endpoint, 'limit=25');
        }

        if (endpoint.startsWith('/api/spares')) {
          const spareCheck = working.checks.find((check) => check.endpoint === endpoint);
          const inferredStoreId = extractStoreIdFromBodySnippet(spareCheck?.bodySnippet);
          if (inferredStoreId) {
            return withQuery(endpoint, `storeId=${encodeURIComponent(inferredStoreId)}`);
          }
        }

        return endpoint;
      });

      return {
        healthCheck: latestHealthCheck,
        endpoints: optimizedEndpoints,
        preflight: working.checks,
        diagnostics: candidateResults,
        attemptsUsed: attempt
      };
    }

    if (attempt < PREFLIGHT_RETRIES) {
      await sleep(PREFLIGHT_RETRY_DELAY_MS);
    }
  }

  const hasUnauthorized = latestCandidateResults
    .flatMap((entry) => entry.checks)
    .some((check) => check.status === 401);

  if (hasUnauthorized && !AUTH_TOKEN) {
    const unauthorized = latestCandidateResults
      .flatMap((entry) => entry.checks)
      .filter((check) => check.status === 401)
      .slice(0, ERROR_SAMPLE_LIMIT)
      .map((check) => `${check.endpoint} -> ${check.status} (${check.bodySnippet || 'no body'})`)
      .join('; ');

    throw new Error(`Preflight failed with 401 Unauthorized. Set AUTH_TOKEN. Samples: ${unauthorized}`);
  }

  const summary = latestCandidateResults
    .map((entry) => entry.checks.map((check) => `${check.endpoint} -> ${check.status}`).join(', '))
    .join(' | ');
  const sampleBodies = latestCandidateResults
    .flatMap((entry) => entry.checks)
    .filter((check) => !check.ok)
    .slice(0, ERROR_SAMPLE_LIMIT)
    .map((check) => `${check.endpoint}: ${check.bodySnippet || 'no response body'}`)
    .join(' ; ');

  throw new Error(`Preflight could not find a valid endpoint set after ${PREFLIGHT_RETRIES} retries. Last health: ${latestHealthCheck.status}. Status summary: ${summary}. Samples: ${sampleBodies}`);
};

const worker = async (deadline, endpoints, latencies, counters) => {
  while (Date.now() < deadline) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const url = `${API_BASE_URL}${endpoint}`;
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: makeHeaders()
      });
      const elapsed = performance.now() - start;
      latencies.push(elapsed);
      counters.total += 1;
      const statusCode = Number(response.status || 0);
      counters.statuses.set(statusCode, (counters.statuses.get(statusCode) || 0) + 1);

      if (!response.ok) {
        counters.errors += 1;
        if (counters.samples.length < ERROR_SAMPLE_LIMIT) {
          const bodyText = await response.text();
          counters.samples.push(`${endpoint} -> ${statusCode} (${toSnippet(bodyText) || 'no body'})`);
        }
      }
    } catch (error) {
      const elapsed = performance.now() - start;
      latencies.push(elapsed);
      counters.total += 1;
      counters.errors += 1;
      counters.statuses.set('NETWORK_ERROR', (counters.statuses.get('NETWORK_ERROR') || 0) + 1);
      if (counters.samples.length < ERROR_SAMPLE_LIMIT) {
        counters.samples.push(`${endpoint} -> NETWORK_ERROR (${toSnippet(error.message)})`);
      }
    }
  }
};

const run = async () => {
  const endpointResolution = await resolveWorkingEndpoints();
  const endpoints = endpointResolution.endpoints;
  const deadline = Date.now() + DURATION_SECONDS * 1000;
  const latencies = [];
  const counters = { total: 0, errors: 0, statuses: new Map(), samples: [] };

  const start = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }).map(() => worker(deadline, endpoints, latencies, counters)));
  const elapsedMs = Date.now() - start;

  const avgLatency = latencies.length
    ? Number((latencies.reduce((sum, v) => sum + v, 0) / latencies.length).toFixed(2))
    : 0;

  const p95Latency = percentile(latencies, 95);

  console.log('Load Test Summary:');
  console.log(`- baseUrl: ${API_BASE_URL}`);
  console.log(`- selectedEndpoints: ${endpoints.join(', ')}`);
  console.log(`- preflightAttemptsUsed: ${endpointResolution.attemptsUsed || 1}`);
  console.log(`- authTokenProvided: ${AUTH_TOKEN ? 'yes' : 'no'}`);
  console.log(`- preflightHealth: ${endpointResolution.healthCheck.status}`);
  endpointResolution.preflight.forEach((check) => {
    console.log(`- preflight ${check.endpoint}: ${check.status}${check.bodySnippet ? ` (${check.bodySnippet})` : ''}`);
  });
  console.log(`- concurrency: ${CONCURRENCY}`);
  console.log(`- durationSeconds: ${DURATION_SECONDS}`);
  console.log(`- elapsedMs: ${elapsedMs}`);
  console.log(`- totalRequests: ${counters.total}`);
  console.log(`- errorCount: ${counters.errors}`);
  console.log(`- averageLatencyMs: ${avgLatency}`);
  console.log(`- p95LatencyMs: ${p95Latency}`);
  console.log(`- p95ThresholdMs: ${P95_THRESHOLD_MS}`);
  console.log(`- statusCounts: ${JSON.stringify(Object.fromEntries(counters.statuses.entries()))}`);
  if (counters.samples.length > 0) {
    console.log(`- errorSamples: ${counters.samples.join(' | ')}`);
  }

  const thresholdBreached = p95Latency > P95_THRESHOLD_MS;
  if (thresholdBreached) {
    console.error(`Performance regression: p95 ${p95Latency}ms exceeds threshold ${P95_THRESHOLD_MS}ms`);
    process.exitCode = 1;
  }

  if (counters.errors > 0) {
    console.error(`Load test failed: ${counters.errors} request(s) returned non-2xx or network errors`);
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('performance.load.js failed:', error.message);
  process.exitCode = 1;
});
