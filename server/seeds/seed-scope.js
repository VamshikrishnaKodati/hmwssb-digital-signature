require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hmwssb',
});

// [EmployeeCode, Name, Circle Number]
const MANAGERS = [
  ['MGR-001','Rani Naidu',1],['MGR-002','Krishna Reddy',2],['MGR-003','Murali Reddy',3],
  ['MGR-004','Anand Kumar',4],['MGR-005','Shankar Rao',5],['MGR-006','Chandra Pillai',6],
  ['MGR-007','Sudhakar Murthy',7],['MGR-008','Vani Chowdary',8],['MGR-009','Ganesh Naik',9],
  ['MGR-010','Rajkumar Rao',10],['MGR-011','Divya Chowdary',11],['MGR-012','Naveen Gupta',12],
  ['MGR-013','Murali Goud',13],['MGR-014','Narayana Sharma',14],['MGR-015','Ramesh Murthy',15],
  ['MGR-016','Vani Murthy',16],['MGR-017','Saroja Gupta',17],['MGR-018','Vani Chowdhary',18],
  ['MGR-019','Manasa Reddy',19],['MGR-020','Madhu Reddy',20],['MGR-021','Shankar Naik',21],
  ['MGR-022','Prakash Achari',22],['MGR-023','Jagan Prasad',23],['MGR-024','Nagesh Achari',24],
  ['MGR-025','Vasantha Reddy',25],['MGR-026','Anitha Varma',26],['MGR-027','Latha Rao',27],
  ['MGR-028','Mahesh Rao',28],['MGR-029','Chandra Achari',29],['MGR-030','Bhaskar Chowdary',30],
  ['MGR-031','Raghavendra Sastry',31],['MGR-032','Swathi Naidu',32],['MGR-033','Raghavendra Varma',33],
  ['MGR-034','Gopal Mishra',34],['MGR-035','Praveen Verma',35],['MGR-036','Mahesh Reddy',36],
  ['MGR-037','Rukmini Pillai',37],['MGR-038','Rajender Sharma',38],['MGR-039','Kalyan Naidu',39],
  ['MGR-040','Anita Verma',40],['MGR-041','Kiran Raju',41],['MGR-042','Uma Naik',42],
  ['MGR-043','Chandra Naik',43],['MGR-044','Padmavathi Raju',44],['MGR-045','Indira Verma',45],
  ['MGR-046','Narsimha Naidu',46],['MGR-047','Madhu Rao',47],['MGR-048','Narayana Rao',48],
  ['MGR-049','Srinivas Achari',49],['MGR-050','Vani Reddy',50],['MGR-051','Haritha Naidu',51],
  ['MGR-052','Sarita Naik',52],['MGR-053','Vani Verma',53],['MGR-054','Mohan Prasad',54],
  ['MGR-055','Narsimha Raju',55],['MGR-056','Lakshmi Mishra',56],['MGR-057','Sudhakar Raju',57],
  ['MGR-058','Ramulu Naidu',58],['MGR-059','Sudhakar Naidu',59],['MGR-060','Tirumala Sastry',60],
];

// [EmployeeCode, Name, Division Number]
const DGMS = [
  ['DGM-001','Gopal Naidu',1],['DGM-002','Manasa Naidu',2],['DGM-003','Indira Varma',3],
  ['DGM-004','Rajesh Naidu',4],['DGM-005','Ramulu Rao',5],['DGM-006','Prasad Kumar',6],
  ['DGM-007','Sarita Chowdary',7],['DGM-008','Naveen Sharma',8],['DGM-009','Pavan Gupta',9],
  ['DGM-010','Ramesh Sharma',10],['DGM-011','Raghavendra Naidu',11],['DGM-012','Qadir Achari',12],
  ['DGM-013','Sampath Naidu',13],['DGM-014','Murali Rao',14],['DGM-015','Nagender Sharma',15],
  ['DGM-016','Radha Rao',16],['DGM-017','Murali Naidu',17],['DGM-018','Pavan Achari',18],
  ['DGM-019','Anitha Naik',19],['DGM-020','Sridhar Yadav',20],['DGM-021','Vijay Reddy',21],
  ['DGM-022','Srinivas Mishra',22],['DGM-023','Vani Sharma',23],['DGM-024','Narsimha Gupta',24],
];

