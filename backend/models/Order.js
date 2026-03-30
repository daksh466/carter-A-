const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  customerPhone: { type: String },
  machines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Machine' }],
  totalAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  verifiedBy: { type: String },
  orderDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);