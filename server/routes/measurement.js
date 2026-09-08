const express = require('express');
const router = express.Router();
const measurementController = require('../controllers/measurementController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, measurementController.listMeasurements);
router.post('/', authenticate, measurementController.createMeasurement);
router.put('/:id', authenticate, measurementController.updateMeasurement);
router.post('/:id/verify', authenticate, measurementController.verifyMeasurement);
router.delete('/:id', authenticate, measurementController.deleteMeasurement);

module.exports = router;
