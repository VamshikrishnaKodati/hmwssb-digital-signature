# HMWSSB Works Management System — Technical Design Document

**Document Version:** 2.0  
**Date:** 2026-07-19  
**Author:** Solution Architect & Technical Lead  
**Status:** Implementation Ready  
**Baseline:** Business Process Re-engineering Blueprint v2.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Gap Analysis — Current State vs Target State](#2-gap-analysis)
3. [System Architecture](#3-system-architecture)
4. [Database Design — New Collections](#4-database-design)
5. [API Design — New Endpoints](#5-api-design)
6. [Configurable Approval-Matrix Engine](#6-approval-matrix-engine)
7. [Module Specifications](#7-module-specifications)
8. [Notification & SLA Engine](#8-notification--sla-engine)
9. [Frontend Design](#9-frontend-design)
10. [Business Rules Implementation](#10-business-rules)
11. [Implementation Phases](#11-implementation-phases)
12. [Testing Strategy](#12-testing-strategy)
13. [Appendix — Reference Blueprint Mapping](#13-appendix)

---

## 1. Executive Summary

The existing HMWSSB Digital Signature System covers the estimate preparation slice of the works lifecycle. This Technical Design Document translates the v2.0 Business Process Blueprint into concrete, implementable specifications for the full works lifecycle — from estimate preparation through completion certificate and retention release.

### What Exists Today

| Module | Status | Notes |
|--------|--------|-------|
| JWT Authentication + RBAC | Complete | 9 roles, bcrypt, account lockout |
| Estimate CRUD + Versioning | Complete | Multi-step workflow, version snapshots |
| Digital Signature (PAdES) | Complete | RSA-2048, X.509, PKCS#12, RFC 3161 |
| OTP (Email + SMS) | Complete | HMAC-SHA256, rate limiting, cooldown |
| PDF Abstract Generation | Complete | Playwright HTML-to-PDF |
| Reports + CSV Export | Complete | Filtered by hierarchy |
| Audit Logging | Complete | Append-only |
| Item Master | Complete | 29 seeded items |
| Geographic Hierarchy | Complete | Region > Zone > Circle > Ward |
| Notifications (Backend) | Partial | Model exists, UI not integrated |

### What This Document Specifies

| New Module | Description |
|------------|-------------|
| Administrative Sanction (AS) | Client-side approval that work is needed and funded |
| Technical Sanction (TS) | Engineering certification of estimate soundness |
| Tender Management | NIT auto-generation, eProcurement integration, bid evaluation |
| Agreement Management | Contract execution, EMD/security deposit tracking |
| Work Execution & Measurement Book | Work order, digital MB, photo evidence, deviation handling |
| Billing Management | RA Bill engine, Final Bill, cumulative calculation, finance concurrence |
| Completion & Retention Management | 3-stage completion, DLP tracking, retention release, asset handover |
| Approval-Matrix Engine | Configurable delegation of powers, slab-based routing |
| SLA & Escalation Engine | Timer-based SLA tracking with auto-escalation |
| Enhanced Dashboards | Role-specific dashboards from site level to Board level |

---

## 2. Gap Analysis

### 2.1 Structural Gaps

| Gap | Current State | Required State | Impact |
|-----|---------------|----------------|--------|
| Single approval step | Estimate goes through Manager > DGM > GM as one flow | AS and TS must be two distinct approvals with separate reference numbers | Fundamental workflow redesign |
| No tender module | None | NIT auto-generation, eProcurement portal integration, bid evaluation | New module |
| No agreement tracking | None | Contract generation, EMD conversion, security deposit, bank guarantee | New module |
| No measurement book | None | Digital MB with joint measurement, test-check locking, photo evidence | New module |
| No billing engine | None | Cumulative RA Bill formula, Final Bill, finance concurrence | New module |
| No completion tracking | None | 3-stage completion, DLP countdown, retention release | New module |
| Hard-coded approval flow | `Draft > Submitted > DGM Review > GM Review > OTP > Signed` | Configurable delegation-of-powers master table | Approval-matrix engine |
| No SLA tracking | None | Timer per stage, escalation on breach | New engine |
| No deviation handling | None | ±10% band with mandatory Deviation Sanction | New sub-workflow |

### 2.2 Role Gaps

| Current Roles | New/Enhanced Roles |
|---------------|-------------------|
| admin, manager, dgm, gm, ce, accounts, tender, engineer, viewer | Add: `director`, `md`, `board` (or map `ce` to Director) |
| No distinction between Technical and O&M directors | Split `director` into `director_technical`, `director_om`, `director_finance` |

### 2.3 Status Flow Gap

**Current (linear):**
```
Draft > Abstract Generated > Submitted > DGM Review > Reverted > GM Review > OTP Pending > Digitally Signed > Completed
```

**Required (parallel branching):**
```
Estimate Prepared
  -> Technical Review (DGM)
  -> Administrative Sanction (GM/Director/MD per slab)
  -> Technical Sanction (DGM/GM/Director per slab)
  -> Tender / NIT (both AS + TS required)
  -> Bid Evaluation
  -> Agreement
  -> Work Order (auto-generated)
  -> Execution & MB Entry
  -> Running Bills
  -> Final Bill
  -> Completion Certificate
  -> Retention Release
```

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Estimate  │ │ Tender   │ │ Billing  │ │Dashboard  │  │
│  │Module    │ │ Module   │ │ Module   │ │(Role-Spec)│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Admin San │ │Agreement │ │Measuremt │ │Completion │  │
│  │ Module   │ │ Module   │ │Book Mod  │ │ Module    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (Axios)
┌──────────────────────┴──────────────────────────────────┐
│                Express.js Backend (ESM)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Approval-Matrix Engine                  │   │
│  │    (DelegationOfPowers master table driver)       │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Estimate  │ │ Tender   │ │ Billing  │ │Work Exec  │  │
│  │Controller│ │Controller│ │Controller│ │Controller │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Agreement │ │MB        │ │Completion│ │SLA Engine │  │
│  │Controller│ │Controller│ │Controller│ │(Cron Jobs)│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Notification Engine (Email/SMS/In-App)   │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services: PKI, PDF, Digital Signature, OTP, Audit│   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   ┌────┴────┐                  ┌─────┴────┐
   │MongoDB 7│                  │  Redis    │
   │(Primary)│                  │(Optional) │
   └─────────┘                  └──────────┘
```

### 3.2 New Backend Modules

```
server/
├── models/           # +12 new Mongoose models
├── controllers/      # +8 new controllers
├── routes/           # +8 new route groups
├── services/         # +4 new services
├── middleware/       # +1 new middleware (approvalMatrix)
├── jobs/             # +1 new directory (SLA cron jobs)
└── validations/      # Extend schemas.js
```

### 3.3 New Frontend Modules

```
client/src/
├── pages/
│   ├── AdministrativeSanction/
│   ├── TechnicalSanction/
│   ├── TenderManagement/
│   ├── AgreementManagement/
│   ├── MeasurementBook/
│   ├── BillingManagement/
│   ├── CompletionManagement/
│   ├── ApprovalMatrixAdmin/
│   └── EnhancedDashboard/
├── components/
│   ├── ApprovalWorkflow/
│   ├── SLATimer/
│   ├── DeviationBadge/
│   └── CumulativeBillTable/
└── services/
    └── api.js  (extend with new API modules)
```

---

## 4. Database Design

### 4.1 New Mongoose Models

All new models follow the existing convention: `timestamps: true`, compound indexes on hot paths, and version-control fields where applicable.

---

#### 4.1.1 DelegationOfPowers (Master Table)

```javascript
// server/models/DelegationOfPowers.js
const delegationSchema = new mongoose.Schema({
  stage: {
    type: String,
    required: true,
    enum: [
      'administrative_sanction',
      'technical_sanction',
      'tender_approval',
      'agreement',
      'work_order',
      'measurement_book',
      'running_bill',
      'final_bill',
      'completion_certificate',
    ],
  },
  role: {
    type: String,
    required: true,
    enum: ['ae', 'dgm', 'gm', 'director_technical', 'director_om', 'director_finance', 'md', 'board'],
  },
  minAmount: { type: Number, required: true, min: 0 },
  maxAmount: { type: Number, required: true, min: 0 },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, default: null },  // null = currently active
  isActive: { type: Boolean, default: true },
  boardResolutionRef: { type: String, default: '' },  // Board resolution notification number
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

delegationSchema.index({ stage: 1, isActive: 1 });
delegationSchema.index({ stage: 1, minAmount: 1, maxAmount: 1 });
delegationSchema.index({ effectiveFrom: -1 });
```

---

#### 4.1.2 AdministrativeSanction

```javascript
// server/models/AdministrativeSanction.js
const adminSanctionSchema = new mongoose.Schema({
  asNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  estimateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estimate',
    required: true,
  },
  estimatedAmount: { type: Number, required: true },
  sanctionedAmount: { type: Number, required: true },
  budgetHead: { type: String, default: '' },
  budgetYear: { type: String, default: '' },
  sourceOfFunds: { type: String, default: '' },  // e.g., 'Capex Plan 2026-27'
  approvingRole: {
    type: String,
    required: true,
    enum: ['dgm', 'gm', 'director_om', 'md', 'board'],
  },
  approvingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  delegationVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DelegationOfPowers',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'reverted'],
    default: 'pending',
  },
  remarks: { type: String, default: '', maxlength: 2000 },
  digitalSignature: { type: String, default: '' },
  signedAt: { type: Date },
  revertedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdministrativeSanction',
  },
  version: { type: Number, default: 1 },
}, { timestamps: true });

adminSanctionSchema.index({ workId: 1 });
adminSanctionSchema.index({ estimateId: 1 });
adminSanctionSchema.index({ status: 1 });
adminSanctionSchema.index({ asNumber: 1 });
adminSanctionSchema.index({ approvingUserId: 1 });
```

---

#### 4.1.3 TechnicalSanction

```javascript
// server/models/TechnicalSanction.js
const techSanctionSchema = new mongoose.Schema({
  tsNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  estimateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estimate',
    required: true,
  },
  estimateVersion: { type: Number, required: true },  // locked estimate version
  estimatedAmount: { type: Number, required: true },
  sanctionedAmount: { type: Number, required: true },
  approvingRole: {
    type: String,
    required: true,
    enum: ['dgm', 'gm', 'director_technical', 'md'],
  },
  approvingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  delegationVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DelegationOfPowers',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'reverted'],
    default: 'pending',
  },
  remarks: { type: String, default: '', maxlength: 2000 },
  digitalSignature: { type: String, default: '' },
  signedAt: { type: Date },
  revertedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TechnicalSanction',
  },
  version: { type: Number, default: 1 },
  estimateLocked: { type: Boolean, default: false },  // true after TS approval
}, { timestamps: true });

techSanctionSchema.index({ workId: 1 });
techSanctionSchema.index({ estimateId: 1 });
techSanctionSchema.index({ status: 1 });
techSanctionSchema.index({ tsNumber: 1 });
techSanctionSchema.index({ approvingUserId: 1 });
```

---

#### 4.1.4 Tender

```javascript
// server/models/Tender.js
const tenderSchema = new mongoose.Schema({
  nitNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  estimateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estimate',
    required: true,
  },
  technicalSanctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TechnicalSanction',
    required: true,
  },
  administrativeSanctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdministrativeSanction',
    required: true,
  },
  tenderType: {
    type: String,
    enum: ['open', 'limited', 'single', 'nomination'],
    default: 'open',
  },
  estimatedValue: { type: Number, required: true },
  emdAmount: { type: Number, required: true },  // typically 2% of estimate
  emdBidPeriod: { type: Number, default: 21 },  // days
  bidValidityDays: { type: Number, default: 120 },
  workCompletionDays: { type: Number, required: true },
  publicationDate: Date,
  bidOpeningDate: Date,
  bidClosingDate: Date,
  portalReferenceId: { type: String, default: '' },  // eProcurement portal ref
  status: {
    type: String,
    enum: [
      'draft',
      'published',
      'bids_received',
      'technical_evaluation',
      'financial_evaluation',
      'approved',
      'rejected',
      'cancelled',
      'no_bid',
    ],
    default: 'draft',
  },
  approvingRole: {
    type: String,
    enum: ['dgm', 'gm', 'director_technical', 'md'],
  },
  approvingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  delegationVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DelegationOfPowers',
  },
  tenderApprovalNumber: { type: String, default: '' },
  approvalRemarks: { type: String, default: '' },
  digitalSignature: { type: String, default: '' },
  signedAt: { type: Date },
  eligibilityCriteria: [{ type: String }],
  specialConditions: [{ type: String }],
  preBidMeetingDate: Date,
  documents: [{ type: String }],  // file paths
}, { timestamps: true });

tenderSchema.index({ workId: 1 });
tenderSchema.index({ status: 1 });
tenderSchema.index({ nitNumber: 1 });
tenderSchema.index({ bidOpeningDate: 1 });
```

---

#### 4.1.5 BidEvaluation

```javascript
// server/models/BidEvaluation.js
const bidEvaluationSchema = new mongoose.Schema({
  tenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tender',
    required: true,
  },
  bidderName: { type: String, required: true, trim: true },
  bidderRegistrationNo: { type: String, default: '' },
  emdSubmitted: { type: Boolean, default: false },
  emdAmount: { type: Number, default: 0 },
  technicalBidScore: { type: Number, default: 0 },
  technicalBidPassed: { type: Boolean, default: false },
  financialBidAmount: { type: Number, default: 0 },
  calculatedAmount: { type: Number, default: 0 },  // after arithmetic correction
  deviationPercent: { type: Number, default: 0 },  // vs estimate
  isL1: { type: Boolean, default: false },
  isL1Evaluated: { type: Boolean, default: false },
  evaluationRemarks: { type: String, default: '' },
  technicalRemarks: { type: String, default: '' },
  financialRemarks: { type: String, default: '' },
  status: {
    type: String,
    enum: ['submitted', 'technical_evaluation', 'financial_evaluation', 'recommended', 'rejected', 'disqualified'],
    default: 'submitted',
  },
  documents: [{ type: String }],  // scanned bid docs
}, { timestamps: true });

bidEvaluationSchema.index({ tenderId: 1 });
bidEvaluationSchema.index({ tenderId: 1, isL1: 1 });
bidEvaluationSchema.index({ status: 1 });
```

---

#### 4.1.6 Agreement

```javascript
// server/models/Agreement.js
const agreementSchema = new mongoose.Schema({
  agreementNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  tenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tender',
    required: true,
  },
  contractorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractorMaster',
    required: true,
  },
  contractValue: { type: Number, required: true },
  securityDepositPercent: { type: Number, default: 5 },
  securityDepositAmount: { type: Number, required: true },
  performanceGuaranteePercent: { type: Number, default: 5 },
  performanceGuaranteeAmount: { type: Number, default: 0 },
  emdAdjusted: { type: Number, default: 0 },  // EMD converted to SD
  additionalSD: { type: Number, default: 0 },
  defectLiabilityMonths: { type: Number, default: 12 },
  workCompletionMonths: { type: Number, required: true },
  commencementDate: { type: Date, required: true },
  expectedCompletionDate: { type: Date, required: true },
  milestoneSchedule: [{
    milestoneName: String,
    description: String,
    targetDate: Date,
    percentage: Number,
  }],
  bankGuaranteeRef: { type: String, default: '' },
  bankGuaranteeExpiry: { type: Date },
  status: {
    type: String,
    enum: ['draft', 'pending_signature', 'executed', 'terminated', 'completed'],
    default: 'draft',
  },
  approvingRole: {
    type: String,
    enum: ['dgm', 'gm', 'director_technical'],
  },
  approvingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  hmwssbSignatory: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    designation: String,
    signedAt: Date,
  },
  contractorSignatory: {
    name: String,
    designation: String,
    signedAt: Date,
    signatoryDocument: String,  // path to scanned signature
  },
  digitalSignature: { type: String, default: '' },
  agreementDocument: { type: String, default: '' },  // path to generated PDF
  remarks: { type: String, default: '' },
}, { timestamps: true });

