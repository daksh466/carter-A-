const Transfer = require('../models/Transfer');
const SparePart = require('../models/SparePart');
const mongoose = require('mongoose');

const isTransactionUnsupported = (error) => {
  const message = String(error?.message || '');
  return /Transaction numbers are only allowed on a replica set member or mongos/i.test(message);
};

const attachSession = (queryOrPromise, session) => {
  if (!session) {
    return queryOrPromise;
  }

  if (queryOrPromise && typeof queryOrPromise.session === 'function') {
    return queryOrPromise.session(session);
  }

  return queryOrPromise;
};

const transferLocks = new Map();
const RECEIVABLE_TRANSFER_TYPES = new Set(['incoming', 'outgoing']);

const withTransferLock = async (key, work) => {
  const lockKey = String(key || 'global');
  const previous = transferLocks.get(lockKey) || Promise.resolve();

  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });

  transferLocks.set(lockKey, previous.then(() => current));

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (transferLocks.get(lockKey) === current) {
      transferLocks.delete(lockKey);
    }
  }
};

const toComparableDate = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return fallback;
  }

  return asDate;
};

const isUnknownItemName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized || normalized === 'unknown item';
};

const getFallbackItemName = (partId) => {
  return 'Unknown Item';
};

const normalizePartIdValue = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'object') {
    if (value._id) {
      return String(value._id).trim();
    }
    if (value.id) {
      return String(value.id).trim();
    }
  }

  return String(value).trim();
};

const extractItemPartId = (item = {}) => {
  return (
    normalizePartIdValue(item.spare_part_id)
    || normalizePartIdValue(item.sparePartId)
    || normalizePartIdValue(item.item_id)
    || normalizePartIdValue(item.itemId)
  );
};

