import express from 'express';
import { getRegions, getZones, getCirclesByZone, getWardsByCircle } from '../controllers/hierarchyController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/regions', authMiddleware, getRegions);
router.get('/zones', authMiddleware, getZones);
router.get('/zones/:zoneId/circles', authMiddleware, getCirclesByZone);
router.get('/circles/:circleId/wards', authMiddleware, getWardsByCircle);

export default router;
