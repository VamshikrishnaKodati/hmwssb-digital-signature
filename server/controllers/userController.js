const bcrypt = require('bcryptjs');
const db = require('../config/db');

const DESIGNATIONS = ['SoRAdmin', 'Manager', 'DGM', 'GM', 'CGM', 'TenderOfficer', 'DirectorOfAdministration', 'SiteEngineer', 'BillingOfficer', 'Administrator', 'DOP', 'ED', 'MD', 'FinanceClerk', 'FinanceManager', 'FinanceHead'];

function canManage(req) {
  return ['Administrator', 'SoRAdmin'].includes(req.user.Designation);
}

const USER_COLS = '"UserID","Username","Name","Designation","RegionID","ZoneID","DivisionID","CircleID","WardID","MobileNumber","Email"';

const LOCATION_JOINS = `
  LEFT JOIN "Regions" r ON r."RegionID" = u."RegionID"
  LEFT JOIN "Zones" z ON z."ZoneID" = u."ZoneID"
  LEFT JOIN "Divisions" d ON d."DivisionID" = u."DivisionID"
  LEFT JOIN "Circles" c ON c."CircleID" = u."CircleID"
  LEFT JOIN "Wards" w ON w."WardID" = u."WardID"
`;

exports.listUsers = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can view users' });
    const result = await db.query(
      `SELECT u."UserID", u."Username", u."Name", u."Designation",
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

exports.createUser = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });

    const { Username, Password, Name, Designation, RegionID, ZoneID, DivisionID, CircleID, WardID, MobileNumber, Email } = req.body;
    if (!Username || !Password || !Name || !Designation)
      return res.status(400).json({ error: 'Username, Password, Name and Designation are required' });
    if (!DESIGNATIONS.includes(Designation))
      return res.status(400).json({ error: `Designation must be one of: ${DESIGNATIONS.join(', ')}` });

    const exists = await db.query('SELECT 1 FROM "Users" WHERE "Username" = $1', [Username]);
    if (exists.rows.length) return res.status(400).json({ error: 'Username already exists' });

    const hash = await bcrypt.hash(Password, 10);
    const result = await db.query(
      `INSERT INTO "Users" ("Username","PasswordHash","Name","Designation",
         "RegionID","ZoneID","DivisionID","CircleID","WardID","MobileNumber","Email")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${USER_COLS}`,
      [Username, hash, Name, Designation, RegionID || null, ZoneID || null, DivisionID || null,
       CircleID || null, WardID || null, MobileNumber || null, Email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Only Administrator or SoRAdmin can manage users' });

    const { Name, Designation, RegionID, ZoneID, DivisionID, CircleID, WardID, MobileNumber, Email, Password } = req.body;
    const sets = [];
    const vals = [];
    let i = 1;

    if (Name !== undefined) { sets.push(`"Name"=$${i++}`); vals.push(Name); }
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

    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    const result = await db.query(
      `UPDATE "Users" SET ${sets.join(', ')} WHERE "UserID"=$${i} RETURNING ${USER_COLS}`,
      vals
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
