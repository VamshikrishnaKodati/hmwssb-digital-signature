import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getRedis, isRedisConnected } from '../config/redis.js';

class RedisStore {
  constructor(prefix, windowMs) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key) {
    const redis = getRedis();
    const fullKey = `${this.prefix}:${key}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const pipeline = redis.pipeline?.() || null;
    if (pipeline) {
      pipeline.zremrangebyscore(fullKey, 0, windowStart);
      pipeline.zadd(fullKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
      pipeline.zcard(fullKey);
      pipeline.pexpire(fullKey, this.windowMs);
      const results = await pipeline.exec();
      const totalHits = results?.[2]?.[1] || 0;
      return { totalHits: Number(totalHits), resetTime: new Date(now + this.windowMs) };
    }

    const totalHits = await redis.incr(fullKey);
    if (totalHits === 1) {
      await redis.expire(fullKey, Math.ceil(this.windowMs / 1000));
    }
    return { totalHits: Number(totalHits), resetTime: new Date(now + this.windowMs) };
  }

  async reset(key) {
    const redis = getRedis();
    await redis.del(`${this.prefix}:${key}`);
  }
}

const createStore = (prefix, windowMs) => {
  if (isRedisConnected()) {
    return new RedisStore(prefix, windowMs);
  }
  return undefined;
};

export const otpUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  message: { success: false, message: 'Too many OTP requests. Try again in 15 minutes.', code: 'OTP_RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: createStore('rl:otp:user', 15 * 60 * 1000),
});

export const otpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { success: false, message: 'Too many requests from this IP.', code: 'IP_RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:otp:ip', 15 * 60 * 1000),
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.user?.id || ipKeyGenerator(req)}:${req.body.estimateId || 'unknown'}`,
  message: { success: false, message: 'Too many verification attempts. Request a new OTP.', code: 'VERIFY_RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:otp:verify', 15 * 60 * 1000),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.username || ipKeyGenerator(req),
  message: { success: false, message: 'Too many login attempts. Try again later.', code: 'LOGIN_RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:auth', 15 * 60 * 1000),
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  store: createStore('rl:global', 15 * 60 * 1000),
});
