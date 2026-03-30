const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../../config/db');

const Store = require('../../models/Store');
const Machine = require('../models/Machine');
const SparePart = require('../models/SparePart');
const Transfer = require('../models/Transfer');

dotenv.config();

const DATA_TAG = 'LOGISTICS_ERP_SCALABILITY_V2';
const OUTPUT_PATH = path.join(__dirname, '../../backups/logistics-erp-dataset.json');

const cityNames = [
  'Delhi', 'Gurgaon', 'Noida', 'Faridabad', 'Ghaziabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Varanasi', 'Indore',
  'Bhopal', 'Nagpur', 'Mumbai', 'Navi Mumbai', 'Pune', 'Nashik', 'Ahmedabad', 'Vadodara', 'Surat', 'Rajkot',
  'Bengaluru', 'Mysuru', 'Chennai', 'Coimbatore', 'Hyderabad', 'Vijayawada', 'Kochi', 'Thiruvananthapuram',
  'Kolkata', 'Bhubaneswar', 'Patna', 'Ranchi', 'Chandigarh', 'Ludhiana', 'Amritsar', 'Jodhpur', 'Udaipur',
  'Siliguri', 'Visakhapatnam', 'Mangaluru'
];

const facilityTypes = ['Warehouse', 'Plant', 'Depot', 'Hub', 'Unit', 'Service Center'];
const localityTags = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central Zone'];

const buildStoreSeeds = (count = 100) => {
  const stores = [];
  for (let i = 0; i < count; i += 1) {
    const city = cityNames[i % cityNames.length];
    const facility = facilityTypes[Math.floor(i / cityNames.length) % facilityTypes.length];
    const zone = localityTags[i % localityTags.length];
    stores.push({
      id: `S${String(i + 1).padStart(3, '0')}`,
      name: `${city} ${facility} ${String(Math.floor(i / (cityNames.length * facilityTypes.length)) + 1).padStart(2, '0')}`,
      location: `${zone}, ${city}, India`
    });
  }
  return stores;
};

const machineTemplates = [
  'Mazak VCN-530C',
  'Haas ST-20',
  'Doosan Puma 2600',
  'Trumpf TruLaser 3030',
  'Amada HFE 100-3',
  'DMG Mori CMX 1100V',
  'Makino PS95',
  'Fanuc Robodrill Alpha-D21',
  'Komatsu Servo Press H1F',
  'Siemens SMT Line SX'
];

const partFamilies = [
  { category: 'Bearings', base: 'Bearing 6201', variants: ['Small', 'Large'], min: [25, 20] },
  { category: 'Bearings', base: 'Bearing 6202', variants: ['Small', 'Large'], min: [18, 16] },
  { category: 'Raw Material', base: 'Sheet', variants: ['5mm', '10mm', '12mm'], min: [80, 40, 30] },
  { category: 'Fasteners', base: 'Bolt', variants: ['M10', 'M-10', 'M12', 'M16'], min: [120, 45, 90, 70] },
  { category: 'Fasteners', base: 'Nut', variants: ['M10', 'M12', 'M16'], min: [110, 85, 55] },
  { category: 'Pneumatic', base: 'Compressor Valve', variants: ['Type-A', 'Type-B'], min: [18, 14] },
  { category: 'Hydraulic', base: 'Hydraulic Seal', variants: ['25mm', '40mm', '50mm'], min: [30, 14, 10] },
  { category: 'Transmission', base: 'V-Belt', variants: ['A42', 'B50', 'C65'], min: [36, 24, 18] },
  { category: 'Transmission', base: 'Coupling Spider', variants: ['L095', 'L110', 'L150'], min: [20, 16, 12] },
  { category: 'Electrical', base: 'Relay', variants: ['24V', '48V'], min: [30, 25] },
  { category: 'Electrical', base: 'Proximity Sensor', variants: ['NPN-M18', 'PNP-M18', 'NPN-M12'], min: [24, 20, 16] },
  { category: 'Filters', base: 'Air Filter Element', variants: ['AF-10', 'AF-20'], min: [20, 16] },
  { category: 'Filters', base: 'Oil Filter', variants: ['OF-22', 'OF-35'], min: [20, 18] },
  { category: 'Consumables', base: 'Coolant Hose', variants: ['1/2in', '3/4in'], min: [35, 24] },
  { category: 'Lubricants', base: 'Gearbox Oil', variants: ['ISO-220 20L', 'ISO-320 20L'], min: [60, 45] },
  { category: 'Pneumatic', base: 'Pneumatic Cylinder Kit', variants: ['PC-32', 'PC-40'], min: [16, 12] },
  { category: 'Machine Parts', base: 'Nozzle Assembly', variants: ['NA-08', 'NA-12'], min: [15, 12] },
  { category: 'Raw Material', base: 'Acrylic Sheet', variants: ['3mm', '5mm'], min: [70, 45] },
  { category: 'Fasteners', base: 'Allen Key Bolt', variants: ['6mm', '8mm', '10mm'], min: [60, 45, 35] },
  { category: 'Electrical', base: 'PLC Fuse', variants: ['2A', '5A', '10A'], min: [40, 30, 24] }
];

