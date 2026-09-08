const db = require('../config/db');

exports.getRegions = async (req, res, next) => {
  try { res.json((await db.query('SELECT * FROM "Regions" ORDER BY "Name"')).rows); }
  catch (err) { next(err); }
};

exports.getZones = async (req, res, next) => {
  try {
    const { regionId } = req.query;
    let sql = 'SELECT * FROM "Zones"';
    const params = [];
    if (regionId) { sql += ' WHERE "RegionID" = $1'; params.push(regionId); }
    sql += ' ORDER BY "Name"';
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};

exports.getDivisions = async (req, res, next) => {
  try {
    const { zoneId } = req.query;
    let sql = 'SELECT * FROM "Divisions"';
    const params = [];
    if (zoneId) { sql += ' WHERE "ZoneID" = $1'; params.push(zoneId); }
    sql += ' ORDER BY "Name"';
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};

exports.getCircles = async (req, res, next) => {
  try {
    const { divisionId } = req.query;
    let sql = 'SELECT * FROM "Circles"';
    const params = [];
    if (divisionId) { sql += ' WHERE "DivisionID" = $1'; params.push(divisionId); }
    sql += ' ORDER BY "Name"';
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};

exports.getWards = async (req, res, next) => {
  try {
    const { circleId } = req.query;
    let sql = 'SELECT * FROM "Wards"';
    const params = [];
    if (circleId) { sql += ' WHERE "CircleID" = $1'; params.push(circleId); }
    sql += ' ORDER BY "Name"';
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};

exports.searchWards = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const result = await db.query(
      `SELECT w."WardID", w."Name" AS "WardName",
              c."CircleID", c."Name" AS "CircleName",
              d."DivisionID", d."Name" AS "DivisionName",
              z."ZoneID", z."Name" AS "ZoneName",
              r."RegionID", r."Name" AS "RegionName"
       FROM "Wards" w
       JOIN "Circles" c ON c."CircleID" = w."CircleID"
       JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
       JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
       JOIN "Regions" r ON r."RegionID" = z."RegionID"
       WHERE w."Name" ILIKE $1
       ORDER BY w."Name"
       LIMIT 20`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.getUsersByDesignation = async (req, res, next) => {
  try {
    const { designation } = req.query;
    let sql = 'SELECT "UserID","Name","Designation" FROM "Users"';
    const params = [];
    if (designation) { sql += ' WHERE "Designation" = $1'; params.push(designation); }
    sql += ' ORDER BY "Name"';
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};
