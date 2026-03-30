const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// GET /api/alerts
router.get('/', alertController.getAlerts);

module.exports = router;
