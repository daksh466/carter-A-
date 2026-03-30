const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const authenticateToken = require('../middlewares/auth');

// PUT /service/:id
router.put('/:id', authenticateToken, serviceController.updateService);
// DELETE /service/:id
router.delete('/:id', authenticateToken, serviceController.deleteService);

module.exports = router;
