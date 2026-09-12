const crypto = require('crypto');
const db = require('../config/db');
const { createVersion } = require('./estimateController');
const { generateOtp, hashOtp } = require('../utils/otp');
const { sendMail, maskEmail, resolveEmail } = require('../utils/mailer');
const { generateTenderNo } = require('../utils/tenderNo');
const { generateTsNo } = require('../utils/tsNo');
const { generateFcnNo } = require('../utils/fcnNo');
const { buildOtpEmailHtml, buildOtpEmailText, buildWorkflowEmailHtml, buildWorkflowEmailText } = require('../utils/emailTemplate');
const { startSla, stopSla } = require('../utils/sla');
const { logOtp } = require('../utils/devOtpLog');
const { resolveApprovalUser } = require('../services/locationScope');

async function getEstimate(estimateId) {
  const r = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  return r.rows[0] || null;
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

async function sendNotification(estimateId, toUserId, type, message, opts = {}) {
  if (!toUserId) return;
  await db.query(
    `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message") VALUES ($1,$2,$3,$4)`,
    [estimateId, toUserId, type, message]
  );
  // Send workflow email notification asynchronously (best-effort, non-blocking)
  if (opts.email && opts.email.to) {
    const { buildWorkflowEmailHtml, buildWorkflowEmailText } = require('../utils/emailTemplate');
    const html = buildWorkflowEmailHtml(opts.email);
    const text = buildWorkflowEmailText(opts.email);
    sendMail({ to: opts.email.to, subject: opts.email.subject || 'HMWSSB - Workflow Update', text, html }).catch(() => {});
  }
}

async function auditLog(estimateId, userId, action, remarks) {
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
     VALUES ($1,$2,$3,$4)`,
    [estimateId, userId, action, remarks]
  );
}

function getNextOwner(designation) {
  const map = {
    Manager: 'DGM',
    DGM: 'GM',
    GM: 'CGM',
    CGM: 'DOP',
    DOP: 'ED',
    ED: 'MD',
    TenderOfficer: 'DirectorOfAdministration',
    DirectorOfAdministration: 'SiteEngineer',
    SiteEngineer: 'BillingOfficer',
    BillingOfficer: 'Administrator',
    Administrator: null
  };
  return map[designation] || null;
}

async function findUserByDesignation(designation) {
  const r = await db.query(
    `SELECT "UserID","Name","Email","Designation" FROM "Users"
     WHERE "Designation" = $1 AND "IsActive" IS NOT FALSE ORDER BY "UserID" LIMIT 1`,
    [designation]
  );
  return r.rows[0] || null;
}

async function getOrCreateVersion(estimateId) {
  const h = await db.query('SELECT "Version" FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  const currentVersion = h.rows[0].Version;
  return currentVersion;
}

exports.requestSubmitOtp = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (!['Draft', 'Reverted'].includes(est.Status))
      return res.status(400).json({ error: 'Only Draft or Reverted estimates can be submitted' });
    if (req.user.UserID !== est.CreatedBy)
      return res.status(403).json({ error: 'Only the creator of the estimate can submit it' });
    if (req.user.Designation !== 'Manager')
      return res.status(403).json({ error: 'Only Manager can submit estimates' });

    const itemCount = await db.query('SELECT COUNT(*)::int as cnt FROM "EstimateDetails" WHERE "EstimateID" = $1', [estimateId]);
    if (itemCount.rows[0].cnt === 0)
      return res.status(400).json({ error: 'Cannot submit estimate with no items' });

    const cooldownSec = Math.max(parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10), 10);
    const lastOtp = await db.query(
      `SELECT "CreatedDate" FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "Purpose" = 'submission' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId]
    );
    if (lastOtp.rows.length) {
      const elapsedSec = (Date.now() - new Date(lastOtp.rows[0].CreatedDate).getTime()) / 1000;
      if (elapsedSec < cooldownSec) {
        const waitSec = Math.ceil(cooldownSec - elapsedSec);
        return res.status(429).json({
          error: `Please wait ${waitSec}s before requesting a new OTP`,
          resendIn: waitSec,
        });
      }
    }

    await db.query(
      'DELETE FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = \'submission\' AND "Verified" = FALSE',
      [estimateId]
    );

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.query(
      `INSERT INTO "SignatureOTP" ("EstimateID","UserID","CodeHash","Purpose","ExpiresAt")
       VALUES ($1,$2,$3,'submission',$4)`,
      [estimateId, userId, hashOtp(code), expiresAt]
    );

    const email = await resolveEmail(userId);

    await sendMail({
      to: email,
      subject: 'HMWSSB - OTP Verification for Estimate Submission',
      text: buildOtpEmailText({
        code,
        recipientName: req.user.Name,
        estimateNo: est.EstimateNo,
        workName: est.NameOfWork,
        requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation || 'Manager',
        dateTime: formatIstTime(new Date()),
        expiresInMinutes: 5,
      }),
      html: buildOtpEmailHtml({
        code,
        recipientName: req.user.Name,
        estimateNo: est.EstimateNo,
        workName: est.NameOfWork,
        requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation || 'Manager',
        dateTime: formatIstTime(new Date()),
        expiresInMinutes: 5,
      }),
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP][DEV] Submit OTP for estimate ${est.EstimateNo} (user ${req.user.Name}): ${code}`);
      logOtp(est.EstimateNo, 'submission', code);
    }

    const maskedEmail = maskEmail(email);

    res.json({
      message: `OTP sent to ${maskedEmail}. It expires in 5 minutes.`,
      sentTo: maskedEmail,
      resendIn: cooldownSec,
      expiresIn: 300,
    });
  } catch (err) { next(err); }
};

exports.submitEstimate = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks, otpCode } = req.body;
    const userId = req.user.UserID;

    if (!otpCode || !String(otpCode).trim())
      return res.status(400).json({ error: 'OTP is required to confirm submission' });

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (!['Draft', 'Reverted'].includes(est.Status))
      return res.status(400).json({ error: 'Only Draft or Reverted estimates can be submitted' });

    if (req.user.UserID !== est.CreatedBy)
      return res.status(403).json({ error: 'Only the creator of the estimate can submit it' });
    if (req.user.Designation !== 'Manager')
      return res.status(403).json({ error: 'Only Manager can submit estimates' });

    const itemCount = await db.query('SELECT COUNT(*)::int as cnt FROM "EstimateDetails" WHERE "EstimateID" = $1', [estimateId]);
    if (itemCount.rows[0].cnt === 0)
      return res.status(400).json({ error: 'Cannot submit estimate with no items' });

    if (est.Status === 'Reverted' && (!remarks || !remarks.trim()))
      return res.status(400).json({ error: 'Action Taken Report is mandatory before resubmission' });

    // Verify OTP — same pattern as GM digital signature verification
    const otpRes = await db.query(
      `SELECT * FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'submission' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, userId]
    );
    if (otpRes.rows.length === 0)
      return res.status(400).json({ error: 'No OTP requested. Request an OTP first.' });
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

    // Atomic single-use claim — two concurrent verifications with the same code
    // can never both succeed.
    const claim = await db.query(
      `UPDATE "SignatureOTP" SET "Verified" = TRUE
       WHERE "OTPID" = $1 AND "Verified" = FALSE AND "ExpiresAt" > now()
       RETURNING "OTPID"`,
      [otpRow.OTPID]
    );
    if (claim.rowCount === 0) {
      return res.status(409).json({ error: 'OTP has already been used. Request a new OTP.' });
    }

    // Location-aware routing: the DGM of the estimate's division owns the
    // review. Maker-checker: the creator can never be their own approver, so a
    // (defensive) self-match escalates straight past DGM to the GM.
    let dgm = await resolveApprovalUser('DGM', est);
    let escToGm = false;
    let gm = null;
    if (dgm && dgm.UserID === est.CreatedBy) {
      escToGm = true;
      gm = await resolveApprovalUser('GM', est);
      if (!gm) return res.status(400).json({ error: 'No GM found in system' });
    }
    if (!dgm) return res.status(400).json({ error: 'No DGM found in system' });
    const nextOwner = escToGm ? gm : dgm;
    const nextStatus = escToGm ? 'DGM_Approved' : 'Submitted';

    const currentVersion = await getOrCreateVersion(estimateId);

    // Status transition + history + audit are one unit, and the status UPDATE is
    // conditional so a double-submit can never insert two Submit workflow rows.
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "EstimateHeader" SET "Status" = $1, "CurrentOwner" = $2,
         "SubmissionDate" = now(), "LastModifiedBy" = $3, "LastModifiedDate" = now(),
         "ActionTakenReport" = COALESCE($4, "ActionTakenReport")
         WHERE "EstimateID" = $5 AND "Status" IN ('Draft','Reverted')`,
        [nextStatus, nextOwner.UserID, userId, remarks || null, estimateId]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Estimate has already been submitted or is not in an editable state' });
      }

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'Submit',$4,TRUE,$5)`,
        [estimateId, userId, nextOwner.UserID, currentVersion,
         escToGm ? 'Submitted for DGM review (escalated to GM: maker-checker)' : 'Submitted for DGM review']
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'Submit',$3)`,
        [estimateId, userId,
          `Estimate ${est.EstimateNo} submitted to ${escToGm ? 'GM (maker-checker escalation)' : 'DGM'} (v${currentVersion})`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Start SLA for the review stage
    await startSla('Estimate', escToGm ? 'GM' : 'DGM', estimateId, 'EstimateHeader');

    await sendNotification(estimateId, nextOwner.UserID, 'Submit',
      `Estimate ${est.EstimateNo} has been submitted for your review`, {
        email: {
          to: await resolveEmail(nextOwner.UserID),
          subject: `HMWSSB - Estimate ${est.EstimateNo} submitted for your review`,
          recipientName: nextOwner.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: `Submitted for ${escToGm ? 'GM' : 'DGM'} review`,
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: escToGm ? 'Estimate forwarded to GM for review (creator overrode DGM slot)' : 'Estimate forwarded to DGM for review' });
  } catch (err) { next(err); }
};

exports.revertEstimate = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    if (!remarks || !remarks.trim())
      return res.status(400).json({ error: 'Remarks are required for reversion' });

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });

    if (!['Submitted', 'DGM_Approved', 'Approved', 'GM_Recommended', 'CGM_Submitted',
           'DOP_Approved', 'ED_Approved',
           'Signed', 'TenderPublished', 'AgencySelected',
           'WorkStarted', 'WorkCompleted', 'Billing'].includes(est.Status))
      return res.status(400).json({ error: 'Estimate cannot be reverted in current state' });

    const newVersion = est.Version + 1;
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'Reverted', "Version" = $1, "CurrentOwner" = "CreatedBy"
       WHERE "EstimateID" = $2`,
      [newVersion, estimateId]
    );

    await createVersion(estimateId, userId, 'Reverted by DGM', [
      { field: 'Status', oldValue: est.Status, newValue: 'Reverted' },
    ]);

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'Revert',$4,TRUE,$5)`,
      [estimateId, userId, est.CreatedBy, newVersion, remarks]
    );

    await auditLog(estimateId, userId, 'Revert',
      `${req.user.Designation} reverted ${est.EstimateNo} (v${est.Version} → v${newVersion}). Previous status: ${est.Status}. New status: Reverted. Remarks: ${remarks}`);

    await sendNotification(estimateId, est.CreatedBy, 'Revert',
      `Estimate ${est.EstimateNo} was returned by ${req.user.Designation}: ${remarks}`, {
        email: {
          to: await resolveEmail(est.CreatedBy),
          subject: `HMWSSB - Estimate ${est.EstimateNo} reverted to you`,
          recipientName: est.CreatedByName || 'User', estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: `Reverted by ${req.user.Designation}`,
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          remarks, dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: 'Estimate reverted to creator' });
  } catch (err) { next(err); }
};

exports.approveEstimate = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];
    const designation = req.user.Designation;

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });

    if (designation === 'DGM') {
      if (est.Status !== 'Submitted')
        return res.status(400).json({ error: 'DGM can only approve Submitted estimates' });

      const gm = await resolveApprovalUser('GM', est);
      if (!gm) return res.status(400).json({ error: 'No GM found in system' });

      const currentVersion = await getOrCreateVersion(estimateId);
      await db.query(
        `UPDATE "EstimateHeader" SET "Status" = 'DGM_Approved', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
        [gm.UserID, estimateId]
      );

      await db.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'Approve',$4,TRUE,$5)`,
        [estimateId, userId, gm.UserID, currentVersion, remarks || 'Recommended by DGM for final approval']
      );

      await auditLog(estimateId, userId, 'Approve',
        `DGM approved ${est.EstimateNo} (v${currentVersion}). Previous status: ${est.Status}. New status: DGM_Approved.`);

      await sendNotification(estimateId, gm.UserID, 'Approve',
        `Estimate ${est.EstimateNo} has been verified by DGM, awaiting your recommendation`, {
          email: {
            to: await resolveEmail(gm.UserID),
            subject: `HMWSSB - Estimate ${est.EstimateNo} verified, awaiting your recommendation`,
            recipientName: gm.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
            action: 'Verified by DGM, awaiting GM recommendation',
            fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
            dateTime: formatIstTime(new Date()),
          }
        });
      return res.json({ message: 'Estimate verified and forwarded to GM' });
    }

    if (designation === 'GM') {
      return res.status(403).json({
        error: 'GM approval is performed via Digital Sign + OTP. Use the sign endpoint to authorize and forward the estimate.',
      });
    }

    return res.status(403).json({ error: 'Only DGM can approve estimates; GM finalizes via Digital Sign + OTP' });
  } catch (err) { next(err); }
};

exports.requestDgmApproveOtp = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'DGM')
      return res.status(403).json({ error: 'Only DGM can request approval OTP' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== 'Submitted')
      return res.status(400).json({ error: 'Only Submitted estimates can be approved by DGM' });

    const cooldownSec = Math.max(parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10), 10);
    const lastOtp = await db.query(
      `SELECT "CreatedDate" FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "Purpose" = 'dgm_approve' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId]
    );
    if (lastOtp.rows.length) {
      const elapsedSec = (Date.now() - new Date(lastOtp.rows[0].CreatedDate).getTime()) / 1000;
      if (elapsedSec < cooldownSec) {
        const waitSec = Math.ceil(cooldownSec - elapsedSec);
        return res.status(429).json({ error: `Please wait ${waitSec}s before requesting a new OTP`, resendIn: waitSec });
      }
    }

    await db.query(
      'DELETE FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = \'dgm_approve\' AND "Verified" = FALSE',
      [estimateId]
    );

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.query(
      `INSERT INTO "SignatureOTP" ("EstimateID","UserID","CodeHash","Purpose","ExpiresAt")
       VALUES ($1,$2,$3,'dgm_approve',$4)`,
      [estimateId, userId, hashOtp(code), expiresAt]
    );

    const userRes = await db.query('SELECT "Email" FROM "Users" WHERE "UserID" = $1', [userId]);
    const registeredEmail = userRes.rows[0]?.Email || null;
    const devRecipient = process.env.NODE_ENV !== 'production' && process.env.MAIL_DEV_RECIPIENT
      ? process.env.MAIL_DEV_RECIPIENT : null;
    const email = devRecipient || registeredEmail;

    await sendMail({
      to: email,
      subject: 'HMWSSB - OTP Verification for DGM Approval',
      text: buildOtpEmailText({
        code, recipientName: req.user.Name, estimateNo: est.EstimateNo,
        workName: est.NameOfWork, requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation || 'DGM',
        dateTime: formatIstTime(new Date()), expiresInMinutes: 5,
      }),
      html: buildOtpEmailHtml({
        code, recipientName: req.user.Name, estimateNo: est.EstimateNo,
        workName: est.NameOfWork, requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation || 'DGM',
        dateTime: formatIstTime(new Date()), expiresInMinutes: 5,
      }),
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP][DEV] DGM Approve OTP for estimate ${est.EstimateNo} (user ${req.user.Name}): ${code}`);
      logOtp(est.EstimateNo, 'dgm_approve', code);
    }

    const maskedEmail = maskEmail(email);
    res.json({ message: `OTP sent to ${maskedEmail}. It expires in 5 minutes.`, sentTo: maskedEmail, resendIn: cooldownSec, expiresIn: 300 });
  } catch (err) { next(err); }
};

exports.verifyDgmApprove = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { otpCode, remarks } = req.body;
    const userId = req.user.UserID;

    // Authorization before validation: a non-DGM caller (e.g. GM, who authorizes
    // via digital sign instead) must get 403 regardless of the request body.
    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'DGM')
      return res.status(403).json({ error: 'Only DGM can approve estimates' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (!otpCode || !String(otpCode).trim())
      return res.status(400).json({ error: 'OTP is required to confirm approval' });
    if (est.Status !== 'Submitted')
      return res.status(400).json({ error: 'Only Submitted estimates can be approved by DGM' });

    const otpRes = await db.query(
      `SELECT * FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'dgm_approve' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, userId]
    );
    if (otpRes.rows.length === 0)
      return res.status(400).json({ error: 'No OTP requested. Request an OTP first.' });
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
    if (claim.rowCount === 0) {
      return res.status(409).json({ error: 'OTP has already been used. Request a new OTP.' });
    }

    // Re-read header inside transaction to prevent race conditions
    const freshHeader = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    const freshEst = freshHeader.rows[0];
    if (freshEst.CurrentOwner !== userId)
      return res.status(409).json({ error: 'Estimate ownership has changed. Refresh and try again.' });
    if (freshEst.Status !== 'Submitted')
      return res.status(409).json({ error: 'Estimate is no longer in Submitted status. Refresh and try again.' });

    const gm = await resolveApprovalUser('GM', est);
    if (!gm) return res.status(400).json({ error: 'No GM found in system' });

    const currentVersion = await getOrCreateVersion(estimateId);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "EstimateHeader" SET "Status" = 'DGM_Approved', "CurrentOwner" = $1,
         "LastModifiedBy" = $2, "LastModifiedDate" = now()
         WHERE "EstimateID" = $3 AND "Status" = 'Submitted' AND "CurrentOwner" = $2`,
        [gm.UserID, userId, estimateId]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Estimate has already been processed or is not in an approvable state' });
      }

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'Approve',$4,TRUE,$5)`,
        [estimateId, userId, gm.UserID, currentVersion, remarks || 'Recommended by DGM for final approval (OTP verified)']
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'Approve',$3)`,
        [estimateId, userId,
          `DGM approved ${est.EstimateNo} (v${currentVersion}) after OTP verification. Previous status: ${est.Status}. New status: DGM_Approved.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Stop DGM SLA, start GM SLA
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    await startSla('Estimate', 'GM', estimateId, 'EstimateHeader');

    await sendNotification(estimateId, gm.UserID, 'Approve',
      `Estimate ${est.EstimateNo} has been verified by DGM (OTP verified), awaiting your recommendation`, {
        email: {
          to: await resolveEmail(gm.UserID),
          subject: `HMWSSB - Estimate ${est.EstimateNo} verified, awaiting your recommendation`,
          recipientName: gm.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: 'Verified by DGM, awaiting GM recommendation',
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: 'OTP verified. Estimate verified and forwarded to GM.' });
  } catch (err) { next(err); }
};

