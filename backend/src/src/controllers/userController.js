const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { jwtSecret } = require('../config');
const { AppError } = require('../middlewares/errorHandler');
const Joi = require('joi');

// Joi validation schemas
const registerSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  password: Joi.string().trim().min(8).max(100).required(),
  businessName: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string().trim().min(10).max(15).required()
});

const loginSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().trim().required()
});

exports.register = async (req, res, next) => {
  // Joi validation
  const { error } = registerSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { username, password, businessName, phone } = req.body;
    const user = new User({ username, password, businessName, phone });
    await user.save();
    res.json({ success: true, message: 'User registered', user });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  // Joi validation
  const { error } = loginSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) throw new AppError('Invalid credentials', 401);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Invalid credentials', 401);
    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '1d' });
    res.json({ success: true, token });
  } catch (err) {
    next(err);
  }
};

