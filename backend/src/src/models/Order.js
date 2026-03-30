const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  itemCode: { type: String, required: true, index: true },
  quantity: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
