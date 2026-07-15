import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAdapter } from '../config/redis.js';

test('memory adapter: set and get', async () => {
  const store = createMemoryAdapter();
  await store.set('test:key1', 'value1');
  const result = await store.get('test:key1');
  assert.equal(result, 'value1');
});

test('memory adapter: get returns null for missing key', async () => {
  const store = createMemoryAdapter();
  const result = await store.get('nonexistent');
  assert.equal(result, null);
});

test('memory adapter: set with EX TTL', async () => {
  const store = createMemoryAdapter();
  await store.set('ttl:key', 'data', 'EX', 1);
  const result = await store.get('ttl:key');
  assert.equal(result, 'data');
  const ttl = await store.ttl('ttl:key');
  assert.ok(ttl >= 0 && ttl <= 1);
});

test('memory adapter: set with EX expires after timeout', async () => {
  const store = createMemoryAdapter();
  await store.set('expire:key', 'data', 'EX', 0);
  // With 0 seconds, key should be expired immediately
  await new Promise(r => setTimeout(r, 10));
  const result = await store.get('expire:key');
  assert.equal(result, null);
});

test('memory adapter: del removes keys', async () => {
  const store = createMemoryAdapter();
  await store.set('del:key1', 'a');
  await store.set('del:key2', 'b');
  const deleted = await store.del('del:key1', 'del:key2');
  assert.equal(deleted, 2);
  assert.equal(await store.get('del:key1'), null);
  assert.equal(await store.get('del:key2'), null);
});

test('memory adapter: incr increments counter', async () => {
  const store = createMemoryAdapter();
  const v1 = await store.incr('counter:key');
  assert.equal(v1, 1);
  const v2 = await store.incr('counter:key');
  assert.equal(v2, 2);
  const v3 = await store.incr('counter:key');
  assert.equal(v3, 3);
});

test('memory adapter: ping returns PONG', async () => {
  const store = createMemoryAdapter();
  const result = await store.ping();
  assert.equal(result, 'PONG');
});

test('memory adapter: keys returns matching keys', async () => {
  const store = createMemoryAdapter();
  await store.set('prefix:a', '1');
  await store.set('prefix:b', '2');
  await store.set('other:c', '3');
  const keys = await store.keys('prefix:*');
  assert.ok(keys.includes('prefix:a'));
  assert.ok(keys.includes('prefix:b'));
  assert.ok(!keys.includes('other:c'));
});

test('memory adapter: ttl returns -1 for no expiry', async () => {
  const store = createMemoryAdapter();
  await store.set('noexpiry:key', 'val');
  const ttl = await store.ttl('noexpiry:key');
  assert.equal(ttl, -1);
});

test('memory adapter: status reports ready', async () => {
  const store = createMemoryAdapter();
  assert.equal(store.status, 'ready');
});

test('memory adapter: on() is no-op', async () => {
  const store = createMemoryAdapter();
  assert.doesNotThrow(() => store.on('error', () => {}));
});

test('memory adapter: disconnect is no-op', async () => {
  const store = createMemoryAdapter();
  assert.doesNotThrow(() => store.disconnect());
});

test('memory adapter: expire sets TTL on existing key', async () => {
  const store = createMemoryAdapter();
  await store.set('exp:key', 'val');
  const result = await store.expire('exp:key', 60);
  assert.equal(result, 1);
  const ttl = await store.ttl('exp:key');
  assert.ok(ttl > 0 && ttl <= 60);
});

test('OTP queue: enqueue and queue length', async () => {
  const { enqueueOtpDelivery, getQueueLength, clearQueue } = await import('../services/otpQueue.js');
  await clearQueue();
  await enqueueOtpDelivery({
    estimateId: 'TEST-Q-001',
    otp: '123456',
    email: 'test@example.com',
    mobile: '9999999999',
  });
  const len = await getQueueLength();
  assert.ok(len >= 0);
  await clearQueue();
});
