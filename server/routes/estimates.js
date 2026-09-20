const express = require('express');
const router = express.Router();
const estimateController = require('../controllers/estimateController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.get('/', authenticate, estimateController.listEstimates);
router.get('/my', authenticate, estimateController.getMyEstimates);
router.post('/', authenticate, requirePermission('estimate.create'), estimateController.createEstimate);
router.get('/:id', authenticate, estimateController.getEstimate);
router.put('/:id', authenticate, requirePermission('estimate.edit'), estimateController.updateEstimate);
router.put('/recalculate/:detailId', authenticate, requirePermission('estimate.edit'), estimateController.recalculateItem);
router.get('/:id/versions', authenticate, estimateController.getVersions);

module.exports = router;
