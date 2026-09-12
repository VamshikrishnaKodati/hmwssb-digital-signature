const bcrypt = require('bcryptjs');
const db = require('../config/db');
const {
  isLocationRole,
  assignUserScope,
  deactivateUserScope,
  getAssignmentAudit,
  listAllAssignments,
  getUserScope,
} = require('../services/locationScope');

const DESIGNATIONS = ['SoRAdmin', 'Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'DirectorOfAdministration', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead'];

function canManage(req) {
  return ['Administrator', 'SoRAdmin'].includes(req.user.Designation);
}

const USER_COLS = '"UserID","Username","Name","Designation","DesignationTitle","EmployeeCode","IsActive","EffectiveFrom","EffectiveTo","RegionID","ZoneID","DivisionID","CircleID","WardID","MobileNumber","Email"';

const LOCATION_JOINS = `
  LEFT JOIN "Regions" r ON r."RegionID" = u."RegionID"
  LEFT JOIN "Zones" z ON z."ZoneID" = u."ZoneID"
  LEFT JOIN "Divisions" d ON d."DivisionID" = u."DivisionID"
  LEFT JOIN "Circles" c ON c."CircleID" = u."CircleID"
  LEFT JOIN "Wards" w ON w."WardID" = u."WardID"
`;

function scopeErrorMessage(err) {
  return err && err.code === 'SCOPE_CONFLICT';
}

exports.listUsers = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can view users' });
    const result = await db.query(
      `SELECT u."UserID", u."Username", u."Name", u."Designation",
              u."DesignationTitle", u."EmployeeCode", u."IsActive", u."EffectiveFrom", u."EffectiveTo",
              u."RegionID", u."ZoneID", u."DivisionID", u."CircleID", u."WardID",
              u."MobileNumber", u."Email",
              r."Name" as "RegionName", z."Name" as "ZoneName", d."Name" as "DivisionName",
              c."Name" as "CircleName", w."Name" as "WardName"
       FROM "Users" u
       ${LOCATION_JOINS}
       ORDER BY u."Name"`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

function assignmentCreateOrUpdate(created) {
  return async (req, res, next) => {
    try {
      if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });
      const { AssignedNodeId, AssignedRole } = req.body;
      if (AssignedRole && !isLocationRole(AssignedRole)) {
        return res.status(400).json({ error: `AssignedRole must be one of: Manager, DGM, GM, CGM` });
      }
      if (AssignedNodeId !== undefined && AssignedNodeId !== null && AssignedNodeId !== '') {
        if (!AssignedRole) return res.status(400).json({ error: 'AssignedRole is required when assigning a scope node' });
        const result = await assignUserScope({
          userId: req.params.id || created,
          role: AssignedRole,
          nodeId: Number(AssignedNodeId),
          changedBy: req.user.UserID,
          notes: req.body.AssignmentNotes || null,
        });
        return res.status(created ? 201 : 200).json(result);
      }
      if (AssignedNodeId === null && AssignedRole) {
        await deactivateUserScope({
          userId: req.params.id || created,
          role: AssignedRole,
          changedBy: req.user.UserID,
          notes: req.body.AssignmentNotes || null,
        });
        return res.status(200).json({ message: 'Scope assignment deactivated' });
      }
      return res.status(400).json({ error: 'AssignedNodeId is required' });
    } catch (err) {
      if (scopeErrorMessage(err)) return res.status(409).json({ error: err.message });
      next(err);
    }
  };
}

function handleScopeError(err, res, next) {
  if (scopeErrorMessage(err)) return res.status(409).json({ error: err.message });
  next(err);
}

