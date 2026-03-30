const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    store_id: { type: String, required: true, trim: true, index: true },
    quantity_available: { type: Number, required: true, min: 0 },
    minimum_required: { type: Number, required: true, min: 0 },
    warranty_expiry_date: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MachineInventory', machineSchema);
