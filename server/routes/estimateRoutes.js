import express from 'express';
import {
  createEstimate, getEstimates, getEstimateById, updateEstimate,
  deleteEstimate, updateEstimateStatus, getEstimateMovements,
  createEstimateVersion, getEstimatesByStatus,
} from '../controllers/estimateController.js';
import { authMiddleware, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createEstimateSchema, updateEstimateSchema, updateStatusSchema, createVersionSchema } from '../validations/schemas.js';

const router = express.Router();

router.post('/', authMiddleware, authorize('admin', 'manager', 'engineer'), validate(createEstimateSchema), createEstimate);
router.get('/', authMiddleware, getEstimates);
router.get('/status/:status', authMiddleware, getEstimatesByStatus);
router.get('/:id', authMiddleware, getEstimateById);
router.patch('/:id', authMiddleware, authorize('admin', 'manager', 'engineer'), validate(updateEstimateSchema), updateEstimate);
router.patch('/:id/status', authMiddleware, authorize('admin', 'manager', 'dgm', 'gm', 'ce', 'accounts', 'tender'), validate(updateStatusSchema), updateEstimateStatus);
router.get('/:id/movements', authMiddleware, getEstimateMovements);
router.post('/:id/versions', authMiddleware, authorize('admin', 'manager', 'engineer'), validate(createVersionSchema), createEstimateVersion);
router.delete('/:id', authMiddleware, authorize('admin', 'manager', 'engineer'), deleteEstimate);

export default router;
