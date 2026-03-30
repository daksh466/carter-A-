const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const SparePart = require('../models/SparePart');
const { normalizeSparePartName, mergeDuplicateSpareParts } = require('../utils/sparePartDedup');

const validStatuses = ['Ordered', 'Received', 'Paid', 'Cancelled'];

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || '');
  return /Transaction numbers are only allowed on a replica set member or mongos/i.test(message)
    || /transaction is not supported/i.test(message)
    || /replica set/i.test(message);
};

const normalizeCategory = (value) => String(value || 'spare').trim().toLowerCase();

const toObjectIdIfValid = (value) => {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const rollbackAppliedInventory = async (appliedOps = []) => {
  for (let i = appliedOps.length - 1; i >= 0; i -= 1) {
    const op = appliedOps[i];

    try {
      if (op.type === 'increment') {
        await SparePart.updateOne(
          { _id: op.spareId },
          { $inc: { quantity_available: -op.quantity } }
        ).exec();
      } else if (op.type === 'create') {
        await SparePart.deleteOne({ _id: op.spareId }).exec();
      }
    } catch (rollbackError) {
      console.error('Inventory rollback step failed:', rollbackError.message);
    }
  }
};

const updateSpareInventoryForItem = async (item, session = null) => {
  const category = normalizeCategory(item.category);
  if (category !== 'spare') {
    return null;
  }

  const queryOptions = session ? { session } : {};
  const byId = toObjectIdIfValid(item.spare_id);
  const normalizedName = normalizeSparePartName(item.name);
  const normalizedStoreId = String(item.store_id || '').trim();
  const normalizedMachineId = String(item.machine_id || '').trim();
  const quantityToAdd = Number(item.quantity || 0);

  if (!normalizedName) {
    throw { status: 400, errors: ['Spare item name is required'] };
  }

  if (byId) {
    const spareById = await SparePart.findById(byId, null, queryOptions).exec();
    if (!spareById) {
      throw { status: 404, errors: [`Spare not found for spare_id '${item.spare_id}'`] };
    }

    if (String(spareById.store_id) !== normalizedStoreId) {
      throw { status: 400, errors: [`Item '${item.name}' has spare_id that does not belong to selected store`] };
    }

    spareById.name = normalizedName;
    spareById.normalized_name = normalizedName;
    spareById.machine_id = String(spareById.machine_id || normalizedMachineId).trim();
    spareById.quantity_available = Number(spareById.quantity_available || 0) + quantityToAdd;
    await spareById.save(queryOptions);

    return { type: 'increment', spareId: spareById._id, quantity: quantityToAdd };
  }

  const dedupResult = await mergeDuplicateSpareParts({
    SparePart,
    name: normalizedName,
    storeId: normalizedStoreId,
    session
  });

  if (dedupResult.sparePart) {
    dedupResult.sparePart.machine_id = String(dedupResult.sparePart.machine_id || normalizedMachineId).trim();
    dedupResult.sparePart.quantity_available = Number(dedupResult.sparePart.quantity_available || 0) + quantityToAdd;
    await dedupResult.sparePart.save(queryOptions);
    return { type: 'increment', spareId: dedupResult.sparePart._id, quantity: quantityToAdd };
  }

  try {
    const created = await SparePart.create([
      {
        name: normalizedName,
        machine_id: normalizedMachineId,
        store_id: normalizedStoreId,
        quantity_available: quantityToAdd,
        minimum_required: 0,
        warranty_expiry_date: null
      }
    ], queryOptions);

    return { type: 'create', spareId: created[0]._id, quantity: quantityToAdd };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await SparePart.findOne({
        normalized_name: normalizedName,
        store_id: normalizedStoreId
      }, null, queryOptions).exec();

      if (existing) {
        existing.quantity_available = Number(existing.quantity_available || 0) + quantityToAdd;
        await existing.save(queryOptions);
        return { type: 'increment', spareId: existing._id, quantity: quantityToAdd };
      }
    }
    throw error;
  }
};

