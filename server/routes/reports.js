const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

router.get('/estimate-register', authenticate, reportController.estimateRegister);
router.get('/pending', authenticate, reportController.pendingEstimates);
router.get('/approved', authenticate, reportController.approvedEstimates);
router.get('/tender', authenticate, reportController.tenderReport);
router.get('/agency', authenticate, reportController.agencyReport);
router.get('/work-progress', authenticate, reportController.workProgressReport);
router.get('/billing', authenticate, reportController.billingReport);
router.get('/estimate-movement', authenticate, reportController.estimateMovementReport);

module.exports = router;
