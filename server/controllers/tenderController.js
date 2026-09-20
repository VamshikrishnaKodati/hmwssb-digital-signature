const db = require('../config/db');
const { generateTenderNo } = require('../utils/tenderNo');
const { generateNITPDF } = require('../utils/nitPdfExporter');
const { fetchLocationNames } = require('../utils/locations');
const { getReadyForTender } = require('../utils/tenderReady');
const tenderState = require('../utils/tenderState');
const { startSla, stopSla } = require('../utils/sla');

// Statuses that mean "tender already developed / moving" — an estimate with one
// of these is NOT eligible for a new draft (the officer must open the existing).
const DEVELOPED_STATUSES = ['TenderDraft', 'ReadyForPublication', 'Published', 'BidSubmissionOpen',
  'BidSubmissionClosed', 'TechnicalEvaluation', 'FinancialEvaluation', 'Awarded'];

// Fields the draft workbench may mutate. Everything else in the DB is
// protected (server-set) or read-only (derived from the estimate).
const DRAFT_FIELD_COLS = [
  'TenderType', 'BidStartDate', 'BidEndDate', 'TechnicalBidOpeningDate', 'FinancialBidOpeningDate',
  'CompletionPeriod', 'EMD', 'TenderFee', 'BidValidity', 'EligibilityCriteria', 'RequiredDocuments',
  'PerformanceSecurity', 'SpecialConditions', 'TenderRemarks',
  'TenderCategory', 'TenderInvitingAuthority', 'BidOpeningAuthority', 'EvaluationType',
  'EvaluationCriteria', 'PackageNumber', 'BidCallNumber', 'PreBidMeetingDate',
  'ReferenceNo', 'BiddingType', 'OfficerInvitingBids', 'ScopeOfWork', 'QualificationCriteria',
  'TechnicalRequirements', 'InstructionsToBidders', 'ContractPeriod', 'DefectLiabilityPeriod',
];

exports.listTenders = async (req, res, next) => {
  try {
    const { estimateId, status, createdBy } = req.query;
    const statuses = status ? status.split(',').map(s => s.trim()).filter(Boolean) : null;
    const params = [];
    let where = '';
    if (estimateId) {
      params.push(parseInt(estimateId, 10));
      where = ` WHERE eh."EstimateID" = $${params.length}`;
    }
    if (statuses && statuses.length) {
      params.push(statuses);
      where += where ? ` AND t."Status" = ANY($${params.length})` : ` WHERE t."Status" = ANY($${params.length})`;
    }
    if (createdBy === 'me') {
      params.push(req.user.UserID);
      where += where ? ` AND eh."CreatedBy" = $${params.length}` : ` WHERE eh."CreatedBy" = $${params.length}`;
    }
    const result = await db.query(
      `SELECT t.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."Status" as "EstimateStatus"
       FROM "Tender" t
       JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID"
       ${where}
       ORDER BY t."TenderDate" DESC, t."TenderID" DESC`,
      params
    );
    res.json(result.rows.map(r => ({ ...r, effectiveStatus: tenderState.effectiveStatus(r) })));
  } catch (err) { next(err); }
};

exports.getTender = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."Status" as "EstimateStatus",
              ab."GrandTotal", ea."Name" as "EvaluationAuthorityName"
       FROM "Tender" t
       JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID"
       LEFT JOIN "Abstract" ab ON ab."EstimateID" = t."EstimateID"
       LEFT JOIN "Users" ea ON ea."UserID" = t."EvaluationAuthorityID"
       WHERE t."TenderID" = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tender not found' });
    const row = result.rows[0];
    const caps = await tenderState.capabilities(row, req);
    res.json({ ...row, ...caps, readiness: buildReadiness(row, row) });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Publish — the T3 gate: complete draft + all required documents.     */
/* Snapshot-locks the row (PublishedDate set) and starts the submit SLA.*/
/* ------------------------------------------------------------------ */
const PUBLISHABLE_STATUSES = ['TenderDraft', 'ReadyForPublication'];

