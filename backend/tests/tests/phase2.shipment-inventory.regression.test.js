const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(30000);

jest.mock('../../config/db', () => jest.fn(async () => true));

describe('Phase 2 - Shipment + Inventory Reliability', () => {
  let app;
  let SparePart;
  let Transfer;
  let mongoServer;
  let authToken;
  let jwtSecret;

  const authHeader = () => ({ Authorization: `Bearer ${authToken}` });

  const seedSpare = async ({ name, storeId, machineId, quantity }) => {
    return SparePart.create({
      name,
      normalized_name: String(name || '').trim().toLowerCase(),
      machine_id: machineId,
      machine_ids: [machineId],
      store_id: storeId,
      quantity_available: quantity,
      minimum_required: 1
    });
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    process.env.NODE_ENV = 'test';
    process.env.ALLOW_UNSAFE_DESTRUCTIVE_AUTH_BYPASS = 'false';
    process.env.MONGO_URI = mongoServer.getUri();

    await mongoose.connect(process.env.MONGO_URI, { dbName: 'phase2-shipment-regression' });

    app = require('../../server');
    SparePart = require('../../src/models/SparePart');
    Transfer = require('../../src/models/Transfer');
    ({ jwtSecret } = require('../../src/config'));

    authToken = jwt.sign({ id: `phase2-user-${Date.now()}` }, jwtSecret, { expiresIn: '1d' });
  });

  afterEach(async () => {
    await Transfer.deleteMany({});
    await SparePart.deleteMany({});
  });

  afterAll(async () => {
    await Transfer.deleteMany({});
    await SparePart.deleteMany({});
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('dispatch + incoming receive updates inventory only at the right stages', async () => {
    const storeA = new mongoose.Types.ObjectId().toString();
    const storeB = new mongoose.Types.ObjectId().toString();
    const machineId = new mongoose.Types.ObjectId().toString();

    const sourcePart = await seedSpare({
      name: 'Hydraulic Valve',
      storeId: storeA,
      machineId,
      quantity: 30
    });

    const outgoingCreate = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: String(sourcePart._id), quantity: 6 }],
        driver: { name: 'Driver Out', phone: '9000000001', driver_id: 'DRV-OUT-1' },
        dispatch_date: '2026-03-28',
        expected_delivery_date: '2026-03-29',
        transferred_by: 'Phase2 Tester'
      });

    expect(outgoingCreate.status).toBe(201);
    expect(outgoingCreate.body?.data?.transfer?.status).toBe('in_transit');

    const sourceAfterDispatch = await SparePart.findById(sourcePart._id).lean();
    expect(Number(sourceAfterDispatch.quantity_available)).toBe(24);

    const destinationBeforeIncomingReceive = await SparePart.findOne({
      store_id: storeB,
      normalized_name: 'hydraulic valve'
    }).lean();
    expect(destinationBeforeIncomingReceive).toBeNull();

    const incomingCreate = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'incoming',
        from_external_name: 'Vendor Alpha',
        from_store_name: 'Vendor Alpha',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: String(sourcePart._id), quantity: 4 }],
        driver: { name: 'Driver In', phone: '9000000002', driver_id: 'DRV-IN-1' },
        dispatch_date: '2026-03-28',
        expected_delivery_date: '2026-03-30',
        transferred_by: 'Phase2 Tester'
      });

    expect(incomingCreate.status).toBe(201);
    expect(incomingCreate.body?.data?.transfer?.status).toBe('in_transit');

    const destinationStillNotCredited = await SparePart.findOne({
      store_id: storeB,
      normalized_name: 'hydraulic valve'
    }).lean();
    expect(destinationStillNotCredited).toBeNull();

    const incomingTransferId = incomingCreate.body?.data?.transfer?.id;
    const receiveIncoming = await request(app)
      .patch(`/api/transfers/${incomingTransferId}/receive`)
      .set(authHeader())
      .send({
        confirmationBy: 'Receiver One',
        confirmationDate: '2026-03-30',
        notes: 'Dock 2'
      });

    expect(receiveIncoming.status).toBe(200);
    expect(receiveIncoming.body?.data?.transfer?.status).toBe('received');
    expect(receiveIncoming.body?.data?.transfer?.confirmed_by).toBe('Receiver One');

    const destinationAfterReceive = await SparePart.findOne({
      store_id: storeB,
      normalized_name: 'hydraulic valve'
    }).lean();
    expect(destinationAfterReceive).not.toBeNull();
    expect(Number(destinationAfterReceive.quantity_available)).toBe(4);
  });

  it('confirm-receive is idempotent and never double-credits inventory', async () => {
    const destinationStore = new mongoose.Types.ObjectId().toString();
    const sourceStore = new mongoose.Types.ObjectId().toString();
    const machineId = new mongoose.Types.ObjectId().toString();

    const catalogPart = await seedSpare({
      name: 'Control Board',
      storeId: sourceStore,
      machineId,
      quantity: 50
    });

    const incomingCreate = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'incoming',
        from_external_name: 'Vendor Beta',
        from_store_name: 'Vendor Beta',
        to_store_id: destinationStore,
        to_store_name: 'Store C',
        items: [{ spare_part_id: String(catalogPart._id), quantity: 3 }],
        driver: { name: 'Driver In 2', phone: '9000000003', driver_id: 'DRV-IN-2' },
        dispatch_date: '2026-03-27',
        expected_delivery_date: '2026-03-31',
        transferred_by: 'Phase2 Tester'
      });

    expect(incomingCreate.status).toBe(201);
    const transferId = incomingCreate.body?.data?.transfer?.id;

    const firstReceive = await request(app)
      .patch(`/api/transfers/${transferId}/receive`)
      .set(authHeader())
      .send({ confirmationBy: 'Receiver Two', confirmationDate: '2026-03-31' });

    expect(firstReceive.status).toBe(200);

    const secondReceive = await request(app)
      .put(`/api/transfers/${transferId}/receive`)
      .set(authHeader())
      .send({ confirmationBy: 'Receiver Two', confirmationDate: '2026-03-31' });

    expect(secondReceive.status).toBe(409);
    expect(String(secondReceive.body?.message || '').toLowerCase()).toContain('already marked as received');

    const destinationInventory = await SparePart.findOne({
      store_id: destinationStore,
      normalized_name: 'control board'
    }).lean();
    expect(destinationInventory).not.toBeNull();
    expect(Number(destinationInventory.quantity_available)).toBe(3);
  });

  it('transfer history keeps complete records and store filtering is consistent', async () => {
    const storeA = new mongoose.Types.ObjectId().toString();
    const storeB = new mongoose.Types.ObjectId().toString();
    const storeC = new mongoose.Types.ObjectId().toString();
    const machineId = new mongoose.Types.ObjectId().toString();

    const partA = await seedSpare({
      name: 'Linear Guide',
      storeId: storeA,
      machineId,
      quantity: 12
    });

    const outgoing = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: String(partA._id), quantity: 2 }],
        driver: { name: 'Driver Out 2', phone: '9000000004', driver_id: 'DRV-OUT-2' },
        dispatch_date: '2026-03-25',
        expected_delivery_date: '2026-03-27',
        transferred_by: 'Phase2 Tester'
      });
    expect(outgoing.status).toBe(201);

    const incoming = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'incoming',
        from_external_name: 'Vendor Gamma',
        from_store_name: 'Vendor Gamma',
        to_store_id: storeC,
        to_store_name: 'Store C',
        items: [{ spare_part_id: String(partA._id), quantity: 5 }],
        driver: { name: 'Driver In 3', phone: '9000000005', driver_id: 'DRV-IN-3' },
        dispatch_date: '2026-03-25',
        expected_delivery_date: '2026-03-28',
        transferred_by: 'Phase2 Tester'
      });
    expect(incoming.status).toBe(201);

    const incomingId = incoming.body?.data?.transfer?.id;
    const receive = await request(app)
      .patch(`/api/transfers/${incomingId}/receive`)
      .set(authHeader())
      .send({ confirmationBy: 'Receiver Three', confirmationDate: '2026-03-28' });
    expect(receive.status).toBe(200);

    const historyAll = await request(app).get('/api/transfer-history');
    expect(historyAll.status).toBe(200);
    const allTransfers = historyAll.body?.data?.transfers || [];

    const outgoingId = outgoing.body?.data?.transfer?.id;
    expect(allTransfers.some((t) => String(t._id) === String(outgoingId))).toBe(true);
    expect(allTransfers.some((t) => String(t._id) === String(incomingId))).toBe(true);

    const incomingRecord = allTransfers.find((t) => String(t._id) === String(incomingId));
    expect(incomingRecord).toBeDefined();
    expect(incomingRecord.status).toBe('received');
    expect(incomingRecord.received_date).toBeTruthy();
    expect(incomingRecord.confirmed_by).toBe('Receiver Three');

    const historyStoreB = await request(app).get(`/api/transfer-history?storeId=${storeB}`);
    expect(historyStoreB.status).toBe(200);

    const filtered = historyStoreB.body?.data?.transfers || [];
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((t) => String(t.from_store_id) === String(storeB) || String(t.to_store_id) === String(storeB))
    ).toBe(true);
  });

  it('delayed tab returns only in-transit shipments past expected delivery date', async () => {
    const storeA = new mongoose.Types.ObjectId().toString();
    const storeB = new mongoose.Types.ObjectId().toString();
    const machineId = new mongoose.Types.ObjectId().toString();

    const part = await seedSpare({
      name: 'Thermal Sensor',
      storeId: storeA,
      machineId,
      quantity: 18
    });

    const delayedRes = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: String(part._id), quantity: 3 }],
        driver: { name: 'Driver Delay', phone: '9000000010', driver_id: 'DRV-DLY-1' },
        dispatch_date: '2026-03-20',
        expected_delivery_date: '2026-03-21',
        transferred_by: 'Phase2 Tester'
      });
    expect(delayedRes.status).toBe(201);

    const completedRes = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'internal',
        isInstant: true,
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: String(part._id), quantity: 1 }],
        transferred_by: 'Phase2 Tester'
      });
    expect(completedRes.status).toBe(201);

    const delayedTab = await request(app).get('/api/transfers?tab=delayed');
    expect(delayedTab.status).toBe(200);

    const transfers = delayedTab.body?.data || [];
    const delayedId = delayedRes.body?.data?.transfer?.id;
    expect(transfers.some((t) => String(t.id) === String(delayedId))).toBe(true);
    expect(transfers.every((t) => t.status === 'in_transit')).toBe(true);
  });

  it('concurrent outgoing dispatches never oversell source inventory', async () => {
    const storeA = new mongoose.Types.ObjectId().toString();
    const storeB = new mongoose.Types.ObjectId().toString();
    const machineId = new mongoose.Types.ObjectId().toString();

    const part = await seedSpare({
      name: 'Servo Motor',
      storeId: storeA,
      machineId,
      quantity: 10
    });

    const payload = {
      type: 'outgoing',
      from_store_id: storeA,
      from_store_name: 'Store A',
      to_store_id: storeB,
      to_store_name: 'Store B',
      items: [{ spare_part_id: String(part._id), quantity: 8 }],
      driver: { name: 'Driver Race', phone: '9000000011', driver_id: 'DRV-RACE-1' },
      dispatch_date: '2026-03-24',
      expected_delivery_date: '2026-03-25',
      transferred_by: 'Phase2 Tester'
    };

    const [r1, r2] = await Promise.all([
      request(app).post('/api/transfers').set(authHeader()).send(payload),
      request(app).post('/api/transfers').set(authHeader()).send(payload)
    ]);

    const successCount = [r1, r2].filter((r) => r.status === 201).length;
    const failureCount = [r1, r2].filter((r) => r.status === 400).length;
    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    const sourceAfter = await SparePart.findById(part._id).lean();
    expect(Number(sourceAfter.quantity_available)).toBe(2);
  });

  it('incoming receive can be followed by outgoing redispatch with consistent stock math', async () => {
    const sourceStore = new mongoose.Types.ObjectId().toString();
    const middleStore = new mongoose.Types.ObjectId().toString();
    const destinationStore = new mongoose.Types.ObjectId().toString();
    const machineId = new mongoose.Types.ObjectId().toString();

    const part = await seedSpare({
      name: 'Pressure Gauge',
      storeId: sourceStore,
      machineId,
      quantity: 40
    });

    const incoming = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'incoming',
        from_external_name: 'Vendor Delta',
        from_store_name: 'Vendor Delta',
        to_store_id: middleStore,
        to_store_name: 'Store Mid',
        items: [{ spare_part_id: String(part._id), quantity: 7 }],
        driver: { name: 'Driver Chain In', phone: '9000000012', driver_id: 'DRV-CHN-IN' },
        dispatch_date: '2026-03-26',
        expected_delivery_date: '2026-03-27',
        transferred_by: 'Phase2 Tester'
      });
    expect(incoming.status).toBe(201);

    const incomingId = incoming.body?.data?.transfer?.id;
    const receive = await request(app)
      .patch(`/api/transfers/${incomingId}/receive`)
      .set(authHeader())
      .send({ confirmationBy: 'Receiver Chain', confirmationDate: '2026-03-27' });
    expect(receive.status).toBe(200);

    const middleBeforeDispatch = await SparePart.findOne({
      store_id: middleStore,
      normalized_name: 'pressure gauge'
    }).lean();
    expect(Number(middleBeforeDispatch.quantity_available)).toBe(7);

    const outgoing = await request(app)
      .post('/api/transfers')
      .set(authHeader())
      .send({
        type: 'outgoing',
        from_store_id: middleStore,
        from_store_name: 'Store Mid',
        to_store_id: destinationStore,
        to_store_name: 'Store End',
        items: [{ spare_part_id: String(middleBeforeDispatch._id), quantity: 4 }],
        driver: { name: 'Driver Chain Out', phone: '9000000013', driver_id: 'DRV-CHN-OUT' },
        dispatch_date: '2026-03-27',
        expected_delivery_date: '2026-03-28',
        transferred_by: 'Phase2 Tester'
      });
    expect(outgoing.status).toBe(201);

    const middleAfterDispatch = await SparePart.findOne({
      store_id: middleStore,
      normalized_name: 'pressure gauge'
    }).lean();
    expect(Number(middleAfterDispatch.quantity_available)).toBe(3);

    const destinationBeforeReceive = await SparePart.findOne({
      store_id: destinationStore,
      normalized_name: 'pressure gauge'
    }).lean();
    expect(destinationBeforeReceive).toBeNull();
  });
});
