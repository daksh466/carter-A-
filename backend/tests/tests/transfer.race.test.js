const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const SparePart = require('../../src/models/SparePart');
const Transfer = require('../../src/models/Transfer');

jest.setTimeout(60000);

describe('Transfer Receive Race Condition', () => {
  let sourceStore;
  let destinationStore;
  let machineId;

  beforeEach(() => {
    sourceStore = new mongoose.Types.ObjectId().toString();
    destinationStore = new mongoose.Types.ObjectId().toString();
    machineId = new mongoose.Types.ObjectId().toString();
  });

  afterEach(async () => {
    await Transfer.deleteMany({ notes: 'race-test' });
    await SparePart.deleteMany({ normalized_name: 'race-bearing', store_id: { $in: [sourceStore, destinationStore] } });
  });

  it('handles parallel receive calls without duplicate stock updates', async () => {
    const sourcePart = await SparePart.create({
      name: 'race-bearing',
      normalized_name: 'race-bearing',
      machine_id: machineId,
      machine_ids: [machineId],
      store_id: sourceStore,
      quantity_available: 10,
      minimum_required: 1,
      batches: [
        {
          batch_number: 'RACE-LOT-1',
          quantity: 10,
          expiry_date: new Date('2027-01-01T00:00:00.000Z'),
          received_date: new Date('2026-01-01T00:00:00.000Z')
        }
      ]
    });

    const createRes = await request(app)
      .post('/api/transfers')
      .send({
        type: 'outgoing',
        from_store_id: sourceStore,
        from_store_name: 'Race Store A',
        to_store_id: destinationStore,
        to_store_name: 'Race Store B',
        items: [
          {
            spare_part_id: String(sourcePart._id),
            item_id: String(sourcePart._id),
            quantity: 10
          }
        ],
        approved_by: 'race-tester',
        dispatch_date: '2026-03-30T00:00:00.000Z',
        expected_delivery_date: '2026-03-31T00:00:00.000Z',
        driver: {
          name: 'Race Driver',
          phone: '9999999999',
          driver_id: 'RACE-DRIVER-1'
        },
        notes: 'race-test'
      });

    expect(createRes.status).toBe(201);
    const transferId = createRes.body?.data?.transfer?.id;
    expect(typeof transferId).toBe('string');

    const receiveBody = {
      confirmationBy: 'Race Receiver',
      confirmationDate: '2026-03-31T10:00:00.000Z',
      notes: 'parallel receive'
    };

    const responses = await Promise.all(
      Array.from({ length: 8 }).map(() => request(app).patch(`/api/transfers/${transferId}/receive`).send(receiveBody))
    );

    const statusCounts = responses.reduce((acc, res) => {
      acc[res.status] = (acc[res.status] || 0) + 1;
      return acc;
    }, {});

    expect(statusCounts[200] || 0).toBe(1);
    expect((statusCounts[409] || 0) + (statusCounts[200] || 0)).toBe(8);

    const destinationPart = await SparePart.findOne({
      store_id: destinationStore,
      normalized_name: 'race-bearing'
    }).lean();

    expect(destinationPart).not.toBeNull();
    expect(Number(destinationPart.quantity_available || 0)).toBe(10);

    const batchTotal = (destinationPart.batches || []).reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    expect(batchTotal).toBe(10);

    const transfer = await Transfer.findById(transferId).lean();
    expect(transfer).not.toBeNull();
    expect(transfer.status).toBe('received');
  });
});
