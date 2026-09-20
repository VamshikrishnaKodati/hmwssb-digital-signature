const db = require('../config/db');
const { checkPermission } = require('../middleware/rbac');
const { buildEstimateScope, orderClause, PIPELINE_STAGES } = require('../utils/estimateScope');
const { calcAbstract } = require('../utils/calc');
const { numberToWords } = require('../utils/numberToWords');
const { getLocationChainFromWard, locationInScope, estimateInScope, estimateScopeConds } = require('../services/locationScope');

const WORK_CATEGORIES = ['Water Supply', 'Sewerage', 'EAM'];

// Audit fix C1/C2: in-place edits (items, abstract, header) are only allowed by
// the creator, who must hold the Estimate Edit permission, while the estimate is
// still editable. This mirrors the DB edit-guard trigger but for the endpoints
// that mutate EstimateDetails/Abstract (which the trigger does not cover).
async function editableBy(header, user) {
  if (user.UserID !== header.CreatedBy)
    return { ok: false, error: 'Only the creator can edit this estimate' };
  if (!(await checkPermission(user.Designation, 'estimate.edit')))
    return { ok: false, error: 'You do not have permission to edit estimates' };
  if (!['Draft', 'Reverted'].includes(header.Status))
    return { ok: false, error: `Only Draft or Reverted estimates can be edited (current status: ${header.Status})` };
  return { ok: true };
}

// --- Formula helpers ---
function calcQtyByFormula(formulaType, n, l, b, d) {
  const N = parseFloat(n) || 0;
  const L = parseFloat(l) || 0;
  const B = parseFloat(b) || 0;
  const D = parseFloat(d) || 0;
  switch (formulaType) {
    case 'N': return N;
    case 'L': return L;
    case 'LxB': return L * B;
    case 'LxBxD': return L * B * D;
    case 'NxL': return N * L;
    case 'NxLxBxD': return N * L * B * D;
    default: return 0;
  }
}

function getFormulaFields(formulaType) {
  switch (formulaType) {
    case 'N': return { N: true, L: false, B: false, D: false };
    case 'L': return { N: false, L: true, B: false, D: false };
    case 'LxB': return { N: false, L: true, B: true, D: false };
    case 'LxBxD': return { N: false, L: true, B: true, D: true };
    case 'NxL': return { N: true, L: true, B: false, D: false };
    case 'NxLxBxD': return { N: true, L: true, B: true, D: true };
    default: return { N: true, L: true, B: true, D: true };
  }
}

function getFinancialYear(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 4) return `${y}-${(y + 1).toString().slice(-2)}`;
  return `${y - 1}-${y.toString().slice(-2)}`;
}

function parseWardCode(name, fallbackId) {
  const m = String(name || '').match(/^(\d+)/);
  return (m ? m[1] : String(fallbackId || 0)).padStart(3, '0');
}

// Atomic per-(FinancialYear, WardCode) sequence claim.
// Runs inside the caller's transaction: the UPDATE takes a row lock on the
// (FY, WardCode) counter row, serializing concurrent requests so no two
// estimates ever claim the same number. The counter is never decremented, so
// deleted estimates never cause sequence numbers to be reused.
async function generateEstimateNo(client, wardId, fiscalYear) {
  const fy = /^\d{4}-\d{2}$/.test(fiscalYear || '') ? fiscalYear : getFinancialYear();
  const ward = await client.query('SELECT "Name" FROM "Wards" WHERE "WardID" = $1', [wardId]);
  const wardCode = parseWardCode(ward.rows[0]?.Name, wardId);

  await client.query(
    `INSERT INTO "EstimateSequence" ("FinancialYear","WardCode","LastSequence")
     VALUES ($1,$2,0)
     ON CONFLICT ("FinancialYear","WardCode") DO NOTHING`,
    [fy, wardCode]
  );
  const seq = await client.query(
    `UPDATE "EstimateSequence" SET "LastSequence" = "LastSequence" + 1
     WHERE "FinancialYear" = $1 AND "WardCode" = $2
     RETURNING "LastSequence"`,
    [fy, wardCode]
  );
  const sequence = seq.rows[0].LastSequence;
  return {
    estimateNo: `EST/${fy}/${wardCode}/${String(sequence).padStart(4, '0')}`,
    financialYear: fy,
    wardCode,
    sequence,
  };
}