agreementSchema.index({ workId: 1 });
agreementSchema.index({ tenderId: 1 });
agreementSchema.index({ contractorId: 1 });
agreementSchema.index({ status: 1 });
agreementSchema.index({ agreementNumber: 1 });
agreementSchema.index({ bankGuaranteeExpiry: 1 });
```

---

#### 4.1.7 ContractorMaster

```javascript
// server/models/ContractorMaster.js
const contractorSchema = new mongoose.Schema({
  contractorCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  firmName: { type: String, required: true, trim: true },
  proprietorName: { type: String, default: '' },
  registrationNumber: { type: String, default: '' },
  gstNumber: { type: String, default: '' },
  panNumber: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String,
  },
  blacklistStatus: { type: Boolean, default: false },
  blacklistReason: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blacklisted'],
    default: 'active',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

contractorSchema.index({ contractorCode: 1 });
contractorSchema.index({ firmName: 1 });
contractorSchema.index({ status: 1 });
```

---

#### 4.1.8 WorkOrder

```javascript
// server/models/WorkOrder.js
const workOrderSchema = new mongoose.Schema({
  workOrderNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  agreementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agreement',
    required: true,
  },
  contractorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractorMaster',
    required: true,
  },
  estimatedAmount: { type: Number, required: true },
  contractValue: { type: Number, required: true },
  commencementDate: { type: Date, required: true },
  expectedCompletionDate: { type: Date, required: true },
  actualCompletionDate: { type: Date },
  status: {
    type: String,
    enum: ['issued', 'in_progress', 'completed', 'suspended', 'terminated'],
    default: 'issued',
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  digitalSignature: { type: String, default: '' },
  issuedAt: { type: Date, default: Date.now },
  remarks: { type: String, default: '' },
  documents: [{ type: String }],
}, { timestamps: true });

workOrderSchema.index({ workId: 1 });
workOrderSchema.index({ agreementId: 1 });
workOrderSchema.index({ status: 1 });
workOrderSchema.index({ expectedCompletionDate: 1 });
```

---

#### 4.1.9 MeasurementBook

```javascript
// server/models/MeasurementBook.js
const measurementBookSchema = new mongoose.Schema({
  mbNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder',
    required: true,
  },
  agreementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agreement',
    required: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  pageNumber: { type: Number, required: true },
  measurementDate: { type: Date, required: true },
  items: [{
    itemDescription: { type: String, required: true },
    soRRef: { type: String, default: '' },
    unit: { type: String, default: '' },
    // Dimension fields for calculation
    noOfItems: { type: Number, default: 0 },
    length: { type: Number, default: 0 },
    breadth: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    // Quantities
    measuredQuantity: { type: Number, required: true },
    previousQuantity: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
  }],
  totalMeasuredQuantity: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  recordedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    designation: String,
    recordedAt: { type: Date, default: Date.now },
  },
  contractorRepresentative: {
    name: String,
    designation: String,
    signedAt: Date,
  },
  testCheckedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    designation: String,
    checkedAt: Date,
    remarks: String,
  },
  isTestChecked: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },  // locked after test-check, non-editable
  supersededBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeasurementBook',
  },
  supersededReason: { type: String, default: '' },
  photographs: [{
    filename: String,
    path: String,
    caption: String,
    geoTag: {
      latitude: Number,
      longitude: Number,
    },
    uploadedAt: { type: Date, default: Date.now },
  }],
  status: {
    type: String,
    enum: ['draft', 'recorded', 'test_checked', 'locked', 'superseded'],
    default: 'draft',
  },
}, { timestamps: true });

