const mongoose = require('mongoose');
const Order = require('../models/Order');

const validStatuses = ['Paid', 'Pending', 'Failed', 'Cancelled'];

const toOrderResponse = (doc) => ({
  id: doc._id.toString(),
  customerName: doc.customerName,
  machines: doc.machines,
  totalAmount: doc.totalAmount,
  paymentStatus: doc.paymentStatus,
  verifiedBy: doc.verifiedBy,
  orderDate: doc.orderDate,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

exports.getOrders = async (req, res) => {
  try {
    const { paymentStatus, search, sortBy } = req.query;
    const filter = {};

    if (paymentStatus) {
      filter.paymentStatus = new RegExp(`^${paymentStatus}$`, 'i');
    }
    if (search) {
      filter.customerName = new RegExp(search, 'i');
    }

    let sort = { createdAt: -1 };
    if (sortBy === 'date-new') sort = { orderDate: -1 };
    if (sortBy === 'date-old') sort = { orderDate: 1 };
    if (sortBy === 'amount-high') sort = { totalAmount: -1 };
    if (sortBy === 'amount-low') sort = { totalAmount: 1 };

    const orders = await Order.find(filter).sort(sort);
    const result = orders.map(toOrderResponse);

    const summary = {
      total: result.length,
      paid: result.filter((o) => o.paymentStatus === 'Paid').length,
      pending: result.filter((o) => o.paymentStatus === 'Pending').length,
      totalAmount: result.reduce((sum, o) => sum + o.totalAmount, 0),
      averageAmount:
        result.length > 0
          ? Math.round(result.reduce((sum, o) => sum + o.totalAmount, 0) / result.length)
          : 0
    };

    return res.status(200).json({
      success: true,
      data: {
        orders: result,
        summary
      },
      message: `Successfully retrieved ${result.length} orders`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving orders',
      error: error.message
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order: toOrderResponse(order)
      },
      message: `Successfully retrieved order ${id}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving order',
      error: error.message
    });
  }
};

exports.createOrder = async (req, res) => {
  try {
    console.log('Incoming data (order):', req.body);
    const { customerName, machines, totalAmount, paymentStatus, verifiedBy, orderDate } = req.body;

    const errors = [];
    if (!customerName || customerName.trim() === '') errors.push('Customer name is required');
    if (!machines || !Array.isArray(machines) || machines.length === 0) errors.push('At least one machine is required');
    if (totalAmount === undefined || totalAmount === null) errors.push('Total amount is required');
    if (!paymentStatus || paymentStatus.trim() === '') errors.push('Payment status is required');
    if (!verifiedBy || verifiedBy.trim() === '') errors.push('Verified by is required');
    if (!orderDate || String(orderDate).trim() === '') errors.push('Order date is required');

    if (totalAmount !== undefined && (isNaN(totalAmount) || Number(totalAmount) < 0)) {
      errors.push('Total amount must be a non-negative number');
    }

    if (machines && Array.isArray(machines)) {
      machines.forEach((machine, index) => {
        if (!machine.name || machine.name.trim() === '') {
          errors.push(`Machine ${index + 1}: name is required`);
        }
        if (
          machine.quantity === undefined ||
          machine.quantity === null ||
          isNaN(machine.quantity) ||
          Number(machine.quantity) < 1
        ) {
          errors.push(`Machine ${index + 1}: quantity must be at least 1`);
        }
      });
    }

    if (paymentStatus && !validStatuses.includes(paymentStatus)) {
      errors.push(`Payment status must be one of: ${validStatuses.join(', ')}`);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const order = await Order.create({
      customerName: customerName.trim(),
      machines: machines.map((m) => ({
        name: m.name.trim(),
        quantity: Number(m.quantity)
      })),
      totalAmount: Number(totalAmount),
      paymentStatus,
      verifiedBy: verifiedBy.trim(),
      orderDate: new Date(orderDate)
    });

    console.log('Saved to DB (order):', order);

    return res.status(201).json({
      success: true,
      data: { order: toOrderResponse(order) },
      message: `Order '${order._id}' created successfully for ${order.customerName}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};
