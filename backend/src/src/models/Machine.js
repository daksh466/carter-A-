const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  machineName: { type: String, required: true, trim: true },
  machineId: { type: String, required: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection', required: true },
  warrantyStatus: { type: String, enum: ['active', 'expired'], required: true },
  purchaseDate: { type: Date }
});

module.exports = mongoose.model('Machine', machineSchema);
