const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authenticateToken = require('../middlewares/auth');

router.post('/update', authenticateToken, inventoryController.updateStock);
router.get('/', authenticateToken, inventoryController.listInventory);

// POST /inventory (admin only)
router.post('/', authenticateToken, inventoryController.addInventory);

// POST /inventory/:id/consume
router.post('/:id/consume', authenticateToken, inventoryController.consumeInventory);

// GET /inventory/prediction
router.get('/prediction', authenticateToken, inventoryController.predictInventory);

// GET /inventory/alerts
router.get('/alerts', authenticateToken, inventoryController.inventoryAlerts);

module.exports = router;
