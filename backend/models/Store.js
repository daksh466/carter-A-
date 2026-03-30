const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  state: { type: String, required: true, trim: true },
  storeHead: { type: String, required: true, trim: true },
  contact: { type: String, required: true, trim: true },
  // Legacy fields kept for backward compatibility with existing UI parts.
  name: { type: String, trim: true },
  address: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Store', storeSchema);