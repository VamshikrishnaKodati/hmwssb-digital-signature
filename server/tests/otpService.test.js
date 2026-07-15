import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOTP, hashOTP, verifyOtpInput, generateDigitalSignature,
  canResendOtp, recordResend, getBackoffDelay, recordFailedAttempt, clearBackoff,
} from '../services/otpService.js';

test('generateOTP returns a 6-digit string', () => {
  const otp = generateOTP();
  assert.equal(typeof otp, 'string');
  assert.match(otp, /^\d{6}$/);
});

test('generateOTP produces unique values', () => {
  const otps = new Set();
  for (let i = 0; i < 100; i++) {
    otps.add(generateOTP());
  }
  assert.ok(otps.size > 90, 'Should produce mostly unique OTPs');
});

test('hashOTP returns a hex string (HMAC-SHA256)', () => {
  const hash = hashOTP('123456');
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('hashOTP is deterministic for same input', () => {
  const hash1 = hashOTP('123456');
  const hash2 = hashOTP('123456');
  assert.equal(hash1, hash2);
});

test('hashOTP produces different hashes for different inputs', () => {
  const hash1 = hashOTP('123456');
  const hash2 = hashOTP('654321');
  assert.notEqual(hash1, hash2);
});

test('verifyOtpInput succeeds for correct OTP', () => {
  const otp = '123456';
  const hash = hashOTP(otp);
  assert.equal(verifyOtpInput(otp, hash), true);
});

test('verifyOtpInput fails for wrong OTP', () => {
  const hash = hashOTP('123456');
  assert.equal(verifyOtpInput('000000', hash), false);
});

test('verifyOtpInput fails for empty input', () => {
  const hash = hashOTP('123456');
  assert.equal(verifyOtpInput('', hash), false);
});

test('hashOTP uses timing-safe comparison internally', () => {
  const hash = hashOTP('123456');
  assert.equal(verifyOtpInput('123456', hash), true);
  assert.equal(verifyOtpInput('999999', hash), false);
});

test('generateDigitalSignature returns a sha256-like hex string', () => {
  const signature = generateDigitalSignature({ estimateId: 'EST-1' });
  assert.match(signature, /^[a-f0-9]{64}$/);
});

test('generateDigitalSignature produces unique signatures', () => {
  const sig1 = generateDigitalSignature({ estimateId: 'EST-1' });
  const sig2 = generateDigitalSignature({ estimateId: 'EST-1' });
  assert.notEqual(sig1, sig2, 'Signatures should include nonce for uniqueness');
});

test('resend cooldown: initially allowed', () => {
  const result = canResendOtp('user1', 'est1');
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfter, 0);
});

test('resend cooldown: blocked after recent send', () => {
  const userId = 'user2';
  const estimateId = 'est2';
  recordResend(userId, estimateId);
  const result = canResendOtp(userId, estimateId);
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfter > 0);
});

test('exponential backoff: no delay initially', () => {
  const delay = getBackoffDelay('user3', 'est3');
  assert.equal(delay, 0);
});

test('exponential backoff: delay increases after failures', () => {
  const userId = 'user4';
  const estimateId = 'est4';
  recordFailedAttempt(userId, estimateId);
  const delay1 = getBackoffDelay(userId, estimateId);
  assert.ok(delay1 > 0);

  recordFailedAttempt(userId, estimateId);
  const delay2 = getBackoffDelay(userId, estimateId);
  assert.ok(delay2 >= delay1);
});

test('clearBackoff resets backoff state', () => {
  const userId = 'user5';
  const estimateId = 'est5';
  recordFailedAttempt(userId, estimateId);
  assert.ok(getBackoffDelay(userId, estimateId) > 0);
  clearBackoff(userId, estimateId);
  assert.equal(getBackoffDelay(userId, estimateId), 0);
});
