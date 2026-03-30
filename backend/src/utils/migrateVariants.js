const SparePart = require('../models/SparePart');
const mongoose = require('mongoose');

/**
 * Migration script for variant-based spare parts
 * 1. Add missing size='standard' to legacy docs
 * 2. Compute unique_key for all
 * 3. Merge true duplicates by unique_key
 * 4. Log results
 */
const migrateVariants = async (req, res) => {
  try {
    if (!SparePart) {
      return res.status(500).json({ success: false, message: 'SparePart model unavailable' });
    }

    // Phase 1: Update legacy docs missing size
    const legacyCount = await SparePart.countDocuments({ size: { $exists: false } });
    console.log(`Found ${legacyCount} legacy docs missing size`);
    
    await SparePart.updateMany(
      { size: { $exists: false } },
      { $set: { size: 'standard', type: '', unit: 'pcs' } }
    );

    // Phase 2: Trigger unique_key regeneration via save()
    const allParts = await SparePart.find({}).lean();
    let regenerated = 0;
    for (const part of allParts) {
      if (!part.unique_key || part.unique_key.includes('undefined')) {
        const doc = await SparePart.findById(part._id);
        await doc.save();
        regenerated++;
      }
    }
    console.log(`Regenerated unique_key for ${regenerated} docs`);

    // Phase 3: Merge any remaining unique_key duplicate groups
    const dupPipeline = [
      { $group: { _id: '$unique_key', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ];
    const dupGroups = await SparePart.aggregate(dupPipeline);
    let mergedCount = 0;

    for (const group of dupGroups) {
      const parts = await SparePart.find({ _id: { $in: group.ids } }).sort({ createdAt: 1 });
      if (parts.length > 1) {
        const keeper = parts[0];
        let totalQty = Number(keeper.quantity_available || 0);
        for (let i = 1; i < parts.length; i++) {
          totalQty += Number(parts[i].quantity_available || 0);
          mergedCount++;
          await SparePart.findByIdAndDelete(parts[i]._id);
        }
        keeper.quantity_available = totalQty;
        await keeper.save();
        console.log(`Merged ${group.count} docs for unique_key: ${group._id}`);
      }
    }

    const finalCount = await SparePart.countDocuments();
    res.json({
      success: true,
      data: {
        legacyUpdated: legacyCount,
        keysRegenerated: regenerated,
        duplicatesMerged: mergedCount,
        totalVariants: finalCount,
        message: `Migration complete: ${legacyCount} legacy → ${finalCount} variants`
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { migrateVariants };

