const Machine = require('../models/Machine');
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const updateMachineSchema = Joi.object({
  machineName: Joi.string().required(),
  machineId: Joi.string().required(),
  warrantyStatus: Joi.string().valid('active', 'expired').required(),
  purchaseDate: Joi.date().required()
});

exports.updateMachine = async (req, res, next) => {
  // Joi validation
  const { error } = updateMachineSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { machineName, machineId, warrantyStatus, purchaseDate } = req.body;
    const machine = await Machine.findByIdAndUpdate(
      req.params.id,
      { machineName, machineId, warrantyStatus, purchaseDate },
      { new: true, runValidators: true }
    );
    if (!machine) throw new AppError('Machine not found', 404);
    res.json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
};

exports.deleteMachine = async (req, res, next) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    throw new AppError('Invalid machine ID format', 400);
  }
  try {
    const machine = await Machine.findByIdAndDelete(req.params.id);
    if (!machine) throw new AppError('Machine not found', 404);
    res.json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
};
