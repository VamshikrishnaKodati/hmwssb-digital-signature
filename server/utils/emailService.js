import nodemailer from "nodemailer";
import logger from "./logger.js";
import { isPlaceholder } from "../utils/sanitize.js";

const buildTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass || isPlaceholder(user) || isPlaceholder(pass)) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
    });
};

export const sendEmail = async ({ to, subject, text, html }) => {
    const transporter = buildTransporter();

    if (!transporter) {
        logger.warn("Email", "SMTP not configured or using placeholder credentials. Email skipped.");
        return { success: false, reason: "smtp_not_configured" };
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            html,
        });
        return { success: true, messageId: info.messageId };
    } catch (err) {
        logger.error("Email", `Send failed: ${err.message}`);
        return { success: false, reason: err.message };
    }
};

const LOGO_URL = `${process.env.APP_URL || "http://localhost:5173"}/assets/logo/hmwssb-logo.png`;

const emailHeader = `
  <tr>
    <td style="background: linear-gradient(135deg, #16355C 0%, #0B5CAD 100%); padding: 24px 30px; text-align: center;">
      <img src="${LOGO_URL}" alt="HMWSSB" style="width: 64px; height: 64px; border-radius: 10px; margin-bottom: 12px;" />
      <h2 style="color: #fff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.06em;">HMWSSB</h2>
      <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 11px;">Hyderabad Metropolitan Water Supply &amp; Sewerage Board</p>
      <p style="color: rgba(255,255,255,0.7); margin: 2px 0 0; font-size: 10px;">Works Management System</p>
    </td>
  </tr>
`;

const emailFooter = `
  <tr>
    <td style="background: #f8f9fa; padding: 16px 30px; text-align: center; border-top: 3px solid #0B5CAD;">
      <p style="margin: 0; font-size: 11px; color: #6b7280;">
        &copy; ${new Date().getFullYear()} HMWSSB &middot; Government of Telangana
      </p>
      <p style="margin: 4px 0 0; font-size: 10px; color: #9ca3af;">
        This is an automated message from HMWSSB Works Management System. Please do not reply.
      </p>
    </td>
  </tr>
`;

export const sendOtpEmail = async ({ to, otp, estimateId, userName }) => {
    if (!to) {
        return { success: false, reason: "missing_recipient" };
    }

    const displayName = userName || "User";

    const subject = `HMWSSB Works Management System – Digital Signature OTP`;

    const text = `Dear ${displayName},\n\nYour OTP for Digital Signature Verification is:\n${otp}\n\nEstimate ID: ${estimateId}\nThis OTP is valid for 5 minutes.\nDo not share this OTP with anyone.\n\nHMWSSB Works Management System\nGovernment of Telangana`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; margin: 0;">
  <table style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
    ${emailHeader}
    <tr>
      <td style="padding: 30px;">
        <p style="font-size: 16px; margin: 0 0 12px;">Dear <strong>${displayName}</strong>,</p>
        <p style="font-size: 15px; color: #333; margin: 0 0 20px;">Your OTP for Digital Signature Verification is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0B5CAD; background: #EAF5FF; padding: 15px 30px; border-radius: 8px; display: inline-block;">${otp}</span>
        </div>
        <table style="width: 100%; font-size: 14px; color: #666; margin: 20px 0;">
          <tr>
            <td style="padding: 6px 0;"><strong>Estimate ID:</strong></td>
            <td style="padding: 6px 0;">${estimateId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0;"><strong>Valid for:</strong></td>
            <td style="padding: 6px 0;">5 minutes</td>
          </tr>
        </table>
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; margin: 20px 0;">
          <strong style="color: #856404;">⚠ Do not share this OTP with anyone.</strong>
        </div>
      </td>
    </tr>
    ${emailFooter}
  </table>
</body>
</html>`;

    return sendEmail({ to, subject, text, html });
};

export const sendApprovalEmail = async ({ to, estimateId, userName, status }) => {
    if (!to) {
        return { success: false, reason: "missing_recipient" };
    }

    const displayName = userName || "User";
    const statusLabel = status || "Updated";

    const subject = `HMWSSB Works Management System – Estimate ${statusLabel}`;

    const text = `Dear ${displayName},\n\nEstimate ${estimateId} has been ${statusLabel}.\nPlease review the updated status in the Works Management System.\n\nHMWSSB Works Management System\nGovernment of Telangana`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; margin: 0;">
  <table style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
    ${emailHeader}
    <tr>
      <td style="padding: 30px;">
        <p style="font-size: 16px; margin: 0 0 12px;">Dear <strong>${displayName}</strong>,</p>
        <p style="font-size: 15px; color: #333; margin: 0 0 20px;">Estimate <strong>${estimateId}</strong> has been <strong>${statusLabel}</strong>.</p>
        <p style="font-size: 14px; color: #666; margin: 0 0 20px;">Please review the updated status in the Works Management System.</p>
        <div style="background: #EAF5FF; border-left: 4px solid #0B5CAD; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <strong style="color: #0B5CAD;">Estimate: ${estimateId}</strong><br/>
          <span style="color: #666; font-size: 13px;">Status: ${statusLabel}</span>
        </div>
      </td>
    </tr>
    ${emailFooter}
  </table>
</body>
</html>`;

    return sendEmail({ to, subject, text, html });
};
