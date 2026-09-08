# T4 Tender Pipeline Hardening — Acceptance Report & Gap Matrix

Date: 2026-09-06 | Status: Complete | Tests: 310/310 pass (47 suites)

Supersedes the gaps listed in `T3_ACCEPTANCE_REPORT.md` §12: technical evaluation,
financial evaluation, L1 shortlisting, award, and work order / agreement are now
implemented. Bid opening ownership is reversed (TenderOfficer, not Director).

## 1. Scope & Deliverables

**Implemented:**
- Canonical ownership restored: **TenderOfficer** drives bid opening
  (`bid.open`); Director keeps read-only `bid.view` and enters only at award.
- Hardened status machine (see §2) with 6 new `Tender.Status` values.
- Technical evaluation (per-bid `Qualified`/`Disqualified`, actor + timestamp).
- Financial evaluation (server ranking of Qualified bids, `Rank` persisted).
- L1 identification: persisted in new `TenderEvaluation` table (selected bid +
  full ranking snapshot + methodology); no duplicate/overwrite race.
- Director award (hard role gate + L1 consistency check 400 on mismatch),
  agency record created at award, rejected bidders marked.
- Work order issue + agreement recording with mandatory reference numbers.
- SLA wiring: evaluation stages → `SlaDefinition('TenderEvaluation')`; award
  stages → `SlaDefinition('Award')`. Root-cause fix in `sla.stopSla` that made
  SLA always stay `Normal` (see §9).
- RBAC via DB `RolePermission` (runtime source of truth) + static map aligned.
- Dashboards: Tender Officer pipeline queue/KPIs (counted from the same rows
  that render the queue — KPI can never disagree with its queue); Director
  tender award pipeline queue + 4 award KPIs.
- Client: TenderDetail evaluation/L1/award/work-order/agreement panels driven
  by server `capabilities`; StatusBadge colors for all new statuses.
- Tests: `tenderpipeline.test.js` (full positive pipeline + ~15 negatives +
  KPI==queue); t3/golden suites updated to canonical ownership.

**NOT implemented (deliberate, out of scope):**
- Bidder self-service portal (bids remain officer-managed).
- Bidder financial-score normalization / non-price criteria (`Methodology`
  column exists and is stored as `L1_LOWEST_BID`; scoring weights are future).
- Agreement upload/attachment workflow (reference number only).
- Award escalation (SLA is tracked and stops; no `EscalationRule` for `Award`).

## 2. Status Flow (canonical)

```
TenderDraft → Published → BidSubmissionOpen → BidsClosed
  → BidOpeningInProgress → TechnicalEvaluationPending
  → UnderTechnicalEvaluation → FinancialEvaluationPending
  → FinancialEvaluation → L1Identified
  → WorkAwarded → WorkOrderIssued → AgreementExecuted
```

6 statuses added in `041_tender_pipeline_hardening.sql`: `UnderTechnicalEvaluation`,
`FinancialEvaluationPending`, `L1Identified`, `WorkAwarded`, `WorkOrderIssued`,
`AgreementExecuted`.

## 3. Owner × Stage

| Stage | Actor | Evidence |
|-------|-------|----------|
| Publish / config | TenderOfficer | `tender.publish` |
| Bid submission | contractors (officer-submitted) | `bid.submit` |
| Bid opening | **TenderOfficer** | `bid.open` (Director 403) |
| Technical evaluation | TenderOfficer | `tender.evaluate` |
| Financial evaluation | TenderOfficer | `tender.evaluate` |
| L1 identification | TenderOfficer (server-computed) | `tender.evaluate` |
| Award | DirectorOfAdministration | `tender.award` |
| Work order | DirectorOfAdministration | `tender.workOrder` |
| Agreement | DirectorOfAdministration | `tender.agreement` |

## 4. Database Schema (041)

- `Bid_TechnicalStatus_check` → `('Pending','Eligible','Rejected','Qualified','Disqualified')`.
- `Bid` += `TechnicalEvaluatedBy/At`, `FinancialRemarks`, `FinancialEvaluatedBy/At`.
- `TenderEvaluation`: TenderID (UNIQUE, FK CASCADE), Methodology, Ranking (JSONB),
  SelectedBidID (FK Bid), IdentifiedAt/By.
- `Tender` += action columns: TechnicalEvaluationStartedAt/By, FinancialEvaluationAt/By,
  AwardedAt/By, WorkOrderIssuedAt/By, WorkOrderNo, AgreementExecutedAt/By, AgreementNo.
- `042_director_tender_view.sql`: Director grants `tender.view` so its award
  queue can actually open the tender records (list + detail are
  `requirePermission('tender.view')`).

