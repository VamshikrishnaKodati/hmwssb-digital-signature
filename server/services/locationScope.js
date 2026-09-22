const db = require('../config/db');

const LOCATION_ROLES = ['Manager', 'DGM', 'GM', 'CGM'];

// Role -> (assignment table, node column, node table, node display type).
// DOP corporation assignment is DATA (a dedicated assignment record), stored
// using the same pattern as the other location roles. DOP is intentionally NOT
// in LOCATION_ROLES, so its estimate-scope/routing behaviour (board-wide)
// stays exactly as before — only assignment storage/management covers DOP.
const ROLE_SCOPE = {
  Manager: { table: 'ManagerCircleAssignment', nodeCol: 'CircleID', nodeTable: 'Circles', nodeType: 'Circle' },
  DGM: { table: 'DGMDivisionAssignment', nodeCol: 'DivisionID', nodeTable: 'Divisions', nodeType: 'Division' },
  GM: { table: 'GMZoneAssignment', nodeCol: 'ZoneID', nodeTable: 'Zones', nodeType: 'Zone' },
  CGM: { table: 'CGMCorporationAssignment', nodeCol: 'RegionID', nodeTable: 'Regions', nodeType: 'Corporation' },
  DOP: { table: 'DOPCorporationAssignment', nodeCol: 'RegionID', nodeTable: 'Regions', nodeType: 'Corporation' },
};

// Roles that can hold a location assignment record (Manager/DGM/GM/CGM and DOP).
const ASSIGNABLE_ROLES = Object.keys(ROLE_SCOPE);

const NODE_TABLE_COL = { Circles: 'CircleID', Divisions: 'DivisionID', Zones: 'ZoneID', Regions: 'RegionID' };

function isLocationRole(designation) {
  return LOCATION_ROLES.includes(designation);
}

function isAssignableRole(designation) {
  return ASSIGNABLE_ROLES.includes(designation);
}

// SQL for the set of CircleIDs inside the user's scope. Every location role
// reduces to a circle set (Manager -> own circles, DGM -> circles in its
// division, GM -> circles in its zone, CGM -> circles in its corporation).
function accessibleCirclesSql(designation, userIdIdx) {
  const u = `$${userIdIdx}`;
  switch (designation) {
    case 'Manager':
      return `SELECT "CircleID" FROM "ManagerCircleAssignment" WHERE "UserID" = ${u} AND "IsActive" = TRUE`;
    case 'DGM':
      return `SELECT c."CircleID" FROM "Circles" c JOIN "DGMDivisionAssignment" a ON a."DivisionID" = c."DivisionID" WHERE a."UserID" = ${u} AND a."IsActive" = TRUE`;
    case 'GM':
      return `SELECT c."CircleID" FROM "Circles" c JOIN "Divisions" d ON d."DivisionID" = c."DivisionID" JOIN "GMZoneAssignment" a ON a."ZoneID" = d."ZoneID" WHERE a."UserID" = ${u} AND a."IsActive" = TRUE`;
    case 'CGM':
      return `SELECT c."CircleID" FROM "Circles" c JOIN "Divisions" d ON d."DivisionID" = c."DivisionID" JOIN "Zones" z ON z."ZoneID" = d."ZoneID" JOIN "CGMCorporationAssignment" a ON a."RegionID" = z."RegionID" WHERE a."UserID" = ${u} AND a."IsActive" = TRUE`;
    default:
      return null;
  }
}

async function getAccessibleCircleIds(user) {
  if (!isLocationRole(user.Designation)) return null; // board-wide
  const sql = accessibleCirclesSql(user.Designation, 1);
  const { rows } = await db.query(sql, [user.UserID]);
  return rows.map(r => r.CircleID);
}

// SQL conditions to AND into an EstimateHeader query (aliased `alias`) so only
// in-scope estimates are returned. Creators can always see their own estimates
// (a reassignment must never hide historical work). `fromIdx` lets callers that
// already have bound params extend a query without re-indexing.
async function estimateScopeConds(user, alias = 'eh', fromIdx = 1) {
  if (!isLocationRole(user.Designation)) return { conds: [], params: [] };
  const sql = accessibleCirclesSql(user.Designation, fromIdx);
  return {
    conds: [`(${alias}."CircleID" IN (${sql}) OR ${alias}."CreatedBy" = $${fromIdx + 1})`],
    params: [user.UserID, user.UserID],
  };
}

