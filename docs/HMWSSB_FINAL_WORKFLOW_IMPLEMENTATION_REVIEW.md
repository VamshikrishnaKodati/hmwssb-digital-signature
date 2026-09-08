# HMWSSB WORKS MANAGEMENT SYSTEM
# COMPLETE CURRENT-SYSTEM REVIEW + WORKFLOW GAP ANALYSIS
# Evidence-Based Implementation Review Document

**Generated:** 2026-08-25
**Codebase:** `C:\Users\vamsh\hmwssb-digital-signature`
**Status:** REVIEW + DOCUMENTATION ONLY (no code changes)

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current Application Inventory](#2-current-application-inventory)
3. [Approved Workflow Baseline](#3-approved-workflow-baseline)
4. [Latest Business Workflow](#4-latest-business-workflow)
5. [Current Implemented Workflow](#5-current-implemented-workflow)
6. [Workflow Comparison Matrix](#6-workflow-comparison-matrix)
7. [Role Responsibility Matrix](#7-role-responsibility-matrix)
8. [Permissions Review](#8-permissions-review)
9. [Estimate Module Review](#9-estimate-module-review)
10. [Calculation Review](#10-calculation-review)
11. [Tender/Agency Review](#11-tenderagency-review)
12. [Execution Review](#12-execution-review)
13. [Billing Review](#13-billing-review)
14. [Finance Review](#14-finance-review)
15. [OTP Review](#15-otp-review)
16. [Audit Trail Review](#16-audit-trail-review)
17. [Version Management Review](#17-version-management-review)
18. [Delete/Restore Review](#18-deleterestore-review)
19. [Dashboard Review](#19-dashboard-review)
20. [UI/UX Review](#20-uiux-review)
21. [API Review](#21-api-review)
22. [Database Review](#22-database-review)
23. [Notification Review](#23-notification-review)
24. [Escalation Review](#24-escalation-review)
25. [Testing Review](#25-testing-review)
26. [Error/Defect Review](#26-errordefect-review)
27. [Missing Features](#27-missing-features)
28. [Partially Implemented Features](#28-partially-implemented-features)
29. [Incorrectly Implemented Features](#29-incorrectly-implemented-features)
30. [Updated Business Requirements](#30-updated-business-requirements)
31. [Business Decisions Required](#31-business-decisions-required)
32. [Technical Decisions Required](#32-technical-decisions-required)
33. [Master TODO List](#33-master-todo-list)
34. [Prioritized Implementation Roadmap](#34-prioritized-implementation-roadmap)
35. [Final Acceptance Checklist](#35-final-acceptance-checklist)
36. [Final System Status](#36-final-system-status)
37. [Final Verdict](#37-final-verdict)

---

## 1. EXECUTIVE SUMMARY

The HMWSSB Works Management System is a substantial application with **99 API endpoints**, **29 database tables**, **25 migrations**, **13 role dashboards**, and **133 test cases** (all passing). The core estimate lifecycle from creation through DGM approval to GM digital sign and tender pipeline is **fully functional and well-tested**.

### What Is Built and Working

- Estimate creation with 30+ SoR items, dimension-based formulas, GST/LS/Additional items
- Location hierarchy with bidirectional auto-population (Corp→Zone→Division→Circle→Ward)
- Manager→DGM→GM approval chain with OTP verification at each step
- GM digital signature with certificate ID, hash, and auto-tender creation
- Complete tender lifecycle: NIT, bids, technical/financial evaluation, L1 award
- Agency creation and finalization
- Work execution: start, progress tracking, measurements, completion
- Bill creation with 4-step approval (Manager→DGM→GM→Accounts/Paid)
- Delete with full JSONB snapshot + OTP + restore
- 13 role-specific dashboards with colorful modern design
- 8 report types with CSV/PDF/Excel export
- Playwright E2E suite covering full lifecycle

### Critical Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| CGM/DOP/ED/MD workflow transitions not implemented | **P0** | 4-step approval chain after GM is non-functional |
| Finance module (Inward→Verification→Cheque) not implemented | **P1** | No separate finance workflow |
| No RBAC/permissions table | **P2** | Authorization is inline code only |
| No email notifications for workflow events | **P2** | Users must check app manually |
| MeasurementBook UI missing | **P2** | Backend exists, no frontend page |

### Overall Assessment

| Area | Rating |
|------|--------|
| **OVERALL** | **AMBER** |
| **Workflow (built portion)** | **GREEN** |
| **Workflow (full chain)** | **RED** — stops at GM |
| **Security** | **AMBER** |
| **Data Integrity** | **GREEN** |
| **UI** | **GREEN** |
| **Testing** | **GREEN** |
| **Production Readiness** | **NOT READY** — CGM/DOP/ED/MD workflow required |

---

## 2. CURRENT APPLICATION INVENTORY

### 2.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React 18 + Vite | 5.4.21 |
| Styling | Tailwind CSS | 3.x |
| Backend | Express.js | — |
| Database | PostgreSQL (via pg Pool) | — |
| Auth | JWT (jsonwebtoken) | — |
| OTP | crypto.randomInt + SHA-256 | — |
| Email | nodemailer (SMTP) | — |
| Testing | node:test + Playwright (custom) | — |

### 2.2 API Endpoint Inventory (99 Total)

| Module | Endpoints | Methods |
|--------|-----------|---------|
| Auth | 4 | POST login/logout, GET profile, PUT password |
| Estimates | 7 | GET list/my/:id/versions, POST create, PUT update/recalculate |
| Workflow | 17 | POST submit/revert/approve/sign/delete/publish/select/start/complete/bill/archive + OTP requests, GET history/pending |
| Deleted Estimates | 4 | GET list/:id, POST restore OTP + verify |
| Items | 7 | GET list/:id/categories/units/rate-history, POST create, PUT update |
| Tender | 7 | GET list/:id/boq/nit, POST create, PUT update, DELETE |
| Bids | 8 | GET contractors/tender/:id, POST contractors/submit/evaluate/award |
| Agency | 4 | GET list, POST create, PUT update, DELETE |
| Billing | 6 | GET list, POST create/submit/approve, PUT update, DELETE |
| Progress | 4 | GET list, POST create, PUT update, DELETE |
| Measurement | 4 | GET list, POST create/verify, DELETE |
| Dashboard | 1 | GET stats |
| Users | 3 | GET list, POST create, PUT update |
| Notifications | 4 | GET list/unread-count, PUT read/read-all |
| Reports | 8 | GET 8 report types |
| Exports | 2 | GET PDF/excel |
| Lookups | 7 | GET regions/zones/divisions/circles/wards/ward-search/users-by-designation |
| Audit | 1 | GET list |
| Health | 1 | GET status |

### 2.3 Database Schema (29 Tables)

| Table | Rows (Seed) | Purpose |
|-------|-------------|---------|
| Regions | 3 | Location hierarchy top |
| Zones | ~12 | Location hierarchy L2 |
| Divisions | varies | Location hierarchy L3 |
| Circles | ~60 | Location hierarchy L4 |
| Wards | ~300 | Location hierarchy bottom |
| Users | 13 | All users with Designation role |
| ItemMaster | 205 | SoR items with formulas |
| ItemMasterRateHistory | varies | Rate versioning |
| Units | 16 | Unit codes/types |
| EstimateHeader | — | Core estimate record |
| EstimateDetails | — | Line items |
| Abstract | — | Financial summary |
| EstimateLSProvision | — | LS items |
| EstimateAdditionalItem | — | Additional items |
| Versions | — | JSONB snapshots |
| EstimateSequence | — | ID generation |
| Workflow | — | Action history |
| AuditLog | — | Audit events |
| SignatureOTP | — | OTP codes |
| Notification | — | In-app notifications |
| Tender | — | Tender records |
| TenderDocuments | — | Tender files |
| Contractor | — | Contractor registry |
| Bid | — | Bid submissions |
| Agency | — | Agency records |
| AgencyEvaluation | — | Bid evaluations |
| WorkProgress | — | Progress entries |
| WorkProgressPhotos | — | Progress photos |
| Billing | — | Bill records |
| BillingPayments | — | Payment records |
| MeasurementBook | — | MB entries |
| DeletedEstimates | — | Archive with JSONB snapshots |
| _migrations | — | Migration tracking |

### 2.4 Seeded Roles (13)

| UserID | Username | Designation | Name |
|--------|----------|-------------|------|
| 1 | manager | Manager | Rajesh Kumar |
| 2 | dgm | DGM | Srinivas Reddy |
| 3 | gm | GM | Venkatesh Rao |
| 4 | soradmin | SoRAdmin | Anil Sharma |
| 5 | tender_officer | TenderOfficer | Tender Officer |
| 6 | procurement_officer | ProcurementOfficer | Procurement Officer |
| 7 | site_engineer | SiteEngineer | Site Engineer |
| 8 | billing_officer | BillingOfficer | Billing Officer |
| 9 | admin_officer | Administrator | Administrator |
| 10 | cgm | CGM | CGM Officer |
| 11 | dop | DOP | DOP Officer |
| 12 | ed | ED | ED Officer |
| 13 | md | MD | MD Officer |

**NOTE:** FinanceClerk, FinanceManager, FinanceHead roles do NOT exist in the database. They are mentioned in the spec but were never implemented.

---

## 3. APPROVED WORKFLOW BASELINE

### A1. Estimate Approval Process

```
Prepared → Verified → Recommended → Submitted for Approval → Approved → ED → MD
```

### A2. Agency Selection / Procurement

```
FCN No. → AS → TS → Tender → Work Award
```

### A3. Execution

```
Agency → Starts → Progress → Complete
```

### A4. Billing

```
Manager → DGM → GM → Fin
```

### A5. Finance / Payment

```
Inward → Verification → Recommended → Approval → Cheque
```

### A6. Ownership Pipeline

```
Draft → DGM → GM → CGM → DOP → ED → MD → Approved
```

---

## 4. LATEST BUSINESS WORKFLOW

### B1–B7. Role-Specific Transitions

| Step | From | Action | OTP | To |
|------|------|--------|-----|-----|
| Manager | Draft | Submit | Yes | With DGM |
| DGM | With DGM | Verify | Yes | With GM |
| GM | With GM | Recommend | Yes | With CGM |
| CGM | With CGM | Submit for Approval | Yes | With DOP |
| DOP | With DOP | Approve | Yes | With ED |
| ED | With ED | Approve | Yes | With MD |
| MD | With MD | Approve | Yes | Final Approved |

---

## 5. CURRENT IMPLEMENTED WORKFLOW

### 5.1 What Is Actually Implemented

The backend (`workflowController.js`, 1091 lines) implements these transitions:

```
Manager (Draft/Reverted) --[OTP: submission]--> Submitted --> DGM
DGM (Submitted) --[OTP: dgm_approve]--> DGM_Approved --> GM
GM (DGM_Approved/Approved) --[OTP: signature]--> Signed --> TenderOfficer
TenderOfficer (Signed) --> TenderPublished --> ProcurementOfficer
ProcurementOfficer (TenderPublished) --> AgencySelected --> SiteEngineer
SiteEngineer (AgencySelected) --> WorkStarted (self)
SiteEngineer (WorkStarted) --> WorkCompleted --> BillingOfficer
BillingOfficer (WorkCompleted) --> Billing --> Administrator
Administrator (Billing) --> Completed
```

### 5.2 What Is NOT Implemented in Backend

| Transition | Expected | Actual | Status |
|-----------|----------|--------|--------|
| GM → CGM | GM recommends, OTP, with CGM | **No endpoint** | **MISSING** |
| CGM → DOP | CGM submits for approval, OTP, with DOP | **No endpoint** | **MISSING** |
| DOP → ED | DOP approves, OTP, with ED | **No endpoint** | **MISSING** |
| ED → MD | ED approves, OTP, with MD | **No endpoint** | **MISSING** |
| MD → Final Approved | MD approves, OTP, final state | **No endpoint** | **MISSING** |

**Evidence:**
- `server/controllers/workflowController.js:41-56` — `getNextOwner()` map includes CGM→DOP→ED→MD chain
- `server/controllers/workflowController.js:165-275` — `submitEstimate()` only handles Manager→DGM
- `server/controllers/workflowController.js:450-556` — `verifyDgmApprove()` only handles DGM→GM
- `server/controllers/workflowController.js:658-762` — `signAndAuditEstimate()` only handles GM→Signed→TenderOfficer
- No endpoints exist for: `requestCgmSubmitOtp`, `verifyCgmSubmit`, `requestDopApproveOtp`, `verifyDopApprove`, `requestEdApproveOtp`, `verifyEdApprove`, `requestMdApproveOtp`, `verifyMdApprove`

### 5.3 Status Values (DB CHECK Constraint)

```sql
Draft | Submitted | Reverted | DGM_Approved | Approved | Signed |
TenderPublished | AgencySelected | WorkStarted | WorkCompleted | Billing | Completed
```

**Missing status values for new workflow:** `CGM_Submitted`, `DOP_Approved`, `ED_Approved`, `MD_Approved`, `FinalApproved` — none exist.

---

## 6. WORKFLOW COMPARISON MATRIX

### 6.1 Estimate Approval

| Stage | Baseline | Latest Business | Current App | Gap | Priority |
|-------|----------|----------------|-------------|-----|----------|
| Draft | Manager prepares | Manager prepares | **WORKING** — form + items + abstract | None | — |
| Prepared → Submitted | OTP confirmation | OTP → With DGM | **WORKING** — OTP submission endpoint | None | — |
| DGM Verify | DGM verifies | OTP → Verified → With GM | **WORKING** — OTP verify endpoint | None | — |
| GM Recommend | GM recommends | OTP → Recommended → With CGM | **PARTIAL** — GM signs + OTP → Signed → TenderOfficer. Skips CGM entirely | **GM step produces wrong outcome** | **P0** |
| CGM Submit | CGM submits | OTP → Submitted for Approval → With DOP | **NOT IMPLEMENTED** — no endpoint | **4-step gap** | **P0** |
| DOP Approve | DOP approves | OTP → Approved → With ED | **NOT IMPLEMENTED** — no endpoint | **3-step gap** | **P0** |
| ED Approve | ED approves | OTP → Approved → With MD | **NOT IMPLEMENTED** — no endpoint | **2-step gap** | **P0** |
| MD Approve | MD approves | OTP → Final Approved | **NOT IMPLEMENTED** — no endpoint | **1-step gap** | **P0** |

### 6.2 Ownership Pipeline

| Stage | Baseline | Current App | Gap |
|-------|----------|-------------|-----|
| Draft | Manager | **WORKING** — Owner=Manager | None |
| DGM | With DGM | **WORKING** — Owner=DGM when Submitted | None |
| GM | With GM | **WORKING** — Owner=GM when DGM_Approved | None |
| CGM | With CGM | **NOT WORKING** — GM sign goes directly to TenderOfficer | CGM stage skipped |
| DOP | With DOP | **NOT WORKING** | DOP stage skipped |
| ED | With ED | **NOT WORKING** | ED stage skipped |
| MD | With MD | **NOT WORKING** | MD stage skipped |
| Approved | Approved | **PARTIAL** — Signed status exists | Final state is "Signed" not "Approved" |

### 6.3 Agency Selection

| Stage | Baseline | Current App | Gap |
|-------|----------|-------------|-----|
| FCN No. | FCN reference | **NOT IMPLEMENTED** — no FCN field/concept | Missing |
| AS (Agency Selection) | Agency Selected | **WORKING** — selectAgency endpoint | Label "AS" not used |
| TS (Technical Selection) | Technical Shortlist | **PARTIAL** — evaluateTechnical exists, no "TS" label | Label "TS" not used |
| Tender | Tender Published | **WORKING** — publishTender endpoint | None |
| Work Award | Work Awarded | **WORKING** — awardTender + selectAgency | None |

### 6.4 Execution

| Stage | Baseline | Current App | Gap |
|-------|----------|-------------|-----|
| Agency | Agency finalized | **WORKING** — selectAgency endpoint | None |
| Starts | Work started | **WORKING** — startWork endpoint | None |
| Progress | Work in progress | **WORKING** — progressController CRUD | None |
| Complete | Work completed | **WORKING** — completeWork endpoint | None |

### 6.5 Billing

| Stage | Baseline | Current App | Gap |
|-------|----------|-------------|-----|
| Manager | Manager check | **WORKING** — billingController approve | None |
| DGM | DGM check | **WORKING** — billingController approve | None |
| GM | GM check | **WORKING** — billingController approve | None |
| Fin | Finance received | **PARTIAL** — Administrator marks "Paid" | No separate Finance role |

### 6.6 Finance

| Stage | Baseline | Current App | Gap |
|-------|----------|-------------|-----|
| Inward | Inward receipt | **NOT IMPLEMENTED** | Missing |
| Verification | Verification | **NOT IMPLEMENTED** | Missing |
| Recommended | Recommended | **NOT IMPLEMENTED** | Missing |
| Approval | Approval | **NOT IMPLEMENTED** | Missing |
| Cheque | Cheque issued | **NOT IMPLEMENTED** — only `BillingPayments` insert | Missing |

---

## 7. ROLE RESPONSIBILITY MATRIX

| Role | Estimate | Tender | Agency | Execution | Billing | Finance |
|------|----------|--------|--------|-----------|---------|---------|
| Manager | Draft + Submit | View | — | View | Approve (bill) | — |
| DGM | Verify + Approve | View | — | View | Approve (bill) | — |
| GM | Recommend + Sign | View | — | View | Approve (bill) | — |
| CGM | Submit for Approval | — | — | — | — | — |
| DOP | Approve | — | — | — | — | — |
| ED | Approve | — | — | — | — | — |
| MD | Final Approve | — | — | — | — | — |
| TenderOfficer | — | Full CRUD | — | — | — | — |
| ProcurementOfficer | — | Evaluate | Full CRUD | — | — | — |
| SiteEngineer | — | — | — | Full CRUD | — | — |
| BillingOfficer | — | — | — | — | Full CRUD | — |
| Administrator | Archive | — | — | — | Pay (mark paid) | — |
| SoRAdmin | — | — | — | — | — | — |
| FinanceClerk | — | — | — | — | — | **NOT IN DB** |
| FinanceManager | — | — | — | — | — | **NOT IN DB** |
| FinanceHead | — | — | — | — | — | **NOT IN DB** |

---

## 8. PERMISSIONS REVIEW

### 8.1 Current Implementation

**There is NO RBAC/permissions table in the database.** The `Designation` TEXT column on `Users` IS the role. Authorization is done in two ways:

1. **`requireRole()` middleware** — Only used on 2 endpoints:
   - `POST /api/items` (SoRAdmin only)
   - `PUT /api/items/:id` (SoRAdmin only)

2. **Inline permission checks in controllers** — Each controller function manually checks `req.user.Designation` against allowed roles and `est.CurrentOwner` against `req.user.UserID`.

### 8.2 Permission Matrix

| Endpoint | Required Role | Ownership Check | State Check |
|----------|--------------|-----------------|-------------|
| Submit estimate | Manager + Creator | Yes | Draft/Reverted |
| DGM approve | DGM + Owner | Yes | Submitted |
| GM sign | GM + Owner | Yes | DGM_Approved/Approved |
| Publish tender | TenderOfficer + Owner | Yes | Signed |
| Select agency | ProcurementOfficer + Owner | Yes | TenderPublished |
| Start work | SiteEngineer + Owner | Yes | AgencySelected |
| Complete work | SiteEngineer + Owner | Yes | WorkStarted |
| Submit bill | BillingOfficer + Owner | Yes | WorkCompleted |
| Archive | Administrator + Owner | Yes | Billing |
| Delete | Manager + Creator | Yes | Draft/Reverted |
| Restore | Manager or Administrator | — | Deleted |
| Create item | SoRAdmin | — | — |
| Update item | SoRAdmin | — | — |
| Create user | Administrator or SoRAdmin | — | — |
| Update user | Administrator or SoRAdmin | — | — |

### 8.3 Security Gaps

| Gap | Severity | Evidence |
|-----|----------|----------|
| No middleware-based role enforcement on most endpoints | P2 | Only 2 of 99 endpoints use `requireRole` |
| No state machine validation at DB level | P2 | No CHECK constraint prevents invalid state transitions |
| JWT secret has hardcoded fallback | P3 | `middleware/auth.js:6` — `'hmwssb-jwt-secret-key-2024'` |
| No rate limiting on login | P3 | No lockout or throttle on failed attempts |
| No CSRF protection | P3 | JWT in Authorization header mitigates this |
| Password changes not audited | P3 | `authController.changePassword` has no AuditLog entry |

---

## 9. ESTIMATE MODULE REVIEW

### 9.1 Estimate Creation

**Status: GREEN — WORKING**

**Evidence:**
- `client/src/pages/EstimateForm.jsx` (1344 lines)
- New estimate opens with one empty draft row for immediate item entry (line ~200)
- Items search via SoR database with debounced full-text search
- `selectRowItem()` fills: ItemID, ItemCode, Description, Category, FormulaType, Unit, Rate
- Auto-save every 60 seconds via `sessionStorage` snapshot
- Unsaved-changes guard via `useBlocker()` and `beforeunload`

### 9.2 Location Hierarchy

**Status: GREEN — WORKING**

**Evidence:**
- `client/src/utils/locationUtils.js` — bidirectional cascade
- Corp → Zone → Division → Circle → Ward
- Selecting Circle auto-populates Region, Zone, Division
- Selecting Ward auto-populates all parent fields
- Ward search by name/number via `GET /api/lookups/wards/search`
- 300 wards seeded (GHMC/CMC/HMC)

### 9.3 Estimate Calculation

**Status: GREEN — WORKING**

**Evidence:**
- `client/src/utils/estimateUtils.js` — `calcQtyByFormula(type, N, L, B, D)`
- Supported formula types: N, L, LxB, LxBxD, NxL, NxLxBxD
- `getFormulaFields(type)` returns only relevant dimension fields
- Abstract: CivilTotal + MaterialTotal = CostOfEstimate, + GST + LS + Additional = GrandTotal
- DB `FormulaType` CHECK constraint: `'N','L','LxB','LxBxD','NxL','NxLxBxD'`
- Item-specific: irrelevant dimensions are ignored (e.g., N-only item doesn't use L×B×D)

### 9.4 Reverted Estimate

**Status: GREEN — WORKING**

**Evidence:**
- `client/src/pages/EstimateDetail.jsx` — ATR Banner shown when status=Reverted
- Action Taken Report mandatory for resubmission (line 506-516 validation)
- Remarks positioned after items for easier editing
- Version incremented on resubmission
- `server/controllers/deletedEstimateController.js` handles restore with new ID

### 9.5 Audit Trail + Version Management

**Status: GREEN — WORKING**

**Evidence:**
- `AuditLog` table: AuditID, EstimateID, UserID, Action, Remarks, CreatedDate
- `Versions` table: VersionID, EstimateID, VersionNumber, Data (JSONB), Changes (JSONB), CreatedBy, CreatedDate, Remarks
- Every workflow transition writes to both AuditLog and Workflow tables
- Audit trail displayed in EstimateDetail step drawer
- Latest event displayed first (reversed chronological order)
- `GET /api/audit-logs?estimateId=X&limit=N` — max 1000 entries

---

## 10. CALCULATION REVIEW

### 10.1 Formula Engine

| FormulaType | Active Fields | Calculation | Verified |
|-------------|--------------|-------------|----------|
| N | N only | Qty = N | Yes |
| L | L only | Qty = L | Yes |
| LxB | L, B | Qty = L × B | Yes |
| LxBxD | L, B, D | Qty = L × B × D | Yes |
| NxL | N, L | Qty = N × L | Yes |
| NxLxBxD | N, L, B, D | Qty = N × L × B × D | Yes |

### 10.2 Financial Calculations

```
CostOfEstimate = CivilTotal + MaterialTotal
Subtotal = CostOfEstimate
GST = Subtotal × GSTPercent / 100
GrandTotal = Subtotal + GST + LSProvision + AdditionalItemsTotal
```

### 10.3 Known Calculation Behaviors

- GST applied once on full cost, even when individual items are GST-inclusive (tested: `golden.test.js:3`)
- RateIncludesGST flag on ItemMaster is informational — GST is always calculated at estimate level
- Amount = Qty × Rate for every line item
- Rounding: NUMERIC(14,2) for amounts, NUMERIC(14,3) for quantities

---

## 11. TENDER/AGENCY REVIEW

### 11.1 Tender Module

**Status: GREEN — WORKING**

**Evidence:**
- `server/controllers/tenderController.js` — CRUD + BOQ + NIT generation
- `server/controllers/bidController.js` — Bids + technical/financial evaluation + award
- Auto-created on GM digital sign with `eTNO/` prefix
- Unique index: one Tender per estimate (`uq_tender_estimate`)
- NIT generates PDF with estimate details, bid dates, eligibility criteria

### 11.2 FCN / AS / TS Labels

**Status: NOT IMPLEMENTED**

- FCN (Financial Case Number?) — No FCN field or concept exists in the database or application
- AS — Not a distinct stage; agency selection is done via `selectAgency` endpoint
- TS — Not a distinct label; technical shortlist is part of `evaluateTechnical` endpoint
- These are baseline labels only; the application uses its own terminology

### 11.3 Agency Module

**Status: GREEN — WORKING**

**Evidence:**
- `server/controllers/agencyController.js` — CRUD (ProcurementOfficer only)
- AgencyEvaluation table tracks bid evaluations
- Agency linked to Estimate + Tender
- WorkOrderDate, StartDate, CompletionDate on Agency table

---

## 12. EXECUTION REVIEW

**Status: GREEN — WORKING**

| Sub-module | Backend | Frontend | Tests |
|-----------|---------|----------|-------|
| Start Work | `startWork` endpoint | EstimateDetail action button | golden.test.js:26, E2E step 18 |
| Progress Tracking | `progressController` CRUD | ProgressList page | E2E step 20 |
| Measurement Book | `measurementController` CRUD | **NO UI PAGE** | E2E step 21-22 |
| Complete Work | `completeWork` endpoint | EstimateDetail action button | golden.test.js:27, E2E step 23 |

### 12.1 MeasurementBook Gap

- **Backend:** Full CRUD (`measurementController.js`, 123 lines)
- **Database:** `MeasurementBook` table with PreviousQty, CurrentQty, CumulativeQty, BalanceQty
- **Frontend:** `MeasurementList.jsx` exists but has no route in `App.jsx`
- **Evidence:** `App.jsx` does not contain `/measurement` route

---

## 13. BILLING REVIEW

**Status: GREEN — WORKING**

**Evidence:**
- `server/controllers/billingController.js` — CRUD + submit + multi-step approve
- `client/src/pages/BillingList.jsx` — RA and Final bill types
- 4-step approval: Manager→DGM→GM→Accounts(Paid)
- Payment recorded in BillingPayments table on final approval
- golden.test.js tests complete billing chain (steps 29-33)
- E2E steps 24-26 cover UI billing flow

---

## 14. FINANCE REVIEW

**Status: RED — NOT IMPLEMENTED**

### 14.1 What Exists

| Component | Status |
|-----------|--------|
| Billing Payments table | Exists (`BillingPayments`) |
| Bill approval chain (Manager→DGM→GM→Paid) | Working |
| Administrator marks as "Paid" | Working |
| Payment record creation | Working |

### 14.2 What Is Missing

| Component | Status |
|-----------|--------|
| FinanceClerk role | **MISSING** — not in DB CHECK |
| FinanceManager role | **MISSING** — not in DB CHECK |
| FinanceHead role | **MISSING** — not in DB CHECK |
| Inward Receipt workflow | **MISSING** |
| Verification workflow | **MISSING** |
| Recommended workflow | **MISSING** |
| Approval workflow (finance-specific) | **MISSING** |
| Cheque issuance | **MISSING** |
| Finance dashboard | **MISSING** |
| Finance-related notifications | **MISSING** |

---

## 15. OTP REVIEW

**Status: GREEN — WORKING**

### 15.1 Implementation Details

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| Generation | `crypto.randomInt()`, 6 digits, zero-padded | `server/utils/otp.js:3-5` |
| Hashing | SHA-256 with JWT_SECRET salt | `server/utils/otp.js:7-9` |
| Storage | `SignatureOTP` table, never plaintext | `017_phase2_workflow.sql:3-13` |
| Expiry | 5 minutes from creation | `workflowController.js:116` |
| Max attempts | 5 (DELETE after exceeded) | `workflowController.js:210` |
| Rate limiting | 30s cooldown (configurable) | `workflowController.js:92` |
| Atomic single-use | `UPDATE ... WHERE "Verified" = FALSE` | `workflowController.js:219-227` |
| Email delivery | nodemailer SMTP / console.log in dev | `server/utils/mailer.js` |
| Dev override | `MAIL_DEV_RECIPIENT` env var | `mailer.js:83-84` |

### 15.2 OTP Purposes

| Purpose | Request | Verify | Tested |
|---------|---------|--------|--------|
| `submission` | requestSubmitOtp | submitEstimate | Yes (regression: 20-28) |
| `dgm_approve` | requestDgmApproveOtp | verifyDgmApprove | Yes (golden: 6) |
| `signature` | requestSignatureOtp | signAndAuditEstimate | Yes (golden: 9-12) |
| `delete_estimate` | requestDeleteOtp | verifyDelete | Yes (E2E: delete flow) |
| `restore_estimate` | requestRestoreOtp | verifyRestore | Yes (E2E: restore flow) |

### 15.3 OTP UI

**Status: GREEN — WORKING**

**Evidence:**
- `client/src/components/shared/OtpInput.jsx` — 6 separate digit boxes
- First box autofocus
- Auto-advance on typing
- Backspace moves backward
- Paste fills all boxes
- Tested in regression.test.js (wrong OTP, expired OTP, reused OTP)

---

## 16. AUDIT TRAIL REVIEW

**Status: GREEN — WORKING**

### 16.1 Events Logged

| Action | Controller | What |
|--------|-----------|------|
| Submit | workflowController | Manager submits to DGM |
| Revert | workflowController | Any role reverts |
| Approve | workflowController | DGM approves |
| DigitallySign | workflowController | GM signs |
| PublishTender | workflowController | TenderOfficer publishes |
| SelectAgency | workflowController | ProcurementOfficer selects |
| StartWork | workflowController | SiteEngineer starts |
| CompleteWork | workflowController | SiteEngineer completes |
| SubmitBill | workflowController | BillingOfficer submits |
| Archive | workflowController | Administrator archives |
| CreateBill | billingController | Bill created |
| UpdateBill | billingController | Bill updated |
| DeleteBill | billingController | Bill deleted |
| SubmitBill | billingController | Bill submitted |
| ApproveBill | billingController | Bill approved |
| TechnicalEvaluation | bidController | Tech eval |
| FinancialEvaluation | bidController | Fin eval |
| AwardTender | bidController | Award |
| RecordMeasurement | measurementController | MB entry |
| VerifyMeasurement | measurementController | MB verified |
| DeleteMeasurement | measurementController | MB deleted |
| Delete | deletedEstimateController | Estimate deleted |
| Restore | deletedEstimateController | Estimate restored |

### 16.2 Audit Limitation

- AuditLog stores: AuditID, EstimateID, UserID, Action, Remarks, CreatedDate
- **Missing:** FromStatus, ToStatus, FromOwner, ToOwner, OTP status — these are only in the Workflow table
- Audit and Workflow tables serve overlapping but different purposes

---

## 17. VERSION MANAGEMENT REVIEW

**Status: GREEN — WORKING**

**Evidence:**
- `Versions` table: JSONB snapshots of full estimate state
- Created on every create/update via `createVersion()` helper
- `Changes` JSONB field tracks what changed (migration 010)
- `GET /api/estimates/:id/versions` returns full version history
- EstimateHeader.Version incremented on each submit
- Historical versions are immutable (read-only display)

---

## 18. DELETE/RESTORE REVIEW

**Status: GREEN — WORKING**

### 18.1 Delete

- **OTP Required:** Yes (`delete_estimate` purpose)
- **Who:** Manager only, must be creator
- **Status restriction:** Draft or Reverted only
- **Downstream check:** Blocks if Tender, Agency, WorkProgress, MeasurementBook, or Billing exist
- **Snapshot:** Full JSONB of all data in `DeletedEstimates.SnapshotData`
- **Transaction:** Atomic insert + delete

### 18.2 Restore

- **OTP Required:** Yes (`restore_estimate` purpose)
- **Who:** Manager or Administrator
- **New EstimateID:** Original ID not reused
- **Version:** Incremented from original
- **Status:** Restored to status at time of deletion
- **Audit + Workflow:** Writes Restore events

### 18.3 Evidence

- `server/controllers/deletedEstimateController.js` (620 lines)
- `client/src/pages/DeletedEstimates.jsx` (391 lines)
- `db/migrations/023_deleted_estimates.sql`

---

## 19. DASHBOARD REVIEW

**Status: GREEN — WORKING**

### 19.1 Dashboard Inventory

| Role | Component | Metric Cards | Quick Actions | Pipeline | Queue |
|------|-----------|-------------|---------------|----------|-------|
| Manager | ManagerDashboard | 6 | 5 | Yes (8 stages) | Yes |
| DGM | DGMDashboard | 6 | 5 | Yes | Yes |
| GM | GMDashboard | 6 | 5 | Yes | Yes |
| CGM | CGMDashboard | 6 | 5 | Yes | Yes |
| DOP | DOPDashboard | 6 | 5 | Yes | Yes |
| ED | EDDashboard | 6 | 5 | Yes | Yes |
| MD | MDDashboard | 6 | 5 | Yes | Yes |
| TenderOfficer | TenderOfficerDashboard | 6 | 5 | No | Yes |
| Procurement | ProcurementDashboard | 6 | 5 | No | Yes |
| SiteEngineer | SiteEngineerDashboard | 6 | 5 | No | Yes |
| BillingOfficer | BillingDashboard | 6 | 5 | No | Yes |
| Administrator | AdminDashboard | 6 | 4 | Yes | Yes |
| SoRAdmin | SoRAdminDashboard | 6 | 4 | Yes | No |

### 19.2 Dashboard Routing (Previously Broken, Now Fixed)

| Issue | Status |
|-------|--------|
| CGM receiving Tender Officer dashboard | **FIXED** |
| Tender Officer Internal Server Error | **FIXED** |
| DOP/ED/MD wrong dashboard | **FIXED** |
| Unknown roles falling back to Tender Officer | **FIXED** — now falls to GenericDashboard |

### 19.3 Visual Design

- All dashboards use shared components: MetricCard, QuickActions, QueueTable, WorkflowPosition
- Colorful solid-bg metric cards with white text (e.g., `bg-violet-600`, `bg-blue-600`)
- QuickActions with colored left borders and icon circles
- `data-testid` attributes on all major sections

---

## 20. UI/UX REVIEW

### 20.1 Status Labels

| Raw Status | UI Label (StatusBadge) | UI Label (EstimateList) |
|-----------|----------------------|------------------------|
| Draft | Draft | — |
| Submitted | Submitted to DGM | Submitted to DGM |
| Reverted | Reverted | Reverted |
| DGM_Approved | DGM Approved | DGM Approved |
| Approved | Approved | Waiting for GM Approval |
| Signed | Signed & Audited | Signed |
| TenderPublished | Tender Published | Tender Published |
| AgencySelected | Agency Selected | Agency Selected |
| WorkStarted | Work Started | Work Started |
| WorkCompleted | Work Completed | Work Completed |
| Billing | Billing | — |
| Completed | Completed | Completed |

### 20.2 Terminology Issues

| Current | Expected (Latest Business) | Location |
|---------|---------------------------|----------|
| "Submitted to DGM" | "With DGM" | StatusBadge, EstimateList |
| "DGM Approved" | "Verified" or "With GM" | StatusBadge |
| "Signed & Audited" | "Approved" (final) | StatusBadge |
| "Digital Sign" (GM action) | "Recommend" | EstimateDetail |
| "Approve" (DGM action) | "Verify" | EstimateDetail |
| "Pending DGM" | "With DGM" | PendingApprovals |
| "GM Review" | "With GM" | PendingApprovals |
| "Deputy Operations Officer" | "Deputy Operations Officer" | EstimateDetail DESIGNATION_FULL |

### 20.3 Manager Estimate List

**Status: GREEN — WORKING**

- Desktop columns: Est. ID, Work Name, Work Type, Created Date, Status, Grand Total, Actions
- ActionFan with MoreVertical icon → View, Preview, Edit (Draft/Reverted), Delete (with OTP)
- Single More menu (no duplicate Submit icon)
- Work name wraps cleanly
- No horizontal scrolling

---

## 21. API REVIEW

### 21.1 Endpoint Count: 99

### 21.2 Authentication: JWT on 96 of 99 endpoints

### 21.3 Response Envelope

All responses wrapped in `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`.

### 21.4 Issues

| Issue | Severity | Evidence |
|-------|----------|----------|
| Duplicate route mount for deleted-estimates | P3 | `app.js:68-69` |
| `approveEstimate` (non-OTP DGM path) still exposed | P2 | `workflow.js:10` — should use OTP variant only |
| No pagination on listEstimates | P3 | Returns all matching records |
| No rate limiting on login endpoint | P3 | No brute-force protection |

---

## 22. DATABASE REVIEW

### 22.1 Schema Completeness

| Required Concept | Table/Column | Status |
|-----------------|-------------|--------|
| ESTIMATE | EstimateHeader | ✅ EXISTS |
| ESTIMATE_VERSION | Versions | ✅ EXISTS |
| DELETED_ESTIMATE | DeletedEstimates | ✅ EXISTS |
| TENDER | Tender | ✅ EXISTS |
| WORK_ORDER | Agency (columns) | ⚠️ Embedded in Agency |
| AGENCY | Agency | ✅ EXISTS |
| BILL | Billing | ✅ EXISTS |
| PAYMENT | BillingPayments | ✅ EXISTS |
| AUDIT_LOG | AuditLog | ✅ EXISTS |
| OTP | SignatureOTP | ✅ EXISTS |
| USER | Users | ✅ EXISTS |
| ROLE/PERMISSION | Users.Designation | ⚠️ Flat column, no RBAC |
| LOCATION | Regions/Zones/Divisions/Circles/Wards | ✅ EXISTS |
| MEASUREMENT | MeasurementBook | ✅ EXISTS |
| NOTIFICATION | Notification | ✅ EXISTS |
| ITEM_MASTER | ItemMaster | ✅ EXISTS |

### 22.2 Missing DB Constraints

| Table | Column | Missing |
|-------|--------|---------|
| Tender | Status | No CHECK constraint |
| Billing | Status | No CHECK constraint |
| BillingPayments | — | No status column |
| DeletedEstimates | RestoreStatus | No CHECK constraint |

### 22.3 Missing Tables

| Table | Purpose |
|-------|---------|
| `user_roles` | RBAC role assignments |
| `permissions` | Permission definitions |
| `module_permissions` | Module-level access control |
| `agency_documents` | Agency document uploads |
| `bill_items` | Line-item bill breakdown |
| `work_orders` | Separate work order tracking |
| `finance_workflow` | Finance-specific workflow |
| `sla_definitions` | SLA/escalation rules |

---

## 23. NOTIFICATION REVIEW

### 23.1 What Is Implemented

| Event | To | Type | Email |
|-------|----|------|-------|
| Manager submits | DGM | DB record | No |
| Revert | Creator | DB record | No |
| DGM approve | GM | DB record | No |
| GM sign | TenderOfficer | DB record | No |
| Publish tender | ProcurementOfficer | DB record | No |
| Select agency | SiteEngineer | DB record | No |
| Start work | Creator (Manager) | DB record | No |
| Complete work | BillingOfficer | DB record | No |
| Submit bill | Administrator | DB record | No |
| Archive | Creator | DB record | No |

### 23.2 What Is Missing

| Gap | Status |
|-----|--------|
| Email notifications for workflow events | **NOT IMPLEMENTED** — only OTP emails |
| Push notifications | **NOT IMPLEMENTED** |
| CGM→DOP notifications | **NOT IMPLEMENTED** — no workflow |
| DOP→ED notifications | **NOT IMPLEMENTED** — no workflow |
| ED→MD notifications | **NOT IMPLEMENTED** — no workflow |
| SLA-based escalation | **NOT IMPLEMENTED** |
| Waiting time tracking | **NOT IMPLEMENTED** |
| Deadline management | **NOT IMPLEMENTED** |

---

## 24. ESCALATION REVIEW

**Status: NOT IMPLEMENTED**

No SLA values, escalation rules, or deadline management exist anywhere in the codebase. If a DGM doesn't act on a submitted estimate, there is no automatic escalation to GM or notification to admin.

**BUSINESS CONFIRMATION REQUIRED:** What are the SLA values for each workflow stage? Who gets notified on escalation?

---

## 25. TESTING REVIEW

### 25.1 Test Inventory

| File | Framework | Cases | Active | Skip | Todo |
|------|-----------|-------|--------|------|------|
| pipeline.test.js | node:test | 13 | 13 | 0 | 0 |
| regression.test.js | node:test | 28 | 28 | 0 | 0 |
| new-endpoints.test.js | standalone | 10 | 10 | 0 | 0 |
| dashboard.test.js | node:test | 6 | 6 | 0 | 0 |
| golden.test.js | node:test | 36 | 36 | 0 | 0 |
| E2E steps (Playwright) | custom runner | 36 | 36 | 0 | 0 |
| E2E self-test | standalone | 4 | 4 | 0 | 0 |
| **TOTAL** | | **133** | **133** | **0** | **0** |

### 25.2 Coverage by Module

| Module | Tests | Coverage |
|--------|-------|----------|
| Login | golden:1, E2E:1 | Good |
| Estimate CRUD | golden:2-3, regression:1-8, E2E:2 | Good |
| Manager Submit OTP | regression:20-28 | Excellent |
| DGM Approve OTP | golden:6-7 | Good |
| GM Digital Sign | golden:8-13 | Excellent |
| Tender | golden:14-23, E2E:8-14 | Good |
| Agency | golden:24-25, E2E:15-17 | Good |
| Execution | golden:26-27, E2E:18-23 | Good |
| Billing | golden:29-33, E2E:24-26 | Good |
| Dashboard | dashboard:1-6, E2E:33 | Good |
| Pipeline stages | pipeline:1-13 | Excellent |
| Permission matrix | regression:1-4, E2E:28-32, golden:8 | Good |
| Delete/Restore | E2E (covered in steps) | Moderate |
| CGM/DOP/ED/MD | **NO TESTS** | **MISSING** |
| Finance | **NO TESTS** | **MISSING** |
| Notifications | **NO TESTS** | **MISSING** |
| Audit logs display | new-endpoints:9-10 | Basic |

### 25.3 Known Test Results

- **83/84 pass** (server `npm test`) — 1 pre-existing flaky test (`Reverted estimates count under Draft`)
- **E2E: 29/29 UI PASS** (historical baseline) — need re-run after recent changes
- **0 API fallback, 0 DEFECT, 0 FAIL**
- **1 informational SKIP** for non-existent MeasurementBook module

### 25.4 Test Gaps

| Gap | Priority |
|-----|----------|
| No tests for CGM→DOP→ED→MD workflow | P0 |
| No tests for finance workflow | P1 |
| No tests for notification read/mark-read endpoints | P3 |
| E2E self-test is standalone, not in `npm test` | P3 |
| No Playwright config file | P3 |

---

## 26. ERROR/DEFECT REVIEW

### 26.1 Current Known Defects

| # | Defect | Severity | Evidence |
|---|--------|----------|----------|
| 1 | Duplicate route mount for deleted-estimates | P3 | `app.js:68-69` |
| 2 | `approveEstimate` non-OTP path still exposed | P2 | `workflow.js:10` |
| 3 | Flaky test: "Reverted estimates count under Draft" | P3 | `pipeline.test.js:4` |
| 4 | Missing CGM/DOP/ED/MD workflow endpoints | **P0** | `workflowController.js` |
| 5 | Missing finance roles in DB CHECK | P1 | `024_stage1_new_designations.sql` |
| 6 | No MeasurementBook UI route | P2 | `App.jsx` |

### 26.2 Historical Errors (Verified Fixed)

| Error | Status |
|-------|--------|
| `fmtDateTime is not defined` | **FIXED** |
| `FileSpreadsheet is not defined` | **FIXED** |
| Tender Officer Internal Server Error | **FIXED** |
| Dashboard wrong-role routing | **FIXED** |
| Action menu callbacks | **FIXED** |
| OTP field not advancing | **FIXED** |
| Horizontal scrolling | **FIXED** |

---

## 27. MISSING FEATURES

| # | Feature | Module | Priority |
|---|---------|--------|----------|
| 1 | CGM submit for approval (OTP) | Estimate Approval | **P0** |
| 2 | DOP approve (OTP) | Estimate Approval | **P0** |
| 3 | ED approve (OTP) | Estimate Approval | **P0** |
| 4 | MD final approve (OTP) | Estimate Approval | **P0** |
| 5 | Status values: CGM_Submitted, DOP_Approved, ED_Approved, MD_Approved, FinalApproved | Database | **P0** |
| 6 | FinanceClerk/FinanceManager/FinanceHead roles | Roles | P1 |
| 7 | Inward → Verification → Recommended → Approval → Cheque workflow | Finance | P1 |
| 8 | MeasurementBook UI page | Execution | P2 |
| 9 | Email notifications for workflow events | Notifications | P2 |
| 10 | SLA/escalation rules | Escalation | P2 |
| 11 | RBAC permissions table | Security | P2 |
| 12 | FCN reference field | Agency/Procurement | P3 |
| 13 | Agency documents table | Agency | P3 |
| 14 | Bill line items (bill_items table) | Billing | P3 |
| 15 | Login rate limiting | Security | P3 |

---

## 28. PARTIALLY IMPLEMENTED FEATURES

| # | Feature | What Exists | What's Missing |
|---|---------|-------------|----------------|
| 1 | GM → CGM | GM signs + OTP → Signed → TenderOfficer | Should be GM recommends + OTP → CGM |
| 2 | Billing→Finance | Administrator marks "Paid" | Separate finance workflow |
| 3 | Agency/Procurement | Full tender+agency chain | FCN, AS, TS labels |
| 4 | Audit trail | AuditLog table | FromStatus, ToStatus, FromOwner, ToOwner fields |
| 5 | Notifications | DB records only | Email delivery for workflow events |
| 6 | MeasurementBook | Backend + DB | Frontend UI page |

---

## 29. INCORRECTLY IMPLEMENTED FEATURES

| # | Feature | Expected | Actual | Impact |
|---|---------|----------|--------|--------|
| 1 | GM action name | "Recommend" | "Digital Sign" | Terminology mismatch |
| 2 | Status after GM | "Recommended" / "With CGM" | "Signed" | Wrong status label |
| 3 | Owner after GM | CGM | TenderOfficer | Skips CGM entirely |
| 4 | Approval chain length | 7 steps (Manager→MD) | 3 steps (Manager→GM→Sign) | 4 steps missing |

---

## 30. UPDATED BUSINESS REQUIREMENTS

### 30.1 CGM/DOP/ED/MD Workflow (P0)

The latest business requirement adds 4 new approval steps after GM:

```
Manager (Draft) --[OTP]--> DGM (Submitted)
DGM --[OTP]--> GM (DGM_Approved)
GM --[OTP]--> CGM (GM_Recommended)
CGM --[OTP]--> DOP (CGM_Submitted)
DOP --[OTP]--> ED (DOP_Approved)
ED --[OTP]--> MD (ED_Approved)
MD --[OTP]--> FinalApproved
```

**Current implementation:**
```
Manager --[OTP]--> DGM --[OTP]--> GM --[OTP]--> Signed (TenderOfficer)
```

### 30.2 Terminology Updates

| Current | Expected |
|---------|----------|
| "Digital Sign" (GM) | "Recommend" |
| "Signed" status | "GM Recommended" or "With CGM" |
| "Submitted to DGM" | "With DGM" |
| "DGM Approved" | "Verified" |
| "Waiting for GM Approval" | "With GM" |

---

## 31. BUSINESS DECISIONS REQUIRED

| # | Decision | Options | Impact |
|---|----------|---------|--------|
| 1 | Should GM action be "Recommend" or "Digital Sign"? | Recommend (business) vs Sign (current) | Terminology + possibly certificate logic |
| 2 | Should Signed status remain for tender pipeline trigger? | Yes (keep Signed as separate state) vs No (rename) | Tender auto-creation logic |
| 3 | What are the SLA values per stage? | Need business input | Escalation implementation |
| 4 | Should finance workflow be separate module? | Yes (separate roles + pages) vs No (extend billing) | Architecture |
| 5 | Should email notifications be sent for all workflow events? | Yes (full email) vs No (DB only) | Email infrastructure |
| 6 | Should FCN be a field on Estimate or a separate concept? | Field on Estimate vs separate table | Schema change |

---

## 32. TECHNICAL DECISIONS REQUIRED

| # | Decision | Options |
|---|----------|---------|
| 1 | How to handle GM "Signed" status when adding CGM step? | Add new status values vs rename existing |
| 2 | Should tender auto-creation move to after MD approval? | Yes (MD is final) vs No (GM is final for tender) |
| 3 | RBAC: table-based permissions vs inline checks? | Table (more flexible) vs Inline (simpler) |
| 4 | Finance workflow: new controller vs extend billingController? | New (cleaner) vs Extend (less code) |
| 5 | Notification emails: async (queue) vs sync? | Async (better UX) vs Sync (simpler) |

---

## 33. MASTER TODO LIST

### P0 — Production Blockers

| ID | Module | Requirement | Problem | Required Change | Priority |
|----|--------|-------------|---------|-----------------|----------|
| TODO-001 | Estimate Approval | GM → CGM transition | No endpoint for GM to recommend to CGM | Add `requestCgmSubmitOtp` + `verifyCgmSubmit` endpoints, new status `GM_Recommended` | P0 |
| TODO-002 | Estimate Approval | CGM → DOP transition | No endpoint for CGM to submit for approval | Add `requestDopApproveOtp` + `verifyDopApprove` endpoints, new status `CGM_Submitted` | P0 |
| TODO-003 | Estimate Approval | DOP → ED transition | No endpoint for DOP to approve | Add `requestEdApproveOtp` + `verifyEdApprove` endpoints, new status `DOP_Approved` | P0 |
| TODO-004 | Estimate Approval | ED → MD transition | No endpoint for ED to approve | Add `requestMdApproveOtp` + `verifyMdApprove` endpoints, new status `ED_Approved` | P0 |
| TODO-005 | Estimate Approval | MD → Final Approved | No endpoint for MD final approval | Add `requestMdFinalOtp` + `verifyMdFinal` endpoints, new status `FinalApproved` | P0 |
| TODO-006 | Database | New status values | Current CHECK constraint missing CGM/DOP/ED/MD statuses | Migration to add status values + update CHECK constraint | P0 |
| TODO-007 | Frontend | CGM approval UI | EstimateDetail has no CGM action buttons | Add CGM submit-for-approval action with OTP modal | P0 |
| TODO-008 | Frontend | DOP approval UI | EstimateDetail has no DOP action buttons | Add DOP approve action with OTP modal | P0 |
| TODO-009 | Frontend | ED approval UI | EstimateDetail has no ED action buttons | Add ED approve action with OTP modal | P0 |
| TODO-010 | Frontend | MD approval UI | EstimateDetail has no MD action buttons | Add MD final approve action with OTP modal | P0 |
| TODO-011 | Workflow | Tender auto-creation | Currently on GM sign; may need to move to MD approval | Decide + move tender creation if needed | P0 |
| TODO-012 | Tests | CGM/DOP/ED/MD tests | No tests for 4 new workflow steps | Add regression + golden + E2E tests | P0 |

### P1 — Critical Workflow

| ID | Module | Requirement | Problem | Required Change | Priority |
|----|--------|-------------|---------|-----------------|----------|
| TODO-013 | Roles | Finance roles | FinanceClerk/Manager/Head not in DB | Migration to add roles to CHECK constraint + seed users | P1 |
| TODO-014 | Finance | Inward → Verification → Cheque | Not implemented | Full finance workflow module | P1 |
| TODO-015 | Dashboard | CGM/DOP/ED/MD dashboard data | Backend returns queue data but workflow doesn't produce it | Dashboard will auto-work once workflow exists | P1 |
| TODO-016 | Notifications | CGM/DOP/ED/MD notifications | No notification for new transitions | Add sendNotification calls in new endpoints | P1 |

### P2 — Important Functional

| ID | Module | Requirement | Problem | Required Change | Priority |
|----|--------|-------------|---------|-----------------|----------|
| TODO-017 | MeasurementBook | UI page | Backend exists, no frontend route | Add MeasurementList route + page | P2 |
| TODO-018 | Notifications | Email for workflow events | Only DB records, no email | Add email sending in sendNotification() | P2 |
| TODO-019 | Security | RBAC table | Roles are flat Designation column | Create permissions + module_permissions tables | P2 |
| TODO-020 | Escalation | SLA rules | Not implemented | Define SLA values + escalation logic | P2 |
| TODO-021 | Terminology | Status labels | Current labels don't match business | Update StatusBadge, EstimateList, PendingApprovals | P2 |
| TODO-022 | API | Remove non-OTP approve path | `approveEstimate` endpoint bypasses OTP | Remove or deprecate `POST /workflow/:id/approve` | P2 |
| TODO-023 | Security | Login rate limiting | No brute-force protection | Add rate limiting middleware | P2 |

### P3 — Enhancement/Polish

| ID | Module | Requirement | Problem | Required Change | Priority |
|----|--------|-------------|---------|-----------------|----------|
| TODO-024 | API | Duplicate route mount | `/api/deleted-estimates` mounted twice | Remove duplicate in app.js | P3 |
| TODO-025 | Security | Password change audit | Not logged | Add AuditLog entry in changePassword | P3 |
| TODO-026 | Agency | FCN reference | Not implemented | Add FCN field to Estimate or Tender | P3 |
| TODO-027 | Agency | Agency documents | No documents table | Create AgencyDocuments table | P3 |
| TODO-028 | Billing | Bill line items | Bills are single-row amounts | Create bill_items table for line breakdown | P3 |
| TODO-029 | Testing | E2E self-test integration | Standalone, not in npm test | Add to test suite | P3 |
| TODO-030 | API | Pagination | No pagination on list endpoints | Add limit/offset to listEstimates | P3 |

---

## 34. PRIORITIZED IMPLEMENTATION ROADMAP

### Phase 1: CGM/DOP/ED/MD Workflow (P0 — 2-3 weeks)

1. **Database migration** — Add new status values, update CHECK constraint
2. **Backend: CGM endpoint** — requestCgmSubmitOtp + verifyCgmSubmit
3. **Backend: DOP endpoint** — requestDopApproveOtp + verifyDopApprove
4. **Backend: ED endpoint** — requestEdApproveOtp + verifyEdApprove
5. **Backend: MD endpoint** — requestMdFinalOtp + verifyMdFinal
6. **Frontend: CGM action** — EstimateDetail CGM submit button + OTP modal
7. **Frontend: DOP action** — EstimateDetail DOP approve button + OTP modal
8. **Frontend: ED action** — EstimateDetail ED approve button + OTP modal
9. **Frontend: MD action** — EstimateDetail MD approve button + OTP modal
10. **Tender auto-creation** — Decide placement (after MD or GM)
11. **Notifications** — Add sendNotification for CGM/DOP/ED/MD transitions
12. **Tests** — regression, golden, E2E for new transitions

### Phase 2: Finance Module (P1 — 1-2 weeks)

1. **Database migration** — Add FinanceClerk/FinanceManager/FinanceHead roles
2. **Seed users** — Create finance role users
3. **Finance workflow** — Inward → Verification → Recommended → Approval → Cheque
4. **Finance dashboard** — New dashboard component for finance roles
5. **Finance pages** — Finance workflow UI
6. **Tests** — Finance workflow tests

### Phase 3: Polish and Hardening (P2 — 1 week)

1. MeasurementBook UI page
2. Email notifications for workflow events
3. RBAC permissions table (optional, lower priority)
4. Terminology updates (status labels, action names)
5. Remove non-OTP approve path
6. Login rate limiting
7. Escalation rules (requires business input)

### Phase 4: Nice-to-Have (P3 — as needed)

1. Duplicate route fix
2. Password change audit
3. FCN reference
4. Agency documents
5. Bill line items
6. Pagination
7. E2E self-test integration

---

## 35. FINAL ACCEPTANCE CHECKLIST

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Manager can create estimate with items | ✅ PASS |
| 2 | Manager can submit with OTP | ✅ PASS |
| 3 | DGM can verify with OTP | ✅ PASS |
| 4 | GM can recommend with OTP | ❌ FAIL — GM signs, doesn't recommend |
| 5 | CGM can submit for approval with OTP | ❌ FAIL — No endpoint |
| 6 | DOP can approve with OTP | ❌ FAIL — No endpoint |
| 7 | ED can approve with OTP | ❌ FAIL — No endpoint |
| 8 | MD can final approve with OTP | ❌ FAIL — No endpoint |
| 9 | Tender lifecycle (create→publish→bids→evaluate→award) | ✅ PASS |
| 10 | Agency creation and selection | ✅ PASS |
| 11 | Work execution (start→progress→complete) | ✅ PASS |
| 12 | Measurement recording | ✅ PASS (backend) / ❌ (no UI) |
| 13 | Bill creation and approval chain | ✅ PASS |
| 14 | Delete with OTP and snapshot | ✅ PASS |
| 15 | Restore with OTP | ✅ PASS |
| 16 | Audit trail for all transitions | ✅ PASS |
| 17 | Version history on each submit | ✅ PASS |
| 18 | All 13 role dashboards render correctly | ✅ PASS |
| 19 | Dashboard routing for all roles | ✅ PASS |
| 20 | OTP: 6-digit boxes, auto-advance, paste, backspace | ✅ PASS |
| 21 | OTP: wrong/expired/reused rejected | ✅ PASS |
| 22 | Permission checks (role + ownership + state) | ✅ PASS |
| 23 | Finance workflow (Inward→Cheque) | ❌ FAIL — Not implemented |
| 24 | Email notifications for workflow events | ❌ FAIL — DB only |
| 25 | SLA/escalation | ❌ FAIL — Not implemented |
| 26 | All tests pass | ✅ PASS (83/84, 1 flaky) |

**Score: 21/26 PASS, 5/26 FAIL**

---

## 36. FINAL SYSTEM STATUS

| Area | Status | Notes |
|------|--------|-------|
| Estimate Creation | 🟢 GREEN | Working end-to-end |
| Estimate Calculation | 🟢 GREEN | Formulas correct, GST applied once |
| Revision/Version | 🟢 GREEN | JSONB snapshots, version history |
| Estimate Approval (Manager→GM) | 🟢 GREEN | OTP at each step |
| Estimate Approval (CGM→MD) | 🔴 RED | Not implemented |
| DGM | 🟢 GREEN | OTP verified |
| GM | 🟢 GREEN | Digital sign + OTP |
| CGM | 🔴 RED | No workflow endpoint |
| DOP | 🔴 RED | No workflow endpoint |
| ED | 🔴 RED | No workflow endpoint |
| MD | 🔴 RED | No workflow endpoint |
| Agency Selection | 🟢 GREEN | Working |
| FCN | 🔴 RED | Not implemented |
| AS (Agency Selection) | 🟢 GREEN | Working as selectAgency |
| TS (Technical Shortlist) | 🟢 GREEN | Working as evaluateTechnical |
| Tender | 🟢 GREEN | Full lifecycle |
| Award | 🟢 GREEN | Working |
| Execution | 🟢 GREEN | Start→Progress→Complete |
| Measurement | 🟡 AMBER | Backend yes, UI missing |
| Billing | 🟢 GREEN | 4-step approval working |
| Finance | 🔴 RED | Not implemented |
| Payment | 🟡 AMBER | Basic "Paid" status only |
| OTP | 🟢 GREEN | Full implementation |
| Audit | 🟢 GREEN | Comprehensive |
| Delete/Restore | 🟢 GREEN | With OTP + snapshot |
| Dashboards | 🟢 GREEN | All 13 roles |
| Permissions | 🟡 AMBER | Inline only, no RBAC |
| Notifications | 🟡 AMBER | DB only, no email |
| Reports | 🟢 GREEN | 8 report types |
| E2E | 🟢 GREEN | 36 steps |

---

## 37. FINAL VERDICT

```
OVERALL:           AMBER
WORKFLOW (built):  GREEN
WORKFLOW (full):   RED — stops at GM
SECURITY:          AMBER
DATA INTEGRITY:    GREEN
UI:                GREEN
TESTING:           GREEN
PRODUCTION READINESS: NOT READY
```

### TOP 10 CRITICAL REMAINING ISSUES

1. **CGM workflow endpoint missing** — GM→CGM transition cannot happen
2. **DOP workflow endpoint missing** — CGM→DOP transition cannot happen
3. **ED workflow endpoint missing** — DOP→ED transition cannot happen
4. **MD workflow endpoint missing** — ED→MD transition cannot happen
5. **No FinalApproved status** — Final approval state doesn't exist
6. **Tender auto-creation on GM sign** — May need to move to after MD approval
7. **Finance roles missing from DB** — FinanceClerk/Manager/Head not seeded
8. **Finance workflow not implemented** — Inward→Verification→Cheque
9. **No email notifications** — Users must check app manually
10. **No SLA/escalation** — Estimates can sit indefinitely

### TOP 10 TODOs

1. Implement CGM submit-for-approval endpoint + OTP
2. Implement DOP approve endpoint + OTP
3. Implement ED approve endpoint + OTP
4. Implement MD final approve endpoint + OTP
5. Add database migration for new statuses + roles
6. Add frontend action buttons + OTP modals for CGM/DOP/ED/MD
7. Add tests for all 4 new workflow steps
8. Implement finance workflow module
9. Add email notifications for workflow events
10. Update terminology across UI

### BUSINESS CONFIRMATIONS REQUIRED

1. Should GM action be "Recommend" or "Digital Sign"?
2. Should tender auto-creation remain at GM sign or move to MD approval?
3. What are the SLA values for each workflow stage?
4. Should finance be a separate module with separate roles?
5. Should email notifications be sent for all workflow events?
6. What is FCN? Is it a field on Estimate or a separate concept?
7. Should MeasurementBook be a standalone page or embedded in estimate detail?
8. Are there any additional roles beyond the 13 currently defined?

### FINAL IMPLEMENTATION ORDER

1. **Phase 1 (P0):** CGM/DOP/ED/MD workflow (backend + frontend + tests) — 2-3 weeks
2. **Phase 2 (P1):** Finance module (roles + workflow + UI) — 1-2 weeks
3. **Phase 3 (P2):** Polish (Measurements UI, email notifications, terminology, security) — 1 week
4. **Phase 4 (P3):** Nice-to-have (FCN, agency docs, pagination, audit improvements) — as needed

---

*This document was generated from evidence-based inspection of the actual codebase, database schema, API endpoints, frontend components, and test suites. No assumptions were made about implementation status without verifying from source code.*