measurementBookSchema.index({ workOrderId: 1 });
measurementBookSchema.index({ workId: 1 });
measurementBookSchema.index({ mbNumber: 1 });
measurementBookSchema.index({ isLocked: 1 });
measurementBookSchema.index({ status: 1 });
```

---

#### 4.1.10 Bill

```javascript
// server/models/Bill.js
const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  billType: {
    type: String,
    enum: ['RA', 'FINAL', 'ADVANCE', 'MOBILISATION'],
    required: true,
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder',
    required: true,
  },
  agreementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agreement',
    required: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  contractorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractorMaster',
    required: true,
  },
  // MB references for this bill
  measurementBookIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeasurementBook',
  }],
  // Cumulative calculation fields
  cumulativeMBValue: { type: Number, required: true },  // total MB-certified work done
  currentBillAmount: { type: Number, required: true },  // this bill's gross
  // Deductions (itemised)
  deductions: {
    retentionPercent: { type: Number, default: 5 },
    retentionAmount: { type: Number, default: 0 },
    gstTdsPercent: { type: Number, default: 2 },
    gstTdsAmount: { type: Number, default: 0 },
    itTdsPercent: { type: Number, default: 2 },
    itTdsAmount: { type: Number, default: 0 },
    labourCessPercent: { type: Number, default: 1 },
    labourCessAmount: { type: Number, default: 0 },
    otherDeductions: [{
      description: String,
      amount: Number,
    }],
    totalDeductions: { type: Number, default: 0 },
  },
  // Advance recovery
  advanceRecovery: { type: Number, default: 0 },
  mobilisationAdvanceRecovery: { type: Number, default: 0 },
  // Cumulative tracking (critical for preventing double payment)
  cumulativeRetention: { type: Number, default: 0 },
  cumulativeGstTds: { type: Number, default: 0 },
  cumulativeItTds: { type: Number, default: 0 },
  cumulativeLabourCess: { type: Number, default: 0 },
  cumulativeAdvanceRecovery: { type: Number, default: 0 },
  cumulativePaymentsMade: { type: Number, default: 0 },
  // Final payable
  netPayable: { type: Number, required: true },  // cumulativeMBValue - all cumulative deductions - cumulativePaymentsMade
  // Approval chain
  preparedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    preparedAt: { type: Date, default: Date.now },
  },
  certifiedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    certifiedAt: Date,
    remarks: String,
  },
  approvedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    approvedAt: Date,
  },
  financeConcurrence: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    concurredAt: Date,
    remarks: String,
    isConcurred: { type: Boolean, default: false },
  },
  digitalSignature: { type: String, default: '' },
  signedAt: { type: Date },
  status: {
    type: String,
    enum: [
      'draft',
      'prepared',
      'certified',
      'finance_pending',
      'finance_concurred',
      'approved',
      'signed',
      'payment_released',
      'rejected',
    ],
    default: 'draft',
  },
  remarks: { type: String, default: '', maxlength: 2000 },
  isFinalBill: { type: Boolean, default: false },
  jointMeasurementCertificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JointMeasurementCertificate',
  },
  paymentReference: { type: String, default: '' },
  paymentDate: { type: Date },
}, { timestamps: true });

billSchema.index({ workOrderId: 1 });
billSchema.index({ workId: 1 });
billSchema.index({ billType: 1 });
billSchema.index({ status: 1 });
billSchema.index({ billNumber: 1 });
billSchema.index({ contractorId: 1 });
billSchema.index({ createdAt: -1 });
```

---

#### 4.1.11 JointMeasurementCertificate

```javascript
// server/models/JointMeasurementCertificate.js
const jmcSchema = new mongoose.Schema({
  jmcNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder',
    required: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  completionDate: { type: Date, required: true },
  totalContractValue: { type: Number, required: true },
  totalExecutedValue: { type: Number, required: true },
  percentComplete: { type: Number, required: true },  // should be 100 for final
  items: [{
    itemDescription: String,
    contractedQuantity: Number,
    executedQuantity: Number,
    unit: String,
    remarks: String,
  }],
  signedBy: {
    ae: { userId: mongoose.Schema.Types.ObjectId, name: String, signedAt: Date },
    dgm: { userId: mongoose.Schema.Types.ObjectId, name: String, signedAt: Date },
    contractor: { name: String, signedAt: Date },
  },
  status: {
    type: String,
    enum: ['draft', 'signed', 'submitted'],
    default: 'draft',
  },
  remarks: { type: String, default: '' },
}, { timestamps: true });

jmcSchema.index({ workOrderId: 1 });
jmcSchema.index({ workId: 1 });
jmcSchema.index({ jmcNumber: 1 });
```

---

#### 4.1.12 CompletionCertificate

```javascript
// server/models/CompletionCertificate.js
const completionSchema = new mongoose.Schema({
  certificateNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder',
    required: true,
  },
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkMaster',
    required: true,
  },
  certificateType: {
    type: String,
    enum: ['completion_report', 'completion_certificate', 'final_completion_certificate'],
    required: true,
  },
  issuedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    designation: String,
    role: String,
  },
  physicalCompletionDate: { type: Date },
  qualityConfirmationDate: { type: Date },
  dlpStartDate: { type: Date },
  dlpEndDate: { type: Date },
  dlpMonths: { type: Number, default: 12 },
  retentionAmount: { type: Number, default: 0 },
  retentionReleased: { type: Boolean, default: false },
  retentionReleasedAt: { type: Date },
  retentionReleasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assetHandover: {
    handoverDate: Date,
    handoverTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: { type: String, default: 'O&M' },
    assetRegisterRef: { type: String, default: '' },
    condition: { type: String, default: '' },
  },
  defectsReported: [{
    description: String,
    reportedDate: Date,
    rectifiedDate: Date,
    status: { type: String, enum: ['open', 'rectified', 'closed'] },
  }],
  hasOpenDefects: { type: Boolean, default: false },
  digitalSignature: { type: String, default: '' },
  signedAt: { type: Date },
  status: {
    type: String,
    enum: ['draft', 'issued', 'dlp_active', 'dlp_completed', 'final_issued', 'closed'],
    default: 'draft',
  },
  remarks: { type: String, default: '' },
  documents: [{ type: String }],
}, { timestamps: true });

completionSchema.index({ workOrderId: 1 });
completionSchema.index({ workId: 1 });
completionSchema.index({ certificateType: 1 });
completionSchema.index({ status: 1 });
completionSchema.index({ dlpEndDate: 1 });
completionSchema.index({ retentionReleased: 1 });
```

---

#### 4.1.13 DeviationSanction

```javascript
// server/models/DeviationSanction.js
const deviationSchema = new mongoose.Schema({
  deviationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder',
    required: true,
  },
  measurementBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeasurementBook',
    required: true,
  },
  estimatedAmount: { type: Number, required: true },
  deviationPercent: { type: Number, required: true },
  deviationAmount: { type: Number, required: true },
  itemsAffected: [{
    itemDescription: String,
    originalQuantity: Number,
    deviatedQuantity: Number,
    deviationPercent: Number,
  }],
  reason: { type: String, required: true, maxlength: 2000 },
  approvingRole: {
    type: String,
    required: true,
    enum: ['dgm', 'gm', 'director_technical', 'md'],
  },
  approvingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  delegationVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DelegationOfPowers',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  remarks: { type: String, default: '' },
  digitalSignature: { type: String, default: '' },
  signedAt: { type: Date },
}, { timestamps: true });

deviationSchema.index({ workOrderId: 1 });
deviationSchema.index({ measurementBookId: 1 });
deviationSchema.index({ status: 1 });
```

---

#### 4.1.14 SLATracker

```javascript
// server/models/SLATracker.js
const slaSchema = new mongoose.Schema({
  entity: { type: String, required: true },  // 'estimate', 'admin_sanction', 'tech_sanction', etc.
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  stage: { type: String, required: true },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedRole: { type: String, default: '' },
  slaHours: { type: Number, required: true },  // configured SLA in working hours
  startedAt: { type: Date, required: true, default: Date.now },
  deadlineAt: { type: Date, required: true },
  completedAt: { type: Date },
  isBreached: { type: Boolean, default: false },
  breachAt: { type: Date },
  escalationLevel: { type: Number, default: 0 },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'breached', 'escalated'],
    default: 'active',
  },
  remindersSent: { type: Number, default: 0 },
  lastReminderAt: { type: Date },
}, { timestamps: true });

slaSchema.index({ entity: 1, entityId: 1 });
slaSchema.index({ assignedTo: 1, status: 1 });
slaSchema.index({ deadlineAt: 1, status: 1 });
slaSchema.index({ isBreached: 1 });
```

---

#### 4.1.15 Extended Estimate Model

The existing `Estimate` model requires new fields to support the full lifecycle:

```javascript
// ADD to existing estimateSchema
const estimateExtensions = {
  // Link to sanctions
  administrativeSanction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdministrativeSanction',
  },
  technicalSanction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TechnicalSanction',
  },
  // Extended status for full lifecycle
  // New enum values to add to existing status enum:
  // 'AS_Pending', 'AS_Approved', 'TS_Pending', 'TS_Approved',
  // 'Tender_Pending', 'Tender_Approved', 'Agreement_Pending',
  // 'Work_Ordered', 'In_Execution', 'MB_Recorded',
  // 'Billing', 'Final_Bill', 'Completed'
  // Extended estimate status for full lifecycle
  extendedStatus: {
    type: String,
    enum: [
      'draft',
      'abstract_generated',
      'submitted',
      'as_pending',
      'as_approved',
      'ts_pending',
      'ts_approved',
      'tender_pending',
      'tender_approved',
      'agreement_pending',
      'agreement_executed',
      'work_ordered',
      'in_execution',
      'mb_recorded',
      'billing_in_progress',
      'final_bill_pending',
      'completion_pending',
      'completed',
    ],
    default: 'draft',
  },
  lockedForEdit: { type: Boolean, default: false },  // locked after TS approval
  tenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tender',
  },
  agreementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agreement',
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder',
  },
};
```

---

### 4.2 Entity Relationship Diagram (Text)

```
WorkMaster ─────────────────────────────────────────────────┐
    │                                                       │
    ├── AdministrativeSanction (AS)                         │
    │       └── references: WorkMaster, Estimate            │
    │                                                       │
    ├── Estimate ───────────────────────────────────────────┤
    │       ├── EstimateItem (many)                         │
    │       ├── EstimateMovement (many)                     │
    │       └── EstimateVersion (many)                      │
    │                                                       │
    ├── TechnicalSanction (TS)                              │
    │       └── references: WorkMaster, Estimate            │
    │                                                       │
    ├── Tender / NIT                                        │
    │       ├── BidEvaluation (many)                        │
    │       └── references: WorkMaster, Estimate, AS, TS    │
    │                                                       │
    ├── Agreement                                           │
    │       └── references: WorkMaster, Tender, Contractor  │
    │                                                       │
    ├── ContractorMaster                                    │
    │                                                       │
    ├── WorkOrder                                           │
    │       └── references: WorkMaster, Agreement           │
    │                                                       │
    ├── MeasurementBook (many)                              │
    │       └── references: WorkOrder, Agreement            │
    │                                                       │
    ├── JointMeasurementCertificate                         │
    │       └── references: WorkOrder                       │
    │                                                       │
    ├── Bill (RA/Final - many)                              │
    │       └── references: WorkOrder, Agreement, MB, JMC   │
    │                                                       │
    ├── DeviationSanction (many)                            │
    │       └── references: WorkOrder, MB                   │
    │                                                       │
    └── CompletionCertificate (many)                        │
            └── references: WorkOrder                       │
                                                            │
