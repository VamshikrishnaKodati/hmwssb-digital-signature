import express from 'express';
import { verifySignature, getSignatureByEstimate, getSignatureHistory, revokeSignature } from '../controllers/signatureController.js';
import { authMiddleware, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { revokeSignatureSchema } from '../validations/schemas.js';

const router = express.Router();

router.get('/verify/:estimateId', authMiddleware, verifySignature);
router.get('/:estimateId', authMiddleware, getSignatureByEstimate);
router.get('/', authMiddleware, getSignatureHistory);
router.patch('/:estimateId/revoke', authMiddleware, authorize('admin', 'dgm', 'gm', 'ce'), validate(revokeSignatureSchema), revokeSignature);

export default router;