async function isCircleAccessible(user, circleId) {
  if (!isLocationRole(user.Designation)) return true;
  const circleIds = await getAccessibleCircleIds(user);
  return circleIds.length === 0 ? false : circleIds.includes(Number(circleId));
}

// Object-level check against a fetched EstimateHeader row.
async function estimateInScope(user, est) {
  if (!isLocationRole(user.Designation)) return true;
  if (est.CreatedBy === user.UserID) return true;
  if (est.CircleID === null || est.CircleID === undefined) return false;
  return isCircleAccessible(user, est.CircleID);
}

// Does a target location chain (Region/Zone/Division/Circle IDs) fall inside
// the user's scope? Used when creating/editing an estimate.
async function locationInScope(user, chain) {
  if (!isLocationRole(user.Designation)) return true;
  if (chain.CircleID === null || chain.CircleID === undefined) return false;
  return isCircleAccessible(user, chain.CircleID);
}

async function getActiveAssignment(user, dbc = db) {
  if (!isLocationRole(user.Designation)) return null;
  const s = ROLE_SCOPE[user.Designation];
  const sql =
    `SELECT a."${s.nodeCol}" AS "nodeId", t."Name" AS "nodeName", '${s.nodeType}' AS "nodeType"
     FROM "${s.table}" a JOIN "${s.nodeTable}" t ON t."${s.nodeCol}" = a."${s.nodeCol}"
     WHERE a."UserID" = $1 AND a."IsActive" = TRUE
     ORDER BY a."AssignedAt" DESC, a."AssignmentID" DESC LIMIT 1`;
  const { rows } = await dbc.query(sql, [user.UserID]);
  return rows[0] || null;
}

// Full named location chain (Corporation -> .. -> node) for a user's primary
// assignment, read straight from the location master so the UI never trusts
// client-submitted hierarchy values.
const ASSIGNED_LOCATION_SQL = {
  Manager: `SELECT c."CircleID", c."Name" AS "CircleName", d."DivisionID", d."Name" AS "DivisionName",
                   z."ZoneID", z."Name" AS "ZoneName", r."RegionID", r."Name" AS "RegionName"
            FROM "Circles" c
            JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
            JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
            JOIN "Regions" r ON r."RegionID" = z."RegionID"
            WHERE c."CircleID" = $1`,
  DGM: `SELECT d."DivisionID", d."Name" AS "DivisionName", z."ZoneID", z."Name" AS "ZoneName",
               r."RegionID", r."Name" AS "RegionName"
        FROM "Divisions" d
        JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
        JOIN "Regions" r ON r."RegionID" = z."RegionID"
        WHERE d."DivisionID" = $1`,
  GM: `SELECT z."ZoneID", z."Name" AS "ZoneName", r."RegionID", r."Name" AS "RegionName"
       FROM "Zones" z JOIN "Regions" r ON r."RegionID" = z."RegionID"
       WHERE z."ZoneID" = $1`,
  CGM: `SELECT r."RegionID", r."Name" AS "RegionName" FROM "Regions" r WHERE r."RegionID" = $1`,
};

async function getAssignedLocation(user, dbc = db) {
  if (!isLocationRole(user.Designation)) return null;
  const assign = await getActiveAssignment(user, dbc);
  if (!assign) return null;
  const { rows } = await dbc.query(ASSIGNED_LOCATION_SQL[user.Designation], [assign.nodeId]);
  return { nodeType: assign.nodeType, nodeId: assign.nodeId, nodeName: assign.nodeName, location: rows[0] || null };
}