DelegationOfPowers (Master Table) ── drives routing for ───┘
                                                            │
SLATracker ── tracks SLA for all entities ─────────────────┘
```

---

## 5. API Design

### 5.1 New Route Groups

```
/api/sanctions/administrative    — Administrative Sanction CRUD + workflow
/api/sanctions/technical         — Technical Sanction CRUD + workflow
/api/tenders                     — Tender/NIT management
/api/bids                        — Bid evaluation
/api/agreements                  — Agreement management
/api/contractors                 — Contractor master
/api/work-orders                 — Work order management
/api/measurements                — Measurement Book
/api/bills                       — RA/Final Bill management
/api/joint-measurement-certificates — JMC
/api/completion                  — Completion certificates
/api/deviations                  — Deviation sanction
/api/delegation-powers           — Delegation of Powers master table (admin)
/api/sla                         — SLA tracking & escalation
/api/workflow                    — Unified workflow status transitions
```

### 5.2 API Endpoint Specifications

#### 5.2.1 Administrative Sanction

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/sanctions/administrative` | ae, engineer | Create AS request |
| GET | `/api/sanctions/administrative` | dgm, gm, director_om, md | List pending AS |
| GET | `/api/sanctions/administrative/:id` | all | Get AS details |
| PATCH | `/api/sanctions/administrative/:id/approve` | dgm, gm, director_om, md | Approve AS (with OTP + DSC) |
| PATCH | `/api/sanctions/administrative/:id/reject` | dgm, gm, director_om, md | Reject with remarks |
| PATCH | `/api/sanctions/administrative/:id/revert` | dgm, gm, director_om, md | Revert to originator |
| GET | `/api/sanctions/administrative/work/:workId` | all | Get AS for a work |

#### 5.2.2 Technical Sanction

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/sanctions/technical` | ae, engineer | Create TS request |
| GET | `/api/sanctions/technical` | dgm, gm, director_technical | List pending TS |
| GET | `/api/sanctions/technical/:id` | all | Get TS details |
| PATCH | `/api/sanctions/technical/:id/approve` | dgm, gm, director_technical | Approve TS (locks estimate) |
| PATCH | `/api/sanctions/technical/:id/reject` | dgm, gm, director_technical | Reject with remarks |
| PATCH | `/api/sanctions/technical/:id/revert` | dgm, gm, director_technical | Revert to originator |

#### 5.2.3 Tender Management

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/tenders` | tender, dgm | Create NIT from TS estimate |
| GET | `/api/tenders` | dgm, gm, director_technical | List tenders |
| GET | `/api/tenders/:id` | all | Get tender details |
| PATCH | `/api/tenders/:id/publish` | dgm, gm | Publish to eProcurement |
| PATCH | `/api/tenders/:id/evaluate` | tender, committee | Record bid evaluation |
| PATCH | `/api/tenders/:id/approve` | dgm, gm, director_technical | Approve tender (award) |
| PATCH | `/api/tenders/:id/cancel` | gm, director_technical | Cancel tender |
| GET | `/api/tenders/:id/bids` | all | List bids for a tender |
| POST | `/api/tenders/:id/bids` | tender | Add bid evaluation |

#### 5.2.4 Agreement Management

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/agreements` | dgm, tender | Create agreement from tender |
| GET | `/api/agreements` | dgm, gm | List agreements |
| GET | `/api/agreements/:id` | all | Get agreement details |
| PATCH | `/api/agreements/:id/sign` | dgm, gm | Sign agreement |
| PATCH | `/api/agreements/:id/verify-deposit` | accounts | Verify security deposit |
| GET | `/api/agreements/work/:workId` | all | Get agreement for a work |

#### 5.2.5 Contractor Master

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/contractors` | admin | Create contractor |
| GET | `/api/contractors` | all | List contractors (searchable) |
| GET | `/api/contractors/:id` | all | Get contractor details |
| PATCH | `/api/contractors/:id` | admin | Update contractor |
| PATCH | `/api/contractors/:id/blacklist` | admin, gm | Blacklist contractor |
| GET | `/api/contractors/search` | all | Search by name/code/GST |

#### 5.2.6 Work Order

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/work-orders` | dgm | Generate from agreement |
| GET | `/api/work-orders` | dgm, gm, director | List work orders |
| GET | `/api/work-orders/:id` | all | Get work order details |
| PATCH | `/api/work-orders/:id/status` | dgm | Update execution status |
| GET | `/api/work-orders/work/:workId` | all | Get WO for a work |

#### 5.2.7 Measurement Book

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/measurements` | ae, engineer | Record MB entry |
| GET | `/api/measurements` | ae, dgm | List MB entries |
| GET | `/api/measurements/:id` | all | Get MB details |
| PATCH | `/api/measurements/:id/test-check` | dgm | Test-check and lock MB |
| PATCH | `/api/measurements/:id/supersede` | ae, dgm | Supersede with correction |
| POST | `/api/measurements/:id/photos` | ae | Upload site photos |
| GET | `/api/measurements/work-order/:workOrderId` | all | List MBs for a WO |

#### 5.2.8 Billing Management

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/bills` | ae, engineer | Prepare RA/Final Bill |
| GET | `/api/bills` | dgm, gm, accounts | List bills |
| GET | `/api/bills/:id` | all | Get bill with cumulative breakdown |
| PATCH | `/api/bills/:id/certify` | dgm | Certify bill |
| PATCH | `/api/bills/:id/finance-concurrence` | accounts | Finance wing concurrence |
| PATCH | `/api/bills/:id/approve` | gm, director | Approve payment |
| PATCH | `/api/bills/:id/sign` | director | Digital sign bill |
| GET | `/api/bills/calculate` | ae | Preview cumulative calculation |
| GET | `/api/bills/work/:workId` | all | Bills for a work |

#### 5.2.9 Joint Measurement Certificate

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/joint-measurement-certificates` | ae | Create JMC |
| PATCH | `/api/joint-measurement-certificates/:id/sign` | ae, dgm | Sign JMC |
| GET | `/api/joint-measurement-certificates/work/:workId` | all | Get JMC for work |

#### 5.2.10 Completion Management

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/completion` | dgm | Issue completion report |
| PATCH | `/api/completion/:id/issue-certificate` | gm | Issue completion certificate |
| PATCH | `/api/completion/:id/final-certificate` | director | Issue final completion cert |
| PATCH | `/api/completion/:id/release-retention` | director | Release retention after DLP |
| PATCH | `/api/completion/:id/handover-asset` | gm, director | Handover to O&M |
| POST | `/api/completion/:id/report-defect` | dgm | Report defect during DLP |
| GET | `/api/completion/work/:workId` | all | Completion status for work |
| GET | `/api/completion/dlp-expiry` | dgm, gm | List works with DLP nearing expiry |

#### 5.2.11 Deviation Sanction

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/deviations` | ae, dgm | Request deviation sanction |
| GET | `/api/deviations` | dgm, gm, director_technical | List pending deviations |
| PATCH | `/api/deviations/:id/approve` | dgm, gm, director_technical | Approve deviation |
| PATCH | `/api/deviations/:id/reject` | dgm, gm, director_technical | Reject deviation |

#### 5.2.12 Delegation of Powers (Admin)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/delegation-powers` | admin, md | Create new delegation |
| GET | `/api/delegation-powers` | admin | List all delegations |
| GET | `/api/delegation-powers/active` | all | Get currently active delegations |
| PATCH | `/api/delegation-powers/:id` | admin | Update delegation |
| GET | `/api/delegation-powers/resolve` | system | Resolve approver for stage + amount |

#### 5.2.13 SLA Tracking

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/sla/my-pending` | all | SLA items assigned to me |
| GET | `/api/sla/breached` | gm, director, md | List breached SLAs |
| GET | `/api/sla/dashboard` | all | SLA summary statistics |
| GET | `/api/sla/history/:entity/:entityId` | all | SLA history for an entity |

#### 5.2.14 Unified Workflow

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/workflow/work/:workId` | all | Full lifecycle status for a work |
| GET | `/api/workflow/work/:workId/timeline` | all | Timeline of all stages |
| GET | `/api/workflow/my-actions` | all | Actions I can take across all works |
| POST | `/api/workflow/work/:workId/advance` | various | Advance work to next stage |

---

## 6. Approval-Matrix Engine

### 6.1 Architecture

The approval-matrix engine is a middleware + service layer that resolves the correct approver for any stage based on the `DelegationOfPowers` master table.