exports.requestSignatureOtp = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (!['DGM_Approved', 'Approved'].includes(est.Status))
      return res.status(400).json({ error: 'OTP can only be requested for estimates forwarded by DGM' });
    if (req.user.Designation !== 'GM')
      return res.status(403).json({ error: 'Only GM can request the signature OTP' });

    const userRes = await db.query('SELECT "Email" FROM "Users" WHERE "UserID" = $1', [userId]);

    const cooldownSec = Math.max(parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10), 10);
    const lastOtp = await db.query(
      `SELECT "CreatedDate" FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId]
    );
    if (lastOtp.rows.length) {
      const elapsedSec = (Date.now() - new Date(lastOtp.rows[0].CreatedDate).getTime()) / 1000;
      if (elapsedSec < cooldownSec) {
        const waitSec = Math.ceil(cooldownSec - elapsedSec);
        return res.status(429).json({
          error: `Please wait ${waitSec}s before requesting a new OTP`,
          resendIn: waitSec,
        });
      }
    }

    await db.query(
      'DELETE FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Verified" = FALSE',
      [estimateId]
    );

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.query(
      `INSERT INTO "SignatureOTP" ("EstimateID","UserID","CodeHash","Purpose","ExpiresAt")
       VALUES ($1,$2,$3,'signature',$4)`,
      [estimateId, userId, hashOtp(code), expiresAt]
    );

    // Development override: during non-production runs, deliver all OTPs to the
    // configured dev mailbox (e.g. kodativamsikrishna@gmail.com) instead of the
    // GM's registered email, so real-time delivery can be tested.
    const registeredEmail = userRes.rows[0]?.Email || null;
    const devRecipient = process.env.NODE_ENV !== 'production' && process.env.MAIL_DEV_RECIPIENT
      ? process.env.MAIL_DEV_RECIPIENT
      : null;
    const email = devRecipient || registeredEmail;

    await sendMail({
      to: email,
      subject: 'HMWSSB - OTP Verification for Digital Signature',
      text: buildOtpEmailText({
        code,
        recipientName: req.user.Name,
        estimateNo: est.EstimateNo,
        workName: est.NameOfWork,
        requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation || 'GM',
        dateTime: formatIstTime(new Date()),
        expiresInMinutes: 5,
      }),
      html: buildOtpEmailHtml({
        code,
        recipientName: req.user.Name,
        estimateNo: est.EstimateNo,
        workName: est.NameOfWork,
        requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation || 'GM',
        dateTime: formatIstTime(new Date()),
        expiresInMinutes: 5,
      }),
    });

    // Debug only: print the OTP to the backend server console during
    // development. It is never sent to the client in any environment.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP][DEV] Signature OTP for estimate ${est.EstimateNo} (user ${req.user.Name}): ${code}`);
      logOtp(est.EstimateNo, 'signature', code);
    }

    const maskedEmail = maskEmail(email);

    res.json({
      message: `OTP sent to ${maskedEmail}. It expires in 5 minutes.`,
      sentTo: maskedEmail,
      resendIn: cooldownSec,
      expiresIn: 300,
    });
  } catch (err) { next(err); }
};

