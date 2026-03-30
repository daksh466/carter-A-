const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../../server');
const Order = require('../../../src/models/Order');
const Inventory = require('../../../src/models/Inventory');
const User = require('../../../src/models/User');
const { createInvoicePDF } = require('../../../src/services/pdfService');
const { jwtSecret } = require('../../../src/config');

jest.mock('../../../src/utils/pdf.js', () => ({}), { virtual: true });
jest.mock('../../../src/services/pdfService.js', () => ({
  createInvoicePDF: jest.fn().mockResolvedValue('/mock/path/invoice.pdf')
}));

jest.setTimeout(30000);

describe('Order API Contract', () => {
  let mongoServer;
  let authToken;
  const rootMongoose = User.db.base;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await rootMongoose.connect(mongoServer.getUri(), { dbName: 'legacy-order-contract' });

    const user = await User.create({
      username: `order_contract_${Date.now()}`,
      password: 'pass12345',
      businessName: 'Order Contract Biz',
      phone: '9876543210'
    });
    authToken = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '1d' });
  });

  afterAll(async () => {
    await rootMongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    await Order.deleteMany({ itemCode: /ORDER_CONTRACT_/i });
    await Inventory.deleteMany({ itemCode: /ORDER_CONTRACT_/i });
  });

  it('creates order and reduces inventory stock', async () => {
    await Inventory.create({ itemCode: 'ORDER_CONTRACT_1', stock: 20, itemName: 'Order Contract Item' });

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemCode: 'ORDER_CONTRACT_1', quantity: 6 });

    expect(createRes.status).toBe(200);
    expect(createRes.body?.success).toBe(true);

    const updatedInventory = await Inventory.findOne({ itemCode: 'ORDER_CONTRACT_1' });
    expect(Number(updatedInventory.stock)).toBe(14);
  });

  it('failed order request should not change inventory', async () => {
    await Inventory.create({ itemCode: 'ORDER_CONTRACT_3', stock: 20, itemName: 'Order Contract Item 3' });

    createInvoicePDF.mockRejectedValueOnce(new Error('pdf-failure'));

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemCode: 'ORDER_CONTRACT_3', quantity: 6 });

    expect(createRes.status).toBeGreaterThanOrEqual(400);

    const updatedInventory = await Inventory.findOne({ itemCode: 'ORDER_CONTRACT_3' });
    expect(Number(updatedInventory.stock)).toBe(20);

    const createdOrder = await Order.findOne({ itemCode: 'ORDER_CONTRACT_3' });
    expect(createdOrder).toBeNull();
  });

  it('returns client error for insufficient stock', async () => {
    await Inventory.create({ itemCode: 'ORDER_CONTRACT_2', stock: 3, itemName: 'Order Contract Item 2' });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemCode: 'ORDER_CONTRACT_2', quantity: 9 });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
