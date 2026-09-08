const db = require('../config/db');
const tenderState = require('../utils/tenderState');
const { startSla, stopSla } = require('../utils/sla');
const { getPermissions } = require('../middleware/rbac');

const TENDER_STATUSES = ['Draft', 'ReadyForPublication', 'Published', 'BidSubmissionOpen', 'BidSubmissionClosed', 'TechnicalEvaluation', 'FinancialEvaluation', 'Awarded'];

function canManage(req) {
  return ['TenderOfficer', 'DirectorOfAdministration'].includes(req.user.Designation);
}

async function hasPerm(req, key) {
  const perms = (await getPermissions())[req.user.Designation] || new Set();
  return perms.has(key);
}

// Evaluation gate: only the tender's configured Evaluation Authority may evaluate
// financially + identify L1 (brief §13). Call after the tender row is loaded so
// the per-tender assignment is honoured. Legacy NULL authority (pre-043) lets any
// tender.evaluate holder through.
async function isEvalAuthority(req, tender) {
  const perms = (await getPermissions())[req.user.Designation] || new Set();
  return perms.has('tender.evaluate') && tenderState.isEvalAuthority(tender, req);
}

async function audit(estimateId, userId, action, remarks) {
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
    [estimateId, userId, action, remarks]
  );
}

async function fetchBids(tenderId) {
  return (await db.query(
    `SELECT b.*, c."ContractorName", c."RegistrationNo", c."Email", c."Phone",
            t."EstimatedCost",
            (SELECT COUNT(*)::int FROM "BidDocument" d WHERE d."BidID" = b."BidID" AND d."Category" = 'Technical')   AS "TechnicalDocCount",
            (SELECT COUNT(*)::int FROM "BidDocument" d WHERE d."BidID" = b."BidID" AND d."Category" = 'Financial')   AS "FinancialDocCount",
            (SELECT COUNT(*)::int FROM "BidDocument" d WHERE d."BidID" = b."BidID" AND d."Category" = 'EMD')        AS "EmdDocCount",
            (SELECT COUNT(*)::int FROM "BidDocument" d WHERE d."BidID" = b."BidID" AND d."Category" = 'Declaration') AS "DeclarationDocCount"
     FROM "Bid" b
     JOIN "Contractor" c ON c."ContractorID" = b."ContractorID"
     JOIN "Tender" t ON t."TenderID" = b."TenderID"
     WHERE b."TenderID" = $1
     ORDER BY b."BidID"`,
    [tenderId]
  )).rows;
}

