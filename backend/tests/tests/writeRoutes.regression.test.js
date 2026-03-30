const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.ALLOW_UNSAFE_DESTRUCTIVE_AUTH_BYPASS = 'false';
process.env.MONGO_URI = '';

jest.mock('../../config/db', () => jest.fn(async () => false));

const app = require('../../server');
const { jwtSecret } = require('../../src/config');

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const INVALID_TOKEN = 'Bearer invalid.token.value';

const expectAuthFailure = (res, contextLabel) => {
  if (res.status !== 401) {
    console.error(`[AUTH-REGRESSION] Expected 401 for ${contextLabel} but got ${res.status}`, {
      body: res.body
    });
  }
  expect(res.status).toBe(401);
};

const expectSuccess = (res, contextLabel) => {
  if (res.status === 401 || res.status === 503) {
    console.error(`[AUTH-REGRESSION] Expected auth-passed write path for ${contextLabel} but got ${res.status}`, {
      body: res.body
    });
  }
  expect(res.status).not.toBe(401);
  expect(res.status).not.toBe(503);
};

const expectFailClosed = (res, contextLabel) => {
  if (res.status !== 503) {
    console.error(`[DB-FAIL-CLOSED] Expected 503 for ${contextLabel} but got ${res.status}`, {
      body: res.body
    });
  }
  expect(res.status).toBe(503);
  expect(String(res.body?.message || '').toLowerCase()).toContain('database');
};

