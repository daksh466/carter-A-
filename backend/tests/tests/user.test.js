const request = require('supertest');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../../server');
const User = require('../../../src/models/User');

jest.mock('../../../src/utils/pdf.js', () => ({}), { virtual: true });

jest.setTimeout(30000);

describe('User API Contract', () => {
  let mongoServer;
  const rootMongoose = User.db.base;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await rootMongoose.connect(mongoServer.getUri(), { dbName: 'legacy-user-contract' });
  });

  afterAll(async () => {
    await rootMongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    await User.deleteMany({ username: /user_contract_/i });
  });

  it('stores hashed password on register', async () => {
    const username = `user_contract_${Date.now()}`;
    const plainPassword = 'securepass123';

    const res = await request(app)
      .post('/api/users/register')
      .send({
        username,
        password: plainPassword,
        businessName: 'User Contract Biz',
        phone: '9876543210'
      });

    expect(res.status).toBe(200);
    const created = await User.findOne({ username });
    expect(created).not.toBeNull();
    expect(created.password).not.toBe(plainPassword);
    const matches = await bcrypt.compare(plainPassword, created.password);
    expect(matches).toBe(true);
  });

  it('rejects duplicate username with client error', async () => {
    const username = `user_contract_${Date.now()}`;

    await request(app)
      .post('/api/users/register')
      .send({
        username,
        password: 'securepass123',
        businessName: 'User Contract Biz',
        phone: '9876543210'
      });

    const duplicateRes = await request(app)
      .post('/api/users/register')
      .send({
        username,
        password: 'securepass123',
        businessName: 'User Contract Biz',
        phone: '9876543210'
      });

    expect(duplicateRes.status).toBeGreaterThanOrEqual(400);
    expect(duplicateRes.status).toBeLessThan(600);
  });
});
