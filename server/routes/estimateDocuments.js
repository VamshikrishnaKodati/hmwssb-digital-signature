const express = require('express');
const router = express.Router();
const docController = require('../controllers/estimateDocumentController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/', authenticate, docController.list);
router.post('/upload', authenticate, requireRole('Manager'), docController.upload);
router.post('/assign', authenticate, requireRole('Manager'), docController.assign);
router.get('/:docId/file', authenticate, docController.file);
router.delete('/:docId', authenticate, requireRole('Manager'), docController.remove);

module.exports = router;