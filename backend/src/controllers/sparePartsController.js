const SparePart = require('../models/SparePart');
const { normalizeSparePartName, mergeDuplicateSpareParts } = require('../utils/sparePartDedup');

const toSparePartResponse = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  size: doc.size || '',
  type: doc.type || '',
  unit: doc.unit || 'pcs',
  unique_key: doc.unique_key || '',
  machine_id: doc.machine_id,
  machineId: doc.machine_id,
  store_id: doc.store_id,
  storeId: doc.store_id,
  quantity_available: doc.quantity_available,
  quantity: doc.quantity_available,
  minimum_required: doc.minimum_required,
  minimumRequired: doc.minimum_required,
  warranty_expiry_date: doc.warranty_expiry_date,
  warrantyExpiryDate: doc.warranty_expiry_date,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

exports.getSpareParts = async (req, res) => {
  try {
    const { storeId, store_id, machineId, machine_id, page = '1', limit = '50' } = req.query;
    const filter = { is_deleted: { $ne: true } };
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    if (store_id || storeId) {
      filter.store_id = store_id || storeId;
    }
    if (machine_id || machineId) {
      filter.machine_id = machine_id || machineId;
    }

    const [spareParts, total] = await Promise.all([
      SparePart.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      SparePart.countDocuments(filter)
    ]);
    const result = spareParts.map(toSparePartResponse);

    return res.status(200).json({
      success: true,
      data: { 
        spareParts: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
          skip
        }
      },
      message: `Successfully retrieved ${result.length} of ${total} spare parts`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving spare parts',
      error: error.message
    });
  }
};

