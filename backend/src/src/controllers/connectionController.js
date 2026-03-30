const Connection = require('../models/Connection');
const Machine = require('../models/Machine');
const Payment = require('../models/Payment');
const SparePart = require('../models/SparePart');
const Service = require('../models/Service');
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const createConnectionSchema = Joi.object({
  businessName: Joi.string().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().required(),
  email: Joi.string().email().required(),
  state: Joi.string().required(),
  category: Joi.string().required()
});

exports.createConnection = async (req, res, next) => {
  // Joi validation
  const { error } = createConnectionSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { businessName, firstName, lastName, phone, email, state, category } = req.body;
    const connection = new Connection({
      businessName,
      firstName,
      lastName,
      phone,
      email,
      state,
      category
    });
    await connection.save();
    res.status(201).json({ success: true, data: { connection } });
  } catch (error) {
    next(error);
  }
};

const paginate = require('../utils/pagination');

exports.listConnections = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const query = Connection.find();
    const total = await Connection.countDocuments();
    const connections = await paginate(query, { page, limit });
    res.json({
      success: true,
      data: {
        connections,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerDetails = async (req, res, next) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    throw new AppError('Invalid customer ID format', 400);
  }
  try {
    const customerId = req.params.id;
    const customer = await Connection.findById(customerId);
    if (!customer) {
      throw new AppError('Customer not found', 404);
    }
    // Machines
    const machines = await Machine.find({ customerId });
    // Payments
    const payments = await Payment.find({ customerId });
    // Spare Parts
    const spareOrdered = await SparePart.find({ customerId, type: "ordered" });
    const spareRequired = await SparePart.find({ customerId, type: "required" });
    // Service History
    const serviceHistory = await Service.find({ customerId }).populate("machineId", "machineName machineId");
    // Computed fields
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = customer.amountPending || 0;
    return res.status(200).json({
      success: true,
      data: {
        customer: {
          _id: customer._id,
          businessName: customer.businessName,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          email: customer.email,
          state: customer.state,
          category: customer.category,
          connectedDate: customer.connectedDate,
          amountPending: customer.amountPending,
          amountPaid: customer.amountPaid,
          totalPaid,
          totalPending,
        },
        machines,
        payments,
        spareParts: {
          ordered: spareOrdered,
          required: spareRequired,
        },
        serviceHistory,
      }
    });
  } catch (error) {
    next(error);
  }
};

