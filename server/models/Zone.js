import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true,
  },
  zoneNo: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, { timestamps: true });

zoneSchema.index({ name: 1, region: 1 });
zoneSchema.index({ region: 1 });

export default mongoose.model('Zone', zoneSchema);
