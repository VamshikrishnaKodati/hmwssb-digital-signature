import mongoose from 'mongoose';
import Estimate from '../models/Estimate.js';
import EstimateItem from '../models/EstimateItem.js';
import EstimateMovement from '../models/EstimateMovement.js';
import EstimateVersion from '../models/EstimateVersion.js';
import AuditLog from '../models/AuditLog.js';
import { success, created, notFound, badRequest, forbidden, conflict, paginated } from '../utils/apiResponse.js';
import { escapeRegex } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

const WORKFLOW_TRANSITIONS = {
  'Draft': ['Abstract Generated', 'Submitted'],
  'Abstract Generated': ['Submitted'],
  'Submitted': ['DGM Review', 'Reverted'],
  'DGM Review': ['GM Review', 'Reverted', 'Digitally Signed'],
  'GM Review': ['OTP Pending', 'Reverted', 'Digitally Signed'],
  'Reverted': ['Submitted'],
  'OTP Pending': ['Digitally Signed'],
  'Digitally Signed': ['Completed'],
  'Completed': [],
};

const ROLE_TRANSITIONS = {
  admin: ['Abstract Generated', 'Submitted', 'DGM Review', 'GM Review', 'OTP Pending', 'Reverted', 'Digitally Signed', 'Completed'],
  manager: ['Abstract Generated', 'Submitted'],
  engineer: ['Abstract Generated', 'Submitted'],
  dgm: ['DGM Review', 'GM Review', 'Reverted', 'Digitally Signed'],
  gm: ['OTP Pending', 'Reverted', 'Digitally Signed'],
  ce: ['DGM Review', 'GM Review', 'OTP Pending', 'Reverted', 'Digitally Signed'],
  accounts: [],
  tender: [],
  viewer: [],
};

const calculateTotals = (items, lsAmount = 0) => {
  let materialCost = 0;
  let civilCost = 0;
  let gstTotal = 0;

  for (const item of items) {
    const amount = Number(item.amount || 0);
    const category = (item.category || '').toLowerCase();
    if (category === 'civil') civilCost += amount;
    else materialCost += amount;
    gstTotal += amount * (Number(item.gst || 0) / 100);
  }

  const subtotal = materialCost + civilCost;
  const grandTotal = subtotal + gstTotal + Number(lsAmount || 0);
  return { materialCost, civilCost, subtotal, gstTotal, grandTotal };
};

const createVersionForEstimate = async (estimateId, actorId, actorName, reason) => {
  const estimate = await Estimate.findOne({ estimateId }).lean();
  if (!estimate) return null;
  const items = await EstimateItem.find({ estimateId }).lean();
  const existingVersions = await EstimateVersion.countDocuments({ estimateId });
  const version = `V${existingVersions + 1}.0`;
  const versionDoc = await EstimateVersion.create({
    estimateId,
    version,
    snapshot: { estimate, items },
    createdBy: actorId,
    createdByName: actorName,
    reason: reason || '',
  });
  await Estimate.findOneAndUpdate({ estimateId }, { currentVersion: versionDoc._id });
  return versionDoc;
};

export const createEstimate = async (req, res, next) => {
  try {
    let { estimateId, workName, nameOfWork, region, zone, division, circle, ward, items = [], lsAmount = 0 } = req.body;
    items = items.filter((i) => i.material?.trim());
    const managerId = req.user.id;
    const managerName = req.user.name;
    const finalWorkName = workName || nameOfWork;

    if (!estimateId || !finalWorkName) {
      return badRequest(res, 'Estimate ID and work name are required');
    }

    const existingEstimate = await Estimate.findOne({ estimateId });
    if (existingEstimate) {
      return conflict(res, 'Estimate ID already exists');
    }

    const createdItems = await EstimateItem.insertMany(
      items.map((item) => ({ estimateId, ...item }))
    );

    const { materialCost, civilCost, subtotal, gstTotal: gstAmount, grandTotal } = calculateTotals(items, lsAmount);

    const estimate = await Estimate.create({
      estimateId,
      nameOfWork: finalWorkName,
      region, zone, division, circle, ward,
      managerId, managerName,
      status: 'Draft',
      materialCost, civilCost, subtotal, gstAmount,
      lsAmount: Number(lsAmount || 0),
      grandTotal,
      items: createdItems.map((item) => item._id),
    });

    await AuditLog.create({
      userId: managerId,
      actorName: managerName,
      actorRole: req.user.role,
      action: 'ESTIMATE_CREATED',
      entity: 'Estimate',
      entityId: estimateId,
      module: 'Estimates',
      description: `Estimate ${estimateId} created with ${items.length} items`,
      details: { materialCost, civilCost, grandTotal, itemCount: items.length },
    });

    return created(res, { data: { estimate }, message: 'Estimate created successfully' });
  } catch (err) {
    next(err);
  }
};