exports.publishTender = async (req, res, next) => {
  try {
    const tenderId = req.params.id;

    const tr = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [tenderId]);
    if (!tr.rows.length) return res.status(404).json({ error: 'Tender not found' });
    const tender = tr.rows[0];
    if (!PUBLISHABLE_STATUSES.includes(tender.Status))
      return res.status(409).json({ error: `Tender can only be published from a draft (current: ${tender.Status})` });

    const readiness = buildReadiness(tender, tender);
    const missingDocs = await db.query(
      `SELECT "DocumentName" FROM "TenderDocuments"
       WHERE "TenderID" = $1 AND "Required" = TRUE AND ("FilePath" IS NULL OR "FilePath" = '')`,
      [tenderId]
    );
    const requirements = [
      { key: 'readiness', label: 'All mandatory tender data complete', ok: readiness.passed === readiness.total },
      { key: 'docs', label: 'All required documents uploaded', ok: missingDocs.rows.length === 0 },
      { key: 'dates', label: 'Valid submission window plus opening date', ok: !validateDates(tender) && Boolean(tender.TechnicalBidOpeningDate) },
    ];
    const unmet = requirements.filter(r => !r.ok);
    if (unmet.length)
      return res.status(422).json({
        error: 'Tender cannot be published',
        details: unmet.map(u => u.label),
        readiness,
      });

    let published;
    try {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        published = (await client.query(
          `UPDATE "Tender"
           SET "Status" = 'Published', "PublishedBy" = $1, "PublishedDate" = now(), "Version" = "Version" + 1,
               "UpdatedBy" = $1, "UpdatedAt" = now()
           WHERE "TenderID" = $2 AND "Status" IN ('TenderDraft','ReadyForPublication') RETURNING *`,
          [req.user.UserID, tenderId]
        )).rows[0];
        if (!published) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Tender was already published by another officer' });
        }
        // v2 snapshot preserves the published state as an immutable record.
        await client.query(
          `INSERT INTO "TenderVersion" ("TenderID","Version","Snapshot","CreatedBy") VALUES ($1,$2,$3::jsonb,$4)`,
          [published.TenderID, published.Version, JSON.stringify(published), req.user.UserID]
        );
        await client.query('COMMIT');
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw err;
      } finally {
        try { client.release(); } catch (_) {}
      }
    } catch (err) { return next(err); }

    await audit(tender.EstimateID, req.user.UserID, 'TENDER_PUBLISHED',
      `Tender ${published.TenderNo} published by ${req.user.Name} (${req.user.Designation}). Status: Published (v${published.Version}).`);
    const po = await db.query(
      `SELECT "UserID","Name" FROM "Users" WHERE "Designation" = 'DirectorOfAdministration' AND "IsActive" = TRUE LIMIT 1`
    );
    if (po.rows.length) {
      await db.query(
        `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message")
         VALUES ($1,$2,'TenderPublished',$3)`,
        [tender.EstimateID, po.rows[0].UserID,
         `Tender ${published.TenderNo} published. Bid submission ${published.BidStartDate} → ${published.BidEndDate}.`]
      );
    }
    await startSla('Tender', 'BidSubmission', published.TenderID, 'Tender');

    res.status(200).json({ ...published, readiness: buildReadiness(published, published) });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Close — TenderOfficer ends the submission window early.             */
