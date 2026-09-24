const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, billingController.listBillings);
router.get('/preview-items', authenticate, billingController.previewItems);
router.post('/', authenticate, billingController.createBilling);
router.post('/prepare', authenticate, billingController.prepareBilling);
router.get('/:id', authenticate, billingController.getBilling);
router.put('/:id', authenticate, billingController.updateBilling);
router.delete('/:id', authenticate, billingController.deleteBilling);
router.post('/:id/documents', authenticate, billingController.addBillDocument);
router.delete('/:id/documents/:docId', authenticate, billingController.deleteBillDocument);
router.post('/:id/submit/request-otp', authenticate, billingController.requestSubmitOtp);
router.post('/:id/submit', authenticate, billingController.submitBilling);
router.post('/:id/check/request-otp', authenticate, billingController.requestCheckOtp);
router.post('/:id/check', authenticate, billingController.checkBilling);
router.post('/:id/return', authenticate, billingController.returnBilling);

module.exports = router;