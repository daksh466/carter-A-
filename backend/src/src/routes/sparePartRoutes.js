const express = require('express');
const router = express.Router();
const sparePartController = require('../controllers/sparePartController');
const authenticateToken = require('../middlewares/auth');

// PUT /spareparts/:id
router.put('/:id', authenticateToken, sparePartController.updateSparePart);
// DELETE /spareparts/:id
router.delete('/:id', authenticateToken, sparePartController.deleteSparePart);

module.exports = router;