```
Request → ApprovalMatrixMiddleware → Resolve Approver → Route to Correct User → Execute
```

### 6.2 Core Service

```javascript
// server/services/approvalMatrixService.js

/**
 * Resolves the approving authority for a given stage and amount.
 * Queries the DelegationOfPowers collection for the currently active record
 * matching the stage and amount range.
 */
export const resolveApprover = async (stage, amount) => {
  const delegation = await DelegationOfPowers.findOne({
    stage,
    isActive: true,
    minAmount: { $lte: amount },
    maxAmount: { $gte: amount },
    effectiveFrom: { $lte: new Date() },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: new Date() } },
    ],
  }).sort({ effectiveFrom: -1 });

  if (!delegation) {
    throw new AppError(
      `No delegation found for stage "${stage}" with amount ${amount}. ` +
      `Please configure DelegationOfPowers for this range.`,
      400,
      'DELEGATION_NOT_FOUND'
    );
  }

  return delegation;
};

/**
 * Checks if a user's role has authority for a given stage and amount.
 */
export const hasAuthority = async (userId, stage, amount) => {
  const user = await User.findById(userId);
  if (!user) return false;

  const delegation = await resolveApprover(stage, amount);
  return delegation.role === user.role;
};

/**
 * Middleware: attaches the resolved delegation to req for downstream use.
 */
export const approvalMatrixMiddleware = (stageExtractor) => {
  return async (req, res, next) => {
    try {
      const stage = stageExtractor(req);
      const amount = req.body.estimatedAmount || req.body.sanctionedAmount || req.body.contractValue || 0;

      const delegation = await resolveApprover(stage, amount);
      req.delegation = delegation;
      req.requiredRole = delegation.role;

      // Verify the current user has authority
      if (delegation.role !== req.user.role) {
        return next(new AppError(
          `Insufficient authority. This stage requires role "${delegation.role}" for the given amount.`,
          403,
          'INSUFFICIENT_AUTHORITY'
        ));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
```

### 6.3 SLA Configuration

SLA hours per stage (configurable via environment or admin panel):

| Stage | SLA (Working Days) | SLA (Working Hours) |
|-------|-------------------|---------------------|
| Estimate Preparation | 3 | 24 |
| Technical Review | 2 | 16 |
| Administrative Sanction | 5 | 40 |
| Technical Sanction | 5 | 40 |
| Tender Publication | 21-30 | As per tender type |
| Bid Evaluation | 7 | 56 |
| Agreement Execution | 10 | 80 |
| Work Order Issue | 3 | 24 |
| MB Test-Check | 3 | 24 |
| RA Bill Approval | 7 | 56 |
| Final Bill Approval | 15 | 120 |
| Completion Certificate | 10 | 80 |

### 6.4 Escalation Logic

```
1. When SLA timer starts → Create SLATracker record with deadlineAt
2. Daily cron job checks for breached SLAs
3. On breach:
   a. Mark isBreached = true, breachAt = now
   b. Escalate one level up in the role hierarchy
   c. Send notification to escalated user
   d. Log escalation in AuditLog
4. If escalated user also breaches → escalate one more level
5. Maximum escalation: up to MD/Board level
```

---

## 7. Module Specifications

### 7.1 Administrative Sanction Module

**Purpose:** Client-side approval that the work is needed and budget exists.

**Workflow:**
```
AE/Section Engineer proposes → AS record created (pending)
  → Route to approver per DelegationOfPowers slab
  → Approver reviews (can revert with mandatory remarks)
  → Approver approves (OTP + Digital Signature)
  → AS recorded (approved) → Estimate linked to AS
  → Work proceeds to Technical Sanction
```

**Business Rules:**
- AS is always a distinct approval from TS, even if the same officer handles both below a slab
- AS references the budget head, source of funds, and budget year
- AS amount must cover or exceed the estimate amount
- Every AS record gets a unique AS number: `AS/{YYYY}/{sequential}`
- Digital signature with OTP verification on approval
- Reversion requires mandatory remarks

**Document Format (PDF):**
```
HMWSSB — ADMINISTRATIVE SANCTION
AS Number: AS/2026/0187
Name of Work: [work name]
Estimate Amount: Rs. [amount]
Sanctioned Amount: Rs. [amount]
Budget Head: [head]
Source of Funds: [source]
Approving Authority: [name, designation]
Remarks: [remarks]
Digitally Signed: [date/time]
```

---

### 7.2 Technical Sanction Module

**Purpose:** Engineering certification that the estimate is structurally sound, follows SoR, and is economical.

**Workflow:**
```
AE prepares detailed estimate → Estimate saved as Draft
  → DGM reviews (can revert with remarks, creating version diff)
  → Estimate forwarded for TS
  → TS record created (pending)
  → Route to approver per DelegationOfPowers slab
  → Approver reviews estimate + DGM vetting
  → Approves (OTP + Digital Signature) → TS recorded
  → Estimate locked (read-only, version-locked)
  → TS number generated
  → Work proceeds to Tender
```

**Business Rules:**
- Estimate must be in "Submitted" status before TS can be requested
- TS approval locks the estimate — no further edits allowed
- Estimate version is frozen at the version present at TS approval
- TS number format: `TS/{YYYY}/{sequential}`
- If estimate is reverted after DGM review, a new version is created with diff summary
- Both AS and TS must be recorded before Tender can be initiated

---

### 7.3 Tender Management Module

**Purpose:** NIT auto-generation, eProcurement integration, bid evaluation.

**Workflow:**
```
TS approved → Tender Cell creates NIT
  → NIT auto-drafted from TS estimate (quantities, SoR, value flow through)
  → NIT published on Telangana eProcurement portal
  → Bid period (21-30 days)
  → Bids received → Technical evaluation → Financial evaluation
  → Bid Evaluation Committee recommends L1
  → Tender approval per DelegationOfPowers slab
  → Tender approved → proceeds to Agreement
```

**Auto-Draft Logic:**
```javascript
const generateNIT = async (technicalSanctionId) => {
  const ts = await TechnicalSanction.findById(technicalSanctionId)
    .populate('estimateId');
  const estimate = ts.estimateId;

  const nit = new Tender({
    nitNumber: await generateNITNumber(),
    workId: estimate.workId,
    estimateId: estimate._id,
    technicalSanctionId: ts._id,
    estimatedValue: ts.sanctionedAmount,
    emdAmount: ts.sanctionedAmount * 0.02,  // 2% of estimate
    emdBidPeriod: 21,
    bidValidityDays: 120,
    workCompletionDays: estimate.workCompletionDays || 270,
    status: 'draft',
    // Items and quantities flow from estimate
  });

  await nit.save();
  return nit;
};
```

**Bid Evaluation Calculation:**
```javascript
const evaluateBids = async (tenderId) => {
  const bids = await BidEvaluation.find({ tenderId });
  const estimateAmount = (await Tender.findById(tenderId)).estimatedValue;

  // Financial evaluation: L1 = lowest evaluated bid
  const financialBids = bids
    .filter(b => b.technicalBidPassed)
    .sort((a, b) => a.calculatedAmount - b.calculatedAmount);

  financialBids.forEach((bid, index) => {
    bid.isL1 = index === 0;
    bid.deviationPercent = ((bid.calculatedAmount - estimateAmount) / estimateAmount) * 100;
    bid.isL1Evaluated = index === 0;
  });

  return financialBids;
};
```

---

### 7.4 Agreement Management Module

**Purpose:** Contract execution with security deposit and performance guarantee tracking.

**Workflow:**
```
Tender approved → DGM (Contracts) creates Agreement
  → Agreement auto-drafted from tender (contractor, rate, SD%, DLP)
  → EMD converted to Security Deposit (adjustment computed)
  → Additional Security Deposit collected
  → Bank Guarantee tracked with expiry alerts
  → Agreement signed by HMWSSB signatory (digital)
  → Agreement signed by contractor (upload physical scan / e-sign)
  → Agreement executed → Work Order auto-generated
```

**EMD-to-SD Conversion:**
```javascript
const calculateSecurityDeposit = (tender, agreement) => {
  const contractValue = tender.financialBidAmount || tender.estimatedValue;
  const sdPercent = agreement.securityDepositPercent || 5;
  const totalSD = contractValue * (sdPercent / 100);
  const emdAdjusted = tender.emdAmount || 0;
  const additionalSD = Math.max(0, totalSD - emdAdjusted);

  return {
    totalSD,
    emdAdjusted,
    additionalSD,
    contractValue,
  };
};
```

---

### 7.5 Work Execution & Measurement Book Module

**Purpose:** Work order issue, site execution, digital MB with joint measurement.

**Workflow:**
```
Agreement executed → Work Order auto-generated
  → AE supervises site execution
  → AE records measurements in MB (item-wise, page-numbered)
  → Contractor's representative co-signs
  → DGM test-checks (percentage as per manual)
  → MB locked (non-editable once test-checked)
  → If deviation > ±10% → Deviation Sanction triggered
  → MB entries form basis for RA Bill
```

**MB Entry Locking:**
```javascript
const testCheckMB = async (mbId, dgmUserId) => {
  const mb = await MeasurementBook.findById(mbId);

  if (mb.isLocked) {
    throw new AppError('Measurement Book is already locked', 400, 'MB_LOCKED');
  }

  mb.testCheckedBy = {
    userId: dgmUserId,
    name: user.name,
    designation: user.designation,
    checkedAt: new Date(),
    remarks: req.body.remarks,
  };
  mb.isTestChecked = true;
  mb.isLocked = true;  // Non-editable after this point
  mb.status = 'locked';

  await mb.save();
  return mb;
};
```

