import mongoose from 'mongoose';
import forge from 'node-forge';
import logger from '../utils/logger.js';

const certificateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  certificatePem: { type: String, required: true },
  serialNumber: { type: String, required: true, unique: true },
  subject: { type: mongoose.Schema.Types.Mixed, default: {} },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },
  algorithm: { type: String, default: 'RSA-2048 / SHA-256' },
  status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  revokedAt: { type: Date },
  revocationReason: { type: String },
  keyId: { type: String, default: '' },
}, { timestamps: true });

certificateSchema.index({ userId: 1, status: 1 });
certificateSchema.index({ serialNumber: 1 }, { unique: true });
certificateSchema.index({ validTo: 1 });

let Certificate;

const getCertificateModel = () => {
  if (!Certificate) {
    Certificate = mongoose.model('Certificate', certificateSchema);
  }
  return Certificate;
};

export const storeCertificate = async ({ userId, certificatePem, serialNumber, validFrom, validTo, subject, keyId }) => {
  if (mongoose.connection.readyState !== 1) {
    logger.warn('Certificate', 'MongoDB not connected, cert not persisted');
    return null;
  }
  const Model = getCertificateModel();
  return Model.create({
    userId,
    certificatePem,
    serialNumber,
    validFrom,
    validTo,
    subject,
    keyId,
    status: 'active',
  });
};

export const getActiveCertForUser = async (userId) => {
  if (mongoose.connection.readyState !== 1) return null;
  const Model = getCertificateModel();
  return Model.findOne({ userId, status: 'active', validTo: { $gt: new Date() } })
    .sort({ createdAt: -1 });
};

export const getCertBySerial = async (serialNumber) => {
  if (mongoose.connection.readyState !== 1) return null;
  const Model = getCertificateModel();
  return Model.findOne({ serialNumber });
};

export const getAllCertsForUser = async (userId) => {
  if (mongoose.connection.readyState !== 1) return [];
  const Model = getCertificateModel();
  return Model.find({ userId }).sort({ createdAt: -1 });
};

export const revokeCert = async (serialNumber, reason = 'Key compromised') => {
  if (mongoose.connection.readyState !== 1) return null;
  const Model = getCertificateModel();
  return Model.findOneAndUpdate(
    { serialNumber, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date(), revocationReason: reason } },
    { new: true }
  );
};

export const isCertRevoked = async (serialNumber) => {
  if (mongoose.connection.readyState !== 1) return false;
  const Model = getCertificateModel();
  const cert = await Model.findOne({ serialNumber });
  if (!cert) return true;
  return cert.status === 'revoked';
};

export const isCertValid = async (serialNumber) => {
  if (mongoose.connection.readyState !== 1) return false;
  const Model = getCertificateModel();
  const cert = await Model.findOne({ serialNumber });
  if (!cert) return false;
  if (cert.status === 'revoked') return false;
  if (new Date() > cert.validTo) return false;
  return cert.status === 'active';
};

export const cleanupExpiredCerts = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const Model = getCertificateModel();
  const result = await Model.updateMany(
    { status: 'active', validTo: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
  if (result.modifiedCount > 0) {
    logger.info('Certificate', `Marked ${result.modifiedCount} expired certificates`);
  }
};

export const getCertDetailsFromPem = (certPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    return {
      subject: cert.subject.getField('CN')?.value || 'Unknown',
      issuer: cert.issuer.getField('CN')?.value || 'Unknown',
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      algorithm: cert.siginfo?.algorithmOid || 'Unknown',
      keySize: cert.publicKey?.n?.bitLength() || 2048,
    };
  } catch (err) {
    logger.error('Certificate', 'Failed to parse cert PEM', { error: err.message });
    return null;
  }
};

export const checkCertExpired = (certPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const now = new Date();
    return now > cert.validity.notAfter;
  } catch {
    return true;
  }
};

export const checkCertNotYetValid = (certPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    return new Date() < cert.validity.notBefore;
  } catch {
    return true;
  }
};

export const checkRevocationStatus = async (serialNumber) => {
  if (mongoose.connection.readyState !== 1) {
    return { revoked: false, reason: 'Database not connected, revocation check skipped' };
  }
  const Model = getCertificateModel();
  const cert = await Model.findOne({ serialNumber });
  if (!cert) {
    return { revoked: null, reason: 'Certificate not found in registry' };
  }
  if (cert.status === 'revoked') {
    return {
      revoked: true,
      reason: cert.revocationReason || 'Certificate revoked',
      revokedAt: cert.revokedAt,
    };
  }
  return { revoked: false, reason: 'Certificate active' };
};

export const checkCRL = async (serialNumber) => {
  return checkRevocationStatus(serialNumber);
};

export const checkOCSP = async (serialNumber) => {
  return checkRevocationStatus(serialNumber);
};