exports.signAndAuditEstimate = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { otpCode, remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (!['DGM_Approved', 'Approved'].includes(est.Status))
      return res.status(400).json({ error: 'Only estimates forwarded by DGM can be recommended by GM' });
    if (req.user.Designation !== 'GM')
      return res.status(403).json({ error: 'Only GM can recommend estimates' });
    if (!otpCode || !String(otpCode).trim())
      return res.status(400).json({ error: 'OTP is required to confirm recommendation' });

    const otpRes = await db.query(
      `SELECT * FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'signature' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, userId]
    );
    if (otpRes.rows.length === 0)
      return res.status(400).json({ error: 'No OTP requested. Request an OTP first.' });
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
    if (claim.rowCount === 0) {
      return res.status(409).json({ error: 'OTP has already been used. Request a new OTP.' });
    }

    const cgm = await resolveApprovalUser('CGM', est);
    if (!cgm) return res.status(400).json({ error: 'No CGM found in system' });

    const currentVersion = await getOrCreateVersion(estimateId);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "EstimateHeader" SET "Status" = 'GM_Recommended', "CurrentOwner" = $1,
         "LastModifiedBy" = $2, "LastModifiedDate" = now()
         WHERE "EstimateID" = $3 AND "Status" IN ('DGM_Approved','Approved') AND "CurrentOwner" = $2`,
        [cgm.UserID, userId, estimateId]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Estimate has already been processed or is not in a recommendable state' });
      }

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'Recommend',$4,TRUE,$5)`,
        [estimateId, userId, cgm.UserID, currentVersion, remarks || 'GM recommended for CGM review (OTP verified)']
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'Recommend',$3)`,
        [estimateId, userId,
          `GM recommended ${est.EstimateNo} (v${currentVersion}) after OTP verification. Previous status: ${est.Status}. New status: GM_Recommended.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Stop GM SLA, start CGM SLA
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    await startSla('Estimate', 'CGM', estimateId, 'EstimateHeader');

    await sendNotification(estimateId, cgm.UserID, 'Recommend',
      `Estimate ${est.EstimateNo} has been recommended by GM (OTP verified), awaiting your submission for approval`, {
        email: {
          to: await resolveEmail(cgm.UserID),
          subject: `HMWSSB - Estimate ${est.EstimateNo} recommended, awaiting your submission`,
          recipientName: cgm.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: 'Recommended by GM, awaiting CGM submission for approval',
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: 'OTP verified. Recommended and forwarded to CGM.' });
  } catch (err) { next(err); }
};

// ── Generic OTP-gated approval helper ────────────────────────────────────────
// Reduces boilerplate for CGM/DOP/ED/MD approval steps. Each step follows the
// same pattern: validate role+owner+status → verify OTP → transactional
// status+owner update → workflow + audit → notification.

async function genericOtpApproval({
  req, res, next,
  purpose,        // OTP purpose string, e.g. 'cgm_submit'
  requiredRole,   // e.g. 'CGM'
  requiredStatus, // e.g. 'GM_Recommended'
  newStatus,      // e.g. 'CGM_Submitted'
  nextDesignation,// e.g. 'DOP'
  actionName,     // e.g. 'Recommend' (workflow action)
  actionLabel,    // human label for audit, e.g. 'CGM submitted for approval'
  emailSubject,   // OTP email subject
  successMessage, // response message
}) {
  try {
    const estimateId = req.params.id;
    const { otpCode, remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== requiredRole)
      return res.status(403).json({ error: `Only ${requiredRole} can perform this action` });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== requiredStatus)
      return res.status(400).json({ error: `Only ${requiredStatus} estimates can be processed by ${requiredRole}` });
    if (!otpCode || !String(otpCode).trim())
      return res.status(400).json({ error: 'OTP is required to confirm this action' });

    // Verify OTP
    const otpRes = await db.query(
      `SELECT * FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = $3 AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, userId, purpose]
    );
    if (otpRes.rows.length === 0)
      return res.status(400).json({ error: 'No OTP requested. Request an OTP first.' });
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

    // Re-read inside transaction scope for race safety
    const fresh = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    const freshEst = fresh.rows[0];
    if (freshEst.CurrentOwner !== userId)
      return res.status(409).json({ error: 'Estimate ownership has changed. Refresh and try again.' });
    if (freshEst.Status !== requiredStatus)
      return res.status(409).json({ error: `Estimate is no longer in ${requiredStatus} status. Refresh and try again.` });

    const nextOwner = await findUserByDesignation(nextDesignation);
    if (!nextOwner) return res.status(400).json({ error: `No ${nextDesignation} found in system` });

    const currentVersion = await getOrCreateVersion(estimateId);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "EstimateHeader" SET "Status" = $1, "CurrentOwner" = $2,
         "LastModifiedBy" = $3, "LastModifiedDate" = now()
         WHERE "EstimateID" = $4 AND "Status" = $5 AND "CurrentOwner" = $3`,
        [newStatus, nextOwner.UserID, userId, estimateId, requiredStatus]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Estimate has already been processed or is not in an approvable state' });
      }

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
        [estimateId, userId, nextOwner.UserID, actionName, currentVersion, remarks || `${actionLabel} (OTP verified)`]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,$3,$4)`,
        [estimateId, userId, actionName,
          `${actionLabel} for ${est.EstimateNo} (v${currentVersion}) after OTP verification. Previous status: ${est.Status}. New status: ${newStatus}.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Stop current stage SLA, start next stage SLA for CGM/DOP/ED transitions
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    const nextSlaStage = { CGM_Submitted: 'DOP', DOP_Approved: 'ED', ED_Approved: 'MD' };
    if (nextSlaStage[newStatus]) {
      await startSla('Estimate', nextSlaStage[newStatus], estimateId, 'EstimateHeader');
    }

    await sendNotification(estimateId, nextOwner.UserID, actionName,
      `Estimate ${est.EstimateNo} has been ${actionLabel.toLowerCase()} (OTP verified), forwarded to ${nextDesignation}`, {
        email: {
          to: await resolveEmail(nextOwner.UserID),
          subject: `HMWSSB - Estimate ${est.EstimateNo} ${actionLabel.toLowerCase()}`,
          recipientName: nextOwner.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: `${actionLabel}, forwarded to ${nextDesignation}`,
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: successMessage });
  } catch (err) { next(err); }
}

// ── Generic OTP request helper ───────────────────────────────────────────────

async function genericRequestOtp({
  req, res, next,
  purpose,
  requiredRole,
  requiredStatus,
  emailSubject,
}) {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== requiredRole)
      return res.status(403).json({ error: `Only ${requiredRole} can request this OTP` });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== requiredStatus)
      return res.status(400).json({ error: `Only ${requiredStatus} estimates can be processed by ${requiredRole}` });

    const cooldownSec = Math.max(parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10), 10);
    const lastOtp = await db.query(
      `SELECT "CreatedDate" FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "Purpose" = $2 AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, purpose]
    );
    if (lastOtp.rows.length) {
      const elapsedSec = (Date.now() - new Date(lastOtp.rows[0].CreatedDate).getTime()) / 1000;
      if (elapsedSec < cooldownSec) {
        const waitSec = Math.ceil(cooldownSec - elapsedSec);
        return res.status(429).json({ error: `Please wait ${waitSec}s before requesting a new OTP`, resendIn: waitSec });
      }
    }

    await db.query(
      `DELETE FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = $2 AND "Verified" = FALSE`,
      [estimateId, purpose]
    );

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.query(
      `INSERT INTO "SignatureOTP" ("EstimateID","UserID","CodeHash","Purpose","ExpiresAt")
       VALUES ($1,$2,$3,$4,$5)`,
      [estimateId, userId, hashOtp(code), purpose, expiresAt]
    );

    const userRes = await db.query('SELECT "Email" FROM "Users" WHERE "UserID" = $1', [userId]);
    const registeredEmail = userRes.rows[0]?.Email || null;
    const devRecipient = process.env.NODE_ENV !== 'production' && process.env.MAIL_DEV_RECIPIENT
      ? process.env.MAIL_DEV_RECIPIENT : null;
    const email = devRecipient || registeredEmail;

    await sendMail({
      to: email,
      subject: emailSubject,
      text: buildOtpEmailText({
        code, recipientName: req.user.Name, estimateNo: est.EstimateNo,
        workName: est.NameOfWork, requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation,
        dateTime: formatIstTime(new Date()), expiresInMinutes: 5,
      }),
      html: buildOtpEmailHtml({
        code, recipientName: req.user.Name, estimateNo: est.EstimateNo,
        workName: est.NameOfWork, requestedBy: req.user.Name,
        requestedByDesignation: req.user.Designation,
        dateTime: formatIstTime(new Date()), expiresInMinutes: 5,
      }),
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP][DEV] ${purpose} OTP for estimate ${est.EstimateNo} (user ${req.user.Name}): ${code}`);
      logOtp(est.EstimateNo, purpose, code);
    }

    const maskedEmail = maskEmail(email);
    res.json({ message: `OTP sent to ${maskedEmail}. It expires in 5 minutes.`, sentTo: maskedEmail, resendIn: cooldownSec, expiresIn: 300 });
  } catch (err) { next(err); }
}

// ── CGM: Submit for Approval ─────────────────────────────────────────────────

exports.requestCgmSubmitOtp = (req, res, next) => genericRequestOtp({
  req, res, next,
  purpose: 'cgm_submit',
  requiredRole: 'CGM',
  requiredStatus: 'GM_Recommended',
  emailSubject: 'HMWSSB - OTP Verification for CGM Submission',
});

exports.verifyCgmSubmit = (req, res, next) => genericOtpApproval({
  req, res, next,
  purpose: 'cgm_submit',
  requiredRole: 'CGM',
  requiredStatus: 'GM_Recommended',
  newStatus: 'CGM_Submitted',
  nextDesignation: 'DOP',
  actionName: 'SubmitForApproval',
  actionLabel: 'CGM submitted for approval',
  emailSubject: 'HMWSSB - OTP Verification for CGM Submission',
  successMessage: 'OTP verified. Submitted for approval and forwarded to DOP.',
});

// ── DOP: Approve ─────────────────────────────────────────────────────────────

exports.requestDopApproveOtp = (req, res, next) => genericRequestOtp({
  req, res, next,
  purpose: 'dop_approve',
  requiredRole: 'DOP',
  requiredStatus: 'CGM_Submitted',
  emailSubject: 'HMWSSB - OTP Verification for DOP Approval',
});

exports.verifyDopApprove = (req, res, next) => genericOtpApproval({
  req, res, next,
  purpose: 'dop_approve',
  requiredRole: 'DOP',
  requiredStatus: 'CGM_Submitted',
  newStatus: 'DOP_Approved',
  nextDesignation: 'ED',
  actionName: 'Approve',
  actionLabel: 'DOP approved',
  emailSubject: 'HMWSSB - OTP Verification for DOP Approval',
  successMessage: 'OTP verified. Approved and forwarded to ED.',
});

// ── ED: Approve ──────────────────────────────────────────────────────────────

exports.requestEdApproveOtp = (req, res, next) => genericRequestOtp({
  req, res, next,
  purpose: 'ed_approve',
  requiredRole: 'ED',
  requiredStatus: 'DOP_Approved',
  emailSubject: 'HMWSSB - OTP Verification for ED Approval',
});

exports.verifyEdApprove = (req, res, next) => genericOtpApproval({
  req, res, next,
  purpose: 'ed_approve',
  requiredRole: 'ED',
  requiredStatus: 'DOP_Approved',
  newStatus: 'ED_Approved',
  nextDesignation: 'MD',
  actionName: 'Approve',
  actionLabel: 'ED approved',
  emailSubject: 'HMWSSB - OTP Verification for ED Approval',
  successMessage: 'OTP verified. Approved and forwarded to MD.',
});

// ── MD: Final Approve ────────────────────────────────────────────────────────

exports.requestMdFinalOtp = (req, res, next) => genericRequestOtp({
  req, res, next,
  purpose: 'md_final',
  requiredRole: 'MD',
  requiredStatus: 'ED_Approved',
  emailSubject: 'HMWSSB - OTP Verification for MD Final Approval',
});

exports.verifyMdFinal = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { otpCode, certificateId, remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'MD')
      return res.status(403).json({ error: 'Only MD can perform final approval' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== 'ED_Approved')
      return res.status(400).json({ error: 'Only ED_Approved estimates can receive final approval from MD' });
    if (!otpCode || !String(otpCode).trim())
      return res.status(400).json({ error: 'OTP is required to confirm final approval' });

    // Verify OTP
    const otpRes = await db.query(
      `SELECT * FROM "SignatureOTP"
       WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = 'md_final' AND "Verified" = FALSE
       ORDER BY "OTPID" DESC LIMIT 1`,
      [estimateId, userId]
    );
    if (otpRes.rows.length === 0)
      return res.status(400).json({ error: 'No OTP requested. Request an OTP first.' });
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

    // Re-read for race safety
    const fresh = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    const freshEst = fresh.rows[0];
    if (freshEst.CurrentOwner !== userId)
      return res.status(409).json({ error: 'Estimate ownership has changed. Refresh and try again.' });
    if (freshEst.Status !== 'ED_Approved')
      return res.status(409).json({ error: 'Estimate is no longer in ED_Approved status. Refresh and try again.' });

    const fcnAuthorityRole = req.body.fcnAuthorityRole || 'DirectorOfAdministration';
    if (fcnAuthorityRole !== 'DirectorOfAdministration')
      return res.status(400).json({ error: 'FCN authority must be DirectorOfAdministration' });

    const fcnAuthorityUser = await findUserByDesignation(fcnAuthorityRole);
    if (!fcnAuthorityUser) return res.status(400).json({ error: `No ${fcnAuthorityRole} found in system` });

    const certId = (certificateId && String(certificateId).trim())
      || `HMWSSB-DSC-${String(est.EstimateID).padStart(6, '0')}`;

    const abstract = await db.query('SELECT "GrandTotal" FROM "Abstract" WHERE "EstimateID" = $1', [estimateId]);
    const grandTotal = abstract.rows[0]?.GrandTotal || 0;

    const signatureHash = crypto.createHash('sha256')
      .update(`${est.EstimateNo}|${est.NameOfWork}|${est.FinancialYear}|${grandTotal}|${certId}|${new Date().toISOString()}`)
      .digest('hex');

    const currentVersion = await getOrCreateVersion(estimateId);

    let tenderNo;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "EstimateHeader"
         SET "Status" = 'FinalApproved', "CurrentOwner" = $1,
             "FCNAuthorityRole" = $2, "FCNAuthorityUserID" = $3,
             "IsDigitallySigned" = TRUE, "DigitallySignedBy" = $4, "DigitallySignedDate" = now(),
             "CertificateID" = $5, "SignatureHash" = $6,
             "LastModifiedBy" = $4, "LastModifiedDate" = now()
         WHERE "EstimateID" = $7 AND "Status" = 'ED_Approved' AND "CurrentOwner" = $4`,
        [fcnAuthorityUser.UserID, fcnAuthorityRole, fcnAuthorityUser.UserID,
         userId, certId, signatureHash, estimateId]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Estimate has already been processed or is not in an approvable state' });
      }

      // Auto-create tender at final approval. The tender number is computed and
      // INSERTED under the same advisory lock (generateTenderNo runs on this
      // transaction's connection and holds the lock until commit), so concurrent
      // final-approvals can never mint the same number.
      tenderNo = await generateTenderNo(est.FinancialYear, client);
      await client.query(
        `INSERT INTO "Tender" ("EstimateID","TenderNo","TenderDate","EstimatedCost","Status")
         VALUES ($1,$2,CURRENT_DATE,$3,'Draft') RETURNING *`,
        [estimateId, tenderNo, grandTotal]
      );

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'FinalApprove',$4,TRUE,$5)`,
        [estimateId, userId, fcnAuthorityUser.UserID, currentVersion,
          `MD final approved & OTP verified. Digitally signed with certificate ${certId}. Tender ${tenderNo} auto-created. FCN authority: ${fcnAuthorityRole}.`]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'FinalApprove',$3)`,
        [estimateId, userId,
          `MD final approved ${est.EstimateNo} (v${currentVersion}) with cert ${certId} after OTP verification. Previous status: ${est.Status}. New status: FinalApproved. FCN authority: ${fcnAuthorityRole}.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      try { client.release(); } catch (_) {}
    }

    // Stop SLA for MD stage, start FCN SLA
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    await startSla('Estimate', 'FCN', estimateId);

    res.json({
      message: `MD final approved. OTP verified. Digitally signed. FCN authority: ${fcnAuthorityRole}.`,
      tenderNo,
      signatureHash,
    });

    try {
      await sendNotification(estimateId, fcnAuthorityUser.UserID, 'FinalApprove',
        `Estimate ${est.EstimateNo} has been final approved by MD (OTP verified). Tender ${tenderNo} auto-created. Please generate FCN.`, {
          email: {
            to: await resolveEmail(fcnAuthorityUser.UserID),
            subject: `HMWSSB - Estimate ${est.EstimateNo} final approved, pending FCN generation`,
            recipientName: fcnAuthorityUser.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
            action: `Final approved by MD. Tender ${tenderNo} auto-created. Pending FCN generation.`,
            fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
            dateTime: formatIstTime(new Date()),
          }
        });
    } catch (_) {}
  } catch (err) { next(err); }
};

exports.publishTender = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner' });
    if (!['TSApproved'].includes(est.Status))
      return res.status(400).json({ error: 'Only TSApproved estimates can have tender published' });
    if (req.user.Designation !== 'TenderOfficer')
      return res.status(403).json({ error: 'Only TenderOfficer can publish tender' });

    const director = await findUserByDesignation('DirectorOfAdministration');
    if (!director) return res.status(400).json({ error: 'No DirectorOfAdministration found' });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'TenderPublished', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
      [director.UserID, estimateId]
    );

    await db.query(
      `UPDATE "Tender" SET "Status" = 'Published' WHERE "EstimateID" = $1`,
      [estimateId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'PublishTender',$4,TRUE,$5)`,
      [estimateId, userId, director.UserID, currentVersion, remarks || 'Tender published']
    );

    await auditLog(estimateId, userId, 'PublishTender',
      `TenderOfficer published tender for ${est.EstimateNo} (v${currentVersion}). Previous status: ${est.Status}. New status: TenderPublished.`);

    await sendNotification(estimateId, director.UserID, 'PublishTender',
      `Tender for ${est.EstimateNo} has been published, awaiting agency selection`, {
        email: {
          to: await resolveEmail(director.UserID),
          subject: `HMWSSB - Tender published for ${est.EstimateNo}`,
          recipientName: director.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: 'Tender published, awaiting agency selection',
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: 'Tender published. Forwarded to Director of Administration.' });
  } catch (err) { next(err); }
};

