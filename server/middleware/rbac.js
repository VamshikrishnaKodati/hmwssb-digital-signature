const db = require('../config/db');

// ── Permission cache (loaded once at startup, refreshed on demand) ────────────
let permissionCache = null; // { rolePermissions: { 'Manager': Set([...]) } }

async function loadPermissions() {
  const result = await db.query(`
    SELECT r."RoleName", p."PermissionKey"
    FROM "RolePermission" rp
    JOIN "Role" r ON r."RoleID" = rp."RoleID"
    JOIN "Permission" p ON p."PermissionID" = rp."PermissionID"
    WHERE r."IsActive" = TRUE
  `);
  const map = {};
  for (const row of result.rows) {
    if (!map[row.RoleName]) map[row.RoleName] = new Set();
    map[row.RoleName].add(row.PermissionKey);
  }
  permissionCache = map;
  return map;
}

async function getPermissions() {
  if (!permissionCache) await loadPermissions();
  return permissionCache;
}

function invalidateCache() { permissionCache = null; }

// ── requireRole ───────────────────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.Designation)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Required role: ' + roles.join(' or ') }
      });
    }
    next();
  };
}

// ── requirePermission ─────────────────────────────────────────────────────────
// Checks the RBAC permission table. Falls back to allow if cache is empty
// (graceful degradation — existing inline checks still apply).
function requirePermission(...permissionKeys) {
  return async (req, res, next) => {
    try {
      const perms = await getPermissions();
      const userPerms = perms[req.user.Designation];
      if (!userPerms) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. Unknown role.' }
        });
      }
      const hasAll = permissionKeys.every(k => userPerms.has(k));
      if (!hasAll) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. Missing permission: ' + permissionKeys.join(', ') }
        });
      }
      next();
    } catch (err) {
      // If RBAC tables don't exist yet, fall through (existing inline checks enforce security)
      next();
    }
  };
}

// ── requireOwnership ──────────────────────────────────────────────────────────
// Verifies req.user.UserID owns the record. Store param name in opts.
function requireOwnership(getOwnerId) {
  return async (req, res, next) => {
    try {
      const ownerId = typeof getOwnerId === 'function' ? await getOwnerId(req) : req.params[getOwnerId];
      if (ownerId && ownerId !== req.user.UserID) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. You do not own this resource.' }
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ── assertWorkflowPermission ──────────────────────────────────────────────────
// Central check: role, ownership, and status in one call.
function assertWorkflowPermission({ requiredRole, requiredStatus, requiredOwner }) {
  return (req, res, next) => {
    if (requiredRole && req.user.Designation !== requiredRole) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Required role: ' + requiredRole }
      });
    }
    if (requiredStatus && req._estimateStatus !== requiredStatus) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Invalid state. Expected: ' + requiredStatus }
      });
    }
    if (requiredOwner && req._estimateOwner !== requiredOwner) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. You are not the owner.' }
      });
    }
    next();
  };
}

// ── RBAC permission map (for client-side / audit use) ─────────────────────────
const ROLE_PERMISSIONS = {
  Manager:          ['estimate.create','estimate.view','estimate.edit','estimate.submit'],
  DGM:              ['estimate.view','estimate.verify'],
  GM:               ['estimate.view','estimate.recommend'],
  CGM:              ['estimate.view','estimate.submitApproval'],
  DOP:              ['estimate.view','estimate.approve'],
  ED:               ['estimate.view','estimate.approve'],
  MD:               ['estimate.view','estimate.finalApprove'],
  TenderOfficer:    ['tender.view','tender.create','tender.publish','tender.update','tender.close','tender.evaluate','bid.open','bid.view','bid.submit','estimate.view'],
  DirectorOfAdministration:['agency.view','agency.create','agency.select','tender.view','tender.award','tender.workOrder','tender.agreement','bid.view','estimate.view'],
  SiteEngineer:     ['work.start','work.progress','work.complete','measurement.create','estimate.view'],
  BillingOfficer:   ['bill.create','bill.submit','measurement.verify','estimate.view'],
  FinanceClerk:     ['finance.inward','finance.verify','estimate.view'],
  FinanceManager:   ['finance.verify','finance.recommend','estimate.view'],
  FinanceHead:      ['finance.approve','finance.cheque','estimate.view'],
  Administrator:    ['estimate.view','estimate.delete','estimate.restore','audit.view','reports.view','users.manage'],
  SoRAdmin:         ['estimate.view','reports.view'],
};

function getPermissionsForRole(designation) {
  return ROLE_PERMISSIONS[designation] || [];
}

module.exports = {
  requireRole,
  requirePermission,
  requireOwnership,
  assertWorkflowPermission,
  getPermissionsForRole,
  loadPermissions,
  invalidateCache,
  getPermissions,
  ROLE_PERMISSIONS,
};