// Full location chain (RegionID..CircleID) for a scope node.
async function getChainForNode(role, nodeId, dbc = db) {
  const base = { RegionID: null, ZoneID: null, DivisionID: null, CircleID: null };
  if (role === 'Manager') {
    const r = await dbc.query(
      `SELECT c."CircleID", c."DivisionID", d."ZoneID", z."RegionID"
       FROM "Circles" c JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
       JOIN "Zones" z ON z."ZoneID" = d."ZoneID" WHERE c."CircleID" = $1`, [nodeId]);
    if (!r.rows[0]) return null;
    return { ...base, RegionID: r.rows[0].RegionID, ZoneID: r.rows[0].ZoneID, DivisionID: r.rows[0].DivisionID, CircleID: r.rows[0].CircleID };
  }
  if (role === 'DGM') {
    const r = await dbc.query(
      `SELECT d."DivisionID", d."ZoneID", z."RegionID"
       FROM "Divisions" d JOIN "Zones" z ON z."ZoneID" = d."ZoneID" WHERE d."DivisionID" = $1`, [nodeId]);
    if (!r.rows[0]) return null;
    return { ...base, RegionID: r.rows[0].RegionID, ZoneID: r.rows[0].ZoneID, DivisionID: r.rows[0].DivisionID };
  }
  if (role === 'GM') {
    const r = await dbc.query('SELECT "ZoneID", "RegionID" FROM "Zones" WHERE "ZoneID" = $1', [nodeId]);
    if (!r.rows[0]) return null;
    return { ...base, RegionID: r.rows[0].RegionID, ZoneID: r.rows[0].ZoneID };
  }
  if (role === 'CGM') {
    const r = await dbc.query('SELECT "RegionID" FROM "Regions" WHERE "RegionID" = $1', [nodeId]);
    if (!r.rows[0]) return null;
    return { ...base, RegionID: r.rows[0].RegionID };
  }
  return null;
}

// Walk a ward up to its full Region->Zone->Division->Circle chain.
async function getLocationChainFromWard(wardId) {
  const { rows } = await db.query(
    `SELECT w."WardID", w."CircleID", c."DivisionID", d."ZoneID", z."RegionID"
     FROM "Wards" w
     JOIN "Circles" c ON c."CircleID" = w."CircleID"
     JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
     JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
     WHERE w."WardID" = $1`,
    [wardId]
  );
  return rows[0] || null;
}

