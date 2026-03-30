const mongoose = require('mongoose');
const StoreOrder = require('../models/StoreOrder');
const { increaseInventory, decreaseInventory } = require('../services/inventoryService');

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || '');
  return /Transaction numbers are only allowed on a replica set member or mongos/i.test(message)
    || /transaction is not supported/i.test(message)
    || /replica set/i.test(message);
};

const normalizeDirection = (value) => String(value || '').trim().toLowerCase();
const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const normalizeItem = (item = {}) => ({
  spare_part_id: String(item.spare_part_id || item.sparePartId || '').trim(),
  part_name: String(item.part_name || item.partName || item.name || '').trim(),
  quantity: Number(item.quantity || 0),
  unit: String(item.unit || 'pcs').trim(),
  notes: String(item.notes || '').trim()
});

const toOrderResponse = (doc) => ({
  id: String(doc._id),
  store_id: String(doc.store_id || ''),
  direction: doc.direction,
  status: doc.status,
  order_number: doc.order_number || '',
  supplier_name: doc.supplier_name || '',
  requested_by: doc.requested_by || '',
  notes: doc.notes || '',
  items: Array.isArray(doc.items) ? doc.items : [],
  total_quantity: Number(doc.total_quantity || 0),
  receive_confirmation: doc.receive_confirmation || {},
  dispatch_confirmation: doc.dispatch_confirmation || {},
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

const validateCreatePayload = (payload = {}) => {
  const errors = [];
  const normalizedStoreId = String(payload.store_id || payload.storeId || '').trim();
  const direction = normalizeDirection(payload.direction);
  const items = Array.isArray(payload.items) ? payload.items.map(normalizeItem) : [];

  if (!normalizedStoreId) {
    errors.push('store_id is required');
  }

  if (!['incoming', 'outgoing'].includes(direction)) {
    errors.push("direction must be 'incoming' or 'outgoing'");
  }

  if (items.length === 0) {
    errors.push('At least one order item is required');
  }

  items.forEach((item, index) => {
    if (!item.part_name) {
      errors.push(`Item ${index + 1}: part_name is required`);
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: quantity must be greater than zero`);
    }
  });

  return {
    errors,
    data: {
      store_id: normalizedStoreId,
      direction,
      status: 'pending',
      order_number: String(payload.order_number || payload.orderNumber || '').trim(),
      supplier_name: String(payload.supplier_name || payload.supplierName || '').trim(),
      requested_by: String(payload.requested_by || payload.requestedBy || '').trim(),
      notes: String(payload.notes || '').trim(),
      items
    }
  };
};

const applyConfirmationInventory = async ({ order, mode, confirmedBy, confirmationNotes, session = null }) => {
  const isIncoming = mode === 'receive';
  const expectedDirection = isIncoming ? 'incoming' : 'outgoing';
  const nextStatus = isIncoming ? 'received' : 'dispatched';

  if (order.direction !== expectedDirection) {
    throw {
      status: 400,
      message: `Order direction is '${order.direction}' and cannot be confirmed as ${mode}`
    };
  }

  if (order.status !== 'pending') {
    throw {
      status: 409,
      message: `Order has already been processed with status '${order.status}'`
    };
  }

  const ops = [];
  for (const item of order.items || []) {
    if (isIncoming) {
      const op = await increaseInventory({
        storeId: order.store_id,
        sparePartId: item.spare_part_id,
        partName: item.part_name,
        quantity: item.quantity,
        session
      });
      ops.push(op);
    } else {
      const op = await decreaseInventory({
        storeId: order.store_id,
        sparePartId: item.spare_part_id,
        partName: item.part_name,
        quantity: item.quantity,
        session
      });
      ops.push(op);
    }
  }

  const now = new Date();
  order.status = nextStatus;

  if (isIncoming) {
    order.receive_confirmation = {
      confirmed_by: confirmedBy,
      confirmed_at: now,
      notes: confirmationNotes
    };
  } else {
    order.dispatch_confirmation = {
      confirmed_by: confirmedBy,
      confirmed_at: now,
      notes: confirmationNotes
    };
  }

  await order.save(session ? { session } : undefined);
  return { order, ops };
};

exports.getOrders = async (req, res) => {
  try {
    const storeId = String(req.query.store_id || req.query.storeId || '').trim();
    const direction = normalizeDirection(req.query.direction);
    const status = normalizeStatus(req.query.status);
    const search = String(req.query.search || '').trim();

    const filter = { is_deleted: { $ne: true } };
    if (storeId) {
      filter.store_id = storeId;
    }
    if (['incoming', 'outgoing'].includes(direction)) {
      filter.direction = direction;
    }
    if (['pending', 'received', 'dispatched', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { order_number: { $regex: search, $options: 'i' } },
        { supplier_name: { $regex: search, $options: 'i' } },
        { requested_by: { $regex: search, $options: 'i' } },
        { 'items.part_name': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await StoreOrder.find(filter).sort({ createdAt: -1 }).lean().exec();
    const summary = {
      total: orders.length,
      pending: orders.filter((order) => order.status === 'pending').length,
      incoming: orders.filter((order) => order.direction === 'incoming').length,
      outgoing: orders.filter((order) => order.direction === 'outgoing').length
    };

    return res.json({
      success: true,
      data: {
        orders: orders.map(toOrderResponse),
        summary
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch store orders'
    });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { errors, data } = validateCreatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const created = await StoreOrder.create(data);
    return res.status(201).json({
      success: true,
      message: 'Store order created successfully',
      data: { order: toOrderResponse(created) }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create store order'
    });
  }
};

const runConfirmation = async ({ req, res, mode }) => {
  const orderId = String(req.params.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const confirmationNotes = String(req.body?.notes || '').trim();
  const confirmedBy = String(
    req.body?.confirmed_by
    || req.body?.confirmedBy
    || req.body?.confirmerName
    || req.user?.id
    || req.user?.sub
    || 'System'
  ).trim();

  let session = null;
  try {
    session = await mongoose.startSession();
    let updatedOrder = null;

    await session.withTransaction(async () => {
      const order = await StoreOrder.findOne(
        { _id: orderId, is_deleted: { $ne: true } },
        null,
        { session }
      ).exec();

      if (!order) {
        throw { status: 404, message: 'Order not found' };
      }

      const result = await applyConfirmationInventory({
        order,
        mode,
        confirmedBy,
        confirmationNotes,
        session
      });
      updatedOrder = result.order;
    });

    session.endSession();

    return res.json({
      success: true,
      message: mode === 'receive' ? 'Incoming order confirmed' : 'Outgoing order confirmed',
      data: { order: toOrderResponse(updatedOrder) }
    });
  } catch (error) {
    if (session) {
      session.endSession();
    }

    if (isTransactionUnsupportedError(error)) {
      try {
        const fallbackOrder = await StoreOrder.findOne({ _id: orderId, is_deleted: { $ne: true } }).exec();
        if (!fallbackOrder) {
          return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const result = await applyConfirmationInventory({
          order: fallbackOrder,
          mode,
          confirmedBy,
          confirmationNotes,
          session: null
        });

        return res.json({
          success: true,
          message: mode === 'receive' ? 'Incoming order confirmed' : 'Outgoing order confirmed',
          data: { order: toOrderResponse(result.order) }
        });
      } catch (fallbackError) {
        const status = Number(fallbackError?.status || 500);
        return res.status(status).json({
          success: false,
          message: fallbackError?.message || 'Failed to confirm order'
        });
      }
    }

    const status = Number(error?.status || 500);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Failed to confirm order'
    });
  }
};

exports.confirmReceive = async (req, res) => runConfirmation({ req, res, mode: 'receive' });
exports.confirmDispatch = async (req, res) => runConfirmation({ req, res, mode: 'dispatch' });
