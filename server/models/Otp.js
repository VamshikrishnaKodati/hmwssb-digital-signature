import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  estimateId: {
    type: String,
    required: true,
    trim: true,
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: { type: String, default: '' },
  mobile: { type: String, default: '' },
  otpHash: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  signature: { type: String, default: '' },
  expiresAt: {
    type: Date,
    required: true,
  },
  emailSent: { type: Boolean, default: false },
  emailTime: { type: Date },
  smsSent: { type: Boolean, default: false },
  smsTime: { type: Date },
  deliveryError: { type: String, default: '' },
  requestIp: { type: String, default: '' },
  requestUserAgent: { type: String, default: '' },
  resendCount: { type: Number, default: 0, min: 0 },
}, {
  timestamps: true,
});

otpSchema.index({ estimateId: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ managerId: 1 });

otpSchema.methods.isExpired = function () {
  return new Date() > new Date(this.expiresAt);
};

otpSchema.methods.maxAttemptsReached = function () {
  return this.attempts >= 5;
};

export default mongoose.model('Otp', otpSchema);
