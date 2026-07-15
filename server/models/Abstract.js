import mongoose from 'mongoose';

const abstractSchema = new mongoose.Schema({
  estimateId: {
    type: String,
    required: true,
    trim: true,
  },
  estimateRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estimate',
  },
  materialCost: { type: Number, default: 0 },
  civilCost: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  gstPercent: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  lsAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  amountInWords: { type: String, default: '' },
  pdfPath: { type: String, default: '' },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  generatedByName: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
});

abstractSchema.index({ estimateId: 1 });
abstractSchema.index({ generatedBy: 1 });
abstractSchema.index({ createdAt: -1 });

export default mongoose.model('Abstract', abstractSchema);
