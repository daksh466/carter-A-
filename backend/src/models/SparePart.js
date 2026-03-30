const mongoose = require('mongoose');

const isBatchDebugEnabled = () => /^(1|true|yes|on)$/i.test(String(process.env.SPAREPART_BATCH_DEBUG || '').trim());

const logBatchDebug = (message, meta = {}) => {
  if (!isBatchDebugEnabled()) {
    return;
  }

  console.debug(`[SparePart.batch] ${message}`, meta);
};

const batchSchema = new mongoose.Schema(
  {
    batch_number: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    quantity_available: { type: Number, default: undefined },
    expiry_date: { type: Date, default: null },
    received_date: { type: Date, default: null }
  },
  { _id: true }
);

const sparePartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    size: { type: String, default: '', trim: true },
    unit: { type: String, default: 'pcs', trim: true },
    normalized_name: { type: String, required: true, trim: true, index: true },
    machine_id: { type: String, required: true, trim: true, index: true },
    machine_ids: { type: [{ type: String, trim: true }], default: [] },
    store_id: { type: String, required: true, trim: true, index: true },
    quantity_available: { type: Number, required: true, min: 0 },
    type: { type: String, default: '', trim: true },
    batches: { type: [batchSchema], default: [] },
    minimum_required: { type: Number, required: true, min: 0 },
    purchase_cost: { type: Number, default: null, min: 0 },
    warranty_expiry_date: { type: Date, default: null },
    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
    deleted_by: { type: String, default: '' }
  },
  { timestamps: true }
);

// Unique index for per-store, case-insensitive uniqueness
sparePartSchema.index({ store_id: 1, normalized_name: 1 }, { unique: true });
sparePartSchema.index({ machine_ids: 1 });
sparePartSchema.index({ 'batches.expiry_date': 1 });
sparePartSchema.index({ store_id: 1, is_deleted: 1, createdAt: -1 });
sparePartSchema.index({ store_id: 1, machine_id: 1, is_deleted: 1, createdAt: -1 });

// Pre-validate hook to set normalized_name and keep machine mappings canonical.
sparePartSchema.pre('validate', function (next) {
  if (this.name) {
    this.name = String(this.name).trim().toLowerCase();
    this.normalized_name = this.name;
  }

  const normalizedMachineIds = Array.isArray(this.machine_ids)
    ? this.machine_ids
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
    : [];

  if (normalizedMachineIds.length === 0 && this.machine_id) {
    normalizedMachineIds.push(String(this.machine_id || '').trim());
  }

  if (normalizedMachineIds.length > 0) {
    this.machine_ids = normalizedMachineIds;
    this.machine_id = normalizedMachineIds[0];
  }

  const rawBatches = Array.isArray(this.batches) ? this.batches : [];
  const normalizedBatches = [];
  const seenBatchNumbers = new Set();
  let hasPositiveBatchQuantity = false;

  for (const row of rawBatches) {
    const source = row && typeof row.toObject === 'function' ? row.toObject() : row;
    const hasQuantity = Object.prototype.hasOwnProperty.call(source || {}, 'quantity')
      || Object.prototype.hasOwnProperty.call(source || {}, 'quantity_available');
    const hasExpiry = Object.prototype.hasOwnProperty.call(source || {}, 'expiry_date');
    const hasReceived = Object.prototype.hasOwnProperty.call(source || {}, 'received_date');

    const normalizedBatchNumber = String(source?.batch_number || '').trim();
    const hasAnyOtherField = hasQuantity || hasExpiry || hasReceived;
    if (!normalizedBatchNumber && hasAnyOtherField) {
      this.invalidate('batches', 'batch_number is required when batch row contains quantity/expiry/received metadata');
      return next();
    }

    if (!normalizedBatchNumber) {
      continue;
    }

    if (seenBatchNumbers.has(normalizedBatchNumber.toLowerCase())) {
      this.invalidate('batches', `duplicate batch_number '${normalizedBatchNumber}' is not allowed within a spare part`);
      return next();
    }

    const rawQuantity = source?.quantity ?? source?.quantity_available ?? 0;
    const numericQuantity = Number(rawQuantity);
    if (Number.isNaN(numericQuantity)) {
      this.invalidate('batches', `quantity must be a valid number for batch '${normalizedBatchNumber}'`);
      return next();
    }

    const sanitizedQuantity = Math.max(0, numericQuantity);
    const normalizedBatch = {
      _id: source?._id,
      batch_number: normalizedBatchNumber,
      quantity: sanitizedQuantity,
      expiry_date: source?.expiry_date || null,
      received_date: source?.received_date || null
    };

    seenBatchNumbers.add(normalizedBatchNumber.toLowerCase());
    normalizedBatches.push(normalizedBatch);
    if (sanitizedQuantity > 0) {
      hasPositiveBatchQuantity = true;
    }

    logBatchDebug('normalized batch row', {
      batch_number: normalizedBatch.batch_number,
      quantity: normalizedBatch.quantity,
      has_expiry_date: Boolean(normalizedBatch.expiry_date),
      has_received_date: Boolean(normalizedBatch.received_date)
    });
  }

  if (normalizedBatches.length > 0) {
    this.batches = normalizedBatches;
  }

  if (hasPositiveBatchQuantity) {
    const summedQuantity = normalizedBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    this.quantity_available = summedQuantity;
    logBatchDebug('aggregate quantity synced from batches', {
      quantity_available: this.quantity_available,
      batch_count: normalizedBatches.length
    });
  }

  next();
});

module.exports = mongoose.models.SparePart || mongoose.model('SparePart', sparePartSchema);
