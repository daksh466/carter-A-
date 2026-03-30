const mongoose = require('mongoose');

function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

module.exports = validateObjectId;