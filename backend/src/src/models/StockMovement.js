const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  type: { type: String, enum: ['in', 'out'], required: true },
  quantity: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  reference: { type: String, trim: true }
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);
