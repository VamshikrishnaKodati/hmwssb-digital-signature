import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

const LOGIN_ATTEMPTS = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    logger.error('Auth', 'JWT_SECRET must be set and at least 32 characters');
    process.exit(1);
  }
  return secret;
};

const isLockedOut = (username) => {
  const record = LOGIN_ATTEMPTS.get(username);
  if (!record) return false;
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    if (Date.now() - record.lastAttempt < LOCKOUT_DURATION) {
      return true;
    }
    LOGIN_ATTEMPTS.delete(username);
  }
  return false;
};

const recordFailedAttempt = (username) => {
  const record = LOGIN_ATTEMPTS.get(username) || { attempts: 0, lastAttempt: 0 };
  record.attempts += 1;
  record.lastAttempt = Date.now();
  LOGIN_ATTEMPTS.set(username, record);
};

const clearFailedAttempts = (username) => {
  LOGIN_ATTEMPTS.delete(username);
};

export const signToken = (payload) => {
  const expiry = process.env.JWT_EXPIRY || '8h';
  return jwt.sign(payload, getJwtSecret(), { expiresIn: expiry });
};

export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export const authenticateUser = async (username, password, req) => {
  if (isLockedOut(username)) {
    logger.warn('Auth', 'Login attempt on locked account', { username });
    throw new AuthError('Account temporarily locked due to too many failed attempts. Try again later.', 429);
  }

  const user = await User.findOne({ username });
  if (!user) {
    recordFailedAttempt(username);
    logger.warn('Auth', 'Login failed - user not found', { username });
    throw new AuthError('Invalid username or password', 401);
  }

  if (user.status !== 'active') {
    logger.warn('Auth', 'Login failed - account inactive', { username, status: user.status });
    throw new AuthError('Account is inactive. Contact administrator.', 403);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    recordFailedAttempt(username);
    logger.warn('Auth', 'Login failed - wrong password', { username });
    throw new AuthError('Invalid username or password', 401);
  }

  clearFailedAttempts(username);

  const token = signToken({
    id: user._id,
    role: user.role,
  });

  await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } }).catch(e =>
    logger.error('Auth', 'Failed to update lastLogin', { error: e.message })
  );

  await AuditLog.create({
    userId: user._id,
    actorName: user.name,
    actorRole: user.role,
    action: 'LOGIN',
    entity: 'User',
    entityId: user._id.toString(),
    module: 'Authentication',
    description: `User ${user.username} logged in`,
    ip: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  }).catch(() => {});

  return {
    token,
    user: {
      id: user._id,
      employeeId: user.employeeId,
      username: user.username,
      role: user.role,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      designation: user.designation,
      region: user.region,
      zone: user.zone,
      division: user.division,
      circle: user.circle,
      ward: user.ward,
    },
  };
};