**Deviation Detection:**
```javascript
const checkDeviation = async (workOrderId, measurementBookId) => {
  const wo = await WorkOrder.findById(workOrderId);
  const mb = await MeasurementBook.findById(measurementBookId);
  const DEVIATION_THRESHOLD = 10; // ±10%

  for (const item of mb.items) {
    const originalItem = wo.estimateItems.find(
      i => i.description === item.itemDescription
    );
    if (!originalItem) continue;

    const deviationPercent = Math.abs(
      ((item.measuredQuantity - originalItem.quantity) / originalItem.quantity) * 100
    );

    if (deviationPercent > DEVIATION_THRESHOLD) {
      // Trigger Deviation Sanction workflow
      await DeviationSanction.create({
        deviationNumber: await generateDeviationNumber(),
        workOrderId,
        measurementBookId,
        estimatedAmount: wo.estimatedAmount,
        deviationPercent,
        deviationAmount: item.amount * (deviationPercent / 100),
        itemsAffected: [{
          itemDescription: item.itemDescription,
          originalQuantity: originalItem.quantity,
          deviatedQuantity: item.measuredQuantity,
          deviationPercent,
        }],
        reason: 'Auto-detected: exceeds ±10% threshold',
        status: 'pending',
      });
      return true;
    }
  }
  return false;
};
```

---

### 7.6 Billing Management Module

**Purpose:** Cumulative RA Bill engine, Final Bill, finance concurrence.

**Core Formula (CRITICAL — prevents double payment):**
```javascript
const calculateBill = async (workOrderId, newMBIds) => {
  const agreement = await Agreement.findOne({ workId: workOrderId.workId });
  const contractValue = agreement.contractValue;

  // 1. Cumulative MB value (ALL locked MBs for this work order, not just new ones)
  const allMBs = await MeasurementBook.find({
    workOrderId,
    isLocked: true,
  });
  const cumulativeMBValue = allMBs.reduce((sum, mb) => sum + mb.totalAmount, 0);

  // 2. Current bill gross = cumulative MB value - previously billed MB values
  const previousMBValues = await getPreviouslyBilledMBValues(workOrderId, newMBIds);
  const currentBillGross = cumulativeMBValue - previousMBValues;

  // 3. Cumulative deductions
  const previousBills = await Bill.find({
    workOrderId,
    status: { $in: ['approved', 'signed', 'payment_released'] },
  }).sort({ createdAt: 1 });

  const cumulativeRetention = previousBills.reduce((sum, b) => sum + b.deductions.retentionAmount, 0);
  const cumulativeGstTds = previousBills.reduce((sum, b) => sum + b.deductions.gstTdsAmount, 0);
  const cumulativeItTds = previousBills.reduce((sum, b) => sum + b.deductions.itTdsAmount, 0);
  const cumulativeLabourCess = previousBills.reduce((sum, b) => sum + b.deductions.labourCessAmount, 0);
  const cumulativeAdvanceRecovery = previousBills.reduce((sum, b) => sum + b.advanceRecovery + b.mobilisationAdvanceRecovery, 0);
  const cumulativePaymentsMade = previousBills.reduce((sum, b) => sum + b.netPayable, 0);

  // 4. Current bill deductions
  const currentRetention = currentBillGross * (agreement.securityDepositPercent / 100);
  const currentGstTds = currentBillGross * 0.02;
  const currentItTds = currentBillGross * 0.02;
  const currentLabourCess = currentBillGross * 0.01;

  // 5. Net payable = cumulativeMBValue - all cumulative deductions - cumulativePaymentsMade
  const totalCumulativeDeductions = cumulativeRetention + currentRetention
    + cumulativeGstTds + currentGstTds
    + cumulativeItTds + currentItTds
    + cumulativeLabourCess + currentLabourCess
    + cumulativeAdvanceRecovery;

  const netPayable = cumulativeMBValue - totalCumulativeDeductions - cumulativePaymentsMade;

  return {
    cumulativeMBValue,
    currentBillGross,
    cumulativeRetention: cumulativeRetention + currentRetention,
    cumulativeGstTds: cumulativeGstTds + currentGstTds,
    cumulativeItTds: cumulativeItTds + currentItTds,
    cumulativeLabourCess: cumulativeLabourCess + currentLabourCess,
    cumulativeAdvanceRecovery,
    cumulativePaymentsMade,
    netPayable: Math.max(0, netPayable),  // Never negative
    currentRetention,
    currentGstTds,
    currentItTds,
    currentLabourCess,
  };
};
```

**Final Bill Rules:**
- Cannot be raised without a JointMeasurementCertificate confirming 100% completion
- Retention amount stays withheld (released only after DLP + Final Completion Certificate)
- Net payable = cumulative MB value - all deductions - all RA payments - full retention

---

### 7.7 Completion & Retention Management Module

**Purpose:** 3-stage completion, DLP tracking, retention release, asset handover.

**3-Stage Completion Pattern:**
```
Stage 1: Completion Report (Physical Completion)
  - Issued by DGM immediately on JMC sign-off
  - Records physical completion date
  - Status: completion_report issued

Stage 2: Completion Certificate (Quality/Spec Confirmation)
  - Issued by GM after inspecting work quality
  - Confirms work meets specifications
  - Status: completion_certificate issued, DLP starts

Stage 3: Final Completion Certificate (After DLP)
  - Issued by Director only after DLP period lapses with no unresolved defects
  - Releases retention money
  - Asset formally handed over to O&M wing
  - Work closed in system (read-only, retained for audit)
```

**DLP Countdown:**
```javascript
const scheduleDLPReminders = async () => {
  // Find all works in DLP phase
  const dlpWorks = await CompletionCertificate.find({
    status: 'dlp_active',
    dlpEndDate: { $gte: new Date() },
  });

  for (const cert of dlpWorks) {
    const daysUntilExpiry = Math.ceil(
      (cert.dlpEndDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    // 30-day reminder
    if (daysUntilExpiry <= 30 && daysUntilExpiry > 7 && cert.remindersSent < 1) {
      await sendReminder(cert, 'DLP expiring in 30 days');
      cert.remindersSent += 1;
    }

    // 7-day reminder
    if (daysUntilExpiry <= 7 && daysUntilExpiry > 0 && cert.remindersSent < 2) {
      await sendReminder(cert, 'DLP expiring in 7 days');
      cert.remindersSent += 1;
    }

    // DLP expired
    if (daysUntilExpiry <= 0 && !cert.hasOpenDefects) {
      cert.status = 'dlp_completed';
      // Trigger Final Completion Certificate workflow
    }

    await cert.save();
  }
};
```

---

## 8. Notification & SLA Engine

### 8.1 Notification Events

| Event | Recipients | Channel | Template |
|-------|-----------|---------|----------|
| Estimate submitted | DGM | In-App + Email | `estimate_submitted` |
| AS pending approval | Approving authority | In-App + Email + SMS | `as_pending` |
| AS approved | Originator, GM | In-App + Email | `as_approved` |
| TS pending approval | Approving authority | In-App + Email + SMS | `ts_pending` |
| TS approved | Originator, all linked | In-App + Email | `ts_approved` |
| NIT published | Tender Cell, DGM | In-App + Email | `nit_published` |
| Bid closing reminder (3 days) | Tender Cell | In-App + Email | `bid_closing_3days` |
| Bid closing reminder (1 day) | Tender Cell | In-App + Email | `bid_closing_1day` |
| Bid evaluation pending | BEC members | In-App + Email | `bid_eval_pending` |
| Agreement pending signature | DGM, Contractor | In-App + Email + SMS | `agreement_pending` |
| MB test-check pending | DGM | In-App | `mb_testcheck_pending` |
| RA Bill pending approval | Approving authority | In-App + Email | `ra_bill_pending` |
| Final Bill pending | Director | In-App + Email | `final_bill_pending` |
| DLP nearing expiry (30 days) | DGM, GM | In-App + Email | `dlp_30days` |
| DLP nearing expiry (7 days) | DGM, GM, Director | In-App + Email + SMS | `dlp_7days` |
| SLA breached | Escalated user | In-App + Email + SMS | `sla_breached` |
| Any rejection/reversion | Originator | In-App + Email | `work_reverted` |

### 8.2 SLA Cron Job

