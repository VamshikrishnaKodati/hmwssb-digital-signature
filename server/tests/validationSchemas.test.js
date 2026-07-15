import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loginSchema, createUserSchema, updateItemSchema, createItemSchema,
  createEstimateSchema, updateStatusSchema, sendOtpSchema, verifyOtpSchema,
  generatePdfSchema, createVersionSchema, reportFilterSchema,
} from '../validations/schemas.js';

test('loginSchema accepts valid input', () => {
  const { error } = loginSchema.validate({ username: 'admin', password: 'Admin@123pass' });
  assert.equal(error, undefined);
});

test('loginSchema rejects short username', () => {
  const { error } = loginSchema.validate({ username: 'ab', password: 'Admin@123pass' });
  assert.ok(error);
});

test('loginSchema rejects missing password', () => {
  const { error } = loginSchema.validate({ username: 'admin' });
  assert.ok(error);
});

test('createUserSchema accepts valid user', () => {
  const { error } = createUserSchema.validate({
    employeeId: 'EMP-001',
    username: 'testuser',
    password: 'Strong@Pass123',
    name: 'Test User',
    email: 'test@example.com',
    mobile: '9876543210',
    role: 'manager',
  });
  assert.equal(error, undefined);
});

test('createUserSchema rejects weak password', () => {
  const { error } = createUserSchema.validate({
    employeeId: 'EMP-001',
    username: 'testuser',
    password: 'weak',
    name: 'Test User',
    email: 'test@example.com',
    mobile: '9876543210',
    role: 'manager',
  });
  assert.ok(error);
});

test('createUserSchema rejects invalid role', () => {
  const { error } = createUserSchema.validate({
    employeeId: 'EMP-001',
    username: 'testuser',
    password: 'Strong@Pass123',
    name: 'Test User',
    email: 'test@example.com',
    mobile: '9876543210',
    role: 'superadmin',
  });
  assert.ok(error);
});

test('createItemSchema accepts valid item', () => {
  const { error } = createItemSchema.validate({
    itemCode: 'MAT-001',
    name: 'Cement',
    category: 'Material',
    unit: 'Bag',
    rate: 420,
  });
  assert.equal(error, undefined);
});

test('updateItemSchema accepts partial update', () => {
  const { error } = updateItemSchema.validate({ rate: 500 });
  assert.equal(error, undefined);
});

test('updateItemSchema rejects empty update', () => {
  const { error } = updateItemSchema.validate({});
  assert.ok(error);
});

test('createEstimateSchema accepts valid estimate', () => {
  const { error } = createEstimateSchema.validate({
    estimateId: 'EST-001',
    workName: 'Test Work',
    items: [],
  });
  assert.equal(error, undefined);
});

test('createEstimateSchema rejects short estimateId', () => {
  const { error } = createEstimateSchema.validate({
    estimateId: 'ES',
    workName: 'Test Work',
  });
  assert.ok(error);
});

test('updateStatusSchema accepts valid status', () => {
  const { error } = updateStatusSchema.validate({ status: 'Submitted' });
  assert.equal(error, undefined);
});

test('updateStatusSchema rejects invalid status', () => {
  const { error } = updateStatusSchema.validate({ status: 'InvalidStatus' });
  assert.ok(error);
});

test('sendOtpSchema accepts valid input', () => {
  const { error } = sendOtpSchema.validate({
    estimateId: 'EST-001',
    email: 'test@example.com',
    mobile: '9876543210',
  });
  assert.equal(error, undefined);
});

test('verifyOtpSchema accepts valid OTP', () => {
  const { error } = verifyOtpSchema.validate({
    estimateId: 'EST-001',
    otp: '123456',
  });
  assert.equal(error, undefined);
});

test('verifyOtpSchema rejects non-6-digit OTP', () => {
  const { error } = verifyOtpSchema.validate({
    estimateId: 'EST-001',
    otp: '12345',
  });
  assert.ok(error);
});

test('generatePdfSchema accepts estimateId', () => {
  const { error } = generatePdfSchema.validate({ estimateId: 'EST-001' });
  assert.equal(error, undefined);
});

test('generatePdfSchema accepts estimate object', () => {
  const { error } = generatePdfSchema.validate({ estimate: { estimateId: 'EST-001' }, items: [] });
  assert.equal(error, undefined);
});

test('createVersionSchema accepts optional notes', () => {
  const { error } = createVersionSchema.validate({ notes: 'Test version' });
  assert.equal(error, undefined);
});

test('createVersionSchema accepts empty body', () => {
  const { error } = createVersionSchema.validate({});
  assert.equal(error, undefined);
});

test('reportFilterSchema accepts valid filter', () => {
  const { error } = reportFilterSchema.validate({
    region: 'HMC',
    zone: 'Rajendranagar',
    page: 1,
    limit: 50,
  });
  assert.equal(error, undefined);
});

test('reportFilterSchema rejects invalid limit', () => {
  const { error } = reportFilterSchema.validate({ limit: 200 });
  assert.ok(error);
});
