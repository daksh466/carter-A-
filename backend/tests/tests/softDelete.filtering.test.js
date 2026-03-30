const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../../server');
const SparePart = require('../../src/models/SparePart');
const PurchaseOrder = require('../../src/models/PurchaseOrder');
const OrderRecord = require('../../src/models/Order');

describe('Soft Delete Filtering Regression', () => {
  const stamp = Date.now();
  const storeId = `SOFT-STORE-${stamp}`;
  const machineId = `SOFT-MACHINE-${stamp}`;
  const customerPrefix = `SoftDelete-Customer-${stamp}`;

  afterAll(async () => {
    await SparePart.deleteMany({ store_id: storeId }).catch(() => {});
    await PurchaseOrder.deleteMany({ store_id: storeId }).catch(() => {});
    await OrderRecord.deleteMany({ customerName: new RegExp(`^${customerPrefix}`) }).catch(() => {});
  });

  it('GET /api/spares excludes soft-deleted spare parts', async () => {
    const active = await SparePart.create({
      name: `active-part-${stamp}`,
      machine_id: machineId,
      store_id: storeId,
      quantity_available: 10,
      minimum_required: 1,
      is_deleted: false
    });

    await SparePart.create({
      name: `deleted-part-${stamp}`,
      machine_id: machineId,
      store_id: storeId,
      quantity_available: 4,
      minimum_required: 1,
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: 'test'
    });

    const res = await request(app).get(`/api/spares?store_id=${storeId}`);

    if (res.status !== 200) {
      console.error('[SOFT-DELETE] GET /api/spares failed unexpectedly', { status: res.status, body: res.body });
    }

    expect(res.status).toBe(200);
    const rows = res.body?.data?.spareParts || [];
    const ids = rows.map((row) => String(row._id || row.id));

    expect(ids).toContain(String(active._id));
    expect(ids).not.toContain(expect.stringMatching(/deleted-part/));
    expect(rows.some((row) => row.is_deleted === true)).toBe(false);
  });

  it('GET /api/purchase-orders excludes soft-deleted purchase orders', async () => {
    const activePo = await PurchaseOrder.create({
      supplier: `supplier-active-${stamp}`,
      supplierName: `supplier-active-${stamp}`,
      storeId,
      store_id: storeId,
      purchasedBy: 'QA Buyer',
      items: [
        {
          name: `po-item-active-${stamp}`,
          machine_id: machineId,
          store_id: storeId,
          spare_id: '',
          category: 'spare',
          quantity: 2,
          unitPrice: 50
        }
      ],
      totalAmount: 100,
      status: 'Ordered',
      poDate: new Date('2026-03-28'),
      is_deleted: false
    });

    await PurchaseOrder.create({
      supplier: `supplier-deleted-${stamp}`,
      supplierName: `supplier-deleted-${stamp}`,
      storeId,
      store_id: storeId,
      purchasedBy: 'QA Buyer',
      items: [
        {
          name: `po-item-deleted-${stamp}`,
          machine_id: machineId,
          store_id: storeId,
          spare_id: '',
          category: 'spare',
          quantity: 1,
          unitPrice: 30
        }
      ],
      totalAmount: 30,
      status: 'Cancelled',
      poDate: new Date('2026-03-28'),
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: 'test'
    });

    const res = await request(app).get(`/api/purchase-orders?storeId=${storeId}`);

    if (res.status !== 200) {
      console.error('[SOFT-DELETE] GET /api/purchase-orders failed unexpectedly', { status: res.status, body: res.body });
    }

    expect(res.status).toBe(200);
    const rows = res.body?.data?.purchaseOrders || [];
    const ids = rows.map((row) => String(row.id || row._id));

    expect(ids).toContain(String(activePo._id));
    expect(rows.some((row) => row.is_deleted === true)).toBe(false);
  });

  it('GET /api/orders-list excludes soft-deleted orders', async () => {
    const activeOrder = await OrderRecord.create({
      customerName: `${customerPrefix}-active`,
      machines: [{ name: 'Machine A', quantity: 1 }],
      totalAmount: 500,
      paymentStatus: 'Pending',
      verifiedBy: 'QA',
      orderDate: new Date('2026-03-28'),
      is_deleted: false
    });

    await OrderRecord.create({
      customerName: `${customerPrefix}-deleted`,
      machines: [{ name: 'Machine B', quantity: 1 }],
      totalAmount: 300,
      paymentStatus: 'Cancelled',
      verifiedBy: 'QA',
      orderDate: new Date('2026-03-28'),
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: 'test'
    });

    const res = await request(app).get(`/api/orders-list?search=${encodeURIComponent(customerPrefix)}`);

    if (res.status !== 200) {
      console.error('[SOFT-DELETE] GET /api/orders-list failed unexpectedly', { status: res.status, body: res.body });
    }

    expect(res.status).toBe(200);
    const rows = res.body?.data?.orders || [];
    const ids = rows.map((row) => String(row.id || row._id));

    expect(ids).toContain(String(activeOrder._id));
    expect(rows.some((row) => row.is_deleted === true)).toBe(false);
  });

  it('soft-deleted records remain in DB but hidden from API', async () => {
    const hiddenSpare = await SparePart.create({
      name: `hidden-part-${stamp}`,
      machine_id: machineId,
      store_id: storeId,
      quantity_available: 1,
      minimum_required: 1,
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: 'test'
    });

    const inDb = await SparePart.findById(hiddenSpare._id);
    expect(inDb).toBeTruthy();
    expect(inDb.is_deleted).toBe(true);

    const apiRes = await request(app).get(`/api/spares?store_id=${storeId}`);
    expect(apiRes.status).toBe(200);

    const rows = apiRes.body?.data?.spareParts || [];
    const ids = rows.map((row) => String(row._id || row.id));
    expect(ids).not.toContain(String(hiddenSpare._id));
  });
});
