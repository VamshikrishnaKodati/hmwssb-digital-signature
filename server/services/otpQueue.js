import { getRedis } from '../config/redis.js';
import { sendOtpEmail } from '../utils/emailService.js';
import { sendOtpSms } from '../utils/smsService.js';
import logger from '../utils/logger.js';

const QUEUE_KEY = 'otp:delivery:queue';
const MAX_RETRIES = 3;

let isProcessing = false;

export const enqueueOtpDelivery = async (otpJob) => {
  const redis = getRedis();
  const job = {
    ...otpJob,
    retries: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await redis.lpush(QUEUE_KEY, JSON.stringify(job));
    logger.info('OTP Queue', `Job enqueued for estimate ${otpJob.estimateId}`);
    return true;
  } catch (err) {
    logger.warn('OTP Queue', 'Failed to enqueue, falling back to direct delivery', { error: err.message });
    await deliverOtpDirect(otpJob);
    return false;
  }
};

const deliverOtpDirect = async (job) => {
  try {
    await Promise.allSettled([
      job.email && sendOtpEmail(job.email, job.otp, job.estimateId),
      job.mobile && sendOtpSms(job.mobile, job.otp, job.estimateId),
    ]);
  } catch (err) {
    logger.error('OTP', 'Direct delivery failed', { estimateId: job.estimateId, error: err.message });
  }
};

export const processOtpQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  const redis = getRedis();

  const processOnce = async () => {
    try {
      const result = await redis.brpop?.(QUEUE_KEY, 5);
      if (!result) return;

      const job = JSON.parse(result[1] || result);
      logger.info('OTP Queue', `Processing job for estimate ${job.estimateId}`);

      const deliveryResults = await Promise.allSettled([
        job.email && sendOtpEmail(job.email, job.otp, job.estimateId),
        job.mobile && sendOtpSms(job.mobile, job.otp, job.estimateId),
      ]);

      const allFulfilled = deliveryResults.every(r => r.status === 'fulfilled');
      if (!allFulfilled && job.retries < MAX_RETRIES) {
        job.retries += 1;
        await redis.lpush(QUEUE_KEY, JSON.stringify(job));
        logger.warn('OTP Queue', `Retry ${job.retries}/${MAX_RETRIES} for estimate ${job.estimateId}`);
      } else if (!allFulfilled) {
        logger.error('OTP Queue', `Max retries reached for estimate ${job.estimateId}`, {
          results: deliveryResults.map(r => r.status),
        });
      }
    } catch (err) {
      if (err.message !== 'Connection is closed') {
        logger.error('OTP Queue', 'Processing error', { error: err.message });
      }
    }
  };

  while (isProcessing) {
    await processOnce();
  }
};

export const stopOtpQueue = () => {
  isProcessing = false;
};

export const getQueueLength = async () => {
  try {
    const redis = getRedis();
    const len = await redis.llen?.(QUEUE_KEY);
    return len || 0;
  } catch {
    return 0;
  }
};

export const clearQueue = async () => {
  try {
    const redis = getRedis();
    await redis.del(QUEUE_KEY);
    return true;
  } catch {
    return false;
  }
};