exports.selectAgency = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner' });
    if (est.Status !== 'TenderPublished')
      return res.status(400).json({ error: 'Only TenderPublished estimates can have agency selected' });
    if (req.user.Designation !== 'DirectorOfAdministration')
      return res.status(403).json({ error: 'Only DirectorOfAdministration can select agency' });

    const se = await findUserByDesignation('SiteEngineer');
    if (!se) return res.status(400).json({ error: 'No SiteEngineer found' });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'AgencySelected', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
      [se.UserID, estimateId]
    );

    // Audit fix 6.2: the tender itself must advance when an agency is chosen,
    // even if the bid-award endpoint was never used, so dashboard counts and
    // NIT lists reflect reality. Never regresses a tender already at or past
    // the award stage (WorkAwarded / WorkOrderIssued / AgreementExecuted keep
    // their state and contract identifiers) — only pre-award tenders advance.
    await db.query(
      `UPDATE "Tender" SET "Status" = 'Awarded'
       WHERE "EstimateID" = $1
         AND "Status" NOT IN ('Awarded','WorkAwarded','WorkOrderIssued','AgreementExecuted')`,
      [estimateId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'SelectAgency',$4,TRUE,$5)`,
      [estimateId, userId, se.UserID, currentVersion, remarks || 'Agency selected']
    );

    await auditLog(estimateId, userId, 'SelectAgency',
      `DirectorOfAdministration selected agency for ${est.EstimateNo} (v${currentVersion}). Previous status: ${est.Status}. New status: AgencySelected.`);

    await sendNotification(estimateId, se.UserID, 'SelectAgency',
      `Agency selected for ${est.EstimateNo}. Work can now start.`, {
        email: {
          to: await resolveEmail(se.UserID),
          subject: `HMWSSB - Agency selected for ${est.EstimateNo}`,
          recipientName: se.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: 'Agency selected, work can now start',
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: 'Agency selected. Forwarded to Site Engineer.' });
  } catch (err) { next(err); }
};

exports.startWork = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (req.user.Designation !== 'SiteEngineer')
      return res.status(403).json({ error: 'Only SiteEngineer can start work' });
    if (est.Status === 'WorkStarted')
      return res.status(400).json({ error: 'Work has already been started for this estimate' });
    if (est.Status !== 'AgencySelected')
      return res.status(400).json({ error: `Work can only be started after an agency has been selected (current status: ${est.Status})` });

    // The Agency row linked to the estimate is the single authoritative
    // "finalized agency" record (created by the Procurement Officer via
    // createAgency). An estimate that claims AgencySelected but has no such
    // record is internally inconsistent — surface that clearly instead of the
    // generic "never had an agency" message.
    const agency = await db.query('SELECT "AgencyID" FROM "Agency" WHERE "EstimateID" = $1 LIMIT 1', [estimateId]);
    if (agency.rows.length === 0)
      return res.status(400).json({
        error: est.Status === 'AgencySelected'
          ? 'Agency selection record is incomplete. Please verify the finalized agency before starting work.'
          : 'No agency/contractor has been finalized for this estimate. The Procurement Officer must create the agency record before work can start.',
      });

    const currentVersion = await getOrCreateVersion(estimateId);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const upd = await client.query(
        `UPDATE "EstimateHeader"
         SET "Status" = 'WorkStarted', "CurrentOwner" = $1,
             "StartedDate" = COALESCE("StartedDate", now()),
             "StartedBy" = COALESCE("StartedBy", $2),
             "LastModifiedBy" = $2, "LastModifiedDate" = now()
         WHERE "EstimateID" = $3 AND "Status" = 'AgencySelected'`,
        [userId, userId, estimateId]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Work has already been started for this estimate' });
      }

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'StartWork',$4,TRUE,$5)`,
        [estimateId, userId, userId, currentVersion, remarks || 'Work started']
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'StartWork',$3)`,
        [estimateId, userId,
          `Work started by ${req.user.Name} (${req.user.Designation}). Previous status: ${est.Status}. New status: WorkStarted.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await sendNotification(estimateId, est.CreatedBy, 'StartWork',
      `Work for ${est.EstimateNo} has started.`);

    res.json({ message: 'Work started successfully' });
  } catch (err) { next(err); }
};

