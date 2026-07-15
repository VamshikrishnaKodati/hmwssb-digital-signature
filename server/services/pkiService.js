import forge from 'node-forge';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

const KEYS_DIR = path.resolve(process.env.PKI_KEYS_DIR || 'keys');

const ensureKeysDir = async () => {
  try {
    await fs.access(KEYS_DIR);
  } catch {
    await fs.mkdir(KEYS_DIR, { recursive: true });
    logger.info('PKI', `Created keys directory: ${KEYS_DIR}`);
  }
};

export const generateKeyPair = async () => {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keys) => {
      if (err) return reject(err);
      resolve({
        privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
        publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
      });
    });
  });
};

export const generateSelfSignedCert = async (subject = {}, validityDays = 3650) => {
  const keys = await generateKeyPair();
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(8).toString('hex');

  const now = new Date();
  cert.validity.notBefore = new Date(now);
  cert.validity.notAfter = new Date(now);
  cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + validityDays);

  const attrs = [
    { name: 'commonName', value: subject.commonName || 'HMWSSB Digital Signature Certificate' },
    { name: 'organizationName', value: subject.organization || 'Hyderabad Metropolitan Water Supply & Sewerage Board' },
    { name: 'organizationalUnitName', value: subject.unit || 'Works Management Division' },
    { name: 'countryName', value: subject.country || 'IN' },
    { name: 'stateOrProvinceName', value: subject.state || 'Telangana' },
    { name: 'localityName', value: subject.city || 'Hyderabad' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: false,
      dataEncipherment: false,
    },
    {
      name: 'extKeyUsage',
      clientAuth: true,
    },
    { name: 'subjectKeyIdentifier' },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certificatePem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
    certificate: cert,
    privateKey: keys.privateKey,
    subject: attrs.reduce((acc, a) => ({ ...acc, [a.name]: a.value }), {}),
    serialNumber: cert.serialNumber,
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
  };
};

export const createPkcs12 = async (certPem, keyPem, password, friendlyName = 'HMWSSB Digital Signature') => {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], password, {
    algorithm: 'aes256',
    friendlyName,
  });

  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
};

export const loadCertificateFromPem = (pem) => {
  return forge.pki.certificateFromPem(pem);
};

export const loadPrivateKeyFromPem = (pem) => {
  return forge.pki.privateKeyFromPem(pem);
};

export const getCertFingerprint = (certPem) => {
  const cert = forge.pki.certificateFromPem(certPem);
  const der = forge.asn1.toDer(forge.pki.distinguishedNameToAsn1(cert.subject)).getBytes();
  const md = forge.md.sha256.create();
  md.update(der);
  return md.digest().toHex();
};

export const verifyCertChain = (certPem, caCertPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const caCert = forge.pki.certificateFromPem(caCertPem);

    const now = new Date();
    if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
      return { valid: false, reason: 'Certificate expired or not yet valid' };
    }

    const caStore = forge.pki.createCaStore([caCert]);
    let chainValid = false;
    try {
      forge.pki.verifyCertificateChain(caStore, [cert]);
      chainValid = true;
    } catch (err) {
      chainValid = false;
    }

    return {
      valid: chainValid,
      subject: cert.subject.getField('CN')?.value || 'Unknown',
      issuer: cert.issuer.getField('CN')?.value || 'Unknown',
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      ...(chainValid ? {} : { reason: 'Certificate chain verification failed' }),
    };
  } catch (err) {
    return { valid: false, reason: `Certificate parsing error: ${err.message}` };
  }
};

export const isCertExpired = (certPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    return new Date() > cert.validity.notAfter;
  } catch {
    return true;
  }
};

export const getCertExpiry = (certPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    return { notBefore: cert.validity.notBefore, notAfter: cert.validity.notAfter };
  } catch {
    return null;
  }
};

export const saveKeyToFile = async (filename, data) => {
  await ensureKeysDir();
  const filePath = path.join(KEYS_DIR, filename);
  await fs.writeFile(filePath, data, 'utf-8');
  logger.info('PKI', `Saved key material: ${filename}`);
  return filePath;
};

export const loadKeyFromFile = async (filename) => {
  const filePath = path.join(KEYS_DIR, filename);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
};

export const generateAndStoreSigningCert = async (userId, options = {}) => {
  const certData = await generateSelfSignedCert({
    commonName: options.commonName || `HMWSSB Signer - ${userId}`,
    organization: options.organization || 'HMWSSB',
    ...options,
  });

  const p12Password = process.env.P12_SIGNING_PASSWORD;
  if (!p12Password) {
    throw new Error('P12_SIGNING_PASSWORD environment variable is required');
  }
  const p12Buffer = await createPkcs12(certData.certificatePem, certData.privateKeyPem, p12Password);

  const certFilename = `${userId}_cert.pem`;
  const keyFilename = `${userId}_key.pem`;
  const p12Filename = `${userId}_signer.p12`;

  await saveKeyToFile(certFilename, certData.certificatePem);
  await saveKeyToFile(keyFilename, certData.privateKeyPem);
  await saveKeyToFile(p12Filename, p12Buffer.toString('binary'));

  return {
    certificatePem: certData.certificatePem,
    privateKeyPem: certData.privateKeyPem,
    p12Buffer,
    p12Password,
    serialNumber: certData.serialNumber,
    validFrom: certData.validFrom,
    validTo: certData.validTo,
    subject: certData.subject,
  };
};