const resolveSparePartNameMap = async (partIds = [], session = null) => {
  const validIds = [...new Set(partIds)]
    .map((id) => String(id || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (validIds.length === 0) {
    return new Map();
  }

  const docs = await attachSession(
    SparePart.find({ _id: { $in: validIds } }).select('_id name normalized_name').lean(),
    session
  );

  return new Map(docs.map((doc) => [String(doc._id), {
    name: String(doc.name || '').trim(),
    normalizedName: String(doc.normalized_name || '').trim()
  }]));
};

const hydrateTransferResponsesWithNames = async (transferResponses = [], session = null) => {
  const unresolvedPartIds = [];
  for (const transfer of transferResponses) {
    for (const item of transfer.items || []) {
      if (isUnknownItemName(item.item_name || item.itemName || item.spare_part_name || item.sparePartName)) {
        const id = extractItemPartId(item);
        if (id) {
          unresolvedPartIds.push(id);
        }
      }
    }
  }

  const nameMap = await resolveSparePartNameMap(unresolvedPartIds, session);
  if (nameMap.size === 0) {
    return transferResponses;
  }

  return transferResponses.map((transfer) => ({
    ...transfer,
    items: (transfer.items || []).map((item) => {
      const currentName = item.item_name || item.itemName || item.spare_part_name || item.sparePartName;
      if (!isUnknownItemName(currentName)) {
        return item;
      }

      const partId = extractItemPartId(item);
      const partMeta = nameMap.get(partId);
      const resolvedName = String(partMeta?.name || '').trim() || getFallbackItemName(partId);

      return {
        ...item,
        item_name: resolvedName,
        itemName: resolvedName,
        spare_part_name: resolvedName,
        sparePartName: resolvedName
      };
    })
  }));
};

const normalizeBatches = (batches = [], fallbackQuantity = 0, fallbackKey = '') => {
  const normalized = batches
    .map((batch) => ({
      batch_number: String(batch?.batch_number || '').trim(),
      quantity_available: Number(batch?.quantity_available ?? batch?.quantity ?? 0),
      expiry_date: batch?.expiry_date || null,
      received_date: batch?.received_date || null
    }))
    .filter((batch) => batch.batch_number && batch.quantity_available > 0);

  if (normalized.length > 0) {
    return normalized;
  }

  if (Number(fallbackQuantity || 0) > 0) {
    return [
      {
        batch_number: `OPENING-${String(fallbackKey || 'LEGACY').slice(-8)}`,
        quantity_available: Number(fallbackQuantity || 0),
        expiry_date: null,
        received_date: new Date('1970-01-01T00:00:00.000Z')
      }
    ];
  }

  return [];
};

const allocateBatchesFEFO = (batches = [], requestedQuantity = 0) => {
  let remaining = Number(requestedQuantity || 0);
  const sorted = [...batches].sort((a, b) => {
    const aExpiry = toComparableDate(a.expiry_date, new Date('9999-12-31T00:00:00.000Z')).getTime();
    const bExpiry = toComparableDate(b.expiry_date, new Date('9999-12-31T00:00:00.000Z')).getTime();
    if (aExpiry !== bExpiry) {
      return aExpiry - bExpiry;
    }

    const aReceived = toComparableDate(a.received_date, new Date('1970-01-01T00:00:00.000Z')).getTime();
    const bReceived = toComparableDate(b.received_date, new Date('1970-01-01T00:00:00.000Z')).getTime();
    if (aReceived !== bReceived) {
      return aReceived - bReceived;
    }

    const aBatchNumber = String(a?.batch_number || '').trim().toLowerCase();
    const bBatchNumber = String(b?.batch_number || '').trim().toLowerCase();
    return aBatchNumber.localeCompare(bBatchNumber);
  });

  const allocations = [];
  for (const batch of sorted) {
    if (remaining <= 0) {
      break;
    }

    const available = Number(batch.quantity_available || 0);
    if (available <= 0) {
      continue;
    }

    const quantity = Math.min(remaining, available);
    remaining -= quantity;
    allocations.push({
      source_batch_number: batch.batch_number,
      destination_batch_number: batch.batch_number,
      quantity,
      expiry_date: batch.expiry_date || null
    });
  }

  return {
    allocations,
    remaining
  };
};

const mergeOrAppendDestinationBatch = (batches = [], allocation) => {
  const batchNumber = String(allocation.destination_batch_number || '').trim();
  if (!batchNumber) {
    return batches;
  }

  const existing = batches.find(
    (batch) => String(batch.batch_number || '').trim().toLowerCase() === batchNumber.toLowerCase()
  );

  if (existing) {
    existing.quantity_available = Number(existing.quantity_available || 0) + Number(allocation.quantity || 0);
    if (!existing.expiry_date && allocation.expiry_date) {
      existing.expiry_date = allocation.expiry_date;
    }
    return batches;
  }

  batches.push({
    batch_number: batchNumber,
    quantity_available: Number(allocation.quantity || 0),
    expiry_date: allocation.expiry_date || null,
    received_date: new Date()
  });
  return batches;
};

const isBatchReceiveDebugEnabled = () => /^(1|true|yes|on)$/i.test(String(process.env.SPAREPART_BATCH_DEBUG || '').trim());

const logBatchReceiveDebug = (message, meta = {}) => {
  if (!isBatchReceiveDebugEnabled()) {
    return;
  }
  console.debug(`[Transfer.receive.batch] ${message}`, meta);
};

const incrementDestinationInventory = async ({ destinationStoreId, item, session = null }) => {
  const itemPartId = extractItemPartId(item);
  const quantity = Number(item.quantity || 0);
  const resolvedName = String(item.item_name || item.spare_part_name || item.itemName || item.sparePartName || '').trim()
    || getFallbackItemName(itemPartId);
  const normalizedName = String(item.normalized_name || resolvedName).trim().toLowerCase();
  const machineId = String(item.machine_id || item.machineId || itemPartId || 'UNKNOWN').trim();
  
  // Extract batch allocations from transfer item
  const batchAllocations = Array.isArray(item.batch_allocations) ? item.batch_allocations : [];
  
  // If no batch allocations, fall back to simple quantity increment (backward compatibility)
  if (batchAllocations.length === 0) {
    logBatchReceiveDebug('no batch allocations for item, using simple increment', {
      spare_part_name: resolvedName,
      quantity
    });
    
    return attachSession(
      SparePart.findOneAndUpdate(
        {
          store_id: destinationStoreId,
          normalized_name: normalizedName
        },
        {
          $inc: { quantity_available: quantity },
          $setOnInsert: {
            name: resolvedName,
            normalized_name: normalizedName,
            store_id: destinationStoreId,
            machine_id: machineId,
            minimum_required: Number(item.minimum_required || 0),
            warranty_expiry_date: item.warranty_expiry_date || null
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      ),
      session
    );
  }

  // Batch allocations exist - need to merge/create batches
  logBatchReceiveDebug('processing batch allocations for incoming shipment', {
    spare_part_name: resolvedName,
    allocation_count: batchAllocations.length,
    total_quantity: batchAllocations.reduce((sum, ba) => sum + (ba.quantity || 0), 0)
  });

  // Find or create SparePart with current batches
  const existingSparePart = await attachSession(
    SparePart.findOne({
      store_id: destinationStoreId,
      normalized_name: normalizedName
    }),
    session
  );

  let updatedBatches = [];
  const now = new Date();

  if (existingSparePart && Array.isArray(existingSparePart.batches)) {
    // Clone existing batches
    updatedBatches = existingSparePart.batches.map(b => ({
      _id: b._id,
      batch_number: b.batch_number,
      quantity: Number(b.quantity || 0),
      expiry_date: b.expiry_date,
      received_date: b.received_date
    }));
  }

  // Process each batch allocation
  for (const allocation of batchAllocations) {
    const destBatchNumber = String(allocation.destination_batch_number || '').trim();
    const allocationQuantity = Number(allocation.quantity || 0);
    const expiryDate = allocation.expiry_date || null;

    if (!destBatchNumber || allocationQuantity <= 0) {
      logBatchReceiveDebug('skipping invalid batch allocation', {
        batch_number: destBatchNumber,
        quantity: allocationQuantity
      });
      continue;
    }

    // Find existing batch with same number
    const existingBatchIdx = updatedBatches.findIndex(b => b.batch_number.toLowerCase() === destBatchNumber.toLowerCase());

    if (existingBatchIdx >= 0) {
      // Merge into existing batch
      updatedBatches[existingBatchIdx].quantity += allocationQuantity;
      logBatchReceiveDebug('batch merged', {
        batch_number: destBatchNumber,
        added_quantity: allocationQuantity,
        new_total: updatedBatches[existingBatchIdx].quantity
      });
    } else {
      // Create new batch
      const newBatch = {
        batch_number: destBatchNumber,
        quantity: allocationQuantity,
        expiry_date: expiryDate,
        received_date: now
      };
      updatedBatches.push(newBatch);
      logBatchReceiveDebug('batch created', {
        batch_number: destBatchNumber,
        quantity: allocationQuantity,
        has_expiry: Boolean(expiryDate)
      });
    }
  }

  // Calculate total quantity from batches
  const aggregatedQuantity = updatedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  logBatchReceiveDebug('quantity synced from batches', {
    batch_count: updatedBatches.length,
    quantity_available: aggregatedQuantity
  });

  // Upsert SparePart with updated batches and synced quantity
  return attachSession(
    SparePart.findOneAndUpdate(
      {
        store_id: destinationStoreId,
        normalized_name: normalizedName
      },
      {
        $set: {
          batches: updatedBatches,
          quantity_available: aggregatedQuantity
        },
        $setOnInsert: {
          name: resolvedName,
          normalized_name: normalizedName,
          store_id: destinationStoreId,
          machine_id: machineId,
          minimum_required: Number(item.minimum_required || 0),
          warranty_expiry_date: item.warranty_expiry_date || null
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ),
    session
  );
};

const toTransferResponse = (doc) => {
  const safeItems = Array.isArray(doc?.items) ? doc.items.filter(Boolean) : [];

  return {
  id: doc._id.toString(),
  type: doc.type || 'internal',
  from_store_id: doc.from_store_id,
  source_store_id: doc.from_store_id,
  fromStoreId: doc.from_store_id,
  from_store_name: doc.from_store_name,
  fromStoreName: doc.from_store_name,
  from_external_name: doc.from_external_name || '',
  fromExternalName: doc.from_external_name || '',
  to_store_id: doc.to_store_id,
  destination_store_id: doc.to_store_id,
  toStoreId: doc.to_store_id,
  to_store_name: doc.to_store_name,
  toStoreName: doc.to_store_name,
  to_external_name: doc.to_external_name || '',
  toExternalName: doc.to_external_name || '',
  items: safeItems.map(item => {
    const populatedItem = item.item_id && typeof item.item_id === 'object' ? item.item_id : null;
    const populatedName = String(populatedItem?.name || '').trim();
    const itemPartId = extractItemPartId(item);
    const itemName = String(item.item_name || item.spare_part_name || populatedName || item.normalized_name || '').trim();
    const sparePartName = String(item.spare_part_name || item.item_name || populatedName || '').trim();
    
    return ({
      id: item._id?.toString(),
      spare_part_id: item.spare_part_id,
      sparePartId: item.spare_part_id,
      spare_part_name: sparePartName,
      sparePartName: sparePartName,
      item_id: populatedItem
        ? {
            _id: normalizePartIdValue(populatedItem),
            name: populatedName
          }
        : normalizePartIdValue(item.item_id || item.spare_part_id),
      itemId: itemPartId,
      item_name: itemName || sparePartName,
      itemName: itemName || sparePartName,
      quantity: item.quantity,
      batch_allocations: (item.batch_allocations || []).map((allocation) => ({
        source_batch_number: allocation.source_batch_number,
        sourceBatchNumber: allocation.source_batch_number,
        destination_batch_number: allocation.destination_batch_number,
        destinationBatchNumber: allocation.destination_batch_number,
        quantity: allocation.quantity,
        expiry_date: allocation.expiry_date,
        expiryDate: allocation.expiry_date
      }))
    });
  }),
  total_items: Number(doc.total_items || safeItems.length || 0),
  totalItems: Number(doc.total_items || safeItems.length || 0),
  driver: doc.driver ? {
    name: doc.driver.name,
    phone: doc.driver.phone,
    driver_id: doc.driver.driver_id,
    driverId: doc.driver.driver_id
  } : null,
  vehicle_number: doc.vehicle_number || '',
  vehicleNumber: doc.vehicle_number || '',
  mode_of_transport: doc.mode_of_transport || 'Unknown',
  modeOfTransport: doc.mode_of_transport || 'Unknown',
  distance_km: Number(doc.distance_km || 0),
  distance: Number(doc.distance_km || 0),
  approved_by: doc.approved_by || '',
  approvedBy: doc.approved_by || '',
  approved_date: doc.approved_date || null,
  approvedDate: doc.approved_date || null,
  dispatch_date: doc.dispatch_date || null,
  dispatchDate: doc.dispatch_date || null,
  expected_delivery_date: doc.expected_delivery_date || null,
  expectedDeliveryDate: doc.expected_delivery_date || null,
  received_date: doc.received_date || null,
  receivedDate: doc.received_date || null,
  received_by: doc.received_by || '',
  receivedBy: doc.received_by || '',
  confirmation_date: doc.confirmation_date || null,
  confirmationDate: doc.confirmation_date || null,
  confirmed_by: doc.confirmed_by || '',
  confirmedBy: doc.confirmed_by || '',
  receive_notes: doc.receive_notes || '',
  receiveNotes: doc.receive_notes || '',
  status: doc.status,
  transferred_by: doc.transferred_by,
  transferredBy: doc.transferred_by,
  created_by: doc.created_by || doc.transferred_by || 'System',
  createdBy: doc.created_by || doc.transferred_by || 'System',
  notes: doc.notes,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
  };
};

// Create a new transfer with transaction safety and standalone fallback.
const createTransferInternal = async (req, res, useTransaction = true, lockAcquired = false) => {
  if (!useTransaction && !lockAcquired) {
    const fromStoreLockKey = req.body?.from_store_id || req.body?.fromStoreId || 'unknown';
    return withTransferLock(fromStoreLockKey, () => createTransferInternal(req, res, false, true));
  }

  let session = null;
  try {
    if (useTransaction) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const {
      type,
      from_store_id,
      source_store_id,
      fromStoreId,
      from_external_name,
      fromExternalName,
      to_store_id,
      destination_store_id,
      toStoreId,
      from_store_name,
      fromStoreName,
      to_store_name,
      toStoreName,
      to_external_name,
      toExternalName,
      items,
      driver,
      vehicle_number,
      vehicleNumber,
      mode_of_transport,
      modeOfTransport,
      distance,
      distance_km,
      approved_by,
      approvedBy,
      approved_date,
      approvedDate,
      dispatch_date,
      dispatchDate,
      expected_delivery_date,
      expectedDeliveryDate,
      status,
      created_by,
      createdBy,
      transferred_by,
      transferredBy,
      notes
    } = req.body;

    const transferTypeValue = String(type || 'internal').toLowerCase();
    const isIncoming = transferTypeValue === 'incoming';
    const isOutgoing = transferTypeValue === 'outgoing';
    const isInternal = transferTypeValue === 'internal';
    const hasExplicitInstantFlag = Object.prototype.hasOwnProperty.call(req.body || {}, 'isInstant')
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'is_instant');
    const isInstantValue = hasExplicitInstantFlag
      ? Boolean(req.body?.isInstant || req.body?.is_instant)
      : isInternal;

    const fromStoreIdValue = from_store_id || source_store_id || fromStoreId;
    const fromExternalNameValue = String(from_external_name || fromExternalName || '').trim();
    const toStoreIdValue = to_store_id || destination_store_id || toStoreId;
    const toExternalNameValue = String(to_external_name || toExternalName || '').trim();
    const fromStoreNameValue = from_store_name || fromStoreName || fromExternalNameValue || 'Unknown Source';
    const toStoreNameValue = to_store_name || toStoreName || toExternalNameValue || 'Unknown Destination';
    const transferredByValue = transferred_by || transferredBy || created_by || createdBy || 'System';
    const createdByValue = created_by || createdBy || transferredByValue;

    const driverNameValue = String(driver?.name || '').trim();
    const driverPhoneValue = String(driver?.phone || '').trim();
    const driverIdValue = String(driver?.driverId || driver?.driver_id || '').trim();
    const modeOfTransportValue = String(mode_of_transport || modeOfTransport || 'Truck').trim();
    const vehicleNumberValue = String(vehicle_number || vehicleNumber || '').trim();
    const distanceValue = Number(distance ?? distance_km ?? 0);
    const approvedByValue = String(approved_by || approvedBy || '').trim();
    const approvedDateValue = approved_date || approvedDate || null;
    const normalizedApprovedDate = approvedDateValue ? new Date(approvedDateValue) : null;
    const dispatchDateValue = dispatch_date || dispatchDate || new Date();
    const expectedDeliveryDateValue = expected_delivery_date || expectedDeliveryDate || null;
    const normalizedDispatchDate = new Date(dispatchDateValue);
    const normalizedExpectedDate = expectedDeliveryDateValue ? new Date(expectedDeliveryDateValue) : null;
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const statusValue = normalizedStatus || (isInstantValue ? 'completed' : 'in_transit');

    // Validation
    const errors = [];
    if (isInternal || isOutgoing) {
      if (!fromStoreIdValue || fromStoreIdValue.trim() === '') {
        errors.push('From store ID is required');
      }
    }
    if (isInternal) {
      if (!toStoreIdValue || String(toStoreIdValue).trim() === '') {
        errors.push('To store ID is required');
      }
      if (toStoreIdValue && fromStoreIdValue === toStoreIdValue) {
        errors.push('Cannot transfer to the same store');
      }
    }
    if (isOutgoing) {
      if (!toStoreIdValue && !toExternalNameValue) {
        errors.push('Provide either an internal destination store or an external destination name');
      }
    }
    if (isIncoming) {
      if (!toStoreIdValue || String(toStoreIdValue).trim() === '') {
        errors.push('To store ID is required for incoming shipments');
      }
      if (fromExternalNameValue || fromStoreNameValue) {
        // OK for source
      } else {
        errors.push('Source name is required for incoming shipments');
      }
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push('At least one item is required for transfer');
    }

    // Driver/logistics required for incoming/outgoing shipment flows.
    if (isIncoming || isOutgoing) {
      if (!driverNameValue || !driverPhoneValue || !driverIdValue) {
        errors.push('Driver name, phone, and driver ID are required for shipments');
      }
      if (Number.isNaN(normalizedDispatchDate.getTime())) {
        errors.push('Dispatch date is invalid');
      }
      if (!normalizedExpectedDate || Number.isNaN(normalizedExpectedDate.getTime())) {
        errors.push('Expected delivery date is required');
      }
      if (
        !Number.isNaN(normalizedDispatchDate.getTime()) &&
        normalizedExpectedDate &&
        !Number.isNaN(normalizedExpectedDate.getTime()) &&
        normalizedExpectedDate.getTime() <= normalizedDispatchDate.getTime()
      ) {
        errors.push('Expected delivery date must be later than dispatch date');
      }
    }

    if (errors.length > 0) {
      if (session) {
        await session.abortTransaction();
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Validate each item and check stock availability ONLY for non-incoming (has source inventory)
    const transferItems = [];
    if (!isIncoming) {
      for (const item of items) {
        const { spare_part_id, sparePartId, item_id, itemId, spare_part_name, sparePartName, item_name, itemName, quantity } = item;
        const partId = spare_part_id || sparePartId;

        if (!partId || partId.trim() === '') {
          errors.push('Spare part ID is required for each item');
          continue;
        }

        if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
          errors.push(`Invalid quantity for part ${partId}`);
          continue;
        }

        // Find the spare part in the source store
        const sparePart = await attachSession(SparePart.findOne({
          _id: partId,
          store_id: fromStoreIdValue
        }), session);

        if (!sparePart) {
          errors.push(`Spare part ${partId} not found in source store`);
          continue;
        }

        if (sparePart.quantity_available < Number(quantity)) {
          errors.push(`Insufficient stock for ${sparePart.name}. Available: ${sparePart.quantity_available}, Requested: ${quantity}`);
          continue;
        }

        const normalizedBatches = normalizeBatches(
          sparePart.batches || [],
          sparePart.quantity_available,
          partId
        );
        const { allocations, remaining } = allocateBatchesFEFO(normalizedBatches, Number(quantity));
        if (remaining > 0) {
          errors.push(`Insufficient lot stock for ${sparePart.name}. Available in batches: ${Number(quantity) - remaining}, Requested: ${quantity}`);
          continue;
        }

        transferItems.push({
          spare_part_id: partId,
          spare_part_name: sparePart.name,
          item_id: mongoose.Types.ObjectId.isValid(partId) ? new mongoose.Types.ObjectId(partId) : partId,
          item_name: item_name || itemName || spare_part_name || sparePartName || sparePart.name,
          normalized_name: sparePart.normalized_name || String(sparePart.name || '').trim().toLowerCase(),
          machine_id: String(sparePart.machine_id || ''),
          minimum_required: sparePart.minimum_required,
          warranty_expiry_date: sparePart.warranty_expiry_date,
          quantity: Number(quantity),
          batch_allocations: allocations
        });
      }
    } else {
      // For incoming, create transfer items without source-stock validation (external source)
      const incomingPartIds = items
        .map((item) => extractItemPartId(item))
        .filter(Boolean);
      const incomingNameMap = await resolveSparePartNameMap(incomingPartIds, session);

      for (const item of items) {
        const { spare_part_id, sparePartId, item_id, itemId, spare_part_name, sparePartName, item_name, itemName, quantity, machine_id, minimum_required, warranty_expiry_date } = item;
        const partId = spare_part_id || sparePartId || item_id || itemId;

        if (!partId || partId.trim() === '') {
          errors.push('Spare part ID is required for each item');
          continue;
        }

        if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
          errors.push(`Invalid quantity for part ${partId}`);
          continue;
        }

        const partMeta = incomingNameMap.get(String(partId || '').trim()) || null;
        const resolvedName = spare_part_name || sparePartName || item_name || itemName || partMeta?.name || getFallbackItemName(partId);
        const resolvedNormalizedName = (partMeta?.normalizedName || resolvedName || '').trim().toLowerCase();

        transferItems.push({
          spare_part_id: partId,
          spare_part_name: resolvedName,
          item_id: mongoose.Types.ObjectId.isValid(partId) ? new mongoose.Types.ObjectId(partId) : partId,
          item_name: resolvedName,
          normalized_name: resolvedNormalizedName,
          machine_id: String(machine_id || ''),
          minimum_required: Number(minimum_required || 0),
          warranty_expiry_date: warranty_expiry_date || null,
          quantity: Number(quantity),
          batch_allocations: []
        });
      }
    }

    if (errors.length > 0) {
      if (session) {
        await session.abortTransaction();
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Process transfers with transaction safety - NO source deduct/add for incoming
    if (!isIncoming) {
      for (const item of transferItems) {
        // Deduct from source store by allocated lots.
        const sourcePart = await attachSession(SparePart.findOne({
          _id: item.spare_part_id,
          store_id: fromStoreIdValue
        }), session);

        if (!sourcePart) {
          throw new Error(`Failed to deduct stock for ${item.spare_part_name}`);
        }

        const hasSourceBatches = Array.isArray(sourcePart.batches) && sourcePart.batches.length > 0;
        if (hasSourceBatches) {
          for (const allocation of item.batch_allocations || []) {
            const sourceBatch = (sourcePart.batches || []).find(
              (batch) => String(batch.batch_number || '').trim().toLowerCase() === String(allocation.source_batch_number || '').trim().toLowerCase()
            );

            const currentBatchQuantity = Number(sourceBatch?.quantity ?? sourceBatch?.quantity_available ?? 0);
            if (!sourceBatch || currentBatchQuantity < Number(allocation.quantity || 0)) {
              throw new Error(`Batch stock mismatch for ${item.spare_part_name} in batch ${allocation.source_batch_number}`);
            }

            sourceBatch.quantity = currentBatchQuantity - Number(allocation.quantity || 0);
          }

          sourcePart.batches = (sourcePart.batches || []).filter(
            (batch) => Number(batch?.quantity ?? batch?.quantity_available ?? 0) > 0
          );
          sourcePart.quantity_available = Number(
            sourcePart.batches.reduce((sum, batch) => sum + Number(batch?.quantity ?? batch?.quantity_available ?? 0), 0)
          );
        } else {
          sourcePart.quantity_available = Math.max(0, Number(sourcePart.quantity_available || 0) - Number(item.quantity || 0));
        }

        await sourcePart.save({ session });

        // Add inventory to destination only for instant moves.
        if (isInstantValue && toStoreIdValue) {
          let destinationPart = await attachSession(SparePart.findOne({
            store_id: toStoreIdValue,
            normalized_name: item.normalized_name
          }), session);

          if (!destinationPart) {
            destinationPart = await SparePart.create([{
              name: item.spare_part_name,
              normalized_name: item.normalized_name,
              store_id: toStoreIdValue,
              machine_id: item.machine_id,
              minimum_required: item.minimum_required,
              warranty_expiry_date: item.warranty_expiry_date,
              quantity_available: 0,
              batches: []
            }], { session }).then((docs) => docs[0]);
          }

          if ((!destinationPart.batches || destinationPart.batches.length === 0) && Number(destinationPart.quantity_available || 0) > 0) {
            destinationPart.batches = [{
              batch_number: `OPENING-${String(destinationPart._id || item.spare_part_id).slice(-8)}`,
              quantity_available: Number(destinationPart.quantity_available || 0),
              expiry_date: null,
              received_date: new Date('1970-01-01T00:00:00.000Z')
            }];
          }

          destinationPart.batches = Array.isArray(destinationPart.batches) ? destinationPart.batches : [];
          for (const allocation of item.batch_allocations || []) {
            mergeOrAppendDestinationBatch(destinationPart.batches, allocation);
          }

          destinationPart.quantity_available = Number(
            destinationPart.batches.reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0)
          );
          await destinationPart.save({ session });
        }
      }
    }

    // Create transfer record
    const transferDoc = new Transfer({
      type: transferTypeValue,
      isInstant: isInstantValue,
      from_store_id: fromStoreIdValue || '',
      from_store_name: fromStoreNameValue,
      from_external_name: fromExternalNameValue,
      to_store_id: toStoreIdValue || '',
      to_store_name: toStoreNameValue,
      to_external_name: toExternalNameValue,
      items: transferItems,
      total_items: transferItems.length,
      driver: (isIncoming || isOutgoing) ? {
        name: driverNameValue,
        phone: driverPhoneValue,
        driver_id: driverIdValue
      } : null,
      vehicle_number: vehicleNumberValue,
      mode_of_transport: modeOfTransportValue || 'Truck',
      distance_km: Number.isFinite(distanceValue) ? Math.max(0, distanceValue) : 0,
      approved_by: approvedByValue,
      approved_date: normalizedApprovedDate && !Number.isNaN(normalizedApprovedDate.getTime()) ? normalizedApprovedDate : null,
      dispatch_date: Number.isNaN(normalizedDispatchDate.getTime()) ? new Date() : normalizedDispatchDate,
      expected_delivery_date: normalizedExpectedDate && !Number.isNaN(normalizedExpectedDate.getTime()) ? normalizedExpectedDate : null,
      received_date: null,
      received_by: '',
      confirmation_date: null,
      confirmed_by: '',
      receive_notes: '',
      status: statusValue,
      transferred_by: transferredByValue,
      created_by: createdByValue,
      notes: notes || ''
    });

    const transfer = await transferDoc.save(session ? { session } : undefined);

    if (session) {
      await session.commitTransaction();
    }

    const hydratedTransfer = (await hydrateTransferResponsesWithNames([toTransferResponse(transfer)], session))[0];

    return res.status(201).json({
      success: true,
      data: { transfer: hydratedTransfer },
      message: isIncoming
        ? `Incoming shipment created from ${fromStoreNameValue} to ${toStoreNameValue}`
        : isOutgoing
        ? `Shipment dispatched from ${fromStoreNameValue} to ${toStoreNameValue || toExternalNameValue || 'destination'}`
        : `Successfully transferred ${transferItems.length} item(s) from ${fromStoreNameValue} to ${toStoreNameValue}`
    });

  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // Ignore abort errors; original error is more important.
      }
    }

    if (useTransaction && isTransactionUnsupported(error)) {
      return createTransferInternal(req, res, false);
    }

    console.error('Transfer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing transfer',
      error: error.message
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

exports.createTransfer = async (req, res) => createTransferInternal(req, res, true);

exports.approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, approved_by, approvedDate, approved_date, decision, notes } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, message: 'Transfer ID is required' });
    }

    const transfer = await Transfer.findById(id);
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    const approvedByValue = String(approvedBy || approved_by || '').trim();
    if (!approvedByValue) {
      return res.status(400).json({ success: false, message: 'Approved by is required' });
    }

    const approvedDateValue = approvedDate || approved_date || new Date();
    const normalizedApprovedDate = new Date(approvedDateValue);
    transfer.approved_by = approvedByValue;
    transfer.approved_date = Number.isNaN(normalizedApprovedDate.getTime()) ? new Date() : normalizedApprovedDate;

    const decisionValue = String(decision || '').trim().toLowerCase();
    const isReceived = decisionValue === 'received' || decisionValue === 'yes' || decisionValue === 'approve' || decisionValue === 'approved';
    const isNotReceived = decisionValue === 'not_received' || decisionValue === 'no' || decisionValue === 'reject' || decisionValue === 'rejected';

    if (isNotReceived) {
      transfer.receive_notes = String(notes || '').trim();
      if (transfer.status === 'completed' || transfer.status === 'received') {
        return res.status(400).json({ success: false, message: 'Shipment is already completed' });
      }
      transfer.status = 'in_transit';
      await transfer.save();
      return res.status(200).json({
        success: true,
        data: { transfer: toTransferResponse(transfer) },
        message: 'Shipment marked as not received yet'
      });
    }

    await transfer.save();

    if (isReceived || !decisionValue) {
      req.body = {
        receivedDate: approvedDateValue,
        receivedBy: approvedByValue,
        notes: String(notes || '').trim()
      };
      return exports.markTransferReceived(req, res);
    }

    return res.status(400).json({
      success: false,
      message: "Decision must be either 'received' or 'not_received'"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error approving shipment',
      error: error.message
    });
  }
};

const markTransferReceivedInternal = async (req, res, lockAcquired = false) => {
  let session = null;
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Transfer ID is required' });
    }

    if (!lockAcquired) {
      const lockTransfer = await Transfer.findById(id).select('to_store_id').lean();
      if (!lockTransfer) {
        return res.status(404).json({ success: false, message: 'Transfer not found' });
      }

      const lockKey = `receive-${String(lockTransfer.to_store_id || id)}`;
      return withTransferLock(lockKey, () => markTransferReceivedInternal(req, res, true));
    }

    const {
      receivedDate,
      received_date,
      receivedBy,
      received_by,
      phone,
      approved_by,
      notes,
      confirmationBy,
      confirmedBy,
      confirmation_by,
      confirmed_by,
      confirmerName,
      confirmationDate,
      confirmedDate,
      confirmation_date,
      confirmed_date
    } = req.body || {};

    session = await mongoose.startSession();
    session.startTransaction();

    const transfer = await attachSession(Transfer.findById(id), session);
    if (!transfer) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    const transferTypeValue = String(transfer.type || '').trim().toLowerCase();
    if (!RECEIVABLE_TRANSFER_TYPES.has(transferTypeValue)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Only incoming or outgoing shipments can be marked as received' });
    }

    if (transfer.status === 'received' || transfer.status === 'completed') {
      await session.abortTransaction();
      const hydrated = (await hydrateTransferResponsesWithNames([toTransferResponse(transfer)], session))[0];
      return res.status(409).json({
        success: false,
        data: { transfer: hydrated },
        message: 'Shipment already marked as received'
      });
    }

    if (transfer.status !== 'in_transit' && transfer.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Shipment cannot be received from status '${transfer.status}'` });
    }

    const destinationStoreId = String(transfer.to_store_id || '').trim();
    if (!destinationStoreId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Destination store is required to receive shipment' });
    }

    const confirmerNameValue = String(
      confirmationBy
      || confirmedBy
      || confirmation_by
      || confirmed_by
      || confirmerName
      || receivedBy
      || received_by
      || approved_by
      || ''
    ).trim();

    if (!confirmerNameValue) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Confirmer name is required' });
    }

    const confirmationDateValue = confirmationDate
      || confirmedDate
      || confirmation_date
      || confirmed_date
      || receivedDate
      || received_date;
    const normalizedConfirmationDate = confirmationDateValue ? new Date(confirmationDateValue) : null;
    if (!normalizedConfirmationDate || Number.isNaN(normalizedConfirmationDate.getTime())) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid confirmation date is required' });
    }

    if (!Array.isArray(transfer.items) || transfer.items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Transfer items are required to receive shipment' });
    }

    const invalidItem = transfer.items.find((item) => !extractItemPartId(item) || Number(item.quantity || 0) <= 0);
    if (invalidItem) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Each transfer item must include itemId/sparePartId and quantity > 0' });
    }

    console.log('Receiving transfer:', transfer._id.toString());
    console.log('Items:', transfer.items);
    console.log('Destination:', destinationStoreId);

    // Add to destination inventory only (never source store).
    for (const item of transfer.items || []) {
      await incrementDestinationInventory({ destinationStoreId, item, session });
    }

    transfer.received_date = normalizedConfirmationDate;
    transfer.received_by = confirmerNameValue;
    transfer.confirmation_date = normalizedConfirmationDate;
    transfer.confirmed_by = confirmerNameValue;
    transfer.approved_by = String(approved_by || confirmerNameValue).trim();
    transfer.receive_notes = String(notes || '').trim();
    if (String(phone || '').trim()) {
      transfer.receive_notes = transfer.receive_notes
        ? `${transfer.receive_notes} | phone: ${String(phone || '').trim()}`
        : `phone: ${String(phone || '').trim()}`;
    }
    transfer.status = 'received';
    await transfer.save({ session });

    await session.commitTransaction();
    const hydratedTransfer = (await hydrateTransferResponsesWithNames([toTransferResponse(transfer)]))[0];

    return res.status(200).json({
      success: true,
      data: { transfer: hydratedTransfer },
      message: 'Transfer confirmed and inventory updated'
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (_) {
        // no-op
      }
    }

    if (isTransactionUnsupported(error)) {
      try {
        const confirmerNameValue = String(
          req.body?.confirmationBy
          || req.body?.confirmedBy
          || req.body?.confirmation_by
          || req.body?.confirmed_by
          || req.body?.confirmerName
          || req.body?.receivedBy
          || req.body?.received_by
          || req.body?.approved_by
          || ''
        ).trim();
        if (!confirmerNameValue) {
          return res.status(400).json({ success: false, message: 'Confirmer name is required' });
        }

        const confirmationDateValue = req.body?.confirmationDate
          || req.body?.confirmedDate
          || req.body?.confirmation_date
          || req.body?.confirmed_date
          || req.body?.receivedDate
          || req.body?.received_date;
        const normalizedConfirmationDate = confirmationDateValue ? new Date(confirmationDateValue) : null;
        if (!normalizedConfirmationDate || Number.isNaN(normalizedConfirmationDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Valid confirmation date is required' });
        }

        const transfer = await Transfer.findById(req.params.id);
        if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found' });

        const transferTypeValue = String(transfer.type || '').trim().toLowerCase();
        if (!RECEIVABLE_TRANSFER_TYPES.has(transferTypeValue)) {
          return res.status(400).json({ success: false, message: 'Only incoming or outgoing shipments can be marked as received' });
        }

        if (transfer.status === 'received' || transfer.status === 'completed') {
          const hydrated = (await hydrateTransferResponsesWithNames([toTransferResponse(transfer)]))[0];
          return res.status(409).json({
            success: false,
            data: { transfer: hydrated },
            message: 'Shipment already marked as received'
          });
        }
        const destinationStoreId = String(transfer.to_store_id || '').trim();
        if (!destinationStoreId) return res.status(400).json({ success: false, message: 'Destination store is required to receive shipment' });

        if (!Array.isArray(transfer.items) || transfer.items.length === 0) {
          return res.status(400).json({ success: false, message: 'Transfer items are required to receive shipment' });
        }

        const invalidItem = transfer.items.find((item) => !extractItemPartId(item) || Number(item.quantity || 0) <= 0);
        if (invalidItem) {
          return res.status(400).json({ success: false, message: 'Each transfer item must include itemId/sparePartId and quantity > 0' });
        }

        console.log('Receiving transfer:', transfer._id.toString());
        console.log('Items:', transfer.items);
        console.log('Destination:', destinationStoreId);

        for (const item of transfer.items || []) {
          await incrementDestinationInventory({ destinationStoreId, item });
        }

        transfer.received_date = normalizedConfirmationDate;
        transfer.received_by = confirmerNameValue;
        transfer.confirmation_date = normalizedConfirmationDate;
        transfer.confirmed_by = confirmerNameValue;
        transfer.approved_by = String(req.body?.approved_by || confirmerNameValue).trim();
        transfer.receive_notes = String(req.body?.notes || '').trim();
        if (String(req.body?.phone || '').trim()) {
          transfer.receive_notes = transfer.receive_notes
            ? `${transfer.receive_notes} | phone: ${String(req.body?.phone || '').trim()}`
            : `phone: ${String(req.body?.phone || '').trim()}`;
        }
        transfer.status = 'received';
        await transfer.save();

        const hydratedTransfer = (await hydrateTransferResponsesWithNames([toTransferResponse(transfer)]))[0];

        return res.status(200).json({
          success: true,
          data: { transfer: hydratedTransfer },
          message: 'Transfer confirmed and inventory updated'
        });
      } catch (fallbackError) {
        return res.status(500).json({
          success: false,
          message: 'Error receiving shipment',
          error: fallbackError.message
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Error receiving shipment',
      error: error.message
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

exports.markTransferReceived = async (req, res) => markTransferReceivedInternal(req, res, false);

// Get all transfers with optional filters
exports.getTransfers = async (req, res) => {
  try {
    if (!Transfer) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, limit: 50, pages: 0 },
        message: 'No transfers available (degraded mode)'
      });
    }
    const {
      tab,
      fromStoreId,
      toStoreId,
      source_store_id,
      destination_store_id,
      storeId,
      type,
      status,
      dateFrom,
      dateTo,
      startDate,
      endDate,
      limit = 50,
      page = 1
    } = req.query;
    const filter = {};
    
    const tabValue = String(tab || '').toLowerCase();
    if (tabValue === 'transfers') {
      filter.$or = [{ type: 'transfer' }, { isInstant: true }];
    } else if (tabValue === 'in_transit') {
      filter.status = 'in_transit';
    } else if (tabValue === 'received') {
      filter.status = { $in: ['completed', 'received'] };
      filter.received_date = { $ne: null };
    } else if (tabValue === 'delayed') {
      filter.status = 'in_transit';
      filter.expected_delivery_date = { $lt: new Date() };
    }

    const effectiveFromStoreId = fromStoreId || source_store_id;
    const effectiveToStoreId = toStoreId || destination_store_id;

    if (effectiveFromStoreId) {
      filter.from_store_id = effectiveFromStoreId;
    }
    if (effectiveToStoreId) {
      filter.to_store_id = effectiveToStoreId;
    }
    if (storeId) {
      filter.$or = [
        { from_store_id: storeId },
        { to_store_id: storeId }
      ];
    }

    if (type) {
      filter.type = String(type).toLowerCase();
    }
    if (status) {
      const statusValue = String(status).toLowerCase();
      if (statusValue === 'completed') {
        filter.status = { $in: ['completed', 'received'] };
      } else {
        filter.status = statusValue;
      }
    }

    const effectiveDateFrom = dateFrom || startDate;
    const effectiveDateTo = dateTo || endDate;
    if (effectiveDateFrom || effectiveDateTo) {
      filter.dispatch_date = {};
      if (effectiveDateFrom) {
        filter.dispatch_date.$gte = new Date(effectiveDateFrom);
      }
      if (effectiveDateTo) {
        filter.dispatch_date.$lte = new Date(effectiveDateTo);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const transfers = await Transfer.find(filter)
      .populate('items.item_id', 'name')
      .sort({ dispatch_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const transferDebugEnabled = /^(1|true|yes|on)$/i.test(String(process.env.TRANSFER_DEBUG || '').trim());
    if (transferDebugEnabled) {
      console.log(JSON.stringify(transfers.map((transfer) => transfer.toObject()), null, 2));
    }

    const missingItemReferences = [];
    for (const transfer of transfers) {
      for (const item of transfer.items || []) {
        const populatedItem = item.item_id && typeof item.item_id === 'object' ? item.item_id : null;
        if (!String(populatedItem?.name || '').trim()) {
          const missingId = normalizePartIdValue(item.item_id || item.spare_part_id || '');
          if (missingId) {
            missingItemReferences.push(missingId);
          }
        }
      }
    }

    if (missingItemReferences.length > 0) {
      const uniqueMissing = [...new Set(missingItemReferences)];
      console.warn(`Missing SparePart references for transfer items: ${uniqueMissing.join(', ')}`);
    }

    const total = await Transfer.countDocuments(filter);

    const transferResponses = transfers.map(toTransferResponse);
    const hydratedTransfers = await hydrateTransferResponsesWithNames(transferResponses);

    return res.status(200).json({
      success: true,
      data: hydratedTransfers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      },
      message: `Successfully retrieved ${transfers.length} transfer(s)`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving transfers',
      error: error.message
    });
  }
};

// Get transfer by ID
exports.getTransferById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID is required'
      });
    }

    const transfer = await Transfer.findById(id).populate('items.item_id', 'name');

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }

    const hydratedTransfer = (await hydrateTransferResponsesWithNames([toTransferResponse(transfer)]))[0];

    return res.status(200).json({
      success: true,
      data: { transfer: hydratedTransfer },
      message: 'Transfer retrieved successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving transfer',
      error: error.message
    });
  }
};

// Get transfer statistics
exports.getTransferStats = async (req, res) => {
  try {
    const { storeId, dateFrom, dateTo, startDate, endDate } = req.query;
    const filter = {};

    if (storeId) {
      filter.$or = [
        { from_store_id: storeId },
        { to_store_id: storeId }
      ];
    }

    const effectiveDateFrom = dateFrom || startDate;
    const effectiveDateTo = dateTo || endDate;
    if (effectiveDateFrom || effectiveDateTo) {
      filter.dispatch_date = {};
      if (effectiveDateFrom) {
        filter.dispatch_date.$gte = new Date(effectiveDateFrom);
      }
      if (effectiveDateTo) {
        filter.dispatch_date.$lte = new Date(effectiveDateTo);
      }
    }

    const totalTransfers = await Transfer.countDocuments(filter);
    const outgoingFilter = { ...filter, type: 'outgoing', status: 'in_transit' };
    if (storeId) {
      outgoingFilter.from_store_id = storeId;
    }
    const outgoingTransfers = await Transfer.countDocuments(outgoingFilter);
    const incomingBaseFilter = { ...filter, type: 'incoming', status: 'in_transit' };
    const incomingTransfers = storeId
      ? await Transfer.countDocuments({ ...incomingBaseFilter, to_store_id: storeId })
      : await Transfer.countDocuments({ ...incomingBaseFilter });

    const completedTransfers = await Transfer.find({ ...filter, status: 'completed' });
    const totalItemsTransferred = completedTransfers.reduce((sum, t) => sum + Number(t.total_items || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        totalTransfers,
        outgoingTransfers,
        incomingTransfers,
        totalItemsTransferred
      },
      message: 'Transfer statistics retrieved successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving transfer statistics',
      error: error.message
    });
  }
};

