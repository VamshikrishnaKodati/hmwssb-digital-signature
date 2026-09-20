const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const roleController = require('../controllers/rolePermissionController');

router.use(authenticate, requireRole('SoRAdmin'));

router.get('/', roleController.listRoles);
router.get('/audit', roleController.getAuditLog);
router.get('/:roleId/permissions', roleController.getRolePermissions);
router.put('/:roleId/permissions', roleController.updateRolePermissions);

module.exports = router;