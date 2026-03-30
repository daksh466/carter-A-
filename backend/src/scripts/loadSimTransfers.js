const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Store = require('../../models/Store');
const SparePart = require('../models/SparePart');
const Transfer = require('../models/Transfer');

const nowIsoForFile = () => new Date().toISOString().replace(/[:.]/g, '-');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  const reportDir = path.join(__dirname, '../../reports/performance');
  const ts = nowIsoForFile();

  let mongoServer = null;
  try {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_UNSAFE_DESTRUCTIVE_AUTH_BYPASS = 'true';

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri('load-sim');

    const app = require('../../server');
    await new Promise((resolve) => {
      const check = () => {
        if (mongoose.connection.readyState === 1) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });

    const [sourceStore, destinationStore] = await Store.create([
      { state: 'State-A', storeHead: 'Source Store', contact: '9999990001', name: 'Source Store', address: 'State-A', phone: '9999990001' },
      { state: 'State-B', storeHead: 'Destination Store', contact: '9999990002', name: 'Destination Store', address: 'State-B', phone: '9999990002' }
    ]);

    const sourcePart = await SparePart.create({
      name: 'bearing-6201-small',
      normalized_name: 'bearing-6201-small',
      machine_id: 'machine-1',
      machine_ids: ['machine-1'],
      store_id: String(sourceStore._id),
      quantity_available: 120,
      minimum_required: 5,
      batches: [
        {
          batch_number: 'LOT-A',
          quantity: 60,
          expiry_date: new Date('2026-08-01T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'LOT-B',
          quantity: 60,
          expiry_date: new Date('2026-12-01T00:00:00.000Z'),
          received_date: new Date('2026-02-01T00:00:00.000Z')
        }
      ]
    });

    const transferCount = 12;
    const quantityPerTransfer = 5;
    const totalQuantity = transferCount * quantityPerTransfer;
    const dispatchDate = new Date('2026-03-30T00:00:00.000Z');
    const expectedDate = new Date('2026-03-31T00:00:00.000Z');

    const transferPayload = {
      type: 'outgoing',
      from_store_id: String(sourceStore._id),
      from_store_name: 'Source Store',
      to_store_id: String(destinationStore._id),
      to_store_name: 'Destination Store',
      items: [
        {
          spare_part_id: String(sourcePart._id),
          item_id: String(sourcePart._id),
          quantity: quantityPerTransfer
        }
      ],
      driver: {
        name: 'Auto Driver',
        phone: '9999911111',
        driverId: 'DRV-001'
      },
      mode_of_transport: 'Truck',
      vehicle_number: 'DL01AB1234',
      dispatch_date: dispatchDate,
      expected_delivery_date: expectedDate,
      approved_by: 'load-sim'
    };

    const createStart = Date.now();
    const createResults = await Promise.all(
      Array.from({ length: transferCount }).map(() => request(app).post('/api/transfers').send(transferPayload))
    );
    const createElapsedMs = Date.now() - createStart;

    const createFailures = createResults.filter((res) => res.status !== 201);
    assert(createFailures.length === 0, `Transfer create failures: ${createFailures.map((r) => r.status).join(', ')}`);

    const createdTransfers = createResults.map((res) => res.body?.data?.transfer).filter(Boolean);
    assert(createdTransfers.length === transferCount, 'Not all transfers were created');

    const sourceAfterCreate = await SparePart.findById(sourcePart._id).lean();
    assert(sourceAfterCreate, 'Missing source part after transfer create');
    assert(sourceAfterCreate.quantity_available === 120 - totalQuantity, 'Source quantity mismatch after create');

    const destinationAfterCreate = await SparePart.findOne({
      store_id: String(destinationStore._id),
      normalized_name: 'bearing-6201-small'
    }).lean();
    assert(!destinationAfterCreate, 'Destination stock should not change before receive');

    const receivePayload = {
      confirmationBy: 'Auto Receiver',
      confirmationDate: '2026-03-31T05:00:00.000Z',
      notes: 'concurrent receive load sim'
    };

    const receiveStart = Date.now();
    const receiveResults = await Promise.all(
      createdTransfers.map((transfer) => request(app).patch(`/api/transfers/${transfer.id}/receive`).send(receivePayload))
    );
    const receiveElapsedMs = Date.now() - receiveStart;

    const receiveFailures = receiveResults.filter((res) => res.status !== 200);
    assert(receiveFailures.length === 0, `Transfer receive failures: ${receiveFailures.map((r) => r.status).join(', ')}`);

    const destinationAfterReceive = await SparePart.findOne({
      store_id: String(destinationStore._id),
      normalized_name: 'bearing-6201-small'
    }).lean();
    assert(destinationAfterReceive, 'Destination part missing after receive');
    assert(destinationAfterReceive.quantity_available === totalQuantity, 'Destination quantity mismatch after receive');

    const allTransfers = await Transfer.find({ _id: { $in: createdTransfers.map((t) => t.id) } }).lean();
    const notReceived = allTransfers.filter((transfer) => transfer.status !== 'received');
    assert(notReceived.length === 0, 'Some transfers did not reach received status');

    const sourceAfterReceive = await SparePart.findById(sourcePart._id).lean();
    const lotA = (sourceAfterReceive?.batches || []).find((b) => b.batch_number === 'LOT-A');
    const lotB = (sourceAfterReceive?.batches || []).find((b) => b.batch_number === 'LOT-B');
    assert(lotA && lotA.quantity === 0 || !lotA, 'LOT-A should be consumed first by FEFO');
    assert(lotB && lotB.quantity === 60 - (totalQuantity - 60 >= 0 ? totalQuantity - 60 : 0), 'LOT-B quantity mismatch');

    const destinationBatches = destinationAfterReceive.batches || [];
    const hasDuplicateBatchNumbers = destinationBatches.length !== new Set(destinationBatches.map((b) => String(b.batch_number).toLowerCase())).size;
    assert(!hasDuplicateBatchNumbers, 'Duplicate destination batch numbers found');

    const metricsRes = await request(app).get('/api/metrics');
    const metricsData = metricsRes.body?.data || {};
    const routeSummaries = Array.isArray(metricsData.topRoutesByP95) ? metricsData.topRoutesByP95 : [];
    const createRouteMetrics = routeSummaries.find((row) => row.route === 'POST /');
    const receiveRouteMetrics = routeSummaries.find((row) => row.route === 'PATCH /:id/receive');

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const summary = {
      transferCount,
      quantityPerTransfer,
      totalQuantity,
      createElapsedMs,
      receiveElapsedMs,
      createAverageMs: Number((createElapsedMs / transferCount).toFixed(2)),
      receiveAverageMs: Number((receiveElapsedMs / transferCount).toFixed(2)),
      sourceQuantityAfterCreate: sourceAfterCreate.quantity_available,
      sourceQuantityAfterReceive: sourceAfterReceive.quantity_available,
      destinationQuantityAfterReceive: destinationAfterReceive.quantity_available,
      transferStatuses: {
        received: allTransfers.length,
        nonReceived: notReceived.length
      },
      endpointMetricsSnapshot: {
        totals: metricsData.totals || {},
        createRoute: createRouteMetrics || null,
        receiveRoute: receiveRouteMetrics || null
      },
      destinationBatchCount: destinationBatches.length,
      destinationBatches
    };

    const jsonPath = path.join(reportDir, `load-sim-${ts}.json`);
    const mdPath = path.join(reportDir, `load-sim-${ts}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

    const md = [
      '# Concurrent Transfer Load Simulation',
      '',
      `- Transfers created concurrently: ${transferCount}`,
      `- Quantity per transfer: ${quantityPerTransfer}`,
      `- Total transferred quantity: ${totalQuantity}`,
      `- Create elapsed ms: ${createElapsedMs}`,
      `- Receive elapsed ms: ${receiveElapsedMs}`,
      `- Create avg ms/transfer: ${summary.createAverageMs}`,
      `- Receive avg ms/transfer: ${summary.receiveAverageMs}`,
      `- Source quantity after create: ${sourceAfterCreate.quantity_available}`,
      `- Source quantity after receive: ${sourceAfterReceive.quantity_available}`,
      `- Destination quantity after receive: ${destinationAfterReceive.quantity_available}`,
      `- Received status count: ${allTransfers.length}`,
      `- Metrics p95 (global): ${summary.endpointMetricsSnapshot.totals?.p95Ms ?? 'n/a'} ms`,
      `- Metrics p95 (POST /): ${summary.endpointMetricsSnapshot.createRoute?.p95Ms ?? 'n/a'} ms`,
      `- Metrics p95 (PATCH /:id/receive): ${summary.endpointMetricsSnapshot.receiveRoute?.p95Ms ?? 'n/a'} ms`,
      `- Destination batch rows: ${destinationBatches.length}`,
      '',
      'Result: PASS (no race-condition symptom detected in this run; FEFO and batch consistency checks passed).',
      ''
    ].join('\n');

    fs.writeFileSync(mdPath, md, 'utf8');

    console.log('Load simulation complete');
    console.log(`JSON report: ${jsonPath}`);
    console.log(`Markdown report: ${mdPath}`);
  } catch (error) {
    console.error('Load simulation failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
};

run();