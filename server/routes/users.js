const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, userController.listUsers);
router.post('/', authenticate, userController.createUser);
router.put('/:id', authenticate, userController.updateUser);

module.exports = router;
