const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { bcryptSaltRounds } = require('../config');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  businessName: { type: String, index: true },
  phone: { type: String, required: true, unique: true, index: true }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, bcryptSaltRounds);
  next();
});

module.exports = mongoose.model('User', userSchema);
