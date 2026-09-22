const express = require('express');
const router = express.Router();
const photoController = require('../controllers/progressPhotoController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, photoController.list);
router.post('/upload', authenticate, photoController.upload);
router.get('/:photoId/file', authenticate, photoController.file);
router.delete('/:photoId', authenticate, photoController.remove);

module.exports = router;