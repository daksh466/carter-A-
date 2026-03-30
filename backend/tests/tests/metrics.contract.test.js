const request = require('supertest');

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = '';

jest.mock('../../config/db', () => jest.fn(async () => false));

const app = require('../../server');

describe('Metrics Contract', () => {
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

  it('returns expected /api/metrics JSON structure', async () => {
    const res = await request(app).get('/api/metrics');

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data).toBeDefined();
    expect(res.body.data?.totals).toBeDefined();
    expect(res.body.data?.thresholds).toBeDefined();
    expect(Array.isArray(res.body.data?.topRoutesByP95)).toBe(true);

    expect(typeof res.body.data.totals?.requests).toBe('number');
    expect(typeof res.body.data.totals?.errors).toBe('number');
    expect(typeof res.body.data.totals?.slowRequests).toBe('number');
    expect(typeof res.body.data.totals?.errorRate).toBe('number');
    expect(typeof res.body.data.totals?.slowRate).toBe('number');
    expect(typeof res.body.data.totals?.p95Ms).toBe('number');
  });

  it('increments request counters after API traffic', async () => {
    const beforeRes = await request(app).get('/api/metrics');
    const beforeRequests = Number(beforeRes.body?.data?.totals?.requests || 0);

    await request(app).get('/api/test');
    await request(app).get('/api/health');
    await request(app).get('/api/spares');

    const afterRes = await request(app).get('/api/metrics');
    const afterRequests = Number(afterRes.body?.data?.totals?.requests || 0);

    expect(afterRequests).toBeGreaterThan(beforeRequests);
  });
});
