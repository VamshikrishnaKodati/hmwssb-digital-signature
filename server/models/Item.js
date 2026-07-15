import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },
  category: {
    type: String,
    enum: ['Material', 'Civil'],
    required: true,
  },
  unit: {
    type: String,
    required: true,
    trim: true,
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
  },
  gst: {
    type: Number,
    enum: [0, 5, 12, 18, 28],
    default: 18,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

itemSchema.index({ name: 'text', description: 'text' });
itemSchema.index({ category: 1, status: 1 });
itemSchema.index({ status: 1 });

export default mongoose.model('Item', itemSchema);
