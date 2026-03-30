const Service = require('../models/Service');

async function updateService(id, data) {
  return await Service.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

module.exports = { updateService };
