const express = require('express');
const router = express.Router();
const { getMapLocation } = require('../controllers/mapController');

// Public (no login needed): GET /api/map/location
router.get('/location', getMapLocation);

module.exports = router;