import twilio from "twilio";
import logger from "./logger.js";
import { isPlaceholder } from "../utils/sanitize.js";

const normalizePhone = (phone) => {
    if (!phone) return null;
    const digits = `${phone}`.replace(/\D/g, "");
    if (!digits) return null;
    return digits.startsWith("91") && digits.length > 10 ? `+${digits}` : `+${digits}`;
};

export const sendSms = async ({ to, body }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;

    if (!accountSid || !authToken || !from || isPlaceholder(accountSid) || isPlaceholder(authToken) || isPlaceholder(from)) {
        logger.warn("SMS", "Twilio not configured or using placeholder credentials. SMS skipped.");
        return { success: false, reason: "twilio_not_configured" };
    }

    if (!accountSid.startsWith("AC")) {
        return { success: false, reason: "invalid_account_sid" };
    }

    const client = twilio(accountSid, authToken);
    const formattedTo = normalizePhone(to);

    if (!formattedTo) {
        return { success: false, reason: "invalid_phone" };
    }

    try {
        const message = await client.messages.create({
            body,
            from,
            to: formattedTo,
        });
        return { success: true, sid: message.sid };
    } catch (err) {
        logger.error("SMS", `Send failed: ${err.message}`);
        return { success: false, reason: err.message };
    }
};

export const sendOtpSms = async ({ to, otp, estimateId }) => {
    if (!to) {
        return { success: false, reason: "missing_recipient" };
    }

    return sendSms({
        to,
        body: `HMWSSB Works System\nOTP for Estimate ${estimateId}: ${otp}\nValid for 5 minutes. Do not share.`,
    });
};
