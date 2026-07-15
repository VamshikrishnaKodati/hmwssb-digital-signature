import mongoose from 'mongoose';

const estimateItemSchema = new mongoose.Schema({
  estimateId: {
    type: String,
    required: true,
    trim: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
  },
  category: {
    type: String,
    enum: ['Material', 'Civil'],
    default: 'Material',
  },
  material: {
    type: String,
    trim: true,
    required: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  unit: {
    type: String,
    trim: true,
    default: 'Nos',
  },
  rate: {
    type: Number,
    default: 0,
    min: 0,
  },
  n: { type: Number, default: 0, min: 0 },
  l: { type: Number, default: 0, min: 0 },
  b: { type: Number, default: 0, min: 0 },
  d: { type: Number, default: 0, min: 0 },
  qty: { type: Number, default: 0, min: 0 },
  gst: {
    type: Number,
    default: 18,
    enum: [0, 5, 12, 18, 28],
  },
  amount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, {
  timestamps: true,
});

estimateItemSchema.index({ estimateId: 1 });
estimateItemSchema.index({ itemId: 1 });

estimateItemSchema.virtual('totalWithGst').get(function () {
  return this.amount * (1 + this.gst / 100);
});

estimateItemSchema.set('toJSON', { virtuals: true });
estimateItemSchema.set('toObject', { virtuals: true });

export default mongoose.model('EstimateItem', estimateItemSchema);
