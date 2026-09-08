const db = require('../config/db');

async function fetchLocationNames(estimate) {
  const names = {};
  if (estimate.RegionID) {
    const r = await db.query('SELECT "Name" FROM "Regions" WHERE "RegionID" = $1', [estimate.RegionID]);
    if (r.rows[0]) names.region = r.rows[0].Name;
  }
  if (estimate.ZoneID) {
    const r = await db.query('SELECT "Name" FROM "Zones" WHERE "ZoneID" = $1', [estimate.ZoneID]);
    if (r.rows[0]) names.zone = r.rows[0].Name;
  }
  if (estimate.DivisionID) {
    const r = await db.query('SELECT "Name" FROM "Divisions" WHERE "DivisionID" = $1', [estimate.DivisionID]);
    if (r.rows[0]) names.division = r.rows[0].Name;
  }
  if (estimate.CircleID) {
    const r = await db.query('SELECT "Name" FROM "Circles" WHERE "CircleID" = $1', [estimate.CircleID]);
    if (r.rows[0]) names.circle = r.rows[0].Name;
  }
  if (estimate.WardID) {
    const r = await db.query('SELECT "Name" FROM "Wards" WHERE "WardID" = $1', [estimate.WardID]);
    if (r.rows[0]) names.ward = r.rows[0].Name;
  }
  return names;
}

module.exports = { fetchLocationNames };
