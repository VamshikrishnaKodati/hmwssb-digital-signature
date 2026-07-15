import test from 'node:test';
import assert from 'node:assert/strict';
import {
  incCounter, setGauge, observeHistogram, getMetrics, formatPrometheus,
  resetMetrics, getHealthStatus,
} from '../services/monitoringService.js';
import {
  alertOtpFailure, alertOtpSuccess, alertSignatureFailure,
  alertRateLimitHit, alertFailedLogin, getAlertSummary,
} from '../services/alertService.js';

resetMetrics();

test('incCounter increments counter', () => {
  resetMetrics();
  incCounter('test_counter');
  incCounter('test_counter');
  incCounter('test_counter');
  const m = getMetrics();
  assert.equal(m.counters['test_counter:{}'], 3);
});

test('incCounter with labels', () => {
  resetMetrics();
  incCounter('labeled_counter', { channel: 'email' });
  incCounter('labeled_counter', { channel: 'sms' });
  const m = getMetrics();
  assert.equal(m.counters['labeled_counter:{"channel":"email"}'], 1);
  assert.equal(m.counters['labeled_counter:{"channel":"sms"}'], 1);
});

test('setGauge sets value', () => {
  resetMetrics();
  setGauge('test_gauge', 42);
  const m = getMetrics();
  assert.equal(m.gauges['test_gauge:{}'], 42);
});

test('observeHistogram records observations', () => {
  resetMetrics();
  observeHistogram('test_hist', 0.1);
  observeHistogram('test_hist', 0.5);
  observeHistogram('test_hist', 1.0);
  const m = getMetrics();
  const h = m.histograms['test_hist:{}'];
  assert.equal(h.count, 3);
  assert.equal(h.sum, 1.6);
  assert.equal(h.min, 0.1);
  assert.equal(h.max, 1.0);
  assert.ok(h.avg > 0);
});

test('formatPrometheus produces valid text', () => {
  resetMetrics();
  incCounter('prom_test');
  setGauge('prom_gauge', 100);
  observeHistogram('prom_hist', 0.5);
  const output = formatPrometheus();
  assert.ok(output.includes('# TYPE'));
  assert.ok(output.includes('prom_test'));
  assert.ok(output.includes('prom_gauge'));
  assert.ok(output.includes('prom_hist'));
});

test('resetMetrics clears all data', () => {
  incCounter('to_reset');
  setGauge('to_reset_gauge', 1);
  resetMetrics();
  const m = getMetrics();
  assert.ok(!m.counters['to_reset:{}']);
  assert.ok(!m.gauges['to_reset_gauge:{}']);
});

test('getHealthStatus returns status object', async () => {
  const health = await getHealthStatus();
  assert.ok(health.status);
  assert.ok(health.checks);
  assert.ok(health.checks.database);
  assert.ok(health.checks.memory);
  assert.ok(health.checks.uptime);
  assert.ok(health.timestamp);
});

test('alertOtpSuccess increments counter', () => {
  resetMetrics();
  alertOtpSuccess('user1', 'EST-001');
  const m = getMetrics();
  assert.ok(m.counters['otp_verified_total:{"result":"success"}']);
});

test('alertOtpFailure below threshold does not trigger', () => {
  const result = alertOtpFailure('alert-test-user', 'EST-002', 'wrong_otp');
  assert.equal(result.triggered, false);
  assert.ok(result.count >= 0);
});

test('alertFailedLogin below threshold does not trigger', () => {
  const result = alertFailedLogin('testloginuser');
  assert.equal(result.triggered, false);
});

test('alertRateLimitHit below threshold does not trigger', () => {
  const result = alertRateLimitHit('127.0.0.1', 'auth');
  assert.equal(result.triggered, false);
});

test('alertSignatureFailure below threshold does not trigger', () => {
  const result = alertSignatureFailure('user2', 'EST-003', 'cert_expired');
  assert.equal(result.triggered, false);
});

test('getAlertSummary returns object', () => {
  const summary = getAlertSummary();
  assert.ok(typeof summary === 'object');
});
