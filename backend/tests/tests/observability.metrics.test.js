const request = require('supertest');

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = '';

jest.mock('../../config/db', () => jest.fn(async () => false));

const app = require('../../server');

describe('Observability Contracts', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    if (consoleLogSpy) consoleLogSpy.mockRestore();
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
  });

  it('propagates client-provided X-Request-ID header', async () => {
    const reqId = 'contract-request-id-001';
    const res = await request(app)
      .get('/api/test')
      .set('X-Request-ID', reqId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(reqId);
  });

  it('generates X-Request-ID when client does not provide one', async () => {
    const res = await request(app).get('/api/test');

    expect(res.status).toBe(200);
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect(res.headers['x-request-id'].length).toBeGreaterThan(8);
  });

  it('returns /api/metrics JSON structure with endpoint latency summary', async () => {
    await request(app).get('/api/test');
    await request(app).get('/api/health');

    const res = await request(app).get('/api/metrics');

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data).toBeDefined();
    expect(res.body.data?.totals).toBeDefined();
    expect(typeof res.body.data.totals?.requests).toBe('number');
    expect(typeof res.body.data.totals?.errorRate).toBe('number');
    expect(typeof res.body.data.totals?.p95Ms).toBe('number');
    expect(Array.isArray(res.body.data?.topRoutesByP95)).toBe(true);
    expect(res.body.data?.thresholds?.p95TargetMs).toBe(250);
  });

  it('returns Prometheus formatted metrics text', async () => {
    const res = await request(app).get('/api/metrics/prometheus');

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toContain('text/plain');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_errors_total');
    expect(res.text).toContain('http_request_duration_p95_ms');
    expect(res.text).toContain('http_route_p95_ms');
  });
});