const buildSparePartSeeds = () => {
  const parts = [];
  let counter = 1;

  partFamilies.forEach((family) => {
    family.variants.forEach((variant, idx) => {
      parts.push({
        id: `P${String(counter).padStart(3, '0')}`,
        name: `${family.base} ${variant}`,
        category: family.category,
        sizeType: variant,
        minRequired: Number(family.min[idx] || family.min[0] || 10)
      });
      counter += 1;
    });
  });

  return parts;
};

const driverNames = [
  'Rakesh Yadav',
  'Sandeep Rawat',
  'Amit Chauhan',
  'Nitin Dabas',
  'Harish Kale',
  'Prakash Jha',
  'Lokesh Rana',
  'Vikas Maurya',
  'Sohail Khan',
  'Rahul Solanki',
  'Deepak Borse',
  'Gaurav Tomar',
  'Manoj Saini',
  'Arvind Lamba',
  'Shyam Patel',
  'Imran Qureshi'
];

const toISODate = (date) => date.toISOString().slice(0, 10);

const hashCode = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const inventoryQuantity = ({ storeId, itemId, minRequired }) => {
  const key = `${storeId}-${itemId}`;
  const base = hashCode(key) % 501;

  // Ensure mixed edge cases for UI filtering.
  if (base % 17 === 0) return 0;
  if (base % 9 === 0) return Math.max(1, Math.floor(minRequired * 0.35));
  if (base % 5 === 0) return Math.min(500, minRequired + 5 + (base % 40));
  return base;
};

const pick = (arr, idx) => arr[idx % arr.length];

