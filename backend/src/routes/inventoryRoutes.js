const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: [], message: 'Inventory data fetched successfully' });
});

router.get('/alerts', (req, res) => {
  res.json({ success: true, data: [], message: 'No inventory alerts at this time' });
});

module.exports = router;
