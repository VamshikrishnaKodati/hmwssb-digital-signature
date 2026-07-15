import crypto from 'crypto';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { authenticateUser } from '../services/authService.js';
import { success, created, error, notFound, conflict } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const generateSecurePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const pwd = Array.from({ length: 12 }, () => chars[crypto.randomInt(chars.length)]).join('');
  return pwd;
};

export const login = async (req, res, next) => {
  try {
    const result = await authenticateUser(req.body.username, req.body.password, req);
    return success(res, { data: result, message: 'Login successful' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return notFound(res, 'User not found');
    return success(res, { data: { user } });
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, role, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const users = await User.find(filter)
      .select('-password')
      .sort({ name: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await User.countDocuments(filter);

    return success(res, {
      data: { users },
      meta: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);

    await AuditLog.create({
      userId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user._id.toString(),
      module: 'User Management',
      description: `Created user ${user.username}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: { username: user.username, role: user.role },
    });

    return created(res, { data: { user: user.toPublicJSON() }, message: 'User created successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return conflict(res, 'Username, email, or employee ID already exists.');
    }
    next(err);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).select('-password');
    if (!user) return notFound(res, 'User not found');

    await AuditLog.create({
      userId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'USER_STATUS_UPDATED',
      entity: 'User',
      entityId: id,
      module: 'User Management',
      description: `Updated user ${user.username} status to ${status}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: { targetUserId: id, newStatus: status },
    });

    return success(res, { data: { user }, message: 'User status updated' });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return error(res, { message: 'Cannot delete your own account', statusCode: 400 });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) return notFound(res, 'User not found');

    await AuditLog.create({
      userId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'USER_DELETED',
      entity: 'User',
      entityId: id,
      module: 'User Management',
      description: `Deleted user ${user.username}`,
      ip: req.ip,
    });

    return success(res, { message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const seedUsers = async () => {
  const count = await User.countDocuments();

  const missing = await User.countDocuments({
    $or: [
      { employeeId: { $exists: false } }, { email: { $exists: false } }, { mobile: { $exists: false } },
      { employeeId: null }, { email: null }, { mobile: null },
      { employeeId: '' }, { email: '' }, { mobile: '' },
    ],
  });
  if (missing > 0) {
    logger.info('Seed', `Fixing ${missing} users missing required fields`);
    await User.updateMany(
      { $or: [{ employeeId: { $exists: false } }, { employeeId: null }, { employeeId: '' }] },
      { $set: { employeeId: 'EMP-OLD-' + Date.now() } }
    );
    await User.updateMany(
      { $or: [{ email: { $exists: false } }, { email: null }, { email: '' }] },
      { $set: { email: 'kodativamsikrishna@gmail.com' } }
    );
    await User.updateMany(
      { $or: [{ mobile: { $exists: false } }, { mobile: null }, { mobile: '' }] },
      { $set: { mobile: '9392598134' } }
    );
  }

  const devEmailBase = 'kodativamsikrishna';
  const devEmailDomain = 'gmail.com';
  const devMobile = '9392598134';

  const users = [
    {
      employeeId: 'EMP001', username: 'admin', password: 'Admin@123456',
      role: 'admin', name: 'System Administrator', designation: 'Administrator',
      email: `${devEmailBase}+admin@${devEmailDomain}`, mobile: devMobile,
      region: 'Head Office', zone: 'All', division: 'All', circle: 'All', ward: 'All',
    },
    {
      employeeId: 'EMP002', username: 'manager01', password: 'Manager@1234',
      role: 'manager', name: 'Jayakumar Karikati', designation: 'Manager',
      email: `${devEmailBase}+manager01@${devEmailDomain}`, mobile: devMobile,
      region: 'Hyderabad', zone: 'Kukatpally', division: 'VI', circle: '21', ward: '113',
    },
    {
      employeeId: 'EMP003', username: 'dgm01', password: 'Dgm@12345678',
      role: 'dgm', name: 'Deputy General Manager', designation: 'DGM',
      email: `${devEmailBase}+dgm01@${devEmailDomain}`, mobile: devMobile,
      region: 'Hyderabad', zone: 'Kukatpally', division: 'VI', circle: '21', ward: '113',
    },
    {
      employeeId: 'EMP004', username: 'gm01', password: 'Gm@123456789',
      role: 'gm', name: 'General Manager', designation: 'GM',
      email: `${devEmailBase}+gm01@${devEmailDomain}`, mobile: devMobile,
      region: 'Hyderabad', zone: 'Kukatpally', division: 'VI', circle: '21', ward: '113',
    },
    {
      employeeId: 'EMP005', username: 'ce01', password: 'Ce@123456789',
      role: 'ce', name: 'Chief Engineer', designation: 'Chief Engineer',
      email: `${devEmailBase}+ce01@${devEmailDomain}`, mobile: devMobile,
      region: 'Head Office', zone: 'All', division: 'All', circle: 'All', ward: 'All',
    },
    {
      employeeId: 'EMP006', username: 'accounts01', password: 'Accounts@123',
      role: 'accounts', name: 'Accounts Officer', designation: 'Accounts Officer',
      email: `${devEmailBase}+accounts01@${devEmailDomain}`, mobile: devMobile,
      region: 'Head Office', zone: 'All', division: 'All', circle: 'All', ward: 'All',
    },
    {
      employeeId: 'EMP007', username: 'tender01', password: 'Tender@12345',
      role: 'tender', name: 'Tender Officer', designation: 'Tender Officer',
      email: `${devEmailBase}+tender01@${devEmailDomain}`, mobile: devMobile,
      region: 'Head Office', zone: 'All', division: 'All', circle: 'All', ward: 'All',
    },
    {
      employeeId: 'EMP008', username: 'engineer01', password: 'Engineer@1234',
      role: 'engineer', name: 'Assistant Engineer', designation: 'Site Engineer',
      email: `${devEmailBase}+engineer01@${devEmailDomain}`, mobile: devMobile,
      region: 'Hyderabad', zone: 'Kukatpally', division: 'VI', circle: '21', ward: '113',
    },
  ];

  if (count > 0) {
    const targetUsernames = users.map(u => u.username);
    const existingTargets = await User.find({ username: { $in: targetUsernames } }).select('username email');
    for (const u of existingTargets) {
      const desiredEmail = `kodativamsikrishna+${u.username}@gmail.com`;
      if (u.email !== desiredEmail) {
        await User.updateOne({ _id: u._id }, { $set: { email: desiredEmail } }).catch(() => {});
      }
    }

    for (const userData of users) {
      const existing = await User.findOne({ username: userData.username });
      if (existing) {
        existing.employeeId = userData.employeeId;
        existing.name = userData.name;
        existing.role = userData.role;
        existing.designation = userData.designation;
        existing.email = userData.email;
        existing.mobile = userData.mobile;
        if (userData.region) {
          existing.region = userData.region;
          existing.zone = userData.zone;
          existing.division = userData.division;
          existing.circle = userData.circle;
          existing.ward = userData.ward;
        }
        existing.password = userData.password;
        await existing.save();
      } else {
        await User.create(userData).catch(() => {});
      }
    }
    logger.info('Seed', `Seeded/updated ${users.length} development users`);
    return;
  }

  for (const userData of users) {
    await User.create(userData);
  }
  logger.info('Seed', `Created ${users.length} development test accounts`);
};
