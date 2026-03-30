const mongoose = require('mongoose');

const transferBatchAllocationSchema = new mongoose.Schema({
  source_batch_number: { type: String, required: true, trim: true },
  destination_batch_number: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  expiry_date: { type: Date, default: null }
});

const transferItemSchema = new mongoose.Schema({
  spare_part_id: { type: String, required: true, trim: true },
  spare_part_name: { type: String, required: true, trim: true },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SparePart', default: null },
  item_name: { type: String, trim: true, default: '' },
  normalized_name: { type: String, trim: true, default: '' },
  machine_id: { type: String, trim: true, default: '' },
  minimum_required: { type: Number, default: 0 },
  warranty_expiry_date: { type: Date, default: null },
  quantity: { type: Number, required: true, min: 1 },
  batch_allocations: { type: [transferBatchAllocationSchema], default: [] }
});

const transferDriverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    driver_id: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['transfer', 'internal', 'outgoing', 'incoming'],
      default: 'transfer'
    },
    isInstant: { type: Boolean, default: false },
    from_store_id: { type: String, trim: true, default: '', index: true },
    from_store_name: { type: String, required: true, trim: true },
    from_external_name: { type: String, trim: true, default: '' },
    to_store_id: { type: String, trim: true, default: '', index: true },
    to_store_name: { type: String, trim: true, default: '' },
    to_external_name: { type: String, trim: true, default: '' },
    items: [transferItemSchema],
    total_items: { type: Number, required: true, min: 1 },
    driver: { type: transferDriverSchema, default: null },
    vehicle_number: { type: String, trim: true, default: '' },
    mode_of_transport: {
      type: String,
      enum: ['Truck', 'Air', 'Ship', 'Train', 'Local', 'Unknown'],
      default: 'Unknown'
    },
    distance_km: { type: Number, default: 0, min: 0 },
    approved_by: { type: String, trim: true, default: '' },
    approved_date: { type: Date, default: null },
    dispatch_date: { type: Date, default: Date.now },
    expected_delivery_date: { type: Date, default: null },
    received_date: { type: Date, default: null },
    received_by: { type: String, trim: true, default: '' },
    confirmation_date: { type: Date, default: null },
    confirmed_by: { type: String, trim: true, default: '' },
    receive_notes: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['completed', 'received', 'pending', 'cancelled', 'in_transit'],
      default: 'completed'
    },
    transferred_by: { type: String, default: 'System' },
    created_by: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

// Index for efficient querying
transferSchema.index({ from_store_id: 1, createdAt: -1 });
transferSchema.index({ to_store_id: 1, createdAt: -1 });
transferSchema.index({ createdAt: -1 });
transferSchema.index({ status: 1 });
transferSchema.index({ dispatch_date: -1 });
transferSchema.index({ isInstant: 1, status: 1 });
transferSchema.index({ 'expected_delivery_date': 1 });
transferSchema.index({ type: 1, status: 1, dispatch_date: -1, createdAt: -1 });
transferSchema.index({ from_store_id: 1, type: 1, status: 1, dispatch_date: -1 });
transferSchema.index({ to_store_id: 1, type: 1, status: 1, dispatch_date: -1 });

module.exports = mongoose.model('Transfer', transferSchema);

