const request = require('supertest');
const app = require('../../server');
const Transfer = require('../../src/models/Transfer');
const SparePart = require('../../src/models/SparePart');
const mongoose = require('mongoose');

describe('Step 2 Safety Checks - Receive + FEFO Determinism', () => {
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

  it('receiving same batch across multiple shipments merges into one destination batch row', async () => {
    const sourcePart = await SparePart.create({
      name: 'Gear Assembly',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 30,
      minimum_required: 1
    });

    const destPart = await SparePart.create({
      name: 'Gear Assembly',
      machine_id: machineId,
      store_id: storeB,
      quantity_available: 5,
      minimum_required: 1,
      batches: [
        {
          batch_number: 'GA-001',
          quantity: 5,
          expiry_date: new Date('2027-12-31T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        }
      ]
    });

    const createIncoming = async (qty) => Transfer.create({
      type: 'incoming',
      from_external_name: 'Vendor One',
      from_store_name: 'Vendor One',
      to_store_id: storeB,
      to_store_name: 'Store B',
      dispatch_date: new Date('2026-03-20T00:00:00.000Z'),
      expected_delivery_date: new Date('2026-03-21T00:00:00.000Z'),
      status: 'in_transit',
      total_items: 1,
      items: [
        {
          spare_part_id: sourcePart._id.toString(),
          spare_part_name: 'Gear Assembly',
          item_id: sourcePart._id,
          item_name: 'Gear Assembly',
          normalized_name: 'gear assembly',
          machine_id: machineId,
          minimum_required: 1,
          quantity: qty,
          batch_allocations: [
            {
              source_batch_number: 'GA-001',
              destination_batch_number: 'GA-001',
              quantity: qty,
              expiry_date: new Date('2027-12-31T00:00:00.000Z')
            }
          ]
        }
      ]
    });

    const t1 = await createIncoming(4);
    const t2 = await createIncoming(6);

    const r1 = await request(app)
      .patch(`/api/transfers/${t1._id}/receive`)
      .send({ confirmationBy: 'Receiver', confirmationDate: '2026-03-21' });
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .patch(`/api/transfers/${t2._id}/receive`)
      .send({ confirmationBy: 'Receiver', confirmationDate: '2026-03-22' });
    expect(r2.status).toBe(200);

    const updated = await SparePart.findById(destPart._id).lean();
    const gaRows = (updated.batches || []).filter((b) => String(b.batch_number).toLowerCase() === 'ga-001');

    expect(gaRows.length).toBe(1);
    expect(Number(gaRows[0].quantity)).toBe(15); // 5 + 4 + 6
    expect(Number(updated.quantity_available)).toBe(15);
  });

  it('existing zero-quantity destination batches do not affect aggregate quantity sync on receive', async () => {
    const sourcePart = await SparePart.create({
      name: 'Control Relay',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 12,
      minimum_required: 1
    });

    const destPart = await SparePart.create({
      name: 'Control Relay',
      machine_id: machineId,
      store_id: storeB,
      quantity_available: 8,
      minimum_required: 1,
      batches: [
        {
          batch_number: 'CR-001',
          quantity: 8,
          expiry_date: new Date('2027-10-31T00:00:00.000Z'),
          received_date: new Date('2026-01-05T00:00:00.000Z')
        },
        {
          batch_number: 'CR-ZERO',
          quantity: 0,
          expiry_date: new Date('2029-01-31T00:00:00.000Z'),
          received_date: new Date('2026-01-06T00:00:00.000Z')
        }
      ]
    });

    const transfer = await Transfer.create({
      type: 'incoming',
      from_external_name: 'Vendor Two',
      from_store_name: 'Vendor Two',
      to_store_id: storeB,
      to_store_name: 'Store B',
      dispatch_date: new Date('2026-03-20T00:00:00.000Z'),
      expected_delivery_date: new Date('2026-03-21T00:00:00.000Z'),
      status: 'in_transit',
      total_items: 1,
      items: [
        {
          spare_part_id: sourcePart._id.toString(),
          spare_part_name: 'Control Relay',
          item_id: sourcePart._id,
          item_name: 'Control Relay',
          normalized_name: 'control relay',
          machine_id: machineId,
          minimum_required: 1,
          quantity: 4,
          batch_allocations: [
            {
              source_batch_number: 'CR-003',
              destination_batch_number: 'CR-003',
              quantity: 4,
              expiry_date: new Date('2028-02-28T00:00:00.000Z')
            }
          ]
        }
      ]
    });

    const res = await request(app)
      .patch(`/api/transfers/${transfer._id}/receive`)
      .send({ confirmationBy: 'Receiver', confirmationDate: '2026-03-21' });

    expect(res.status).toBe(200);

    const updated = await SparePart.findById(destPart._id).lean();
    const batchNumbers = (updated.batches || []).map((b) => b.batch_number);
    expect(batchNumbers).toContain('CR-001');
    expect(batchNumbers).toContain('CR-003');
    expect(batchNumbers.filter((name) => name === 'CR-003').length).toBe(1);

    const sum = (updated.batches || []).reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    expect(sum).toBe(12); // 8 + 4
    expect(Number(updated.quantity_available)).toBe(12);
    const zeroQuantityTotal = (updated.batches || [])
      .filter((b) => Number(b.quantity || 0) === 0)
      .reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    expect(zeroQuantityTotal).toBe(0);
  });

  it('FEFO allocation order is deterministic with tie-breaker by batch_number when expiry and received dates match', async () => {
    const sourcePart = await SparePart.create({
      name: 'Bearing Kit',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 20,
      minimum_required: 1,
      batches: [
        {
          batch_number: 'BK-C',
          quantity: 5,
          expiry_date: new Date('2027-12-31T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'BK-A',
          quantity: 5,
          expiry_date: new Date('2027-12-31T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'BK-B',
          quantity: 5,
          expiry_date: new Date('2027-12-31T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'BK-Z',
          quantity: 5,
          expiry_date: new Date('2028-01-31T00:00:00.000Z'),
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
        items: [{ spare_part_id: sourcePart._id.toString(), quantity: 12 }],
        approved_by: 'Supervisor',
        approved_date: '2026-03-20',
        dispatch_date: '2026-03-20',
        expected_delivery_date: '2026-03-21',
        driver: {
          name: 'Determinism Driver',
          phone: '9999999999',
          driver_id: 'DRV-DETERMINISM-1'
        },
        transferred_by: 'Determinism Tester'
      });

    expect(createRes.status).toBe(201);

    const allocations = createRes.body?.data?.transfer?.items?.[0]?.batch_allocations || [];
    const order = allocations.map((a) => a.source_batch_number);

    expect(order).toEqual(['BK-A', 'BK-B', 'BK-C']);
    expect(Number(allocations[0]?.quantity || 0)).toBe(5);
    expect(Number(allocations[1]?.quantity || 0)).toBe(5);
    expect(Number(allocations[2]?.quantity || 0)).toBe(2);
  });

  it('SPAREPART_BATCH_DEBUG logs are silent by default', async () => {
    const priorEnv = process.env.SPAREPART_BATCH_DEBUG;
    delete process.env.SPAREPART_BATCH_DEBUG;

    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

    const sourcePart = await SparePart.create({
      name: 'Logging Check Part',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 9,
      minimum_required: 1
    });

    const transfer = await Transfer.create({
      type: 'incoming',
      from_external_name: 'Vendor Log',
      from_store_name: 'Vendor Log',
      to_store_id: storeB,
      to_store_name: 'Store B',
      dispatch_date: new Date('2026-03-20T00:00:00.000Z'),
      expected_delivery_date: new Date('2026-03-21T00:00:00.000Z'),
      status: 'in_transit',
      total_items: 1,
      items: [
        {
          spare_part_id: sourcePart._id.toString(),
          spare_part_name: 'Logging Check Part',
          item_id: sourcePart._id,
          item_name: 'Logging Check Part',
          normalized_name: 'logging check part',
          machine_id: machineId,
          minimum_required: 1,
          quantity: 9,
          batch_allocations: [
            {
              source_batch_number: 'LCP-1',
              destination_batch_number: 'LCP-1',
              quantity: 9,
              expiry_date: new Date('2027-12-31T00:00:00.000Z')
            }
          ]
        }
      ]
    });

    const receiveRes = await request(app)
      .patch(`/api/transfers/${transfer._id}/receive`)
      .send({ confirmationBy: 'Receiver', confirmationDate: '2026-03-21' });

    expect(receiveRes.status).toBe(200);
    expect(debugSpy).not.toHaveBeenCalled();

    debugSpy.mockRestore();
    if (typeof priorEnv === 'undefined') {
      delete process.env.SPAREPART_BATCH_DEBUG;
    } else {
      process.env.SPAREPART_BATCH_DEBUG = priorEnv;
    }
  });
});
