const Service = require('../models/Service');
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const updateServiceSchema = Joi.object({
  machineId: Joi.string().required(),
  workDetails: Joi.string().required(),
  engineerName: Joi.string().required(),
  date: Joi.date().required()
});

exports.updateService = async (req, res, next) => {
  // Joi validation
  const { error } = updateServiceSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { machineId, workDetails, engineerName, date } = req.body;
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { machineId, workDetails, engineerName, date },
      { new: true, runValidators: true }
    );
    if (!service) throw new AppError('Service not found', 404);
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
};

exports.deleteService = async (req, res, next) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    throw new AppError('Invalid service ID format', 400);
  }
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) throw new AppError('Service not found', 404);
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
};
