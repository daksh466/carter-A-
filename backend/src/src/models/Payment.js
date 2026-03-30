const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection', required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true },
  paymentBy: { type: String, enum: ['cash', 'online', 'dealer'], required: true },
  supervisedBy: { type: String, trim: true }
});

module.exports = mongoose.model('Payment', paymentSchema);
