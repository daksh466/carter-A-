const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../../server');
const User = require('../../../src/models/User');
const Inventory = require('../../../src/models/Inventory');
const Order = require('../../../src/models/Order');

jest.mock('../../../src/utils/pdf.js', () => ({}), { virtual: true });
jest.mock('../../../src/services/pdfService.js', () => ({
  createInvoicePDF: jest.fn().mockResolvedValue('/mock/path/invoice.pdf')
}));

jest.setTimeout(30000);

describe('Legacy Root App E2E Contract', () => {
  let mongoServer;
  const rootMongoose = User.db.base;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await rootMongoose.connect(mongoServer.getUri(), { dbName: 'legacy-root-e2e' });
  });

  afterAll(async () => {
    await rootMongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    await User.deleteMany({ username: /legacy_e2e_/i });
    await Inventory.deleteMany({ itemCode: /LEGACY_E2E_/i });
    await Order.deleteMany({ itemCode: /LEGACY_E2E_/i });
  });

  it('register -> login -> inventory add -> order create', async () => {
    const username = `legacy_e2e_${Date.now()}`;

    const registerRes = await request(app)
      .post('/api/users/register')
      .send({
        username,
        password: 'pass12345',
        businessName: 'Legacy E2E Biz',
        phone: '9876543210'
      });
    expect(registerRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username, password: 'pass12345' });
    expect(loginRes.status).toBe(200);

    const token = loginRes.body?.token;
    expect(typeof token).toBe('string');

    const addInventoryRes = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'LEGACY_E2E_1', stock: 20, itemName: 'Legacy Item' });
    expect(addInventoryRes.status).toBe(201);

    const createOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'LEGACY_E2E_1', quantity: 7 });
    expect(createOrderRes.status).toBe(200);

    const inventory = await Inventory.findOne({ itemCode: 'LEGACY_E2E_1' });
    expect(Number(inventory.stock)).toBe(13);
  });
});