## 5. API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/bids/tender/:id/evaluate/technical` | `tender.evaluate` | Batch per-bid Qualify/Disqualify |
| POST | `/api/bids/tender/:id/evaluate/financial` | `tender.evaluate` | Rank qualified bids |
| POST | `/api/bids/tender/:id/l1` | `tender.evaluate` | Persist L1 + ranking snapshot |
| POST | `/api/bids/tender/:id/award` | `tender.award` | Director award (L1 consistency) |
| POST | `/api/bids/tender/:id/work-order` | `tender.workOrder` | Issue work order |
| POST | `/api/bids/tender/:id/agreement` | `tender.agreement` | Record agreement |

Guards: wrong state → 409; missing permission → 403; missing reference (WO/Agreement
No) → 400; award bid ≠ persisted L1 → 400.

## 6. Security & Atomicity

- Every action uses a conditional `UPDATE ... WHERE "Status" = <expected>`, so
  a double-click / concurrent request gets one winner and 409 for the loser.
- L1 is computed and upserted server-side from the persisted ranked view —
  a client cannot name its own L1. Award must match `TenderEvaluation.SelectedBidID`.
- Financial amounts stay masked for non-`bid.view` callers (unchanged mask).
- Audit actions: TECHNICAL_EVALUATION (STARTED/COMPLETED), FINANCIAL_EVALUATION,
  L1_IDENTIFIED, AWARD_TENDER, WORK_ORDER_ISSUED, AGREEMENT_EXECUTED, plus close/open
  notifications target the tender's `CurrentOwner` (TenderOfficer).

## 7. Frontend

| File | Purpose |
|------|---------|
| `TenderDetail.jsx` | Evaluation panel (per-bid Qualify/Disqualify, ranked table, L1 banner), Director Award / Work Order / Agreement panels, Post-Award ribbon — all driven by server `capabilities` |
| `TenderOfficerDashboard.jsx` | Pipeline queue + 11 stage KPIs (inPipeline includes all published-and-later tenders) |
| `DirectorDashboard.jsx` | Award pipeline section (Awards Pending / Work Orders Pending / Agreements Pending / Agreements Executed + action queue) |
| `StatusBadge.jsx` | Colors for UnderTechnicalEvaluation, FinancialEvaluationPending, L1Identified, WorkAwarded, WorkOrderIssued, AgreementExecuted |

## 8. Testing

| Suite | Result | Notes |
|-------|--------|-------|
| `tenderpipeline.test.js` | pass 2/2 | Full pipeline happy path + ~15 negatives + dashboard KPI==queue |
| `t3.test.js` + `golden.test.js` | pass 71/71 | Canonical ownership (Director 403 on open), golden now uses `/l1` + Director award |
| Full regression | **310/310, 47 suites, 0 fail** | Re-run after 042 to confirm no collateral |

Playwright (browser-level, needs live dev servers + fresh fixture):
`tests/e2e/03-tender-bid.spec.js` now checks Director bid-open 403 in UI + API and
drives opening/eval/L1 as the TenderOfficer; new `tests/e2e/10-award-pipeline.spec.js`
covers Director award → work order → agreement → dashboard. Sequential run order:
`setup-t2.cjs` → `setup-t3.cjs` → `03-tender-bid.spec.js` → `10-award-pipeline.spec.js`.
Not executed in this session (API server down; fixture state non-deterministic).

## 9. Key Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| SLA never resolved (stayed `Normal`) | `stopSla` destructured `{ tbl, col }` but `MODULE_TABLES` stores the key `table` → silent no-op | `const { table: tbl, col } = entry \|\| {};` |
| Director cannot open award records | DB `RolePermission` (runtime source) lacked `tender.view` for Director — static map alone wasn't enough | Migration 042 grants it (`ON CONFLICT DO NOTHING`) |
| FK violation on test cleanup | `TenderEvaluation.SelectedBidID` → `Bid` | Cleanup deletes `TenderEvaluation` before `Bid` |

## 10. Gap Matrix (was-open → now-closed)

| T3 gap (was out of scope) | Status | Where |
|---------------------------|--------|-------|
| Technical evaluation | ✅ Closed | `evaluateTechnical` + Bid columns |
| Financial evaluation | ✅ Closed | `evaluateFinancial` + Rank |
| L1 shortlisting | ✅ Closed | `TenderEvaluation` table |
| Award decision | ✅ Closed | `awardTender` (Director-gated) |
| Work order | ✅ Closed | `issueWorkOrder` |
| Agreement | ✅ Closed | `recordAgreement` |
| Bid opening ownership (needed PO) | ✅ Reversed | `bid.open` → TenderOfficer (041) |

## 11. Deployment

- Run migrations: `npm run migrate` (041 + 042).
- Restart API server (running instance serves pre-041/042 code).
- Client: `npm run build` (or vite dev HMR picks up source).
- No new npm dependencies.