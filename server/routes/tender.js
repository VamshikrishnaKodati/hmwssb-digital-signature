const express = require('express');
const router = express.Router();
const tenderController = require('../controllers/tenderController');
const bidController = require('../controllers/bidController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.get('/', authenticate, requirePermission('tender.view'), tenderController.listTenders);
router.get('/ready', authenticate, requirePermission('tender.view'), tenderController.getReadyList);
router.get('/config', authenticate, requirePermission('tender.view'), tenderController.getConfig);
router.get('/:id', authenticate, requirePermission('tender.view'), tenderController.getTender);
router.post('/', authenticate, requirePermission('tender.create'), tenderController.createTender);
router.put('/:id', authenticate, requirePermission('tender.update'), tenderController.updateTender);
router.delete('/:id', authenticate, requirePermission('tender.update'), tenderController.deleteTender);
router.get('/:id/boq', authenticate, tenderController.getBOQ);
router.get('/:id/nit', authenticate, tenderController.generateNIT);
router.get('/:id/preview', authenticate, tenderController.getTenderPreview);
router.get('/:id/documents', authenticate, tenderController.getTenderDocuments);
router.post('/:id/documents', authenticate, tenderController.addTenderDocument);
router.delete('/:id/documents/:docId', authenticate, tenderController.deleteTenderDocument);
router.get('/:id/versions', authenticate, tenderController.getTenderVersions);

// T3: publication gate + bid submission window control (TenderOfficer)
router.post('/:id/publish', authenticate, requirePermission('tender.publish'), tenderController.publishTender);
router.post('/:id/close', authenticate, requirePermission('tender.publish'), tenderController.closeTender);

// T3: bid opening (TenderOfficer — bid.open, canonical ownership)
router.get('/:id/bid-opening', authenticate, requirePermission('bid.view'), bidController.getBidOpening);
router.post('/:id/bid-opening/start', authenticate, requirePermission('bid.open'), bidController.startBidOpening);
router.post('/:id/bid-opening/complete', authenticate, requirePermission('bid.open'), bidController.completeBidOpening);

module.exports = router;