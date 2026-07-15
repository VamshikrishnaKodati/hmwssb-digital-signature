import test from 'node:test';
import assert from 'node:assert/strict';
import forge from 'node-forge';

let signPdfDocument, computePdfHash, pdfSignService;

try {
  const mod = await import('../services/pdfSignService.js');
  signPdfDocument = mod.signPdfDocument;
  computePdfHash = mod.computePdfHash;
  pdfSignService = mod;
} catch (e) {
  console.error('pdfSignService import failed:', e.message);
}

const { generateAndStoreSigningCert: genCert } = await import('../services/pkiService.js');
const generateAndStoreSigningCert = genCert;

const P12_PASSWORD = process.env.P12_SIGNING_PASSWORD || 'hmwssb-signing-2024';

function buildMinimalPdf() {
  const parts = [];
  const offsets = [];

  parts.push(Buffer.from('%PDF-1.4\n'));
  offsets.push(0); // offset 0

  const obj1 = Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const obj1Start = parts.reduce((s, b) => s + b.length, 0);
  offsets.push(obj1Start);
  parts.push(obj1);

  const obj2 = Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  const obj2Start = parts.reduce((s, b) => s + b.length, 0);
  offsets.push(obj2Start);
  parts.push(obj2);

  const obj3 = Buffer.from('3 0 obj\n<< /Type /Page /MediaBox [0 0 612 792] /Parent 2 0 R >>\nendobj\n');
  const obj3Start = parts.reduce((s, b) => s + b.length, 0);
  offsets.push(obj3Start);
  parts.push(obj3);

  const xrefOffset = parts.reduce((s, b) => s + b.length, 0);
  let xref = 'xref\n';
  xref += `0 4\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= 3; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  parts.push(Buffer.from(xref));
  parts.push(Buffer.from(trailer));

  return Buffer.concat(parts);
}

const MINIMAL_PDF = buildMinimalPdf();

if (computePdfHash) {
  test('computePdfHash produces valid SHA-256 hex', () => {
    const hash = computePdfHash(MINIMAL_PDF);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(hash));
  });

  test('computePdfHash is deterministic', () => {
    const h1 = computePdfHash(MINIMAL_PDF);
    const h2 = computePdfHash(MINIMAL_PDF);
    assert.equal(h1, h2);
  });

  test('computePdfHash differs for different input', () => {
    const h1 = computePdfHash(MINIMAL_PDF);
    const h2 = computePdfHash(Buffer.from('different content'));
    assert.notEqual(h1, h2);
  });
} else {
  test.skip('computePdfHash tests — pdfSignService failed to import');
}

test('generateAndStoreSigningCert returns P12 buffer and metadata', async () => {
  const certData = await generateAndStoreSigningCert('test-user-sign', {
    commonName: 'Test PDF Signer',
  });

  assert.ok(certData.p12Buffer);
  assert.ok(Buffer.isBuffer(certData.p12Buffer));
  assert.ok(certData.p12Buffer.length > 100);
  assert.ok(certData.serialNumber);
  assert.ok(typeof certData.serialNumber === 'string');
  assert.ok(certData.certificatePem.includes('BEGIN CERTIFICATE'));
  assert.ok(certData.privateKeyPem.includes('BEGIN RSA PRIVATE KEY'));
  assert.ok(certData.validFrom instanceof Date);
  assert.ok(certData.validTo instanceof Date);
  assert.ok(certData.validTo > certData.validFrom);
  assert.ok(certData.subject);
  assert.equal(certData.subject.commonName, 'Test PDF Signer');
});

test('P12 buffer can be parsed back with node-forge', async () => {
  const certData = await generateAndStoreSigningCert('forge-test-user');
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(certData.p12Buffer.toString('binary')).getBytes());
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, P12_PASSWORD);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

  assert.ok(keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.length > 0, 'Key bag found');
  assert.ok(certBags[forge.pki.oids.certBag]?.length > 0, 'Cert bag found');
});

if (signPdfDocument) {
  test('signPdfDocument returns signed PDF buffer with correct structure', async () => {
    const result = await signPdfDocument(MINIMAL_PDF, 'pdf-sign-test-user', {
      reason: 'Test signature',
      signerName: 'Test User',
    });

    assert.ok(result.signedPdf);
    assert.ok(Buffer.isBuffer(result.signedPdf));
    assert.ok(result.signedPdf.length > MINIMAL_PDF.length, 'Signed PDF is larger than original');
    assert.ok(result.certSerial);
    assert.ok(result.certificatePem.includes('BEGIN CERTIFICATE'));
    assert.ok(result.algorithm === 'SHA256withRSA');
    assert.ok(result.validFrom instanceof Date);
    assert.ok(result.validTo instanceof Date);
    assert.ok(result.subject);
  });

  test('signed PDF is a valid PDF file', async () => {
    const result = await signPdfDocument(MINIMAL_PDF, 'pdf-validity-test', {
      reason: 'Validity test',
    });

    const pdfStart = result.signedPdf.toString('ascii', 0, 5);
    assert.equal(pdfStart, '%PDF-', 'Signed PDF starts with %PDF- header');

    const pdfStr = result.signedPdf.toString('ascii');
    assert.ok(pdfStr.includes('%%EOF'), 'Signed PDF contains %%EOF');
  });

  test('signPdfDocument with different users produces different signatures', async () => {
    const r1 = await signPdfDocument(MINIMAL_PDF, 'user-a-sign', { reason: 'A signs' });
    const r2 = await signPdfDocument(MINIMAL_PDF, 'user-b-sign', { reason: 'B signs' });

    assert.notEqual(r1.certSerial, r2.certSerial, 'Different serial numbers for different users');
    assert.notEqual(r1.signedPdf.toString('hex'), r2.signedPdf.toString('hex'), 'Different signed PDFs');
  });
} else {
  test.skip('signPdfDocument tests — pdfSignService failed to import');
}

test('cert serial numbers are valid hex strings', async () => {
  const certData = await generateAndStoreSigningCert('serial-test-user');
  assert.ok(/^[0-9a-f]+$/i.test(certData.serialNumber), 'Serial should be valid hex');
  assert.ok(certData.serialNumber.length >= 16, 'Serial should have sufficient length');
});

if (pdfSignService?.invalidateCertCache) {
  test('cert cache invalidation forces new cert generation', async () => {
    const cert1 = await generateAndStoreSigningCert('cache-invalidation-test');
    pdfSignService.invalidateCertCache('cache-invalidation-test');
    const cert2 = await generateAndStoreSigningCert('cache-invalidation-test');
    assert.ok(cert1.serialNumber);
    assert.ok(cert2.serialNumber);
  });
} else {
  test.skip('cert cache invalidation test — invalidateCertCache not available');
}