// Full scope tree for /users/me/scope.
async function getUserScope(user) {
  if (!isLocationRole(user.Designation)) {
    const all = await Promise.all([
      db.query('SELECT "RegionID","Name" FROM "Regions" ORDER BY "Name"'),
      db.query('SELECT "ZoneID","Name" FROM "Zones" ORDER BY "Name"'),
      db.query('SELECT "DivisionID","Name" FROM "Divisions" ORDER BY "Name"'),
      db.query('SELECT "CircleID","Name" FROM "Circles" ORDER BY "Name"'),
      db.query('SELECT "WardID","Name","CircleID" FROM "Wards" ORDER BY "Name"'),
      db.query(`SELECT "UserID","Name","EmployeeCode" FROM "Users" WHERE "Designation" = 'Manager' ORDER BY "Name"`),
      db.query(`SELECT "UserID","Name","EmployeeCode" FROM "Users" WHERE "Designation" = 'DGM' ORDER BY "Name"`),
    ]);
    return {
      role: user.Designation,
      designationTitle: null,
      scopeType: 'All',
      nodes: [],
      corporations: all[0].rows,
      zones: all[1].rows,
      divisions: all[2].rows,
      circles: all[3].rows,
      wards: all[4].rows,
      managers: all[5].rows,
      dgms: all[6].rows,
    };
  }

  const circleIds = await getAccessibleCircleIds(user);
  const empty = { corporations: [], zones: [], divisions: [], circles: [], wards: [], managers: [], dgms: [] };

  let scopeRows = [];
  if (circleIds.length) {
    scopeRows = (await db.query(
      `SELECT c."CircleID", c."Name" AS "CircleName", d."DivisionID", d."Name" AS "DivisionName",
              z."ZoneID", z."Name" AS "ZoneName", r."RegionID", r."Name" AS "RegionName"
       FROM "Circles" c
       JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
       JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
       JOIN "Regions" r ON r."RegionID" = z."RegionID"
       WHERE c."CircleID" = ANY($1)
       ORDER BY c."Name"`,
      [circleIds]
    )).rows;
  }

  const divIds = [...new Set(scopeRows.map(r => r.DivisionID))];
  const zoneIds = [...new Set(scopeRows.map(r => r.ZoneID))];
  const regIds = [...new Set(scopeRows.map(r => r.RegionID))];

  const uniqRows = (rows, key, nameKey) => {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (r[key] === null || seen.has(r[key])) continue;
      seen.add(r[key]);
      out.push({ ID: r[key], Name: r[nameKey] });
    }
    return out;
  };

  const wards = circleIds.length
    ? (await db.query(
        `SELECT "WardID","Name","CircleID" FROM "Wards" WHERE "CircleID" = ANY($1) ORDER BY "Name"`,
        [circleIds]
      )).rows
    : [];

  let managers = [], dgms = [];
  if (circleIds.length) {
    managers = (await db.query(
      `SELECT DISTINCT u."UserID", u."Name", u."EmployeeCode"
       FROM "ManagerCircleAssignment" a JOIN "Users" u ON u."UserID" = a."UserID"
       WHERE a."CircleID" = ANY($1) AND a."IsActive" = TRUE AND u."IsActive" IS NOT FALSE
       ORDER BY u."Name"`,
      [circleIds]
    )).rows;
  }
  if (divIds.length) {
    dgms = (await db.query(
      `SELECT DISTINCT u."UserID", u."Name", u."EmployeeCode"
       FROM "DGMDivisionAssignment" a JOIN "Users" u ON u."UserID" = a."UserID"
       WHERE a."DivisionID" = ANY($1) AND a."IsActive" = TRUE AND u."IsActive" IS NOT FALSE
       ORDER BY u."Name"`,
      [divIds]
    )).rows;
  }

  const active = await getActiveAssignment(user);
  return {
    role: user.Designation,
    designationTitle: null,
    scopeType: ROLE_SCOPE[user.Designation].nodeType,
    nodes: active ? [active] : [],
    assignedLocation: await getAssignedLocation(user),
    corporations: uniqRows(scopeRows, 'RegionID', 'RegionName'),
    zones: uniqRows(scopeRows, 'ZoneID', 'ZoneName'),
    divisions: uniqRows(scopeRows, 'DivisionID', 'DivisionName'),
    circles: scopeRows.map(r => ({ CircleID: r.CircleID, Name: r.CircleName })),
    wards,
    managers,
    dgms,
  };
}

// Location-aware next-approver lookup. Falls back to the existing global
// single-user-per-designation behavior when no location mapping exists, so the
// system keeps working (with pre-location semantics) for unmapped estimates.
async function resolveApprovalUser(designation, est, dbc = db) {
  const s = ROLE_SCOPE[designation];
  if (s && est && est[nodeColOf(designation, est)] != null) {
    const nodeVal = est[nodeColOf(designation, est)];
    const sql =
      `SELECT u."UserID", u."Name", u."Email", u."Designation"
       FROM "${s.table}" a JOIN "Users" u ON u."UserID" = a."UserID"
       WHERE a."${s.nodeCol}" = $1 AND a."IsActive" = TRUE AND u."IsActive" IS NOT FALSE
       ORDER BY a."AssignedAt" DESC, a."AssignmentID" DESC LIMIT 1`;
    const { rows } = await dbc.query(sql, [nodeVal]);
    if (rows[0]) return rows[0];
  }
  const { rows } = await dbc.query(
    `SELECT "UserID","Name","Email","Designation" FROM "Users"
     WHERE "Designation" = $1 AND "IsActive" IS NOT FALSE ORDER BY "UserID" LIMIT 1`,
    [designation]
  );
  return rows[0] || null;
}

function nodeColOf(designation, est) {
  return designation === 'DGM' ? 'DivisionID'
    : designation === 'GM' ? 'ZoneID'
    : designation === 'CGM' ? 'RegionID' : null;
}

// ---- Assignment management (used by the User Management module) ----

function conflictError(message) {
  const e = new Error(message);
  e.code = 'SCOPE_CONFLICT';
  e.status = 409;
  return e;
}

