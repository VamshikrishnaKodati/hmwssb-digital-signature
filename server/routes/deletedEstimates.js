const express = require('express');
const router = express.Router();
const controller = require('../controllers/deletedEstimateController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, controller.listDeletedEstimates);
router.get('/:id', authenticate, controller.getDeletedEstimate);
router.post('/:id/restore/request-otp', authenticate, controller.requestRestoreOtp);
router.post('/:id/restore', authenticate, controller.verifyRestore);

module.exports = router;
