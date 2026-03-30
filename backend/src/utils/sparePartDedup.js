const normalizeSparePartName = (value) => String(value || '').trim().toLowerCase();

const mergeMachineIds = (target = [], source = []) => {
  return [...new Set(
    [...(Array.isArray(target) ? target : []), ...(Array.isArray(source) ? source : [])]
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];
};

const mergeBatchCollections = (targetBatches = [], sourceBatches = []) => {
  const merged = Array.isArray(targetBatches) ? [...targetBatches] : [];

  for (const sourceBatch of Array.isArray(sourceBatches) ? sourceBatches : []) {
    const batchNumber = String(sourceBatch?.batch_number || '').trim();
    if (!batchNumber) {
      continue;
    }

    const existing = merged.find(
      (batch) => String(batch?.batch_number || '').trim().toLowerCase() === batchNumber.toLowerCase()
    );

    if (existing) {
      existing.quantity_available = Number(existing.quantity_available || 0) + Number(sourceBatch.quantity_available || 0);
      if (!existing.expiry_date && sourceBatch.expiry_date) {
        existing.expiry_date = sourceBatch.expiry_date;
      }
      if (!existing.received_date && sourceBatch.received_date) {
        existing.received_date = sourceBatch.received_date;
      }
      continue;
    }

    merged.push({
      batch_number: batchNumber,
      quantity_available: Number(sourceBatch.quantity_available || 0),
      expiry_date: sourceBatch.expiry_date || null,
      received_date: sourceBatch.received_date || null
    });
  }

  return merged;
};

const mergeDuplicateSpareParts = async ({ SparePart, name, size, storeId, session = null }) => {
  if (!name) {
    return {
      normalizedName: '',
      normalizedSize: '',
      uniqueKey: '',
      merged: false,
      mergedCount: 0,
      sparePart: null
    };
  }

  const normalizedName = normalizeSparePartName(name);
  const normalizedSize = String(size || '').trim().toLowerCase();
  const useSizeFilter = Boolean(normalizedSize);
  const uniqueKey = useSizeFilter ? `${normalizedName}_${normalizedSize}` : normalizedName;

  const queryOptions = session ? { session } : {};
  const filter = { normalized_name: normalizedName };
  if (useSizeFilter) {
    filter.size = normalizedSize;
  }
  if (storeId) {
    filter.store_id = String(storeId).trim();
  }

  const duplicates = await SparePart.find(filter, null, queryOptions)
    .sort({ createdAt: 1, _id: 1 })
    .exec();

  if (duplicates.length === 0) {
    return {
      normalizedName,
      normalizedSize,
      uniqueKey,
      merged: false,
      mergedCount: 0,
      sparePart: null
    };
  }

  const keeper = duplicates[0];
  keeper.name = normalizedName;

  let mergedCount = 0;

  for (let i = 1; i < duplicates.length; i += 1) {
    const duplicate = duplicates[i];
    mergedCount += 1;

    keeper.quantity_available = Number(keeper.quantity_available || 0) + Number(duplicate.quantity_available || 0);
    keeper.minimum_required = Math.max(Number(keeper.minimum_required || 0), Number(duplicate.minimum_required || 0));
    keeper.warranty_expiry_date = keeper.warranty_expiry_date || duplicate.warranty_expiry_date || null;
    keeper.machine_ids = mergeMachineIds(keeper.machine_ids, duplicate.machine_ids);

    const fallbackMachineIds = mergeMachineIds(
      keeper.machine_ids,
      [keeper.machine_id, duplicate.machine_id]
    );

    if (fallbackMachineIds.length > 0) {
      keeper.machine_ids = fallbackMachineIds;
      keeper.machine_id = fallbackMachineIds[0];
    }

    if (Array.isArray(keeper.batches) || Array.isArray(duplicate.batches)) {
      keeper.batches = mergeBatchCollections(keeper.batches, duplicate.batches);
      keeper.quantity_available = Number((keeper.batches || []).reduce(
        (sum, batch) => sum + Number(batch?.quantity_available || 0),
        0
      ));
    }
  }

  await keeper.save(queryOptions);

  if (mergedCount > 0) {
    const duplicateIds = duplicates.slice(1).map((doc) => doc._id);
    await SparePart.deleteMany({ _id: { $in: duplicateIds } }, queryOptions).exec();
  }

  return {
    normalizedName,
    normalizedSize,
    uniqueKey,
    merged: mergedCount > 0,
    mergedCount,
    sparePart: keeper
  };
};

module.exports = {
  normalizeSparePartName,
  mergeMachineIds,
  mergeDuplicateSpareParts
};
