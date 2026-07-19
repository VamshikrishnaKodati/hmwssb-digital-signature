import mongoose from 'mongoose';

const estimateSchema = new mongoose.Schema({
  estimateId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
  },
  nameOfWork: {
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
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  managerName: { type: String, trim: true, default: '' },
  version: {
    type: String,
    default: 'V1.0',
  },
  status: {
    type: String,
    enum: [
      'Draft',
      'Abstract Generated',
      'Submitted',
      'DGM Review',
      'Reverted',
      'GM Review',
      'OTP Pending',
      'Digitally Signed',
      'Completed',
    ],
    default: 'Draft',
  },
  materialCost: { type: Number, default: 0 },
  civilCost: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  gstPercent: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  lsAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  pdfUrl: { type: String, default: '' },
  digitalSignature: { type: String, default: '' },
  signedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, default: '' },
    role: { type: String, default: '' },
    designation: { type: String, default: '' },
  },
  signedAt: { type: Date },
  remarks: { type: String, default: '', maxlength: 1000 },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EstimateItem' }],
  lastMovement: { type: mongoose.Schema.Types.ObjectId, ref: 'EstimateMovement' },
  estimateMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EstimateMovement' }],
  currentVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'EstimateVersion' },
  locked: { type: Boolean, default: false },
}, {
  timestamps: true,
});

estimateSchema.index({ status: 1 });
estimateSchema.index({ managerId: 1 });
estimateSchema.index({ workId: 1 });
estimateSchema.index({ region: 1, zone: 1, division: 1 });
estimateSchema.index({ createdAt: -1 });
estimateSchema.index({ grandTotal: 1 });

estimateSchema.statics.findByManager = function (managerId) {
  return this.find({ managerId }).sort({ createdAt: -1 });
};

estimateSchema.statics.findByStatus = function (status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

export default mongoose.model('Estimate', estimateSchema);
