const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { getPermissions } = require('../middleware/rbac');
const { checkLoginRateLimit, recordLoginAttempt, auditLogin, auditPasswordChange } = require('../utils/security');

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    const rateCheck = checkLoginRateLimit(username, ip);
    if (!rateCheck.allowed) {
      await auditLogin(username, ip, false, 'Rate limited');
      const mins = Math.ceil((new Date(rateCheck.lockoutUntil).getTime() - Date.now()) / 60000);
      return res.status(429).json({ error: 'Account temporarily locked. Try again in ' + mins + ' minutes.' });
    }

    const result = await db.query(
      `SELECT "UserID","Username","PasswordHash","Name","Designation","DesignationTitle",
              "EmployeeCode","EffectiveFrom","EffectiveTo",
              "RegionID","ZoneID","DivisionID","CircleID","WardID",
              "MobileNumber","Email"
       FROM "Users" WHERE "Username" = $1 AND "IsActive" IS NOT FALSE`,
      [username]
    );

    if (result.rows.length === 0) {
      recordLoginAttempt(username, ip, false);
      await auditLogin(username, ip, false, 'User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.PasswordHash);
    if (!validPassword) {
      recordLoginAttempt(username, ip, false);
      await auditLogin(username, ip, false, 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    recordLoginAttempt(username, ip, true);
    await auditLogin(username, ip, true);

    const token = jwt.sign(
      {
        UserID: user.UserID,
        Username: user.Username,
        Name: user.Name,
        Designation: user.Designation,
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Carries the role's permission keys + location scope so the client can
    // gate UI actions with the same canPerform rule the API enforces.
    const perms = await getPermissions();
    const permissions = perms[user.Designation] ? [...perms[user.Designation]] : [];

    res.json({
      token,
      user: {
        UserID: user.UserID,
        Username: user.Username,
        Name: user.Name,
        Designation: user.Designation,
        DesignationTitle: user.DesignationTitle,
        EmployeeCode: user.EmployeeCode,
        EffectiveFrom: user.EffectiveFrom,
        EffectiveTo: user.EffectiveTo,
        RegionID: user.RegionID,
        ZoneID: user.ZoneID,
        DivisionID: user.DivisionID,
        CircleID: user.CircleID,
        WardID: user.WardID,
        MobileNumber: user.MobileNumber,
        Email: user.Email,
        IsActive: user.IsActive !== false,
        Permissions: permissions,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  res.status(204).end();
};

// DEV/UAT ONLY: returns seeded demo accounts + their development password.
// Hard-disabled in production so plaintext credentials are never exposed there.
exports.getDemoAccounts = async (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  const result = await db.query(
    `SELECT "UserID","Username","Name","Designation" FROM "Users"
     WHERE "Username" IN ('manager','dgm','gm','cgm','dop','ed','md',
       'soradmin','director_admin','finance_head','finance_manager','finance_clerk',
       'tender_officer','site_engineer','billing_officer','admin_officer',
       'mgr-001','mgr-039','mgr-060','dgm-001','dgm-016','dgm-024')
     ORDER BY "UserID"`
  );
  res.json({
    devPassword: 'password123',
    accounts: result.rows.map(row => ({
      username: row.Username,
      name: row.Name,
      role: row.Designation,
    })),
  });
};

exports.getProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT "UserID","Username","Name","Designation","DesignationTitle",
              "EmployeeCode","EffectiveFrom","EffectiveTo",
              "RegionID","ZoneID","DivisionID","CircleID","WardID",
              "MobileNumber","Email"
       FROM "Users" WHERE "UserID" = $1`,
      [req.user.UserID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const perms = await getPermissions();
    const profile = result.rows[0];
    res.json({
      ...profile,
      IsActive: profile.IsActive !== false,
      Permissions: perms[profile.Designation] ? [...perms[profile.Designation]] : [],
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await db.query(
      'SELECT "PasswordHash" FROM "Users" WHERE "UserID" = $1',
      [req.user.UserID]
    );
    const valid = await bcrypt.compare(currentPassword, result.rows[0].PasswordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE "Users" SET "PasswordHash" = $1 WHERE "UserID" = $2', [hash, req.user.UserID]);
    await auditPasswordChange(req.user.UserID, req.user.UserID);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};