async function seedScopeAssignments(dbPool) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash('password123', 10);

    const admin = (await client.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', ['admin_officer'])).rows[0];
    const assignedBy = admin ? admin.UserID : null;

    const dm = (await client.query(
      `SELECT d."Name" AS "DivisionName", c."CircleID", c."DivisionID", c."Name" AS "CircleName",
              z."ZoneID", r."RegionID", r."Name" AS "RegionName"
       FROM "Circles" c
       JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
       JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
       JOIN "Regions" r ON r."RegionID" = z."RegionID"
       ORDER BY c."CircleID"`
    )).rows;

    const circleByNo = {};
    for (const c of dm) {
      const m = c.CircleName.match(/^(\d+)/);
      if (!m) throw new Error('Unparseable circle name: ' + c.CircleName);
      circleByNo[parseInt(m[1], 10)] = c;
    }

    const divisionByNo = {};
    const divisionNameById = {};
    for (const d of await client.query('SELECT "DivisionID","Name" FROM "Divisions"').then(r => r.rows)) {
      divisionNameById[d.DivisionID] = d.Name;
      const m = d.Name.match(/Division\s+(\d+)$/i);
      if (m) divisionByNo[parseInt(m[1], 10)] = d.DivisionID;
    }

    const zoneByName = {};
    for (const z of await client.query('SELECT "ZoneID","Name" FROM "Zones"').then(r => r.rows)) {
      zoneByName[z.Name] = z.ZoneID;
    }

    const regionByName = {};
    for (const r of await client.query('SELECT "RegionID","Name" FROM "Regions"').then(r => r.rows)) {
      regionByName[r.Name] = r.RegionID;
    }

    const getDemo = async (username) =>
      (await client.query('SELECT "UserID","Designation" FROM "Users" WHERE "Username" = $1', [username])).rows[0];

    // Demo users hold the primary dev slots used by the regression suites:
    // manager -> Circle 1, dgm -> Division 1, gm -> Malkajgiri, cgm -> MMC.
    const demoManager = await getDemo('manager');
    const demoDgm = await getDemo('dgm');
    const demoGm = await getDemo('gm');
    const demoCgm = await getDemo('cgm');
    if (!demoManager || !demoDgm || !demoGm || !demoCgm) {
      throw new Error('Demo users must be seeded before seedScopeAssignments');
    }

    const titles = {
      Manager: 'Manager (Engg)',
      DGM: 'Deputy General Manager (Engg)',
      GM: 'General Manager (Engg)',
      CGM: 'Chief General Manager (Engg)',
      DOP: 'Director (Operations)',
      ED: 'Executive Director',
      MD: 'Managing Director',
    };

    await client.query(
      `UPDATE "Users" SET "DesignationTitle" = CASE "Designation"
         WHEN 'Manager' THEN $1 WHEN 'DGM' THEN $2 WHEN 'GM' THEN $3
         WHEN 'CGM' THEN $4 WHEN 'DOP' THEN $5 WHEN 'ED' THEN $6 WHEN 'MD' THEN $7 END
       WHERE "Designation" IN ('Manager','DGM','GM','CGM','DOP','ED','MD')`,
      [titles.Manager, titles.DGM, titles.GM, titles.CGM, titles.DOP, titles.ED, titles.MD]
    );

    await client.query(
      `UPDATE "Users" SET "EmployeeCode" = CASE "Username"
         WHEN 'manager' THEN 'MGR-DEV-001' WHEN 'dgm' THEN 'DGM-DEV-001'
         WHEN 'gm' THEN 'GM-DEV-001' WHEN 'cgm' THEN 'CGM-DEV-001' END
       WHERE "Username" IN ('manager','dgm','gm','cgm')`
    );

    // Sync the active rows of a node to exactly the desired owners, so re-seeding
    // is idempotent: deactivate anyone else, insert any missing owner.
    async function syncNode(table, nodeCol, nodeId, desiredOwners, note, role, nodeType, nodeName) {
      const { rows } = await client.query(
        `SELECT "UserID" FROM ${table} WHERE ${nodeCol} = $1 AND "IsActive" = TRUE`,
        [nodeId]
      );
      const active = rows.map(r => r.UserID);
      for (const uid of active.filter(u => !desiredOwners.includes(u))) {
        await client.query(
          `UPDATE ${table} SET "IsActive" = FALSE, "DeactivatedAt" = now() WHERE ${nodeCol} = $1 AND "UserID" = $2 AND "IsActive" = TRUE`,
          [nodeId, uid]
        );
      }
      for (const uid of desiredOwners.filter(u => !active.includes(u))) {
        await client.query(
          `INSERT INTO ${table} ("UserID", ${nodeCol}, "IsActive", "AssignedBy", "Notes") VALUES ($1,$2,TRUE,$3,$4)`,
          [uid, nodeId, assignedBy, note]
        );
        await client.query(
          `INSERT INTO "AssignmentAudit" ("UserID","Role","Action","OldScope","NewScope","ChangedBy","Notes")
           VALUES ($1,$2,'Create',NULL,$3,$4,$5)`,
          [uid, role, JSON.stringify({ nodeType, nodeId, nodeName }), assignedBy, note]
        );
      }
    }

    // --- Managers (60) -> Circles ---
    for (const [code, name, circleNo] of MANAGERS) {
      const circle = circleByNo[circleNo];
      if (!circle) throw new Error('Circle ' + circleNo + ' not found');
      const username = code.toLowerCase();
      const isDemoCircle = circle.CircleID === circleByNo[1].CircleID;

      let user = (await client.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', [username])).rows[0];
      if (!user) {
        const res = await client.query(
          `INSERT INTO "Users" ("Username","PasswordHash","Name","Designation","DesignationTitle","EmployeeCode",
                                 "RegionID","ZoneID","DivisionID","CircleID","WardID","MobileNumber","Email","IsActive")
           VALUES ($1,$2,$3,'Manager',$4,$5,$6,$7,$8,$9,NULL,$10,$11,TRUE)
           RETURNING "UserID"`,
          [username, hash, name, titles.Manager, code,
           circle.RegionID, circle.ZoneID, circle.DivisionID, circle.CircleID,
           '9' + code.replace('MGR-', '').padStart(9, '0'), username + '@hmwssb.gov.in']
        );
        user = res.rows[0];
      }

      // Demo persona co-hosts circle 1 so the regression suites (which create
      // estimates as demo `manager` in Circle 1) stay green while the mapped
      // officer keeps the documented seat. Demo row is inserted last so the
      // AssignedAt DESC lookups resolve it as primary.
      const owners = isDemoCircle ? [user.UserID, demoManager.UserID] : [user.UserID];
      const note = isDemoCircle
        ? 'Mapped officer with dev demo user co-hosted for regression suites'
        : 'Seeded mapping';
      await syncNode('"ManagerCircleAssignment"', '"CircleID"', circle.CircleID, owners, note, 'Manager', 'Circle', circle.CircleName);
    }

    // --- DGMs (24) -> Divisions ---
    for (const [code, name, divisionNo] of DGMS) {
      const divisionId = divisionByNo[divisionNo];
      if (!divisionId) throw new Error('Division ' + divisionNo + ' not found');
      const username = code.toLowerCase();
      const isDemoDivision = divisionId === divisionByNo[1];

      let user = (await client.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', [username])).rows[0];
      if (!user) {
        const circle = circleByNo[Object.keys(circleByNo).find(k => circleByNo[k].DivisionID === divisionId)];
        const res = await client.query(
          `INSERT INTO "Users" ("Username","PasswordHash","Name","Designation","DesignationTitle","EmployeeCode",
                                 "RegionID","ZoneID","DivisionID","CircleID","WardID","MobileNumber","Email","IsActive")
           VALUES ($1,$2,$3,'DGM',$4,$5,$6,$7,$8,NULL,NULL,$9,$10,TRUE)
           RETURNING "UserID"`,
          [username, hash, name, titles.DGM, code,
           circle.RegionID, circle.ZoneID, circle.DivisionID,
           '9' + code.replace('DGM-', '').padStart(9, '0'), username + '@hmwssb.gov.in']
        );
        user = res.rows[0];
      }

      const owners = isDemoDivision ? [user.UserID, demoDgm.UserID] : [user.UserID];
      const note = isDemoDivision
        ? 'Mapped officer with dev demo user co-hosted for regression suites'
        : 'Seeded mapping';
      await syncNode('"DGMDivisionAssignment"', '"DivisionID"', divisionId, owners, note, 'DGM', 'Division', divisionNameById[divisionId]);
    }

    // --- GM (demo) -> Malkajgiri zone ---
    const malkajgiri = zoneByName['Malkajgiri'];
    if (!malkajgiri) throw new Error('Zone "Malkajgiri" not found');
    await client.query(
      `UPDATE "GMZoneAssignment" SET "IsActive" = FALSE, "DeactivatedAt" = now() WHERE "ZoneID" = $1 AND "IsActive" = TRUE`,
      [malkajgiri]
    );
    await client.query(
      `INSERT INTO "GMZoneAssignment" ("UserID","ZoneID","IsActive","AssignedBy","Notes")
       VALUES ($1,$2,TRUE,$3,'Seeded dev demo GM zone')`,
      [demoGm.UserID, malkajgiri, assignedBy]
    );
    await client.query(
      `INSERT INTO "AssignmentAudit" ("UserID","Role","Action","OldScope","NewScope","ChangedBy","Notes")
       VALUES ($1,'GM','Create',NULL,$2,$3,$4)`,
      [demoGm.UserID, JSON.stringify({ nodeType: 'Zone', nodeId: malkajgiri, nodeName: 'Malkajgiri' }),
       assignedBy, 'Seeded dev demo GM zone']
    );

    // --- CGM (demo) -> MMC corporation ---
    const mmc = regionByName['MMC'];
    if (!mmc) throw new Error('Region "MMC" not found');
    await client.query(
      `UPDATE "CGMCorporationAssignment" SET "IsActive" = FALSE, "DeactivatedAt" = now() WHERE "RegionID" = $1 AND "IsActive" = TRUE`,
      [mmc]
    );
    await client.query(
      `INSERT INTO "CGMCorporationAssignment" ("UserID","RegionID","IsActive","AssignedBy","Notes")
       VALUES ($1,$2,TRUE,$3,'Seeded dev demo CGM corporation')`,
      [demoCgm.UserID, mmc, assignedBy]
    );
    await client.query(
      `INSERT INTO "AssignmentAudit" ("UserID","Role","Action","OldScope","NewScope","ChangedBy","Notes")
       VALUES ($1,'CGM','Create',NULL,$2,$3,$4)`,
      [demoCgm.UserID, JSON.stringify({ nodeType: 'Corporation', nodeId: mmc, nodeName: 'MMC' }),
       assignedBy, 'Seeded dev demo CGM corporation']
    );

    // --- Data integrity checks ---
    const expectCount = async (sql, expected, label) => {
      const { rows } = await client.query(sql);
      if (rows[0].cnt !== expected) {
        throw new Error(`Seed integrity: ${label} expected ${expected}, got ${rows[0].cnt}`);
      }
    };
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "Regions"', 3, 'Regions');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "Zones"', 12, 'Zones');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "Divisions"', 24, 'Divisions');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "Circles"', 60, 'Circles');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "Wards"', 300, 'Wards');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "ManagerCircleAssignment" WHERE "IsActive" = TRUE', 61, 'active manager assignments (60 mapped + demo co-host on Circle 1)');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "DGMDivisionAssignment" WHERE "IsActive" = TRUE', 25, 'active DGM assignments (24 mapped + demo co-host on Division 1)');
    await expectCount('SELECT COUNT(DISTINCT "CircleID")::int AS cnt FROM "ManagerCircleAssignment" WHERE "IsActive" = TRUE', 60, 'distinct circles covered');
    await expectCount('SELECT COUNT(DISTINCT "DivisionID")::int AS cnt FROM "DGMDivisionAssignment" WHERE "IsActive" = TRUE', 24, 'distinct divisions covered');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "GMZoneAssignment" WHERE "IsActive" = TRUE', 1, 'active GM assignments');
    await expectCount('SELECT COUNT(*)::int AS cnt FROM "CGMCorporationAssignment" WHERE "IsActive" = TRUE', 1, 'active CGM assignments');
    await expectCount(`SELECT COUNT(*)::int AS cnt FROM "Users" WHERE "Designation" = 'Manager'`, 61, 'Manager users');
    await expectCount(`SELECT COUNT(*)::int AS cnt FROM "Users" WHERE "Designation" = 'DGM'`, 25, 'DGM users');

    await client.query('COMMIT');
    console.log('Location-scope assignments seeded: 60 managers + 24 DGMs + GM/CGM dev slots, demo users co-hosted on nodes 1.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedScopeAssignments(pool)
    .catch(e => { console.error('Error:', e.message); process.exit(1); })
    .finally(() => pool.end());
}

module.exports = { MANAGERS, DGMS, seedScopeAssignments };