async function getNodeName(role, nodeId, dbc = db) {
  const s = ROLE_SCOPE[role];
  const { rows } = await dbc.query(`SELECT "Name" FROM "${s.nodeTable}" WHERE "${s.nodeCol}" = $1`, [nodeId]);
  return rows[0]?.Name || null;
}

// Assign (or reassign) a user to a scope node. Throws an error with
// code=SCOPE_CONFLICT (status 409) when another user already holds the node.
async function assignUserScope({ userId, role, nodeId, changedBy, notes }) {
  if (!isAssignableRole(role)) throw new Error('Invalid role: ' + role);
  const s = ROLE_SCOPE[role];

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const chain = await getChainForNode(role, nodeId, client);
    if (!chain) throw new Error(`Invalid ${s.nodeType} node ID: ${nodeId}`);

    const nodeName = await getNodeName(role, nodeId, client);

    // Conflict: another user already holds this node as primary.
    const holder = await client.query(
      `SELECT u."Name", a."UserID" FROM "${s.table}" a JOIN "Users" u ON u."UserID" = a."UserID"
       WHERE a."${s.nodeCol}" = $1 AND a."IsActive" = TRUE AND a."UserID" <> $2
       FOR UPDATE`,
      [nodeId, userId]
    );
    if (holder.rows.length) throw conflictError(`${nodeName} is already assigned to ${holder.rows[0].Name}`);

    // Prior active row (if any) for the ChangeType + OldScope audit values.
    const prior = (await client.query(
      `SELECT a."${s.nodeCol}" AS "nodeId", t."Name" AS "nodeName" FROM "${s.table}" a
       JOIN "${s.nodeTable}" t ON t."${s.nodeCol}" = a."${s.nodeCol}"
       WHERE a."UserID" = $1 AND a."IsActive" = TRUE ORDER BY a."AssignedAt" DESC, a."AssignmentID" DESC LIMIT 1`,
      [userId]
    )).rows[0];

    const action = prior ? 'Update' : 'Create';

    await client.query(
      `UPDATE "${s.table}" SET "IsActive" = FALSE, "DeactivatedAt" = now() WHERE "UserID" = $1 AND "IsActive" = TRUE`,
      [userId]
    );

    const ins = await client.query(
      `INSERT INTO "${s.table}" ("UserID","${s.nodeCol}","IsActive","AssignedBy","Notes")
       VALUES ($1,$2,TRUE,$3,$4) RETURNING *`,
      [userId, nodeId, changedBy || null, notes || null]
    );

    // Keep the legacy Users.*ID columns coherent with the assignment tables.
    const upd = [
      `"RegionID" = ${chain.RegionID ?? 'NULL'}`,
      `"ZoneID" = ${chain.ZoneID ?? 'NULL'}`,
      `"DivisionID" = ${chain.DivisionID ?? 'NULL'}`,
      `"CircleID" = ${chain.CircleID ?? 'NULL'}`,
      `"WardID" = NULL`,
    ];
    await client.query(`UPDATE "Users" SET ${upd.join(', ')} WHERE "UserID" = $1`, [userId]);

    await client.query(
      `INSERT INTO "AssignmentAudit" ("UserID","Role","Action","OldScope","NewScope","ChangedBy","Notes")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, role, action,
       prior ? JSON.stringify({ nodeType: s.nodeType, nodeId: prior.nodeId, nodeName: prior.nodeName }) : null,
       JSON.stringify({ nodeType: s.nodeType, nodeId, nodeName }),
       changedBy || null, notes || null]
    );

    await client.query('COMMIT');
    return {
      ...ins.rows[0],
      NodeType: s.nodeType,
      NodeName: nodeName,
      chain,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deactivateUserScope({ userId, role, changedBy, notes }) {
  const s = ROLE_SCOPE[role];

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const prior = (await client.query(
      `SELECT a."${s.nodeCol}" AS "nodeId", t."Name" AS "nodeName" FROM "${s.table}" a
       JOIN "${s.nodeTable}" t ON t."${s.nodeCol}" = a."${s.nodeCol}"
       WHERE a."UserID" = $1 AND a."IsActive" = TRUE ORDER BY a."AssignedAt" DESC, a."AssignmentID" DESC LIMIT 1`,
      [userId]
    )).rows[0];

    await client.query(
      `UPDATE "${s.table}" SET "IsActive" = FALSE, "DeactivatedAt" = now() WHERE "UserID" = $1 AND "IsActive" = TRUE`,
      [userId]
    );

    if (prior) {
      await client.query(
        `INSERT INTO "AssignmentAudit" ("UserID","Role","Action","OldScope","NewScope","ChangedBy","Notes")
         VALUES ($1,$2,'Deactivate',$3,NULL,$4,$5)`,
        [userId, role,
         JSON.stringify({ nodeType: s.nodeType, nodeId: prior.nodeId, nodeName: prior.nodeName }),
         changedBy || null, notes || null]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAssignmentAudit(userId) {
  const { rows } = await db.query(
    `SELECT aa.*, cu."Name" AS "ChangedByName"
     FROM "AssignmentAudit" aa
     LEFT JOIN "Users" cu ON cu."UserID" = aa."ChangedBy"
     WHERE aa."UserID" = $1
     ORDER BY aa."ChangedAt" DESC`,
    [userId]
  );
  return rows;
}

async function listAllAssignments() {
  const parts = [];
  for (const [role, s] of Object.entries(ROLE_SCOPE)) {
    const t = await db.query(
      `SELECT a."${s.nodeCol}" AS "NodeID", a."IsActive", a."AssignedBy", a."AssignedAt", a."DeactivatedAt",
              u."UserID", u."Name" AS "UserName", u."EmployeeCode",
              n."Name" AS "NodeName"
       FROM "${s.table}" a
       JOIN "Users" u ON u."UserID" = a."UserID"
       JOIN "${s.nodeTable}" n ON n."${s.nodeCol}" = a."${s.nodeCol}"
       ORDER BY a."IsActive" DESC, n."Name", u."Name"`
    );
    parts.push(t.rows.map(r => ({ ...r, Role: role, NodeType: s.nodeType })));
  }
  return parts.flat();
}

// Full ancestor location names for one assignment node, resolved straight from
// the location masters so the UI never invents or trusts submitted hierarchy.
// nodeNameCol maps a nodeType to its name column in the chain result.
const ASSIGNMENT_CHAIN_SQL = {
  Circle: {
    nodeNameCol: 'CircleName',
    nodeIdCol: 'CircleID',
    sql: `SELECT c."CircleID" AS "NodeID", c."Name" AS "CircleName", d."DivisionID", d."Name" AS "DivisionName",
                 z."ZoneID", z."Name" AS "ZoneName", r."RegionID", r."Name" AS "RegionName"
          FROM "Circles" c
          JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
          JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
          JOIN "Regions" r ON r."RegionID" = z."RegionID"
          WHERE c."CircleID" = $1`,
  },
  Division: {
    nodeNameCol: 'DivisionName',
    nodeIdCol: 'DivisionID',
    sql: `SELECT d."DivisionID" AS "NodeID", d."Name" AS "DivisionName", z."ZoneID", z."Name" AS "ZoneName",
                 r."RegionID", r."Name" AS "RegionName"
          FROM "Divisions" d
          JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
          JOIN "Regions" r ON r."RegionID" = z."RegionID"
          WHERE d."DivisionID" = $1`,
  },
  Zone: {
    nodeNameCol: 'ZoneName',
    nodeIdCol: 'ZoneID',
    sql: `SELECT z."ZoneID" AS "NodeID", z."Name" AS "ZoneName", r."RegionID", r."Name" AS "RegionName"
          FROM "Zones" z JOIN "Regions" r ON r."RegionID" = z."RegionID"
          WHERE z."ZoneID" = $1`,
  },
  Corporation: {
    nodeNameCol: 'RegionName',
    nodeIdCol: 'RegionID',
    sql: `SELECT r."RegionID" AS "NodeID", r."Name" AS "RegionName" FROM "Regions" r WHERE r."RegionID" = $1`,
  },
};

// All ACTIVE assignment records for one user across every assignable role.
// - deduped at the data level (same role + node appears once, first AssignmentID wins)
// - each record carries unique AssignmentID + full resolved location chain names
// - distinct legitimate assignments stay separate rows
async function getUserAssignments(userId) {
  const seen = new Set();
  const out = [];
  for (const [role, s] of Object.entries(ROLE_SCOPE)) {
    const rows = (await db.query(
      `SELECT a."AssignmentID", a."UserID", a."${s.nodeCol}" AS "NodeID", a."AssignedAt", a."AssignedBy", a."Notes", b."Name" AS "AssignedByName"
       FROM "${s.table}" a LEFT JOIN "Users" b ON b."UserID" = a."AssignedBy"
       WHERE a."UserID" = $1 AND a."IsActive" = TRUE
       ORDER BY a."AssignedAt" DESC, a."AssignmentID" DESC`,
      [userId]
    )).rows;
    for (const row of rows) {
      const key = `${role}:${row.NodeID}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const chainDef = ASSIGNMENT_CHAIN_SQL[s.nodeType];
      const chain = (await db.query(chainDef.sql, [row.NodeID])).rows[0] || null;
      out.push({
        AssignmentID: row.AssignmentID,
        Role: role,
        NodeType: s.nodeType,
        NodeID: row.NodeID,
        NodeName: chain ? chain[chainDef.nodeNameCol] : null,
        RegionName: chain ? chain.RegionName : null,
        ZoneName: chain ? chain.ZoneName : null,
        DivisionName: chain ? chain.DivisionName : null,
        CircleName: chain ? chain.CircleName : null,
        WardName: null,
        AssignedAt: row.AssignedAt,
        AssignedBy: row.AssignedBy,
        AssignedByName: row.AssignedByName,
        Notes: row.Notes,
      });
    }
  }
  out.sort((a, b) => a.Role.localeCompare(b.Role) || String(a.NodeName || '').localeCompare(String(b.NodeName || '')));
  return out;
}

