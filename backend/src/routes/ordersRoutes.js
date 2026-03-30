const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

// GET /api/orders - Fetch all orders (with filtering, searching, sorting)
router.get('/', ordersController.getOrders);

// POST /api/orders - Create a new order
router.post('/', ordersController.createOrder);

// GET /api/orders/:id - Fetch single order by ID
router.get('/:id', ordersController.getOrderById);

module.exports = router;
