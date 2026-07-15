import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  entity: { type: String, default: '' },
  entityId: { type: String, default: '' },
  action: { type: String, required: true },
  module: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, default: 'success' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed },
  duration: { type: Number },
  requestId: { type: String },
}, { timestamps: true });

auditLogSchema.index({ entityId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1 });

auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditLog records are append-only and cannot be modified');
});

auditLogSchema.pre('updateOne', function () {
  throw new Error('AuditLog records are append-only and cannot be modified');
});

auditLogSchema.pre('updateMany', function () {
  throw new Error('AuditLog records are append-only and cannot be modified');
});

auditLogSchema.pre('findByIdAndUpdate', function () {
  throw new Error('AuditLog records are append-only and cannot be modified');
});

export default mongoose.model('AuditLog', auditLogSchema);
