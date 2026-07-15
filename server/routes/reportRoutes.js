import express from 'express';
import { getReportFilters, getReports, exportCsv, getAuditLogs } from '../controllers/reportController.js';
import { authMiddleware, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/filters', authMiddleware, getReportFilters);
router.get('/', authMiddleware, getReports);
router.get('/export/csv', authMiddleware, exportCsv);
router.get('/audit-logs', authMiddleware, authorize('admin'), getAuditLogs);

export default router;