const buildDataset = () => {
  const stores = buildStoreSeeds(100);

  const machines = [];
  let machineCounter = 1;
  stores.forEach((store, storeIndex) => {
    const perStore = 10;
    for (let i = 0; i < perStore; i += 1) {
      const model = machineTemplates[i % machineTemplates.length];
      machines.push({
        id: `M${String(machineCounter).padStart(3, '0')}`,
        name: `${model} ${store.id}-${String(i + 1).padStart(2, '0')}`,
        storeId: store.id
      });
      machineCounter += 1;
    }
  });

  const spareParts = buildSparePartSeeds();

  const inventory = [];
  stores.forEach((store) => {
    spareParts.forEach((item) => {
      inventory.push({
        storeId: store.id,
        itemId: item.id,
        quantity: inventoryQuantity({
          storeId: store.id,
          itemId: item.id,
          minRequired: item.minRequired
        })
      });
    });
  });

  const machineMapping = [];
  machines.forEach((machine, index) => {
    const useCount = 3 + (index % 2); // 3-4 mappings per machine.
    const used = new Set();
    for (let i = 0; i < useCount; i += 1) {
      const seedIdx = (index * 3 + i * 7) % spareParts.length;
      const itemId = spareParts[seedIdx].id;
      if (!used.has(itemId)) {
        machineMapping.push({ machineId: machine.id, itemId });
        used.add(itemId);
      }
    }
  });

  const shipments = [];
  const shipmentCount = 600;
  const startDate = new Date('2025-07-01T00:00:00Z');

  for (let i = 0; i < shipmentCount; i += 1) {
    const fromStore = pick(stores, i);
    let toStore = pick(stores, i + 2);
    if (toStore.id === fromStore.id) {
      toStore = pick(stores, i + 3);
    }

    const type = i % 2 === 0 ? 'outgoing' : 'incoming';
    const status = i < 65 ? 'received' : 'in_transit';
    const mode = i % 3 === 0 ? 'truck' : 'van';
    const driverName = pick(driverNames, i);

    const dispatch = new Date(startDate);
    dispatch.setDate(dispatch.getDate() + i * 3);

    const expected = new Date(dispatch);
    expected.setDate(expected.getDate() + (mode === 'truck' ? 3 : 2) + (i % 3));

    const itemCount = 15 + (i % 6); // 15-20 line items per shipment.
    const items = [];
    const usedItems = new Set();
    for (let j = 0; j < itemCount; j += 1) {
      const spare = pick(spareParts, i * 11 + j * 5);
      if (usedItems.has(spare.id)) {
        continue;
      }
      usedItems.add(spare.id);
      items.push({
        itemId: spare.id,
        qty: 2 + ((i + j) % 45)
      });
    }

    shipments.push({
      id: `SH${String(i + 1).padStart(3, '0')}`,
      type,
      fromStore: fromStore.id,
      toStore: toStore.id,
      items,
      status,
      driverName,
      mode,
      dispatchDate: toISODate(dispatch),
      expectedDate: toISODate(expected)
    });
  }

  return {
    stores,
    machines,
    spareParts,
    inventory,
    machineMapping,
    shipments
  };
};

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const upsertStores = async (stores) => {
  const map = new Map();

  for (const store of stores) {
    const doc = await Store.findOneAndUpdate(
      { name: store.name, address: store.location },
      {
        state: store.location,
        storeHead: store.name,
        contact: '+91-9000000000',
        name: store.name,
        address: store.location,
        phone: '+91-9000000000',
        email: `${store.id.toLowerCase()}@seed-logistics.local`
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    map.set(store.id, String(doc._id));
  }

  return map;
};

const upsertMachines = async (machines, storeIdMap) => {
  const map = new Map();

  for (const machine of machines) {
    const storeMongoId = storeIdMap.get(machine.storeId);
    const doc = await Machine.findOneAndUpdate(
      { name: machine.name, store_id: storeMongoId },
      {
        name: machine.name,
        store_id: storeMongoId,
        quantity_available: 10 + (hashCode(machine.id) % 90),
        minimum_required: 5 + (hashCode(`${machine.id}-min`) % 15),
        warranty_expiry_date: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    map.set(machine.id, String(doc._id));
  }

  return map;
};

const buildMachineMapByStoreAndItem = (dataset) => {
  const byMachine = new Map(dataset.machines.map((m) => [m.id, m]));
  const storeItemToMachineIds = new Map();

  dataset.machineMapping.forEach((mapping) => {
    const machine = byMachine.get(mapping.machineId);
    if (!machine) return;

    const key = `${machine.storeId}::${mapping.itemId}`;
    const current = storeItemToMachineIds.get(key) || [];
    current.push(mapping.machineId);
    storeItemToMachineIds.set(key, current);
  });

  return storeItemToMachineIds;
};

const upsertInventoryAsSpareParts = async (dataset, storeIdMap, machineIdMap) => {
  const spareDocMap = new Map();
  const spareByItemId = new Map(dataset.spareParts.map((item) => [item.id, item]));
  const storeItemToMachineIds = buildMachineMapByStoreAndItem(dataset);

  for (const stock of dataset.inventory) {
    const spareSeed = spareByItemId.get(stock.itemId);
    if (!spareSeed) continue;

    const storeMongoId = storeIdMap.get(stock.storeId);
    const candidates = storeItemToMachineIds.get(`${stock.storeId}::${stock.itemId}`) || [];
    const chosenMachineId = candidates[0] || dataset.machines.find((m) => m.storeId === stock.storeId)?.id;
    const machineMongoId = chosenMachineId ? machineIdMap.get(chosenMachineId) : '';

    if (!storeMongoId || !machineMongoId) {
      continue;
    }

    const normalizedName = String(spareSeed.name || '').trim().toLowerCase();

    const doc = await SparePart.findOneAndUpdate(
      { store_id: storeMongoId, normalized_name: normalizedName },
      {
        name: normalizedName,
        normalized_name: normalizedName,
        machine_id: machineMongoId,
        store_id: storeMongoId,
        quantity_available: Number(stock.quantity || 0),
        minimum_required: Number(spareSeed.minRequired || 0),
        warranty_expiry_date: null,
        is_deleted: false,
        deleted_at: null,
        deleted_by: ''
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    spareDocMap.set(`${stock.storeId}::${stock.itemId}`, String(doc._id));
  }

  return spareDocMap;
};

const upsertShipments = async (dataset, storeIdMap, spareDocMap) => {
  const storeById = new Map(dataset.stores.map((store) => [store.id, store]));
  const spareById = new Map(dataset.spareParts.map((part) => [part.id, part]));

  for (const shipment of dataset.shipments) {
    const fromStore = storeById.get(shipment.fromStore);
    const toStore = storeById.get(shipment.toStore);
    if (!fromStore || !toStore) continue;

    const items = shipment.items
      .map((item) => {
        const part = spareById.get(item.itemId);
        const spareDocId = spareDocMap.get(`${shipment.fromStore}::${item.itemId}`)
          || spareDocMap.get(`${shipment.toStore}::${item.itemId}`)
          || '';

        if (!part) return null;

        return {
          spare_part_id: item.itemId,
          spare_part_name: part.name,
          item_id: spareDocId && mongoose.Types.ObjectId.isValid(spareDocId)
            ? new mongoose.Types.ObjectId(spareDocId)
            : null,
          item_name: part.name,
          normalized_name: String(part.name || '').toLowerCase(),
          quantity: Number(item.qty || 0),
          batch_allocations: []
        };
      })
      .filter(Boolean)
      .filter((item) => Number(item.quantity || 0) > 0);

    if (items.length === 0) {
      continue;
    }

    const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const modeOfTransport = shipment.mode === 'truck' ? 'Truck' : 'Local';

    await Transfer.findOneAndUpdate(
      { notes: `${DATA_TAG}:${shipment.id}` },
      {
        type: shipment.type,
        from_store_id: storeIdMap.get(shipment.fromStore) || '',
        from_store_name: fromStore.name,
        to_store_id: storeIdMap.get(shipment.toStore) || '',
        to_store_name: toStore.name,
        items,
        total_items: totalItems,
        driver: {
          name: shipment.driverName,
          phone: `98${String(hashCode(shipment.id)).slice(0, 8).padEnd(8, '0')}`,
          driver_id: `DRV-${shipment.id}`
        },
        mode_of_transport: modeOfTransport,
        dispatch_date: new Date(`${shipment.dispatchDate}T08:00:00.000Z`),
        expected_delivery_date: new Date(`${shipment.expectedDate}T08:00:00.000Z`),
        status: shipment.status,
        transferred_by: 'Seed Script',
        created_by: 'Seed Script',
        notes: `${DATA_TAG}:${shipment.id}`,
        received_by: shipment.status === 'received' ? 'Auto Receiver' : '',
        received_date: shipment.status === 'received'
          ? new Date(`${shipment.expectedDate}T10:00:00.000Z`)
          : null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

const persistDatasetToFile = (dataset) => {
  ensureDir(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dataset, null, 2), 'utf8');
};

const seedBulkTestData = async () => {
  try {
    const dbConnected = await connectDB();
    if (!dbConnected) {
      throw new Error('MongoDB not connected. Set MONGO_URI and retry.');
    }

    console.log('Connected to MongoDB. Building logistics ERP dataset...');
    const dataset = buildDataset();

    console.log('Upserting stores...');
    const storeIdMap = await upsertStores(dataset.stores);

    console.log('Upserting machines...');
    const machineIdMap = await upsertMachines(dataset.machines, storeIdMap);

    console.log('Upserting inventory as spare parts...');
    const spareDocMap = await upsertInventoryAsSpareParts(dataset, storeIdMap, machineIdMap);

    console.log('Upserting shipment records...');
    await upsertShipments(dataset, storeIdMap, spareDocMap);

    persistDatasetToFile(dataset);

    console.log('Dataset seeded successfully.');
    console.log(`Stores: ${dataset.stores.length}`);
    console.log(`Machines: ${dataset.machines.length}`);
    console.log(`Spare parts: ${dataset.spareParts.length}`);
    console.log(`Inventory rows: ${dataset.inventory.length}`);
    console.log(`Machine mappings: ${dataset.machineMapping.length}`);
    console.log(`Shipments: ${dataset.shipments.length}`);
    console.log(`JSON output: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Logistics ERP dataset seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedBulkTestData();
