// Delete order by ID
exports.deleteOrder = async (req, res, next) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID format' });
  }
  try {
    const order = await Order.findByIdAndDelete(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted', order });
  } catch (err) {
    next(err);
  }
};
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');
const { createInvoicePDF } = require('../services/pdfService');
const { AppError } = require('../middlewares/errorHandler');
const Joi = require('joi');

// Joi validation schemas
const createOrderSchema = Joi.object({
  itemCode: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required()
});

function isValidObjectId(id) {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

exports.createOrder = async (req, res, next) => {
  // Joi validation
  const { error } = createOrderSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  
  // Skip transactions in test mode (MongoDB standalone doesn't support transactions)
  const useTransaction = process.env.NODE_ENV !== 'test';
  
  let session = null;
  if (useTransaction) {
    session = await mongoose.startSession();
    session.startTransaction();
  }
  
  try {
    const { itemCode, quantity } = req.body;
    
    const inventory = await Inventory.findOne({ itemCode }).session(session);
    if (!inventory || inventory.stock < quantity) {
      if (useTransaction) await session.abortTransaction();
      throw new AppError('Insufficient stock', 400);
    }
    
    inventory.stock -= quantity;
    await inventory.save({ session });
    
    const order = new Order({ itemCode, quantity, user: req.user.id });
    await order.save({ session });
    
    // Generate PDF invoice
    const pdfPath = await createInvoicePDF(`Order: ${order._id}\\nItem: ${itemCode}\\nQuantity: ${quantity}`);
    order.invoicePath = pdfPath;
    await order.save();
    
    if (useTransaction) {
      await session.commitTransaction();
    }
    
    res.json({ success: true, message: 'Order created', order });
  } catch (err) {
    if (useTransaction && session) {
      await session.abortTransaction();
    }
    next(err);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

exports.listOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).populate('user');
    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
};
