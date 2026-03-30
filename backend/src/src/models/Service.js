const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection', required: true },
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  workDetails: { type: String, trim: true },
  engineerName: { type: String, trim: true },
  date: { type: Date, required: true }
});

module.exports = mongoose.model('Service', serviceSchema);
