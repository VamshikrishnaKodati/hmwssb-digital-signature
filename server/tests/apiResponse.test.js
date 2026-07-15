import test from 'node:test';
import assert from 'node:assert/strict';
import {
  success, created, paginated, error, notFound,
  badRequest, unauthorized, forbidden, conflict, tooManyRequests,
} from '../utils/apiResponse.js';

const mockRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

test('success returns 200 with data', () => {
  const res = mockRes();
  success(res, { data: { id: 1 }, message: 'OK' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.id, 1);
  assert.equal(res.body.message, 'OK');
});

test('created returns 201', () => {
  const res = mockRes();
  created(res, { data: { id: 1 }, message: 'Created' });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
});

test('paginated returns correct meta', () => {
  const res = mockRes();
  paginated(res, { data: [1, 2], total: 10, page: 1, limit: 2 });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.meta.total, 10);
  assert.equal(res.body.meta.totalPages, 5);
  assert.equal(res.body.meta.hasNext, true);
  assert.equal(res.body.meta.hasPrev, false);
});

test('error returns correct status code', () => {
  const res = mockRes();
  error(res, { message: 'Something broke', statusCode: 500 });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Something broke');
});

test('notFound returns 404', () => {
  const res = mockRes();
  notFound(res, 'Not here');
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.code, 'NOT_FOUND');
});

test('badRequest returns 400', () => {
  const res = mockRes();
  badRequest(res, 'Bad input');
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'BAD_REQUEST');
});

test('unauthorized returns 401', () => {
  const res = mockRes();
  unauthorized(res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'UNAUTHORIZED');
});

test('forbidden returns 403', () => {
  const res = mockRes();
  forbidden(res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'FORBIDDEN');
});

test('conflict returns 409', () => {
  const res = mockRes();
  conflict(res, 'Already exists');
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CONFLICT');
});

test('tooManyRequests returns 429', () => {
  const res = mockRes();
  tooManyRequests(res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'RATE_LIMITED');
});