async function createVersion(estimateId, userId, remarks, changes) {
  const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  if (header.rows.length === 0) return;
  const details = await db.query(
    `SELECT ed.*, im."ItemCode", im."Description"
     FROM "EstimateDetails" ed
     JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
     WHERE ed."EstimateID" = $1 ORDER BY ed."DetailID"`,
    [estimateId]
  );
  const abstract = await db.query('SELECT * FROM "Abstract" WHERE "EstimateID" = $1', [estimateId]);
  const versionData = {
    header: header.rows[0],
    items: details.rows,
    abstract: abstract.rows[0] || null,
  };
  await db.query(
    `INSERT INTO "Versions" ("EstimateID","VersionNumber","Data","CreatedBy","Remarks","Changes")
     VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb)`,
    [estimateId, header.rows[0].Version, JSON.stringify(versionData), userId, remarks || null, JSON.stringify(changes || [])]
  );
}

// --- Version change diff helpers ---
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function numDiff(changes, label, oldV, newV) {
  const o = num(oldV);
  const n = num(newV);
  if (o === n) return;
  changes.push({ field: label, oldValue: o, newValue: n });
}

function fieldDiff(changes, label, oldV, newV) {
  const o = oldV === null || oldV === undefined ? null : String(oldV);
  const n = newV === null || newV === undefined ? null : String(newV);
  if (o === n) return;
  changes.push({ field: label, oldValue: o ?? null, newValue: n ?? null });
}

// Compute the list of field-level changes between a previously saved estimate
// and the newly saved one. Old values come straight from the DB (numeric
// columns are strings), new values from the request payload.
function computeChanges(oldHeader, oldItems, newHeader, newItems) {
  const changes = [];

  fieldDiff(changes, 'Name of Work', oldHeader.NameOfWork, newHeader.NameOfWork);
  fieldDiff(changes, 'Work Category', oldHeader.WorkCategory, newHeader.WorkCategory);
  numDiff(changes, 'GST', oldHeader.GSTPercent, newHeader.GSTPercent);
  numDiff(changes, 'LS Provision', oldHeader.LSProvision, newHeader.LSProvision);

  const loc = (h) => [h.RegionID, h.ZoneID, h.DivisionID, h.CircleID, h.WardID].map(String).join('/');
  if (loc(oldHeader) !== loc(newHeader)) {
    changes.push({
      field: 'Location',
      oldValue: { RegionID: oldHeader.RegionID, WardID: oldHeader.WardID },
      newValue: { RegionID: newHeader.RegionID, WardID: newHeader.WardID },
    });
  }

  const oldById = new Map(oldItems.map(i => [String(i.DetailID), i]));
  const kept = new Set();

  for (const ni of newItems) {
    const oi = oldById.get(String(ni.DetailID));
    if (!oi) {
      changes.push({
        field: 'Item Added',
        oldValue: null,
        newValue: `${ni.ItemCode || ''}${ni.Description ? ` - ${ni.Description}` : ''}`.trim(),
      });
      continue;
    }
    kept.add(String(oi.DetailID));

    fieldDiff(changes, 'Formula', oi.FormulaType, ni.FormulaType);
    ['N', 'L', 'B', 'D'].forEach(k => numDiff(changes, k, oi[k], ni[k]));
    numDiff(changes, 'Quantity',
      calcQtyByFormula(oi.FormulaType, oi.N, oi.L, oi.B, oi.D),
      calcQtyByFormula(ni.FormulaType || oi.FormulaType, ni.N, ni.L, ni.B, ni.D));
    numDiff(changes, 'Rate', oi.Rate, ni.Rate);
    fieldDiff(changes, 'Remarks', oi.Remarks, ni.Remarks);
  }

  for (const oi of oldItems) {
    if (kept.has(String(oi.DetailID))) continue;
    changes.push({
      field: 'Item Removed',
      oldValue: `${oi.ItemCode || ''}${oi.Description ? ` - ${oi.Description}` : ''}`.trim(),
      newValue: null,
    });
  }

  return changes;
}

