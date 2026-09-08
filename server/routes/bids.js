const express = require('express');
const router = express.Router();
const bidController = require('../controllers/bidController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.get('/contractors', authenticate, bidController.listContractors);
router.post('/contractors', authenticate, bidController.createContractor);
router.put('/contractors/:id', authenticate, bidController.updateContractor);

router.get('/tender/:id', authenticate, bidController.listBids);
router.post('/tender/:id', authenticate, bidController.submitBid);
router.post('/tender/:id/evaluate/technical', authenticate, requirePermission('tender.evaluate'), bidController.evaluateTechnical);
router.post('/tender/:id/evaluate/financial', authenticate, requirePermission('tender.evaluate'), bidController.evaluateFinancial);
router.post('/tender/:id/l1', authenticate, requirePermission('tender.evaluate'), bidController.identifyL1);
router.post('/tender/:id/award', authenticate, requirePermission('tender.award'), bidController.awardTender);
router.post('/tender/:id/work-order', authenticate, requirePermission('tender.workOrder'), bidController.issueWorkOrder);
router.post('/tender/:id/agreement', authenticate, requirePermission('tender.agreement'), bidController.recordAgreement);

// T3: open a single stored bid (bid opening authority — TenderOfficer)
router.post('/:bidId/open', authenticate, requirePermission('bid.open'), bidController.openBid);

module.exports = router;
