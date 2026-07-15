import mongoose from 'mongoose';

const workMasterSchema = new mongoose.Schema({
  workId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  region: { type: String, trim: true, default: '' },
  zone: { type: String, trim: true, default: '' },
  division: { type: String, trim: true, default: '' },
  circle: { type: String, trim: true, default: '' },
  ward: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: '' },
  estimatedCompletionDate: Date,
  workType: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed', 'cancelled'],
    default: 'active',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

workMasterSchema.index({ workId: 1 });
workMasterSchema.index({ status: 1 });
workMasterSchema.index({ region: 1, zone: 1 });

export default mongoose.model('WorkMaster', workMasterSchema);
