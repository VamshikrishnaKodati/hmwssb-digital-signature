const db = require('../config/db');
const { generateOtp, hashOtp } = require('../utils/otp');
const { sendMail, resolveEmail } = require('../utils/mailer');
const { buildOtpEmailHtml, buildOtpEmailText } = require('../utils/emailTemplate');

const DELETABLE_STATUSES = ['Draft', 'Reverted'];

const DOWNSTREAM_CHECK = `
  SELECT
    (SELECT COUNT(*)::int FROM "Tender" WHERE "EstimateID" = $1) as tenders,
    (SELECT COUNT(*)::int FROM "Agency" WHERE "EstimateID" = $1) as agencies,
    (SELECT COUNT(*)::int FROM "WorkProgress" WHERE "EstimateID" = $1) as progress,
    (SELECT COUNT(*)::int FROM "MeasurementBook" WHERE "EstimateID" = $1) as measurements,
    (SELECT COUNT(*)::int FROM "Billing" WHERE "EstimateID" = $1) as bills
`;

function maskEmail(email) {
  if (!email || !String(email).includes('@')) return email || '';
  const [local, domain] = String(email).split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

function formatIstTime(date) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

exports.requestDeleteOtp = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;

    if (req.user.Designation !== 'Manager')
      return res.status(403).json({ error: 'Only Manager can delete estimates' });

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CreatedBy !== userId)
      return res.status(403).json({ error: 'Only the creator can delete this estimate' });

    if (!DELETABLE_STATUSES.includes(est.Status))
      return res.status(400).json({ error: 'Only Draft or Reverted estimates can be deleted' });

    const ds = await db.query(DOWNSTREAM_CHECK, [estimateId]);
    const d = ds.rows[0];
    if (d.tenders > 0 || d.agencies > 0 || d.progress > 0 || d.measurements > 0 || d.bills > 0)
      return res.status(400).json({ error: 'This estimate cannot be deleted because downstream workflow records exist' });

    const cooldown = parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10);
    const recentOtp = await db.query(
      `SELECT "CreatedDate" FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'delete_estimate'
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, userId]
    );
    if (recentOtp.rows.length > 0) {
      const elapsed = (Date.now() - new Date(recentOtp.rows[0].CreatedDate).getTime()) / 1000;
      if (elapsed < cooldown)
        return res.status(429).json({ error: 'Please wait before requesting a new OTP', resendIn: Math.ceil(cooldown - elapsed) });
    }

    await db.query(
      `DELETE FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'delete_estimate' AND "Verified" = FALSE`,
      [estimateId, userId]
    );

    const otpCode = generateOtp();
    const codeHash = hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      `INSERT INTO "SignatureOTP" ("EstimateID", "UserID", "CodeHash", "Purpose", "ExpiresAt")
       VALUES ($1, $2, $3, 'delete_estimate', $4)`,
      [estimateId, userId, codeHash, expiresAt]
    );

    const email = await resolveEmail(userId);

    if (!email)
      return res.status(400).json({ error: 'No email address found for your account. Please contact an administrator.' });

    let mailSent = false;
    try {
      await sendMail({
        to: email,
        subject: `HMWSSB - OTP to Delete Estimate ${est.EstimateNo}`,
        text: buildOtpEmailText({
          code: otpCode,
          recipientName: req.user.Name,
          estimateNo: est.EstimateNo,
          workName: est.NameOfWork,
          requestedBy: req.user.Name,
          requestedByDesignation: req.user.Designation || 'Manager',
          dateTime: formatIstTime(new Date()),
          expiresInMinutes: 5,
        }),
        html: buildOtpEmailHtml({
          code: otpCode,
          recipientName: req.user.Name,
          estimateNo: est.EstimateNo,
          workName: est.NameOfWork,
          requestedBy: req.user.Name,
          requestedByDesignation: req.user.Designation || 'Manager',
          dateTime: formatIstTime(new Date()),
          expiresInMinutes: 5,
        }),
      });
      mailSent = true;
    } catch (_) { /* console logged by mailer */ }

    if (!mailSent)
      return res.status(500).json({ error: 'Unable to send OTP email. Please try again.' });

    res.json({
      message: 'OTP sent to your registered email',
      sentTo: email || null,
      maskedEmail: maskEmail(email),
      resendIn: cooldown,
    });
  } catch (err) { next(err); }
};

exports.verifyDelete = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { otpCode, reason } = req.body;
    const userId = req.user.UserID;

    if (!otpCode || !String(otpCode).trim())
      return res.status(400).json({ error: 'OTP is required to confirm deletion' });

    if (req.user.Designation !== 'Manager')
      return res.status(403).json({ error: 'Only Manager can delete estimates' });

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CreatedBy !== userId)
      return res.status(403).json({ error: 'Only the creator can delete this estimate' });

    if (!DELETABLE_STATUSES.includes(est.Status))
      return res.status(400).json({ error: 'Only Draft or Reverted estimates can be deleted' });

    const ds = await db.query(DOWNSTREAM_CHECK, [estimateId]);
    const d = ds.rows[0];
    if (d.tenders > 0 || d.agencies > 0 || d.progress > 0 || d.measurements > 0 || d.bills > 0)
      return res.status(400).json({ error: 'This estimate cannot be deleted because downstream workflow records exist' });

    const otpRes = await db.query(
      `SELECT * FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'delete_estimate' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, userId]
    );
    if (otpRes.rows.length === 0)
      return res.status(400).json({ error: 'No OTP requested. Request a new OTP.' });
    const otpRow = otpRes.rows[0];

    if (new Date(otpRow.ExpiresAt) < new Date())
      return res.status(400).json({ error: 'OTP has expired. Request a new OTP.' });

    if (hashOtp(String(otpCode).trim()) !== otpRow.CodeHash) {
      const attempts = otpRow.Attempts + 1;
      if (attempts >= 5) {
        await db.query('DELETE FROM "SignatureOTP" WHERE "OTPID" = $1', [otpRow.OTPID]);
        return res.status(400).json({ error: 'Too many failed attempts. Request a new OTP.' });
      }
      await db.query('UPDATE "SignatureOTP" SET "Attempts" = $1 WHERE "OTPID" = $2', [attempts, otpRow.OTPID]);
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    const claim = await db.query(
      `UPDATE "SignatureOTP" SET "Verified" = TRUE
       WHERE "OTPID" = $1 AND "Verified" = FALSE AND "ExpiresAt" > now()
       RETURNING "OTPID"`,
      [otpRow.OTPID]
    );
    if (claim.rowCount === 0)
      return res.status(409).json({ error: 'OTP has already been used. Request a new OTP.' });

    // Build snapshot before delete
    const details = await db.query(
      `SELECT ed.*, im."ItemCode", im."Description" as "ItemDescription"
       FROM "EstimateDetails" ed
       JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
       WHERE ed."EstimateID" = $1 ORDER BY ed."DetailID"`,
      [estimateId]
    );
    const abstract = await db.query('SELECT * FROM "Abstract" WHERE "EstimateID" = $1', [estimateId]);
    const versions = await db.query('SELECT * FROM "Versions" WHERE "EstimateID" = $1 ORDER BY "VersionID"', [estimateId]);
    const workflow = await db.query('SELECT * FROM "Workflow" WHERE "EstimateID" = $1 ORDER BY "WorkflowID"', [estimateId]);
    const audit = await db.query('SELECT * FROM "AuditLog" WHERE "EstimateID" = $1 ORDER BY "AuditID"', [estimateId]);
    const lsProvisions = await db.query('SELECT * FROM "EstimateLSProvision" WHERE "EstimateID" = $1', [estimateId]);
    const additionalItems = await db.query('SELECT * FROM "EstimateAdditionalItem" WHERE "EstimateID" = $1', [estimateId]);

    const snapshot = {
      estimate: est,
      items: details.rows,
      abstract: abstract.rows[0] || null,
      versions: versions.rows,
      workflow: workflow.rows,
      auditLog: audit.rows,
      lsProvisions: lsProvisions.rows,
      additionalItems: additionalItems.rows,
    };

    const grandTotal = abstract.rows[0]?.GrandTotal || 0;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO "DeletedEstimates"
         ("OriginalEstimateID", "EstimateNumber", "WorkName", "WorkCategory",
          "DeletedBy", "DeletedByRole", "DeleteReason",
          "StatusAtDeletion", "VersionAtDeletion", "GrandTotalAtDeletion",
          "CreatedBy", "CreatedDate", "SnapshotData")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          estimateId, est.EstimateNo, est.NameOfWork, est.WorkCategory,
          userId, req.user.Designation, reason || null,
          est.Status, est.Version, grandTotal,
          est.CreatedBy, est.CreatedDate, JSON.stringify(snapshot),
        ]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID", "UserID", "Action", "Remarks")
         VALUES ($1, $2, 'Delete', $3)`,
        [estimateId, userId, `Estimate ${est.EstimateNo} (v${est.Version}) deleted by ${req.user.Designation}${reason ? ': ' + reason : ''}`]
      );

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID", "FromUserID", "ToUserID", "Action", "Version", "OTPVerified", "Remarks")
         VALUES ($1, $2, $2, 'Delete', $3, TRUE, $4)`,
        [estimateId, userId, est.Version, reason || 'Estimate deleted by creator']
      );

      // Remove child records then the header
      await client.query('DELETE FROM "EstimateDetails" WHERE "EstimateID" = $1', [estimateId]);
      await client.query('DELETE FROM "Abstract" WHERE "EstimateID" = $1', [estimateId]);
      await client.query('DELETE FROM "Versions" WHERE "EstimateID" = $1', [estimateId]);
      await client.query('DELETE FROM "EstimateLSProvision" WHERE "EstimateID" = $1', [estimateId]);
      await client.query('DELETE FROM "EstimateAdditionalItem" WHERE "EstimateID" = $1', [estimateId]);
      await client.query('DELETE FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Estimate deleted successfully' });
  } catch (err) { next(err); }
};