exports.createSparePart = async (req, res) => {
  try {
    console.log('Incoming data (sparePart):', req.body);
    const {
      name,
      size,
      type,
      unit,
      machine_id,
      store_id,
      quantity_available,
      minimum_required,
      warranty_expiry_date
    } = req.body;

    const errors = [];
    if (!name || name.trim() === '') errors.push('Part name is required');
    if (!size || size.trim() === '') errors.push('Part size is required (e.g. 10mm)');
    if (!machine_id || machine_id.trim() === '') errors.push('Machine ID is required');
    if (!store_id || store_id.trim() === '') errors.push('Store ID is required');
    if (quantity_available === undefined || quantity_available === null) errors.push('Quantity available is required');
    if (minimum_required === undefined || minimum_required === null) errors.push('Minimum required is required');
    if (type && type.trim() === '') errors.push('Type cannot be empty if provided');
    if (unit && !['pcs', 'kg', 'm', 'l'].includes(unit.trim().toLowerCase())) {
      errors.push('Unit must be pcs/kg/m/l');
    }

    if (quantity_available !== undefined && (isNaN(quantity_available) || Number(quantity_available) < 0)) {
      errors.push('Quantity available must be a non-negative number');
    }
    if (minimum_required !== undefined && (isNaN(minimum_required) || Number(minimum_required) < 0)) {
      errors.push('Minimum required must be a non-negative number');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const normalizedName = name.trim().toLowerCase();
    const normalizedSize = size.trim().toLowerCase();
    const normalizedMachineId = machine_id.trim();
    const normalizedStoreId = store_id.trim();
    const normalizedType = type ? type.trim().toLowerCase() : '';
    const normalizedUnit = unit ? unit.trim().toLowerCase() : 'pcs';
    const quantityToAdd = Number(quantity_available);

    // Check by unique_key first (variant identity)
    const uniqueKey = `${normalizedName}_${normalizedSize}_${normalizedMachineId}`.replace(/\s+/g, '_');
    let existingByVariant = await SparePart.findOne({ unique_key: uniqueKey });

    if (existingByVariant) {
      if (existingByVariant.is_deleted) {
        existingByVariant.is_deleted = false;
        existingByVariant.deleted_at = null;
        existingByVariant.deleted_by = '';
      }
      // Global variant merge (cross-store OK for same variant)
      existingByVariant.quantity_available = Number(existingByVariant.quantity_available || 0) + quantityToAdd;
      existingByVariant.minimum_required = Math.max(
        Number(existingByVariant.minimum_required || 0),
        Number(minimum_required)
      );
      if (warranty_expiry_date) {
        existingByVariant.warranty_expiry_date = warranty_expiry_date;
      }
      // Update store_id if different (allow multi-store same variant)
      if (normalizedStoreId !== String(existingByVariant.store_id)) {
        existingByVariant.store_id = normalizedStoreId;
      }
      const updatedPart = await existingByVariant.save();
      console.log(`Variant merged: ${uniqueKey}`);

      return res.status(200).json({
        success: true,
        data: { sparePart: toSparePartResponse(updatedPart) },
        message: `Variant '${uniqueKey}' exists. Quantity merged across stores.`
      });
    }

    // Create new variant
    const newPart = new SparePart({
      name: normalizedName,
      size: normalizedSize,
      type: normalizedType,
      unit: normalizedUnit,
      machine_id: normalizedMachineId,
      store_id: normalizedStoreId,
      quantity_available: quantityToAdd,
      minimum_required: Number(minimum_required),
      warranty_expiry_date: warranty_expiry_date || null
    });

    const savedPart = await newPart.save();
    console.log('New variant created:', { unique_key: savedPart.unique_key });

    return res.status(201).json({
      success: true,
      data: { sparePart: toSparePartResponse(savedPart) },
      message: `New variant '${savedPart.unique_key}' created successfully`
    });
  } catch (error) {
    console.error('Create spare part error:', error);
    if (error?.code === 11000 && error?.keyPattern?.unique_key) {
      return res.status(409).json({
        success: false,
        message: 'Variant already exists (unique_key conflict)',
        error: `Unique key '${error.keyValue?.unique_key}' already exists`,
        code: 'VARIANT_EXISTS'
      });
    }
    if (error?.code === 11000) {
      // Fallback legacy merge
      try {
        const normalizedName = String(req.body?.name || '').trim().toLowerCase();
        const normalizedStoreId = String(req.body?.store_id || '').trim();
        const quantityToAdd = Number(req.body?.quantity_available || 0);
        const existing = await SparePart.findOne({ normalized_name: normalizedName, store_id: normalizedStoreId });
        if (existing) {
          existing.quantity_available += quantityToAdd;
          const updated = await existing.save();
          return res.status(200).json({
            success: true,
            data: { sparePart: toSparePartResponse(updated) },
            message: `Legacy merge successful: '${updated.name}'`
          });
        }
      } catch (fallbackErr) {
        console.error('Fallback merge failed:', fallbackErr);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Error creating spare part variant',
      error: error.message
    });
  }
};

exports.mergeDuplicateSpareParts = async (req, res) => {
  try {
    const { name, store_id, storeId } = req.body || {};
    const scopedStoreId = String(store_id || storeId || '').trim();

    if (name && String(name).trim()) {
      const result = await mergeDuplicateSpareParts({
        SparePart,
        name,
        storeId: scopedStoreId || null
      });

      return res.status(200).json({
        success: true,
        data: {
          mergedGroups: result.merged ? 1 : 0,
          mergedRows: result.mergedCount,
          sparePart: result.sparePart ? toSparePartResponse(result.sparePart) : null
        },
        message: result.merged
          ? `Merged ${result.mergedCount} duplicate row(s) for '${result.normalizedName}'`
          : `No duplicates found for '${result.normalizedName}'`
      });
    }

    const pipeline = [
      {
        $group: {
          _id: {
            normalized_name: '$normalized_name',
            store_id: '$store_id'
          },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ];

    if (scopedStoreId) {
      pipeline.unshift({ $match: { store_id: scopedStoreId } });
    }

    const duplicateGroups = await SparePart.aggregate(pipeline);
    let mergedGroups = 0;
    let mergedRows = 0;

    for (const group of duplicateGroups) {
      const result = await mergeDuplicateSpareParts({
        SparePart,
        name: group._id.normalized_name,
        storeId: group._id.store_id
      });
      if (result.merged) {
        mergedGroups += 1;
        mergedRows += result.mergedCount;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        scannedGroups: duplicateGroups.length,
        mergedGroups,
        mergedRows
      },
      message: mergedGroups > 0
        ? `Merged ${mergedRows} duplicate row(s) across ${mergedGroups} item group(s)`
        : 'No duplicate spare-part rows found'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error merging duplicate spare parts',
      error: error.message
    });
  }
};

exports.deleteSparePart = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Spare part ID is required'
      });
    }

    const sparePart = await SparePart.findByIdAndUpdate(
      id,
      {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: String(req.user?.id || req.user?.sub || 'unknown')
      },
      { new: true }
    );
    
    if (!sparePart) {
      return res.status(404).json({
        success: false,
        message: 'Spare part not found'
      });
    }

    console.log('Spare part soft deleted', {
      at: new Date().toISOString(),
      spareId: id,
      by: String(req.user?.id || req.user?.sub || 'unknown')
    });

    return res.status(200).json({
      success: true,
      message: `Spare part '${sparePart.name}' deleted successfully`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting spare part',
      error: error.message
    });
  }
};
