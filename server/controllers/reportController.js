import Estimate from '../models/Estimate.js';
import AuditLog from '../models/AuditLog.js';
import { success, paginated } from '../utils/apiResponse.js';
import { buildReportFilter } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

export const getReportFilters = async (req, res, next) => {
  try {
    const [regions, zones, divisions, statuses] = await Promise.all([
      Estimate.distinct('region'),
      Estimate.distinct('zone'),
      Estimate.distinct('division'),
      Estimate.distinct('status'),
    ]);
    return success(res, { data: { filters: { regions, zones, divisions, statuses } } });
  } catch (err) {
    next(err);
  }
};

export const getReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, ...filterParams } = req.query;
    const filter = buildReportFilter(filterParams);

    const estimates = await Estimate.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await Estimate.countDocuments(filter);

    const summary = {
      totalEstimates: total,
      totalSubtotal: estimates.reduce((s, e) => s + Number(e.subtotal || 0), 0),
      totalGrandTotal: estimates.reduce((s, e) => s + Number(e.grandTotal || 0), 0),
      byStatus: estimates.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {}),
    };

    return paginated(res, { data: { estimates, summary }, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const exportCsv = async (req, res, next) => {
  try {
    const filter = buildReportFilter(req.query);

    const estimates = await Estimate.find(filter).sort({ createdAt: -1 }).lean();

    const header = 'Estimate ID,Name of Work,Region,Zone,Division,Circle,Ward,Status,Subtotal,GST Amount,LS Amount,Grand Total,Created At\n';
    const rows = estimates.map((e) =>
      [
        `"${e.estimateId || ''}"`,
        `"${(e.nameOfWork || '').replace(/"/g, '""')}"`,
        `"${e.region || ''}"`,
        `"${e.zone || ''}"`,
        `"${e.division || ''}"`,
        `"${e.circle || ''}"`,
        `"${e.ward || ''}"`,
        `"${e.status || ''}"`,
        e.subtotal || 0,
        e.gstAmount || 0,
        e.lsAmount || 0,
        e.grandTotal || 0,
        `"${e.createdAt ? new Date(e.createdAt).toISOString() : ''}"`,
      ].join(',')
    ).join('\n');

    const csv = header + rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=estimates_report.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const { entity, entityId, action, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (entity) filter.entity = entity;
    if (entityId) filter.entityId = entityId;
    if (action) filter.action = action;

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await AuditLog.countDocuments(filter);

    return paginated(res, { data: logs, total, page, limit });
  } catch (err) {
    next(err);
  }
};
