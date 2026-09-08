const express = require('express');
const router = express.Router();
const lookupController = require('../controllers/lookupController');
const { authenticate } = require('../middleware/auth');

router.get('/regions', authenticate, lookupController.getRegions);
router.get('/zones', authenticate, lookupController.getZones);
router.get('/divisions', authenticate, lookupController.getDivisions);
router.get('/circles', authenticate, lookupController.getCircles);
router.get('/wards', authenticate, lookupController.getWards);
router.get('/wards/search', authenticate, lookupController.searchWards);
router.get('/users', authenticate, lookupController.getUsersByDesignation);

module.exports = router;
