import express from 'express';
import { getReportFilters, getReports, exportCsv, exportExcel, getAuditLogs, getDashboardStats } from '../controllers/reportController.js';
import { authMiddleware, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { reportFilterSchema } from '../validations/schemas.js';

const router = express.Router();

router.get('/filters', authMiddleware, getReportFilters);
router.get('/dashboard-stats', authMiddleware, getDashboardStats);
router.get('/', authMiddleware, validate(reportFilterSchema, 'query'), getReports);
router.get('/export/csv', authMiddleware, validate(reportFilterSchema, 'query'), exportCsv);
router.get('/export/excel', authMiddleware, validate(reportFilterSchema, 'query'), exportExcel);
router.get('/audit-logs', authMiddleware, authorize('admin'), getAuditLogs);

export default router;
