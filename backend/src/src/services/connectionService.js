const Connection = require('../models/Connection');

async function createConnection(data) {
  return await Connection.create(data);
}

module.exports = { createConnection };