/* ------------------------------------------------------------------ */
/* Contractors                                                         */
/* ------------------------------------------------------------------ */
exports.listContractors = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Not authorized' });
    const result = await db.query('SELECT * FROM "Contractor" ORDER BY "ContractorName"');
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.createContractor = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Not authorized' });
    const { ContractorName, RegistrationNo, Email, Phone, Address, ContactDetails } = req.body;
    if (!ContractorName) return res.status(400).json({ error: 'ContractorName is required' });
    const result = await db.query(
      `INSERT INTO "Contractor" ("ContractorName","RegistrationNo","Email","Phone","Address","ContactDetails")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [ContractorName, RegistrationNo, Email, Phone, Address, ContactDetails]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.updateContractor = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Not authorized' });
    const cols = ['ContractorName', 'RegistrationNo', 'Email', 'Phone', 'Address', 'ContactDetails'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const c of cols) {
      if (req.body[c] !== undefined) { sets.push(`"${c}"=$${i++}`); vals.push(req.body[c]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    const result = await db.query(`UPDATE "Contractor" SET ${sets.join(', ')} WHERE "ContractorID"=$${i} RETURNING *`, vals);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Bids                                                                */
/* ------------------------------------------------------------------ */
exports.listBids = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Not authorized' });
    const rows = await fetchBids(req.params.id);
    // Financial content is revealed only to holders of bid.financial.view.
    // Default grant: NO role. Until the financial-evaluation phase ships, the
    // amounts and financial documents stay masked even for bid.open holders.
    const financialVisible = await hasPerm(req, 'bid.financial.view');
    res.json(rows.map(b => financialVisible ? b : { ...b, FinancialBidAmount: null }));
  } catch (err) { next(err); }
};

exports.submitBid = async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Not authorized' });
    if (!(await hasPerm(req, 'bid.submit')))
      return res.status(403).json({ error: 'Missing permission: bid.submit' });

    const tenderId = req.params.id;
    const trow = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [tenderId]);
    if (!trow.rows.length) return res.status(404).json({ error: 'Tender not found' });

    // Server-clock window: persist a time-triggered close BEFORE the status gate,
    // so a bid landing after the closing time is always rejected.
    const tender = await tenderState.persistExpiry(trow.rows[0], req.user);

    const { ContractorID, ContractorName, RegistrationNo, Email, Phone, Address,
      TechnicalBid, FinancialBidAmount, Documents, EMD, Declarations } = req.body;

    if (FinancialBidAmount === undefined || FinancialBidAmount === null || Number(FinancialBidAmount) <= 0)
      return res.status(400).json({ error: 'FinancialBidAmount is required' });

    const eff = tenderState.effectiveStatus(tender);
    if (eff === 'BidsClosed')
      return res.status(400).json({ error: `Bid submission window has closed (closed at ${tender.BidEndDate})` });
    if (!['Published', 'BidSubmissionOpen'].includes(eff))
      return res.status(400).json({
        error: `Bids can only be submitted while the submission window is open (current: ${tender.Status})`,
      });
    const now = new Date();
    if (tender.BidStartDate && now < new Date(tender.BidStartDate))
      return res.status(400).json({ error: `Bid submission opens ${tender.BidStartDate}. Early bids are not accepted.` });

    let contractorId = ContractorID;
    if (!contractorId) {
      if (!ContractorName) return res.status(400).json({ error: 'ContractorName is required' });
      const ins = await db.query(
        `INSERT INTO "Contractor" ("ContractorName","RegistrationNo","Email","Phone","Address")
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [ContractorName, RegistrationNo, Email, Phone, Address]
      );
      contractorId = ins.rows[0].ContractorID;
    } else {
      const exists = await db.query('SELECT 1 FROM "Contractor" WHERE "ContractorID" = $1', [contractorId]);
      if (!exists.rows.length) return res.status(400).json({ error: 'Contractor not found' });
    }

    const dup = await db.query(
      `SELECT "BidID","SubmissionReference" FROM "Bid" WHERE "TenderID" = $1 AND "ContractorID" = $2`,
      [tenderId, contractorId]
    );
    if (dup.rows.length)
      return res.status(409).json({
        error: 'A bid already exists from this contractor for this tender (one submission per bidder).',
        BidID: dup.rows[0].BidID, SubmissionReference: dup.rows[0].SubmissionReference,
      });

    const seq = (await db.query(`SELECT nextval('bid_submission_ref_seq') AS n`)).rows[0].n;
    const ref = `SB-${tenderId}-${String(seq).padStart(6, '0')}`;

    // Documents may be a legacy string blob or a segregated array of
    // {Category, DocumentName, FilePath} rows (Technical/Financial/EMD/Declaration).
    const docs = Array.isArray(Documents) ? Documents : [];

    try {
      const result = await db.query(
        `INSERT INTO "Bid" ("TenderID","ContractorID","TechnicalBid","FinancialBidAmount","Documents","EMD",
                           "SubmissionReference","SubmittedBy","Declarations")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [tenderId, contractorId, TechnicalBid, FinancialBidAmount,
         Array.isArray(Documents) ? null : Documents, EMD, ref, req.user.UserID, Declarations]
      );
      for (const d of docs) {
        await db.query(
          `INSERT INTO "BidDocument" ("BidID","Category","DocumentName","FilePath","UploadedBy")
           VALUES ($1,$2,$3,$4,$5)`,
          [result.rows[0].BidID, d.Category || 'Technical', d.DocumentName, d.FilePath || null, req.user.UserID]
        );
      }

      await audit(tender.EstimateID, req.user.UserID, 'BID_SUBMITTED',
        `Bid ${ref} submitted by ${req.user.Name} (${req.user.Designation}) for tender ${tender.TenderNo} / contractor ${ContractorName || ContractorID}.`);

      const saved = (await db.query(
        `SELECT b.*, c."ContractorName" FROM "Bid" b JOIN "Contractor" c ON c."ContractorID" = b."ContractorID"
         WHERE b."BidID" = $1`, [result.rows[0].BidID]
      )).rows[0];
      return res.status(201).json({ ...saved, documents: docs });
    } catch (err) {
      // Unique (TenderID, ContractorID) race → same contract as the pre-check.
      if (err.code === '23505')
        return res.status(409).json({ error: 'A bid already exists from this contractor for this tender.' });
      throw err;
    }
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Evaluation — TenderOfficer (tender.evaluate), canonical evaluation  */
/* authority, serialized through the Tender.Status machine:            */
/*   TechnicalEvaluationPending → UnderTechnicalEvaluation             */
/*   → FinancialEvaluationPending → FinancialEvaluation → L1Identified */
/* ------------------------------------------------------------------ */

// Serialized state gate: the only writer is this controller, so check-then-act
// without a stored transition guard is acceptable for single-writer flows.
async function loadEvalTender(req, expectedStatuses) {
  const trow = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
  if (!trow.rows.length) return { error: { status: 404, message: 'Tender not found' } };
  const tender = await tenderState.persistExpiry(trow.rows[0], req.user);
  if (!expectedStatuses.includes(tender.Status))
    return { error: { status: 409, message: `Invalid state. Expected: ${expectedStatuses.join('/')} (current: ${tender.Status})` } };
  return { tender };
}

exports.evaluateTechnical = async (req, res, next) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results) || !results.length)
      return res.status(400).json({ error: 'results array is required' });

    const { tender, error } = await loadEvalTender(req, ['TechnicalEvaluationPending', 'UnderTechnicalEvaluation']);
    if (error) return res.status(error.status).json({ error: error.message });
    if (!(await isEvalAuthority(req, tender)))
      return res.status(403).json({ error: 'Only the configured evaluation authority can evaluate this tender' });

    // First batch moves the tender into active evaluation and starts its SLA.
    if (tender.Status === 'TechnicalEvaluationPending') {
      await db.query(
        `UPDATE "Tender" SET "Status" = 'UnderTechnicalEvaluation', "TechnicalEvaluationStartedAt" = now(), "TechnicalEvaluationStartedBy" = $1
         WHERE "TenderID" = $2 AND "Status" = 'TechnicalEvaluationPending'`,
        [req.user.UserID, tender.TenderID]
      );
      await audit(tender.EstimateID, req.user.UserID, 'TECHNICAL_EVALUATION_STARTED',
        `Technical evaluation started by ${req.user.Name} (${req.user.Designation}) for tender ${tender.TenderNo}.`);
      await startSla('Tender', 'TenderEvaluation', tender.TenderID, 'Tender', true);
    }

    const updated = [];
    for (const r of results) {
      if (!r.BidID || r.Qualified === undefined) continue;
      // Structured checklist: any failed criterion forces Disqualified, even if
      // the payload claims qualified (backend is the arbiter, brief §2/§3).
      const checklist = Array.isArray(r.Checklist) ? r.Checklist : null;
      const anyFail = checklist ? checklist.some((c) => c.Passed === false) : false;
      const status = r.Qualified && !anyFail ? 'Qualified' : 'Disqualified';
      const res2 = await db.query(
        `UPDATE "Bid" SET "TechnicalStatus"=$1, "TechnicalRemarks"=$2, "TechnicalChecklist"=$3, "TechnicalEvaluatedBy"=$4, "TechnicalEvaluatedAt"=now()
         WHERE "BidID"=$5 AND "TenderID"=$6 AND "TechnicalStatus"='Pending' RETURNING *`,
        [status, r.Remarks || null, checklist ? JSON.stringify(checklist) : null, req.user.UserID, r.BidID, tender.TenderID]
      );
      if (res2.rows.length) updated.push(res2.rows[0]);
    }

    const remaining = (await db.query(
      `SELECT COUNT(*)::int AS n FROM "Bid" WHERE "TenderID"=$1 AND "TechnicalStatus"='Pending'`,
      [tender.TenderID]
    )).rows[0];
    const done = remaining.n === 0;
    if (done) {
      await db.query(
        `UPDATE "Tender" SET "Status" = 'FinancialEvaluationPending' WHERE "TenderID" = $1`,
        [tender.TenderID]
      );
      await audit(tender.EstimateID, req.user.UserID, 'TECHNICAL_EVALUATION_COMPLETED',
        `Technical evaluation completed for tender ${tender.TenderNo}: ${updated.length} bid(s) evaluated, ${remaining.n} pending. Moved to FinancialEvaluationPending.`);
    }

    res.json({ updated, tenderStatus: done ? 'FinancialEvaluationPending' : 'UnderTechnicalEvaluation', pending: remaining.n });
  } catch (err) { next(err); }
};

exports.evaluateFinancial = async (req, res, next) => {
  try {
    const { tender, error } = await loadEvalTender(req, ['FinancialEvaluationPending']);
    if (error) return res.status(error.status).json({ error: error.message });
    if (!(await isEvalAuthority(req, tender)))
      return res.status(403).json({ error: 'Only the configured evaluation authority can evaluate this tender' });

    const pending = (await db.query(
      `SELECT COUNT(*)::int AS n FROM "Bid" WHERE "TenderID"=$1 AND "TechnicalStatus"='Pending'`,
      [tender.TenderID]
    )).rows[0];
    if (pending.n > 0)
      return res.status(409).json({ error: `${pending.n} bid(s) still pending technical evaluation` });

    // Only technically sound bids enter the financial arena (Qualified on the
    // current pipeline; legacy Eligible rows are honoured). Disqualified bids
    // can never be ranked.
    const bids = (await db.query(
      `SELECT "BidID", "FinancialBidAmount", "TechnicalStatus"
       FROM "Bid" WHERE "TenderID" = $1 AND "TechnicalStatus" IN ('Qualified','Eligible')
       ORDER BY "FinancialBidAmount" ASC, "BidID" ASC`,
      [tender.TenderID]
    )).rows;
    if (!bids.length) return res.status(400).json({ error: 'No technically qualified bids to evaluate financially' });

    const estimateCost = Number(tender.EstimatedCost || 0);
    const remarksByBid = (req.body && req.body.remarks) || {};

    const ranked = bids.map((b, idx) => ({
      BidID: b.BidID,
      Rank: idx + 1,
      FinancialBidAmount: Number(b.FinancialBidAmount),
      PercentageAboveEstimate: estimateCost ? Math.round(((Number(b.FinancialBidAmount) - estimateCost) / estimateCost) * 10000) / 100 : null,
    }));

    for (const r of ranked) {
      await db.query(
        `UPDATE "Bid" SET "Rank"=$1, "FinancialEvaluatedBy"=$2, "FinancialEvaluatedAt"=now(), "FinancialRemarks"=$3 WHERE "BidID"=$4`,
        [r.Rank, req.user.UserID, remarksByBid[r.BidID] || null, r.BidID]
      );
    }
    await db.query(
      `UPDATE "Tender" SET "Status" = 'FinancialEvaluation', "FinancialEvaluationAt" = now(), "FinancialEvaluationBy" = $1 WHERE "TenderID" = $2`,
      [req.user.UserID, tender.TenderID]
    );

    await audit(tender.EstimateID, req.user.UserID, 'FINANCIAL_EVALUATION',
      `Financial evaluation ranked ${ranked.length} qualified bid(s) for tender ${tender.TenderNo}. L1: bid ${ranked[0]?.BidID} (${ranked[0]?.FinancialBidAmount}).`);

    res.json({ ranked, tenderStatus: 'FinancialEvaluation' });
  } catch (err) { next(err); }
};

exports.identifyL1 = async (req, res, next) => {
  try {
    const { tender, error } = await loadEvalTender(req, ['FinancialEvaluation']);
    if (error) return res.status(error.status).json({ error: error.message });
    if (!(await isEvalAuthority(req, tender)))
      return res.status(403).json({ error: 'Only the configured evaluation authority can evaluate this tender' });

    // L1 is the persisted top of the server-computed ranking. Unranked bids can
    // never be picked; award later may only select this exact bid.
    const ranked = (await db.query(
      `SELECT b."BidID", b."Rank", b."FinancialBidAmount", b."TechnicalStatus", c."ContractorName"
       FROM "Bid" b JOIN "Contractor" c ON c."ContractorID" = b."ContractorID"
       WHERE b."TenderID" = $1 AND b."TechnicalStatus" IN ('Qualified','Eligible') AND b."Rank" IS NOT NULL
       ORDER BY b."Rank" ASC`,
      [tender.TenderID]
    )).rows;
    if (!ranked.length) return res.status(400).json({ error: 'No ranked bids to identify as L1' });
    const estimateCost = Number(tender.EstimatedCost || 0);
    const l1 = ranked[0];

    const methodology = (req.body && req.body.methodology) || 'L1_LOWEST_BID';

    const evalRow = (await db.query(
      `INSERT INTO "TenderEvaluation" ("TenderID","Methodology","Ranking","SelectedBidID","IdentifiedBy")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("TenderID") DO UPDATE SET "Methodology"=EXCLUDED."Methodology", "Ranking"=EXCLUDED."Ranking",
         "SelectedBidID"=EXCLUDED."SelectedBidID", "IdentifiedAt"=now(), "IdentifiedBy"=EXCLUDED."IdentifiedBy"
       RETURNING *`,
      [tender.TenderID, methodology,
        JSON.stringify(ranked.map(r => ({ BidID: r.BidID, Rank: r.Rank, FinancialBidAmount: Number(r.FinancialBidAmount), ContractorName: r.ContractorName, PercentageAboveEstimate: estimateCost ? Math.round(((Number(r.FinancialBidAmount) - estimateCost) / estimateCost) * 10000) / 100 : null }))),
        l1.BidID, req.user.UserID]
    )).rows[0];

    await db.query(`UPDATE "Tender" SET "Status" = 'L1Identified' WHERE "TenderID" = $1`, [tender.TenderID]);
    await audit(tender.EstimateID, req.user.UserID, 'L1_IDENTIFIED',
      `L1 identified for tender ${tender.TenderNo}: bid ${l1.BidID} (${l1.ContractorName}, ${l1.FinancialBidAmount}) by ${l1.Rank === 1 ? 'lowest-bid methodology' : methodology}. Moving to award start.`);

    // Evaluation SLA resolved; the award SLA now tracks the Director's action.
    await stopSla(tender.TenderID, 'Tender', 'actioned');
    await startSla('Tender', 'Award', tender.TenderID, 'Tender', true);
    await db.query(
      `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message")
       SELECT $1, "UserID", 'L1Identified', $2 FROM "Users" WHERE "Designation" = 'DirectorOfAdministration' AND "IsActive" = TRUE`,
      [tender.EstimateID, `L1 identified for tender ${tender.TenderNo}: ${l1.ContractorName} (INR ${l1.FinancialBidAmount}). Awaits your award.`]
    );

    res.json({ evaluation: evalRow, l1: { BidID: l1.BidID, ContractorName: l1.ContractorName, FinancialBidAmount: Number(l1.FinancialBidAmount) }, tenderStatus: 'L1Identified' });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Award / Work Order / Agreement — DirectorOfAdministration hands.    */
/* Arbitration is only ever the server-persisted L1, never caller data. */
/* ------------------------------------------------------------------ */
async function loadL1(tenderId) {
  const ev = (await db.query(
    `SELECT * FROM "TenderEvaluation" WHERE "TenderID" = $1`, [tenderId]
  )).rows[0];
  if (!ev) return null;
  const l1 = (await db.query(
    `SELECT b.*, c."ContractorName", c."RegistrationNo" FROM "Bid" b JOIN "Contractor" c ON c."ContractorID" = b."ContractorID"
     WHERE b."BidID" = $1`, [ev.SelectedBidID]
  )).rows[0] || null;
  return { eval: ev, l1 };
}

async function notifyDirector(estimateId, type, message) {
  await db.query(
    `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message")
     SELECT $1, "UserID", $2, $3 FROM "Users" WHERE "Designation" = 'DirectorOfAdministration' AND "IsActive" = TRUE`,
    [estimateId, type, message]
  );
}

async function findSiteEngineer() {
  const r = await db.query(
    `SELECT "UserID","Name","Email" FROM "Users" WHERE "Designation" = 'SiteEngineer' AND "IsActive" IS NOT FALSE ORDER BY "UserID" LIMIT 1`
  );
  return r.rows[0] || null;
}

exports.awardTender = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'DirectorOfAdministration' || !(await hasPerm(req, 'tender.award')))
      return res.status(403).json({ error: 'Missing permission: tender.award (Director only)' });

    const { tender, error } = await loadEvalTender(req, ['L1Identified']);
    if (error) return res.status(error.status).json({ error: error.message });

    const { eval: ev, l1 } = await loadL1(tender.TenderID);
    if (!ev || !l1)
      return res.status(409).json({ error: 'No persisted L1 identified for this tender' });
    const requested = req.body && req.body.BidID;
    if (requested && Number(requested) !== l1.BidID)
      return res.status(400).json({ error: `Award must go to the persisted L1 bid ${l1.BidID}; cannot award another bidder.` });

    await db.query(
      `UPDATE "Bid" SET "IsSelected" = ("BidID" = $1), "Status" = CASE WHEN "BidID" = $1 THEN 'Awarded' ELSE 'Rejected' END
       WHERE "TenderID" = $2 AND "TechnicalStatus" IN ('Qualified','Eligible')`,
      [l1.BidID, tender.TenderID]
    );
    const updated = (await db.query(
      `UPDATE "Tender" SET "Status" = 'WorkAwarded', "AwardedAt" = now(), "AwardedBy" = $1 WHERE "TenderID" = $2 RETURNING *`,
      [req.user.UserID, tender.TenderID]
    )).rows[0];

    // The bidder becomes an Agency only at award time — never before.
    const existingAgency = (await db.query(
      `SELECT "AgencyID" FROM "Agency" WHERE "EstimateID" = $1 AND "TenderID" = $2`, [tender.EstimateID, tender.TenderID]
    )).rows[0];
    let agency = null;
    if (existingAgency) {
      agency = (await db.query(
        `UPDATE "Agency" SET "AgencyName" = $1, "ContractorName" = $1, "TenderValue" = $2
         WHERE "AgencyID" = $3 RETURNING *`,
        [l1.ContractorName, Number(l1.FinancialBidAmount), existingAgency.AgencyID]
      )).rows[0];
    } else {
      agency = (await db.query(
        `INSERT INTO "Agency" ("EstimateID","TenderID","AgencyName","ContractorName","TenderValue")
         VALUES ($1,$2,$3,$3,$4) RETURNING *`,
        [tender.EstimateID, tender.TenderID, l1.ContractorName, Number(l1.FinancialBidAmount)]
      )).rows[0];
    }

    await audit(tender.EstimateID, req.user.UserID, 'AWARD_TENDER',
      `Tender ${tender.TenderNo} awarded by ${req.user.Name} (${req.user.Designation}) to L1 bid ${l1.BidID} / ${l1.ContractorName} at INR ${l1.FinancialBidAmount}. Agency ${agency.AgencyID} ${existingAgency ? 'updated' : 'created'}.`);
    await stopSla(tender.TenderID, 'Tender', 'actioned');

    res.json({ message: 'Tender awarded', winner: l1, agency, tenderStatus: 'WorkAwarded' });
  } catch (err) { next(err); }
};

exports.issueWorkOrder = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'DirectorOfAdministration' || !(await hasPerm(req, 'tender.workOrder')))
      return res.status(403).json({ error: 'Missing permission: tender.workOrder (Director only)' });

    const { tender, error } = await loadEvalTender(req, ['WorkAwarded']);
    if (error) return res.status(error.status).json({ error: error.message });

    const { WorkOrderNo } = req.body || {};
    if (!WorkOrderNo) return res.status(400).json({ error: 'WorkOrderNo is required' });

    const updated = (await db.query(
      `UPDATE "Tender" SET "Status" = 'WorkOrderIssued', "WorkOrderNo" = $1, "WorkOrderIssuedAt" = now(), "WorkOrderIssuedBy" = $2
       WHERE "TenderID" = $3 RETURNING *`,
      [WorkOrderNo, req.user.UserID, tender.TenderID]
    )).rows[0];
    await db.query(
      `UPDATE "Agency" SET "WorkOrderDate" = now() WHERE "EstimateID" = $1 AND "TenderID" = $2`,
      [tender.EstimateID, tender.TenderID]
    );
    await audit(tender.EstimateID, req.user.UserID, 'WORK_ORDER_ISSUED',
      `Work order ${WorkOrderNo} issued for tender ${tender.TenderNo} by ${req.user.Name} (${req.user.Designation}).`);
    await notifyDirector(tender.EstimateID, 'WorkOrderIssued',
      `Work order ${WorkOrderNo} issued for tender ${tender.TenderNo}. Record the agreement.`);

    res.json({ ...updated, tenderStatus: 'WorkOrderIssued' });
  } catch (err) { next(err); }
};

exports.recordAgreement = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'DirectorOfAdministration' || !(await hasPerm(req, 'tender.agreement')))
      return res.status(403).json({ error: 'Missing permission: tender.agreement (Director only)' });

    const { tender, error } = await loadEvalTender(req, ['WorkOrderIssued']);
    if (error) return res.status(error.status).json({ error: error.message });

    const { AgreementNo } = req.body || {};
    if (!AgreementNo) return res.status(400).json({ error: 'AgreementNo is required' });

    // Authoritative tender → execution handoff: the moment the agreement is
    // recorded the linked estimate becomes execution-ready under the
    // SiteEngineer, so no separate legacy selectAgency step is required.
    // Mirrors selectAgency semantics without changing the startWork gate.
    const se = await findSiteEngineer();
    if (!se) return res.status(400).json({ error: 'No SiteEngineer found' });

    let updated;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Idempotent + concurrency-safe: only a WorkOrderIssued tender crosses
      // into executed, so a repeated submission conflicts cleanly and never
      // writes duplicate agency rows, audit entries or workflow rows.
      updated = (await client.query(
        `UPDATE "Tender" SET "Status" = 'AgreementExecuted', "AgreementNo" = $1, "AgreementExecutedAt" = now(), "AgreementExecutedBy" = $2
         WHERE "TenderID" = $3 AND "Status" = 'WorkOrderIssued' RETURNING *`,
        [AgreementNo, req.user.UserID, tender.TenderID]
      )).rows[0];
      if (!updated) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Agreement already executed for this tender' });
      }

      await client.query(
        `UPDATE "Agency" SET "AgreementNo" = $1, "AgreementDate" = now() WHERE "EstimateID" = $2 AND "TenderID" = $3`,
        [AgreementNo, tender.EstimateID, tender.TenderID]
      );

      // Reconcile the linked estimate: AgencySelected under the SiteEngineer.
      // The tender-side chain advances the estimate no further than TSApproved
      // (owner stays with the TS approver), so TSApproved is the primary entry
      // point here. Never regresses an estimate already past that point, and
      // only logs the SelectAgency workflow handoff when this call actually
      // moved it (e.g. a mid-chain legacy selectAgency gets no duplicate row).
      const before = (await client.query(
        `SELECT "Status","CurrentOwner","Version" FROM "EstimateHeader" WHERE "EstimateID" = $1`,
        [tender.EstimateID]
      )).rows[0];
      if (before && ['TSApproved', 'TenderPublished', 'AgencySelected'].includes(before.Status)) {
        // Skip the write when nothing changes: the edit-guard trigger
        // (fn_block_in_place_edit, migration 029) rejects no-op updates of a
        // non-Draft estimate, and a state already reconciled needs no work.
        await client.query(
          `UPDATE "EstimateHeader" SET "Status" = 'AgencySelected', "CurrentOwner" = $2
           WHERE "EstimateID" = $1
             AND ("Status" IS DISTINCT FROM 'AgencySelected' OR "CurrentOwner" IS DISTINCT FROM $2)`,
          [tender.EstimateID, se.UserID]
        );
        if (before.Status !== 'AgencySelected') {
          await client.query(
            `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
             VALUES ($1,$2,$3,'SelectAgency',$4,TRUE,$5)`,
            [tender.EstimateID, req.user.UserID, se.UserID, before.Version,
             `Agency finalised via tender ${tender.TenderNo} agreement ${AgreementNo}; forwarded for execution.`]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await audit(tender.EstimateID, req.user.UserID, 'AGREEMENT_EXECUTED',
      `Agreement ${AgreementNo} recorded for tender ${tender.TenderNo} by ${req.user.Name} (${req.user.Designation}). Estimate reconciled to AgencySelected, forwarded to SiteEngineer for execution.`);
    await stopSla(tender.TenderID, 'Tender', 'actioned');
    await stopSla(tender.EstimateID, 'EstimateHeader', 'actioned');
    await db.query(
      `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message")
       SELECT $1, "UserID", 'AgencySelected',
              'Agreement ' || $2 || ' recorded for tender ' || $3 || '. Work can now start.'
       FROM "Users" WHERE "Designation" = 'SiteEngineer' AND "IsActive" = TRUE`,
      [tender.EstimateID, AgreementNo, tender.TenderNo]
    );

    res.json({ ...updated, tenderStatus: 'AgreementExecuted' });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Bid opening (T3) — TenderOfficer with bid.open (canonical owner)    */
/* ------------------------------------------------------------------ */
async function loadOpeningTender(req, expectedStatus) {
  const trow = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
  if (!trow.rows.length) return { error: { status: 404, message: 'Tender not found' } };
  const tender = await tenderState.persistExpiry(trow.rows[0], req.user);
  if (!expectedStatus.includes(tender.Status))
    return { error: { status: 409, message: `Bid opening requires tender status ${expectedStatus.join('/')} (current: ${tender.Status})` } };
  return { tender };
}

exports.getBidOpening = async (req, res, next) => {
  try {
    if (!(await hasPerm(req, 'bid.view'))) return res.status(403).json({ error: 'Not authorized' });
    const { tender, error } = await loadOpeningTender(req, ['BidsClosed', 'BidOpeningInProgress', 'TechnicalEvaluationPending']);
    if (error) return res.status(error.status).json({ error: error.message });

    const opening = (await db.query(
      `SELECT * FROM "BidOpening" WHERE "TenderID" = $1`, [tender.TenderID]
    )).rows[0] || null;
    const bids = await fetchBids(tender.TenderID);
    const financialVisible = await hasPerm(req, 'bid.financial.view');
    res.json({
      tender: { TenderID: tender.TenderID, TenderNo: tender.TenderNo, BidOpeningAuthority: tender.BidOpeningAuthority },
      bidOpening: opening,
      counts: {
        received: bids.length,
        opened: bids.filter(b => b.OpeningStatus === 'Opened').length,
        notOpened: bids.filter(b => b.OpeningStatus !== 'Opened').length,
      },
      bids: bids.map(b => financialVisible ? b : { ...b, FinancialBidAmount: null }),
    });
  } catch (err) { next(err); }
};

exports.startBidOpening = async (req, res, next) => {
  try {
    if (!(await hasPerm(req, 'bid.open'))) return res.status(403).json({ error: 'Missing permission: bid.open' });
    const { tender, error } = await loadOpeningTender(req, ['BidsClosed']);
    if (error) return res.status(error.status).json({ error: error.message });

    const updated = (await db.query(
      `UPDATE "Tender" SET "Status" = 'BidOpeningInProgress', "BidOpeningStartedAt" = now(), "BidOpeningStartedBy" = $1
       WHERE "TenderID" = $2 AND "Status" = 'BidsClosed' RETURNING *`,
      [req.user.UserID, tender.TenderID]
    )).rows[0];
    if (!updated)
      return res.status(409).json({ error: 'Bid opening already in progress or tender moved' });

    await db.query(
      `INSERT INTO "BidOpening" ("TenderID","OpenedBy","StartedAt","Status")
       VALUES ($1,$2,now(),'InProgress')
       ON CONFLICT ("TenderID") DO UPDATE SET "Status" = 'InProgress'`,
      [tender.TenderID, req.user.UserID]
    );
    await audit(tender.EstimateID, req.user.UserID, 'BID_OPENING_STARTED',
      `Bid opening started by ${req.user.Name} (${req.user.Designation}) for tender ${tender.TenderNo}.`);
    await startSla('Tender', 'BidOpening', tender.TenderID, 'Tender', true);

    res.json({ ...updated, effectiveStatus: 'BidOpeningInProgress' });
  } catch (err) { next(err); }
};

exports.openBid = async (req, res, next) => {
  try {
    if (!(await hasPerm(req, 'bid.open'))) return res.status(403).json({ error: 'Missing permission: bid.open' });

    const bid = (await db.query(
      `SELECT b.*, t."EstimateID", t."TenderNo" FROM "Bid" b JOIN "Tender" t ON t."TenderID" = b."TenderID"
       WHERE b."BidID" = $1`, [req.params.bidId]
    )).rows[0];
    if (!bid) return res.status(404).json({ error: 'Bid not found' });

    const trow = await db.query('SELECT "Status" FROM "Tender" WHERE "TenderID" = $1', [bid.TenderID]);
    if (!trow.rows.length || trow.rows[0].Status !== 'BidOpeningInProgress')
      return res.status(409).json({ error: 'Bids can only be opened after bid opening has started' });
    if (bid.OpeningStatus === 'Opened')
      return res.json({ message: 'Bid already opened (idempotent)', bid, alreadyOpened: true });

    const opened = (await db.query(
      `UPDATE "Bid" SET "OpeningStatus" = 'Opened', "OpenedAt" = now(), "OpenedBy" = $1
       WHERE "BidID" = $2 AND "OpeningStatus" = 'Pending' RETURNING *`,
      [req.user.UserID, req.params.bidId]
    )).rows[0];
    if (!opened)
      return res.status(409).json({ error: 'Bid is no longer pending opening' });

    await audit(bid.EstimateID, req.user.UserID, 'BID_OPENED',
      `Bid ${bid.SubmissionReference || bid.BidID} opened by ${req.user.Name} (${req.user.Designation}) for tender ${bid.TenderNo}.`);
    res.json({ ...opened, message: 'Bid opened' });
  } catch (err) { next(err); }
};

exports.completeBidOpening = async (req, res, next) => {
  try {
    if (!(await hasPerm(req, 'bid.open'))) return res.status(403).json({ error: 'Missing permission: bid.open' });
    const { tender, error } = await loadOpeningTender(req, ['BidOpeningInProgress']);
    if (error) return res.status(error.status).json({ error: error.message });

    const counts = (await db.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "OpeningStatus" = 'Opened')::int AS opened
       FROM "Bid" WHERE "TenderID" = $1`,
      [tender.TenderID]
    )).rows[0];
    if (counts.opened === 0)
      return res.status(422).json({ error: 'Open at least one bid before completing bid opening' });

    const { remarks } = req.body;
    const updated = (await db.query(
      `UPDATE "Tender" SET "Status" = 'TechnicalEvaluationPending', "BidOpeningCompletedAt" = now(), "BidOpeningCompletedBy" = $1
       WHERE "TenderID" = $2 AND "Status" = 'BidOpeningInProgress' RETURNING *`,
      [req.user.UserID, tender.TenderID]
    )).rows[0];
    if (!updated) return res.status(409).json({ error: 'Bid opening already completed' });

    await db.query(
      `UPDATE "BidOpening" SET "Status" = 'Completed', "CompletedAt" = now(), "CompletedBy" = $1, "Remarks" = $2
       WHERE "TenderID" = $3`,
      [req.user.UserID, remarks || null, tender.TenderID]
    );
    await audit(tender.EstimateID, req.user.UserID, 'BID_OPENING_COMPLETED',
      `Bid opening completed by ${req.user.Name}: ${counts.opened} of ${counts.total} bid(s) opened for tender ${tender.TenderNo}.`);
    await audit(tender.EstimateID, req.user.UserID, 'TECHNICAL_EVALUATION_PENDING',
      `Tender ${tender.TenderNo} moved to TechnicalEvaluationPending after bid opening.`);
    await tenderState.notifyOpeningAuthority(tender,
      `Bid opening for tender ${tender.TenderNo} completed (${counts.opened} opened). Awaiting technical evaluation.`);
    await stopSla(tender.TenderID, 'Tender', 'completed');

    res.json({ ...updated, effectiveStatus: 'TechnicalEvaluationPending', counts });
  } catch (err) { next(err); }
};
