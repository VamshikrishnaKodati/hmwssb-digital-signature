const express = require('express');
const router = express.Router();
const estimateController = require('../controllers/estimateController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/', authenticate, estimateController.listEstimates);
router.get('/my', authenticate, estimateController.getMyEstimates);
router.post('/', authenticate, requireRole('Manager'), estimateController.createEstimate);
router.get('/:id', authenticate, estimateController.getEstimate);
router.put('/:id', authenticate, requireRole('Manager'), estimateController.updateEstimate);
router.put('/recalculate/:detailId', authenticate, requireRole('Manager'), estimateController.recalculateItem);
router.get('/:id/versions', authenticate, estimateController.getVersions);

module.exports = router;