const applyInventoryUpdates = async (poData, session = null) => {
  const appliedOps = [];
  for (const item of poData.items) {
    const op = await updateSpareInventoryForItem(item, session);
    if (op) {
      appliedOps.push(op);
      console.log('Inventory updated via purchase', {
        spareId: String(op.spareId),
        operation: op.type,
        quantity: op.quantity
      });
    }
  }
  return appliedOps;
};

const createPOWithBestEffortRollback = async (poData) => {
  const createdPO = await PurchaseOrder.create(poData);
  let appliedOps = [];

  try {
    appliedOps = await applyInventoryUpdates(poData);
    return createdPO;
  } catch (inventoryError) {
    await rollbackAppliedInventory(appliedOps);
    await PurchaseOrder.deleteOne({ _id: createdPO._id }).exec();
    throw inventoryError;
  }
};

const toPurchaseOrderResponse = (doc) => ({
  id: doc._id.toString(),
  supplier: doc.supplier || doc.supplierName,
  supplierName: doc.supplierName,
  purchasedBy: doc.purchasedBy,
  storeId: doc.storeId || doc.store_id,
  store_id: doc.store_id,
  items: doc.items,
  totalAmount: doc.totalAmount,
  status: doc.status,
  poDate: doc.poDate,
  receivedDate: doc.receivedDate,
  notes: doc.notes,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

exports.createPurchaseOrder = async (req, res) => {
  try {
    console.log('Incoming PO data:', req.body);
    const {
      supplier,
      supplierName,
      purchasedBy,
      storeId,
      store_id,
      items,
      totalAmount,
      status = 'Ordered',
      poDate,
      notes
    } = req.body;

    const normalizedSupplier = String(supplier || supplierName || '').trim();
    const normalizedPurchasedBy = String(purchasedBy || '').trim();
    const normalizedStoreId = String(storeId || store_id || '').trim();

    const errors = [];
    if (!normalizedSupplier) errors.push('Supplier name is required');
    if (!normalizedPurchasedBy) errors.push('Purchased by is required');
    if (!normalizedStoreId) errors.push('Store ID is required');
    if (!Array.isArray(items) || items.length === 0) errors.push('At least one item required');
    if (totalAmount === undefined || isNaN(totalAmount) || totalAmount < 0) errors.push('Valid totalAmount required');
    
    items.forEach((item, idx) => {
      if (item == null || typeof item !== 'object') {
        errors.push(`Item ${idx + 1}: invalid item payload`);
        return;
      }

      if (!item.name?.trim()) errors.push(`Item ${idx + 1}: itemName/name required`);
      if (!item.machine_id?.trim()) errors.push(`Item ${idx + 1}: machine_id required`);
      if (!String(item.store_id || normalizedStoreId).trim()) errors.push(`Item ${idx + 1}: store_id required`);
      if (item.quantity === undefined || item.quantity === null || isNaN(item.quantity) || Number(item.quantity) <= 0) errors.push(`Item ${idx + 1}: valid quantity required`);
      if (item.unitPrice === undefined || item.unitPrice === null || isNaN(item.unitPrice) || Number(item.unitPrice) <= 0) errors.push(`Item ${idx + 1}: valid unitPrice required`);

      const category = normalizeCategory(item.category);
      if (category && !['spare', 'machine'].includes(category)) {
        errors.push(`Item ${idx + 1}: category must be 'spare' or 'machine'`);
      }
    });

    if (!poDate) errors.push('PO date required');

    if (errors.length > 0) {
      throw { status: 400, errors };
    }

    // Verify calculated total
    const calculatedTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      throw { status: 400, errors: ['totalAmount must match items sum'] };
    }

    const poData = {
      supplier: normalizedSupplier,
      supplierName: normalizedSupplier,
      purchasedBy: normalizedPurchasedBy,
      storeId: normalizedStoreId,
      store_id: normalizedStoreId,
      items: items.map(item => ({
        name: normalizeCategory(item.category) === 'spare'
          ? normalizeSparePartName(item.name)
          : item.name.trim(),
        machine_id: item.machine_id.trim(),
        store_id: String(item.store_id || normalizedStoreId).trim(),
        spare_id: item.spare_id ? String(item.spare_id).trim() : '',
        category: normalizeCategory(item.category),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice)
      })),
      totalAmount: Number(totalAmount),
      status,
      poDate: new Date(poDate),
      notes: notes?.trim() || ''
    };

    let createdPO;
    let session = null;
    let usedTransaction = false;

    if (mongoose.connection.readyState === 1) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        usedTransaction = true;
        const purchaseOrder = await PurchaseOrder.create([poData], { session });
        await applyInventoryUpdates(poData, session);
        createdPO = purchaseOrder[0];
        await session.commitTransaction();
      } catch (txError) {
        if (usedTransaction && session?.inTransaction()) {
          await session.abortTransaction();
        }

        if (!isTransactionUnsupportedError(txError)) {
          throw txError;
        }

        console.warn('Transactions unavailable; falling back to non-transactional PO create.');
        createdPO = await createPOWithBestEffortRollback(poData);
      } finally {
        if (session) session.endSession();
      }
    } else {
      createdPO = await createPOWithBestEffortRollback(poData);
    }

    console.log('PO created:', createdPO._id);

    res.status(201).json({
      success: true,
      data: { purchaseOrder: toPurchaseOrderResponse(createdPO) },
      message: `Purchase Order created for ${normalizedSupplier}. Inventory updated successfully`
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404 || error.status === 409) {
      return res.status(error.status).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors || [error.message]
      });
    }
    
    console.error('PO create error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating purchase order',
      error: error.message
    });
  }
};

