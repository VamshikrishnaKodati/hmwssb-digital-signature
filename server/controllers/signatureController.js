import Signature from '../models/Signature.js';
import Estimate from '../models/Estimate.js';
import AuditLog from '../models/AuditLog.js';
import { isCertRevoked, checkRevocationStatus } from '../services/certificateService.js';
import { computePdfHash, verifyPdfSignature } from '../services/pdfSignService.js';
import { success, notFound, badRequest } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const verifySignature = async (req, res, next) => {
  try {
    const { estimateId } = req.params;

    const sig = await Signature.findOne({ estimateId });
    if (!sig) {
      return notFound(res, 'No digital signature found for this estimate');
    }

    const certRevoked = await isCertRevoked(sig.certSerial);
    const certExpired = sig.certNotAfter && new Date() > sig.certNotAfter;
    const certValid = !certRevoked && !certExpired;

    const estimate = await Estimate.findOne({ estimateId }).lean();
    let pdfHashValid = false;
    let pdfDetails = null;

    if (estimate?.digitalSignature && sig.documentHash) {
      pdfHashValid = estimate.digitalSignature === sig.documentHash || Boolean(estimate.digitalSignature);
    }

    let pdfCryptoValid = false;
    if (sig.signedPdfPath) {
      try {
        const fs = await import('fs/promises');
        const pdfBuffer = await fs.readFile(sig.signedPdfPath);
        const { verifyPdfSignature: verifyPdf } = await import('../services/pdfSignService.js');
        const pdfResult = await verifyPdf(pdfBuffer);
        pdfCryptoValid = pdfResult.signatureValid || false;
        pdfDetails = {
          signatureValid: pdfResult.signatureValid,
          signerName: pdfResult.signerName,
          signingAlgorithm: pdfResult.signingAlgorithm,
        };
      } catch {
        pdfCryptoValid = false;
      }
    }

    const overallValid = certValid && (pdfHashValid || pdfCryptoValid) && sig.status === 'valid';

    await AuditLog.create({
      userId: req.user?.id,
      actorName: req.user?.name || 'System',
      actorRole: req.user?.role || 'system',
      action: 'SIGNATURE_VERIFIED',
      entity: 'Signature',
      entityId: estimateId,
      module: 'Digital Signature',
      description: `Signature verification for estimate ${estimateId}: ${overallValid ? 'VALID' : 'INVALID'}`,
      details: {
        certValid,
        certRevoked,
        certExpired,
        pdfHashValid,
        pdfCryptoValid,
        overallValid,
        certSerial: sig.certSerial,
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, {
      data: {
        valid: overallValid,
        estimateId,
        signer: {
          name: sig.signerName,
          role: sig.signerRole,
          designation: sig.signerDesignation,
          userId: sig.signerUserId,
        },
        signedAt: sig.signedAt || sig.createdAt,
        certificate: {
          serial: sig.certSerial,
          subject: sig.certSubject,
          issuer: sig.certIssuer,
          algorithm: sig.signatureAlgorithm,
          valid: certValid,
          revoked: certRevoked,
          expired: certExpired,
          notBefore: sig.certNotBefore,
          notAfter: sig.certNotAfter,
        },
        document: {
          hash: sig.documentHash,
          hashValid: pdfHashValid,
          cryptoValid: pdfCryptoValid,
          pdfPath: sig.signedPdfPath,
          ...(pdfDetails ? { verificationDetails: pdfDetails } : {}),
        },
        timestamp: {
          present: Boolean(sig.timestampedAt),
          authority: sig.timestampAuthority || null,
          timestampedAt: sig.timestampedAt || null,
        },
        revocation: {
          revoked: Boolean(sig.revokedAt),
          reason: sig.revocationReason || null,
          revokedAt: sig.revokedAt || null,
        },
      },
    });
  } catch (err) {
    logger.error('Signature', 'Verification error', { error: err.message });
    next(err);
  }
};

export const getSignatureByEstimate = async (req, res, next) => {
  try {
    const { estimateId } = req.params;
    const sig = await Signature.findOne({ estimateId })
      .select('-signatureValue -timestampToken')
      .lean();
    if (!sig) return notFound(res, 'No signature found');
    return success(res, { data: sig });
  } catch (err) {
    next(err);
  }
};

export const getSignatureHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = {};
    if (req.user.role === 'manager') {
      filter.signerUserId = req.user.id;
    }

    const signatures = await Signature.find(filter)
      .select('-signatureValue -timestampToken')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await Signature.countDocuments(filter);

    return success(res, {
      data: signatures,
      meta: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const revokeSignature = async (req, res, next) => {
  try {
    const { estimateId } = req.params;
    const { reason } = req.body;

    const sig = await Signature.findOne({ estimateId });
    if (!sig) return notFound(res, 'No signature found');

    if (sig.status === 'revoked') {
      return badRequest(res, 'Signature is already revoked');
    }

    sig.status = 'revoked';
    sig.revokedAt = new Date();
    sig.revocationReason = reason || 'Administrative revocation';
    await sig.save();

    await AuditLog.create({
      userId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'SIGNATURE_REVOKED',
      entity: 'Signature',
      entityId: estimateId,
      module: 'Digital Signature',
      description: `Signature revoked for estimate ${estimateId}`,
      details: { reason: sig.revocationReason, certSerial: sig.certSerial },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, { message: 'Signature revoked successfully' });
  } catch (err) {
    next(err);
  }
};
