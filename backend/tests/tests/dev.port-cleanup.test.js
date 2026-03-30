const { parseCliArgs } = require('../../../scripts/kill-ports');

describe('kill-ports CLI parsing', () => {
  test('parses strict mode, retries and valid ports', () => {
    const parsed = parseCliArgs(['--strict', '--retries=2', '5000', '5173', 'bad']);
    expect(parsed.strict).toBe(true);
    expect(parsed.retries).toBe(2);
    expect(parsed.ports).toEqual([5000, 5173]);
  });

  test('uses safe defaults when flags are absent', () => {
    const parsed = parseCliArgs(['5000']);
    expect(parsed.strict).toBe(false);
    expect(parsed.ports).toEqual([5000]);
    expect(Number.isInteger(parsed.retries)).toBe(true);
    expect(parsed.retries).toBeGreaterThanOrEqual(0);
  });
});