// Deactivate every active assignment record of a user except the one role being
// managed. Ensures a designation/location change never leaves a stale active
// assignment behind in another role table (single transaction).
async function deactivateStaleScopeAssignments({ userId, keepRole = null, changedBy, notes }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const [role, s] of Object.entries(ROLE_SCOPE)) {
      if (keepRole && role === keepRole) continue;
      const prior = (await client.query(
        `SELECT a."${s.nodeCol}" AS "nodeId", t."Name" AS "nodeName"
         FROM "${s.table}" a JOIN "${s.nodeTable}" t ON t."${s.nodeCol}" = a."${s.nodeCol}"
         WHERE a."UserID" = $1 AND a."IsActive" = TRUE
         ORDER BY a."AssignedAt" DESC, a."AssignmentID" DESC LIMIT 1`,
        [userId]
      )).rows[0];
      if (!prior) continue;
      await client.query(
        `UPDATE "${s.table}" SET "IsActive" = FALSE, "DeactivatedAt" = now() WHERE "UserID" = $1 AND "IsActive" = TRUE`,
        [userId]
      );
      await client.query(
        `INSERT INTO "AssignmentAudit" ("UserID","Role","Action","OldScope","NewScope","ChangedBy","Notes")
         VALUES ($1,$2,'Deactivate',$3,NULL,$4,$5)`,
        [userId, role,
         JSON.stringify({ nodeType: s.nodeType, nodeId: prior.nodeId, nodeName: prior.nodeName }),
         changedBy || null, notes || null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  LOCATION_ROLES,
  ROLE_SCOPE,
  ASSIGNABLE_ROLES,
  isLocationRole,
  isAssignableRole,
  accessibleCirclesSql,
  getAccessibleCircleIds,
  estimateScopeConds,
  isCircleAccessible,
  estimateInScope,
  locationInScope,
  getActiveAssignment,
  getChainForNode,
  getLocationChainFromWard,
  getUserScope,
  resolveApprovalUser,
  assignUserScope,
  deactivateUserScope,
  getAssignmentAudit,
  listAllAssignments,
  getUserAssignments,
  deactivateStaleScopeAssignments,
};