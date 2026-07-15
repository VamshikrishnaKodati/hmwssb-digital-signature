import crypto from 'crypto';
import mongoose from 'mongoose';
import Otp from '../models/Otp.js';
import logger from '../utils/logger.js';

const OTP_SECRET = process.env.OTP_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

const otpMemoryStore = new Map();
const cooldownStore = new Map();
const backoffStore = new Map();

const buildStoreKey = (estimateId, managerId) => `${estimateId}:${managerId}`;
const buildCooldownKey = (userId, estimateId) => `cooldown:${userId}:${estimateId}`;
const buildBackoffKey = (userId, estimateId) => `backoff:${userId}:${estimateId}`;

const RESEND_COOLDOWN_MS = 30_000;
const MAX_RESENDS_PER_HOUR = 4;
const MAX_BACKOFF_MS = 300_000;

export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const hashOTP = (otp) => {
  return crypto.createHmac('sha256', OTP_SECRET).update(otp).digest('hex');
};

export const verifyOtpInput = (inputOtp, storedHash) => {
  const computedHash = crypto.createHmac('sha256', OTP_SECRET).update(inputOtp).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
};

export const generateDigitalSignature = (payload) => {
  const timestamp = new Date().toISOString();
  const data = JSON.stringify({ ...payload, timestamp, nonce: crypto.randomBytes(16).toString('hex') });
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const canResendOtp = (userId, estimateId) => {
  const key = buildCooldownKey(userId, estimateId);
  const record = cooldownStore.get(key);
  if (!record) return { allowed: true, retryAfter: 0 };

  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed >= RESEND_COOLDOWN_MS) return { allowed: true, retryAfter: 0 };

  const hourKey = `${userId}:${estimateId}:hour`;
  const hourRecord = cooldownStore.get(hourKey);
  if (hourRecord && hourRecord.count >= MAX_RESENDS_PER_HOUR) {
    const remainingMs = hourRecord.windowEnd - Date.now();
    return { allowed: false, retryAfter: Math.ceil(remainingMs / 1000), reason: 'rate_limited' };
  }

  return { allowed: false, retryAfter: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) };
};

export const recordResend = (userId, estimateId) => {
  const key = buildCooldownKey(userId, estimateId);
  cooldownStore.set(key, { lastSentAt: Date.now() });

  const hourKey = `${userId}:${estimateId}:hour`;
  const existing = cooldownStore.get(hourKey);
  const now = Date.now();
  if (!existing || now > existing.windowEnd) {
    cooldownStore.set(hourKey, { count: 1, windowEnd: now + 3600_000 });
  } else {
    existing.count += 1;
    cooldownStore.set(hourKey, existing);
  }
};

export const getBackoffDelay = (userId, estimateId) => {
  const key = buildBackoffKey(userId, estimateId);
  const record = backoffStore.get(key);
  if (!record) return 0;

  const elapsed = Date.now() - record.lastAttemptAt;
  if (elapsed >= record.delayMs) return 0;
  return Math.ceil((record.delayMs - elapsed) / 1000);
};

export const recordFailedAttempt = (userId, estimateId) => {
  const key = buildBackoffKey(userId, estimateId);
  const existing = backoffStore.get(key);
  const attempts = existing ? existing.attempts + 1 : 1;
  const delayMs = Math.min(5_000 * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
  backoffStore.set(key, { attempts, delayMs, lastAttemptAt: Date.now() });
};

export const clearBackoff = (userId, estimateId) => {
  backoffStore.delete(buildBackoffKey(userId, estimateId));
};

export const checkExistingOtp = async (estimateId, managerId) => {
  if (mongoose.connection.readyState === 1) {
    const existing = await Otp.findOne({
      estimateId,
      managerId,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    return existing;
  }

  const records = otpMemoryStore.get(buildStoreKey(estimateId, managerId)) || [];
  const valid = records.filter(r => !r.verified && new Date(r.expiresAt) > new Date());
  return valid[valid.length - 1] || null;
};

export const invalidateExistingOtp = async (estimateId, managerId) => {
  if (mongoose.connection.readyState === 1) {
    await Otp.updateMany(
      { estimateId, managerId, verified: false, expiresAt: { $gt: new Date() } },
      { $set: { verified: true } }
    );
  } else {
    const key = buildStoreKey(estimateId, managerId);
    const records = otpMemoryStore.get(key) || [];
    for (const r of records) {
      if (!r.verified && new Date(r.expiresAt) > new Date()) r.verified = true;
    }
    otpMemoryStore.set(key, records);
  }
};

export const saveOtpRecord = async (record) => {
  if (mongoose.connection.readyState === 1) {
    return Otp.create(record);
  }

  logger.warn('OTP', 'MongoDB not connected, using in-memory store');
  const key = buildStoreKey(record.estimateId, record.managerId);
  const records = otpMemoryStore.get(key) || [];
  records.push({ ...record, _id: crypto.randomUUID(), createdAt: new Date() });
  otpMemoryStore.set(key, records);
  return record;
};

export const getLatestOtpRecord = async (estimateId, managerId) => {
  if (mongoose.connection.readyState === 1) {
    return Otp.findOne({ estimateId, managerId }).sort({ createdAt: -1 });
  }

  const records = otpMemoryStore.get(buildStoreKey(estimateId, managerId)) || [];
  return records[records.length - 1] || null;
};

export const updateOtpRecord = async (record) => {
  if (mongoose.connection.readyState === 1) {
    return Otp.findByIdAndUpdate(record._id, record, { new: true });
  }

  const key = buildStoreKey(record.estimateId, record.managerId);
  const records = otpMemoryStore.get(key) || [];
  const index = records.findIndex((item) => item._id === record._id);

  if (index >= 0) {
    records[index] = record;
    otpMemoryStore.set(key, records);
  }

  return record;
};

export const cleanupExpiredOtps = async () => {
  if (mongoose.connection.readyState === 1) {
    const result = await Otp.deleteMany({
      expiresAt: { $lt: new Date() },
      verified: false,
    });
    if (result.deletedCount > 0) {
      logger.info('OTP', `Cleaned up ${result.deletedCount} expired OTPs`);
    }
  }

  const now = Date.now();
  for (const [key, record] of cooldownStore.entries()) {
    if (record.windowEnd && now > record.windowEnd) cooldownStore.delete(key);
    else if (record.lastSentAt && now - record.lastSentAt > 3600_000) cooldownStore.delete(key);
  }
  for (const [key, record] of backoffStore.entries()) {
    if (now - record.lastAttemptAt > 3600_000) backoffStore.delete(key);
  }
};
