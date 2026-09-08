const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, itemController.listItems);
router.get('/categories', authenticate, itemController.listCategories);
router.get('/units', authenticate, itemController.listUnits);
router.get('/:id', authenticate, itemController.getItem);
router.post('/', authenticate, requireRole('SoRAdmin'), itemController.createItem);
router.put('/:id', authenticate, requireRole('SoRAdmin'), itemController.updateItem);
router.get('/:id/rate-history', authenticate, itemController.getRateHistory);

module.exports = router;
