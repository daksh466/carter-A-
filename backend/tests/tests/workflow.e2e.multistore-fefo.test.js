const request = require('supertest');
const app = require('../../server');
const Transfer = require('../../src/models/Transfer');
const SparePart = require('../../src/models/SparePart');
const mongoose = require('mongoose');

describe('E2E Multi-Store Workflow - Transfer, Receive, FEFO Depletion', () => {
  let storeA;
  let storeB;
  let storeC;
  let machineId;

  beforeEach(async () => {
    storeA = new mongoose.Types.ObjectId().toString();
    storeB = new mongoose.Types.ObjectId().toString();
    storeC = new mongoose.Types.ObjectId().toString();
    machineId = new mongoose.Types.ObjectId().toString();
  });

  afterEach(async () => {
    await Transfer.deleteMany({});
    await SparePart.deleteMany({ store_id: { $in: [storeA, storeB, storeC] } });
  });

  it('create -> transfer -> receive -> FEFO depletion -> inventory validation across stores', async () => {
    const sourceA = await SparePart.create({
      name: 'Compressor Seal',
      machine_id: machineId,
      store_id: storeA,
      quantity_available: 24,
      minimum_required: 2,
      batches: [
        {
          batch_number: 'CS-A',
          quantity: 8,
          expiry_date: new Date('2027-06-30T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          batch_number: 'CS-B',
          quantity: 8,
          expiry_date: new Date('2027-09-30T00:00:00.000Z'),
          received_date: new Date('2026-01-15T00:00:00.000Z')
        },
        {
          batch_number: 'CS-C',
          quantity: 8,
          expiry_date: new Date('2028-01-31T00:00:00.000Z'),
          received_date: new Date('2026-02-01T00:00:00.000Z')
        }
      ]
    });

    // 1) Create outgoing transfer A -> B (depletes A by FEFO)
    const transferAB = await request(app)
      .post('/api/transfers')
      .send({
        type: 'outgoing',
        from_store_id: storeA,
        from_store_name: 'Store A',
        to_store_id: storeB,
        to_store_name: 'Store B',
        items: [{ spare_part_id: sourceA._id.toString(), quantity: 10 }],
        approved_by: 'Ops Manager',
        approved_date: '2026-03-20',
        dispatch_date: '2026-03-20',
        expected_delivery_date: '2026-03-21',
        driver: { name: 'Driver AB', phone: '9000000101', driver_id: 'DRV-AB-1' },
        transferred_by: 'E2E Tester'
      });

    expect(transferAB.status).toBe(201);
    const abId = transferAB.body?.data?.transfer?.id;
    expect(transferAB.body?.data?.transfer?.status).toBe('in_transit');

    const abAllocations = transferAB.body?.data?.transfer?.items?.[0]?.batch_allocations || [];
    expect(abAllocations.map((a) => a.source_batch_number)).toEqual(['CS-A', 'CS-B']);
    expect(abAllocations.map((a) => Number(a.quantity || 0))).toEqual([8, 2]);

    const sourceAAfterDispatch = await SparePart.findById(sourceA._id).lean();
    expect(Number(sourceAAfterDispatch.quantity_available)).toBe(14);
    expect((sourceAAfterDispatch.batches || []).every((b) => Number(b.quantity || 0) >= 0)).toBe(true);

    // 2) Confirm receive at B using same transfer (outgoing is receivable now)
    const receiveAB = await request(app)
      .patch(`/api/transfers/${abId}/receive`)
      .send({ confirmationBy: 'Receiver B', confirmationDate: '2026-03-21' });

    expect(receiveAB.status).toBe(200);
    expect(receiveAB.body?.data?.transfer?.status).toBe('received');

    const destB = await SparePart.findOne({
      store_id: storeB,
      normalized_name: 'compressor seal'
    }).lean();

    expect(destB).not.toBeNull();
    expect(Number(destB.quantity_available)).toBe(10);
    const bBatchMap = new Map((destB.batches || []).map((b) => [b.batch_number, Number(b.quantity || 0)]));
    expect(bBatchMap.get('CS-A')).toBe(8);
    expect(bBatchMap.get('CS-B')).toBe(2);

    // 3) Create outgoing transfer B -> C to validate FEFO depletion from received inventory
    const transferBC = await request(app)
      .post('/api/transfers')
      .send({
        type: 'outgoing',
        from_store_id: storeB,
        from_store_name: 'Store B',
        to_store_id: storeC,
        to_store_name: 'Store C',
        items: [{ spare_part_id: String(destB._id), quantity: 6 }],
        approved_by: 'Ops Manager',
        approved_date: '2026-03-22',
        dispatch_date: '2026-03-22',
        expected_delivery_date: '2026-03-23',
        driver: { name: 'Driver BC', phone: '9000000102', driver_id: 'DRV-BC-1' },
        transferred_by: 'E2E Tester'
      });

    expect(transferBC.status).toBe(201);
    const bcAllocations = transferBC.body?.data?.transfer?.items?.[0]?.batch_allocations || [];
    // FEFO consumes earliest expiry first: CS-A then CS-B
    expect(bcAllocations.map((a) => a.source_batch_number)).toEqual(['CS-A']);
    expect(Number(bcAllocations[0]?.quantity || 0)).toBe(6);

    const sourceBAfterDispatch = await SparePart.findById(destB._id).lean();
    expect(Number(sourceBAfterDispatch.quantity_available)).toBe(4);
    expect((sourceBAfterDispatch.batches || []).every((b) => Number(b.quantity || 0) >= 0)).toBe(true);

    // 4) Receive B -> C and validate destination inventory
    const receiveBC = await request(app)
      .patch(`/api/transfers/${transferBC.body?.data?.transfer?.id}/receive`)
      .send({ confirmationBy: 'Receiver C', confirmationDate: '2026-03-23' });

    expect(receiveBC.status).toBe(200);

    const destC = await SparePart.findOne({
      store_id: storeC,
      normalized_name: 'compressor seal'
    }).lean();

    expect(destC).not.toBeNull();
    expect(Number(destC.quantity_available)).toBe(6);
    const cSum = (destC.batches || []).reduce((sum, b) => sum + Number(b.quantity || 0), 0);
    expect(cSum).toBe(6);
    expect(Number(destC.quantity_available)).toBe(cSum);

    // 5) Idempotency check - second receive should not double-credit
    const receiveBCAgain = await request(app)
      .put(`/api/transfers/${transferBC.body?.data?.transfer?.id}/receive`)
      .send({ confirmationBy: 'Receiver C', confirmationDate: '2026-03-23' });

    expect(receiveBCAgain.status).toBe(409);

    const destCAfterSecondReceive = await SparePart.findOne({
      store_id: storeC,
      normalized_name: 'compressor seal'
    }).lean();
    expect(Number(destCAfterSecondReceive.quantity_available)).toBe(6);
  });
});