exports.completeWork = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner' });
    if (est.Status !== 'WorkStarted')
      return res.status(400).json({ error: 'Only WorkStarted estimates can be marked complete' });
    if (req.user.Designation !== 'SiteEngineer')
      return res.status(403).json({ error: 'Only SiteEngineer can complete work' });

    const bo = await findUserByDesignation('BillingOfficer');
    if (!bo) return res.status(400).json({ error: 'No BillingOfficer found' });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'WorkCompleted', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
      [bo.UserID, estimateId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'CompleteWork',$4,TRUE,$5)`,
      [estimateId, userId, bo.UserID, currentVersion, remarks || 'Work completed']
    );

    await auditLog(estimateId, userId, 'CompleteWork',
      `SiteEngineer completed work for ${est.EstimateNo} (v${currentVersion}). Previous status: ${est.Status}. New status: WorkCompleted.`);

    await sendNotification(estimateId, bo.UserID, 'CompleteWork',
      `Work for ${est.EstimateNo} is completed. Bills can now be prepared.`, {
        email: {
          to: await resolveEmail(bo.UserID),
          subject: `HMWSSB - Work completed for ${est.EstimateNo}, billing pending`,
          recipientName: bo.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: 'Work completed, bills can now be prepared',
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: 'Work completed. Forwarded to Billing Officer.' });
  } catch (err) { next(err); }
};

exports.submitBill = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner' });
    if (est.Status !== 'WorkCompleted')
      return res.status(400).json({ error: 'Only WorkCompleted estimates can have bills submitted' });
    if (req.user.Designation !== 'BillingOfficer')
      return res.status(403).json({ error: 'Only BillingOfficer can submit bills' });

    const admin = await findUserByDesignation('Administrator');
    if (!admin) return res.status(400).json({ error: 'No Administrator found' });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'Billing', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
      [admin.UserID, estimateId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'SubmitBill',$4,TRUE,$5)`,
      [estimateId, userId, admin.UserID, currentVersion, remarks || 'Bill submitted']
    );

    await auditLog(estimateId, userId, 'SubmitBill',
      `BillingOfficer submitted bill for ${est.EstimateNo} (v${currentVersion}). Previous status: ${est.Status}. New status: Billing.`);

    await sendNotification(estimateId, admin.UserID, 'SubmitBill',
      `Bill for ${est.EstimateNo} has been submitted for archiving.`, {
        email: {
          to: await resolveEmail(admin.UserID),
          subject: `HMWSSB - Bill submitted for ${est.EstimateNo}, archiving pending`,
          recipientName: admin.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
          action: 'Bill submitted for archiving',
          fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
          dateTime: formatIstTime(new Date()),
        }
      });
    res.json({ message: 'Bill submitted. Forwarded to Administrator for archiving.' });
  } catch (err) { next(err); }
};

exports.archiveComplete = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner' });
    if (est.Status !== 'Billing')
      return res.status(400).json({ error: 'Only Billing estimates can be archived' });
    if (req.user.Designation !== 'Administrator')
      return res.status(403).json({ error: 'Only Administrator can archive estimates' });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader"
       SET "Status" = 'Completed', "IsCompleted" = TRUE, "CompletedDate" = now(), "CompletedBy" = $2
       WHERE "EstimateID" = $1`,
      [estimateId, userId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'Archive',$4,TRUE,$5)`,
      [estimateId, userId, userId, currentVersion, remarks || 'Estimate archived and closed']
    );

    await auditLog(estimateId, userId, 'Archive',
      `Administrator archived ${est.EstimateNo} (v${currentVersion}). Previous status: ${est.Status}. New status: Completed.`);

    await sendNotification(estimateId, est.CreatedBy, 'Archive',
      `Estimate ${est.EstimateNo} has been archived and closed.`);

    res.json({ message: 'Estimate archived and completed.' });
  } catch (err) { next(err); }
};

