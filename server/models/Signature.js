import mongoose from 'mongoose';

const signatureSchema = new mongoose.Schema({
  estimateId: { type: String, required: true, index: true },
  signerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  signerName: { type: String, required: true },
  signerRole: { type: String, required: true },
  signerDesignation: { type: String, default: '' },

  certSerial: { type: String, required: true, index: true },
  certSubject: { type: String, default: '' },
  certIssuer: { type: String, default: '' },
  certNotBefore: { type: Date },
  certNotAfter: { type: Date },

  signatureAlgorithm: { type: String, default: 'SHA256withRSA' },
  documentHash: { type: String, required: true },
  signatureValue: { type: String, default: '' },
  signedPdfPath: { type: String, default: '' },

  verifiedAt: { type: Date },
  verificationResult: { type: mongoose.Schema.Types.Mixed },

  timestampToken: { type: String, default: '' },
  timestampAuthority: { type: String, default: '' },
  timestampedAt: { type: Date },

  revokedAt: { type: Date },
  revocationReason: { type: String },

  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },

  status: { type: String, enum: ['valid', 'revoked', 'expired'], default: 'valid' },
}, { timestamps: true });

signatureSchema.index({ status: 1 });
signatureSchema.index({ createdAt: 1 });

export default mongoose.model('Signature', signatureSchema);