exports.createUser = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });

    const { Username, Password, Name, Designation, DesignationTitle, EmployeeCode,
            RegionID, ZoneID, DivisionID, CircleID, WardID, MobileNumber, Email,
            EffectiveFrom, EffectiveTo, AssignedNodeId, AssignedRole } = req.body;
    if (!Username || !Password || !Name || !Designation)
      return res.status(400).json({ error: 'Username, Password, Name and Designation are required' });
    if (!DESIGNATIONS.includes(Designation))
      return res.status(400).json({ error: `Designation must be one of: ${DESIGNATIONS.join(', ')}` });
    if (AssignedRole && !isLocationRole(AssignedRole))
      return res.status(400).json({ error: `AssignedRole must be one of: Manager, DGM, GM, CGM` });
    if (AssignedNodeId !== undefined && AssignedNodeId !== '' && !AssignedRole)
      return res.status(400).json({ error: 'AssignedRole is required when assigning a scope node' });

    const exists = await db.query('SELECT 1 FROM "Users" WHERE "Username" = $1', [Username]);
    if (exists.rows.length) return res.status(400).json({ error: 'Username already exists' });
    if (EmployeeCode) {
      const dup = await db.query('SELECT 1 FROM "Users" WHERE "EmployeeCode" = $1', [EmployeeCode]);
      if (dup.rows.length) return res.status(400).json({ error: 'EmployeeCode already exists' });
    }

    const hash = await bcrypt.hash(Password, 10);
    const result = await db.query(
      `INSERT INTO "Users" ("Username","PasswordHash","Name","Designation","DesignationTitle","EmployeeCode",
         "RegionID","ZoneID","DivisionID","CircleID","WardID","MobileNumber","Email",
         "EffectiveFrom","EffectiveTo")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING ${USER_COLS}`,
      [Username, hash, Name, Designation, DesignationTitle || null, EmployeeCode || null,
       RegionID || null, ZoneID || null, DivisionID || null,
       CircleID || null, WardID || null, MobileNumber || null, Email || null,
       EffectiveFrom || null, EffectiveTo || null]
    );
    const user = result.rows[0];

    if (AssignedRole && AssignedNodeId !== undefined && AssignedNodeId !== '') {
      try {
        await assignUserScope({
          userId: user.UserID,
          role: AssignedRole,
          nodeId: Number(AssignedNodeId),
          changedBy: req.user.UserID,
          notes: 'Assigned during user creation',
        });
      } catch (err) {
        await db.query('DELETE FROM "Users" WHERE "UserID" = $1', [user.UserID]);
        return handleScopeError(err, res, next);
      }
    }

    res.status(201).json(user);
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });

    const { Name, Designation, DesignationTitle, EmployeeCode, EffectiveFrom, EffectiveTo,
            RegionID, ZoneID, DivisionID, CircleID, WardID, MobileNumber, Email, Password,
            AssignedNodeId, AssignedRole, AssignmentNotes } = req.body;
    const sets = [];
    const vals = [];
    let i = 1;

    if (Name !== undefined) { sets.push(`"Name"=$${i++}`); vals.push(Name); }
    if (DesignationTitle !== undefined) { sets.push(`"DesignationTitle"=$${i++}`); vals.push(DesignationTitle || null); }
    if (EmployeeCode !== undefined) {
      const dup = await db.query('SELECT 1 FROM "Users" WHERE "EmployeeCode" = $1 AND "UserID" <> $2', [EmployeeCode, req.params.id]);
      if (dup.rows.length) return res.status(400).json({ error: 'EmployeeCode already exists' });
      sets.push(`"EmployeeCode"=$${i++}`); vals.push(EmployeeCode || null);
    }
    if (EffectiveFrom !== undefined) { sets.push(`"EffectiveFrom"=$${i++}`); vals.push(EffectiveFrom || null); }
    if (EffectiveTo !== undefined) { sets.push(`"EffectiveTo"=$${i++}`); vals.push(EffectiveTo || null); }
    if (Designation !== undefined) {
      if (!DESIGNATIONS.includes(Designation)) return res.status(400).json({ error: 'Invalid Designation' });
      sets.push(`"Designation"=$${i++}`); vals.push(Designation);
    }
    for (const col of ['RegionID', 'ZoneID', 'DivisionID', 'CircleID', 'WardID']) {
      if (req.body[col] !== undefined) { sets.push(`"${col}"=$${i++}`); vals.push(req.body[col] || null); }
    }
    if (MobileNumber !== undefined) { sets.push(`"MobileNumber"=$${i++}`); vals.push(MobileNumber); }
    if (Email !== undefined) { sets.push(`"Email"=$${i++}`); vals.push(Email); }
    if (Password) {
      sets.push(`"PasswordHash"=$${i++}`); vals.push(await bcrypt.hash(Password, 10));
    }

    // Location-scope assignment for Manager/DGM/GM/CGM goes through the
    // dedicated assignment tables (authoritative) and keeps the legacy columns
    // coherent via assignUserScope.
    const targetRole = AssignedRole || req.body.Designation;
    let scopeUpdated = false;
    if (AssignedRole && !isLocationRole(AssignedRole))
      return res.status(400).json({ error: `AssignedRole must be one of: Manager, DGM, GM, CGM` });
    if (isLocationRole(targetRole)) {
      if (AssignedNodeId !== undefined && AssignedNodeId !== null && AssignedNodeId !== '') {
        try {
          await assignUserScope({
            userId: req.params.id,
            role: targetRole,
            nodeId: Number(AssignedNodeId),
            changedBy: req.user.UserID,
            notes: AssignmentNotes || 'Scope updated from User Management',
          });
        } catch (err) { return handleScopeError(err, res, next); }
        scopeUpdated = true;
      } else if (AssignedNodeId === null && AssignedRole) {
        await deactivateUserScope({
          userId: req.params.id,
          role: AssignedRole,
          changedBy: req.user.UserID,
          notes: AssignmentNotes || null,
        });
        scopeUpdated = true;
      }
    }

    if (!sets.length && !scopeUpdated) return res.status(400).json({ error: 'No fields to update' });

    let result = null;
    if (sets.length) {
      vals.push(req.params.id);
      result = await db.query(
        `UPDATE "Users" SET ${sets.join(', ')} WHERE "UserID"=$${i} RETURNING ${USER_COLS}`,
        vals
      );
      if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    } else {
      const r = await db.query(`SELECT ${USER_COLS} FROM "Users" WHERE "UserID" = $1`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
      result = r;
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.setUserStatus = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });
    const { isActive } = req.body;
    if (isActive === undefined || typeof isActive !== 'boolean')
      return res.status(400).json({ error: 'isActive (boolean) is required' });
    const result = await db.query(
      `UPDATE "Users" SET "IsActive" = $1 WHERE "UserID" = $2 RETURNING "UserID","Username","IsActive"`,
      [isActive, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.assignScope = assignmentCreateOrUpdate(true);

exports.updateScope = assignmentCreateOrUpdate(false);

exports.removeScope = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });
    const { role, notes } = req.body;
    if (!role || !isLocationRole(role)) {
      return res.status(400).json({ error: `role must be one of: Manager, DGM, GM, CGM` });
    }
    await deactivateUserScope({ userId: req.params.id, role, changedBy: req.user.UserID, notes: notes || null });
    res.json({ message: 'Scope assignment deactivated' });
  } catch (err) { next(err); }
};

exports.getScopeAudit = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });
    res.json(await getAssignmentAudit(req.params.id));
  } catch (err) { next(err); }
};

exports.getAssignments = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });
    res.json(await listAllAssignments());
  } catch (err) { next(err); }
};

exports.getMyScope = async (req, res, next) => {
  try {
    res.json(await getUserScope(req.user));
  } catch (err) { next(err); }
};