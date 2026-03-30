const mongoose = require('mongoose');

const storeOrderItemSchema = new mongoose.Schema(
  {
    spare_part_id: { type: String, trim: true, default: '' },
    part_name: { type: String, trim: true, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, trim: true, default: 'pcs' },
    notes: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const confirmationSchema = new mongoose.Schema(
  {
    confirmed_by: { type: String, trim: true, default: '' },
    confirmed_at: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const storeOrderSchema = new mongoose.Schema(
  {
    store_id: { type: String, required: true, trim: true, index: true },
    direction: {
      type: String,
      required: true,
      enum: ['incoming', 'outgoing'],
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'received', 'dispatched', 'cancelled'],
      default: 'pending',
      index: true
    },
    order_number: { type: String, trim: true, default: '', index: true },
    supplier_name: { type: String, trim: true, default: '' },
    requested_by: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    items: {
      type: [storeOrderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'At least one order item is required'
      }
    },
    total_quantity: { type: Number, default: 0, min: 0 },
    receive_confirmation: { type: confirmationSchema, default: () => ({}) },
    dispatch_confirmation: { type: confirmationSchema, default: () => ({}) },
    is_deleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

storeOrderSchema.pre('validate', function (next) {
  const items = Array.isArray(this.items) ? this.items : [];
  this.total_quantity = items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  next();
});

storeOrderSchema.index({ store_id: 1, direction: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.StoreOrder || mongoose.model('StoreOrder', storeOrderSchema);
