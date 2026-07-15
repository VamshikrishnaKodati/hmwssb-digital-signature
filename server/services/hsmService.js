import crypto from 'crypto';
import forge from 'node-forge';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

const KEYS_DIR = path.resolve(process.env.PKI_KEYS_DIR || 'keys');

class SoftwareSigningService {
  constructor() {
    this.name = 'software';
    this.algorithm = 'SHA256withRSA';
    this.keySize = 2048;
  }

  async sign(data, keyId) {
    const keyData = await this._loadKey(keyId);
    if (!keyData) throw new Error(`Key not found: ${keyId}`);

    const md = forge.md.sha256.create();
    const dataStr = typeof data === 'string' ? data : data.toString('base64');
    md.update(dataStr);

    const signature = keyData.privateKey.sign(md);
    return {
      signature: forge.util.encode64(signature),
      algorithm: this.algorithm,
      keyId,
      certificatePem: keyData.certificatePem,
    };
  }

  async signHash(hashBuffer, keyId) {
    const keyData = await this._loadKey(keyId);
    if (!keyData) throw new Error(`Key not found: ${keyId}`);

    const md = forge.md.sha256.create();
    md.update(forge.util.encode64(hashBuffer.toString('base64')));

    const signature = keyData.privateKey.sign(md);
    return {
      signature: forge.util.encode64(signature),
      algorithm: this.algorithm,
      keyId,
      certificatePem: keyData.certificatePem,
    };
  }

  async verify(data, signatureBase64, certPem) {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      const signatureBytes = forge.util.decode64(signatureBase64);

      const md = forge.md.sha256.create();
      const dataStr = typeof data === 'string' ? data : data.toString('base64');
      md.update(dataStr);

      return cert.publicKey.verify(md.digest().bytes(), signatureBytes);
    } catch (err) {
      logger.error('HSM', 'Verification failed', { error: err.message });
      return false;
    }
  }

  async getCertificate(keyId) {
    const certPath = path.join(KEYS_DIR, `${keyId}_cert.pem`);
    try {
      return await fs.readFile(certPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async _loadKey(keyId) {
    const certPath = path.join(KEYS_DIR, `${keyId}_cert.pem`);
    const keyPath = path.join(KEYS_DIR, `${keyId}_key.pem`);

    try {
      const [certificatePem, privateKeyPem] = await Promise.all([
        fs.readFile(certPath, 'utf-8'),
        fs.readFile(keyPath, 'utf-8'),
      ]);
      return {
        certificatePem,
        privateKeyPem,
        privateKey: forge.pki.privateKeyFromPem(privateKeyPem),
        certificate: forge.pki.certificateFromPem(certificatePem),
      };
    } catch {
      return null;
    }
  }

  async rotateKey(keyId) {
    const { generateAndStoreSigningCert } = await import('./pkiService.js');
    const newCert = await generateAndStoreSigningCert(keyId, {
      commonName: `HMWSSB Signer - ${keyId} (rotated)`,
    });

    const oldKeyPath = path.join(KEYS_DIR, `${keyId}_key.pem.old`);
    const currentKeyPath = path.join(KEYS_DIR, `${keyId}_key.pem`);
    try {
      await fs.rename(currentKeyPath, oldKeyPath);
    } catch {}

    await fs.writeFile(currentKeyPath, newCert.privateKeyPem, 'utf-8');
    await fs.writeFile(path.join(KEYS_DIR, `${keyId}_cert.pem`), newCert.certificatePem, 'utf-8');

    logger.info('HSM', `Rotated signing key for ${keyId}`);
    return newCert;
  }
}

class HSMSigningService {
  constructor() {
    this.name = 'hsm';
    this.endpoint = process.env.HSM_ENDPOINT;
    this.keyId = process.env.HSM_KEY_ID;
  }

  async sign(data, keyId) {
    throw new Error('HSM signing not yet configured. Set HSM_ENDPOINT and HSM_KEY_ID in .env');
  }

  async signHash(hashBuffer, keyId) {
    throw new Error('HSM signing not yet configured');
  }

  async verify(data, signatureBase64, certPem) {
    throw new Error('HSM verification not yet configured');
  }

  async getCertificate(keyId) {
    throw new Error('HSM certificate retrieval not yet configured');
  }

  async rotateKey(keyId) {
    throw new Error('HSM key rotation not yet configured');
  }
}

let instance = null;

export const createSigningService = () => {
  if (instance) return instance;

  if (process.env.HSM_ENDPOINT) {
    instance = new HSMSigningService();
    logger.info('HSM', 'Using HSM/KMS signing service', { endpoint: process.env.HSM_ENDPOINT });
  } else {
    instance = new SoftwareSigningService();
    logger.info('HSM', 'Using software signing service (dev mode)');
  }

  return instance;
};

export const getSigningService = () => {
  if (!instance) return createSigningService();
  return instance;
};

export const signDocument = async (data, keyId) => {
  const service = getSigningService();
  return service.sign(data, keyId);
};

export const signDocumentHash = async (hashBuffer, keyId) => {
  const service = getSigningService();
  return service.signHash(hashBuffer, keyId);
};

export const verifySignature = async (data, signatureBase64, certPem) => {
  const service = getSigningService();
  return service.verify(data, signatureBase64, certPem);
};

export const computeDocumentHash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};
