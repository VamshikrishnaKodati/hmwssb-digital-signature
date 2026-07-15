import mongoose from 'mongoose';

const estimateVersionSchema = new mongoose.Schema({
  estimateId: {
    type: String,
    required: true,
    trim: true,
  },
  estimateRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estimate',
  },
  version: {
    type: String,
    required: true,
  },
  previousVersion: { type: String, default: '' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdByName: { type: String, default: '' },
  reason: { type: String, default: '', maxlength: 500 },
  changes: { type: String, default: '', maxlength: 1000 },
  snapshot: {
    estimate: { type: mongoose.Schema.Types.Mixed },
    items: [{ type: mongoose.Schema.Types.Mixed }],
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
});

estimateVersionSchema.index({ estimateId: 1, version: -1 });
estimateVersionSchema.index({ createdBy: 1 });
estimateVersionSchema.index({ createdAt: -1 });

export default mongoose.model('EstimateVersion', estimateVersionSchema);
