import crypto from 'crypto';
import https from 'https';
import http from 'http';
import forge from 'node-forge';
import logger from '../utils/logger.js';

const TSA_URL = process.env.TSA_URL || 'https://timestamp.digicert.com';
const TSA_TIMEOUT = parseInt(process.env.TSA_TIMEOUT || '15000', 10);

const buildTimestampRequest = (messageImprint) => {
  const asn1 = forge.asn1;

  const version = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, true,
    String.fromCharCode(0x00));

  const messageImprintAsn1 = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
        forge.oids.sha256),
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false,
      messageImprint),
  ]);

  const reqPolicy = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
    '2.16.840.1.101.3.4.2.1');

  const nonce = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, true,
    forge.util.hexToBytes(crypto.randomBytes(8).toString('hex')));

  const certReq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BOOLEAN, false,
    String.fromCharCode(0xff));

  const tsReq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    version,
    messageImprintAsn1,
    reqPolicy,
    nonce,
    certReq,
  ]);

  return Buffer.from(asn1.toDer(tsReq).getBytes(), 'binary');
};

const parseTimestampResponse = (responseBuffer) => {
  const asn1 = forge.asn1;
  const derBytes = forge.util.createBuffer(responseBuffer.toString('binary'));

  let parsed;
  try {
    parsed = asn1.fromDer(derBytes);
  } catch (err) {
    throw new Error(`Failed to parse TSA response: ${err.message}`);
  }

  if (!parsed || !parsed.value || parsed.value.length < 2) {
    throw new Error('Invalid TSA response structure');
  }

  const status = parsed.value[0];
  const statusValue = parseInt(forge.util.bytesToHex(status.value), 16);

  if (statusValue !== 0 && statusValue !== 1) {
    const statusString = status.value ? forge.util.bytesToAscii(status.value) : 'Unknown';
    throw new Error(`TSA rejected timestamp request (status ${statusValue}): ${statusString}`);
  }

  if (parsed.value.length < 2) {
    throw new Error('TSA response missing timestamp token');
  }

  const tstInfoToken = parsed.value[1];
  let tstInfo;
  try {
    const tstContent = tstInfoToken.value[1].value;
    tstInfo = parseTstInfo(tstContent);
  } catch (err) {
    logger.warn('TSA', 'Could not parse TSTInfo details', { error: err.message });
    tstInfo = {};
  }

  return {
    token: responseBuffer,
    authority: TSA_URL,
    timestamp: tstInfo.genTime || new Date(),
    serialNumber: tstInfo.serialNumber || null,
    policy: tstInfo.policy || null,
    nonce: tstInfo.nonce || null,
  };
};

const parseTstInfo = (tstInfoDer) => {
  const asn1 = forge.asn1;
  const parsed = asn1.fromDer(forge.util.createBuffer(tstInfoDer.toString('binary')));

  const result = {};
  if (parsed.value) {
    for (const field of parsed.value) {
      const tag = field.tagClass === 0 ? field.type : field.tag;
      if (field.type === 0 && field.constructed) {
        // GenTime - try to parse as UTCTime or GeneralizedTime
        try {
          const timeStr = forge.util.bytesToAscii(field.value);
          if (timeStr.endsWith('Z')) {
            result.genTime = new Date(timeStr);
          }
        } catch {}
      }
    }
  }
  return result;
};

const httpPost = (url, data) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(parsedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/timestamp-query',
        'Content-Length': data.length,
      },
      timeout: TSA_TIMEOUT,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          reject(new Error(`TSA returned HTTP ${res.statusCode}: ${body.toString('utf-8').substring(0, 200)}`));
        } else {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`TSA request timed out after ${TSA_TIMEOUT}ms`));
    });

    req.write(data);
    req.end();
  });
};

export const createTimestamp = async (data) => {
  const startTime = Date.now();
  try {
    const hash = crypto.createHash('sha256').update(data).digest();
    const messageImprint = hash.toString('binary');

    const tsRequest = buildTimestampRequest(messageImprint);
    logger.info('TSA', `Sending timestamp request (${tsRequest.length} bytes) to ${TSA_URL}`);

    const responseBuffer = await httpPost(TSA_URL, tsRequest);

    const result = parseTimestampResponse(responseBuffer);
    const elapsed = Date.now() - startTime;

    logger.info('TSA', `Timestamp received in ${elapsed}ms`, {
      authority: result.authority,
      serialNumber: result.serialNumber,
      tokenSize: result.token.length,
    });

    return result;
  } catch (err) {
    logger.error('TSA', `Timestamp creation failed: ${err.message}`, { url: TSA_URL });
    return {
      token: null,
      authority: TSA_URL,
      timestamp: new Date(),
      error: err.message,
      failed: true,
    };
  }
};

export const verifyTimestamp = (timestampToken, originalData) => {
  try {
    if (!timestampToken || !Buffer.isBuffer(timestampToken)) {
      return { valid: false, reason: 'No timestamp token provided' };
    }

    const hash = crypto.createHash('sha256').update(originalData).digest('hex');
    const tokenHex = timestampToken.toString('hex');
    const hasHash = tokenHex.includes(hash);

    return {
      valid: true,
      reason: hasHash ? 'Timestamp token contains matching hash' : 'Timestamp token present but hash match not verified (TSA-specific validation required)',
      tokenSize: timestampToken.length,
      containsHash: hasHash,
    };
  } catch (err) {
    return { valid: false, reason: `Timestamp verification error: ${err.message}` };
  }
};

export const getTimestampInfo = (timestampToken) => {
  try {
    if (!timestampToken || !Buffer.isBuffer(timestampToken)) {
      return null;
    }

    const parsed = forge.asn1.fromDer(forge.util.createBuffer(timestampToken.toString('binary')));
    return {
      size: timestampToken.length,
      parsed: Boolean(parsed),
    };
  } catch {
    return { size: timestampToken.length, parsed: false };
  }
};
