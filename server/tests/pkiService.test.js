import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKeyPair,
  generateSelfSignedCert,
  createPkcs12,
  loadCertificateFromPem,
  loadPrivateKeyFromPem,
  verifyCertChain,
  isCertExpired,
  getCertExpiry,
  getCertFingerprint,
} from '../services/pkiService.js';

test('generateKeyPair produces RSA-2048 key pair', async () => {
  const keys = await generateKeyPair();
  assert.ok(keys.privateKeyPem.includes('BEGIN RSA PRIVATE KEY'));
  assert.ok(keys.publicKeyPem.includes('BEGIN PUBLIC KEY'));
  assert.ok(keys.privateKey);
  assert.ok(keys.publicKey);
});

test('generateSelfSignedCert returns valid certificate', async () => {
  const cert = await generateSelfSignedCert({ commonName: 'Test Signer' }, 365);
  assert.ok(cert.certificatePem.includes('BEGIN CERTIFICATE'));
  assert.ok(cert.privateKeyPem.includes('BEGIN RSA PRIVATE KEY'));
  assert.equal(cert.subject.commonName, 'Test Signer');
  assert.ok(cert.serialNumber);
  assert.ok(cert.validFrom instanceof Date);
  assert.ok(cert.validTo instanceof Date);
  assert.ok(cert.validTo > cert.validFrom);
});

test('generateSelfSignedCert defaults to 10-year validity', async () => {
  const cert = await generateSelfSignedCert();
  const diffMs = cert.validTo - cert.validFrom;
  const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  assert.ok(diffYears >= 9.9 && diffYears <= 10.1, `Expected ~10 year validity, got ${diffYears}`);
});

test('createPkcs12 produces valid P12 buffer', async () => {
  const cert = await generateSelfSignedCert({ commonName: 'P12 Test' });
  const password = 'test-password-123';
  const p12Buffer = await createPkcs12(cert.certificatePem, cert.privateKeyPem, password);
  assert.ok(Buffer.isBuffer(p12Buffer));
  assert.ok(p12Buffer.length > 0);
});

test('loadCertificateFromPem parses certificate', async () => {
  const certData = await generateSelfSignedCert({ commonName: 'Load Test' });
  const cert = loadCertificateFromPem(certData.certificatePem);
  assert.ok(cert);
  assert.equal(cert.subject.getField('CN').value, 'Load Test');
});

test('loadPrivateKeyFromPem parses private key', async () => {
  const certData = await generateSelfSignedCert({ commonName: 'Key Test' });
  const key = loadPrivateKeyFromPem(certData.privateKeyPem);
  assert.ok(key);
  assert.equal(typeof key.sign, 'function');
});

test('verifyCertChain validates self-signed cert against itself', async () => {
  const certData = await generateSelfSignedCert({ commonName: 'Chain Test' });
  const result = verifyCertChain(certData.certificatePem, certData.certificatePem);
  assert.equal(result.valid, true);
  assert.equal(result.subject, 'Chain Test');
  assert.ok(result.validFrom);
  assert.ok(result.validTo);
});

test('verifyCertChain rejects mismatched cert', async () => {
  const cert1 = await generateSelfSignedCert({ commonName: 'Cert 1' });
  const cert2 = await generateSelfSignedCert({ commonName: 'Cert 2' });
  const result = verifyCertChain(cert1.certificatePem, cert2.certificatePem);
  assert.equal(result.valid, false);
  assert.ok(result.reason);
});

test('isCertExpired returns false for fresh cert', async () => {
  const cert = await generateSelfSignedCert();
  assert.equal(isCertExpired(cert.certificatePem), false);
});

test('getCertExpiry returns validity dates', async () => {
  const cert = await generateSelfSignedCert();
  const expiry = getCertExpiry(cert.certificatePem);
  assert.ok(expiry);
  assert.ok(expiry.notBefore instanceof Date);
  assert.ok(expiry.notAfter instanceof Date);
});

test('getCertFingerprint returns hex string', async () => {
  const cert = await generateSelfSignedCert({ commonName: 'Fingerprint Test' });
  const fp = getCertFingerprint(cert.certificatePem);
  assert.match(fp, /^[a-f0-9]+$/);
  assert.ok(fp.length > 10);
});

test('generateSelfSignedCert produces unique serial numbers', async () => {
  const cert1 = await generateSelfSignedCert();
  const cert2 = await generateSelfSignedCert();
  assert.notEqual(cert1.serialNumber, cert2.serialNumber);
});