exports.listDeletedEstimates = async (req, res, next) => {
  try {
    const userId = req.user.UserID;
    const designation = req.user.Designation;
    const { search, deletedBy } = req.query;

    // Only Manager and Administrator can view deleted estimates
    if (!['Manager', 'Administrator', 'GM', 'DGM'].includes(designation))
      return res.status(403).json({ error: 'Not authorized to view deleted estimates' });

    let query = `
      SELECT de.*,
        u."Name" as "DeletedByName"
      FROM "DeletedEstimates" de
      LEFT JOIN "Users" u ON u."UserID" = de."DeletedBy"
      WHERE de."RestoreStatus" = 'deleted'
    `;
    const params = [];
    let idx = 1;

    // Manager can only see their own deleted estimates
    if (designation === 'Manager') {
      query += ` AND de."DeletedBy" = $${idx++}`;
      params.push(userId);
    }

    if (search && search.trim()) {
      query += ` AND (de."EstimateNumber" ILIKE $${idx} OR de."WorkName" ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    if (deletedBy && deletedBy !== 'all') {
      query += ` AND de."DeletedBy" = $${idx++}`;
      params.push(parseInt(deletedBy));
    }

    query += ' ORDER BY de."DeletedAt" DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.getDeletedEstimate = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(404).json({ error: 'Deleted estimate not found' });
    const designation = req.user.Designation;

    if (!['Manager', 'Administrator', 'GM', 'DGM'].includes(designation))
      return res.status(403).json({ error: 'Not authorized' });

    const result = await db.query(
      `SELECT de.*, u."Name" as "DeletedByName"
       FROM "DeletedEstimates" de
       LEFT JOIN "Users" u ON u."UserID" = de."DeletedBy"
       WHERE de."DeletedEstimateID" = $1 AND de."RestoreStatus" = 'deleted'`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Deleted estimate not found' });

    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.requestRestoreOtp = async (req, res, next) => {
  try {
    const deletedEstimateId = Number(req.params.id);
    if (!Number.isInteger(deletedEstimateId) || deletedEstimateId <= 0)
      return res.status(404).json({ error: 'Deleted estimate not found' });
    const userId = req.user.UserID;

    if (!['Manager', 'Administrator'].includes(req.user.Designation))
      return res.status(403).json({ error: 'Not authorized to restore estimates' });

    const de = await db.query(
      'SELECT * FROM "DeletedEstimates" WHERE "DeletedEstimateID" = $1 AND "RestoreStatus" = $2',
      [deletedEstimateId, 'deleted']
    );
    if (de.rows.length === 0) return res.status(404).json({ error: 'Deleted estimate not found' });
    const deleted = de.rows[0];

    // Check the original estimate no longer exists active
    const active = await db.query(
      'SELECT "EstimateID" FROM "EstimateHeader" WHERE "EstimateNo" = $1',
      [deleted.EstimateNumber]
    );
    if (active.rows.length > 0)
      return res.status(400).json({ error: 'An active estimate with this number already exists. Cannot restore.' });

    const cooldown = parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10);
    const recentOtp = await db.query(
      `SELECT "CreatedDate" FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'restore_estimate'
       ORDER BY "OTPID" DESC LIMIT 1`,
      [deletedEstimateId, userId]
    );
    if (recentOtp.rows.length > 0) {
      const elapsed = (Date.now() - new Date(recentOtp.rows[0].CreatedDate).getTime()) / 1000;
      if (elapsed < cooldown)
        return res.status(429).json({ error: 'Please wait before requesting a new OTP', resendIn: Math.ceil(cooldown - elapsed) });
    }

    await db.query(
      `DELETE FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'restore_estimate' AND "Verified" = FALSE`,
      [deletedEstimateId, userId]
    );

    const otpCode = generateOtp();
    const codeHash = hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      `INSERT INTO "SignatureOTP" ("EstimateID", "UserID", "CodeHash", "Purpose", "ExpiresAt")
       VALUES ($1, $2, $3, 'restore_estimate', $4)`,
      [deletedEstimateId, userId, codeHash, expiresAt]
    );

    const userRes = await db.query('SELECT "Email" FROM "Users" WHERE "UserID" = $1', [userId]);
    const email = userRes.rows[0]?.Email;

    if (email) {
      try {
        await sendMail({
          to: email,
          subject: `OTP to Restore Estimate ${deleted.EstimateNumber}`,
          html: buildOtpEmailHtml(otpCode, 'restore this estimate'),
          text: buildOtpEmailText(otpCode, 'restore this estimate'),
        });
      } catch (_) { /* console logged by mailer */ }
    }

    res.json({
      message: 'OTP sent to your registered email',
      sentTo: email || null,
      maskedEmail: maskEmail(email),
      resendIn: cooldown,
    });
  } catch (err) { next(err); }
};

exports.verifyRestore = async (req, res, next) => {
  try {
    const deletedEstimateId = req.params.id;
    const { otpCode, reason } = req.body;
    const userId = req.user.UserID;

    if (!otpCode || !String(otpCode).trim())
      return res.status(400).json({ error: 'OTP is required to confirm restoration' });

    if (!['Manager', 'Administrator'].includes(req.user.Designation))
      return res.status(403).json({ error: 'Not authorized to restore estimates' });

    const de = await db.query(
      'SELECT * FROM "DeletedEstimates" WHERE "DeletedEstimateID" = $1 AND "RestoreStatus" = $2',
      [deletedEstimateId, 'deleted']
    );
    if (de.rows.length === 0) return res.status(404).json({ error: 'Deleted estimate not found' });
    const deleted = de.rows[0];

    const active = await db.query(
      'SELECT "EstimateID" FROM "EstimateHeader" WHERE "EstimateNo" = $1',
      [deleted.EstimateNumber]
    );
    if (active.rows.length > 0)
      return res.status(400).json({ error: 'An active estimate with this number already exists. Cannot restore.' });

    const otpRes = await db.query(
      `SELECT * FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'restore_estimate' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [deletedEstimateId, userId]
    );
    if (otpRes.rows.length === 0)
      return res.status(400).json({ error: 'No OTP requested. Request a new OTP.' });
    const otpRow = otpRes.rows[0];

    if (new Date(otpRow.ExpiresAt) < new Date())
      return res.status(400).json({ error: 'OTP has expired. Request a new OTP.' });

    if (hashOtp(String(otpCode).trim()) !== otpRow.CodeHash) {
      const attempts = otpRow.Attempts + 1;
      if (attempts >= 5) {
        await db.query('DELETE FROM "SignatureOTP" WHERE "OTPID" = $1', [otpRow.OTPID]);
        return res.status(400).json({ error: 'Too many failed attempts. Request a new OTP.' });
      }
      await db.query('UPDATE "SignatureOTP" SET "Attempts" = $1 WHERE "OTPID" = $2', [attempts, otpRow.OTPID]);
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    const claim = await db.query(
      `UPDATE "SignatureOTP" SET "Verified" = TRUE
       WHERE "OTPID" = $1 AND "Verified" = FALSE AND "ExpiresAt" > now()
       RETURNING "OTPID"`,
      [otpRow.OTPID]
    );
    if (claim.rowCount === 0)
      return res.status(409).json({ error: 'OTP has already been used. Request a new OTP.' });

    const snapshot = deleted.SnapshotData;
    const snapshotEst = snapshot.estimate || {};

    const client = await db.getClient();
    let newEstimateId;
    try {
      await client.query('BEGIN');

      // Restore estimate header
      const restoreStatus = deleted.StatusAtDeletion || 'Draft';
      const restoreVersion = (deleted.VersionAtDeletion || 1) + 1;

      const ins = await client.query(
        `INSERT INTO "EstimateHeader"
         ("EstimateNo", "NameOfWork", "WorkCategory", "FinancialYear",
          "RegionID", "ZoneID", "DivisionID", "CircleID", "WardID",
          "GSTPercent", "Status", "Version", "CurrentOwner", "CreatedBy",
          "CreatedDate", "LastModifiedBy", "LastModifiedDate")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
         RETURNING "EstimateID"`,
        [
          snapshotEst.EstimateNo, snapshotEst.NameOfWork, snapshotEst.WorkCategory,
          snapshotEst.FinancialYear, snapshotEst.RegionID, snapshotEst.ZoneID,
          snapshotEst.DivisionID, snapshotEst.CircleID, snapshotEst.WardID,
          snapshotEst.GSTPercent || 18, restoreStatus, restoreVersion, userId,
          snapshotEst.CreatedBy || userId, snapshotEst.CreatedDate || new Date(),
          userId,
        ]
      );
      newEstimateId = ins.rows[0].EstimateID;

      // Restore items
      const items = snapshot.items || [];
      for (const item of items) {
        await client.query(
          `INSERT INTO "EstimateDetails"
           ("EstimateID", "ItemID", "Category", "FormulaType", "Unit",
            "Rate", "N", "L", "B", "D", "Qty", "Amount", "Remarks")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            newEstimateId, item.ItemID, item.Category, item.FormulaType,
            item.Unit, item.Rate, item.N, item.L, item.B, item.D,
            item.Qty, item.Amount, item.Remarks,
          ]
        );
      }

      // Restore abstract
      if (snapshot.abstract) {
        const a = snapshot.abstract;
        await client.query(
          `INSERT INTO "Abstract"
           ("EstimateID", "CivilTotal", "MaterialTotal", "CostOfEstimate",
            "GST", "AdditionalItemsTotal", "LSProvision", "GrandTotal",
            "SubTotal")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            newEstimateId, a.CivilTotal, a.MaterialTotal, a.CostOfEstimate,
            a.GST, a.AdditionalItemsTotal || 0, a.LSProvision || 0,
            a.GrandTotal, a.SubTotal || 0,
          ]
        );
      }

      // Restore LS provisions
      for (const ls of (snapshot.lsProvisions || [])) {
        await client.query(
          `INSERT INTO "EstimateLSProvision" ("EstimateID", "Description", "Amount")
           VALUES ($1, $2, $3)`,
          [newEstimateId, ls.Description, ls.Amount]
        );
      }

      // Restore additional items
      for (const ai of (snapshot.additionalItems || [])) {
        await client.query(
          `INSERT INTO "EstimateAdditionalItem" ("EstimateID", "Description", "Amount")
           VALUES ($1, $2, $3)`,
          [newEstimateId, ai.Description, ai.Amount]
        );
      }

      // Restore version record
      await client.query(
        `INSERT INTO "Versions" ("EstimateID", "VersionNumber", "CreatedBy", "CreatedDate", "Remarks", "Changes")
         VALUES ($1, $2, $3, now(), $4, $5)`,
        [
          newEstimateId, restoreVersion, userId,
          `Restored from deleted archive (was v${deleted.VersionAtDeletion})`,
          JSON.stringify([{ field: 'Status', oldValue: 'Deleted', newValue: restoreStatus }]),
        ]
      );

      // Restore workflow records
      for (const w of (snapshot.workflow || [])) {
        await client.query(
          `INSERT INTO "Workflow"
           ("EstimateID", "FromUserID", "ToUserID", "Action", "Version", "OTPVerified", "Remarks", "DateTime")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [newEstimateId, w.FromUserID, w.ToUserID, w.Action, w.Version, w.OTPVerified, w.Remarks, w.DateTime]
        );
      }

      // Add restore workflow event
      await client.query(
        `INSERT INTO "Workflow"
         ("EstimateID", "FromUserID", "ToUserID", "Action", "Version", "OTPVerified", "Remarks")
         VALUES ($1, $2, $2, 'Restore', $3, TRUE, $4)`,
        [newEstimateId, userId, restoreVersion, reason || 'Restored from deleted archive']
      );

      // Restore audit records
      for (const a of (snapshot.auditLog || [])) {
        await client.query(
          `INSERT INTO "AuditLog" ("EstimateID", "UserID", "Action", "Remarks", "CreatedDate")
           VALUES ($1,$2,$3,$4,$5)`,
          [newEstimateId, a.UserID, a.Action, a.Remarks, a.CreatedDate]
        );
      }

      // Add restore audit event
      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID", "UserID", "Action", "Remarks")
         VALUES ($1, $2, 'Restore', $3)`,
        [newEstimateId, userId, `Estimate ${deleted.EstimateNumber} restored from deleted archive (v${restoreVersion}). ${reason || ''}`]
      );

      // Mark as restored in DeletedEstimates
      await client.query(
        `UPDATE "DeletedEstimates" SET "RestoreStatus" = 'restored', "RestoredBy" = $1, "RestoredAt" = now(), "RestoreReason" = $2
         WHERE "DeletedEstimateID" = $3`,
        [userId, reason || null, deletedEstimateId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Estimate restored successfully', estimateId: newEstimateId });
  } catch (err) { next(err); }
};