exports.getPurchaseOrders = async (req, res) => {
  try {
    if (!PurchaseOrder) {
      return res.status(200).json({
        success: true,
        data: { purchaseOrders: [] },
        message: 'No purchase orders available (degraded mode)'
      });
    }
    const { storeId, status, fromDate, toDate, sparePartId } = req.query;
    const filter = { is_deleted: { $ne: true } };
    if (storeId) {
      filter.$or = [
        { store_id: storeId },
        { storeId }
      ];
    }
    if (status) filter.status = status;
    if (fromDate || toDate) {
      filter.poDate = {};
      if (fromDate) filter.poDate.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.poDate.$lte = end;
      }
    }
    if (sparePartId) {
      filter['items.spare_id'] = String(sparePartId);
    }

    const pos = await PurchaseOrder.find(filter).sort({ createdAt: -1 });
    const result = pos.map(toPurchaseOrderResponse);

    res.status(200).json({
      success: true,
      data: { purchaseOrders: result },
      message: `Retrieved ${result.length} purchase orders`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase orders',
      error: error.message
    });
  }
};

exports.deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PurchaseOrder.findByIdAndUpdate(
      id,
      {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: String(req.user?.id || req.user?.sub || 'unknown')
      },
      { new: true }
    );
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    console.log('Purchase order soft deleted', {
      at: new Date().toISOString(),
      purchaseOrderId: id,
      by: String(req.user?.id || req.user?.sub || 'unknown')
    });

    return res.status(200).json({
      success: true,
      message: 'Purchase order deleted',
      data: { id }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting purchase order',
      error: error.message
    });
  }
};

exports.updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: ${status}. Must be one of ${validStatuses.join(', ')}`
      });
    }

    const po = await PurchaseOrder.findOneAndUpdate(
      { _id: id, is_deleted: { $ne: true } },
      { status },
      { new: true }
    );
    if (!po) {
      return res.status(404).json({ success: false, message: 'PO not found' });
    }

    console.log('Purchase order status updated', {
      at: new Date().toISOString(),
      purchaseOrderId: id,
      status,
      by: String(req.user?.id || req.user?.sub || 'unknown')
    });

    res.json({
      success: true,
      data: { purchaseOrder: toPurchaseOrderResponse(po) },
      message: `Status updated to ${status}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating PO',
      error: error.message
    });
  }
};

