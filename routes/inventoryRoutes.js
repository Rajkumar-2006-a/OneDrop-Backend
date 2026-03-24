const express = require('express');
const router = express.Router();
const { getInventory, searchDonors, updateInventory } = require('../controllers/inventoryController');

router.get('/', getInventory);
router.get('/search', searchDonors);
router.put('/update', updateInventory);

module.exports = router;