// --- CRUD ---
exports.createEstimate = async (req, res, next) => {
  try {
    const { NameOfWork, RegionID, ZoneID, DivisionID, CircleID, WardID,
            FinancialYear, WorkCategory, GSTPercent, LSProvision, LSProvisions, AdditionalItems, Items } = req.body;

    if (!NameOfWork) {
      return res.status(400).json({ error: 'NameOfWork is required' });
    }
    if (!WorkCategory || !WORK_CATEGORIES.includes(WorkCategory)) {
      return res.status(400).json({ error: 'WorkCategory must be one of: Water Supply, Sewerage, EAM' });
    }
    if (!WardID) {
      return res.status(400).json({ error: 'Ward is required to generate the Estimate ID' });
    }
    if (FinancialYear && !/^\d{4}-\d{2}$/.test(FinancialYear)) {
      return res.status(400).json({ error: 'FinancialYear must be in YYYY-YY format' });
    }

    // The ward is the source of truth for the full location chain; the client
    // may send Region/Zone/Division/Circle for display, but the chain is
    // always derived from the ward so scope enforcement cannot be bypassed.
    const chain = await getLocationChainFromWard(WardID);
    if (!chain) {
      return res.status(400).json({ error: 'Selected ward is not part of the location hierarchy' });
    }
    if (!(await locationInScope(req.user, chain))) {
      return res.status(403).json({ error: 'Estimates can be created only for wards within your assigned scope' });
    }

    const lsRows = Array.isArray(LSProvisions) ? LSProvisions : [];
    const lsProvisionTotal = Math.round(
      lsRows.reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0) * 100
    ) / 100 || (parseFloat(LSProvision) || 0);

    const additionalRows = Array.isArray(AdditionalItems) ? AdditionalItems : [];

    const client = await db.getClient();
    let estimateId = null;
    try {
      const MAX_ATTEMPTS = 10;
      let claimed = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !estimateId; attempt++) {
        try {
          await client.query('BEGIN');
          claimed = await generateEstimateNo(client, WardID, FinancialYear);
          const { estimateNo, financialYear, wardCode, sequence } = claimed;

          const headerResult = await client.query(
            `INSERT INTO "EstimateHeader"
             ("WorkID","EstimateNo","NameOfWork","FinancialYear","WardCode","Sequence",
              "RegionID","ZoneID","DivisionID","CircleID","WardID",
              "WorkCategory","GSTPercent","LSProvision",
              "Status","Version","CreatedBy","CurrentOwner","LastModifiedBy","LastModifiedDate")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                     'Draft',1,$15,$15,$16,now())
             RETURNING *`,
            [estimateNo, estimateNo, NameOfWork, financialYear, wardCode, sequence,
             chain.RegionID, chain.ZoneID, chain.DivisionID, chain.CircleID, WardID,
             WorkCategory, GSTPercent || 18, lsProvisionTotal,
             req.user.UserID, req.user.UserID]
          );

          estimateId = headerResult.rows[0].EstimateID;

          if (Items && Items.length > 0) {
            for (const item of Items) {
              const qty = calcQtyByFormula(item.FormulaType, item.N, item.L, item.B, item.D);
              const amount = qty * (parseFloat(item.Rate) || 0);
              await client.query(
                `INSERT INTO "EstimateDetails"
                 ("EstimateID","ItemID","Category","FormulaType","N","L","B","D","Qty","Unit","Rate","Amount","Remarks")
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                [estimateId, item.ItemID, item.Category, item.FormulaType,
                 item.N || null, item.L || null, item.B || null, item.D || null,
                 parseFloat(qty.toFixed(3)), item.Unit, parseFloat(item.Rate) || 0,
                 parseFloat(amount.toFixed(2)), item.Remarks || null]
              );
            }
          }

          for (let i = 0; i < lsRows.length; i++) {
            const row = lsRows[i];
            if (!row.Description?.trim() && !(parseFloat(row.Amount) > 0)) continue;
            await client.query(
              `INSERT INTO "EstimateLSProvision" ("EstimateID","Description","Amount","SortOrder")
               VALUES ($1,$2,$3,$4)`,
              [estimateId, row.Description || '', parseFloat(row.Amount) || 0, i]
            );
          }

          for (let i = 0; i < additionalRows.length; i++) {
            const row = additionalRows[i];
            if (!row.Description?.trim() && !(parseFloat(row.Amount) > 0)) continue;
            await client.query(
              `INSERT INTO "EstimateAdditionalItem" ("EstimateID","Description","Amount","SortOrder")
               VALUES ($1,$2,$3,$4)`,
              [estimateId, row.Description || '', parseFloat(row.Amount) || 0, i]
            );
          }

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          if (err.code === '23505' && attempt < MAX_ATTEMPTS && claimed) {
            // The claimed number collides (e.g. a legacy estimate already
            // occupies this slot). Rollback reset the counter, so burn the
            // number with an autonomous increment to guarantee retries move
            // forward instead of reproducing the same collision forever.
            // Upsert: the counter row itself may have been created inside the
            // rolled-back transaction and no longer exists.
            await client.query(
              `INSERT INTO "EstimateSequence" ("FinancialYear","WardCode","LastSequence")
               VALUES ($1,$2,1)
               ON CONFLICT ("FinancialYear","WardCode")
                 DO UPDATE SET "LastSequence" = "EstimateSequence"."LastSequence" + 1`,
              [claimed.financialYear, claimed.wardCode]
            );
            estimateId = null;
            continue;
          }
          throw err;
        }
      }
      if (!estimateId) throw new Error('Could not allocate a unique estimate number');
    } finally {
      client.release();
    }

    // Post-commit work runs on the shared pool AFTER the transaction client is
    // released, so concurrent creates can never exhaust the pool while waiting
    // on their own commit.
    await upsertAbstract(estimateId);
    const full = await getFullEstimate(estimateId);
    await createVersion(estimateId, req.user.UserID, 'Estimate created');
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
};

exports.updateEstimate = async (req, res, next) => {
  try {
    const estimateId = Number(req.params.id);
    if (!Number.isInteger(estimateId) || estimateId <= 0) return res.status(404).json({ error: 'Estimate not found' });
    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });

    const guard = await editableBy(header.rows[0], req.user);
    if (!guard.ok) return res.status(403).json({ error: guard.error });

    const { NameOfWork, RegionID: reqRegionID, ZoneID: reqZoneID, DivisionID: reqDivisionID, CircleID: reqCircleID, WardID,
            WorkCategory, GSTPercent, LSProvision, LSProvisions, AdditionalItems, Items,
            ActionTakenReport } = req.body;
    let RegionID = reqRegionID, ZoneID = reqZoneID, DivisionID = reqDivisionID, CircleID = reqCircleID;

    if (WorkCategory !== undefined && !WORK_CATEGORIES.includes(WorkCategory)) {
      return res.status(400).json({ error: 'WorkCategory must be one of: Water Supply, Sewerage, EAM' });
    }

    // Location edits are reconciled against the ward's chain so the estimate's
    // Region/Zone/Division/Circle can never desync from its ward, and the
    // resulting location stays inside the creator's scope.
    if (RegionID !== undefined || ZoneID !== undefined || DivisionID !== undefined || CircleID !== undefined || WardID !== undefined) {
      const targetWardId = WardID ?? header.rows[0].WardID;
      const chain = await getLocationChainFromWard(targetWardId);
      if (!chain) {
        return res.status(400).json({ error: 'Selected ward is not part of the location hierarchy' });
      }
      for (const [col, val] of Object.entries({ RegionID, ZoneID, DivisionID, CircleID })) {
        if (val !== undefined && Number(val) !== chain[col]) {
          return res.status(400).json({ error: `${col} does not match the ward's location chain` });
        }
      }
      if (!(await locationInScope(req.user, chain))) {
        return res.status(403).json({ error: 'Location is outside your assigned scope' });
      }
      RegionID = chain.RegionID;
      ZoneID = chain.ZoneID;
      DivisionID = chain.DivisionID;
      CircleID = chain.CircleID;
    }

    // Load the pre-save state so the new version can carry a precise change diff.
    // A Reverted estimate stays Reverted until it is resubmitted to the DGM, so
    // the Edit Estimate button remains available while corrections are in progress.
    const oldDetails = await db.query(
      `SELECT ed.*, im."ItemCode", im."Description"
       FROM "EstimateDetails" ed
       JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
       WHERE ed."EstimateID" = $1 ORDER BY ed."DetailID"`,
      [estimateId]
    );

    const newVersion = header.rows[0].Version + 1;

    const fields = [];
    const params = [];
    let idx = 1;

    if (NameOfWork !== undefined) { fields.push(`"NameOfWork" = $${idx++}`); params.push(NameOfWork); }
    if (RegionID !== undefined) { fields.push(`"RegionID" = $${idx++}`); params.push(RegionID); }
    if (ZoneID !== undefined) { fields.push(`"ZoneID" = $${idx++}`); params.push(ZoneID); }
    if (DivisionID !== undefined) { fields.push(`"DivisionID" = $${idx++}`); params.push(DivisionID); }
    if (CircleID !== undefined) { fields.push(`"CircleID" = $${idx++}`); params.push(CircleID); }
    if (WardID !== undefined) { fields.push(`"WardID" = $${idx++}`); params.push(WardID); }
    if (WorkCategory !== undefined) { fields.push(`"WorkCategory" = $${idx++}`); params.push(WorkCategory); }
    if (LSProvisions) {
      const total = Math.round(
        (Array.isArray(LSProvisions) ? LSProvisions : [])
          .reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0) * 100
      ) / 100;
      fields.push(`"LSProvision" = $${idx++}`);
      params.push(total);
    } else if (LSProvision !== undefined) {
      fields.push(`"LSProvision" = $${idx++}`); params.push(LSProvision);
    }
    if (GSTPercent !== undefined) { fields.push(`"GSTPercent" = $${idx++}`); params.push(GSTPercent); }
    if (ActionTakenReport !== undefined) { fields.push(`"ActionTakenReport" = $${idx++}`); params.push(ActionTakenReport || null); }

    // Every edit save advances the version and is recorded in the Versions table.
    fields.push(`"Version" = $${idx++}`);
    params.push(newVersion);

    fields.push(`"LastModifiedBy" = $${idx++}`);
    params.push(req.user.UserID);
    fields.push(`"LastModifiedDate" = now()`);

    if (fields.length > 0) {
      params.push(estimateId);
      await db.query(`UPDATE "EstimateHeader" SET ${fields.join(', ')} WHERE "EstimateID" = $${idx}`, params);
    }

    if (Items) {
      await db.query('DELETE FROM "EstimateDetails" WHERE "EstimateID" = $1', [estimateId]);
      for (const item of Items) {
        const qty = calcQtyByFormula(item.FormulaType, item.N, item.L, item.B, item.D);
        const amount = qty * (parseFloat(item.Rate) || 0);
        await db.query(
          `INSERT INTO "EstimateDetails"
           ("EstimateID","ItemID","Category","FormulaType","N","L","B","D","Qty","Unit","Rate","Amount","Remarks")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [estimateId, item.ItemID, item.Category, item.FormulaType,
           item.N || null, item.L || null, item.B || null, item.D || null,
           parseFloat(qty.toFixed(3)), item.Unit, parseFloat(item.Rate) || 0,
           parseFloat(amount.toFixed(2)), item.Remarks || null]
        );
      }
    }

    if (LSProvisions) {
      const lsArr = Array.isArray(LSProvisions) ? LSProvisions : [];
      await db.query('DELETE FROM "EstimateLSProvision" WHERE "EstimateID" = $1', [estimateId]);
      for (let i = 0; i < lsArr.length; i++) {
        const row = lsArr[i];
        if (!row.Description?.trim() && !(parseFloat(row.Amount) > 0)) continue;
        await db.query(
          `INSERT INTO "EstimateLSProvision" ("EstimateID","Description","Amount","SortOrder")
           VALUES ($1,$2,$3,$4)`,
          [estimateId, row.Description || '', parseFloat(row.Amount) || 0, i]
        );
      }
    }

    if (AdditionalItems) {
      const addArr = Array.isArray(AdditionalItems) ? AdditionalItems : [];
      await db.query('DELETE FROM "EstimateAdditionalItem" WHERE "EstimateID" = $1', [estimateId]);
      for (let i = 0; i < addArr.length; i++) {
        const row = addArr[i];
        if (!row.Description?.trim() && !(parseFloat(row.Amount) > 0)) continue;
        await db.query(
          `INSERT INTO "EstimateAdditionalItem" ("EstimateID","Description","Amount","SortOrder")
           VALUES ($1,$2,$3,$4)`,
          [estimateId, row.Description || '', parseFloat(row.Amount) || 0, i]
        );
      }
    }

    await upsertAbstract(estimateId);
    const full = await getFullEstimate(estimateId);

    // Diff the pre-save state against the submitted payload. The payload carries
    // the original DetailIDs, so added/removed/edited items are matched precisely
    // (the re-inserted DB rows get fresh DetailIDs and cannot be used for diffing).
    let newItemsForDiff = Array.isArray(Items) ? Items : [];
    const diffItemIds = [...new Set(newItemsForDiff.filter(i => i.ItemID).map(i => i.ItemID))];
    if (diffItemIds.length > 0) {
      const metaRes = await db.query(
        'SELECT "ItemID", "ItemCode", "Description" FROM "ItemMaster" WHERE "ItemID" = ANY($1)',
        [diffItemIds]
      );
      const itemMeta = new Map(metaRes.rows.map(r => [String(r.ItemID), r]));
      newItemsForDiff = newItemsForDiff.map(i => ({
        ...i,
        ItemCode: i.ItemCode || itemMeta.get(String(i.ItemID))?.ItemCode,
        Description: i.Description || itemMeta.get(String(i.ItemID))?.Description,
      }));
    }

    const changes = computeChanges(header.rows[0], oldDetails.rows, full, newItemsForDiff);
    await createVersion(estimateId, req.user.UserID, 'Estimate updated', changes);
    res.json(full);
  } catch (err) {
    next(err);
  }
};

async function getFullEstimate(estimateId) {
  const header = await db.query(
    `SELECT eh.*,
       r."Name" AS "RegionName", z."Name" AS "ZoneName",
       d."Name" AS "DivisionName", c."Name" AS "CircleName", w."Name" AS "WardName",
       cb."Name" AS "CompletedByName", sb."Name" AS "StartedByName",
       crb."Name" AS "CreatedByName", crb."Designation" AS "CreatedByDesignation"
     FROM "EstimateHeader" eh
     LEFT JOIN "Regions" r ON r."RegionID" = eh."RegionID"
     LEFT JOIN "Zones" z ON z."ZoneID" = eh."ZoneID"
     LEFT JOIN "Divisions" d ON d."DivisionID" = eh."DivisionID"
     LEFT JOIN "Circles" c ON c."CircleID" = eh."CircleID"
     LEFT JOIN "Wards" w ON w."WardID" = eh."WardID"
     LEFT JOIN "Users" cb ON cb."UserID" = eh."CompletedBy"
     LEFT JOIN "Users" sb ON sb."UserID" = eh."StartedBy"
     LEFT JOIN "Users" crb ON crb."UserID" = eh."CreatedBy"
     WHERE eh."EstimateID" = $1`,
    [estimateId]
  );
  const details = await db.query(
    `SELECT ed.*, im."Description", im."ItemCode"
     FROM "EstimateDetails" ed
     JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
     WHERE ed."EstimateID" = $1
     ORDER BY ed."DetailID"`,
    [estimateId]
  );
  const abstract = await db.query('SELECT * FROM "Abstract" WHERE "EstimateID" = $1', [estimateId]);
  if (abstract.rows[0]) {
    abstract.rows[0].CivilTotalInWords = numberToWords(Number(abstract.rows[0].CivilTotal));
    abstract.rows[0].MaterialTotalInWords = numberToWords(Number(abstract.rows[0].MaterialTotal));
    abstract.rows[0].GrandTotalInWords = numberToWords(Number(abstract.rows[0].GrandTotal));
  }
  const ls = await db.query(
    `SELECT "ID", "Description", "Amount"
     FROM "EstimateLSProvision"
     WHERE "EstimateID" = $1
     ORDER BY "SortOrder", "ID"`,
    [estimateId]
  );
  const additional = await db.query(
    `SELECT "ID", "Description", "Amount"
     FROM "EstimateAdditionalItem"
     WHERE "EstimateID" = $1
     ORDER BY "SortOrder", "ID"`,
    [estimateId]
  );
  const hasMaterial = details.rows.some(d => d.Category === 'Material');
  const agency = await db.query(
    'SELECT * FROM "Agency" WHERE "EstimateID" = $1 ORDER BY "AgencyID" LIMIT 1',
    [estimateId]
  );
  return {
    ...header.rows[0],
    Items: details.rows,
    LSProvisions: ls.rows,
    AdditionalItems: additional.rows,
    Abstract: abstract.rows[0] || null,
    hasMaterial,
    Agency: agency.rows[0] || null,
  };
}

async function upsertAbstract(estimateId, dbc = db) {
  const details = await dbc.query(
    `SELECT ed."Amount", ed."Category"
     FROM "EstimateDetails" ed
     WHERE ed."EstimateID" = $1`,
    [estimateId]
  );

  const header = await dbc.query('SELECT "GSTPercent","LSProvision" FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  const { GSTPercent, LSProvision } = header.rows[0];

  const addRes = await dbc.query(
    'SELECT "Amount" FROM "EstimateAdditionalItem" WHERE "EstimateID" = $1',
    [estimateId]
  );
  let additionalItemsTotal = 0;
  for (const r of addRes.rows) additionalItemsTotal += parseFloat(r.Amount) || 0;

  // General Abstract (per official HMWSSB reference workbook): GST applies to
  // the cost of estimate only (not LS/additional items). Shared calc.Abstract
  // is the single source of truth; the golden test exercises the same numbers.
  const abs = calcAbstract(details.rows, parseFloat(GSTPercent || 0), parseFloat(LSProvision || 0), additionalItemsTotal);

  await dbc.query(
    `INSERT INTO "Abstract" ("EstimateID","CivilTotal","MaterialTotal","CostOfEstimate","Subtotal","GSTPercent","GST","LSProvision","AdditionalItemsTotal","GrandTotal")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("EstimateID")
     DO UPDATE SET "CivilTotal"=$2,"MaterialTotal"=$3,"CostOfEstimate"=$4,"Subtotal"=$5,"GSTPercent"=$6,"GST"=$7,"LSProvision"=$8,"AdditionalItemsTotal"=$9,"GrandTotal"=$10`,
    [estimateId,
     parseFloat(abs.civilTotal.toFixed(2)),
     parseFloat(abs.materialTotal.toFixed(2)),
     parseFloat(abs.costOfEstimate.toFixed(2)),
     parseFloat(abs.subtotal.toFixed(2)),
     parseFloat(GSTPercent || 18),
     parseFloat(abs.gst.toFixed(2)),
     abs.lsProvision,
     abs.additionalItems,
     parseFloat(abs.grandTotal.toFixed(2))]
  );
}

exports.getEstimate = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Estimate not found' });
    const full = await getFullEstimate(id);
    if (!full.EstimateID) return res.status(404).json({ error: 'Estimate not found' });
    if (!(await estimateInScope(req.user, full))) {
      return res.status(403).json({ error: 'This estimate is outside your assigned scope' });
    }
    res.json(full);
  } catch (err) {
    next(err);
  }
};

exports.listEstimates = async (req, res, next) => {
  try {
    const { status, search, dateFrom, dateTo, amountFrom, amountTo, page = 1, limit = 50 } = req.query;
    let sql = `SELECT eh.*, u."Name" as "CreatedByName", COALESCE(ab."GrandTotal",0) as "GrandTotal"
               FROM "EstimateHeader" eh
               LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
               LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"`;
    const params = [];
    const conditions = [];

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      conditions.push(`eh."Status" = ANY($${params.length + 1}::text[])`);
      params.push(statuses);
    }
    if (search) {
      conditions.push(`(eh."EstimateNo" ILIKE $${params.length + 1} OR eh."NameOfWork" ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (dateFrom) {
      conditions.push(`eh."CreatedDate" >= $${params.length + 1}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`eh."CreatedDate" <= $${params.length + 1}`);
      params.push(dateTo);
    }
    if (amountFrom) {
      conditions.push(`COALESCE(ab."GrandTotal",0) >= $${params.length + 1}`);
      params.push(amountFrom);
    }
    if (amountTo) {
      conditions.push(`COALESCE(ab."GrandTotal",0) <= $${params.length + 1}`);
      params.push(amountTo);
    }

    // Location-scope enforcement: non-board-wide roles only see estimates in
    // their assigned circles (or estimates they created).
    const locScope = await estimateScopeConds(req.user, 'eh', params.length + 1);
    conditions.push(...locScope.conds);
    params.push(...locScope.params);

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY eh."CreatedDate" DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getMyEstimates = async (req, res, next) => {
  try {
    const userId = req.user.UserID;
    const { status, search, assignedTo, createdBy, actedBy, action, sort, today, workType, sla, dateFrom, dateTo } = req.query;
    const statuses = status ? status.split(',').map(s => s.trim()).filter(Boolean) : null;
    const actions = actedBy === 'me' && action ? action.split(',').map(a => a.trim()).filter(Boolean) : null;

    // Optional SLA filter (Normal/Warning/Overdue) hitting the persisted
    // SlaStatus column, so dashboard "SLA" chips never hide rows client-side.
    const slaList = sla ? sla.split(',').map(s => s.trim()).filter(Boolean) : null;
    if (slaList) {
      const allowedSla = ['Normal', 'Warning', 'Overdue'];
      const bad = slaList.find(s => !allowedSla.includes(s));
      if (bad) {
        return res.status(400).json({ error: `Invalid SLA filter "${bad}". Valid values: ${allowedSla.join(', ')}` });
      }
    }

    // Optional server-side pagination. When page/pageSize are absent the full
    // row set is returned (legacy contract); the paged shape is
    // { rows, total, page, pageSize }.
    const paged = req.query.page !== undefined || req.query.pageSize !== undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 8));

    if (workType && !WORK_CATEGORIES.includes(workType)) {
      return res.status(400).json({ error: `WorkType must be one of: ${WORK_CATEGORIES.join(', ')}` });
    }

    // Pipeline stage filter ("My Estimate Pipeline / Estimates Currently With").
    // Case-insensitive so /estimates?stage=dgm or stage=draft both work; unknown
    // values are rejected rather than silently ignored so a stale link can't
    // show unfiltered rows.
    let stage = null;
    if (req.query.stage) {
      const raw = String(req.query.stage).trim().toLowerCase();
      stage = PIPELINE_STAGES.find(s => s.toLowerCase() === raw) || null;
      if (!stage) {
        return res.status(400).json({ error: `Invalid pipeline stage "${req.query.stage}". Valid stages: ${PIPELINE_STAGES.join(', ')}` });
      }
    }

    let scope;
    if (req.query.scope === 'global') scope = null;
    else if (assignedTo === 'me' && createdBy === 'me') scope = 'assignedOrCreated';
    else if (assignedTo === 'me') scope = 'assigned';
    else if (createdBy === 'me') scope = 'created';
    else if (actedBy === 'me') scope = null; // acted-by queries span every owner
    // Default: estimates in the user's current scope OR created by them, so the
    // "My Estimates" page is useful for creators (Manager) and reviewers (DGM,
    // GM, CGM, etc.) alike. Reviewer roles don't create estimates, so a pure
    // "created" default returned 0 rows for them.
    else scope = 'assignedOrCreated';

    const { conds, params } = buildEstimateScope({ userId, scope, statuses, actions, search, stage, today: today === 'true' || today === '1' });
    const locScope = await estimateScopeConds(req.user, 'eh', params.length + 1);
    conds.push(...locScope.conds);
    params.push(...locScope.params);

    if (workType) {
      params.push(workType);
      conds.push(`eh."WorkCategory" = $${params.length}`);
    }

    if (slaList) {
      params.push(slaList);
      conds.push(`eh."SlaStatus" = ANY($${params.length})`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      conds.push(`eh."SubmissionDate" >= $${params.length}::timestamptz`);
    }
    if (dateTo) {
      params.push(dateTo);
      conds.push(`eh."SubmissionDate" <= $${params.length}::timestamptz`);
    }

    if (conds.length === 0) {
      return res.json(paged ? { rows: [], total: 0, page, pageSize } : []);
    }

    // The stage predicate reads the current-owner designation via the `ou` alias.
    const ownerJoin = stage ? 'LEFT JOIN "Users" ou ON ou."UserID" = eh."CurrentOwner"' : '';
    const where = conds.join(' AND ');
    const countSql = `SELECT COUNT(*)::int AS "total"
      FROM "EstimateHeader" eh
      ${ownerJoin}
      WHERE ${where}`;
    const rowsSql = `SELECT eh.*, u."Name" as "CreatedByName", COALESCE(ab."GrandTotal",0) as "GrandTotal", c."Name" as "CircleName",
      EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
      FROM "EstimateHeader" eh
      LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
      LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
      LEFT JOIN "Circles" c ON c."CircleID" = eh."CircleID"
      ${ownerJoin}
      WHERE ${where}
      ORDER BY ${orderClause(sort)}`;

    if (!paged) {
      const result = await db.query(rowsSql, params);
      return res.json(result.rows);
    }

    const countRes = await db.query(countSql, params);
    const offset = (page - 1) * pageSize;
    const result = await db.query(
      `${rowsSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );
    res.json({ rows: result.rows, total: countRes.rows[0].total, page, pageSize });
  } catch (err) {
    next(err);
  }
};

exports.recalculateItem = async (req, res, next) => {
  try {
    const { detailId } = req.params;
    const { N, L, B, D } = req.body;

    const detail = await db.query(
      `SELECT ed.*, im."FormulaType" as "ItemFormulaType"
       FROM "EstimateDetails" ed
       JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
       WHERE ed."DetailID" = $1`,
      [detailId]
    );
    if (detail.rows.length === 0) return res.status(404).json({ error: 'Detail not found' });

    const estimateId = detail.rows[0].EstimateID;
    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const guard = await editableBy(header.rows[0], req.user);
    if (!guard.ok) return res.status(403).json({ error: guard.error });

    const formulaType = detail.rows[0].ItemFormulaType;

    const qty = calcQtyByFormula(formulaType, N, L, B, D);
    const rate = parseFloat(detail.rows[0].Rate);
    const amount = qty * rate;

    // Item update + abstract recomputation are one unit so a partial failure
    // cannot leave the detail and its abstract out of sync.
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE "EstimateDetails"
         SET "N"=$1,"L"=$2,"B"=$3,"D"=$4,"Qty"=$5,"Amount"=$6
         WHERE "DetailID"=$7 RETURNING *`,
        [N, L, B, D, parseFloat(qty.toFixed(3)), parseFloat(amount.toFixed(2)), detailId]
      );
      await upsertAbstract(estimateId, client);
      await client.query('COMMIT');
      res.json(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

exports.getVersions = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Estimate not found' });
    const result = await db.query(
      `SELECT v.*, u."Name" as "CreatedByName"
       FROM "Versions" v
       LEFT JOIN "Users" u ON u."UserID" = v."CreatedBy"
       WHERE v."EstimateID" = $1
       ORDER BY v."VersionNumber" DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getFormulaFields = getFormulaFields;
exports.calcQtyByFormula = calcQtyByFormula;
exports.upsertAbstract = upsertAbstract;
exports.getFullEstimate = getFullEstimate;
exports.createVersion = createVersion;
