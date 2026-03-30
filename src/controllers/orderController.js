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
  let inventory = null;
  let originalStock = null;
  let createdOrderId = null;

  if (useTransaction) {
    session = await mongoose.startSession();
    session.startTransaction();
  }
  
  try {
    const { itemCode, quantity } = req.body;

    // `auth` middleware in test mode uses a placeholder user id; avoid write-time cast errors.
    const normalizedUserId = mongoose.Types.ObjectId.isValid(req.user?.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : null;

    const inventoryQuery = Inventory.findOne({ itemCode });
    inventory = useTransaction ? await inventoryQuery.session(session) : await inventoryQuery;
    if (!inventory || inventory.stock < quantity) {
      if (useTransaction) await session.abortTransaction();
      throw new AppError('Insufficient stock', 400);
    }

    originalStock = Number(inventory.stock || 0);
    inventory.stock -= quantity;
    await inventory.save({ session });

    const orderPayload = { itemCode, quantity };
    if (normalizedUserId) {
      orderPayload.user = normalizedUserId;
    }

    const order = new Order(orderPayload);
    await order.save({ session });
    createdOrderId = order._id;
    
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
    } else {
      // Best-effort rollback in non-transaction mode (used by test/standalone Mongo).
      if (inventory && originalStock !== null) {
        try {
          await Inventory.updateOne(
            { _id: inventory._id },
            { $set: { stock: originalStock, updatedAt: new Date() } }
          );
        } catch (_) {
          // no-op
        }
      }

      if (createdOrderId) {
        try {
          await Order.deleteOne({ _id: createdOrderId });
        } catch (_) {
          // no-op
        }
      }
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
