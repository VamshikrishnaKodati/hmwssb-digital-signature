// Minimal email sender.
// - If SMTP_* env vars are configured, delivers via SMTP (requires nodemailer).
// - Otherwise logs the message to the server console (development/testing mode).

const fs = require('fs');
const path = require('path');

// Masks the local part of an email so recipients are never exposed in the UI
// or in API responses. E.g. "kodativamsikrishna@gmail.com" ->
// "k***************a@gmail.com". Already-masked values are returned unchanged.
function maskEmail(email) {
  if (!email || !String(email).includes('@')) return email || '';
  const [local, domain] = String(email).split('@');
  if (local.includes('*')) return String(email);
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

// Official HMWSSB logo, attached as a CID so it renders in Gmail/Outlook etc.
// (Inline base64 data URIs are stripped by Gmail; CID attachments are not.)
function logoAttachment() {
  try {
    const logoPath = path.resolve(__dirname, '../../client/public/hmwssb-logo.jpg');
    if (!fs.existsSync(logoPath)) return null;
    return {
      filename: 'hmwssb-logo.jpg',
      path: logoPath,
      cid: 'hmwssb-logo',
    };
  } catch {
    return null;
  }
}

async function sendMail({ to, subject, text, html }) {
  if (!to) return false;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      // Lazy require so the server still boots without nodemailer installed
      // as long as no SMTP credentials are configured.
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000,
      });
      const mail = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
      };
      if (html) {
        mail.html = html;
        if (html.includes('cid:hmwssb-logo')) {
          const logo = logoAttachment();
          if (logo) mail.attachments = [logo];
        }
      }
      await transporter.sendMail(mail);
      console.log(`[mailer] OTP email sent to ${to}`);
      return true;
    } catch (err) {
      console.error('[mailer] SMTP send failed:', err.message);
      return false;
    }
  }

  console.log(`[mailer][DEV] Email to ${to} — ${subject}\n${text}`);
  return false;
}

// Resolves the OTP recipient for a given user.
// In production returns the user's registered email; in non-production,
// MAIL_DEV_RECIPIENT env var overrides it so OTPs land in a shared dev inbox.
const db = require('../config/db');

async function resolveEmail(userId) {
  const userRes = await db.query('SELECT "Email" FROM "Users" WHERE "UserID" = $1', [userId]);
  const registeredEmail = userRes.rows[0]?.Email || null;
  if (process.env.NODE_ENV !== 'production' && process.env.MAIL_DEV_RECIPIENT)
    return process.env.MAIL_DEV_RECIPIENT;
  return registeredEmail;
}

module.exports = { sendMail, maskEmail, resolveEmail };