exports.getWorkflow = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT w.*, fu."Name" as "FromUserName", fu."Designation" as "FromDesignation",
               tu."Name" as "ToUserName", tu."Designation" as "ToDesignation"
       FROM "Workflow" w
       LEFT JOIN "Users" fu ON fu."UserID" = w."FromUserID"
       LEFT JOIN "Users" tu ON tu."UserID" = w."ToUserID"
       WHERE w."EstimateID" = $1
       ORDER BY w."DateTime"`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.getPendingApprovals = async (req, res, next) => {
  try {
    const userId = req.user.UserID;
    const result = await db.query(
      `SELECT eh.*, u."Name" as "CreatedByName", COALESCE(ab."GrandTotal",0) as "GrandTotal"
       FROM "EstimateHeader" eh
       JOIN "Users" u ON u."UserID" = eh."CreatedBy"
       LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
       WHERE eh."CurrentOwner" = $1
       ORDER BY eh."CreatedDate" DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

// ── Post-Approval Workflow: FCN → AdminSanction → GM Review → DGM Review ─────

exports.generateFCN = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'DirectorOfAdministration')
      return res.status(403).json({ error: 'Only Director of Administration can generate FCN' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== 'FinalApproved')
      return res.status(400).json({ error: 'Only FinalApproved estimates can have FCN generated' });

    // FCN number is authoritative from the FCN_Seq sequence — no manual entry.
    const fcnNo = await generateFcnNo(est.FinancialYear);

    const currentVersion = await getOrCreateVersion(estimateId);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Create FCN record
      const fcnRes = await client.query(
        `INSERT INTO "FCN" ("EstimateID", "FCNNo", "FCNDate", "GeneratedBy", "Status", "Remarks")
         VALUES ($1, $2, CURRENT_DATE, $3, 'Generated', $4)
         RETURNING *`,
        [estimateId, fcnNo, userId, remarks || 'FCN generated by Director of Administration']
      );

      // Update estimate status. Director remains owner — they proceed to Administrative Sanction.
      await client.query(
        `UPDATE "EstimateHeader" SET "Status" = 'FCNGenerated', "FCNID" = $1,
         "LastModifiedBy" = $2, "LastModifiedDate" = now()
         WHERE "EstimateID" = $3`,
        [fcnRes.rows[0].FCNID, userId, estimateId]
      );

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'GenerateFCN',$4,TRUE,$5)`,
        [estimateId, userId, userId, currentVersion, remarks || `FCN ${fcnNo} generated`]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'GenerateFCN',$3)`,
        [estimateId, userId, `DirectorOfAdministration generated FCN ${fcnNo} for ${est.EstimateNo}. Proceeding to Administrative Sanction.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      try { client.release(); } catch (_) {}
    }

    await startSla('Estimate', 'DirectorAdmin', estimateId);

    res.json({ message: `FCN ${fcnNo} generated. Ready for Administrative Sanction.`, fcnNo });

    try {
      await sendNotification(estimateId, userId, 'GenerateFCN',
        `FCN ${fcnNo} generated for estimate ${est.EstimateNo}. Proceed to Administrative Sanction.`, {
          email: {
            to: await resolveEmail(userId),
            subject: `HMWSSB - FCN ${fcnNo} generated for ${est.EstimateNo}, pending Administrative Sanction`,
            recipientName: req.user.Name || req.user.Username, estimateNo: est.EstimateNo, workName: est.NameOfWork,
            action: `FCN ${fcnNo} generated. Proceed to Administrative Sanction.`,
            fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
            dateTime: formatIstTime(new Date()),
          }
        });
    } catch (_) {}
  } catch (err) { next(err); }
};

exports.generateAdminSanction = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { sanctionNo, remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'DirectorOfAdministration')
      return res.status(403).json({ error: 'Only DirectorOfAdministration can generate Administrative Sanction' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== 'FCNGenerated')
      return res.status(400).json({ error: 'Only FCNGenerated estimates can have Administrative Sanction generated' });

    if (!sanctionNo || !String(sanctionNo).trim())
      return res.status(400).json({ error: 'Sanction number is required' });

    const currentVersion = await getOrCreateVersion(estimateId);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Reuse an existing AS row (e.g. after ReturnToFCN) — never re-insert,
      // "AdminSanction_EstimateID_unique" would make a second row throw.
      const existingAs = (await client.query(
        'SELECT "SanctionID" FROM "AdministrativeSanction" WHERE "EstimateID" = $1', [estimateId])).rows[0];
      let sanctionId;
      if (existingAs) {
        await client.query(
          `UPDATE "AdministrativeSanction" SET "SanctionNo" = $1, "SanctionDate" = CURRENT_DATE,
           "GeneratedBy" = $2, "Status" = 'Generated', "Remarks" = $3
           WHERE "SanctionID" = $4`,
          [String(sanctionNo).trim(), userId, remarks || 'Administrative sanction generated', existingAs.SanctionID]);
        sanctionId = existingAs.SanctionID;
      } else {
        const sanRes = await client.query(
          `INSERT INTO "AdministrativeSanction" ("EstimateID", "SanctionNo", "SanctionDate", "GeneratedBy", "Status", "Remarks")
           VALUES ($1, $2, CURRENT_DATE, $3, 'Generated', $4)
           RETURNING *`,
          [estimateId, String(sanctionNo).trim(), userId, remarks || 'Administrative sanction generated']
        );
        sanctionId = sanRes.rows[0].SanctionID;
      }

      // Director keeps owner — they will assign TS authority next
      await client.query(
        `UPDATE "EstimateHeader" SET "Status" = 'AdminSanctionGenerated', "AdminSanctionID" = $1
         WHERE "EstimateID" = $2`,
        [sanctionId, estimateId]
      );

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'GenerateSanction',$4,TRUE,$5)`,
        [estimateId, userId, userId, currentVersion, remarks || `Sanction ${sanctionNo} generated`]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'GenerateSanction',$3)`,
        [estimateId, userId, `DirectorOfAdministration generated Administrative Sanction ${sanctionNo} for ${est.EstimateNo}. Ready for TS authority assignment.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      try { client.release(); } catch (_) {}
    }

    await startSla('Estimate', 'DirectorAdmin', estimateId);

    res.json({ message: `Administrative Sanction ${sanctionNo} generated. Ready for TS authority assignment.`, sanctionNo });
  } catch (err) { next(err); }
};

