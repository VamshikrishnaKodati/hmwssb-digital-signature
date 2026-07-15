import Estimate from '../models/Estimate.js';
import EstimateItem from '../models/EstimateItem.js';
import Abstract from '../models/Abstract.js';
import AuditLog from '../models/AuditLog.js';
import { generateAbstractPdf } from '../services/pdfService.js';
import { promises as fs } from 'fs';
import { success, created, notFound, badRequest } from '../utils/apiResponse.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

export const generateEstimateAbstractPdf = async (req, res, next) => {
  try {
    const { estimateId, estimate: estimatePayload, items: payloadItems } = req.body;
    let estimate = estimatePayload;
    let items = payloadItems;

    if (!estimate && !estimateId) {
      return badRequest(res, 'estimateId or estimate payload is required');
    }

    if (estimateId && !estimate) {
      estimate = await Estimate.findOne({ estimateId }).lean();
      if (!estimate) return notFound(res, 'Estimate not found');
      items = await EstimateItem.find({ estimateId }).lean();
    }

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest(res, 'Estimate items are required to generate PDF');
    }

    const pdfPath = await generateAbstractPdf(estimate, items);

    const fileBuffer = await fs.readFile(pdfPath);
    if (fileBuffer.length < 50) {
      return badRequest(res, 'Generated PDF is empty or corrupted');
    }

    await Abstract.create({
      estimateId: estimate.estimateId || estimateId,
      pdfPath,
      generatedBy: req.user?.id,
      generatedByName: req.user?.name,
      metadata: { estimate, itemCount: items.length },
    });

    await AuditLog.create({
      userId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role,
      action: 'ABSTRACT_GENERATED',
      entity: 'Estimate',
      entityId: estimate.estimateId || estimateId,
      module: 'PDF',
      description: `Abstract PDF generated for estimate ${estimate.estimateId || estimateId}`,
      details: { itemCount: items.length },
    });

    const fileName = `${sanitizeFilename(estimate.estimateId || estimateId)}_abstract.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': fileBuffer.length,
    });
    return res.send(fileBuffer);
  } catch (error) {
    logger.error('PDF', 'Generation error', { error: error.message });
    if (!res.headersSent) {
      return next(error);
    }
  }
};

export const serveEstimateAbstractPdf = async (req, res, next) => {
  try {
    const { estimateId } = req.params;
    const estimate = await Estimate.findOne({ estimateId }).lean();
    if (!estimate) return notFound(res, 'Estimate not found');
    const items = await EstimateItem.find({ estimateId }).lean();
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest(res, 'Estimate items are required to generate PDF');
    }

    const pdfPath = await generateAbstractPdf(estimate, items);
    const fileBuffer = await fs.readFile(pdfPath);
    if (fileBuffer.length < 50) {
      return badRequest(res, 'Generated PDF is empty or corrupted');
    }

    const fileName = `${sanitizeFilename(estimateId)}_abstract.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': fileBuffer.length,
    });
    return res.send(fileBuffer);
  } catch (error) {
    logger.error('PDF', 'Serve error', { error: error.message });
    if (!res.headersSent) {
      return next(error);
    }
  }
};
