const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemCode: { type: String, required: true, unique: true, index: true },
  stock: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Inventory', inventorySchema);
