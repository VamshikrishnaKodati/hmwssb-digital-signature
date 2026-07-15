import { incCounter } from './monitoringService.js';
import logger from '../utils/logger.js';

const ALERT_THRESHOLDS = {
  OTP_FAILURES_PER_WINDOW: 10,
  OTP_FAILURE_WINDOW_MS: 15 * 60 * 1000,
  SIGNATURE_FAILURES_PER_WINDOW: 5,
  RATE_LIMIT_HITS_PER_WINDOW: 20,
  FAILED_LOGINS_PER_USER: 5,
};

const recentEvents = new Map();

const recordEvent = (type, key) => {
  const fullKey = `${type}:${key}`;
  if (!recentEvents.has(fullKey)) {
    recentEvents.set(fullKey, []);
  }
  const timestamps = recentEvents.get(fullKey);
  const now = Date.now();
  timestamps.push(now);

  const windowType = type.startsWith('otp') ? ALERT_THRESHOLDS.OTP_FAILURE_WINDOW_MS : ALERT_THRESHOLDS.OTP_FAILURE_WINDOW_MS;
  const cutoff = now - windowType;
  const recent = timestamps.filter(t => t > cutoff);
  recentEvents.set(fullKey, recent);

  return recent.length;
};

export const alertOtpFailure = (userId, estimateId, reason) => {
  incCounter('otp_failed_total', { reason });
  const count = recordEvent('otp_failure', userId);

  if (count >= ALERT_THRESHOLDS.OTP_FAILURES_PER_WINDOW) {
    logger.warn('Alert', `HIGH OTP FAILURE RATE: User ${userId} has ${count} failures in window`, {
      userId,
      estimateId,
      reason,
      count,
      threshold: ALERT_THRESHOLDS.OTP_FAILURES_PER_WINDOW,
      alertType: 'SECURITY',
    });
    return { triggered: true, count, threshold: ALERT_THRESHOLDS.OTP_FAILURES_PER_WINDOW };
  }

  return { triggered: false, count };
};

export const alertOtpSuccess = (userId, estimateId) => {
  incCounter('otp_verified_total', { result: 'success' });
};

export const alertSignatureFailure = (userId, estimateId, reason) => {
  incCounter('signatures_failed_total', { reason });
  const count = recordEvent('sig_failure', userId);

  if (count >= ALERT_THRESHOLDS.SIGNATURE_FAILURES_PER_WINDOW) {
    logger.warn('Alert', `SIGNATURE FAILURE CLUSTER: User ${userId} has ${count} failures`, {
      userId,
      estimateId,
      reason,
      count,
      alertType: 'SECURITY',
    });
    return { triggered: true, count };
  }

  return { triggered: false, count };
};

export const alertRateLimitHit = (key, limiterType) => {
  incCounter('rate_limit_hits_total', { limiter: limiterType });
  const count = recordEvent('ratelimit', key);

  if (count >= ALERT_THRESHOLDS.RATE_LIMIT_HITS_PER_WINDOW) {
    logger.warn('Alert', `RATE LIMIT ABUSE: Key ${key} hit ${count} rate limits`, {
      key,
      limiterType,
      count,
      alertType: 'SECURITY',
    });
    return { triggered: true, count };
  }

  return { triggered: false, count };
};

export const alertFailedLogin = (username) => {
  incCounter('auth_login_failed_total');
  const count = recordEvent('login_fail', username);

  if (count >= ALERT_THRESHOLDS.FAILED_LOGINS_PER_USER) {
    logger.warn('Alert', `BRUTE FORCE DETECTED: ${count} failed logins for ${username}`, {
      username,
      count,
      alertType: 'SECURITY',
    });
    return { triggered: true, count };
  }

  return { triggered: false, count };
};

export const getAlertSummary = () => {
  const now = Date.now();
  const window = ALERT_THRESHOLDS.OTP_FAILURE_WINDOW_MS;
  const summary = {};

  for (const [key, timestamps] of recentEvents) {
    const recent = timestamps.filter(t => t > now - window);
    if (recent.length > 0) {
      summary[key] = { count: recent.length, lastOccurrence: new Date(Math.max(...recent)) };
    }
  }

  return summary;
};

export const cleanupAlertData = () => {
  const now = Date.now();
  for (const [key, timestamps] of recentEvents) {
    const recent = timestamps.filter(t => t > now - ALERT_THRESHOLDS.OTP_FAILURE_WINDOW_MS * 2);
    if (recent.length === 0) {
      recentEvents.delete(key);
    } else {
      recentEvents.set(key, recent);
    }
  }
};

setInterval(cleanupAlertData, 60 * 60 * 1000).unref();
