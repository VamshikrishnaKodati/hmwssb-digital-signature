const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agencyController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, agencyController.listAgencies);
router.post('/', authenticate, agencyController.createAgency);
router.put('/:id', authenticate, agencyController.updateAgency);
router.delete('/:id', authenticate, agencyController.deleteAgency);

module.exports = router;
