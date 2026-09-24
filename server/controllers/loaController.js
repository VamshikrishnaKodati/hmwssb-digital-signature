// Letter of Award (LOA) — the record of a work award issued after the tender
// reaches `WorkAwarded`. The LOA document is generated entirely from real,
// already-persisted data (tender, estimate, awarded bid, agency/contractor,
// location, dates); it never asks the user to re-enter stored values.
//
// The LOA does NOT advance Tender.Status: the tender stays `WorkAwarded` so the
// Work Order remains the next workflow action (Director's tender.workOrder).
// One LOA per tender is enforced by the UNIQUE TenderID + idempotent insert.
const db = require('../config/db');
const tenderState = require('../utils/tenderState');
const { getPermissions } = require('../middleware/rbac');
const { fetchLocationNames } = require('../utils/locations');
const { numberToWords } = require('../utils/numberToWords');

async function hasPerm(req, key) {
  const perms = (await getPermissions())[req.user.Designation] || new Set();
  return perms.has(key);
}

async function audit(estimateId, userId, action, remarks) {
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
    [estimateId, userId, action, remarks]
  );
}

async function loadEvalTender(req, expectedStatuses) {
  const trow = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
  if (!trow.rows.length) return { error: { status: 404, message: 'Tender not found' } };
  const tender = await tenderState.persistExpiry(trow.rows[0], req.user);
  if (!expectedStatuses.includes(tender.Status))
    return { error: { status: 409, message: `Invalid state. Expected: ${expectedStatuses.join('/')} (current: ${tender.Status})` } };
  return { tender };
}

// Terms on the LOA are data-driven (already-stored tender fields), never
// invented legal wording. A neutral process note keeps the Work Order as the
// next step.
function buildConditions(t) {
  const cond = [];
  if (t.ContractPeriod || t.CompletionPeriod) cond.push(`Completion period: ${t.ContractPeriod || t.CompletionPeriod}.`);
  if (t.DefectLiabilityPeriod) cond.push(`Defect liability period: ${t.DefectLiabilityPeriod}.`);
  if (t.PerformanceSecurity) cond.push(`Performance security: ${t.PerformanceSecurity}.`);
  if (t.EMD) cond.push(`Earnest money deposit (EMD): Rs. ${Number(t.EMD).toLocaleString('en-IN')}.`);
  if (t.BidValidity) cond.push(`Bid validity: ${t.BidValidity} days.`);
  if (t.SpecialConditions) cond.push(`Special conditions: ${t.SpecialConditions}.`);
  cond.push('The Work Order will be issued separately for execution.');
  return cond.join('\n');
}

