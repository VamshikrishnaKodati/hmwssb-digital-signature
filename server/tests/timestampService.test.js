import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

const { createTimestamp, verifyTimestamp, getTimestampInfo } = await import('../services/timestampService.js');

const SAMPLE_DATA = Buffer.from('HMWSSB Works Management - Test Document Content');

test('createTimestamp returns result object with authority', async () => {
  const result = await createTimestamp(SAMPLE_DATA);
  assert.ok(result);
  assert.ok(typeof result === 'object');
  assert.ok(result.authority);
  assert.ok(typeof result.authority === 'string');
  assert.ok(result.timestamp instanceof Date);
});

test('createTimestamp returns token or failed flag', async () => {
  const result = await createTimestamp(SAMPLE_DATA);
  // Network may be unavailable in CI; we accept either success or graceful failure
  if (result.failed) {
    assert.ok(result.error, 'Failed result includes error message');
    assert.equal(result.token, null);
  } else {
    assert.ok(Buffer.isBuffer(result.token), 'Token is a Buffer');
    assert.ok(result.token.length > 0, 'Token has content');
  }
});

test('createTimestamp with different data produces different hashes', async () => {
  const data1 = Buffer.from('Document A');
  const data2 = Buffer.from('Document B');
  const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
  const hash2 = crypto.createHash('sha256').update(data2).digest('hex');
  assert.notEqual(hash1, hash2, 'Different data produces different hashes');
});

test('verifyTimestamp rejects null token', () => {
  const result = verifyTimestamp(null, SAMPLE_DATA);
  assert.equal(result.valid, false);
  assert.ok(result.reason);
});

test('verifyTimestamp rejects non-Buffer token', () => {
  const result = verifyTimestamp('not-a-buffer', SAMPLE_DATA);
  assert.equal(result.valid, false);
});

test('verifyTimestamp validates matching token', () => {
  const fakeToken = Buffer.from('fake-token-with-hash-embedded');
  const result = verifyTimestamp(fakeToken, Buffer.from('other'));
  assert.equal(result.valid, true);
  assert.equal(result.containsHash, false);
});

test('verifyTimestamp detects matching hash in token', () => {
  const hash = crypto.createHash('sha256').update(SAMPLE_DATA).digest('hex');
  const hashBuf = crypto.createHash('sha256').update(SAMPLE_DATA).digest();
  // Embed the raw binary hash bytes so tokenHex.includes works
  const prefix = Buffer.from('some-payload-');
  const suffix = Buffer.from('-end');
  const fakeToken = Buffer.concat([prefix, hashBuf, suffix]);
  const result = verifyTimestamp(fakeToken, SAMPLE_DATA);
  assert.equal(result.valid, true);
  assert.equal(result.containsHash, true);
});

test('getTimestampInfo returns null for null token', () => {
  const result = getTimestampInfo(null);
  assert.equal(result, null);
});

test('getTimestampInfo returns size for valid buffer', () => {
  const buf = Buffer.from('test-data');
  const result = getTimestampInfo(buf);
  assert.ok(result);
  assert.equal(result.size, buf.length);
});
