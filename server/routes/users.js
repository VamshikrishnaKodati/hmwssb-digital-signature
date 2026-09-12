const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, userController.listUsers);
router.post('/', authenticate, userController.createUser);
router.put('/:id', authenticate, userController.updateUser);
router.put('/:id/status', authenticate, userController.setUserStatus);
router.post('/:id/scope', authenticate, userController.assignScope);
router.put('/:id/scope', authenticate, userController.updateScope);
router.delete('/:id/scope', authenticate, userController.removeScope);
router.get('/:id/audit', authenticate, userController.getScopeAudit);
router.get('/me/scope', authenticate, userController.getMyScope);
router.get('/admin/assignments', authenticate, userController.getAssignments);

module.exports = router;