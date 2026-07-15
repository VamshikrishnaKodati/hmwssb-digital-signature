import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info',
  },
  link: { type: String, default: '' },
  read: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
});

notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

notificationSchema.statics.send = async function ({ userId, title, message, type, link, metadata }) {
  return this.create({ userId, title, message, type: type || 'info', link: link || '', metadata });
};

notificationSchema.statics.markAllRead = async function (userId) {
  return this.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() }
  );
};

notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ userId, read: false });
};

export default mongoose.model('Notification', notificationSchema);