/* ------------------------------------------------------------------ */
exports.closeTender = async (req, res, next) => {
  try {
    const tenderId = req.params.id;

    const tr = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [tenderId]);
    if (!tr.rows.length) return res.status(404).json({ error: 'Tender not found' });
    const tender = tr.rows[0];

    const updated = (await db.query(
      `UPDATE "Tender" SET "Status" = 'BidsClosed', "BidsClosedAt" = now(), "BidsClosedBy" = $1,
       "UpdatedBy" = $1, "UpdatedAt" = now()
       WHERE "TenderID" = $2 AND "Status" IN ('Published','BidSubmissionOpen') RETURNING *`,
      [req.user.UserID, tenderId]
    )).rows[0];
    if (!updated)
      return res.status(409).json({ error: `Bids are already closed (current: ${tender.Status})` });

    await audit(tender.EstimateID, req.user.UserID, 'BID_SUBMISSION_CLOSED',
      `Tender ${tender.TenderNo} closed for submission by ${req.user.Name}.`);
    await tenderState.notifyOpeningAuthority(tender,
      `Tender ${tender.TenderNo} closed for submission. Bids awaiting opening.`);
    await stopSla(tender.TenderID, 'Tender', 'closed');

    res.json({ ...updated, effectiveStatus: 'BidsClosed' });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Ready-for-tender eligibility (authoritative single source)          */
/* ------------------------------------------------------------------ */
exports.getReadyList = async (req, res, next) => {
  try {
    const rows = await getReadyForTender(req.user.UserID);
    res.json(rows);
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Central master data for the workbench dropdowns                     */
/* ------------------------------------------------------------------ */
exports.getConfig = async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM "TenderConfig" ORDER BY "ConfigKey"');
    const out = {};
    for (const row of r.rows) out[row.ConfigKey] = row.ConfigValues;
    res.json(out);
  } catch (err) { next(err); }
};

function cleanDraftBody(body) {
  const out = {};
  for (const col of DRAFT_FIELD_COLS) {
    if (body[col] !== undefined) out[col] = body[col] === '' ? null : body[col];
  }
  return out;
}

// Pre-Bid < BidStart < BidEnd (submission window) and Opening >= BidEnd.
// Only enforced when the later field has a value.
function validateDates(body) {
  const dt = (v) => (v ? new Date(v) : null);
  const ok = (a, b) => a === null || b === null || a < b;
  const opening = dt(body.TechnicalBidOpeningDate);
  const closing = dt(body.BidEndDate);
  const start = dt(body.BidStartDate);
  const preBid = dt(body.PreBidMeetingDate);

  if (preBid && start && !(preBid < start)) return 'Pre-Bid Meeting must be before Bid Submission Start.';
  if (start && closing && !(start < closing)) return 'Bid Submission Start must be before Bid Submission Closing.';
  if (opening && closing && !(opening >= closing)) return 'Bid Opening must be on or after Bid Submission Closing.';
  if (!ok(preBid, start) || !ok(start, closing)) return 'Timeline must be: Pre-Bid < Start < Closing.';
  return null;
}

async function audit(estimateId, userId, action, remarks) {
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
    [estimateId, userId, action, remarks]
  );
}

async function snapshotVersion(tender, row) {
  await db.query(
    `INSERT INTO "TenderVersion" ("TenderID","Version","Snapshot","CreatedBy")
     VALUES ($1,$2,$3::jsonb,$4)`,
    [tender.TenderID, tender.Version, JSON.stringify(row), tender.CurrentOwner || tender.UpdatedBy || null]
  );
}

function buildReadiness(tender, est) {
  const dateErr = validateDates(tender);
  const checks = [
    { key: 'tenderNo', label: 'Tender No. generated', ok: Boolean(tender.TenderNo) },
    { key: 'value', label: 'Estimated contract value captured', ok: Number(tender.EstimatedCost) > 0 },
    { key: 'dates', label: 'Timeline valid (Pre-Bid < Start < Closing; Opening ≥ Closing)', ok: !dateErr },
    { key: 'opening', label: 'Bid Opening Date set', ok: Boolean(tender.TechnicalBidOpeningDate) },
    { key: 'bidValidity', label: 'Bid validity period set', ok: Number(tender.BidValidity) > 0 },
    { key: 'emd', label: 'EMD / Bid security set', ok: Number(tender.EMD) > 0 },
    { key: 'inviting', label: 'Tender Inviting Authority set', ok: Boolean(String(tender.TenderInvitingAuthority || '').trim()) },
    { key: 'bids', label: 'Officer Inviting Bids set', ok: Boolean(String(tender.OfficerInvitingBids || '').trim()) },
    { key: 'openingAuth', label: 'Bid Opening Authority set', ok: Boolean(String(tender.BidOpeningAuthority || '').trim()) },
    { key: 'category', label: 'Tender Category set', ok: Boolean(String(tender.TenderCategory || '').trim()) },
    { key: 'soW', label: 'Scope of Work provided', ok: Boolean(String(tender.ScopeOfWork || '').trim()) },
    { key: 'eligibility', label: 'Eligibility Criteria provided', ok: Boolean(String(tender.EligibilityCriteria || '').trim()) },
  ];
  return { total: checks.length, passed: checks.filter(c => c.ok).length, checks };
}

