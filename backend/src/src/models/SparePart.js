const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection', required: true },
  partName: { type: String, required: true, trim: true },
  type: { type: String, enum: ['ordered', 'required'], required: true }
});

module.exports = mongoose.model('SparePart', sparePartSchema);
