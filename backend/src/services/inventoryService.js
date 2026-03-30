const mongoose = require('mongoose');
const SparePart = require('../models/SparePart');
const { normalizeSparePartName } = require('../utils/sparePartDedup');

const normalizeStoreId = (value) => String(value || '').trim();

const normalizeQuantity = (value) => {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }
  return Math.floor(quantity);
};

const buildLookupFilter = ({ storeId, sparePartId, partName }) => {
  const normalizedStoreId = normalizeStoreId(storeId);
  if (!normalizedStoreId) {
    throw { status: 400, message: 'store_id is required' };
  }

  if (sparePartId && mongoose.Types.ObjectId.isValid(sparePartId)) {
    return { _id: sparePartId, store_id: normalizedStoreId, is_deleted: { $ne: true } };
  }

  const normalizedName = normalizeSparePartName(partName);
  if (!normalizedName) {
    throw { status: 400, message: 'part_name is required when spare_part_id is missing' };
  }

  return { normalized_name: normalizedName, store_id: normalizedStoreId, is_deleted: { $ne: true } };
};

const toCreatePayload = ({ storeId, partName, quantity, machineId = '' }) => {
  const normalizedName = normalizeSparePartName(partName);
  if (!normalizedName) {
    throw { status: 400, message: 'part_name is required for new inventory items' };
  }

  return {
    name: normalizedName,
    normalized_name: normalizedName,
    machine_id: String(machineId || `store-order-${normalizeStoreId(storeId)}`).trim(),
    store_id: normalizeStoreId(storeId),
    quantity_available: quantity,
    minimum_required: 0,
    warranty_expiry_date: null
  };
};

const increaseInventory = async ({ storeId, sparePartId = '', partName = '', quantity, machineId = '', session = null }) => {
  const incrementBy = normalizeQuantity(quantity);
  if (incrementBy <= 0) {
    throw { status: 400, message: 'quantity must be greater than zero' };
  }

  const queryOptions = session ? { session } : {};
  const filter = buildLookupFilter({ storeId, sparePartId, partName });
  const existing = await SparePart.findOne(filter, null, queryOptions).exec();

  if (existing) {
    await SparePart.updateOne(
      { _id: existing._id },
      { $inc: { quantity_available: incrementBy } },
      queryOptions
    ).exec();

    return { sparePartId: String(existing._id), quantity: incrementBy, operation: 'increment' };
  }

  const createPayload = toCreatePayload({
    storeId,
    partName,
    quantity: incrementBy,
    machineId
  });

  try {
    const created = await SparePart.create([createPayload], queryOptions);
    return { sparePartId: String(created[0]._id), quantity: incrementBy, operation: 'create' };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const retryExisting = await SparePart.findOne(filter, null, queryOptions).exec();
    if (!retryExisting) {
      throw error;
    }

    await SparePart.updateOne(
      { _id: retryExisting._id },
      { $inc: { quantity_available: incrementBy } },
      queryOptions
    ).exec();

    return { sparePartId: String(retryExisting._id), quantity: incrementBy, operation: 'increment' };
  }
};

const decreaseInventory = async ({ storeId, sparePartId = '', partName = '', quantity, session = null }) => {
  const decrementBy = normalizeQuantity(quantity);
  if (decrementBy <= 0) {
    throw { status: 400, message: 'quantity must be greater than zero' };
  }

  const queryOptions = session ? { session } : {};
  const filter = buildLookupFilter({ storeId, sparePartId, partName });
  const existing = await SparePart.findOne(filter, null, queryOptions).exec();

  if (!existing) {
    throw { status: 404, message: `Inventory item not found for '${partName || sparePartId}'` };
  }

  const available = Number(existing.quantity_available || 0);
  if (available < decrementBy) {
    throw {
      status: 400,
      message: `Insufficient stock for '${existing.name || partName || sparePartId}'. Available: ${available}, required: ${decrementBy}`
    };
  }

  await SparePart.updateOne(
    { _id: existing._id },
    { $inc: { quantity_available: -decrementBy } },
    queryOptions
  ).exec();

  return { sparePartId: String(existing._id), quantity: decrementBy, operation: 'decrement' };
};

module.exports = {
  increaseInventory,
  decreaseInventory
};
