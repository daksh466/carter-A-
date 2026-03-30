const Inventory = require('../models/Inventory');

async function updateStock(itemCode, stock) {
  // Implement atomic update logic
  return await Inventory.findOneAndUpdate(
    { itemCode },
    { stock, updatedAt: Date.now() },
    { new: true, upsert: true }
  );
}

module.exports = { updateStock };
