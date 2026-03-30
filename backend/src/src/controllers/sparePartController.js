const SparePart = require('../models/SparePart');
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const updateSparePartSchema = Joi.object({
  partName: Joi.string().required(),
  type: Joi.string().valid('ordered', 'required').required()
});

exports.updateSparePart = async (req, res, next) => {
  // Joi validation
  const { error } = updateSparePartSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { partName, type } = req.body;
    const spare = await SparePart.findByIdAndUpdate(
      req.params.id,
      { partName, type },
      { new: true, runValidators: true }
    );
    if (!spare) throw new AppError('Spare part not found', 404);
    res.json({ success: true, data: spare });
  } catch (err) {
    next(err);
  }
};

exports.deleteSparePart = async (req, res, next) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    throw new AppError('Invalid spare part ID format', 400);
  }
  try {
    const spare = await SparePart.findByIdAndDelete(req.params.id);
    if (!spare) throw new AppError('Spare part not found', 404);
    res.json({ success: true, data: spare });
  } catch (err) {
    next(err);
  }
};