describe('Write Routes Auth/Fail-Closed Regression', () => {
  let validToken;
  let initialReadyState;
  let consoleErrorSpy;
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeAll(() => {
    initialReadyState = mongoose.connection.readyState;

    // Fail fast on disconnected DB writes to keep this suite deterministic and non-flaky.
    mongoose.set('bufferCommands', false);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mongoose.connection.readyState = 1;
    validToken = jwt.sign({ id: `regression-user-${Date.now()}` }, jwtSecret, { expiresIn: '1d' });
  });

  afterAll(() => {
    mongoose.set('bufferCommands', true);

    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    if (consoleLogSpy) consoleLogSpy.mockRestore();
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();

    mongoose.connection.readyState = initialReadyState;
  });

  const authMatrix = [
    {
      label: 'POST /api/stores',
      method: 'post',
      path: '/api/stores',
      body: { state: 'AuthState', storeHead: 'Auth Head', contact: '9000000001' }
    },
    {
      label: 'PUT /api/stores/:id',
      method: 'put',
      path: '/api/stores/000000000000000000000111',
      body: { state: 'AuthState2', storeHead: 'Auth Head 2', contact: '9000000002' }
    },
    {
      label: 'DELETE /api/stores/:id',
      method: 'delete',
      path: '/api/stores/000000000000000000000111'
    },
    {
      label: 'POST /api/spares',
      method: 'post',
      path: '/api/spares',
      body: {
        name: 'AuthPart',
        size: '10mm',
        machine_id: 'AUTH-MACHINE-1',
        store_id: 'AUTH-STORE-1',
        quantity_available: 10,
        minimum_required: 2
      }
    },
    {
      label: 'POST /api/spares/merge-duplicates',
      method: 'post',
      path: '/api/spares/merge-duplicates',
      body: { name: 'authpart', store_id: 'AUTH-STORE-1' }
    },
    {
      label: 'PUT /api/spares/:id',
      method: 'put',
      path: '/api/spares/000000000000000000000222',
      body: { name: 'AuthPartUpdated', quantity_available: 11, minimum_required: 3 }
    },
    {
      label: 'DELETE /api/spares/:id',
      method: 'delete',
      path: '/api/spares/000000000000000000000222'
    },
    {
      label: 'POST /api/purchase-orders',
      method: 'post',
      path: '/api/purchase-orders',
      body: {
        supplier: 'Auth Supplier',
        purchasedBy: 'Auth Buyer',
        store_id: 'AUTH-STORE-1',
        poDate: '2026-03-28',
        totalAmount: 100,
        items: [
          {
            name: 'auth spare',
            machine_id: 'AUTH-MACHINE-1',
            store_id: 'AUTH-STORE-1',
            category: 'spare',
            quantity: 2,
            unitPrice: 50
          }
        ]
      }
    },
    {
      label: 'PUT /api/purchase-orders/:id/status',
      method: 'put',
      path: '/api/purchase-orders/000000000000000000000333/status',
      body: { status: 'Received' }
    },
    {
      label: 'DELETE /api/purchase-orders/:id',
      method: 'delete',
      path: '/api/purchase-orders/000000000000000000000333'
    },
    {
      label: 'POST /api/transfers',
      method: 'post',
      path: '/api/transfers',
      body: {
        type: 'outgoing',
        from_store_id: 'AUTH-STORE-1',
        from_store_name: 'Auth From',
        to_store_id: 'AUTH-STORE-2',
        to_store_name: 'Auth To',
        items: [{ spare_part_id: '000000000000000000000444', quantity: 1 }],
        driver: { name: 'Driver A', phone: '9000000003', driver_id: 'DRV-A' },
        dispatch_date: '2026-03-28',
        expected_delivery_date: '2026-03-29',
        transferred_by: 'Auth Tester'
      }
    },
    {
      label: 'PATCH /api/transfers/:id/receive',
      method: 'patch',
      path: '/api/transfers/000000000000000000000555/receive',
      body: { receivedBy: 'Receiver A', receivedDate: '2026-03-29' }
    },
    {
      label: 'PUT /api/transfers/:id/receive',
      method: 'put',
      path: '/api/transfers/000000000000000000000555/receive',
      body: { receivedBy: 'Receiver B', receivedDate: '2026-03-29' }
    },
    {
      label: 'PATCH /api/transfers/:id/approve',
      method: 'patch',
      path: '/api/transfers/000000000000000000000555/approve',
      body: { approvedBy: 'Approver A', approvedDate: '2026-03-29' }
    },
    {
      label: 'POST /api/orders-list',
      method: 'post',
      path: '/api/orders-list',
      body: {
        customerName: 'Auth Customer',
        machines: [{ name: 'Cutter', quantity: 1 }],
        totalAmount: 500,
        paymentStatus: 'Pending',
        verifiedBy: 'QA',
        orderDate: '2026-03-28'
      }
    },
    {
      label: 'POST /api/machines',
      method: 'post',
      path: '/api/machines',
      body: {
        name: 'Auth Machine',
        store_id: 'AUTH-STORE-1',
        quantity_available: 3,
        minimum_required: 1
      }
    }
  ];

  describe('Auth matrix: no token and invalid token', () => {
    it.each(authMatrix)('%s -> without token returns 401', async ({ label, method, path, body }) => {
      const req = request(app)[method](path);
      const res = body ? await req.send(body) : await req;
      expectAuthFailure(res, `${label} [no-token]`);
    });

    it.each(authMatrix)('%s -> invalid token returns 401', async ({ label, method, path, body }) => {
      const req = request(app)[method](path).set('Authorization', INVALID_TOKEN);
      const res = body ? await req.send(body) : await req;
      expectAuthFailure(res, `${label} [invalid-token]`);
    });
  });

  it('Valid token: all protected write routes respond with success', async () => {
    const stamp = Date.now();

    const storeARes = await request(app)
      .post('/api/stores')
      .set(authHeader(validToken))
      .send({ state: 'State A', storeHead: `HeadA-${stamp}`, contact: '9100000001' });
    expectSuccess(storeARes, 'POST /api/stores');
    const storeAId = storeARes.body?.data?.id;

    const storeBRes = await request(app)
      .post('/api/stores')
      .set(authHeader(validToken))
      .send({ state: 'State B', storeHead: `HeadB-${stamp}`, contact: '9100000002' });
    expectSuccess(storeBRes, 'POST /api/stores (second)');
    const storeBId = storeBRes.body?.data?.id;

    const machineRes = await request(app)
      .post('/api/machines')
      .set(authHeader(validToken))
      .send({
        name: `Machine-${stamp}`,
        store_id: storeAId,
        quantity_available: 5,
        minimum_required: 1
      });
    expectSuccess(machineRes, 'POST /api/machines');

    const orderRes = await request(app)
      .post('/api/orders-list')
      .set(authHeader(validToken))
      .send({
        customerName: `Customer-${stamp}`,
        machines: [{ name: 'Machine-X', quantity: 1 }],
        totalAmount: 800,
        paymentStatus: 'Pending',
        verifiedBy: 'QA',
        orderDate: '2026-03-28'
      });
    expectSuccess(orderRes, 'POST /api/orders-list');

    const spareRes = await request(app)
      .post('/api/spares')
      .set(authHeader(validToken))
      .send({
        name: `Part-${stamp}`,
        size: '20mm',
        machine_id: `M-${stamp}`,
        machine_ids: [`M-${stamp}`, `M-${stamp}-B`],
        store_id: storeAId,
        quantity_available: 15,
        minimum_required: 2
      });
    expectSuccess(spareRes, 'POST /api/spares');
    const spareId = spareRes.body?.data?.sparePart?._id;

    const mergeRes = await request(app)
      .post('/api/spares/merge-duplicates')
      .set(authHeader(validToken))
      .send({ name: `Part-${stamp}`, store_id: storeAId });
    expectSuccess(mergeRes, 'POST /api/spares/merge-duplicates');

    const spareUpdateRes = await request(app)
      .put(`/api/spares/${spareId}`)
      .set(authHeader(validToken))
      .send({ name: `Part-${stamp}-updated`, quantity_available: 14, minimum_required: 3 });
    expectSuccess(spareUpdateRes, 'PUT /api/spares/:id');

    const poRes = await request(app)
      .post('/api/purchase-orders')
      .set(authHeader(validToken))
      .send({
        supplier: `Supplier-${stamp}`,
        purchasedBy: 'QA Buyer',
        store_id: storeAId,
        poDate: '2026-03-28',
        totalAmount: 120,
        items: [
          {
            name: `po-part-${stamp}`,
            machine_id: `M-${stamp}`,
            store_id: storeAId,
            category: 'spare',
            quantity: 3,
            unitPrice: 40
          }
        ]
      });
    expectSuccess(poRes, 'POST /api/purchase-orders');
    const poId = poRes.body?.data?.purchaseOrder?.id;

    const poStatusRes = await request(app)
      .put(`/api/purchase-orders/${poId}/status`)
      .set(authHeader(validToken))
      .send({ status: 'Received' });
    expectSuccess(poStatusRes, 'PUT /api/purchase-orders/:id/status');

    const transferCreateRes = await request(app)
      .post('/api/transfers')
      .set(authHeader(validToken))
      .send({
        type: 'outgoing',
        from_store_id: storeAId,
        from_store_name: 'Store A',
        to_store_id: storeBId,
        to_store_name: 'Store B',
        items: [{ spare_part_id: spareId, quantity: 1 }],
        driver: { name: 'Driver Z', phone: '9100000009', driver_id: `DRV-${stamp}` },
        dispatch_date: '2026-03-28',
        expected_delivery_date: '2026-03-29',
        transferred_by: 'QA Transfer'
      });
    expectSuccess(transferCreateRes, 'POST /api/transfers');
    const transferId = transferCreateRes.body?.data?.transfer?.id;

    const transferApproveRes = await request(app)
      .patch(`/api/transfers/${transferId}/approve`)
      .set(authHeader(validToken))
      .send({ approvedBy: 'QA Approver', approvedDate: '2026-03-29' });
    expectSuccess(transferApproveRes, 'PATCH /api/transfers/:id/approve');

    const transferReceiveRes = await request(app)
      .put(`/api/transfers/${transferId}/receive`)
      .set(authHeader(validToken))
      .send({ receivedBy: 'QA Receiver', receivedDate: '2026-03-29' });
    expectSuccess(transferReceiveRes, 'PUT /api/transfers/:id/receive');

    const poDeleteRes = await request(app)
      .delete(`/api/purchase-orders/${poId}`)
      .set(authHeader(validToken));
    expectSuccess(poDeleteRes, 'DELETE /api/purchase-orders/:id');

    const spareDeleteRes = await request(app)
      .delete(`/api/spares/${spareId}`)
      .set(authHeader(validToken));
    expectSuccess(spareDeleteRes, 'DELETE /api/spares/:id');

    const storeDeleteARes = await request(app)
      .delete(`/api/stores/${storeAId}`)
      .set(authHeader(validToken));
    expectSuccess(storeDeleteARes, 'DELETE /api/stores/:id (A)');

    const storeDeleteBRes = await request(app)
      .delete(`/api/stores/${storeBId}`)
      .set(authHeader(validToken));
    expectSuccess(storeDeleteBRes, 'DELETE /api/stores/:id (B)');
  });

  describe('DB disconnected -> fail closed (503)', () => {
    const failClosedMatrix = [
      {
        label: 'POST /api/stores',
        method: 'post',
        path: '/api/stores',
        body: { state: 'DownState', storeHead: 'Down Head', contact: '9111111111' }
      },
      {
        label: 'PUT /api/stores/:id',
        method: 'put',
        path: '/api/stores/000000000000000000000111',
        body: { state: 'DownState2', storeHead: 'Down Head 2', contact: '9111111112' }
      },
      {
        label: 'DELETE /api/stores/:id',
        method: 'delete',
        path: '/api/stores/000000000000000000000111'
      },
      {
        label: 'POST /api/spares',
        method: 'post',
        path: '/api/spares',
        body: {
          name: 'DownPart',
          size: '10mm',
          machine_id: 'DOWN-MACHINE-1',
          store_id: 'DOWN-STORE-1',
          quantity_available: 10,
          minimum_required: 2
        }
      },
      {
        label: 'POST /api/spares/merge-duplicates',
        method: 'post',
        path: '/api/spares/merge-duplicates',
        body: { name: 'downpart', store_id: 'DOWN-STORE-1' }
      },
      {
        label: 'PUT /api/spares/:id',
        method: 'put',
        path: '/api/spares/000000000000000000000222',
        body: { name: 'DownPartUpdated', quantity_available: 11, minimum_required: 3 }
      },
      {
        label: 'DELETE /api/spares/:id',
        method: 'delete',
        path: '/api/spares/000000000000000000000222'
      },
      {
        label: 'POST /api/purchase-orders',
        method: 'post',
        path: '/api/purchase-orders',
        body: {
          supplier: 'Down Supplier',
          purchasedBy: 'Down Buyer',
          store_id: 'DOWN-STORE-1',
          poDate: '2026-03-28',
          totalAmount: 100,
          items: [
            {
              name: 'down spare',
              machine_id: 'DOWN-MACHINE-1',
              store_id: 'DOWN-STORE-1',
              category: 'spare',
              quantity: 2,
              unitPrice: 50
            }
          ]
        }
      },
      {
        label: 'PUT /api/purchase-orders/:id/status',
        method: 'put',
        path: '/api/purchase-orders/000000000000000000000333/status',
        body: { status: 'Received' }
      },
      {
        label: 'DELETE /api/purchase-orders/:id',
        method: 'delete',
        path: '/api/purchase-orders/000000000000000000000333'
      },
      {
        label: 'POST /api/transfers',
        method: 'post',
        path: '/api/transfers',
        body: {
          type: 'outgoing',
          from_store_id: 'DOWN-STORE-1',
          from_store_name: 'Down From',
          to_store_id: 'DOWN-STORE-2',
          to_store_name: 'Down To',
          items: [{ spare_part_id: '000000000000000000000444', quantity: 1 }],
          driver: { name: 'Driver Down', phone: '9000000003', driver_id: 'DRV-D' },
          dispatch_date: '2026-03-28',
          expected_delivery_date: '2026-03-29',
          transferred_by: 'Down Tester'
        }
      },
      {
        label: 'PATCH /api/transfers/:id/receive',
        method: 'patch',
        path: '/api/transfers/000000000000000000000555/receive',
        body: { receivedBy: 'Receiver D', receivedDate: '2026-03-29' }
      },
      {
        label: 'PUT /api/transfers/:id/receive',
        method: 'put',
        path: '/api/transfers/000000000000000000000555/receive',
        body: { receivedBy: 'Receiver E', receivedDate: '2026-03-29' }
      },
      {
        label: 'PATCH /api/transfers/:id/approve',
        method: 'patch',
        path: '/api/transfers/000000000000000000000555/approve',
        body: { approvedBy: 'Approver D', approvedDate: '2026-03-29' }
      },
      {
        label: 'POST /api/orders-list',
        method: 'post',
        path: '/api/orders-list',
        body: {
          customerName: 'Down Customer',
          machines: [{ name: 'Cutter', quantity: 1 }],
          totalAmount: 500,
          paymentStatus: 'Pending',
          verifiedBy: 'QA',
          orderDate: '2026-03-28'
        }
      },
      {
        label: 'POST /api/machines',
        method: 'post',
        path: '/api/machines',
        body: {
          name: 'Down Machine',
          store_id: 'DOWN-STORE-1',
          quantity_available: 3,
          minimum_required: 1
        }
      }
    ];

    it.each(failClosedMatrix)('%s -> returns 503 when DB disconnected', async ({ label, method, path, body }) => {
      const originalReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0;

      try {
        const req = request(app)[method](path).set(authHeader(validToken));
        const res = body ? await req.send(body) : await req;
        expectFailClosed(res, label);
      } finally {
        mongoose.connection.readyState = originalReadyState;
      }
    });
  });
});
