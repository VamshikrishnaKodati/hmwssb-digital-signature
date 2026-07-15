import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { signToken, verifyToken } from '../services/authService.js';

test('signToken and verifyToken round-trip', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hmac-signing';
  try {
    const payload = { id: '123', role: 'admin' };
    const token = signToken(payload);
    assert.equal(typeof token, 'string');
    const decoded = verifyToken(token);
    assert.equal(decoded.id, '123');
    assert.equal(decoded.role, 'admin');
    assert.ok(decoded.exp, 'Token should have expiry');
  } finally {
    process.env.JWT_SECRET = originalSecret || '';
  }
});

test('verifyToken rejects invalid token', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hmac-signing';
  try {
    assert.throws(() => verifyToken('invalid-token'));
  } finally {
    process.env.JWT_SECRET = originalSecret || '';
  }
});

test('verifyToken rejects token with wrong secret', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hmac-signing';
  try {
    const payload = { id: '123', role: 'admin' };
    const token = signToken(payload);
    process.env.JWT_SECRET = 'different-secret-that-is-also-long-enough';
    assert.throws(() => verifyToken(token));
  } finally {
    process.env.JWT_SECRET = originalSecret || '';
  }
});

test('bcrypt password hashing works correctly', async () => {
  const password = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  assert.notEqual(hashed, password);
  assert.equal(await bcrypt.compare(password, hashed), true);
  assert.equal(await bcrypt.compare('wrong', hashed), false);
});
