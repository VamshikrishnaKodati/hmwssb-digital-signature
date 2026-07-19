import Estimate from '../models/Estimate.js';
import EstimateItem from '../models/EstimateItem.js';
import EstimateMovement from '../models/EstimateMovement.js';
import AuditLog from '../models/AuditLog.js';
import Signature from '../models/Signature.js';
import {
  generateOTP, hashOTP, saveOtpRecord, getLatestOtpRecord,
  updateOtpRecord, checkExistingOtp, verifyOtpInput, generateDigitalSignature,
  canResendOtp, recordResend, invalidateExistingOtp,
  getBackoffDelay, recordFailedAttempt, clearBackoff,
} from '../services/otpService.js';
import { signPdfDocument, computePdfHash } from '../services/pdfSignService.js';
import { generateAbstractPdf } from '../services/pdfService.js';
import { enqueueOtpDelivery } from '../services/otpQueue.js';
import { sendOtpEmail } from '../utils/emailService.js';
import { sendOtpSms } from '../utils/smsService.js';
import { success, notFound, badRequest, tooManyRequests, forbidden } from '../utils/apiResponse.js';
import { sendNotification } from './notificationController.js';
import { alertOtpFailure, alertOtpSuccess, alertSignatureFailure } from '../services/alertService.js';
import logger from '../utils/logger.js';
import { promises as fs } from 'fs';

const canSignEstimate = (estimate, user) => {
  if (estimate.status === 'OTP Pending') return true;
  if (estimate.status === 'DGM Review' && (user.role === 'dgm' || user.role === 'ce')) return true;
  if (estimate.status === 'GM Review' && (user.role === 'gm' || user.role === 'ce')) return true;
  return false;
};

const maskString = (str, visibleStart = 2, visibleEnd = 2) => {
  if (!str) return '';
  const s = String(str);
  if (s.length <= visibleStart + visibleEnd) return s;
  return s.slice(0, visibleStart) + '*'.repeat(s.length - visibleStart - visibleEnd) + s.slice(-visibleEnd);
};

const sendOtpToChannels = async (otp, email, mobile, estimateId, actorName) => {
  const queued = await enqueueOtpDelivery({
    otp, email, mobile, estimateId, actorName,
  }).catch(() => false);

  if (queued) {
    return {
      emailResult: { success: true, reason: 'queued' },
      smsResult: { success: true, reason: 'queued' },
    };
  }

  const [emailResult, smsResult] = await Promise.all([
    sendOtpEmail({ to: email, otp, estimateId, userName: actorName }).catch(e => ({ success: false, reason: e.message })),
    sendOtpSms({ to: mobile, otp, estimateId }).catch(e => ({ success: false, reason: e.message })),
  ]);
  return { emailResult, smsResult };
};

const updateDeliveryStatus = async (otpDoc, emailResult, smsResult) => {
  otpDoc.emailSent = emailResult.success;
  otpDoc.emailTime = emailResult.success ? new Date() : null;
  otpDoc.smsSent = smsResult.success;
  otpDoc.smsTime = smsResult.success ? new Date() : null;
  if (!emailResult.success || !smsResult.success) {
    otpDoc.deliveryError = [
      !emailResult.success ? `Email: ${emailResult.reason}` : '',
      !smsResult.success ? `SMS: ${smsResult.reason}` : '',
    ].filter(Boolean).join('; ');
  }
  return updateOtpRecord(otpDoc);
};