```javascript
// server/jobs/slaEscalationJob.js

import cron from 'node-cron';
import SLATracker from '../models/SLATracker.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

// Run every hour
const slaEscalationJob = cron.schedule('0 * * * *', async () => {
  const now = new Date();

  // Find breached SLAs
  const breached = await SLATracker.find({
    status: 'active',
    deadlineAt: { $lt: now },
    isBreached: false,
  });

  for (const sla of breached) {
    // Mark as breached
    sla.isBreached = true;
    sla.breachAt = now;
    sla.status = 'breached';

    // Escalate one level up
    const escalatedUser = await getEscalatedUser(sla.assignedTo, sla.assignedRole);
    if (escalatedUser) {
      sla.escalationLevel += 1;
      sla.escalatedTo = escalatedUser._id;
      sla.status = 'escalated';

      // Notify escalated user
      await Notification.create({
        userId: escalatedUser._id,
        title: `SLA Breached: ${sla.entity}`,
        message: `SLA for ${sla.entity} #${sla.entityId} has been breached. Escalated to you.`,
        type: 'error',
      });

      // Audit log
      await AuditLog.create({
        userId: escalatedUser._id,
        action: 'SLA_ESCALATED',
        entity: sla.entity,
        entityId: sla.entityId.toString(),
        module: 'SLA',
        description: `SLA breached. Escalated from ${sla.assignedRole} to ${escalatedUser.role}`,
      });
    }

    await sla.save();
  }

  // Send reminders for SLAs approaching deadline (within 25% of SLA time remaining)
  const upcomingDeadlines = await SLATracker.find({
    status: 'active',
    deadlineAt: {
      $gte: now,
      $lte: new Date(now.getTime() + 4 * 60 * 60 * 1000), // next 4 hours
    },
    lastReminderAt: {
      $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // no reminder in last 24h
    },
  });

  for (const sla of upcomingDeadlines) {
    await Notification.create({
      userId: sla.assignedTo,
      title: `SLA Reminder: ${sla.entity}`,
      message: `SLA for ${sla.entity} #${sla.entityId} is due soon.`,
      type: 'warning',
    });
    sla.remindersSent += 1;
    sla.lastReminderAt = now;
    await sla.save();
  }
});
```

### 8.3 Role Hierarchy for Escalation

```javascript
const ESCALATION_HIERARCHY = {
  ae: 'dgm',
  engineer: 'dgm',
  dgm: 'gm',
  gm: 'director_technical',
  director_technical: 'md',
  director_om: 'md',
  director_finance: 'md',
  md: 'board',
  tender: 'gm',
  accounts: 'director_finance',
};
```

---

## 9. Frontend Design

### 9.1 New Pages

| Page | Route | Description |
|------|-------|-------------|
| Administrative Sanction | `/sanctions/administrative` | List + create AS |
| AS Detail | `/sanctions/administrative/:id` | AS detail + approval actions |
| Technical Sanction | `/sanctions/technical` | List + create TS |
| TS Detail | `/sanctions/technical/:id` | TS detail + approval actions |
| Tender List | `/tenders` | List all tenders |
| Tender Detail | `/tenders/:id` | NIT detail + bid evaluation |
| Create Tender | `/tenders/create` | NIT creation form |
| Agreement List | `/agreements` | List all agreements |
| Agreement Detail | `/agreements/:id` | Agreement detail + signing |
| Contractor Master | `/contractors` | Contractor CRUD |
| Work Orders | `/work-orders` | List all WOs |
| Work Order Detail | `/work-orders/:id` | WO detail + execution tracking |
| Measurement Book | `/measurements` | List MB entries |
| MB Entry Form | `/measurements/create` | Record measurements |
| MB Detail | `/measurements/:id` | MB detail + test-check |
| Bill List | `/bills` | List all bills |
| Bill Detail | `/bills/:id` | Bill detail + cumulative breakdown |
| Prepare Bill | `/bills/prepare` | Bill preparation form |
| Completion Dashboard | `/completion` | Works in completion pipeline |
| Completion Detail | `/completion/:id` | Completion + DLP + retention |
| Delegation Admin | `/admin/delegation` | Delegation of Powers master table |
| SLA Dashboard | `/sla` | SLA monitoring dashboard |
| Enhanced Dashboard | `/dashboard` | Role-specific dashboard (replaces existing) |
| Work Lifecycle | `/work/:workId/lifecycle` | Full timeline view |

### 9.2 Enhanced Dashboard by Role

**AE / Site Engineer:**
- Draft estimates pending submission
- MB entries pending test-check
- Site inspections due
- My pending actions count

**DGM:**
- Pending Technical Sanctions
- Pending MB test-checks
- RA Bills pending certification
- Delayed works in division
- SLA breach alerts

**GM:**
- Pending Final Approvals
- Tender evaluations pending
- High-value estimates
- Divisional performance comparison
- SLA compliance rate

**Director / MD:**
- Portfolio-wide budget utilisation
- Above-threshold sanctions pending
- DLP-expiry pipeline
- Region/Zone-wise delay analysis
- SLA breach trends

**Finance Wing:**
- Bills pending concurrence
- Retention ledger by work
- Statutory deduction summary (GST TDS, IT TDS, labour cess)
- Payment release queue

### 9.3 Reusable Components

| Component | Purpose |
|-----------|---------|
| `ApprovalWorkflow` | Generic approval chain display with status indicators |
| `SLATimer` | Countdown timer showing time remaining / breach |
| `DeviationBadge` | Visual indicator for quantity deviations |
| `CumulativeBillTable` | Bill breakdown showing cumulative vs current |
| `WorkLifecycleTimeline` | Visual timeline of all stages for a work |
| `DocumentPreview` | PDF viewer for sanctions, agreements, bills |
| `HierarchySelector` | Region > Zone > Circle > Ward cascading selector |
| `AmountSlabBadge` | Shows which slab a work falls in |
| `DLPCountdown` | Days remaining in Defect Liability Period |
| `SignatureBlock` | Digital signature display with verification badge |

---

## 10. Business Rules Implementation

### 10.1 Core Rules (Enforced in Code)

| # | Rule | Enforcement Point |
|---|------|-------------------|
| BR-01 | AS and TS are always two distinct approvals with separate reference numbers | Separate models, separate API endpoints, separate status fields |
| BR-02 | Estimate cannot proceed to Tender until both AS and TS are recorded and digitally signed | Pre-condition check in Tender creation controller |
| BR-03 | MB entries are non-editable once test-checked; corrections require superseding entry | `isLocked` flag in MeasurementBook model; update middleware blocks edits |
| BR-04 | No RA Bill computed except as cumulative MB value - cumulative deductions - cumulative prior payments | `calculateBill()` service function; tested with unit tests |
| BR-05 | Quantity deviation beyond ±10% triggers mandatory Deviation Sanction | Auto-detection in `checkDeviation()` on MB test-check |
| BR-06 | Final Bill cannot be raised without JMC confirming 100% completion | Pre-condition check in Final Bill creation |
| BR-07 | Retention is held as separate locked ledger entry; released only after Final Completion Certificate | Separate `retentionReleased` flag in CompletionCertificate |
| BR-08 | Every rejection/reversion requires mandatory remarks | Joi validation: `remarks` required on reject/revert endpoints |
| BR-09 | Every approval, sanction, and digital signature requires OTP verification | OTP verification middleware on all approve/sign endpoints |
| BR-10 | Every workflow movement, MB entry, and bill computation is audit-logged with delegation version | AuditLog creation in all controllers; delegationVersion stored on each record |
| BR-11 | Notifications auto-generated for every event in notification matrix | Notification service called at each workflow transition |
| BR-12 | SLA breach triggers automatic one-level escalation | Cron job + SLA service |
| BR-13 | Amount routing resolved from DelegationOfPowers master table, never hard-coded | `resolveApprover()` called in every approval middleware |
| BR-14 | Past approvals remain valid under the slab in force at that time | Each approval stores `delegationVersion` reference |

### 10.2 Validation Schema Extensions

```javascript
// Add to server/validations/schemas.js

export const createAdminSanctionSchema = Joi.object({
  workId: Joi.string().required(),
  estimateId: Joi.string().required(),
  estimatedAmount: Joi.number().min(0).required(),
  sanctionedAmount: Joi.number().min(0).required(),
  budgetHead: Joi.string().trim().allow('').optional(),
  budgetYear: Joi.string().trim().allow('').optional(),
  sourceOfFunds: Joi.string().trim().allow('').optional(),
  remarks: Joi.string().trim().allow('').max(2000).optional(),
});

export const approveSanctionSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'revert').required(),
  remarks: Joi.string().trim().min(1).max(2000).required()
    .messages({ 'string.min': 'Remarks are mandatory for this action' }),
  sanctionedAmount: Joi.number().min(0).when('action', {
    is: 'approve',
    then: Joi.required(),
  }),
});

export const createTenderSchema = Joi.object({
  workId: Joi.string().required(),
  estimateId: Joi.string().required(),
  technicalSanctionId: Joi.string().required(),
  administrativeSanctionId: Joi.string().required(),
  tenderType: Joi.string().valid('open', 'limited', 'single', 'nomination').default('open'),
  emdBidPeriod: Joi.number().min(7).max(90).default(21),
  bidValidityDays: Joi.number().min(30).max(365).default(120),
  workCompletionDays: Joi.number().min(30).max(730).required(),
  eligibilityCriteria: Joi.array().items(Joi.string()).optional(),
  specialConditions: Joi.array().items(Joi.string()).optional(),
});

export const createAgreementSchema = Joi.object({
  tenderId: Joi.string().required(),
  workId: Joi.string().required(),
  contractorId: Joi.string().required(),
  contractValue: Joi.number().min(0).required(),
  securityDepositPercent: Joi.number().min(0).max(10).default(5),
  defectLiabilityMonths: Joi.number().min(6).max(24).default(12),
  workCompletionMonths: Joi.number().min(1).max(36).required(),
  commencementDate: Joi.date().iso().required(),
  milestoneSchedule: Joi.array().items(Joi.object({
    milestoneName: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    targetDate: Joi.date().iso().required(),
    percentage: Joi.number().min(0).max(100).required(),
  })).optional(),
});

export const createMBEntrySchema = Joi.object({
  workOrderId: Joi.string().required(),
  measurementDate: Joi.date().iso().required(),
  items: Joi.array().items(Joi.object({
    itemDescription: Joi.string().required(),
    soRRef: Joi.string().allow('').optional(),
    unit: Joi.string().allow('').optional(),
    noOfItems: Joi.number().min(0).default(0),
    length: Joi.number().min(0).default(0),
    breadth: Joi.number().min(0).default(0),
    depth: Joi.number().min(0).default(0),
    height: Joi.number().min(0).default(0),
    measuredQuantity: Joi.number().min(0).required(),
    rate: Joi.number().min(0).default(0),
    remarks: Joi.string().allow('').optional(),
  })).min(1).required(),
});

export const prepareBillSchema = Joi.object({
  workOrderId: Joi.string().required(),
  billType: Joi.string().valid('RA', 'FINAL', 'ADVANCE', 'MOBILISATION').required(),
  measurementBookIds: Joi.array().items(Joi.string()).min(1).required(),
  remarks: Joi.string().trim().allow('').max(2000).optional(),
});

export const deviationSanctionSchema = Joi.object({
  workOrderId: Joi.string().required(),
  measurementBookId: Joi.string().required(),
  reason: Joi.string().trim().min(10).max(2000).required(),
});

export const delegationPowersSchema = Joi.object({
  stage: Joi.string().valid(
    'administrative_sanction', 'technical_sanction', 'tender_approval',
    'agreement', 'work_order', 'measurement_book',
    'running_bill', 'final_bill', 'completion_certificate'
  ).required(),
  role: Joi.string().valid(
    'ae', 'dgm', 'gm', 'director_technical', 'director_om',
    'director_finance', 'md', 'board'
  ).required(),
  minAmount: Joi.number().min(0).required(),
  maxAmount: Joi.number().min(Joi.ref('minAmount')).required(),
  effectiveFrom: Joi.date().iso().required(),
  boardResolutionRef: Joi.string().allow('').optional(),
});
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

