const express = require('express');
const router = express.Router();
const connectionController = require('../controllers/connectionController');
const authenticateToken = require('../middlewares/auth');

router.post('/', authenticateToken, connectionController.createConnection);
router.get('/', authenticateToken, connectionController.listConnections);
router.get('/:id/details', authenticateToken, connectionController.getCustomerDetails);

module.exports = router;
