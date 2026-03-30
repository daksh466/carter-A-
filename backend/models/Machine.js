const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  quantity_available: { type: Number, default: 0 },
  minimum_required: { type: Number, default: 0 },
  warranty_expiry_date: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Machine || mongoose.model('Machine', machineSchema);
