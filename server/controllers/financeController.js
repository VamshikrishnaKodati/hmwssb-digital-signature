const db = require('../config/db');
const { startSla, stopSla } = require('../utils/sla');
const { checkPermission } = require('../middleware/rbac');

const VALID_TRANSITIONS = {
  Inward: 'Verification',
  Verification: 'Recommended',
  Recommended: 'Approved',
  Approved: 'ChequeIssued',
};

const ROLE_ACTIONS = {
  FinanceClerk: ['Inward', 'Verification'],
  FinanceManager: ['Recommended'],
  FinanceHead: ['Approved', 'ChequeIssued'],
};

function canAct(designation, currentStatus) {
  const actions = ROLE_ACTIONS[designation];
  if (!actions) return false;
  return actions.includes(currentStatus);
}

async function financeAuditLog(estimateId, userId, action, remarks) {
  if (!estimateId) return;
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
     VALUES ($1,$2,$3,$4)`,
    [estimateId, userId, action, remarks]
  );
}

async function financeNotify(estimateId, toUserId, type, message) {
  try {
    await db.query(
      `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message")
       VALUES ($1,$2,$3,$4)`,
      [estimateId, toUserId, type, message]
    );
  } catch (_) {}
}

async function financeWorkflowLog(estimateId, fromUserId, toUserId, action, version, remarks) {
  await db.query(
    `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
     VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
    [estimateId, fromUserId, toUserId, action, version || 1, remarks]
  );
}