| Task | Files | Effort |
|------|-------|--------|
| Create DelegationOfPowers model + seed data | `models/DelegationOfPowers.js`, `seeders/delegationData.js` | 2 days |
| Create ApprovalMatrixService | `services/approvalMatrixService.js` | 2 days |
| Extend User model with new roles | `models/User.js` | 1 day |
| Extend Estimate model with lifecycle fields | `models/Estimate.js` | 2 days |
| Create ContractorMaster model | `models/ContractorMaster.js` | 1 day |
| Create SLATracker model | `models/SLATracker.js` | 1 day |
| Create SLA cron job | `jobs/slaEscalationJob.js` | 2 days |
| Create Delegation Powers admin API | `controllers/delegationController.js`, `routes/delegationRoutes.js` | 2 days |
| Extend validation schemas | `validations/schemas.js` | 2 days |
| Extend app.js with new routes | `app.js` | 1 day |

### Phase 2: Sanctions (Weeks 4-6)

| Task | Files | Effort |
|------|-------|--------|
| AdministrativeSanction model | `models/AdministrativeSanction.js` | 1 day |
| TechnicalSanction model | `models/TechnicalSanction.js` | 1 day |
| Admin Sanction controller + routes | `controllers/adminSanctionController.js`, `routes/adminSanctionRoutes.js` | 3 days |
| Tech Sanction controller + routes | `controllers/techSanctionController.js`, `routes/techSanctionRoutes.js` | 3 days |
| AS PDF generation | `utils/sanctionPdfTemplate.js` | 2 days |
| TS PDF generation | `utils/sanctionPdfTemplate.js` | 1 day |
| Frontend: AS list + detail pages | `pages/AdministrativeSanction/` | 3 days |
| Frontend: TS list + detail pages | `pages/TechnicalSanction/` | 3 days |
| Unit tests for sanctions | `tests/` | 2 days |

### Phase 3: Tender & Agreement (Weeks 7-10)

| Task | Files | Effort |
|------|-------|--------|
| Tender model | `models/Tender.js` | 1 day |
| BidEvaluation model | `models/BidEvaluation.js` | 1 day |
| Agreement model | `models/Agreement.js` | 1 day |
| Tender controller + routes | `controllers/tenderController.js`, `routes/tenderRoutes.js` | 4 days |
| Bid evaluation controller | `controllers/bidController.js`, `routes/bidRoutes.js` | 3 days |
| Agreement controller + routes | `controllers/agreementController.js`, `routes/agreementRoutes.js` | 3 days |
| Contractor master controller | `controllers/contractorController.js`, `routes/contractorRoutes.js` | 2 days |
| NIT auto-generation from TS | `services/nitAutoDraftService.js` | 2 days |
| Frontend: Tender pages | `pages/TenderManagement/` | 4 days |
| Frontend: Agreement pages | `pages/AgreementManagement/` | 3 days |
| Frontend: Contractor master | `pages/ContractorMaster/` | 2 days |
| Unit tests | `tests/` | 3 days |

### Phase 4: Execution & Measurement (Weeks 11-14)

| Task | Files | Effort |
|------|-------|--------|
| WorkOrder model | `models/WorkOrder.js` | 1 day |
| MeasurementBook model | `models/MeasurementBook.js` | 1 day |
| Work Order controller + routes | `controllers/workOrderController.js`, `routes/workOrderRoutes.js` | 3 days |
| MB controller + routes | `controllers/measurementController.js`, `routes/measurementRoutes.js` | 4 days |
| MB locking/test-check logic | `services/mbService.js` | 2 days |
| Deviation detection service | `services/deviationService.js` | 2 days |
| DeviationSanction model + API | `models/DeviationSanction.js`, controller, routes | 2 days |
| Photo upload for MB | `routes/measurementRoutes.js` (photo endpoint) | 1 day |
| Frontend: Work Order pages | `pages/WorkExecution/` | 3 days |
| Frontend: MB entry form + detail | `pages/MeasurementBook/` | 4 days |
| Unit tests | `tests/` | 3 days |

### Phase 5: Billing (Weeks 15-18)

| Task | Files | Effort |
|------|-------|--------|
| Bill model | `models/Bill.js` | 1 day |
| JointMeasurementCertificate model | `models/JointMeasurementCertificate.js` | 1 day |
| Bill calculation service | `services/billCalculationService.js` | 4 days |
| Bill controller + routes | `controllers/billController.js`, `routes/billRoutes.js` | 4 days |
| JMC controller + routes | `controllers/jmcController.js`, `routes/jmcRoutes.js` | 2 days |
| Finance concurrence workflow | Embedded in bill controller | 2 days |
| Bill PDF generation | `utils/billPdfTemplate.js` | 2 days |
| Frontend: Bill preparation form | `pages/BillingManagement/` | 4 days |
| Frontend: Bill detail + cumulative table | `pages/BillingManagement/` | 3 days |
| Unit tests (critical: cumulative formula) | `tests/billCalculation.test.js` | 3 days |

### Phase 6: Completion (Weeks 19-21)

| Task | Files | Effort |
|------|-------|--------|
| CompletionCertificate model | `models/CompletionCertificate.js` | 1 day |
| Completion controller + routes | `controllers/completionController.js`, `routes/completionRoutes.js` | 3 days |
| DLP countdown + reminders | `services/dlpService.js` | 2 days |
| Retention release workflow | Embedded in completion controller | 2 days |
| Asset handover logic | Embedded in completion controller | 1 day |
| Frontend: Completion dashboard | `pages/CompletionManagement/` | 3 days |
| Frontend: DLP countdown component | `components/DLPCountdown/` | 1 day |
| Unit tests | `tests/` | 2 days |

### Phase 7: Dashboards & SLA (Weeks 22-24)

| Task | Files | Effort |
|------|-------|--------|
| Enhanced dashboard API | `controllers/dashboardController.js` | 3 days |
| SLA dashboard API | `controllers/slaController.js` | 2 days |
| SLA frontend dashboard | `pages/SLADashboard/` | 3 days |
| Enhanced role-specific dashboards | `pages/EnhancedDashboard/` | 4 days |
| Work lifecycle timeline component | `components/WorkLifecycleTimeline/` | 2 days |
| Notification integration (frontend) | `pages/Notifications/` | 2 days |
| Notification templates | `utils/notificationTemplates.js` | 2 days |

### Phase 8: UAT & Rollout (Weeks 25-28)

| Task | Effort |
|------|--------|
| End-to-end testing of full lifecycle | 5 days |
| User acceptance testing | 5 days |
| Bug fixes from UAT | 3 days |
| Performance optimization | 2 days |
| Documentation update | 2 days |
| Deployment to staging | 1 day |
| Production deployment | 1 day |
| User training | 2 days |

**Total Estimated Effort: ~28 weeks (7 months)**

---

## 12. Testing Strategy

### 12.1 Unit Tests (Critical Path)

| Test File | Covers |
|-----------|--------|
| `approvalMatrixService.test.js` | Slab resolution, authority checking |
| `billCalculation.test.js` | Cumulative formula, double-payment prevention |
| `deviationService.test.js` | ±10% threshold detection |
| `mbService.test.js` | MB locking, superseding |
| `dlpService.test.js` | DLP countdown, reminder scheduling |
| `nitAutoDraft.test.js` | NIT generation from TS estimate |
| `agreementService.test.js` | EMD-to-SD conversion |
| `slaEscalation.test.js` | Breach detection, escalation hierarchy |

### 12.2 Integration Tests

| Flow | Steps |
|------|-------|
| Full lifecycle | Estimate > AS > TS > Tender > Agreement > WO > MB > RA Bill > Final Bill > Completion |
| Deviation flow | MB entry > Deviation detected > Deviation Sanction > Approved > Bill proceeds |
| Reversion flow | Estimate reverted > Version created > Re-submitted > Approved |
| SLA escalation | SLA timer > Breach > Escalation > Notification > Resolution |

### 12.3 Test Commands

```bash
# Unit tests
node --test server/tests/billCalculation.test.js

# All tests
npm test

# With coverage
node --test --experimental-test-coverage server/tests/*.test.js
```

---

## 13. Appendix — Reference Blueprint Mapping

### 13.1 Blueprint Section to Implementation Mapping

| Blueprint Section | Implementation |
|-------------------|----------------|
| §1 Purpose | This document |
| §2 Comparative Research | §2 Gap Analysis above |
| §3 Mapping to HMWSSB | §6 Approval-Matrix Engine, §4.1.1 DelegationOfPowers |
| §4 Revised Workflow | §7 Module Specifications |
| §5 Worked Example | §7.6 Billing Management (calculateBill function) |
| §6 Approval Matrix | §6 Approval-Matrix Engine, §4.1.1 DelegationOfPowers |
| §7 Business Modules | §7.1-7.7 Module Specifications |
| §8 Configurable Engine | §6 Approval-Matrix Engine |
| §9 Database Enhancement | §4 Database Design |
| §10 Notification & SLA | §8 Notification & SLA Engine |
| §11 Dashboard Redesign | §9.2 Enhanced Dashboard by Role |
| §12 Business Rules | §10 Business Rules Implementation |
| §13 Implementation Roadmap | §11 Implementation Phases |

### 13.2 Existing Model to New Model Links

| Existing Model | New Models That Reference It |
|----------------|------------------------------|
| Estimate | AdministrativeSanction, TechnicalSanction, Tender |
| WorkMaster | All new models (workId foreign key) |
| User | All new models (approvingUserId, recordedBy, etc.) |
| AuditLog | Extended with new module values |
| Notification | Extended with new event templates |

---

*End of Technical Design Document*
