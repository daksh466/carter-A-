const User = require('../models/User');

async function findUserByPhone(phone) {
  return await User.findOne({ phone });
}

module.exports = { findUserByPhone };
