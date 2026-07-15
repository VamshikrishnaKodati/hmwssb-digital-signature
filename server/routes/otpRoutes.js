import express from 'express';
import { sendOTP, resendOTP, verifyOTP } from '../controllers/otpController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { sendOtpSchema, resendOtpSchema, verifyOtpSchema } from '../validations/schemas.js';
import { otpUserLimiter, otpIpLimiter, otpVerifyLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/send', authMiddleware, otpIpLimiter, otpUserLimiter, validate(sendOtpSchema), sendOTP);
router.post('/resend', authMiddleware, otpIpLimiter, otpUserLimiter, validate(resendOtpSchema), resendOTP);
router.post('/verify', authMiddleware, otpVerifyLimiter, validate(verifyOtpSchema), verifyOTP);

export default router;
