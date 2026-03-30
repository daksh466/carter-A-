const request = require('supertest');
const app = require('../../server');
const SparePart = require('../../models/SparePart');
const mongoose = require('mongoose');

describe('Transfer Edge Cases', () => {
  let storeA, storeB, partA, partB;

  beforeAll(async () => {
    // Setup two stores and two parts
    storeA = new mongoose.Types.ObjectId().toString();
    storeB = new mongoose.Types.ObjectId().toString();
    const machineId = new mongoose.Types.ObjectId().toString();
    await SparePart.deleteMany({ store_id: { $in: [storeA, storeB] } });
    partA = await SparePart.create({
      name: 'Widget',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 10,
      minimum_required: 1
    });
    partB = await SparePart.create({
      name: 'widget', // lower-case to test case-insensitive merge
      machine_id: machineId,
      store_id: storeB,
      quantity_available: 5,
      minimum_required: 1
    });
  });

  afterAll(async () => {
    await SparePart.deleteMany({ store_id: { $in: [storeA, storeB] } });
    await mongoose.connection.close();
  });

  it('should not allow transfer to the same store', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        from_store_id: storeA,
        to_store_id: storeA,
        items: [{ spare_part_id: partA._id, quantity: 2 }],
        transferred_by: 'test'
      });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Cannot transfer to the same store');
  });

  it('should not allow transfer with insufficient stock', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        from_store_id: storeA,
        to_store_id: storeB,
        items: [{ spare_part_id: partA._id, quantity: 100 }],
        transferred_by: 'test'
      });
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/Insufficient stock/);
  });

  it('should merge destination by normalized_name (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        from_store_id: storeA,
        to_store_id: storeB,
        items: [{ spare_part_id: partA._id, quantity: 3 }],
        transferred_by: 'test'
      });
    expect(res.status).toBe(201);
    // Destination partB should have increased quantity
    const updated = await SparePart.findOne({ store_id: storeB, normalized_name: 'widget' });
    expect(updated.quantity_available).toBe(8);
  });

  it('should handle concurrent transfers safely', async () => {
    // Simulate two transfers at once
    const transferPayload = {
      from_store_id: storeB,
      to_store_id: storeA,
      items: [{ spare_part_id: partB._id, quantity: 6 }],
      transferred_by: 'test-concurrent'
    };
    const [res1, res2] = await Promise.all([
      request(app).post('/api/transfers').send(transferPayload),
      request(app).post('/api/transfers').send(transferPayload)
    ]);
    // Only one should succeed due to stock
    const successCount = [res1, res2].filter(r => r.status === 201).length;
    expect(successCount).toBe(1);
  });

  it('should decrease stock on outgoing and increase stock on receive', async () => {
    const machineId = new mongoose.Types.ObjectId().toString();
    const sourcePart = await SparePart.create({
      name: 'Flow Valve',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 12,
      minimum_required: 1
    });

    const createRes = await request(app)
      .post('/api/transfers')
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: sourcePart._id, quantity: 4 }],
        approved_by: 'Supervisor',
        approved_date: '2026-03-24',
        dispatch_date: '2026-03-24',
        expected_delivery_date: '2026-03-25',
        driver: {
          name: 'A Driver',
          phone: '9999999999',
          driver_id: 'DRV-001'
        },
        transferred_by: 'test'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body?.data?.transfer?.status).toBe('in_transit');

    const sourceAfterDispatch = await SparePart.findById(sourcePart._id);
    expect(Number(sourceAfterDispatch.quantity_available)).toBe(8);

    const destinationBeforeReceive = await SparePart.findOne({
      store_id: storeB,
      normalized_name: 'flow valve'
    });
    expect(destinationBeforeReceive).toBeNull();

    const receiveRes = await request(app)
      .patch(`/api/transfers/${createRes.body?.data?.transfer?.id}/receive`)
      .send({
        receivedDate: '2026-03-25',
        receivedBy: 'Receiver'
      });

    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body?.data?.transfer?.status).toBe('received');

    const sourceAfterReceive = await SparePart.findById(sourcePart._id);
    expect(Number(sourceAfterReceive.quantity_available)).toBe(8);

    const destinationAfterReceive = await SparePart.findOne({
      store_id: storeB,
      normalized_name: 'flow valve'
    });
    expect(destinationAfterReceive).not.toBeNull();
    expect(Number(destinationAfterReceive.quantity_available)).toBe(4);

    const receiveAgainRes = await request(app)
      .put(`/api/transfers/${createRes.body?.data?.transfer?.id}/receive`)
      .send({
        receivedDate: '2026-03-25',
        receivedBy: 'Receiver Again'
      });

    expect(receiveAgainRes.status).toBe(409);
    expect(receiveAgainRes.body?.message).toMatch(/already marked as received/i);

    const destinationAfterSecondReceive = await SparePart.findOne({
      store_id: storeB,
      normalized_name: 'flow valve'
    });
    expect(destinationAfterSecondReceive).not.toBeNull();
    expect(Number(destinationAfterSecondReceive.quantity_available)).toBe(4);
  });
});
