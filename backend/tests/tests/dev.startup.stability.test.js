const {
  waitForBackendReady,
  buildStartupDiagnostics,
} = require('../../../start-all');

describe('Dev startup stability helpers', () => {
  test('waitForBackendReady succeeds when probe eventually returns ok', async () => {
    let attempts = 0;
    const probe = jest.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        return { ok: false, statusCode: null, error: 'refused', latencyMs: 15 };
      }
      return { ok: true, statusCode: 200, error: '', latencyMs: 8 };
    });

    const ready = await waitForBackendReady({ attempts: 5, intervalMs: 1, probe, requireBackendProcess: false });
    expect(ready).toBe(true);
    expect(probe).toHaveBeenCalledTimes(3);
  });

  test('waitForBackendReady fails after max attempts when probe is always down', async () => {
    const probe = jest.fn(async () => ({ ok: false, statusCode: null, error: 'timeout', latencyMs: 20 }));

    const ready = await waitForBackendReady({ attempts: 4, intervalMs: 1, probe, requireBackendProcess: false });
    expect(ready).toBe(false);
    expect(probe).toHaveBeenCalledTimes(4);
  });

  test('buildStartupDiagnostics returns readable key diagnostics', () => {
    const diag = buildStartupDiagnostics();
    expect(typeof diag).toBe('string');
    expect(diag).toContain('phase=');
    expect(diag).toContain('elapsedMs=');
    expect(diag).toContain('healthAttempts=');
  });
});
