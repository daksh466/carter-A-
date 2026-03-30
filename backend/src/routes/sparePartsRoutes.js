const express = require('express');
const router = express.Router();
const sparePartsController = require('../controllers/sparePartsController');
const { requireDestructiveAuth, requireDbConnected } = require('../middlewares/securityGuards');

// GET /api/spares - Fetch all spare parts (optionally filtered by storeId or machineId)
router.get('/', sparePartsController.getSpareParts);

// POST /api/spares - Create a new spare part
router.post('/', requireDbConnected, requireDestructiveAuth, sparePartsController.createSparePart);

// POST /api/spares/merge-duplicates - Merge duplicate spare parts by normalized item name
router.post('/merge-duplicates', requireDbConnected, requireDestructiveAuth, sparePartsController.mergeDuplicateSpareParts);

// DELETE /api/spares/:id - Delete a spare part by ID
router.delete('/:id', requireDbConnected, requireDestructiveAuth, sparePartsController.deleteSparePart);

module.exports = router;