export const getEstimates = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, zone, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (zone) filter.zone = zone;
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { estimateId: { $regex: safe, $options: 'i' } },
        { nameOfWork: { $regex: safe, $options: 'i' } },
      ];
    }

    const role = req.user.role;
    if (role === 'manager') {
      filter.managerId = new mongoose.Types.ObjectId(req.user.id);
    } else if (role === 'dgm') {
      filter.status = filter.status || { $in: ['Submitted', 'DGM Review'] };
    } else if (role === 'gm') {
      filter.status = filter.status || { $in: ['GM Review'] };
    } else if (role === 'ce') {
      filter.status = filter.status || { $in: ['DGM Review', 'GM Review', 'OTP Pending'] };
    }

    const estimates = await Estimate.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await Estimate.countDocuments(filter);

    return paginated(res, { data: estimates, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getEstimateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || id.length < 3) {
      return badRequest(res, 'Invalid estimate ID');
    }
    const estimate = await Estimate.findOne({ estimateId: id }).lean();
    if (!estimate) return notFound(res, 'Estimate not found');
    const items = await EstimateItem.find({ estimateId: id }).lean();
    return success(res, { data: { estimate, items } });
  } catch (err) {
    next(err);
  }
};

export const updateEstimate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, lsAmount, ...fields } = req.body;

    const estimate = await Estimate.findOne({ estimateId: id });
    if (!estimate) return notFound(res, 'Estimate not found');

    if (estimate.locked) {
      return forbidden(res, 'Estimate is locked. Cannot edit.');
    }

    if (!['Draft', 'Abstract Generated', 'Submitted', 'Reverted'].includes(estimate.status)) {
      return badRequest(res, `Cannot edit estimate in "${estimate.status}" status`);
    }

    if (req.user.role !== 'admin' && estimate.managerId?.toString() !== req.user.id) {
      return forbidden(res, 'You can only edit your own estimates');
    }

    if (items) {
      const filtered = items.filter((i) => i.material?.trim());
      await EstimateItem.deleteMany({ estimateId: id });
      const createdItems = await EstimateItem.insertMany(filtered.map((item) => ({ estimateId: id, ...item })));

      const totals = calculateTotals(filtered, lsAmount !== undefined ? Number(lsAmount) : Number(estimate.lsAmount || 0));
      Object.assign(estimate, {
        materialCost: totals.materialCost,
        civilCost: totals.civilCost,
        subtotal: totals.subtotal,
        gstAmount: totals.gstTotal,
        lsAmount: Number(lsAmount !== undefined ? lsAmount : estimate.lsAmount || 0),
        grandTotal: totals.grandTotal,
        items: createdItems.map((item) => item._id),
      });
    }

    Object.assign(estimate, fields);
    await estimate.save();

    await createVersionForEstimate(id, req.user.id, req.user.name, 'Estimate edited');

    await AuditLog.create({
      userId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'ESTIMATE_EDITED',
      entity: 'Estimate',
      entityId: id,
      module: 'Estimates',
      description: `Estimate ${id} edited`,
      details: { changes: Object.keys(fields) },
    });

    return success(res, { data: { estimate }, message: 'Estimate updated successfully' });
  } catch (err) {
    next(err);
  }
};

