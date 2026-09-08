# Phase 2 — Officer Functional & Workflow Completion: GAP MATRIX

Date: 2026-09-04
Status: ACTIVE
Phase 1 certified complete: 60/60 runtime, 307/307 regression, frontend build.

Canonical internal lifecycle (estimate-status based, test-locked by golden/procurement/regression suites):

```
Estimate:  Draft → Submitted → DGM_Approved → GM_Recommended → CGM_Submitted → DOP_Approved → ED_Approved → FinalApproved
Procurement: FinalApproved → FCNGenerated → AdminSanctionGenerated → TSPending → TSApproved → TenderPublished → TenderClosed → TechnicalEvaluation → FinancialEvaluation → L1Identified → WorkAwarded → WorkOrderIssued → AgreementExecuted
Execution:  AgencySelected → WorkStarted → WorkCompleted → Billing → Completed
```

T3 Tender-Status pipeline (tender admin; separate table Tender.Status):
```
Draft → TenderDraft → Published → BidsClosed → BidOpeningInProgress → TechnicalEvaluationPending → TechnicalEvaluation → FinancialEvaluation → Awarded
```

NOTE: Two state machines coexist. The estimate-status machine is the canonical
business lifecycle owners/routing (test-locked). The Tender.Status machine drives
tender admin + bid submission + opening/eval on the Tender row. The execution
chain is entered via selectAgency → AgencySelected (estimate-status).

---

## STEP 2 — GAP MATRIX

| # | Feature | Current State | Expected State | Gap | Sev | Files | Required Fix |
|---|---------|---------------|----------------|-----|-----|-------|--------------|
| G01 | close-tender endpoint RBAC | Only `authenticate`; no role guard | TenderOfficer only | Any authed user can close a tender | **P0** | routes/workflow.js:37 | Add requireRole('TenderOfficer') |
| G02 | technical-eval endpoint RBAC | Only `authenticate`; no role guard | DirectorOfAdministration | Any authed user can start tech eval | **P0** | routes/workflow.js:38 | Add requireRole('DirectorOfAdministration') |
| G03 | financial-eval endpoint RBAC | Only `authenticate`; no role guard | DirectorOfAdministration | Any authed user | **P0** | routes/workflow.js:39 | Add requireRole |
| G04 | identify-l1 endpoint RBAC | Only `authenticate` | DirectorOfAdministration | Any authed user | **P0** | routes/workflow.js:40 | Add requireRole |
| G05 | create-award endpoint RBAC | Only `authenticate` | DirectorOfAdministration | Any authed user | **P0** | routes/workflow.js:41 | Add requireRole |
| G06 | issue-work-order endpoint RBAC | Only `authenticate` | DirectorOfAdministration | Any authed user | **P0** | routes/workflow.js:42 | Add requireRole |
| G07 | record-agreement endpoint RBAC | Only `authenticate` | DirectorOfAdministration | Any authed user | **P0** | routes/workflow.js:43 | Add requireRole |
| G08 | reviewForwardGm SLA start | `startSla(estimateId,'DGMReview')` wrong arg order (signature `(module,stage,recordId,table)`) | Correct SLA start | SLA silently never starts for GMReview | **P0** | workflowController.js:2099 | Fix arg order to (module,stage,recordId,table) |
| G09 | AS notification | generateAdminSanction emits no sendNotification | Notify next owner after AS | No notification on sanction | **P1** | workflowController.js:1737-1799 | Add sendNotification |
| G10 | TenderOfficer dashboard "Bids Open" KPI | Queries `Status='BidSubmissionOpen'` which is never persisted (effective-only) | Count live bid window or drop phantom | Always-0 KPI + dead button | **P1** | dashboardController.js:396 | Use effective/published window query |
| G11 | TS return notification | returnTs no notification | Notify assignment actor | Silent return | **P2** | workflowController.js:2014 | Add notification |
| G12 | Execution SLA | WORKFLOW_SLA_MAP has AgencySelection/WorkStart/WorkComplete but startWork/completeWork/selectAgency never call startSla | SLA on execution stages | No SLA tracking in execution | **P1** | workflowController.js startWork:1402 completeWork:1481 selectAgency:1344 | Add startSla calls |
| G13 | Finance SLA map | Finance SLA start/stop exist but no WORKFLOW_SLA_MAP entries | SLA checker cover finance | Checker can't resolve finance stages | **P2** | sla.js:20-38 | Add finance stages to map |
| G14 | Bid Opening "Ready for Tech Eval" bridge | completeBidOpening sets Tender.Status='TechnicalEvaluationPending' but no estimate-status advance | Determined | Two-state-machine bridge is unknown/ambiguous | P1 | bidController.js:417 | Decision: bridge or document that tender-admin and estimate pipeline are separate |
| G15 | Measurement N/L/B/D + rates | MeasurementBook lacks dimensional columns; calcQty not integrated; no rate/amount | Dimensional measurement + calc | Big feature gap | P2 | 021_measurement_book.sql, measurementController.js | Extend (deferred — decision needed) |

---

## STEP 2 — DECISIONS (canonical, not to be re-litigated)

1. FCN owner = DirectorOfAdministration. Verified PRESENT.
2. TS competent authority = one of Director/GM/DGM (backend-inline validated, no config table). PRESENT; config table optional.
3. Evaluation authority = DirectorOfAdministration (test-locked: procurement.test uses directorToken for technical-eval/financial-eval/identify-l1/create-award/issue-work-order/record-agreement). TenderOfficer owns close-tender + bid opening.
4. No invented thresholds.
5. ProcurementOfficer does not exist.
6. G09 (AS notification) — NOT A GAP: generateAdminSanction keeps the Director as current owner (only moves status → AdminSanctionGenerated); no owner handoff, so no notification is warranted. Listed as P1 in the matrix by mistake; struck here.

## STEP 3+ — APPLIED FIXES (verified)
- G01-G07: RBAC requireRole guards in routes/workflow.js (close-tender→TenderOfficer, others→DirectorOfAdministration). Verified in runtime-audit (60→67 checks, all pass).
- G08: reviewForwardGm `startSla(estimateId,'DGMReview')` wrong arg-order → `startSla('Estimate','DirectorAdmin',estimateId,'EstimateHeader')` (matches module:stage convention of sibling handlers; the review window is within DirectorAdmin supervision before TS).
- G10: TenderOfficer `bidOpen` KPI counted raw `Status='BidSubmissionOpen'` (never persisted) → now counts persisted `Status IN ('Published','BidSubmissionOpen')` (live windows post-persistExpiry). Frontend Bids Open/Closing Soon drill-down links point to `?status=Published`.
- Regression: 307/307 pass; frontend build clean; runtime-audit 67/67.

Deferred / documented:
- G11, G12, G13, G14, G15 (see report)

## BACKLOG (production hardening — NOT Phase 2)
- F7 httpOnly JWT cookie (high, before prod)
- F10 silent 401 re-auth (medium, before prod)
- F11 JWT secret rotation (before any real prod deploy)
