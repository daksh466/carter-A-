const express = require('express');
const router = express.Router();
const storeOrdersController = require('../controllers/storeOrdersController');
const { requireDestructiveAuth, requireDbConnected } = require('../middlewares/securityGuards');

// GET /api/orders
router.get('/', storeOrdersController.getOrders);

// POST /api/orders
router.post('/', requireDbConnected, requireDestructiveAuth, storeOrdersController.createOrder);

// PATCH /api/orders/:id/confirm-receive
router.patch('/:id/confirm-receive', requireDbConnected, requireDestructiveAuth, storeOrdersController.confirmReceive);

// PATCH /api/orders/:id/confirm-dispatch
router.patch('/:id/confirm-dispatch', requireDbConnected, requireDestructiveAuth, storeOrdersController.confirmDispatch);

module.exports = router;
