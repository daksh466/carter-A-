const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  machine_id: { type: String, required: true, trim: true },
  store_id: { type: String, required: true, trim: true },
  spare_id: { type: String, trim: true, default: '' },
  category: {
    type: String,
    trim: true,
    lowercase: true,
    enum: ['spare', 'machine'],
    default: 'spare'
  },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 }
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  supplier: { type: String, required: true, trim: true },
  supplierName: { type: String, required: true, trim: true },
  storeId: { type: String, required: true, trim: true, index: true },
  store_id: { type: String, required: true, trim: true, index: true },
  purchasedBy: { type: String, required: true, trim: true },
  items: { 
    type: [purchaseOrderItemSchema], 
    required: true, 
    validate: [(arr) => arr.length > 0, 'At least one item required'] 
  },
  totalAmount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    required: true,
    enum: ['Ordered', 'Received', 'Paid', 'Cancelled'],
    default: 'Ordered'
  },
  poDate: { type: Date, required: true },
  receivedDate: { type: Date, default: null },
  notes: { type: String, trim: true },
  is_deleted: { type: Boolean, default: false, index: true },
  deleted_at: { type: Date, default: null },
  deleted_by: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
