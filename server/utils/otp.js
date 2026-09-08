const crypto = require('crypto');

function generateOtp(length = 6) {
  return String(crypto.randomInt(0, 10 ** length)).padStart(length, '0');
}

function hashOtp(code, secret = process.env.JWT_SECRET || 'hmwssb-otp-secret') {
  return crypto.createHash('sha256').update(`${code}:${secret}`).digest('hex');
}

module.exports = { generateOtp, hashOtp };
