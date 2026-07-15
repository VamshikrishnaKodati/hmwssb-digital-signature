import express from 'express';
import { generateEstimateAbstractPdf, serveEstimateAbstractPdf } from '../controllers/pdfController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { generatePdfSchema } from '../validations/schemas.js';

const router = express.Router();

router.post('/generate', authMiddleware, validate(generatePdfSchema), generateEstimateAbstractPdf);
router.get('/:estimateId', authMiddleware, serveEstimateAbstractPdf);

export default router;
