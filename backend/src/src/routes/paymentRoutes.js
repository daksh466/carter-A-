const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticateToken = require('../middlewares/auth');

// PUT /payment/:id
router.put('/:id', authenticateToken, paymentController.updatePayment);
// DELETE /payment/:id
router.delete('/:id', authenticateToken, paymentController.deletePayment);

module.exports = router;
