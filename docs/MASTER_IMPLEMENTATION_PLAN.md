# HMWSSB WMS — Master Implementation Plan

Status: ACTIVE | Version: 1.0 | Date: 2026-09-02

This document is the single source of truth for the HMWSSB Works Management System implementation.

## Canonical Business Workflow

### Estimate Approval
Manager → DGM → GM → CGM → DOP → ED → MD

### Procurement
MD Final Approved → DirectorOfAdministration → FCN → Administrative Sanction → Technical Sanction → Tender → Bid Opening → Technical Evaluation → Financial Evaluation → L1 → Work Award → Work Order → Agreement

### Execution
Agency → Work Start → Progress → Measurement → Completion

### Billing
Billing Officer → Manager → DGM → GM → Finance Clerk → Finance Manager → Finance Head → Cheque

## Role Model (16 roles — frozen)

1. Manager
2. DGM
3. GM
4. CGM
5. DOP
6. ED
7. MD
8. DirectorOfAdministration
9. FinanceClerk
10. FinanceManager
11. FinanceHead
12. TenderOfficer
13. SiteEngineer
14. BillingOfficer
15. Administrator
16. SoRAdmin

## FCN Owner
DirectorOfAdministration (not Finance Head)

## Technical Sanction
Route to exactly one configured competent authority: Director OR GM OR DGM
No financial thresholds

## Runtime
Frontend: http://localhost:5173
Backend API: http://localhost:5001
Database: PostgreSQL 17 on 5432, database `hmwssb`

## Implementation Phases

### Phase 0 — Baseline Audit
Inspect frontend, backend, DB, routes, controllers, services, tests, env, ports

### Phase 1 — Application Foundation
Login, JWT, auth state, role mapping, route guards, API client, CORS, dashboard routing for all 16 roles

### Phase 2 — RBAC
Validate 16 roles × 34 permissions, frontend visibility + backend enforcement

### Phase 3 — Estimate Lifecycle
Full chain Manager→DGM→GM→CGM→DOP→ED→MD with OTP+SLA+audit+notification at every step

### Phase 4 — Procurement Gates
MD→Director→FCN→AS→TS→TenderReady with correct routing and regression tests

### Phase 5 — Tender
T1 foundation → T2 draft → T3 bid → T4 tech eval → T5 fin eval → T6 award

### Phase 6 — Execution
Award → Work Order → Agreement → Start → Progress → Measurement → Completion

### Phase 7 — Billing + Finance
Bill prep → Manager → DGM → GM → Finance Clerk → Finance Manager → Finance Head → Cheque

### Phase 8 — Dashboards
Build from workflow state API, verify KPI===queue count for every role

### Phase 9 — UI/UX Hardening
No dead buttons, compact cards, workstage component, 180° action menu, filters

### Phase 10 — Full Regression E2E
Golden lifecycle test covering entire business flow end-to-end

## Definition of Done (per module)

Database works, API works, RBAC works, Workflow works, OTP works, SLA works, Notifications work, Audit works, Dashboard works, Queue works, Workstage works, Filters work, Buttons work, Validation works, Error handling works, Browser E2E works, Regression tests pass

## Bug Classification

P0 — Business-breaking (fix immediately)
P1 — Workflow-breaking (fix before new feature)
P2 — Functional (fix before release)
P3 — UI (fix during hardening)

## Agent Implementation Order

1. Inspect
2. Map current implementation
3. Identify mismatch
4. Produce impact list
5. Modify backend/domain first
6. Modify frontend
7. Add migration if needed
8. Add/modify tests
9. Run existing tests
10. Run new tests
11. Run browser E2E
12. Inspect runtime
13. Report changed files
14. Report remaining risks
