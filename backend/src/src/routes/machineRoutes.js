const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const authenticateToken = require('../middlewares/auth');

// PUT /machine/:id
router.put('/:id', authenticateToken, machineController.updateMachine);
// DELETE /machine/:id
router.delete('/:id', authenticateToken, machineController.deleteMachine);

module.exports = router;
