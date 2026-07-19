import Joi from 'joi';

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

export const loginSchema = Joi.object({
  username: Joi.string().trim().lowercase().min(3).max(50).required()
    .messages({ 'string.min': 'Username must be at least 3 characters' }),
  password: Joi.string().min(8).max(128).required()
    .messages({ 'string.min': 'Password must be at least 8 characters' }),
});

export const createUserSchema = Joi.object({
  employeeId: Joi.string().trim().required(),
  username: Joi.string().trim().min(3).max(50).required(),
  password: Joi.string().pattern(passwordPattern).required().messages({
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)',
  }),
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required()
    .messages({ 'string.pattern.base': 'Must be a valid 10-digit Indian mobile number' }),
  designation: Joi.string().trim().allow('').optional(),
  role: Joi.string().valid('admin', 'manager', 'dgm', 'gm', 'ce', 'accounts', 'tender', 'engineer', 'viewer').required(),
  region: Joi.string().trim().allow('').optional(),
  zone: Joi.string().trim().allow('').optional(),
  division: Joi.string().trim().allow('').optional(),
  circle: Joi.string().trim().allow('').optional(),
  ward: Joi.string().trim().allow('').optional(),
});

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended').required(),
});

export const sendOtpSchema = Joi.object({
  estimateId: Joi.string().trim().min(3).max(50).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
});

export const resendOtpSchema = Joi.object({
  estimateId: Joi.string().trim().min(3).max(50).required(),
});

export const verifyOtpSchema = Joi.object({
  estimateId: Joi.string().trim().min(3).max(50).required(),
  otp: Joi.string().pattern(/^\d{6}$/).required()
    .messages({ 'string.pattern.base': 'OTP must be exactly 6 digits' }),
});

const estimateItemSchema = Joi.object({
  material: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().allow('').max(500).optional(),
  category: Joi.string().valid('Material', 'Civil').default('Material'),
  unit: Joi.string().trim().allow('').default('Nos'),
  rate: Joi.number().min(0).default(0),
  n: Joi.number().min(0).default(0),
  l: Joi.number().min(0).default(0),
  b: Joi.number().min(0).default(0),
  d: Joi.number().min(0).default(0),
  qty: Joi.number().min(0).default(0),
  gst: Joi.number().valid(0, 5, 12, 18, 28).default(18),
  amount: Joi.number().min(0).default(0),
  remarks: Joi.string().allow('').max(500).optional(),
});

export const createEstimateSchema = Joi.object({
  estimateId: Joi.string().trim().min(3).max(50).required(),
  workName: Joi.string().trim().min(3).max(500).optional(),
  nameOfWork: Joi.string().trim().min(3).max(500).optional(),
  region: Joi.string().trim().allow('').optional(),
  zone: Joi.string().trim().allow('').optional(),
  division: Joi.string().trim().allow('').optional(),
  circle: Joi.string().trim().allow('').optional(),
  ward: Joi.string().trim().allow('').optional(),
  items: Joi.array().items(estimateItemSchema).default([]),
  lsAmount: Joi.number().min(0).default(0),
}).oxor('workName', 'nameOfWork');

export const updateEstimateSchema = Joi.object({
  nameOfWork: Joi.string().trim().min(3).max(500).optional(),
  region: Joi.string().trim().allow('').optional(),
  zone: Joi.string().trim().allow('').optional(),
  division: Joi.string().trim().allow('').optional(),
  circle: Joi.string().trim().allow('').optional(),
  ward: Joi.string().trim().allow('').optional(),
  items: Joi.array().items(estimateItemSchema).optional(),
  lsAmount: Joi.number().min(0).optional(),
  remarks: Joi.string().trim().allow('').max(1000).optional(),
}).min(1);

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid(
    'Draft', 'Abstract Generated', 'Submitted', 'DGM Review',
    'Reverted', 'GM Review', 'OTP Pending',
    'Digitally Signed', 'Completed'
  ).required(),
  comments: Joi.string().trim().allow('').max(1000).optional(),
});

export const createItemSchema = Joi.object({
  itemCode: Joi.string().trim().min(1).max(20).required(),
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().allow('').max(500).optional(),
  category: Joi.string().valid('Material', 'Civil').required(),
  unit: Joi.string().trim().min(1).max(20).required(),
  rate: Joi.number().min(0).required(),
  gst: Joi.number().valid(0, 5, 12, 18, 28).default(18),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

export const updateItemSchema = Joi.object({
  itemCode: Joi.string().trim().min(1).max(20).optional(),
  name: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  category: Joi.string().valid('Material', 'Civil').optional(),
  unit: Joi.string().trim().min(1).max(20).optional(),
  rate: Joi.number().min(0).optional(),
  gst: Joi.number().valid(0, 5, 12, 18, 28).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
}).min(1);

export const generatePdfSchema = Joi.object({
  estimateId: Joi.string().trim().min(3).max(50).optional(),
  estimate: Joi.object().optional(),
  items: Joi.array().optional(),
}).oxor('estimateId', 'estimate');

export const createVersionSchema = Joi.object({
  notes: Joi.string().trim().allow('').max(500).optional(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', '-createdAt', 'name', '-name', 'grandTotal', '-grandTotal').default('-createdAt'),
});

export const reportFilterSchema = Joi.object({
  region: Joi.string().trim().allow('').optional(),
  zone: Joi.string().trim().allow('').optional(),
  division: Joi.string().trim().allow('').optional(),
  status: Joi.string().trim().allow('').optional(),
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export const revokeSignatureSchema = Joi.object({
  reason: Joi.string().trim().allow('').max(500).optional(),
});