// ── Assign TS Authority (DirectorOfAdministration) ────────────────────────────
exports.assignTsAuthority = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;
    const { AuthorityRole, AuthorityUserID } = req.body;
    const remarks = req.body.remarks || '';

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'DirectorOfAdministration')
      return res.status(403).json({ error: 'Only DirectorOfAdministration can assign TS authority' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== 'AdminSanctionGenerated')
      return res.status(400).json({ error: 'Only AdminSanctionGenerated estimates can have TS authority assigned' });

    // Resolve the target authority user
    let targetUser;
    if (AuthorityUserID) {
      targetUser = (await db.query('SELECT * FROM "Users" WHERE "UserID" = $1 AND "IsActive" = TRUE', [AuthorityUserID])).rows[0];
      if (!targetUser) return res.status(400).json({ error: 'Specified user not found or inactive' });
    } else if (AuthorityRole) {
      if (!['DirectorOfAdministration', 'GM', 'DGM'].includes(AuthorityRole))
        return res.status(400).json({ error: 'AuthorityRole must be DirectorOfAdministration, GM, or DGM' });
      targetUser = await findUserByDesignation(AuthorityRole);
      if (!targetUser) return res.status(400).json({ error: `No active user with designation ${AuthorityRole} found` });
    } else {
      return res.status(400).json({ error: 'Either AuthorityRole or AuthorityUserID is required' });
    }

    // Check no existing active (Pending) TS assignment
    const existing = await db.query(
      'SELECT "TSID" FROM "TechnicalSanction" WHERE "EstimateID" = $1 AND "Status" = \'Pending\'', [estimateId]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'A Pending Technical Sanction already exists for this estimate' });

    // Check no self-selection: cannot assign to yourself
    if (targetUser.UserID === userId)
      return res.status(403).json({ error: 'Cannot assign TS authority to yourself' });

    const currentVersion = await getOrCreateVersion(estimateId);
    const client = await db.getClient();
    let tsId;
    try {
      await client.query('BEGIN');

      // Upsert TS row — if Returned, reuse the existing row
      const existingTs = (await client.query(
        'SELECT "TSID" FROM "TechnicalSanction" WHERE "EstimateID" = $1', [estimateId])).rows[0];

      if (existingTs) {
        await client.query(
          `UPDATE "TechnicalSanction" SET "AuthorityRole" = $1, "AuthorityUserID" = $2, "AssignedBy" = $3,
           "AssignedAt" = now(), "Status" = 'Pending', "ApprovedBy" = NULL, "ApprovedAt" = NULL, "Remarks" = $4
           WHERE "TSID" = $5`,
          [targetUser.Designation, targetUser.UserID, userId, remarks, existingTs.TSID]);
        tsId = existingTs.TSID;
      } else {
        const tsRes = await client.query(
          `INSERT INTO "TechnicalSanction" ("EstimateID","AuthorityRole","AuthorityUserID","AssignedBy","Status","Remarks")
           VALUES ($1,$2,$3,$4,'Pending',$5) RETURNING "TSID"`,
          [estimateId, targetUser.Designation, targetUser.UserID, userId, remarks]);
        tsId = tsRes.rows[0].TSID;
      }

      await client.query(
        `UPDATE "EstimateHeader" SET "Status" = 'TSPending', "CurrentOwner" = $1, "TSID" = $2
         WHERE "EstimateID" = $3`,
        [targetUser.UserID, tsId, estimateId]
      );

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'AssignTSAuthority',$4,TRUE,$5)`,
        [estimateId, userId, targetUser.UserID, currentVersion,
          remarks || `TS authority assigned to ${targetUser.Designation}`]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'TS_ASSIGNED',$3)`,
        [estimateId, userId,
          `TS authority assigned to ${targetUser.Name} (${targetUser.Designation}) for ${est.EstimateNo}. Previous status: AdminSanctionGenerated. New status: TSPending.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      try { client.release(); } catch (_) {}
    }

    await startSla('Estimate', 'TechnicalSanction', estimateId);

    res.json({ message: `TS authority assigned to ${targetUser.Name} (${targetUser.Designation}). Status: TSPending.`, TSID: tsId });

    try {
      await sendNotification(estimateId, targetUser.UserID, 'AssignTSAuthority',
        `TS authority assigned to you for ${est.EstimateNo}. Please review and approve the Technical Sanction.`, {
          email: {
            to: await resolveEmail(targetUser.UserID),
            subject: `HMWSSB - TS authority assigned for ${est.EstimateNo}`,
            recipientName: targetUser.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
            action: 'TS authority assigned. Pending approval.',
            fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
            dateTime: formatIstTime(new Date()),
          }
        });
    } catch (_) {}
  } catch (err) { next(err); }
};

// ── Approve TS (assigned authority only) ─────────────────────────────────────
exports.approveTs = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;
    const { remarks } = req.body;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.Status !== 'TSPending')
      return res.status(400).json({ error: 'Only TSPending estimates can receive TS approval' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });

    // Fetch TS row
    const tsRes = await db.query('SELECT * FROM "TechnicalSanction" WHERE "EstimateID" = $1', [estimateId]);
    if (!tsRes.rows.length)
      return res.status(400).json({ error: 'No Technical Sanction record found' });
    const ts = tsRes.rows[0];

    if (ts.Status !== 'Pending')
      return res.status(409).json({ error: 'Technical Sanction is not in Pending state' });
    if (ts.AuthorityUserID !== userId)
      return res.status(403).json({ error: 'Only the assigned TS authority can approve' });
    if (req.user.Designation !== ts.AuthorityRole)
      return res.status(403).json({ error: `Only ${ts.AuthorityRole} can approve this TS` });

    const tsNo = await generateTsNo();
    const currentVersion = await getOrCreateVersion(estimateId);

    const tenderOfficer = await findUserByDesignation('TenderOfficer');
    if (!tenderOfficer) return res.status(400).json({ error: 'No TenderOfficer found in system' });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE "TechnicalSanction" SET "Status" = 'Approved', "TSNo" = $1, "TSDate" = CURRENT_DATE,
         "ApprovedBy" = $2, "ApprovedAt" = now(), "Remarks" = $3
         WHERE "TSID" = $4`,
        [tsNo, userId, remarks || 'TS approved', ts.TSID]
      );

      await client.query(
        `UPDATE "EstimateHeader" SET "Status" = 'TSApproved', "CurrentOwner" = $1
         WHERE "EstimateID" = $2`,
        [tenderOfficer.UserID, estimateId]
      );

      await client.query(
        `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
         VALUES ($1,$2,$3,'ApproveTS',$4,TRUE,$5)`,
        [estimateId, userId, tenderOfficer.UserID, currentVersion,
          remarks || `TS ${tsNo} approved`]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'TS_APPROVED',$3)`,
        [estimateId, userId,
          `TS ${tsNo} approved by ${req.user.Name} (${req.user.Designation}) for ${est.EstimateNo}. Previous status: TSPending. New status: TSApproved.`]
      );

      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      try { client.release(); } catch (_) {}
    }

    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    await startSla('Estimate', 'TenderPreparation', estimateId);

    res.json({ message: `TS ${tsNo} approved. Forwarded to Tender Officer.`, tsNo });

    try {
      await sendNotification(estimateId, tenderOfficer.UserID, 'ApproveTS',
        `TS ${tsNo} approved for ${est.EstimateNo}. Ready for tender publication.`, {
          email: {
            to: await resolveEmail(tenderOfficer.UserID),
            subject: `HMWSSB - TS ${tsNo} approved for ${est.EstimateNo}`,
            recipientName: tenderOfficer.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
            action: `TS ${tsNo} approved. Ready for tender publication.`,
            fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
            dateTime: formatIstTime(new Date()),
          }
        });
    } catch (_) {}
  } catch (err) { next(err); }
};

// ── Return TS (assigned authority returns to Director) ────────────────────────
exports.returnTs = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    if (!remarks) return res.status(400).json({ error: 'Remarks required for return' });

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (est.Status !== 'TSPending')
      return res.status(400).json({ error: 'Only TSPending estimates can have TS returned' });

    const tsRes = await db.query('SELECT * FROM "TechnicalSanction" WHERE "EstimateID" = $1', [estimateId]);
    if (!tsRes.rows.length)
      return res.status(400).json({ error: 'No Technical Sanction record found' });
    const ts = tsRes.rows[0];

    if (ts.AuthorityUserID !== userId)
      return res.status(403).json({ error: 'Only the assigned TS authority can return' });

    const currentVersion = await getOrCreateVersion(estimateId);
    const director = await findUserByDesignation('DirectorOfAdministration');
    if (!director) return res.status(500).json({ error: 'DirectorOfAdministration not found' });

    await db.query(
      `UPDATE "TechnicalSanction" SET "Status" = 'Returned', "Remarks" = $1 WHERE "TSID" = $2`,
      [remarks, ts.TSID]
    );
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'AdminSanctionGenerated', "CurrentOwner" = $1,
       "ReturnRemarks" = $2, "ReturnedBy" = $3, "ReturnedAt" = NOW()
       WHERE "EstimateID" = $4`,
      [director.UserID, remarks, userId, estimateId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'ReturnTS',$4,TRUE,$5)`,
      [estimateId, userId, director.UserID, currentVersion, remarks]
    );

    await auditLog(estimateId, userId, 'TS_RETURNED',
      `TS returned by ${req.user.Name} (${req.user.Designation}) for ${est.EstimateNo}. Reason: ${remarks}`);

    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    res.json({ message: 'TS returned to Director for reassignment.' });
  } catch (err) { next(err); }
};

exports.reviewForwardGm = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'GM')
      return res.status(403).json({ error: 'Only GM can perform this review action' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== 'AdminSanctionGenerated')
      return res.status(400).json({ error: 'Only AdminSanctionGenerated estimates can be reviewed by GM' });

    const dgm = await findUserByDesignation('DGM');
    if (!dgm) return res.status(400).json({ error: 'No DGM found in system' });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'GMReviewed', "CurrentOwner" = $1
       WHERE "EstimateID" = $2`,
      [dgm.UserID, estimateId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'ReviewForwardGM',$4,TRUE,$5)`,
      [estimateId, userId, dgm.UserID, currentVersion, remarks || 'GM reviewed and forwarded to DGM']
    );

    await auditLog(estimateId, userId, 'ReviewForwardGM',
      `GM reviewed and forwarded ${est.EstimateNo} (v${currentVersion}). Previous status: AdminSanctionGenerated. New status: GMReviewed. Forwarded to DGM.`);

    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    await startSla('Estimate', 'DirectorAdmin', estimateId, 'EstimateHeader');

    res.json({ message: 'GM reviewed. Forwarded to DGM for final review before tender.' });

    try {
      await sendNotification(estimateId, dgm.UserID, 'ReviewForwardGM',
        `Estimate ${est.EstimateNo} reviewed and forwarded by GM. Please review and forward to Tender.`, {
          email: {
            to: await resolveEmail(dgm.UserID),
            subject: `HMWSSB - Estimate ${est.EstimateNo} forwarded by GM for final review`,
            recipientName: dgm.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
            action: 'Forwarded by GM for final review before tender',
            fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
            dateTime: formatIstTime(new Date()),
          }
        });
    } catch (_) {}
  } catch (err) { next(err); }
};

exports.reviewForwardDgm = async (req, res, next) => {
  try {
    const estimateId = req.params.id;
    const { remarks } = req.body;
    const userId = req.user.UserID;

    const header = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
    if (header.rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const est = header.rows[0];

    if (req.user.Designation !== 'DGM')
      return res.status(403).json({ error: 'Only DGM can perform this review action' });
    if (est.CurrentOwner !== userId)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    if (est.Status !== 'GMReviewed')
      return res.status(400).json({ error: 'Only GMReviewed estimates can be reviewed by DGM' });

    const tenderOfficer = await findUserByDesignation('TenderOfficer');
    if (!tenderOfficer) return res.status(400).json({ error: 'No TenderOfficer found in system' });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'DGMReviewed', "CurrentOwner" = $1
       WHERE "EstimateID" = $2`,
      [tenderOfficer.UserID, estimateId]
    );

    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'ReviewForwardDGM',$4,TRUE,$5)`,
      [estimateId, userId, tenderOfficer.UserID, currentVersion, remarks || 'DGM reviewed and forwarded to Tender']
    );

    await auditLog(estimateId, userId, 'ReviewForwardDGM',
      `DGM reviewed and forwarded ${est.EstimateNo} (v${currentVersion}). Previous status: GMReviewed. New status: DGMReviewed. Forwarded to TenderOfficer.`);

    await stopSla(estimateId, 'EstimateHeader', 'actioned');

    res.json({ message: 'DGM reviewed. Forwarded to Tender Officer for publication.' });

    try {
      await sendNotification(estimateId, tenderOfficer.UserID, 'ReviewForwardDGM',
        `Estimate ${est.EstimateNo} reviewed and forwarded by DGM. Ready for tender publication.`, {
          email: {
            to: await resolveEmail(tenderOfficer.UserID),
            subject: `HMWSSB - Estimate ${est.EstimateNo} ready for tender publication`,
            recipientName: tenderOfficer.Name, estimateNo: est.EstimateNo, workName: est.NameOfWork,
            action: 'Forwarded by DGM. Ready for tender publication.',
            fromUser: req.user.Name || req.user.Username, fromDesignation: req.user.Designation,
            dateTime: formatIstTime(new Date()),
          }
        });
    } catch (_) {}
  } catch (err) { next(err); }
};

// ── Close Tender (TenderOfficer) ──────────────────────────────────────────────
exports.closeTender = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['TSApproved', 'TenderPublished'].includes(est.Status))
      return res.status(400).json({ error: `Cannot close tender from ${est.Status}` });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'TenderClosed', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
      [userId, estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$2,'CloseTender',$3,TRUE,$4)`,
      [estimateId, userId, currentVersion, remarks || 'Tender closed for submission']
    );
    await auditLog(estimateId, userId, 'CloseTender', `Tender closed for ${est.EstimateNo} (v${currentVersion}).`);
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    res.json({ message: 'Tender closed. Ready for bid evaluation.' });
  } catch (err) { next(err); }
};

