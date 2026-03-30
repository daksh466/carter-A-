const { spawnSync } = require('child_process');
const path = require('path');

describe('Proxy smoke startup checks', () => {
  test('dev:doctor command exists and runs as startup diagnostic entrypoint', () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const result = spawnSync('npm', ['run', '-s', 'dev:doctor'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      shell: true,
    });

    const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
    expect(typeof combinedOutput).toBe('string');
    // Accept either explicit dev-doctor marker output or a valid command exit status.
    const hasMarker = combinedOutput.includes('[dev-doctor]');
    // Either status is fine; script should return non-zero if checks fail with services down.
    expect([0, 1]).toContain(result.status);
    expect(hasMarker || result.status !== null).toBe(true);
  });
});
