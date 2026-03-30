const StockMovement = require('../models/StockMovement');

async function logStockMovement(itemId, type, quantity, reference) {
  return await StockMovement.create({ itemId, type, quantity, reference });
}

module.exports = { logStockMovement };
