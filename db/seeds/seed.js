const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { seedLocations } = require('../../server/seeds/seed-locations');
const { seedScopeAssignments } = require('../../server/seeds/seed-scope');
const { seedSlaData } = require('../../server/seeds/seed-sla');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hmwssb',
});

async function seed() {
  try {
    console.log('Seeding database...');

    // Clear existing data (CASCADE handles FK ordering)
    await pool.query('TRUNCATE "FinanceWorkflow","BillingPayments","Billing","WorkProgressPhotos","WorkProgress","AgencyEvaluation","Agency","Bid","TenderDocuments","Tender","Notification","SignatureOTP","MeasurementBook","Workflow","Abstract","EstimateLSProvision","EstimateAdditionalItem","EstimateDetails","Versions","AuditLog","DeletedEstimates","EstimateHeader","ItemMasterRateHistory","ItemMaster","Users","Wards","Circles","Divisions","Zones","Regions","AssignmentAudit","ManagerCircleAssignment","DGMDivisionAssignment","GMZoneAssignment","CGMCorporationAssignment" RESTART IDENTITY CASCADE');

    // TRUNCATE "Users" CASCADE also wipes SlaDefinition/EscalationRule (FK to Users);
    // migrations never re-run, so restore their defaults here.
    await seedSlaData(pool);

    // Seed hierarchy (full 300-row GHMC location data)
    await seedLocations(pool);

    // Seed users
    const hash = await bcrypt.hash('password123', 10);
    await pool.query(
      `INSERT INTO "Users" ("UserID","Username","PasswordHash","Name","Designation","RegionID","ZoneID","DivisionID","CircleID","WardID","MobileNumber","Email")
       VALUES
       (1,'manager',$1,'Rajesh Kumar','Manager',1,1,1,1,1,'9876543210','manager@hmwssb.gov.in'),
       (2,'dgm',    $1,'Srinivas Reddy','DGM',1,1,1,1,1,'9876543211','dgm@hmwssb.gov.in'),
       (3,'gm',     $1,'Venkatesh Rao','GM',1,1,1,1,1,'9876543212','gm@hmwssb.gov.in'),
       (4,'soradmin',$1,'Anil Sharma','SoRAdmin',1,1,1,1,1,'9876543213','soradmin@hmwssb.gov.in'),
       (5,'tender_officer',$1,'Tender Officer','TenderOfficer',1,1,1,1,1,'9999999981','tender@hmwssb.gov.in'),
       (7,'site_engineer',$1,'Site Engineer','SiteEngineer',1,1,1,1,1,'9999999983','engineer@hmwssb.gov.in'),
       (8,'billing_officer',$1,'Billing Officer','BillingOfficer',1,1,1,1,1,'9999999984','billing@hmwssb.gov.in'),
       (9,'admin_officer',$1,'Administrator','Administrator',1,1,1,1,1,'9999999985','admin@hmwssb.gov.in'),
       (10,'cgm',       $1,'CGM Officer',      'CGM',              1,1,1,1,1,'9999999986','cgm@hmwssb.gov.in'),
       (11,'dop',       $1,'DOP Officer',      'DOP',              1,1,1,1,1,'9999999987','dop@hmwssb.gov.in'),
       (12,'ed',        $1,'ED Officer',        'ED',               1,1,1,1,1,'9999999988','ed@hmwssb.gov.in'),
       (13,'md',        $1,'MD Officer',        'MD',               1,1,1,1,1,'9999999989','md@hmwssb.gov.in'),
       (14,'finance_clerk',$1,'Finance Clerk',    'FinanceClerk',     1,1,1,1,1,'9999999990','finance.clerk@hmwssb.gov.in'),
       (15,'finance_manager',$1,'Finance Manager','FinanceManager',   1,1,1,1,1,'9999999991','finance.manager@hmwssb.gov.in'),
       (16,'finance_head',$1,'Finance Head',      'FinanceHead',      1,1,1,1,1,'9999999992','finance.head@hmwssb.gov.in'),
       (17,'director_admin',$1,'Dr. Priya Nair',   'DirectorOfAdministration',1,1,1,1,1,'9999999993','director.admin@hmwssb.gov.in')`,
      [hash]
    );
    // Advance the serial sequence past the explicitly-inserted IDs so the app
    // can insert users without colliding with the seeded rows.
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('"Users"', 'UserID'), COALESCE((SELECT MAX("UserID") FROM "Users"), 1))`
    );
    console.log('Users seeded');

    // Seed location-scope assignments (60 managers, 24 DGMs, GM/CGM dev slots)
    await seedScopeAssignments(pool);
    console.log('Location-scope assignments seeded');

    // Seed Item Master
    const items = [
      ['EXC-001','Earthwork excavation and depositing on the bank in all types of soils like black cotton soil, red earth and ordinary gravel for foundation of building, GLSR, ELSR and compound walls including all incidental and operational charges etc., complete.','Cum','Civil','LxBxD',false,74.30],
      ['EXC-002','Excavation in Hard rock (blasting prohibited) with benching, chiselling and wedging Foundation of Buildings, GLSRs, ELSRs and Compound walls including all incidental and operational charges etc., complete.','Cum','Civil','LxBxD',false,1510.70],
      ['BARR-HW-001','Bar bending for high wall construction including cutting, bending and binding of reinforcement steel','Cum','Civil','L',false,5896.00],
      ['CI-HW-001','Curing of high wall concrete works with water including all incidental charges','Nos','Civil','N',false,85.00],
      ['DOWEL-001','Drilling of 25mm dia holes up to a depth of 900mm for fixing of dowel bars of 20mm dia and filling the hole with cement slurry','Rmt','Civil','L',false,325.39],
      ['JNT-10IN','10"/250 mm - Jointing CI/DI pipes and valves with flanged ends including bolts, nuts, rubber insertion and white lead.','Nos','Civil','N',false,0],
      ['GSK-4IN','4"/100 mm - Cost of rubber gaskets each as per BIS:5382/85 (rate is inclusive of basic rate, inspection charges @0.3%, GST @18% on (basic rate + inspection charges @0.3%), and storage charges @5%).','Nos','Material','N',true,0],
      ['GSK-6IN','6"/150 mm - Cost of rubber gaskets each as per BIS:5382/85 (rate inclusive of basic rate, inspection charges @0.3%, GST @18% on (basic rate + inspection charges @0.3%), and storage charges @5%).','Nos','Material','N',true,0],
      ['DIP-100MM','Manufacture, Supply and delivery of Centrifugally cast (spun) Ductile Iron pressure pipes for water, Gas and sewage with socket spigot ends confirming to I.S.: 8329/2000 classification K7 100mm Dia','Rmt','Material','L',false,2011.29],
      ['DIP-150MM','Manufacture, Supply and delivery of Centrifugally cast (spun) Ductile Iron pressure pipes for water, Gas and sewage with socket spigot ends confirming to I.S.: 8329/2000 classification K7 150mm Dia','Rmt','Material','L',false,0],
      ['DIP-200MM','Manufacture, Supply and delivery of Centrifugally cast (spun) Ductile Iron pressure pipes for water, Gas and sewage with socket spigot ends confirming to I.S.: 8329/2000 classification K7 200mm Dia','Rmt','Material','L',false,0],
      ['DIP-250MM','Manufacture, Supply and delivery of Centrifugally cast (spun) Ductile Iron pressure pipes for water, Gas and sewage with socket spigot ends confirming to I.S.: 8329/2000 classification K7 250mm Dia','Rmt','Material','L',false,0],
      ['DOWEL-002','Providing and fixing dowel bars of 20mm dia, length 900mm including drilling holes, fixing with cement slurry','Nos','Civil','N',false,0],
      ['CC-001','Providing and laying cement concrete 1:2:4 with 20mm size HBG metal including all charges','Cum','Civil','LxBxD',false,0],
      ['CC-002','Providing and laying cement concrete 1:3:6 with 40mm size HBG metal including all charges','Cum','Civil','LxBxD',false,0],
      ['BRICK-001','Providing and laying brick work with first class bricks in cement mortar 1:6 including all charges','Cum','Civil','LxBxD',false,0],
      ['PLASTER-001','Cement plaster 1:6 on brick work including all charges','Sqm','Civil','LxB',false,0],
      ['REINF-001','Providing and placing reinforcement steel for RCC work including cutting, bending, binding and placing','MT','Civil','NxL',false,0],
      ['FORM-001','Providing and fixing form work for RCC slabs, beams, columns etc.','Sqm','Civil','LxB',false,0],
      ['PAINT-001','Painting with two coats of synthetic enamel paint over a coat of primer on wooden surfaces','Sqm','Civil','LxB',false,0],
      ['PIPE-HDPE-63MM','Manufacture, Supply and delivery of HDPE pipes 63mm Dia','Rmt','Material','L',false,0],
      ['PIPE-HDPE-90MM','Manufacture, Supply and delivery of HDPE pipes 90mm Dia','Rmt','Material','L',false,0],
      ['VALVE-50MM','Gate valve 50mm dia including all fittings','Nos','Material','N',false,0],
      ['VALVE-100MM','Gate valve 100mm dia including all fittings','Nos','Material','N',false,0],
      ['MSADDLE-100MM','M Saddle 100mm x 100mm','Nos','Material','N',false,0],
      ['FERRULE-20MM','Ferrule 20mm dia with CP brass','Nos','Material','N',false,0],
      ['SC-100MM','Sluice valve with spindle 100mm dia','Nos','Material','N',false,0],
      ['AIRVALVE-50MM','Air valve 50mm dia','Nos','Material','N',false,0],
      ['REFILL-001','Refilling of trenches with excavated earth including watering and ramming','Cum','Civil','LxBxD',false,0],
      ['ROADCUT-001','Cutting of road surface (BT/CC) for trenching including restoration','Sqm','Civil','LxB',false,0],
      ['SHORING-001','Providing shoring and strutting to deep trenches','Sqm','Civil','LxB',false,0],
      ['DEWATER-001','Dewatering of trenches including all labour and machinery','Day','Civil','N',false,0],
    ];

    const rateHistory = [];

    // Import the golden test rates for specific items
    // EXC-001 through various items needed for the golden test
    // Civil Estimate items:
    // 1. EXC-001 - Earthwork excavation - Cum - LxBxD - rate 74.30 - N=1 L=1.5 B=1.5 D=1.5
    // 2. EXC-002 - Hard rock excavation - Cum - LxBxD - rate 1510.70 - N=1 L=1.5 B=1.5 D=1.5
    // 3. DOWEL-001 - Drilling dowel holes - Rmt - L - rate 325.39 - N=1 L=1.5
    // 4. CC-001 - CC 1:2:4 - Cum - LxBxD - rate 5236.00
    // 5. BRICK-001 - Brick work - Cum - LxBxD - rate 4562.00
    // 6. PLASTER-001 - Cement plaster - Sqm - LxB - rate 285.00
    // 7. REINF-001 - Reinforcement - MT - NxL - rate 5896.00

    // Material Estimate items:
    // 1. DIP-100MM - DI pipe 100mm - Rmt - L - rate 2011.29
    // 2. VALVE-100MM - Gate valve 100mm - Nos - N - rate 8500.00
    // 3. SC-100MM - Sluice valve - Nos - N - rate 12500.00

    const itemRates = {
      'EXC-001': { rate: 74.30, effectiveFrom: '2024-01-01' },
      'EXC-002': { rate: 1510.70, effectiveFrom: '2024-01-01' },
      'BARR-HW-001': { rate: 5896.00, effectiveFrom: '2024-01-01' },
      'CI-HW-001': { rate: 85.00, effectiveFrom: '2024-01-01' },
      'DOWEL-001': { rate: 325.39, effectiveFrom: '2024-01-01' },
      'DIP-100MM': { rate: 2011.29, effectiveFrom: '2024-01-01' },
      'GSK-4IN': { rate: 185.50, effectiveFrom: '2024-01-01' },
      'GSK-6IN': { rate: 275.00, effectiveFrom: '2024-01-01' },
      'DIP-150MM': { rate: 2850.00, effectiveFrom: '2024-01-01' },
      'DIP-200MM': { rate: 3750.00, effectiveFrom: '2024-01-01' },
      'DIP-250MM': { rate: 4900.00, effectiveFrom: '2024-01-01' },
      'DOWEL-002': { rate: 425.00, effectiveFrom: '2024-01-01' },
      'CC-001': { rate: 5236.00, effectiveFrom: '2024-01-01' },
      'CC-002': { rate: 4125.00, effectiveFrom: '2024-01-01' },
      'BRICK-001': { rate: 4562.00, effectiveFrom: '2024-01-01' },
      'PLASTER-001': { rate: 285.00, effectiveFrom: '2024-01-01' },
      'REINF-001': { rate: 5896.00, effectiveFrom: '2024-01-01' },
      'FORM-001': { rate: 385.00, effectiveFrom: '2024-01-01' },
      'PAINT-001': { rate: 125.00, effectiveFrom: '2024-01-01' },
      'PIPE-HDPE-63MM': { rate: 325.00, effectiveFrom: '2024-01-01' },
      'PIPE-HDPE-90MM': { rate: 485.00, effectiveFrom: '2024-01-01' },
      'VALVE-50MM': { rate: 4500.00, effectiveFrom: '2024-01-01' },
      'VALVE-100MM': { rate: 8500.00, effectiveFrom: '2024-01-01' },
      'MSADDLE-100MM': { rate: 1250.00, effectiveFrom: '2024-01-01' },
      'FERRULE-20MM': { rate: 380.00, effectiveFrom: '2024-01-01' },
      'SC-100MM': { rate: 12500.00, effectiveFrom: '2024-01-01' },
      'AIRVALVE-50MM': { rate: 3200.00, effectiveFrom: '2024-01-01' },
      'REFILL-001': { rate: 45.00, effectiveFrom: '2024-01-01' },
      'ROADCUT-001': { rate: 850.00, effectiveFrom: '2024-01-01' },
      'SHORING-001': { rate: 125.00, effectiveFrom: '2024-01-01' },
      'DEWATER-001': { rate: 2500.00, effectiveFrom: '2024-01-01' },
      'JNT-10IN': { rate: 1250.00, effectiveFrom: '2024-01-01' },
    };

    for (const item of items) {
      const [itemCode, description, unit, category, formulaType, rateIncludesGST, rate] = item;
      const res = await pool.query(
        `INSERT INTO "ItemMaster" ("ItemCode","Description","Unit","Category","FormulaType","RateIncludesGST","IsActive")
         VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING "ItemID"`,
        [itemCode, description, unit, category, formulaType, rateIncludesGST]
      );
      const itemId = res.rows[0].ItemID;

      const rateInfo = itemRates[itemCode];
      if (rateInfo) {
        await pool.query(
          `INSERT INTO "ItemMasterRateHistory" ("ItemID","Rate","EffectiveFrom") VALUES ($1,$2,$3)`,
          [itemId, rateInfo.rate, rateInfo.effectiveFrom]
        );
      }
    }

    console.log(`Seeded ${items.length} items with rates.`);
    console.log('Database seeding completed successfully.');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
