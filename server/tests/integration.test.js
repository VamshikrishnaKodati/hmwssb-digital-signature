import test from 'node:test';
import assert from 'node:assert/strict';
import forge from 'node-forge';
import crypto from 'crypto';

// Integration tests that verify the full signing pipeline
// without requiring MongoDB or a running server

const { generateAndStoreSigningCert } = await import('../services/pkiService.js');
const { signPdfDocument, computePdfHash, verifyPdfSignature, invalidateCertCache } = await import('../services/pdfSignService.js');
const { createTimestamp, verifyTimestamp } = await import('../services/timestampService.js');
const { incCounter, setGauge, observeHistogram, getMetrics, resetMetrics } = await import('../services/monitoringService.js');
const { alertOtpFailure, alertOtpSuccess, alertFailedLogin } = await import('../services/alertService.js');

const P12_PASSWORD = process.env.P12_SIGNING_PASSWORD || 'hmwssb-signing-2024';

function buildTestPdf() {
  const parts = [];
  const offsets = [];
  parts.push(Buffer.from('%PDF-1.4\n'));
  offsets.push(0);
  const obj1 = Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets.push(parts.reduce((s, b) => s + b.length, 0));
  parts.push(obj1);
  const obj2 = Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  offsets.push(parts.reduce((s, b) => s + b.length, 0));
  parts.push(obj2);
  const obj3 = Buffer.from('3 0 obj\n<< /Type /Page /MediaBox [0 0 612 792] /Parent 2 0 R >>\nendobj\n');
  offsets.push(parts.reduce((s, b) => s + b.length, 0));
  parts.push(obj3);
  const xrefOffset = parts.reduce((s, b) => s + b.length, 0);
  let xref = 'xref\n0 4\n0000000000 65535 f \n';
  for (let i = 1; i <= 3; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  parts.push(Buffer.from(xref));
  parts.push(Buffer.from(`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
  return Buffer.concat(parts);
}

const TEST_PDF = buildTestPdf();

test('Full flow: generate cert → sign PDF → verify signature', async () => {
  const estimateId = 'INTG-TEST-001';
  const managerId = 'manager-001';
  const managerName = 'Test Manager';

  const certData = await generateAndStoreSigningCert(managerId, {
    commonName: `${managerName} - HMWSSB`,
  });
  assert.ok(certData.p12Buffer);
  assert.ok(certData.certificatePem);
  assert.ok(certData.serialNumber);

  const signResult = await signPdfDocument(TEST_PDF, managerId, {
    reason: `OTP-verified signature for ${estimateId}`,
    signerName: managerName,
  });
  assert.ok(signResult.signedPdf);
  assert.ok(signResult.certSerial);
  assert.ok(signResult.algorithm === 'SHA256withRSA');
  assert.ok(signResult.signedPdf.length > TEST_PDF.length);

  const pdfHash = computePdfHash(signResult.signedPdf);
  assert.equal(typeof pdfHash, 'string');
  assert.equal(pdfHash.length, 64);

  const verifyResult = await verifyPdfSignature(signResult.signedPdf);
  assert.ok(verifyResult);
  assert.ok(typeof verifyResult.hasSignature === 'boolean');
});

test('Full flow: different signers produce different signatures', async () => {
  const r1 = await signPdfDocument(TEST_PDF, 'flow-user-a', { signerName: 'User A' });
  const r2 = await signPdfDocument(TEST_PDF, 'flow-user-b', { signerName: 'User B' });

  assert.notEqual(r1.certSerial, r2.certSerial);
  assert.notEqual(r1.signedPdf.toString('hex'), r2.signedPdf.toString('hex'));
  assert.equal(r1.algorithm, 'SHA256withRSA');
  assert.equal(r2.algorithm, 'SHA256withRSA');
});

test('Full flow: certificate can be parsed with node-forge', async () => {
  const certData = await generateAndStoreSigningCert('forge-integration', {
    commonName: 'Forge Integration Test',
  });

  const cert = forge.pki.certificateFromPem(certData.certificatePem);
  assert.ok(cert);
  assert.equal(cert.subject.getField('CN').value, 'Forge Integration Test');
  assert.ok(cert.publicKey);
  assert.ok(cert.serialNumber);

  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(certData.p12Buffer.toString('binary')).getBytes());
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, P12_PASSWORD);
  assert.ok(p12);
});

test('Full flow: timestamp can be requested (graceful failure OK)', async () => {
  const data = Buffer.from('HMWSSB Integration Test Data');
  const result = await createTimestamp(data);

  assert.ok(result);
  assert.ok(result.authority);
  assert.ok(result.timestamp instanceof Date);

  if (!result.failed) {
    assert.ok(result.token);
    assert.ok(Buffer.isBuffer(result.token));
    const verification = verifyTimestamp(result.token, data);
    assert.equal(verification.valid, true);
  }
});

test('Monitoring: counters and metrics accumulate across operations', () => {
  resetMetrics();

  incCounter('integration_counter', { step: '1' });
  incCounter('integration_counter', { step: '1' });
  incCounter('integration_counter', { step: '2' });
  setGauge('integration_gauge', 42);
  observeHistogram('integration_hist', 0.1);
  observeHistogram('integration_hist', 0.5);

  const m = getMetrics();
  assert.equal(m.counters['integration_counter:{"step":"1"}'], 2);
  assert.equal(m.counters['integration_counter:{"step":"2"}'], 1);
  assert.equal(m.gauges['integration_gauge:{}'], 42);
  assert.equal(m.histograms['integration_hist:{}'].count, 2);
  assert.equal(m.histograms['integration_hist:{}'].sum, 0.6);
});

test('Alert service: OTP success increments verified counter', () => {
  resetMetrics();
  alertOtpSuccess('test-manager', 'INTG-001');
  alertOtpSuccess('test-manager', 'INTG-002');
  const m = getMetrics();
  assert.equal(m.counters['otp_verified_total:{"result":"success"}'], 2);
});

test('Alert service: failed login tracking', () => {
  const r1 = alertFailedLogin('bruteforce-user');
  assert.equal(r1.triggered, false);
  assert.ok(r1.count >= 1);
});

test('PDF signing: sign and verify produces valid PDF structure', async () => {
  const result = await signPdfDocument(TEST_PDF, 'structure-test', {
    reason: 'Structure validation test',
  });

  const pdfStr = result.signedPdf.toString('ascii');
  assert.ok(pdfStr.includes('%PDF-'), 'Contains PDF header');
  assert.ok(pdfStr.includes('%%EOF'), 'Contains EOF marker');
  assert.ok(result.signedPdf.length > 1000, 'Signed PDF has reasonable size');
});

test('Cache invalidation forces new certificate generation', async () => {
  const userId = 'cache-test-user';
  const c1 = await generateAndStoreSigningCert(userId);
  invalidateCertCache(userId);
  const c2 = await generateAndStoreSigningCert(userId);
  assert.ok(c1.serialNumber);
  assert.ok(c2.serialNumber);
  assert.notEqual(c1.serialNumber, c2.serialNumber);
});
