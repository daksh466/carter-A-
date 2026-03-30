const Payment = require('../models/Payment');
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const updatePaymentSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  paymentDate: Joi.date().required(),
  paymentBy: Joi.string().valid('cash', 'online', 'dealer').required(),
  supervisedBy: Joi.string().required()
});

exports.updatePayment = async (req, res, next) => {
  // Joi validation
  const { error } = updatePaymentSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { amount, paymentDate, paymentBy, supervisedBy } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { amount, paymentDate, paymentBy, supervisedBy },
      { new: true, runValidators: true }
    );
    if (!payment) throw new AppError('Payment not found', 404);
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
};

exports.deletePayment = async (req, res, next) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    throw new AppError('Invalid payment ID format', 400);
  }
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) throw new AppError('Payment not found', 404);
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
};
