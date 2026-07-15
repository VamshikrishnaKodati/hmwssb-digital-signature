import mongoose from 'mongoose';

const estimateMovementSchema = new mongoose.Schema({
  estimateId: {
    type: String,
    required: true,
    trim: true,
  },
  estimateRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estimate',
  },
  fromStatus: {
    type: String,
    required: true,
  },
  toStatus: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  actorName: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  targetUserName: { type: String, default: '' },
  comments: { type: String, default: '', maxlength: 1000 },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
});

estimateMovementSchema.index({ estimateId: 1, createdAt: -1 });
estimateMovementSchema.index({ actorId: 1 });
estimateMovementSchema.index({ action: 1 });
estimateMovementSchema.index({ createdAt: -1 });

export default mongoose.model('EstimateMovement', estimateMovementSchema);
