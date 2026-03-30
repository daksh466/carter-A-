const { MongoMemoryServer } = require('mongodb-memory-server');
const Connection = require('../../../src/models/Connection');

jest.setTimeout(30000);

describe('Connection Model Contract', () => {
  let mongoServer;
  const rootMongoose = Connection.db.base;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await rootMongoose.connect(mongoServer.getUri(), { dbName: 'legacy-connection-contract' });
  });

  afterAll(async () => {
    await rootMongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    await Connection.deleteMany({ businessName: /Conn Contract/i });
  });

  it('accepts valid connection payload', async () => {
    const doc = new Connection({
      businessName: 'Conn Contract Biz',
      firstName: 'John',
      phone: '1234567890',
      category: 'customer',
      lastTalkSummary: 'A'.repeat(120)
    });

    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it('rejects overlong talk summary', async () => {
    const doc = new Connection({
      businessName: 'Conn Contract Biz',
      firstName: 'Jane',
      phone: '1234567890',
      category: 'customer',
      lastTalkSummary: 'A'.repeat(501)
    });

    const error = doc.validateSync();
    expect(error).toBeDefined();
  });
});
