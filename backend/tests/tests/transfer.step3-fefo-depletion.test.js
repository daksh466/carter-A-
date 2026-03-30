const request = require('supertest');
const app = require('../../server');
const Transfer = require('../../src/models/Transfer');
const SparePart = require('../../src/models/SparePart');
const mongoose = require('mongoose');

describe('Step 3 - FEFO Allocation Correctness + Depletion', () => {
  let storeA;
  let storeB;
  let machineId;

  beforeEach(async () => {
    storeA = new mongoose.Types.ObjectId().toString();
    storeB = new mongoose.Types.ObjectId().toString();
    machineId = new mongoose.Types.ObjectId().toString();
  });

  afterEach(async () => {
    await Transfer.deleteMany({});
    await SparePart.deleteMany({ store_id: { $in: [storeA, storeB] } });
  });

  it('allocates by FEFO: expiry_date -> received_date -> batch_number', async () => {
    const sourcePart = await SparePart.create({
      name: 'Hydraulic Seal',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 21,
      minimum_required: 1,
      batches: [
        {
          batch_number: 'HS-LATE',
          quantity: 6,
          expiry_date: new Date('2028-01-31T00:00:00.000Z'),
          received_date: new Date('2026-02-01T00:00:00.000Z')
        },
        {
          batch_number: 'HS-A2',
          quantity: 5,
          expiry_date: new Date('2027-06-30T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'HS-A1',
          quantity: 5,
          expiry_date: new Date('2027-06-30T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'HS-EARLY-RECEIVED',
          quantity: 5,
          expiry_date: new Date('2027-06-30T00:00:00.000Z'),
          received_date: new Date('2025-12-31T00:00:00.000Z')
        }
      ]
    });

    const createRes = await request(app)
      .post('/api/transfers')
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: sourcePart._id.toString(), quantity: 12 }],
        approved_by: 'Supervisor',
        approved_date: '2026-03-20',
        dispatch_date: '2026-03-20',
        expected_delivery_date: '2026-03-21',
        driver: {
          name: 'Step3 Driver',
          phone: '9999999999',
          driver_id: 'DRV-STEP3-1'
        },
        transferred_by: 'Step3 Tester'
      });

    expect(createRes.status).toBe(201);

    const allocations = createRes.body?.data?.transfer?.items?.[0]?.batch_allocations || [];
    const order = allocations.map((a) => a.source_batch_number);
    const qtys = allocations.map((a) => Number(a.quantity || 0));

    // FEFO expected order:
    // 1) earliest expiry + earliest received: HS-EARLY-RECEIVED (5)
    // 2) same expiry/received tie broken by batch_number: HS-A1 then HS-A2
    expect(order).toEqual(['HS-EARLY-RECEIVED', 'HS-A1', 'HS-A2']);
    expect(qtys).toEqual([5, 5, 2]);
  });

  it('depletes source batches correctly and syncs source quantity_available after outgoing transfer', async () => {
    const sourcePart = await SparePart.create({
      name: 'Valve Kit',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 18,
      minimum_required: 1,
      batches: [
        {
          batch_number: 'VK-1',
          quantity: 4,
          expiry_date: new Date('2027-05-31T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'VK-2',
          quantity: 7,
          expiry_date: new Date('2027-06-30T00:00:00.000Z'),
          received_date: new Date('2026-01-02T00:00:00.000Z')
        },
        {
          batch_number: 'VK-3',
          quantity: 7,
          expiry_date: new Date('2028-01-31T00:00:00.000Z'),
          received_date: new Date('2026-01-03T00:00:00.000Z')
        }
      ]
    });

    const createRes = await request(app)
      .post('/api/transfers')
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: sourcePart._id.toString(), quantity: 10 }],
        approved_by: 'Supervisor',
        approved_date: '2026-03-20',
        dispatch_date: '2026-03-20',
        expected_delivery_date: '2026-03-21',
        driver: {
          name: 'Step3 Driver',
          phone: '9999999999',
          driver_id: 'DRV-STEP3-2'
        },
        transferred_by: 'Step3 Tester'
      });

    expect(createRes.status).toBe(201);

    const updatedSource = await SparePart.findById(sourcePart._id).lean();
    const byBatch = new Map((updatedSource.batches || []).map((b) => [b.batch_number, Number(b.quantity || 0)]));

    // Depletion expected by FEFO:
    // VK-1 fully depleted (4), VK-2 partially depleted by 6 (remaining 1), VK-3 untouched
    expect(byBatch.has('VK-1')).toBe(false);
    expect(byBatch.get('VK-2')).toBe(1);
    expect(byBatch.get('VK-3')).toBe(7);
    expect((updatedSource.batches || []).every((b) => Number(b.quantity || 0) >= 0)).toBe(true);

    const sum = (updatedSource.batches || []).reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    expect(sum).toBe(8);
    expect(Number(updatedSource.quantity_available)).toBe(8);
  });

  it('returns validation failure when requested outgoing quantity exceeds lot stock', async () => {
    const sourcePart = await SparePart.create({
      name: 'Pump Rotor',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 5,
      minimum_required: 1,
      batches: [
        {
          batch_number: 'PR-1',
          quantity: 2,
          expiry_date: new Date('2027-03-31T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'PR-2',
          quantity: 3,
          expiry_date: new Date('2027-04-30T00:00:00.000Z'),
          received_date: new Date('2026-01-02T00:00:00.000Z')
        }
      ]
    });

    const createRes = await request(app)
      .post('/api/transfers')
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: sourcePart._id.toString(), quantity: 8 }],
        approved_by: 'Supervisor',
        approved_date: '2026-03-20',
        dispatch_date: '2026-03-20',
        expected_delivery_date: '2026-03-21',
        driver: {
          name: 'Step3 Driver',
          phone: '9999999999',
          driver_id: 'DRV-STEP3-3'
        },
        transferred_by: 'Step3 Tester'
      });

    expect(createRes.status).toBe(400);
    expect(createRes.body?.message).toBe('Validation failed');
    expect(Array.isArray(createRes.body?.errors)).toBe(true);
    const firstError = String(createRes.body.errors[0] || '').toLowerCase();
    expect(firstError.includes('insufficient lot stock') || firstError.includes('insufficient stock')).toBe(true);
  });
});
