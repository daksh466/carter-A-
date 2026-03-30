const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { requireDestructiveAuth, requireDbConnected } = require('../middlewares/securityGuards');



// GET all stores
router.get('/', storeController.getStores);
// GET store by id
router.get('/:id', storeController.getStoreById);
// POST create store
router.post('/', requireDbConnected, requireDestructiveAuth, storeController.addStore);
// PUT update store
router.put('/:id', requireDbConnected, requireDestructiveAuth, storeController.updateStore);
// DELETE store
router.delete('/:id', requireDbConnected, requireDestructiveAuth, storeController.deleteStore);

module.exports = router;
