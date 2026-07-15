import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 50,
  },
  password: {
    type: String,
    required: true,
    minlength: 12,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  mobile: {
    type: String,
    required: true,
    trim: true,
  },
  designation: {
    type: String,
    trim: true,
    default: '',
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'dgm', 'gm', 'ce', 'accounts', 'tender', 'engineer', 'viewer'],
    required: true,
    default: 'manager',
  },
  region: { type: String, trim: true, default: '' },
  zone: { type: String, trim: true, default: '' },
  division: { type: String, trim: true, default: '' },
  circle: { type: String, trim: true, default: '' },
  ward: { type: String, trim: true, default: '' },
  profileImage: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  lastLogin: Date,
}, {
  timestamps: true,
});

userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ region: 1, zone: 1, division: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const pw = this.password;
  if (pw.length < 12) {
    throw new Error('Password must be at least 12 characters long');
  }
  if (!/[A-Z]/.test(pw)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(pw)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(pw)) {
    throw new Error('Password must contain at least one digit');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) {
    throw new Error('Password must contain at least one special character');
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.statics.findByRole = function (role) {
  return this.find({ role, status: 'active' }).sort({ name: 1 });
};

userSchema.statics.validatePasswordStrength = function (password) {
  const errors = [];
  if (password.length < 12) errors.push('at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('a digit');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('a special character');
  return { valid: errors.length === 0, errors };
};

export default mongoose.model('User', userSchema);
