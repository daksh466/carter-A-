#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`[verify:sparepart-canonical] FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[verify:sparepart-canonical] OK: ${message}`);
}

const workspaceRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(workspaceRoot, 'backend');
const serverPath = path.join(backendRoot, 'server.js');

const srcSparePart = require(path.join(backendRoot, 'src', 'models', 'SparePart.js'));
const rootSparePart = require(path.join(backendRoot, 'models', 'SparePart.js'));
const modelIndex = require(path.join(backendRoot, 'src', 'models', 'index.js'));

if (srcSparePart !== rootSparePart) {
  fail('root SparePart export is not the canonical src SparePart model');
}
ok('root SparePart re-exports canonical src model');

if (modelIndex.SparePart !== srcSparePart) {
  fail('models index does not expose canonical SparePart model');
}
ok('models index exposes canonical SparePart');

const modelNames = (srcSparePart.db && typeof srcSparePart.db.modelNames === 'function')
  ? srcSparePart.db.modelNames().filter((name) => name === 'SparePart')
  : [];

if (modelNames.length !== 1) {
  fail(`expected exactly one registered SparePart model, found ${modelNames.length}`);
}
ok('exactly one SparePart model registered in mongoose');

const serverSource = fs.readFileSync(serverPath, 'utf8');
const requiredRoutes = [
  "app.get('/api/spares'",
  "app.post('/api/spares'",
  "app.put('/api/spares/:id'",
  "app.get('/api/inventory'",
];

for (const routeToken of requiredRoutes) {
  if (!serverSource.includes(routeToken)) {
    fail(`server route token missing: ${routeToken}`);
  }
}
ok('critical spare/inventory routes present');

const modelDestructurePattern = /const\s*\{[\s\S]*?SparePart[\s\S]*?\}\s*=\s*models\s*;/m;
if (!modelDestructurePattern.test(serverSource)) {
  fail('server does not destructure SparePart from canonical models index import');
}
ok('server consumes SparePart from models index import');

console.log('[verify:sparepart-canonical] PASS');
process.exit(0);
