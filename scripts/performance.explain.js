const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '../backend/package.json'));
const mongoose = backendRequire('mongoose');
const { MongoMemoryServer } = backendRequire('mongodb-memory-server');

const SparePart = require('../backend/src/models/SparePart');
const Transfer = require('../backend/src/models/Transfer');

const findPrimaryStage = (plan) => {
  if (!plan || typeof plan !== 'object') return null;
  if (plan.stage === 'IXSCAN' || plan.stage === 'COLLSCAN') return plan.stage;

  const keys = Object.keys(plan);
  for (const key of keys) {
    const value = plan[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const stage = findPrimaryStage(item);
        if (stage) return stage;
      }
    } else if (value && typeof value === 'object') {
      const stage = findPrimaryStage(value);
      if (stage) return stage;
    }
  }
  return null;
};

const summarize = (name, explain) => {
  const winningPlan = explain?.queryPlanner?.winningPlan || {};
  const stage = findPrimaryStage(winningPlan) || 'UNKNOWN';
  const stats = explain?.executionStats || {};

  return {
    name,
    stage,
    executionTimeMillis: Number(stats.executionTimeMillis || 0),
    totalDocsExamined: Number(stats.totalDocsExamined || 0),
    totalKeysExamined: Number(stats.totalKeysExamined || 0)
  };
};

const hasStoreIdIndex = (indexes = []) => {
  return indexes.some((indexDoc) => {
    const keys = indexDoc?.key || {};
    const keyNames = Object.keys(keys);
    return keyNames.length === 1 && keyNames[0] === 'store_id' && Number(keys.store_id) === 1;
  });
};

const run = async () => {
  let mongod;
  try {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('performance-explain'));

    await SparePart.create([
      {
        name: 'part-a',
        normalized_name: 'part-a',
        machine_id: 'machine-1',
        machine_ids: ['machine-1'],
        store_id: 'store-1',
        quantity_available: 10,
        minimum_required: 2,
        is_deleted: false,
        batches: []
      },
      {
        name: 'part-b',
        normalized_name: 'part-b',
        machine_id: 'machine-2',
        machine_ids: ['machine-2'],
        store_id: 'store-1',
        quantity_available: 20,
        minimum_required: 2,
        is_deleted: false,
        batches: []
      },
      {
        name: 'part-c',
        normalized_name: 'part-c',
        machine_id: 'machine-3',
        machine_ids: ['machine-3'],
        store_id: 'store-2',
        quantity_available: 30,
        minimum_required: 2,
        is_deleted: false,
        batches: []
      }
    ]);

    // Ensure the requested store_id index exists before running explain.
    await SparePart.collection.createIndex({ store_id: 1 });
    const sparePartIndexes = await SparePart.collection.indexes();
    const verifiedStoreIdIndex = hasStoreIdIndex(sparePartIndexes);

    await Transfer.create([
      {
        type: 'outgoing',
        from_store_id: 'store-1',
        from_store_name: 'Store 1',
        to_store_id: 'store-2',
        to_store_name: 'Store 2',
        items: [
          {
            spare_part_id: 'p-1',
            spare_part_name: 'part-a',
            quantity: 5
          }
        ],
        total_items: 1,
        status: 'in_transit',
        transferred_by: 'perf-script',
        created_by: 'perf-script'
      },
      {
        type: 'incoming',
        from_store_id: 'store-3',
        from_store_name: 'Store 3',
        to_store_id: 'store-1',
        to_store_name: 'Store 1',
        items: [
          {
            spare_part_id: 'p-2',
            spare_part_name: 'part-b',
            quantity: 3
          }
        ],
        total_items: 1,
        status: 'in_transit',
        transferred_by: 'perf-script',
        created_by: 'perf-script'
      }
    ]);

    const inventoryExplain = await SparePart.find({
      store_id: 'store-1'
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .hint({ store_id: 1 })
      .lean()
      .explain('executionStats');

    const transferExplain = await Transfer.find({
      $or: [{ from_store_id: 'store-1' }, { to_store_id: 'store-1' }]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .explain('executionStats');

    const rows = [
      summarize('SparePart inventory list (store_id filter)', inventoryExplain),
      summarize('Transfer list (store scope + createdAt desc)', transferExplain)
    ];

    console.log('Explain Results:');
    console.log(`- storeIdIndexVerified: ${verifiedStoreIdIndex ? 'yes' : 'no'}`);
    if (verifiedStoreIdIndex) {
      console.log('- storeIdIndexSpec: { store_id: 1 }');
    }
    rows.forEach((row) => {
      console.log(`- ${row.name}`);
      console.log(`  stage: ${row.stage}`);
      console.log(`  executionTimeMillis: ${row.executionTimeMillis}`);
      console.log(`  totalDocsExamined: ${row.totalDocsExamined}`);
      console.log(`  totalKeysExamined: ${row.totalKeysExamined}`);
    });
  } catch (error) {
    console.error('performance.explain.js failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }
};

run();
