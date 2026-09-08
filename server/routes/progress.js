const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, progressController.listProgress);
router.post('/', authenticate, progressController.createProgress);
router.put('/:id', authenticate, progressController.updateProgress);
router.delete('/:id', authenticate, progressController.deleteProgress);

module.exports = router;
