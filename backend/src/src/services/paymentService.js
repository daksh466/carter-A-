const Payment = require('../models/Payment');

async function updatePayment(id, data) {
  return await Payment.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

module.exports = { updatePayment };
