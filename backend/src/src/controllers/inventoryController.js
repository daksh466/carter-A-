
const Inventory = require('../models/Inventory');
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

// Validation schemas
const updateStockSchema = Joi.object({
  itemCode: Joi.string().required(),
  stock: Joi.number().integer().min(0).required()
});

const addInventorySchema = Joi.object({
  itemName: Joi.string().required(),
  stockQuantity: Joi.number().min(0),
  stock: Joi.number().min(0),
  itemCode: Joi.string().required()
}).or('stockQuantity', 'stock');

const consumeInventorySchema = Joi.object({
  quantityUsed: Joi.number().min(1).required()
});

function isValidObjectId(id) {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

exports.updateStock = async (req, res, next) => {
  const { error } = updateStockSchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { itemCode, stock } = req.body;
    const inventory = await Inventory.findOneAndUpdate(
      { itemCode },
      { stock, updatedAt: Date.now() },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: { inventory } });
  } catch (err) {
    next(err);
  }
};

const paginate = require('../utils/pagination');

exports.listInventory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const query = Inventory.find({});
    const total = await Inventory.countDocuments();
    const inventory = await paginate(query, { page, limit });
    res.json({
      success: true,
      data: {
        inventory,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.addInventory = async (req, res, next) => {
  const { error } = addInventorySchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { itemCode, stockQuantity, stock, itemName } = req.body;
    const stockValue = stockQuantity !== undefined ? stockQuantity : stock;
    const inventory = new Inventory({ itemCode, stock: stockValue, itemName });
    await inventory.save();
    res.status(201).json({ success: true, data: { inventory } });
  } catch (err) {
    next(err);
  }
};

exports.consumeInventory = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    throw new AppError('Invalid inventory ID format', 400);
  }
  const { error } = consumeInventorySchema.validate(req.body);
  if (error) throw new AppError(`Validation error: ${error.details[0].message}`, 400);
  try {
    const { id } = req.params;
    const { quantityUsed } = req.body;
    const inventory = await Inventory.findByIdAndUpdate(
      id,
      { $inc: { stock: -quantityUsed } },
      { new: true }
    );
    if (!inventory) {
      throw new AppError('Inventory not found', 404);
    }
    res.json({ success: true, data: { inventory } });
  } catch (err) {
    next(err);
  }
};

exports.predictInventory = async (req, res, next) => {
  try {
    const inventory = await Inventory.find({});
    const predictions = inventory.map(item => ({
      itemCode: item.itemCode,
      daysLeft: Math.ceil(item.stock / (item.consumptionRate || 1))
    }));
    res.json({ success: true, data: { predictions } });
  } catch (err) {
    next(err);
  }
};

exports.inventoryAlerts = async (req, res, next) => {
  try {
    const inventory = await Inventory.find({ stock: { $lt: 10 } });
    res.json({ success: true, data: { alerts: inventory } });
  } catch (err) {
    next(err);
  }
};