export const deleteEstimate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const estimate = await Estimate.findOne({ estimateId: id });
    if (!estimate) return notFound(res, 'Estimate not found');

    if (estimate.locked && req.user.role !== 'admin') {
      return forbidden(res, 'Cannot delete a locked estimate');
    }

    if (req.user.role !== 'admin' && estimate.managerId?.toString() !== req.user.id) {
      return forbidden(res, 'You can only delete your own estimates');
    }

    await EstimateItem.deleteMany({ estimateId: id });
    await EstimateMovement.deleteMany({ estimateId: id });
    await EstimateVersion.deleteMany({ estimateId: id });
    await Estimate.deleteOne({ estimateId: id });

    await AuditLog.create({
      userId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'ESTIMATE_DELETED',
      entity: 'Estimate',
      entityId: id,
      module: 'Estimates',
      description: `Estimate ${id} deleted`,
    });

    return success(res, { message: 'Estimate deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const updateEstimateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;

    const allowedTargets = ROLE_TRANSITIONS[req.user.role] || [];
    if (!allowedTargets.includes(status)) {
      return forbidden(res, `Your role "${req.user.role}" is not authorized to set status "${status}"`);
    }

    const estimate = await Estimate.findOne({ estimateId: id });
    if (!estimate) return notFound(res, 'Estimate not found');

    if (estimate.locked && req.user.role !== 'admin') {
      return forbidden(res, 'Estimate is locked. Cannot change status.');
    }

    const fromStatus = estimate.status;
    const allowedNext = WORKFLOW_TRANSITIONS[fromStatus];
    if (!allowedNext || !allowedNext.includes(status)) {
      return badRequest(res, `Cannot transition from "${fromStatus}" to "${status}". Allowed: ${(allowedNext || []).join(', ') || 'none'}`);
    }

    estimate.status = status;
    const movement = await EstimateMovement.create({
      estimateId: id,
      fromStatus,
      toStatus: status,
      action: `Status changed from ${fromStatus} to ${status}`,
      comments: comments || '',
      actorId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
    });

    estimate.lastMovement = movement._id;
    estimate.estimateMovements.push(movement._id);
    await estimate.save();

    await createVersionForEstimate(id, req.user.id, req.user.name, `Status changed to ${status}`);

    await AuditLog.create({
      userId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'ESTIMATE_STATUS_CHANGED',
      entity: 'Estimate',
      entityId: id,
      module: 'Estimates',
      description: `Status changed from ${fromStatus} to ${status}`,
      details: { fromStatus, toStatus: status, comments, movementId: movement._id },
    });

    return success(res, { data: { estimate, movement }, message: 'Status updated successfully' });
  } catch (err) {
    next(err);
  }
};

export const getEstimateMovements = async (req, res, next) => {
  try {
    const { id } = req.params;
    const movements = await EstimateMovement.find({ estimateId: id }).sort({ createdAt: -1 }).lean();
    return success(res, { data: { movements } });
  } catch (err) {
    next(err);
  }
};

export const createEstimateVersion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const estimate = await Estimate.findOne({ estimateId: id }).lean();
    if (!estimate) return notFound(res, 'Estimate not found');

    const versionDoc = await createVersionForEstimate(id, req.user.id, req.user.name, notes || 'Manual version snapshot');
    return created(res, { data: { version: versionDoc }, message: 'Version created successfully' });
  } catch (err) {
    next(err);
  }
};

export const getEstimatesByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;
    const filter = { status };
    if (req.user.role === 'manager') {
      filter.managerId = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.role === 'dgm') {
      if (!['Submitted', 'DGM Review'].includes(status)) return success(res, { data: { estimates: [] } });
    } else if (req.user.role === 'gm') {
      if (!['GM Review', 'OTP Pending'].includes(status)) return success(res, { data: { estimates: [] } });
    } else if (req.user.role === 'ce') {
      if (!['DGM Review', 'GM Review', 'OTP Pending'].includes(status)) return success(res, { data: { estimates: [] } });
    }
    const estimates = await Estimate.find(filter).sort({ createdAt: -1 }).lean();
    return success(res, { data: { estimates } });
  } catch (err) {
    next(err);
  }
};
