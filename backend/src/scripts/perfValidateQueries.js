const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const SparePart = require('../models/SparePart');
const Transfer = require('../models/Transfer');

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/carter_perf_validation';
const STORE_IDS = ['store-1', 'store-2', 'store-3', 'store-4', 'store-5'];
const MACHINE_IDS = ['machine-1', 'machine-2', 'machine-3', 'machine-4', 'machine-5'];

const nowIsoForFile = () => new Date().toISOString().replace(/[:.]/g, '-');

const collectStages = (node, stages = []) => {
  if (!node || typeof node !== 'object') return stages;

  if (node.stage) {
    stages.push(node.stage);
  }

  Object.keys(node).forEach((key) => {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach((item) => collectStages(item, stages));
      return;
    }
    if (value && typeof value === 'object') {
      collectStages(value, stages);
    }
  });

  return stages;
};

const hasIxScan = (stages) => {
  const normalized = stages.map((stage) => String(stage || '').toUpperCase());
  return normalized.includes('IXSCAN') || normalized.includes('COUNT_SCAN') || normalized.includes('IXSEEK');
};
const hasCollScan = (stages) => stages.includes('COLLSCAN');

const summarizeExplain = (name, explain) => {
  const winningPlan = explain?.queryPlanner?.winningPlan || explain?.stages || {};
  const stages = [...new Set(collectStages(winningPlan, []))];
  const executionStats = explain?.executionStats || {};

  return {
    name,
    stages,
    ixscan: hasIxScan(stages),
    collscan: hasCollScan(stages),
    executionTimeMillis: Number(executionStats.executionTimeMillis || 0),
    nReturned: Number(executionStats.nReturned || 0),
    totalDocsExamined: Number(executionStats.totalDocsExamined || 0),
    totalKeysExamined: Number(executionStats.totalKeysExamined || 0)
  };
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const buildSparePartsSeed = (count = 1500) => {
  const docs = [];
  for (let i = 0; i < count; i += 1) {
    const storeId = STORE_IDS[i % STORE_IDS.length];
    const machineId = MACHINE_IDS[i % MACHINE_IDS.length];
    docs.push({
      name: `part-${i}`,
      normalized_name: `part-${i}`,
      machine_id: machineId,
      machine_ids: [machineId],
      store_id: storeId,
      quantity_available: randomInt(0, 300),
      minimum_required: randomInt(1, 30),
      warranty_expiry_date: null,
      is_deleted: false,
      batches: [
        {
          batch_number: `B-${i}-1`,
          quantity: randomInt(1, 20),
          expiry_date: null,
          received_date: new Date()
        }
      ]
    });
  }
  return docs;
};

const buildTransfersSeed = (count = 5000) => {
  const docs = [];
  const baseDate = Date.now() - 1000 * 60 * 60 * 24 * 30;

  for (let i = 0; i < count; i += 1) {
    const fromStore = STORE_IDS[i % STORE_IDS.length];
    const toStore = STORE_IDS[(i + 1) % STORE_IDS.length];
    const type = i % 3 === 0 ? 'incoming' : i % 3 === 1 ? 'outgoing' : 'internal';
    const status = i % 4 === 0 ? 'in_transit' : i % 4 === 1 ? 'received' : i % 4 === 2 ? 'completed' : 'pending';
    const dispatchDate = new Date(baseDate + i * 3600 * 1000);

    docs.push({
      type,
      isInstant: type === 'internal',
      from_store_id: fromStore,
      from_store_name: fromStore,
      to_store_id: toStore,
      to_store_name: toStore,
      items: [
        {
          spare_part_id: `${i}`,
          spare_part_name: `part-${i % 300}`,
          item_name: `part-${i % 300}`,
          normalized_name: `part-${i % 300}`,
          machine_id: MACHINE_IDS[i % MACHINE_IDS.length],
          minimum_required: 1,
          quantity: randomInt(1, 20),
          batch_allocations: []
        }
      ],
      total_items: 1,
      mode_of_transport: 'Truck',
      distance_km: randomInt(1, 200),
      dispatch_date: dispatchDate,
      expected_delivery_date: new Date(dispatchDate.getTime() + 24 * 3600 * 1000),
      status,
      transferred_by: 'perf-script',
      created_by: 'perf-script',
      notes: 'perf-validate'
    });
  }

  return docs;
};

const ensureSeedData = async () => {
  const spareCount = await SparePart.countDocuments();
  const transferCount = await Transfer.countDocuments();

  if (spareCount < 500) {
    await SparePart.insertMany(buildSparePartsSeed(1500), { ordered: false });
  }

  if (transferCount < 1000) {
    await Transfer.insertMany(buildTransfersSeed(5000), { ordered: false });
  }
};

const runExplainChecks = async () => {
  const inventoryStoreFilter = { store_id: 'store-1', is_deleted: { $ne: true } };
  const inventoryMachineFilter = {
    store_id: 'store-1',
    machine_id: 'machine-2',
    is_deleted: { $ne: true }
  };

  const transferListIncomingFilter = {
    to_store_id: 'store-2',
    type: 'incoming',
    status: 'in_transit',
    dispatch_date: {
      $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
      $lte: new Date()
    }
  };

  const transferListOutgoingFilter = {
    from_store_id: 'store-1',
    type: 'outgoing',
    status: 'in_transit',
    dispatch_date: {
      $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
      $lte: new Date()
    }
  };

  const transferStatsBaseFilter = {
    $or: [{ from_store_id: 'store-1' }, { to_store_id: 'store-1' }],
    dispatch_date: {
      $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      $lte: new Date()
    }
  };

  const explains = [];

  const inventoryExplain = await SparePart.find(inventoryStoreFilter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
    .explain('executionStats');
  explains.push(summarizeExplain('inventory_list_store', inventoryExplain));

  const inventoryMachineExplain = await SparePart.find(inventoryMachineFilter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
    .explain('executionStats');
  explains.push(summarizeExplain('inventory_list_store_machine', inventoryMachineExplain));

  const transferIncomingExplain = await Transfer.find(transferListIncomingFilter)
    .sort({ dispatch_date: -1, createdAt: -1 })
    .limit(50)
    .lean()
    .explain('executionStats');
  explains.push(summarizeExplain('transfer_list_incoming', transferIncomingExplain));

  const transferOutgoingExplain = await Transfer.find(transferListOutgoingFilter)
    .sort({ dispatch_date: -1, createdAt: -1 })
    .limit(50)
    .lean()
    .explain('executionStats');
  explains.push(summarizeExplain('transfer_list_outgoing', transferOutgoingExplain));

  const transferStatsTotalExplain = await Transfer.aggregate([
    { $match: transferStatsBaseFilter },
    { $count: 'total' }
  ]).explain('executionStats');
  explains.push(summarizeExplain('transfer_stats_total', transferStatsTotalExplain));

  const transferStatsOutgoingExplain = await Transfer.aggregate([
    {
      $match: {
        ...transferStatsBaseFilter,
        type: 'outgoing',
        status: 'in_transit',
        from_store_id: 'store-1'
      }
    },
    { $count: 'total' }
  ]).explain('executionStats');
  explains.push(summarizeExplain('transfer_stats_outgoing', transferStatsOutgoingExplain));

  const transferStatsIncomingExplain = await Transfer.aggregate([
    {
      $match: {
        ...transferStatsBaseFilter,
        type: 'incoming',
        status: 'in_transit',
        to_store_id: 'store-1'
      }
    },
    { $count: 'total' }
  ]).explain('executionStats');
  explains.push(summarizeExplain('transfer_stats_incoming', transferStatsIncomingExplain));

  return explains;
};

const toMarkdown = (results) => {
  const lines = [];
  lines.push('# Query Performance Validation');
  lines.push('');
  lines.push('| Query | IXSCAN | COLLSCAN | Exec ms | Returned | Docs Examined | Keys Examined | Stages |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---|');

  results.forEach((row) => {
    lines.push(
      `| ${row.name} | ${row.ixscan ? 'yes' : 'no'} | ${row.collscan ? 'yes' : 'no'} | ${row.executionTimeMillis} | ${row.nReturned} | ${row.totalDocsExamined} | ${row.totalKeysExamined} | ${row.stages.join(', ')} |`
    );
  });

  lines.push('');
  const anyCollscan = results.some((row) => row.collscan);
  lines.push(`- Result: ${anyCollscan ? 'needs index tuning (COLLSCAN detected)' : 'index usage validated (no COLLSCAN)'} `);
  return `${lines.join('\n')}\n`;
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;
  const reportDir = path.join(__dirname, '../../reports/performance');
  const ts = nowIsoForFile();

  try {
    await mongoose.connect(mongoUri);
    await Promise.all([SparePart.syncIndexes(), Transfer.syncIndexes()]);
    await ensureSeedData();

    const results = await runExplainChecks();

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const jsonPath = path.join(reportDir, `query-validate-${ts}.json`);
    const mdPath = path.join(reportDir, `query-validate-${ts}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    fs.writeFileSync(mdPath, toMarkdown(results), 'utf8');

    console.log('Query validation complete');
    console.log(`JSON report: ${jsonPath}`);
    console.log(`Markdown report: ${mdPath}`);

    const collscanCount = results.filter((row) => row.collscan).length;
    const ixscanCount = results.filter((row) => row.ixscan).length;
    const slowRows = results.filter((row) => row.executionTimeMillis > 250).length;
    console.log(`IXSCAN queries: ${ixscanCount}/${results.length}`);
    console.log(`COLLSCAN queries: ${collscanCount}/${results.length}`);
    console.log(`Queries over 250ms (explain executionTimeMillis): ${slowRows}/${results.length}`);
  } catch (error) {
    console.error('Query validation failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();