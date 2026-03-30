// cSpell:ignore neighbour maxlength
const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  category: { type: String, enum: ['customer', 'supplier', 'neighbour'], required: true },
  state: { type: String, trim: true },
  companyCode: { type: String, trim: true, unique: true, index: true },
  feedback: { type: Number, min: 1, max: 5 },
  commodity: { type: String, trim: true },
  machineModel: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
  connectedDate: { type: Date, default: Date.now },
  lastTalkDate: { type: Date },
  lastTalkWith: { type: String, trim: true },
  lastTalkSummary: { type: String, trim: true, maxlength: 500 },
  nextActionDate: { type: Date },
  amountPending: { type: Number, default: 0, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 }
});

module.exports = mongoose.model('Connection', connectionSchema);