export const sendOTP = async (req, res, next) => {
  try {
    const { estimateId, email, mobile } = req.body;
    const actorId = req.user.id;
    const actorName = req.user.name;
    const actorRole = req.user.role;

    const estimate = await Estimate.findOne({ estimateId });
    if (!estimate) return notFound(res, 'Estimate not found');

    if (estimate.locked) {
      return forbidden(res, 'Estimate is locked. Cannot send OTP.');
    }

    if (!canSignEstimate(estimate, req.user)) {
      return badRequest(res, `OTP can only be sent for estimates in "OTP Pending", "DGM Review" (for DGM), or "GM Review" (for GM). Current status: ${estimate.status}`);
    }

    const backoffDelay = getBackoffDelay(actorId, estimateId);
    if (backoffDelay > 0) {
      return tooManyRequests(res, `Too many failed attempts. Please wait ${backoffDelay} seconds before trying again.`);
    }

    const existingOtp = await checkExistingOtp(estimateId, actorId);
    if (existingOtp) {
      const cooldown = canResendOtp(actorId, estimateId);
      if (!cooldown.allowed) {
        if (cooldown.reason === 'rate_limited') {
          return tooManyRequests(res, `Maximum OTP resends reached. Please wait ${Math.ceil(cooldown.retryAfter / 60)} minutes.`);
        }
        return tooManyRequests(res, `Please wait ${cooldown.retryAfter} seconds before resending.`);
      }
    }

    if (existingOtp) {
      await invalidateExistingOtp(estimateId, actorId);
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpDoc = await saveOtpRecord({
      estimateId,
      managerId: actorId,
      email,
      mobile,
      otpHash,
      verified: false,
      attempts: 0,
      expiresAt,
      requestIp: req.ip,
      requestUserAgent: req.headers['user-agent'],
      resendCount: existingOtp ? (existingOtp.resendCount || 0) + 1 : 0,
    });

    const { emailResult, smsResult } = await sendOtpToChannels(otp, email, mobile, estimateId, actorName);
    await updateDeliveryStatus(otpDoc, emailResult, smsResult);

    recordResend(actorId, estimateId);

    await AuditLog.create({
      userId: actorId,
      actorName,
      actorRole,
      action: 'OTP_SENT',
      entity: 'Estimate',
      entityId: estimateId,
      module: 'OTP',
      description: `OTP sent for estimate ${estimateId}${existingOtp ? ' (resend)' : ''}`,
      details: {
        email: maskString(email),
        mobile: maskString(mobile),
        emailDelivered: emailResult.success,
        smsDelivered: smsResult.success,
        expiresAt,
        resendCount: otpDoc.resendCount,
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendNotification({
      userId: actorId,
      title: 'OTP Sent',
      message: `OTP has been sent for estimate ${estimateId}`,
      type: 'info',
      link: `/estimates/${estimateId}`,
    });

    return success(res, {
      message: 'OTP sent successfully. Please check your email and SMS.',
      data: {
        delivery: {
          email: emailResult.success,
          sms: smsResult.success,
          maskedEmail: maskString(email, 1, 4),
          maskedMobile: maskString(mobile, 2, 2),
        },
      },
    });
  } catch (err) {
    logger.error('OTP', 'sendOTP error', { error: err.message });
    next(err);
  }
};

export const resendOTP = async (req, res, next) => {
  try {
    const { estimateId } = req.body;
    const actorId = req.user.id;
    const actorName = req.user.name;
    const actorRole = req.user.role;

    const estimate = await Estimate.findOne({ estimateId });
    if (!estimate) return notFound(res, 'Estimate not found');

    if (estimate.locked) {
      return forbidden(res, 'Estimate is locked. Cannot resend OTP.');
    }

    if (!canSignEstimate(estimate, req.user)) {
      return badRequest(res, `OTP can only be resent for estimates in active review status. Current: ${estimate.status}`);
    }

    const backoffDelay = getBackoffDelay(actorId, estimateId);
    if (backoffDelay > 0) {
      return tooManyRequests(res, `Too many failed attempts. Please wait ${backoffDelay} seconds.`);
    }

    const cooldown = canResendOtp(actorId, estimateId);
    if (!cooldown.allowed) {
      if (cooldown.reason === 'rate_limited') {
        return tooManyRequests(res, `Maximum resends reached for this hour. Try again later.`);
      }
      return tooManyRequests(res, `Please wait ${cooldown.retryAfter} seconds before resending.`);
    }

    await invalidateExistingOtp(estimateId, actorId);

    const previousOtp = await getLatestOtpRecord(estimateId, actorId);
    const email = previousOtp?.email || req.user.email;
    const mobile = previousOtp?.mobile || req.user.mobile;

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpDoc = await saveOtpRecord({
      estimateId,
      managerId: actorId,
      email,
      mobile,
      otpHash,
      verified: false,
      attempts: 0,
      expiresAt,
      requestIp: req.ip,
      requestUserAgent: req.headers['user-agent'],
      resendCount: (previousOtp?.resendCount || 0) + 1,
    });

    const { emailResult, smsResult } = await sendOtpToChannels(otp, email, mobile, estimateId, actorName);
    await updateDeliveryStatus(otpDoc, emailResult, smsResult);

    recordResend(actorId, estimateId);

    await AuditLog.create({
      userId: actorId,
      actorName,
      actorRole,
      action: 'OTP_SENT',
      entity: 'Estimate',
      entityId: estimateId,
      module: 'OTP',
      description: `OTP resent for estimate ${estimateId}`,
      details: {
        email: maskString(email),
        mobile: maskString(mobile),
        emailDelivered: emailResult.success,
        smsDelivered: smsResult.success,
        expiresAt,
        resendCount: otpDoc.resendCount,
        isResend: true,
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, {
      message: 'A fresh OTP has been sent. Please check your email and SMS.',
      data: {
        delivery: {
          email: emailResult.success,
          sms: smsResult.success,
          maskedEmail: maskString(email, 1, 4),
          maskedMobile: maskString(mobile, 2, 2),
        },
      },
    });
  } catch (err) {
    logger.error('OTP', 'resendOTP error', { error: err.message });
    next(err);
  }
};

export const verifyOTP = async (req, res, next) => {
  try {
    const { estimateId, otp } = req.body;
    const actorId = req.user.id;
    const actorName = req.user.name;
    const actorRole = req.user.role;
    const actorDesignation = req.user.designation || '';

    const estimate = await Estimate.findOne({ estimateId });
    if (!estimate) return notFound(res, 'Estimate not found');

    if (!canSignEstimate(estimate, req.user)) {
      return badRequest(res, `OTP can only be verified for estimates in "OTP Pending", "DGM Review" (for DGM), or "GM Review" (for GM). Current status: ${estimate.status}`);
    }

    const backoffDelay = getBackoffDelay(actorId, estimateId);
    if (backoffDelay > 0) {
      return tooManyRequests(res, `Too many failed attempts. Please wait ${backoffDelay} seconds before trying again.`);
    }

    const record = await getLatestOtpRecord(estimateId, actorId);
    if (!record || record.verified) {
      return badRequest(res, 'No active OTP found. Please request a new one.');
    }
    if (record.isExpired()) {
      return badRequest(res, 'OTP has expired. Please request a new one.');
    }
    if (record.maxAttemptsReached()) {
      return badRequest(res, 'Maximum verification attempts reached. Please request a new OTP.');
    }

    const isValid = verifyOtpInput(otp, record.otpHash);
    if (!isValid) {
      record.attempts = (record.attempts || 0) + 1;
      await updateOtpRecord(record);

      const remainingAttempts = 5 - record.attempts;
      recordFailedAttempt(actorId, estimateId);
      alertOtpFailure(actorId, estimateId, 'invalid_otp');

      await AuditLog.create({
        userId: actorId,
        actorName,
        actorRole,
        action: 'OTP_FAILED',
        entity: 'Estimate',
        entityId: estimateId,
        module: 'OTP',
        description: `Failed OTP verification for estimate ${estimateId} (${record.attempts}/5 attempts)`,
        details: { attempts: record.attempts, remainingAttempts },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if (record.attempts >= 5) {
        return badRequest(res, 'Maximum verification attempts reached. Please request a new OTP.');
      }
      return badRequest(res, `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`);
    }

    clearBackoff(actorId, estimateId);

    record.verified = true;
    const signature = generateDigitalSignature({
      estimateId,
      managerId: actorId,
    });
    record.signature = signature;
    await updateOtpRecord(record);

    let signedPdfResult = null;
    let pdfPath = null;
    let pdfSigningSucceeded = false;
    try {
      const items = await EstimateItem.find({ estimateId }).lean();
      pdfPath = await generateAbstractPdf(estimate, items);
      const pdfBuffer = await fs.readFile(pdfPath);
      signedPdfResult = await signPdfDocument(pdfBuffer, actorId, {
        reason: `OTP-verified digital signature by ${actorName} (${actorRole})`,
        signerName: actorName,
        contactInfo: actorDesignation || actorRole,
        location: 'Hyderabad, Telangana, India',
      });
      pdfSigningSucceeded = Boolean(signedPdfResult?.signedPdf);
    } catch (signErr) {
      logger.warn('OTP', 'PDF signing failed, proceeding with hash-only signature', {
        estimateId,
        error: signErr.message,
      });
      alertSignatureFailure(actorId, estimateId, signErr.message);
    }

    const fromStatus = estimate.status;
    estimate.status = pdfSigningSucceeded ? 'Digitally Signed' : 'Hash Signed';
    estimate.digitalSignature = signature;
    estimate.locked = true;
    estimate.signedBy = {
      userId: actorId,
      name: actorName,
      role: actorRole,
      designation: actorDesignation,
    };
    estimate.signedAt = new Date();

    if (pdfSigningSucceeded && signedPdfResult?.signedPdf) {
      const signedPdfPath = pdfPath.replace('.pdf', '_signed.pdf');
      await fs.writeFile(signedPdfPath, signedPdfResult.signedPdf);
      estimate.signedPdfPath = signedPdfPath;
    }

    const movement = await EstimateMovement.create({
      estimateId,
      fromStatus,
      toStatus: pdfSigningSucceeded ? 'Digitally Signed' : 'Hash Signed',
      action: pdfSigningSucceeded ? 'OTP verified, digital signature generated with PDF signing' : 'OTP verified, hash-based signature generated (PDF signing failed)',
      comments: `Estimate ${pdfSigningSucceeded ? 'digitally signed' : 'hash-signed'} by ${actorName} (${actorRole})`,
      actorId,
      actorName,
      actorRole,
    });
    estimate.lastMovement = movement._id;
    estimate.estimateMovements.push(movement._id);
    await estimate.save();

    const signatureRecord = await Signature.create({
      estimateId,
      signerUserId: actorId,
      signerName: actorName,
      signerRole: actorRole,
      signerDesignation: actorDesignation,
      certSerial: signedPdfResult?.certSerial || 'pending',
      certSubject: signedPdfResult?.subject || '',
      certNotBefore: signedPdfResult?.validFrom || null,
      certNotAfter: signedPdfResult?.validTo || null,
      signatureAlgorithm: signedPdfResult?.algorithm || 'SHA256withRSA',
      documentHash: signature,
      signatureValue: signedPdfResult?.signatureLength ? String(signedPdfResult.signatureLength) : '',
      signedPdfPath: estimate.signedPdfPath || '',
      timestampToken: signedPdfResult?.timestamp?.token ? signedPdfResult.timestamp.token.toString('base64') : '',
      timestampAuthority: signedPdfResult?.timestamp?.authority || '',
      timestampedAt: signedPdfResult?.timestamp?.timestampedAt || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await AuditLog.create({
      userId: actorId,
      actorName,
      actorRole,
      action: 'OTP_VERIFIED',
      entity: 'Estimate',
      entityId: estimateId,
      module: 'OTP',
      description: `OTP verified for estimate ${estimateId} by ${actorName} (${actorRole}), estimate locked`,
      details: {
        signature,
        certSerial: signatureRecord.certSerial,
        pdfSigned: pdfSigningSucceeded,
        newStatus: pdfSigningSucceeded ? 'Digitally Signed' : 'Hash Signed',
        fromStatus,
        signerRole: actorRole,
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    alertOtpSuccess(actorId, estimateId);

    sendNotification({
      userId: actorId,
      title: 'Signature Applied',
      message: `Estimate ${estimateId} has been ${pdfSigningSucceeded ? 'digitally signed' : 'hash-signed'} successfully`,
      type: 'success',
      link: `/estimates/${estimateId}`,
    });

    return success(res, {
      message: 'Digital signature generated successfully',
      data: {
        signedBy: { name: actorName, role: actorRole, designation: actorDesignation },
        certSerial: signatureRecord.certSerial,
        pdfSigned: Boolean(signedPdfResult?.signedPdf),
      },
    });
  } catch (err) {
    logger.error('OTP', 'verifyOTP error', { error: err.message });
    next(err);
  }
};
