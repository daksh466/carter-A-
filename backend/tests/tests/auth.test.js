const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../../server');
const User = require('../../../src/models/User');

jest.mock('../../../src/utils/pdf.js', () => ({}), { virtual: true });

jest.setTimeout(30000);

describe('Authentication Contract', () => {
  let mongoServer;
  const rootMongoose = User.db.base;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await rootMongoose.connect(mongoServer.getUri(), { dbName: 'legacy-auth-contract' });
  });

  afterAll(async () => {
    await rootMongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    await User.deleteMany({ username: /auth_contract_/i });
  });

  it('registers and logs in with valid credentials', async () => {
    const username = `auth_contract_${Date.now()}`;

    const registerRes = await request(app)
      .post('/api/users/register')
      .send({
        username,
        password: 'strongpass123',
        businessName: 'Auth Contract Biz',
        phone: '9876543210'
      });

    expect(registerRes.status).toBe(200);
    expect(registerRes.body?.success).toBe(true);

    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username, password: 'strongpass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body?.success).toBe(true);
    expect(typeof loginRes.body?.token).toBe('string');
  });

});