/* ------------------------------------------------------------------ */
/* Create / complete the tender draft from a genuinely-ready estimate  */
/* ------------------------------------------------------------------ */
exports.createTender = async (req, res, next) => {
  try {
    const { EstimateID } = req.body;
    if (!EstimateID) return res.status(400).json({ error: 'EstimateID is required' });

    const ready = await getReadyForTender(req.user.UserID);
    const eligible = ready.find(r => r.EstimateID === Number(EstimateID));
    if (!eligible)
      return res.status(400).json({ error: 'Estimate is not eligible for tender creation (must be MD final approved, FCN + Admin Sanction completed, TS approved)' });

    const existing = await db.query('SELECT * FROM "Tender" WHERE "EstimateID" = $1', [EstimateID]);
    if (existing.rows.length && DEVELOPED_STATUSES.includes(existing.rows[0].Status))
      return res.status(409).json({ error: 'A tender already exists for this estimate', TenderID: existing.rows[0].TenderID, TenderStatus: existing.rows[0].Status });

    const now = new Date().toISOString();
    const row = existing.rows[0] || null;
    const fields = cleanDraftBody(req.body);
    const dateErr = validateDates(fields);
    if (dateErr) return res.status(400).json({ error: dateErr });
    // Estimated cost is derived from the approved estimate — never from the form.
    const EstimatedCost = Number(eligible.EstimatedContractValue) || 0;
    const draftData = { ...fields, EstimatedCost };

    let tender;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      if (row) {
        // Auto-created 'Draft' placeholder from MD final approval → complete it.
        const N = DRAFT_FIELD_COLS.length;
        tender = (await client.query(
          `UPDATE "Tender" SET ${DRAFT_FIELD_COLS.map((c, i) => `"${c}" = $${i + 1}`).join(', ')} , "EstimatedCost" = $${N + 1},
           "Status" = 'TenderDraft', "CurrentOwner" = $${N + 2},
           "CreatedBy" = $${N + 3}, "CreatedAt" = $${N + 4},
           "UpdatedBy" = $${N + 5}, "UpdatedAt" = $${N + 6},
           "Version" = 1, "EvaluationAuthorityID" = $${N + 7}
           WHERE "TenderID" = $${N + 8} RETURNING *`,
          [...DRAFT_FIELD_COLS.map(c => draftData[c] ?? null), EstimatedCost, req.user.UserID, req.user.UserID, now, req.user.UserID, now, req.user.UserID, row.TenderID]
        )).rows[0];
      } else {
        const tenderNo = await generateTenderNo(eligible.FinancialYear, client);
        tender = (await client.query(
          `INSERT INTO "Tender" ("EstimateID","TenderNo","TenderDate","EstimatedCost","Status","CurrentOwner","CreatedBy","CreatedAt","UpdatedBy","UpdatedAt","Version","EvaluationAuthorityID",
            ${DRAFT_FIELD_COLS.map(c => `"${c}"`).join(', ')})
           VALUES ($1,$2,CURRENT_DATE,$3,'TenderDraft',$4,$5,$6,$5,$6,1,$7,${DRAFT_FIELD_COLS.map((_, i) => `$${8 + i}`).join(', ')})
           RETURNING *`,
          [EstimateID, tenderNo, EstimatedCost, req.user.UserID, req.user.UserID, now, req.user.UserID, ...DRAFT_FIELD_COLS.map(c => draftData[c] ?? null)]
        )).rows[0];
      }
      // No v1 snapshot: the live row IS v1. Snapshots preserve superseded
      // versions, which only appear from the first update onward.
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      try { client.release(); } catch (_) {}
    }

    await audit(eligible.EstimateID, req.user.UserID, 'TENDER_CREATED',
      `Tender draft ${tender.TenderNo} created by ${req.user.Name} (${req.user.Designation}) for ${eligible.EstimateNo} after TS approval. Status: TenderDraft.`);

    res.status(201).json({ ...tender, readiness: buildReadiness(tender, eligible) });
  } catch (err) { next(err); }
};

