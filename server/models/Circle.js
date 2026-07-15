import mongoose from 'mongoose';

const circleSchema = new mongoose.Schema({
  circleNo: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, { timestamps: true });

circleSchema.index({ circleNo: 1 });
circleSchema.index({ zone: 1 });
circleSchema.index({ name: 'text' });

export default mongoose.model('Circle', circleSchema);
