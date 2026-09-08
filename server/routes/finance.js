const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, financeController.listFinance);
router.get('/queue', authenticate, financeController.getFinanceQueue);
router.get('/awaiting-inward', authenticate, financeController.listAwaitingInward);
router.post('/inward', authenticate, financeController.createInward);
router.post('/:id/verify', authenticate, financeController.verifyFinance);
router.post('/:id/recommend', authenticate, financeController.recommendFinance);
router.post('/:id/approve', authenticate, financeController.approveFinance);
router.post('/:id/cheque', authenticate, financeController.issueCheque);

module.exports = router;
