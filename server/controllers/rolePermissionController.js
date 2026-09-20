const db = require('../config/db');
const { invalidateCache } = require('../middleware/rbac');

async function listRoles(req, res, next) {
  try {
    const r = await db.query('SELECT "RoleID", "RoleName", "Description", "IsActive" FROM "Role" ORDER BY "RoleID"');
    res.json(r.rows);
  } catch (err) { next(err); }
}

async function getRolePermissions(req, res, next) {
  try {
    const roleId = req.params.roleId;
    const role = await db.query('SELECT "RoleID", "RoleName" FROM "Role" WHERE "RoleID" = $1', [roleId]);
    if (!role.rows.length)
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } });

    const permRes = await db.query('SELECT "PermissionKey", "Description", "Module" FROM "Permission" ORDER BY "Module", "PermissionKey"');
    if (!permRes.rows.length) {
      res.json({ role: role.rows[0], permissions: [] });
      return;
    }
    const held = await db.query(
      `SELECT p."PermissionKey" FROM "RolePermission" rp
       JOIN "Permission" p ON p."PermissionID" = rp."PermissionID"
       WHERE rp."RoleID" = $1`,
      [roleId]
    );
    const heldKeys = new Set(held.rows.map((r) => r.PermissionKey));
    const data = permRes.rows.map((p) => ({ ...p, Access: heldKeys.has(p.PermissionKey) ? 'ALLOWED' : 'DENIED' }));
    res.json({ role: role.rows[0], permissions: data });
  } catch (err) { next(err); }
}

async function updateRolePermissions(req, res, next) {
  try {
    const roleId = req.params.roleId;
    const { permissions } = req.body || {};
    if (!Array.isArray(permissions))
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'permissions must be an array' } });

    const clean = [...new Set(permissions.map(String).filter(Boolean))];

    const role = await db.query('SELECT "RoleName" FROM "Role" WHERE "RoleID" = $1', [roleId]);
    if (!role.rows.length)
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } });
    const roleName = role.rows[0].RoleName;

    const ids = clean.length
      ? await db.query('SELECT "PermissionID", "PermissionKey" FROM "Permission" WHERE "PermissionKey" = ANY($1)', [clean])
      : { rows: [] };
    if (ids.rows.length !== clean.length)
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'One or more permission keys do not exist' } });
    const idByKey = new Map(ids.rows.map((r) => [r.PermissionKey, r.PermissionID]));

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const held = await client.query(
        `SELECT p."PermissionID", p."PermissionKey" FROM "RolePermission" rp
         JOIN "Permission" p ON p."PermissionID" = rp."PermissionID"
         WHERE rp."RoleID" = $1`,
        [roleId]
      );
      const current = new Map(held.rows.map((r) => [r.PermissionKey, r.PermissionID]));
      const requestedSet = new Set(clean);
      const userId = req.user.UserID;
      const changes = [];

      for (const key of clean) {
        if (!current.has(key)) {
          await client.query('INSERT INTO "RolePermission" ("RoleID", "PermissionID") VALUES ($1, $2)', [roleId, idByKey.get(key)]);
          await client.query(
            `INSERT INTO "PermissionChangeAudit" ("UserID", "RoleName", "PermissionKey", "Action", "OldAccess", "NewAccess")
             VALUES ($1, $2, $3, 'GRANT', 'DENIED', 'ALLOWED')`,
            [userId, roleName, key]
          );
          changes.push({ PermissionKey: key, Action: 'GRANT' });
        }
      }
      for (const [key, permId] of current) {
        if (!requestedSet.has(key)) {
          await client.query('DELETE FROM "RolePermission" WHERE "RoleID" = $1 AND "PermissionID" = $2', [roleId, permId]);
          await client.query(
            `INSERT INTO "PermissionChangeAudit" ("UserID", "RoleName", "PermissionKey", "Action", "OldAccess", "NewAccess")
             VALUES ($1, $2, $3, 'REVOKE', 'ALLOWED', 'DENIED')`,
            [userId, roleName, key]
          );
          changes.push({ PermissionKey: key, Action: 'REVOKE' });
        }
      }
      await client.query('COMMIT');
      invalidateCache();
      res.json({ role: roleName, changes });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

async function getAuditLog(req, res, next) {
  try {
    const r = await db.query(
      `SELECT a."AuditID", a."RoleName", a."PermissionKey", a."Action", a."OldAccess", a."NewAccess", a."CreatedAt", u."Name"
       FROM "PermissionChangeAudit" a
       LEFT JOIN "Users" u ON u."UserID" = a."UserID"
       ORDER BY a."CreatedAt" DESC, a."AuditID" DESC
       LIMIT 200`
    );
    res.json(r.rows);
  } catch (err) { next(err); }
}

module.exports = { listRoles, getRolePermissions, updateRolePermissions, getAuditLog };