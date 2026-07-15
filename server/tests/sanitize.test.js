import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex, escapeHtml, sanitizeFilename, isPlaceholder, buildReportFilter } from '../utils/sanitize.js';

test('escapeRegex escapes special regex characters', () => {
  assert.equal(escapeRegex('test.*+?'), 'test\\.\\*\\+\\?');
  assert.equal(escapeRegex('a[b]c'), 'a\\[b\\]c');
  assert.equal(escapeRegex('hello'), 'hello');
  assert.equal(escapeRegex(''), '');
});

test('escapeHtml escapes HTML special characters', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("it's a test"), 'it&#39;s a test');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '123');
});

test('sanitizeFilename strips dangerous characters', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), '______etc_passwd');
  assert.equal(sanitizeFilename('EST-001'), 'EST-001');
  assert.equal(sanitizeFilename('test file (1).pdf'), 'test_file__1__pdf');
  assert.ok(sanitizeFilename('a'.repeat(200)).length <= 100);
});

test('isPlaceholder detects placeholder values', () => {
  assert.equal(isPlaceholder('your-email@gmail.com'), true);
  assert.equal(isPlaceholder('change_me'), true);
  assert.equal(isPlaceholder('changeme'), true);
  assert.equal(isPlaceholder('placeholder'), true);
  assert.equal(isPlaceholder(''), true);
  assert.equal(isPlaceholder(null), true);
  assert.equal(isPlaceholder('real@email.com'), false);
  assert.equal(isPlaceholder('AC1234567890'), false);
});

test('buildReportFilter constructs filter from query params', () => {
  const filter = buildReportFilter({
    region: 'HMC',
    zone: 'Rajendranagar',
    division: '10',
    status: 'Draft',
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
  });
  assert.equal(filter.region, 'HMC');
  assert.equal(filter.zone, 'Rajendranagar');
  assert.equal(filter.division, '10');
  assert.equal(filter.status, 'Draft');
  assert.ok(filter.createdAt.$gte instanceof Date);
  assert.ok(filter.createdAt.$lte instanceof Date);
});

test('buildReportFilter omits empty params', () => {
  const filter = buildReportFilter({});
  assert.deepEqual(filter, {});
});

test('buildReportFilter handles partial dates', () => {
  const filter = buildReportFilter({ fromDate: '2024-01-01' });
  assert.ok(filter.createdAt.$gte instanceof Date);
  assert.equal(filter.createdAt.$lte, undefined);
});
