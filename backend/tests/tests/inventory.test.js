const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../../server');
const Inventory = require('../../../src/models/Inventory');
const User = require('../../../src/models/User');
const { jwtSecret } = require('../../../src/config');

jest.mock('../../../src/utils/pdf.js', () => ({}), { virtual: true });

jest.setTimeout(30000);

describe('Inventory API Contract', () => {
  let mongoServer;
  let authToken;
  const rootMongoose = User.db.base;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await rootMongoose.connect(mongoServer.getUri(), { dbName: 'legacy-inventory-contract' });

    const user = await User.create({
      username: `inventory_contract_${Date.now()}`,
      password: 'pass12345',
      businessName: 'Inventory Contract Biz',
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
    await Inventory.deleteMany({ itemCode: /INV_CONTRACT_/i });
  });

  it('adds inventory item', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemCode: 'INV_CONTRACT_1', stock: 50, itemName: 'Inventory Contract Item' });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
  });

  it('updates stock and consumes stock', async () => {
    await Inventory.create({ itemCode: 'INV_CONTRACT_2', stock: 30, itemName: 'Inventory Contract Item 2' });

    const updateRes = await request(app)
      .post('/api/inventory/update')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemCode: 'INV_CONTRACT_2', stock: 22 });

    expect(updateRes.status).toBe(200);

    const item = await Inventory.findOne({ itemCode: 'INV_CONTRACT_2' });
    const consumeRes = await request(app)
      .post(`/api/inventory/${item._id}/consume`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quantityUsed: 5 });

    expect(consumeRes.status).toBe(200);

    const updated = await Inventory.findById(item._id);
    expect(Number(updated.stock)).toBe(17);
  });
});
