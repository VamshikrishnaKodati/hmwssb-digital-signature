const fs = require('fs');
const path = require('path');

const OTP_DIR = path.join(require('os').tmpdir(), 'hmwssb-e2e');
const OTP_FILE = path.join(OTP_DIR, 'dev-otp.json');

function ensureDir() {
  if (!fs.existsSync(OTP_DIR)) fs.mkdirSync(OTP_DIR, { recursive: true });
}

function logOtp(estimateNo, purpose, code) {
  if (process.env.NODE_ENV === 'production') return;
  try {
    ensureDir();
    let data = {};
    try { data = JSON.parse(fs.readFileSync(OTP_FILE, 'utf8')); } catch {}
    const key = `${estimateNo}::${purpose}`;
    data[key] = { code, timestamp: Date.now() };
    fs.writeFileSync(OTP_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function getLatestOtp(estimateNo, purpose) {
  try {
    const data = JSON.parse(fs.readFileSync(OTP_FILE, 'utf8'));
    const key = `${estimateNo}::${purpose}`;
    return data[key]?.code || null;
  } catch { return null; }
}

function clearOtps() {
  try { fs.writeFileSync(OTP_FILE, '{}'); } catch {}
}

module.exports = { logOtp, getLatestOtp, clearOtps, OTP_FILE };