// ── Technical Evaluation (TenderOfficer) ─────────────────────────────────────
exports.technicalEval = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['TenderClosed', 'TechnicalEvaluation'].includes(est.Status))
      return res.status(400).json({ error: `Cannot start technical evaluation from ${est.Status}` });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'TechnicalEvaluation' WHERE "EstimateID" = $1`,
      [estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$2,'TechnicalEval',$3,TRUE,$4)`,
      [estimateId, userId, currentVersion, remarks || 'Technical evaluation in progress']
    );
    await auditLog(estimateId, userId, 'TechnicalEval', `Technical evaluation started for ${est.EstimateNo} (v${currentVersion}).`);
    res.json({ message: 'Technical evaluation initiated.' });
  } catch (err) { next(err); }
};

// ── Financial Evaluation (TenderOfficer) ─────────────────────────────────────
exports.financialEval = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['TechnicalEvaluation', 'FinancialEvaluation'].includes(est.Status))
      return res.status(400).json({ error: `Cannot start financial evaluation from ${est.Status}` });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'FinancialEvaluation' WHERE "EstimateID" = $1`,
      [estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$2,'FinancialEval',$3,TRUE,$4)`,
      [estimateId, userId, currentVersion, remarks || 'Financial evaluation in progress']
    );
    await auditLog(estimateId, userId, 'FinancialEval', `Financial evaluation started for ${est.EstimateNo} (v${currentVersion}).`);
    res.json({ message: 'Financial evaluation initiated.' });
  } catch (err) { next(err); }
};

// ── Identify L1 Bidder (TenderOfficer) ──────────────────────────────────────
exports.identifyL1 = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['FinancialEvaluation', 'L1Identified'].includes(est.Status))
      return res.status(400).json({ error: `Cannot identify L1 from ${est.Status}` });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'L1Identified' WHERE "EstimateID" = $1`,
      [estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$2,'IdentifyL1',$3,TRUE,$4)`,
      [estimateId, userId, currentVersion, remarks || 'L1 bidder identified']
    );
    await auditLog(estimateId, userId, 'IdentifyL1', `L1 bidder identified for ${est.EstimateNo} (v${currentVersion}).`);
    res.json({ message: 'L1 bidder identified.' });
  } catch (err) { next(err); }
};

// ── Create Award (DirectorOfAdministration) ────────────────────────────────────
exports.createAward = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['L1Identified', 'WorkAwarded'].includes(est.Status))
      return res.status(400).json({ error: `Cannot create award from ${est.Status}` });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'WorkAwarded' WHERE "EstimateID" = $1`,
      [estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$2,'CreateAward',$3,TRUE,$4)`,
      [estimateId, userId, currentVersion, remarks || 'Work awarded to L1 bidder']
    );
    await auditLog(estimateId, userId, 'CreateAward', `Award created for ${est.EstimateNo} (v${currentVersion}).`);
    res.json({ message: 'Work award created.' });
  } catch (err) { next(err); }
};

// ── Issue Work Order (DirectorOfAdministration) ────────────────────────────────
exports.issueWorkOrder = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['WorkAwarded', 'WorkOrderIssued'].includes(est.Status))
      return res.status(400).json({ error: `Cannot issue work order from ${est.Status}` });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'WorkOrderIssued' WHERE "EstimateID" = $1`,
      [estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$2,'IssueWorkOrder',$3,TRUE,$4)`,
      [estimateId, userId, currentVersion, remarks || 'Work order issued']
    );
    await auditLog(estimateId, userId, 'IssueWorkOrder', `Work order issued for ${est.EstimateNo} (v${currentVersion}).`);
    res.json({ message: 'Work order issued.' });
  } catch (err) { next(err); }
};

// ── Record Agreement (DirectorOfAdministration) ────────────────────────────────
exports.recordAgreement = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['WorkOrderIssued', 'AgreementExecuted'].includes(est.Status))
      return res.status(400).json({ error: `Cannot record agreement from ${est.Status}` });

    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'AgreementExecuted' WHERE "EstimateID" = $1`,
      [estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$2,'RecordAgreement',$3,TRUE,$4)`,
      [estimateId, userId, currentVersion, remarks || 'Agreement executed']
    );
    await auditLog(estimateId, userId, 'RecordAgreement', `Agreement recorded for ${est.EstimateNo} (v${currentVersion}).`);
    res.json({ message: 'Agreement executed. Ready for execution.' });
  } catch (err) { next(err); }
};

// ── Return to FCN (DirectorOfAdministration) ──────────────────────────────────
exports.returnToFCN = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    if (!remarks) return res.status(400).json({ error: 'Remarks required for return' });
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['AdminSanctionGenerated', 'FCNGenerated', 'DGMReviewed'].includes(est.Status))
      return res.status(400).json({ error: `Cannot return from ${est.Status}` });

    const fcnAuthority = await findUserByDesignation(est.FCNAuthorityRole || 'DirectorOfAdministration');
    if (!fcnAuthority) return res.status(500).json({ error: 'FCN authority user not found' });
    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'FCNGenerated', "CurrentOwner" = $1,
       "ReturnRemarks" = $2, "ReturnedBy" = $3, "ReturnedAt" = NOW()
       WHERE "EstimateID" = $4`,
      [fcnAuthority.UserID, remarks, userId, estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'ReturnToFCN',$4,TRUE,$5)`,
      [estimateId, userId, fcnAuthority.UserID, currentVersion, remarks]
    );
    await auditLog(estimateId, userId, 'ReturnToFCN', `Returned to ${est.FCNAuthorityRole || 'DirectorOfAdministration'} for ${est.EstimateNo}. Reason: ${remarks}`);
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    res.json({ message: 'Returned to Director of Administration for FCN rework.' });
  } catch (err) { next(err); }
};

// ── Return to Director (GM) ──────────────────────────────────────────────────
exports.returnToDirector = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    if (!remarks) return res.status(400).json({ error: 'Remarks required for return' });
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['GMReviewed', 'AdminSanctionGenerated'].includes(est.Status))
      return res.status(400).json({ error: `Cannot return from ${est.Status}` });

    const director = await findUserByDesignation('DirectorOfAdministration');
    if (!director) return res.status(500).json({ error: 'DirectorOfAdministration not found' });
    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'AdminSanctionGenerated', "CurrentOwner" = $1,
       "ReturnRemarks" = $2, "ReturnedBy" = $3, "ReturnedAt" = NOW()
       WHERE "EstimateID" = $4`,
      [director.UserID, remarks, userId, estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'ReturnToDirector',$4,TRUE,$5)`,
      [estimateId, userId, director.UserID, currentVersion, remarks]
    );
    await auditLog(estimateId, userId, 'ReturnToDirector', `GM returned to Director for ${est.EstimateNo}. Reason: ${remarks}`);
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    res.json({ message: 'Returned to Director of Administration for rework.' });
  } catch (err) { next(err); }
};

// ── Return to GM (DGM) ───────────────────────────────────────────────────────
exports.returnToGM = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    if (!remarks) return res.status(400).json({ error: 'Remarks required for return' });
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['DGMReviewed', 'GMReviewed'].includes(est.Status))
      return res.status(400).json({ error: `Cannot return from ${est.Status}` });

    const gm = await findUserByDesignation('GM');
    if (!gm) return res.status(500).json({ error: 'GM not found' });
    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'GMReviewed', "CurrentOwner" = $1,
       "ReturnRemarks" = $2, "ReturnedBy" = $3, "ReturnedAt" = NOW()
       WHERE "EstimateID" = $4`,
      [gm.UserID, remarks, userId, estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'ReturnToGM',$4,TRUE,$5)`,
      [estimateId, userId, gm.UserID, currentVersion, remarks]
    );
    await auditLog(estimateId, userId, 'ReturnToGM', `DGM returned to GM for ${est.EstimateNo}. Reason: ${remarks}`);
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    res.json({ message: 'Returned to GM for rework.' });
  } catch (err) { next(err); }
};

// ── Return to DGM (CGM) ──────────────────────────────────────────────────────
exports.returnToDGM = async (req, res, next) => {
  try {
    const { id: estimateId } = req.params;
    const userId = req.user.UserID;
    const { remarks } = req.body;
    if (!remarks) return res.status(400).json({ error: 'Remarks required for return' });
    const est = await getEstimate(estimateId);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!['CGM_Submitted', 'DGM_Approved'].includes(est.Status))
      return res.status(400).json({ error: `Cannot return from ${est.Status}` });

    const dgm = await findUserByDesignation('DGM');
    if (!dgm) return res.status(500).json({ error: 'DGM not found' });
    const currentVersion = await getOrCreateVersion(estimateId);
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'DGM_Approved', "CurrentOwner" = $1,
       "ReturnRemarks" = $2, "ReturnedBy" = $3, "ReturnedAt" = NOW()
       WHERE "EstimateID" = $4`,
      [dgm.UserID, remarks, userId, estimateId]
    );
    await db.query(
      `INSERT INTO "Workflow" ("EstimateID","FromUserID","ToUserID","Action","Version","OTPVerified","Remarks")
       VALUES ($1,$2,$3,'ReturnToDGM',$4,TRUE,$5)`,
      [estimateId, userId, dgm.UserID, currentVersion, remarks]
    );
    await auditLog(estimateId, userId, 'ReturnToDGM', `CGM returned to DGM for ${est.EstimateNo}. Reason: ${remarks}`);
    await stopSla(estimateId, 'EstimateHeader', 'actioned');
    res.json({ message: 'Returned to DGM for rework.' });
  } catch (err) { next(err); }
};

// Shared helpers reused by the T3 bid-submission/bid-opening pipeline.
exports.sendNotification = sendNotification;
exports.formatIstTime = formatIstTime;
