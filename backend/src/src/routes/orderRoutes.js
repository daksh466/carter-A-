const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticateToken = require('../middlewares/auth');


router.post('/', authenticateToken, orderController.createOrder);
router.get('/', authenticateToken, orderController.listOrders);
// Delete order
router.delete('/:id', authenticateToken, orderController.deleteOrder);

module.exports = router;
