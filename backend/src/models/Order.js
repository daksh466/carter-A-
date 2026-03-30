const mongoose = require('mongoose');

const orderMachineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    machines: { type: [orderMachineSchema], required: true, validate: [(arr) => arr.length > 0, 'At least one machine is required'] },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['Paid', 'Pending', 'Failed', 'Cancelled']
    },
    verifiedBy: { type: String, required: true, trim: true },
    orderDate: { type: Date, required: true },
    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
    deleted_by: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrderRecord', orderSchema);
