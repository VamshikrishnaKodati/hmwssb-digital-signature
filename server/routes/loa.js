const express = require('express');
const router = express.Router();
const loaController = require('../controllers/loaController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// View the LOA + drive the official document print (tender.view — same gate as NIT).
router.get('/tender/:id', authenticate, requirePermission('tender.view'), loaController.getLoaByTender);
router.post('/tender/:id/print', authenticate, requirePermission('tender.view'), loaController.markPrinted);

// Generation is a Director action, reusing the existing Director Work-Order
// permission (no RBAC change). The handler re-checks designation + WorkAwarded.
router.post('/tender/:id/generate', authenticate, requirePermission('tender.workOrder'), loaController.generateLoa);

module.exports = router;