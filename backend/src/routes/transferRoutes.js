const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { requireDestructiveAuth, requireDbConnected } = require('../middlewares/securityGuards');

// POST /api/transfers - Create a new transfer
router.post('/', requireDbConnected, requireDestructiveAuth, transferController.createTransfer);

// GET /api/transfers - Get all transfers with optional filters
router.get('/', transferController.getTransfers);

// GET /api/transfers/stats - Get transfer statistics
router.get('/stats', transferController.getTransferStats);

// PATCH /api/transfers/:id/receive - Mark in-transit shipment as received
router.patch('/:id/receive', requireDbConnected, requireDestructiveAuth, transferController.markTransferReceived);
// PATCH /api/transfers/:id/mark-received - Mark incoming shipment as received
router.patch('/:id/mark-received', requireDbConnected, requireDestructiveAuth, transferController.markTransferReceived);
// PUT /api/transfers/:id/receive - Mark in-transit shipment as received
router.put('/:id/receive', requireDbConnected, requireDestructiveAuth, transferController.markTransferReceived);

// PATCH /api/transfers/:id/approve - Approve shipment and optionally mark as received
router.patch('/:id/approve', requireDbConnected, requireDestructiveAuth, transferController.approveTransfer);

// GET /api/transfers/:id - Get transfer by ID
router.get('/:id', transferController.getTransferById);

module.exports = router;