exports.listFinance = async (req, res, next) => {
  try {
    const { status, billId, estimateId } = req.query;
    const statuses = status ? status.split(',').map(s => s.trim()).filter(Boolean) : null;
    const params = [];
    let where = '';
    if (statuses && statuses.length) {
      params.push(statuses);
      where = ` WHERE fw."Status" = ANY($${params.length})`;
    }
    if (billId) {
      params.push(parseInt(billId, 10));
      where += where ? ` AND fw."BillID" = $${params.length}` : ` WHERE fw."BillID" = $${params.length}`;
    }
    if (estimateId) {
      params.push(parseInt(estimateId, 10));
      where += where ? ` AND fw."EstimateID" = $${params.length}` : ` WHERE fw."EstimateID" = $${params.length}`;
    }
    const result = await db.query(
      `SELECT fw.*,
              b."BillNo", b."BillType", b."NetAmount" as "BillNetAmount",
              eh."EstimateNo", eh."NameOfWork",
              rcv."Name" as "ReceivedByName",
              vrf."Name" as "VerifiedByName",
              rec."Name" as "RecommendedByName",
              appr."Name" as "ApprovedByName"
       FROM "FinanceWorkflow" fw
       JOIN "Billing" b ON b."BillID" = fw."BillID"
       JOIN "EstimateHeader" eh ON eh."EstimateID" = fw."EstimateID"
       LEFT JOIN "Users" rcv ON rcv."UserID" = fw."ReceivedBy"
       LEFT JOIN "Users" vrf ON vrf."UserID" = fw."VerifiedBy"
       LEFT JOIN "Users" rec ON rec."UserID" = fw."RecommendedBy"
       LEFT JOIN "Users" appr ON appr."UserID" = fw."ApprovedBy"
       ${where}
       ORDER BY fw."FinanceID" DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.getFinanceQueue = async (req, res, next) => {
  try {
    const userId = req.user.UserID;
    const designation = req.user.Designation;

    let statuses;
    if (designation === 'FinanceClerk') {
      statuses = ['Inward', 'Verification'];
    } else if (designation === 'FinanceManager') {
      statuses = ['Verification', 'Recommended'];
    } else if (designation === 'FinanceHead') {
      statuses = ['Recommended', 'Approved'];
    } else {
      return res.json([]);
    }

    const result = await db.query(
      `SELECT fw.*,
              b."BillNo", b."BillType", b."NetAmount" as "BillNetAmount",
              eh."EstimateNo", eh."NameOfWork",
              rcv."Name" as "ReceivedByName",
              vrf."Name" as "VerifiedByName",
              rec."Name" as "RecommendedByName"
       FROM "FinanceWorkflow" fw
       JOIN "Billing" b ON b."BillID" = fw."BillID"
       JOIN "EstimateHeader" eh ON eh."EstimateID" = fw."EstimateID"
       LEFT JOIN "Users" rcv ON rcv."UserID" = fw."ReceivedBy"
       LEFT JOIN "Users" vrf ON vrf."UserID" = fw."VerifiedBy"
       LEFT JOIN "Users" rec ON rec."UserID" = fw."RecommendedBy"
       WHERE fw."Status" = ANY($1)
       ORDER BY fw."CreatedDate" ASC`,
      [statuses]
    );

    // Bills waiting for inward (forwarded by GM) belong to the clerk's desk
    // even though they have no FinanceWorkflow row yet.
    if (designation === 'FinanceClerk') {
      const awaiting = (await db.query(
        `SELECT b."BillID", b."NetAmount", b."BillNo", b."BillType", b."EstimateID",
                eh."EstimateNo", eh."NameOfWork"
         FROM "Billing" b
         JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
         LEFT JOIN "FinanceWorkflow" fw ON fw."BillID" = b."BillID"
         WHERE b."Status" = 'SubmittedToFinance' AND fw."FinanceID" IS NULL
         ORDER BY b."BillID" ASC`
      )).rows;
      const awaitingRows = awaiting.map(a => ({
        FinanceID: null, BillID: a.BillID, EstimateID: a.EstimateID,
        BillNo: a.BillNo, BillType: a.BillType, BillNetAmount: a.NetAmount, Amount: a.NetAmount,
        EstimateNo: a.EstimateNo, NameOfWork: a.NameOfWork,
        Status: 'SubmittedToFinance', ReceivedByName: null, VerifiedByName: null, RecommendedByName: null,
      }));
      result.rows = [...awaitingRows, ...result.rows];
    }
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.listAwaitingInward = async (req, res, next) => {
  try {
    if (!['FinanceClerk', 'FinanceManager', 'FinanceHead'].includes(req.user.Designation))
      return res.json([]);
    const rows = (await db.query(
      `SELECT b."BillID", b."BillNo", b."BillType", b."BillAmount", b."GST", b."NetAmount",
              b."Status" as "BillingStatus", b."SubmissionDate",
              eh."EstimateID", eh."EstimateNo", eh."NameOfWork",
              u."Name" as "SubmittedByName"
       FROM "Billing" b
       JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
       LEFT JOIN "FinanceWorkflow" fw ON fw."BillID" = b."BillID"
       LEFT JOIN "Users" u ON u."UserID" = b."SubmittedBy"
       WHERE b."Status" = 'SubmittedToFinance' AND fw."FinanceID" IS NULL
       ORDER BY b."BillID" ASC`
    )).rows;
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createInward = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'FinanceClerk')
      return res.status(403).json({ error: 'Only FinanceClerk can create inward records' });

    const { BillID, InwardNumber, Remarks } = req.body;
    if (!BillID) return res.status(400).json({ error: 'BillID is required' });

    const bill = await db.query(
      `SELECT b.*, eh."EstimateID" FROM "Billing" b
       JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
       WHERE b."BillID" = $1`, [BillID]
    );
    if (!bill.rows.length) return res.status(404).json({ error: 'Bill not found' });
    const b = bill.rows[0];

    if (b.Status !== 'SubmittedToFinance')
      return res.status(400).json({ error: `Bill must be forwarded by GM (With Finance) before inward. Current status: ${b.Status}.` });

    const existing = await db.query(
      'SELECT "FinanceID" FROM "FinanceWorkflow" WHERE "BillID" = $1', [BillID]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'Finance record already exists for this bill' });

    const result = await db.query(
      `INSERT INTO "FinanceWorkflow"
       ("BillID","EstimateID","InwardNumber","InwardDate","ReceivedBy","Amount","Status","CurrentOwner","Remarks")
       VALUES ($1,$2,$3,now(),$4,$5,'Inward',$4,$6) RETURNING *`,
      [BillID, b.EstimateID, InwardNumber || null, req.user.UserID, b.NetAmount, Remarks || null]
    );

    const fw = result.rows[0];
    await financeAuditLog(fw.EstimateID, req.user.UserID, 'FinanceInward',
      `Finance inward created for bill ${b.BillNo || BillID}. Inward: ${InwardNumber || 'N/A'}.`);
    await financeWorkflowLog(fw.EstimateID, req.user.UserID, req.user.UserID, 'FinanceInward', 1,
      `Bill inwarded by Finance Clerk. Inward: ${InwardNumber || 'N/A'}`);

    // Start SLA for Inward stage
    await startSla('Finance', 'Inward', fw.FinanceID, 'FinanceWorkflow');

    res.status(201).json(fw);
  } catch (err) { next(err); }
};

exports.verifyFinance = async (req, res, next) => {
  try {
    const designation = req.user.Designation;
    if (designation !== 'FinanceClerk' && designation !== 'FinanceManager')
      return res.status(403).json({ error: 'Only FinanceClerk or FinanceManager can verify' });

    const { id } = req.params;
    const { Remarks } = req.body;

    const fw = await db.query('SELECT * FROM "FinanceWorkflow" WHERE "FinanceID" = $1', [id]);
    if (!fw.rows.length) return res.status(404).json({ error: 'Finance record not found' });
    const f = fw.rows[0];

    if (f.Status !== 'Inward')
      return res.status(409).json({ error: `Cannot verify. Current status: ${f.Status}` });
    if (!canAct(designation, f.Status))
      return res.status(403).json({ error: `${designation} cannot verify at this stage` });

    const result = await db.query(
      `UPDATE "FinanceWorkflow"
       SET "VerifiedBy" = $1, "VerifiedDate" = now(), "Status" = 'Verification',
           "UpdatedDate" = now(), "Remarks" = COALESCE($2, "Remarks")
       WHERE "FinanceID" = $3 RETURNING *`,
      [req.user.UserID, Remarks || null, id]
    );

    await financeAuditLog(f.EstimateID, req.user.UserID, 'FinanceVerified',
      `Bill verified by ${designation} (${req.user.Name}). Status: Inward → Verification.`);

    // Stop Inward SLA, start Verification SLA
    await stopSla(id, 'FinanceWorkflow', 'actioned');
    await startSla('Finance', 'Verification', id, 'FinanceWorkflow');

    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.recommendFinance = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'FinanceManager')
      return res.status(403).json({ error: 'Only FinanceManager can recommend' });

    const { id } = req.params;
    const { Remarks } = req.body;

    const fw = await db.query('SELECT * FROM "FinanceWorkflow" WHERE "FinanceID" = $1', [id]);
    if (!fw.rows.length) return res.status(404).json({ error: 'Finance record not found' });
    const f = fw.rows[0];

    if (f.Status !== 'Verification')
      return res.status(409).json({ error: `Cannot recommend. Current status: ${f.Status}. Bill must be verified first.` });

    const financeHead = await db.query(
      `SELECT "UserID" FROM "Users" WHERE "Designation" = 'FinanceHead' LIMIT 1`
    );
    const headUserId = financeHead.rows[0]?.UserID;
    if (!headUserId) return res.status(400).json({ error: 'No FinanceHead user found in system' });

    const result = await db.query(
      `UPDATE "FinanceWorkflow"
       SET "RecommendedBy" = $1, "RecommendedDate" = now(), "Status" = 'Recommended',
           "CurrentOwner" = $2, "UpdatedDate" = now(), "Remarks" = COALESCE($3, "Remarks")
       WHERE "FinanceID" = $4 RETURNING *`,
      [req.user.UserID, headUserId, Remarks || null, id]
    );

    await financeAuditLog(f.EstimateID, req.user.UserID, 'FinanceRecommended',
      `Bill recommended by FinanceManager (${req.user.Name}). Forwarded to FinanceHead.`);
    await financeWorkflowLog(f.EstimateID, req.user.UserID, headUserId, 'FinanceRecommended', 1,
      `Finance recommended. Forwarded to FinanceHead for approval.`);

    // Stop Verification SLA, start Recommended SLA
    await stopSla(id, 'FinanceWorkflow', 'actioned');
    await startSla('Finance', 'Recommended', id, 'FinanceWorkflow');

    const bill = await db.query('SELECT "BillNo" FROM "Billing" WHERE "BillID" = $1', [f.BillID]);
    await financeNotify(f.EstimateID, headUserId, 'FinanceRecommended',
      `Bill ${bill.rows[0]?.BillNo || f.BillID} recommended by Finance Manager. Awaiting your approval.`);

    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.approveFinance = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'finance.approve')))
      return res.status(403).json({ error: 'You do not have permission to approve finance' });

    const { id } = req.params;
    const { Remarks } = req.body;

    const fw = await db.query('SELECT * FROM "FinanceWorkflow" WHERE "FinanceID" = $1', [id]);
    if (!fw.rows.length) return res.status(404).json({ error: 'Finance record not found' });
    const f = fw.rows[0];

    if (f.Status !== 'Recommended')
      return res.status(409).json({ error: `Cannot approve. Current status: ${f.Status}. Bill must be recommended first.` });

    const result = await db.query(
      `UPDATE "FinanceWorkflow"
       SET "ApprovedBy" = $1, "ApprovedDate" = now(), "Status" = 'Approved',
           "CurrentOwner" = $1, "UpdatedDate" = now(), "Remarks" = COALESCE($2, "Remarks")
       WHERE "FinanceID" = $3 RETURNING *`,
      [req.user.UserID, Remarks || null, id]
    );

    await financeAuditLog(f.EstimateID, req.user.UserID, 'FinanceApproved',
      `Bill approved by FinanceHead (${req.user.Name}). Ready for cheque issuance.`);
    await financeWorkflowLog(f.EstimateID, req.user.UserID, req.user.UserID, 'FinanceApproved', 1,
      `Finance approved by FinanceHead. Ready for cheque issuance.`);

    // Stop Recommended SLA, start Approved SLA
    await stopSla(id, 'FinanceWorkflow', 'actioned');
    await startSla('Finance', 'Approved', id, 'FinanceWorkflow');

    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.issueCheque = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'finance.cheque')))
      return res.status(403).json({ error: 'You do not have permission to issue cheque' });

    const { id } = req.params;
    const { ChequeNumber, ChequeDate, Remarks } = req.body;

    if (!ChequeNumber) return res.status(400).json({ error: 'ChequeNumber is required' });

    const fw = await db.query('SELECT * FROM "FinanceWorkflow" WHERE "FinanceID" = $1', [id]);
    if (!fw.rows.length) return res.status(404).json({ error: 'Finance record not found' });
    const f = fw.rows[0];

    if (f.Status !== 'Approved')
      return res.status(409).json({ error: `Cannot issue cheque. Current status: ${f.Status}. Bill must be approved first.` });

    const result = await db.query(
      `UPDATE "FinanceWorkflow"
       SET "ChequeNumber" = $1, "ChequeDate" = $2, "Status" = 'ChequeIssued',
           "UpdatedDate" = now(), "Remarks" = COALESCE($3, "Remarks")
       WHERE "FinanceID" = $4 RETURNING *`,
      [ChequeNumber, ChequeDate || new Date().toISOString().slice(0, 10), Remarks || null, id]
    );

    await db.query(
      `INSERT INTO "BillingPayments" ("BillID","PaymentAmount","PaymentDate","PaymentMode","TransactionRef","Remarks")
       VALUES ($1,$2,now(),'Cheque',$3,$4)`,
      [f.BillID, f.Amount, ChequeNumber, `Cheque ${ChequeNumber} issued via Finance workflow`]
    );

    await db.query(
      `UPDATE "Billing" SET "Status" = 'Paid', "CurrentStep" = 'Paid',
       "ApprovedAmount" = "NetAmount" WHERE "BillID" = $1`,
      [f.BillID]
    );

    await financeAuditLog(f.EstimateID, req.user.UserID, 'ChequeIssued',
      `Cheque ${ChequeNumber} issued by FinanceHead (${req.user.Name}). Amount: ${f.Amount}. Bill marked as Paid.`);
    await financeWorkflowLog(f.EstimateID, req.user.UserID, req.user.UserID, 'ChequeIssued', 1,
      `Cheque ${ChequeNumber} issued. Finance workflow complete.`);

    // Stop Approved SLA — finance workflow complete
    await stopSla(id, 'FinanceWorkflow', 'actioned');

    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