exports.updateTender = async (req, res, next) => {
  try {
    const tenderRes = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
    if (!tenderRes.rows.length) return res.status(404).json({ error: 'Tender not found' });
    const tender = tenderRes.rows[0];

    // T3 immutability: a snapshot-published tender (PublishedDate set) is frozen.
    // Legacy tenders published by the old estimate flow (PublishedDate NULL)
    // retain the historical NIT-config edit path so existing flows keep working.
    if (tender.Status !== 'TenderDraft' && tender.PublishedDate)
      return res.status(400).json({ error: 'Published tenders are locked. Edits are not allowed after publication.' });

    // The draft workbench enforces ownership. Legacy tenders (auto-created /
    // published) retain the historical TenderOfficer NIT-config edit path so
    // existing flows keep working; only drafts carry the strict owner lock.
    if (tender.Status === 'TenderDraft' && tender.CurrentOwner !== req.user.UserID)
      return res.status(403).json({ error: 'You are not the current owner of this tender draft' });

    const fields = cleanDraftBody(req.body);
    const dateErr = validateDates(fields);
    if (dateErr) return res.status(400).json({ error: dateErr });

    const sets = [];
    const vals = [];
    let i = 1;
    for (const col of DRAFT_FIELD_COLS) {
      if (fields[col] !== undefined) { sets.push(`"${col}"=$${i++}`); vals.push(fields[col]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    const newVersion = (tender.Version || 1) + 1;
    const isWorkbench = tender.Status === 'TenderDraft' || tender.Status === 'Draft';
    const detachVals = isWorkbench ? [newVersion, req.user.UserID, new Date().toISOString()] : [req.user.UserID, new Date().toISOString()];
    const detachCols = isWorkbench
      ? `, "Version"=$${i++}, "UpdatedBy"=$${i++}, "UpdatedAt"=$${i++}`
      : `, "UpdatedBy"=$${i++}, "UpdatedAt"=$${i++}`;
    const allVals = vals.concat(detachVals, [req.params.id]);

    const client = await db.getClient();
    let updated;
    try {
      await client.query('BEGIN');
      if (isWorkbench) await snapshotVersion(tender, tender);
      updated = (await client.query(
        `UPDATE "Tender" SET ${sets.join(', ')} ${detachCols} WHERE "TenderID"=$${i} RETURNING *`,
        allVals
      )).rows[0];
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      try { client.release(); } catch (_) {}
    }

    if (isWorkbench) {
      await audit(tender.EstimateID, req.user.UserID, 'TENDER_UPDATED',
        `Tender ${tender.TenderNo} draft updated by ${req.user.Name}. Status: ${updated.Status}. Version ${tender.Version} → ${updated.Version}.`);
      await audit(tender.EstimateID, req.user.UserID, 'TENDER_VERSION_CREATED',
        `Version ${updated.Version} recorded for tender ${tender.TenderNo} (${req.user.Name}).`);
    }

    const est = await db.query('SELECT "Status","EstimateNo" FROM "EstimateHeader" WHERE "EstimateID" = $1', [tender.EstimateID]);
    res.json({ ...updated, readiness: buildReadiness(updated, est.rows[0] || {}) });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Preview data — real saved draft, rendered as a notice               */
/* ------------------------------------------------------------------ */
exports.getTenderPreview = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."WorkCategory", eh."FinancialYear",
              eh."RegionID", eh."ZoneID", eh."DivisionID", eh."CircleID", eh."WardID",
              ab."GrandTotal"
       FROM "Tender" t
       JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID"
       LEFT JOIN "Abstract" ab ON ab."EstimateID" = t."EstimateID"
       WHERE t."TenderID" = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tender not found' });

    const docs = await db.query(
      `SELECT "DocumentName","DocumentType","Required","Version","UploadedBy","UploadedAt"
       FROM "TenderDocuments" WHERE "TenderID" = $1 ORDER BY "DocumentID"`,
      [req.params.id]
    );
    const penalty = await db.query('SELECT "SlaDueAt","SlaStatus" FROM "EstimateHeader" WHERE "EstimateID" = $1',
      [result.rows[0].EstimateID]);
    res.json({
      tender: result.rows[0],
      estimate: result.rows[0],
      documents: docs.rows,
      sla: penalty.rows[0] || null,
      readiness: buildReadiness(result.rows[0], result.rows[0]),
    });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Document checklist                                                  */
/* ------------------------------------------------------------------ */
exports.getTenderDocuments = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.*, u."Name" as "UploadedByName"
       FROM "TenderDocuments" d
       LEFT JOIN "Users" u ON u."UserID" = d."UploadedBy"
       WHERE d."TenderID" = $1 ORDER BY d."DocumentID"`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.addTenderDocument = async (req, res, next) => {
  try {
    const tender = await db.query('SELECT * FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
    if (!tender.rows.length) return res.status(404).json({ error: 'Tender not found' });
    if (tender.rows[0].CurrentOwner !== req.user.UserID)
      return res.status(403).json({ error: 'You are not the current owner of this tender' });
    if (tender.rows[0].Status !== 'TenderDraft')
      return res.status(400).json({ error: 'Documents can only be added to a tender draft' });

    const { DocumentName, DocumentType, Required, FilePath } = req.body;
    if (!DocumentName || !String(DocumentName).trim())
      return res.status(400).json({ error: 'DocumentName is required' });

    const result = await db.query(
      `INSERT INTO "TenderDocuments" ("TenderID","DocumentName","DocumentType","FilePath","Required","UploadedBy")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, String(DocumentName).trim(), DocumentType || 'Other', FilePath || null, Boolean(Required), req.user.UserID]
    );
    await audit(tender.rows[0].EstimateID, req.user.UserID, 'TENDER_DOCUMENT_UPLOADED',
      `${DocumentName} (${DocumentType || 'Other'}) added to tender ${tender.rows[0].TenderNo} by ${req.user.Name}.`);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.deleteTenderDocument = async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM "TenderDocuments" WHERE "DocumentID" = $1 AND "TenderID" = $2 RETURNING *`,
      [req.params.docId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* Version history                                                     */
/* ------------------------------------------------------------------ */
exports.getTenderVersions = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT v."VersionID", v."Version", v."CreatedAt", u."Name" as "CreatedByName"
       FROM "TenderVersion" v
       LEFT JOIN "Users" u ON u."UserID" = v."CreatedBy"
       WHERE v."TenderID" = $1 ORDER BY v."Version" DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.deleteTender = async (req, res, next) => {
  try {
    const tender = await db.query('SELECT "Status" FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
    if (!tender.rows.length) return res.status(404).json({ error: 'Tender not found' });
    if (tender.rows[0].Status !== 'TenderDraft')
      return res.status(400).json({ error: 'Only draft tenders can be deleted (published tenders are immutable)' });
    await db.query('DELETE FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* BOQ — Bill of Quantities derived from the approved estimate items   */
/* ------------------------------------------------------------------ */
exports.getBOQ = async (req, res, next) => {
  try {
    const tender = await db.query('SELECT "EstimateID" FROM "Tender" WHERE "TenderID" = $1', [req.params.id]);
    if (!tender.rows.length) return res.status(404).json({ error: 'Tender not found' });

    const result = await db.query(
      `SELECT ed."DetailID", ed."Category", ed."FormulaType", ed."N", ed."L", ed."B", ed."D",
              ed."Qty", ed."Unit", ed."Rate", ed."Amount",
              im."ItemCode", im."Description", im."RateIncludesGST"
       FROM "EstimateDetails" ed
       JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
       WHERE ed."EstimateID" = $1
       ORDER BY ed."Category", ed."DetailID"`,
      [tender.rows[0].EstimateID]
    );
    res.json(result.rows.map((r, idx) => ({ ...r, SNo: idx + 1 })));
  } catch (err) { next(err); }
};

/* ------------------------------------------------------------------ */
/* NIT — Notice Inviting Tender as PDF                                 */
/* ------------------------------------------------------------------ */
exports.generateNIT = async (req, res, next) => {
  try {
    if (!['TenderOfficer', 'DirectorOfAdministration', 'DGM', 'GM', 'Manager'].includes(req.user.Designation))
      return res.status(403).json({ error: 'Not authorized to generate NIT' });

    const t = await db.query(
      `SELECT t.*, eh."WorkID", eh."NameOfWork", eh."WorkCategory", eh."RegionID", eh."ZoneID",
              eh."DivisionID", eh."CircleID", eh."WardID", eh."EstimateNo"
       FROM "Tender" t
       JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID"
       WHERE t."TenderID" = $1`,
      [req.params.id]
    );
    if (!t.rows.length) return res.status(404).json({ error: 'Tender not found' });
    const tender = t.rows[0];

    const abstract = await db.query('SELECT "GrandTotal" FROM "Abstract" WHERE "EstimateID" = $1', [tender.EstimateID]);
    const officer = await db.query('SELECT "Name", "Designation" FROM "Users" WHERE "UserID" = $1', [req.user.UserID]);
    const locNames = await fetchLocationNames(tender);
    const locationLine = [locNames.region, locNames.zone, locNames.division, locNames.circle, locNames.ward].filter(Boolean).join(' / ');

    const buffer = await generateNITPDF({
      tender,
      estimate: tender,
      abstract: abstract.rows[0] || null,
      locNames: locationLine || 'Not specified',
      officer: officer.rows[0] || null,
    });

    const filename = `NIT_${String(tender.TenderNo).replace(/\//g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

exports.DRAFT_FIELD_COLS = DRAFT_FIELD_COLS;