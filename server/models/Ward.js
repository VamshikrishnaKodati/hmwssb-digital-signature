import mongoose from 'mongoose';

const wardSchema = new mongoose.Schema({
  wardNo: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  circle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Circle',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, { timestamps: true });

wardSchema.index({ wardNo: 1 });
wardSchema.index({ circle: 1 });
wardSchema.index({ name: 'text' });

export default mongoose.model('Ward', wardSchema);
