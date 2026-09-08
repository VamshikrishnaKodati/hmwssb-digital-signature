const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticate } = require('../middleware/auth');

router.get('/:id/pdf', authenticate, exportController.exportCompletePDF);
router.get('/:id/excel', authenticate, exportController.exportCompleteWorkbook);

module.exports = router;
