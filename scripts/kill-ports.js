#!/usr/bin/env node

const { execSync } = require('child_process');

function parseCliArgs(argv = []) {
  const opts = {
    strict: false,
    retries: process.platform === 'win32' ? 1 : 0,
    ports: [],
  };

  argv.forEach((arg) => {
    const value = String(arg || '').trim();
    if (!value) return;

    if (value === '--strict') {
      opts.strict = true;
      return;
    }

    if (value.startsWith('--retries=')) {
      const parsed = Number(value.split('=')[1]);
      if (Number.isInteger(parsed) && parsed >= 0) {
        opts.retries = parsed;
      }
      return;
    }

    const port = Number(value);
    if (Number.isInteger(port) && port > 0) {
      opts.ports.push(port);
    }
  });

  return opts;
}

function runKillPorts(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  const ports = options.ports;

  if (ports.length === 0) {
    console.log('No valid ports provided. Usage: node scripts/kill-ports.js [--strict] [--retries=1] 5000 5173');
    return 0;
  }

  for (const port of ports) {
    const pids = getPidsForPort(port);
    if (pids.length === 0) {
      console.log(`Port ${port}: already free`);
      continue;
    }

    for (const pid of pids) {
      const killed = killPid(pid, options.retries);
      if (killed) {
        console.log(`Port ${port}: stopped PID ${pid}`);
      } else {
        console.log(`Port ${port}: failed to stop PID ${pid}`);
      }
    }

    const remaining = getPidsForPort(port);
    if (remaining.length === 0) {
      console.log(`Port ${port}: verified free`);
    } else {
      console.log(`Port ${port}: still busy (${remaining.join(',')})`);
    }
  }

  if (options.strict) {
    const blockedPorts = ports.filter((port) => getPidsForPort(port).length > 0);
    if (blockedPorts.length > 0) {
      console.log(`Strict mode: unresolved ports ${blockedPorts.join(', ')}`);
      return 1;
    }
  }

  return 0;
}

function killPid(pid, retries = 0) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      }
      return true;
    } catch {
      attempt += 1;
    }
  }

  return false;
}

function getPidsForPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.split(/\r?\n/);
      const pids = new Set();

      for (const line of lines) {
        const normalized = line.trim();
        if (!normalized) continue;

        // Supports both IPv4 and IPv6 rows from netstat output.
        const match = normalized.match(/^TCP\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)$/i);
        if (!match) continue;

        const localAddress = match[1] || '';
        const state = match[3] || '';
        const pid = Number(match[4]);

        if (!localAddress.endsWith(`:${port}`)) continue;
        if (state.toUpperCase() !== 'LISTENING') continue;
        if (!Number.isInteger(pid) || pid <= 0) continue;

        pids.add(pid);
      }

      return [...pids];
    }

    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return output
      .split(/\r?\n/)
      .map((p) => Number(p.trim()))
      .filter((p) => Number.isInteger(p) && p > 0);
  } catch {
    return [];
  }
}

module.exports = {
  parseCliArgs,
  killPid,
  getPidsForPort,
  runKillPorts,
};

if (require.main === module) {
  process.exit(runKillPorts());
}