// Full LOA + every field the document/detail page needs, joined live from the
// persisted award chain so there is exactly one source of truth.
async function fetchLoa(tenderId) {
  const r = await db.query(
    `SELECT l.*, t."TenderNo", t."TenderDate", t."AwardedAt", t."CompletionPeriod",
            t."PerformanceSecurity", t."SpecialConditions", t."ContractPeriod",
            t."DefectLiabilityPeriod", t."WorkOrderNo", t."WorkOrderIssuedAt",
            t."Status" AS "TenderStatus",
            b."FinancialBidAmount",
            c."ContractorName", c."RegistrationNo", c."Phone", c."Email", c."Address",
            eh."EstimateNo", eh."WorkID", eh."NameOfWork", eh."WorkCategory",
            eh."FinancialYear", eh."RegionID", eh."ZoneID",
            eh."DivisionID", eh."CircleID", eh."WardID",
            a."AgencyID", a."TenderValue",
            u."Name" AS "GeneratedByName", u."Designation" AS "GeneratedByDesignation"
     FROM "LetterOfAward" l
     JOIN "Tender" t ON t."TenderID" = l."TenderID"
     JOIN "Bid" b ON b."BidID" = l."BidID"
     JOIN "Contractor" c ON c."ContractorID" = b."ContractorID"
     JOIN "EstimateHeader" eh ON eh."EstimateID" = l."EstimateID"
     LEFT JOIN "Agency" a ON a."AgencyID" = l."AgencyID"
     LEFT JOIN "Users" u ON u."UserID" = l."GeneratedBy"
     WHERE l."TenderID" = $1`,
    [tenderId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  const loc = await fetchLocationNames(row);
  return {
    ...row,
    AwardAmount: Number(row.FinancialBidAmount),
    AwardAmountInWords: numberToWords(Number(row.FinancialBidAmount || 0)),
    locationLine: [loc.region, loc.zone, loc.division, loc.circle, loc.ward].filter(Boolean).join(' / '),
    locNames: loc,
  };
}

exports.getLoaByTender = async (req, res, next) => {
  try {
    const loa = await fetchLoa(req.params.id);
    if (!loa) return res.status(404).json({ error: 'No Letter of Award generated for this tender' });
    res.json(loa);
  } catch (err) { next(err); }
};

exports.generateLoa = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'DirectorOfAdministration' || !(await hasPerm(req, 'tender.workOrder')))
      return res.status(403).json({ error: 'Missing permission: tender.workOrder (Director only)' });

    const { tender, error } = await loadEvalTender(req, ['WorkAwarded']);
    if (error) return res.status(error.status).json({ error: error.message });

    // The awarded bidder already persisted by the Work Award action.
    const winner = (await db.query(
      `SELECT b.*, c."ContractorName" FROM "Bid" b
       JOIN "Contractor" c ON c."ContractorID" = b."ContractorID"
       WHERE b."TenderID" = $1 AND b."IsSelected" = TRUE LIMIT 1`,
      [tender.TenderID]
    )).rows[0];
    if (!winner)
      return res.status(409).json({ error: 'No awarded bidder found for this tender' });

    const agency = (await db.query(
      `SELECT "AgencyID" FROM "Agency" WHERE "TenderID" = $1`, [tender.TenderID]
    )).rows[0] || null;

    const eh = (await db.query(
      `SELECT "FinancialYear" FROM "EstimateHeader" WHERE "EstimateID" = $1`, [tender.EstimateID]
    )).rows[0];
    const fy = (eh && eh.FinancialYear) || `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`;

    // Idempotent + concurrency-safe: the UNIQUE TenderID means a repeated
    // generate/refresh conflicts here and returns the existing LOA untouched.
    const created = (await db.query(
      `INSERT INTO "LetterOfAward"
         ("TenderID","EstimateID","BidID","AgencyID","LOANumber","Status","Conditions","GeneratedBy","GeneratedAt")
       VALUES ($1,$2,$3,$4, 'LOA/' || $5 || '/' || lpad(nextval('loa_number_seq')::text, 6, '0'),
               'Generated', $6, $7, now())
       ON CONFLICT ("TenderID") DO NOTHING
       RETURNING "LOAID"`,
      [tender.TenderID, tender.EstimateID, winner.BidID, agency ? agency.AgencyID : null,
       fy, buildConditions(tender), req.user.UserID]
    )).rows[0];

    const loa = await fetchLoa(tender.TenderID);
    if (!loa) return res.status(500).json({ error: 'Letter of Award could not be loaded' });

    if (!created) {
      return res.json({ ...loa, message: 'Letter of Award already exists (no duplicate generated)' });
    }

    await audit(tender.EstimateID, req.user.UserID, 'LOA_GENERATED',
      `Letter of Award ${loa.LOANumber} generated for tender ${tender.TenderNo} by ${req.user.Name} (${req.user.Designation}) — awarded to ${winner.ContractorName} at INR ${winner.FinancialBidAmount}.`);
    res.status(201).json({ ...loa, message: 'Letter of Award generated' });
  } catch (err) { next(err); }
};

// Captures the first print/download: status Generated → Printed + audit. Only
// flips once; further prints audit again but never change the record.
exports.markPrinted = async (req, res, next) => {
  try {
    const loa = (await db.query(
      `SELECT * FROM "LetterOfAward" WHERE "TenderID" = $1`, [req.params.id]
    )).rows[0];
    if (!loa) return res.status(404).json({ error: 'No Letter of Award for this tender' });

    await db.query(
      `UPDATE "LetterOfAward" SET "Status" = 'Printed', "PrintedAt" = COALESCE("PrintedAt", now()),
        "PrintedBy" = COALESCE("PrintedBy", $1) WHERE "TenderID" = $2`,
      [req.user.UserID, req.params.id]
    );
    await audit(loa.EstimateID, req.user.UserID, 'LOA_PRINTED',
      `Letter of Award ${loa.LOANumber} printed/downloaded by ${req.user.Name} (${req.user.Designation}).`);

    res.json({ message: 'Letter of Award marked as printed', Status: 'Printed' });
  } catch (err) { next(err); }
};