const SparePart = require('../models/SparePart');

async function updateSparePart(id, data) {
  return await SparePart.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

module.exports = { updateSparePart };
