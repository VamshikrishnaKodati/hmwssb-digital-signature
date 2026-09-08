# Phase 2 — Officer Data-Flow Audit

Date: 2026-09-06
Status: COMPLETE (slice 1: officer data-flow + orphaned owner reconciliation)

Goal: verify the officer-facing business data flow end-to-end (KPIs → queues →
dashboards → filters/search → drilldown → actions → backend state) against the
frozen contract, and repair any orphaned workflow state left behind by Phase 1
role removal.

## 1. Data-flow audit (spec `tests/e2e/08-officer-data-flow.spec.js`, 4 tests)

Verified facts, all green:

- **KPI rule holds**: DGM "Pending Review" card count (5) == logical queue rows
  (5) == drilldown list rows (5). Selector: `table tbody tr[id^="est-row-"]`
  (desktop rows only; the mobile layout re-renders the same `est-row-*` ids, so
  counts must target the desktop table).
- **Filters reach the backend**: `/estimates/my` receives `status=`,
  `assignedTo=`, `search=` and filters server-side; the client never filters in
  memory.
- **Search** fires on Enter / the Search button; there is no debounce.
- **Direct URL + browser refresh** works (client hydrates from backend, no
  stale-state).
- **Detail drilldown** works via the dashboard queue. `EstimateList` rows are
  NOT clickable — navigation is the kebab actions menu only.

## 2. Orphaned owner reconciliation

### Finding
Exactly 4 in-flight records were still owned by the removed ProcurementOfficer
(UserID 6, now `IsActive=false`) after migration 038:

| EstimateID | EstimateNo | Status | CurrentOwner | Tender |
|-----------|-----------|--------|--------------|--------|
| 1246 | … | TenderPublished | 6 (PO) | none (legacy status-carry) |
| 1420 | … | TenderPublished | 6 (PO) | 467 (TStatus Awarded, eTNO/2026-27/0001) |
| 1496 | … | TenderPublished | 6 (PO) | none (legacy status-carry) |
| 1506 | … | TenderPublished | 6 (PO) | none (legacy status-carry) |

### Root cause
Migration 038 removed the ProcurementOfficer role and rewrote historical refs,
but did not re-point **in-flight** TenderPublished records. Their canonical next
action (`selectAgency`) is the Director's, so they were stranded in the removed
role's ownership.

### Decision (canonical routing, per contract)
`workflowController.publishTender` sets the owner to DirectorOfAdministration at
TenderPublished; `selectAgency` is a Director action. All 4 records →
DirectorOfAdministration (UserID 17, director_admin, Dr. Priya Nair).

### Fix — migration 039 (`db/migrations/039_reassign_orphaned_tender_owners.sql`)
Applied via `node db/migrate.mjs` (tracked in `_migrations`). Guarded UPDATE
inside a DO block (`CurrentOwner=6 AND Status='TenderPublished' AND EstimateID
IN (1246,1420,1496,1506)`), RAISE WARNING if rowcount ≠ 4. The edit-guard
trigger `trg_block_in_place_edit` (migration 029) is temporarily DISABLED and
re-enabled inside the same transaction because it blocks non-status/SLA changes
on non-Draft rows; `publishTender` normally bypasses it by changing Status.

### After-state (verified)
- Exactly 4 rows now CurrentOwner 17. 0 EstimateHeader rows and 0 Tender rows
  owned by ProcurementOfficer remain.
- Trigger re-enabled (`tgenabled='O'`). PO user still `IsActive=false`.
- Remaining PO references are all historical: Workflow 164, AuditLog 130,
  CreatedBy/LastModifiedBy 0. No invalid active references.

### Workflow / API validation (director_admin login)
- Director queue `GET /api/estimates/my?status=TenderPublished&assignedTo=me` = 4 rows.
- `POST /api/workflow/1246/select-agency` → 200 "Agency selected. Forwarded to
  Site Engineer." 1246 → AgencySelected, owner 7 (site_engineer); Workflow row
  (SelectAgency → ToUserID 7), AuditLog row, and Notification (ToUserID 7)
  created. Repeat call → 403 "You are not the current owner".

### UI surfacing
The Director dashboard previously had *no* agency-selection surface (the queue
was unreachable in the UI). Added `agencySelection` to `directorAdminDashboard`
(dashboardController.js) and an "Agency Selection — Pending" section
(`data-testid="agency-selection-queue"`) in DirectorDashboard.jsx with
"Open to select" links. Permanent spec `tests/e2e/09-director-agency-selection.spec.js`
covers section presence, badge ("Tender Publication"), and drilldown.

### Regression
- Server tests: 307/307.
- e2e regression (01/06/07): 38/38.
- New specs 08 + 09: 5/5.
- Client build: pass.

### Current state
Director TenderPublished queue = 1420, 1496, 1506 (reconciled) + 3960
(pre-existing, eTNO/2026-27/0014). 1246 is now AgencySelected / SiteEngineer.

## 3. Tender type-modeling — inert configuration foundation (Migration 040)

### Decision (locked, per user)
**Option 1 only — config keys, fully inert.** This addresses the tender
type-modeling gap without touching any working tender behavior.

Explicitly NOT done (scope boundary): no Tender table columns, no TenderForm /
DRAFT_FIELD_COLS changes, no workflow / evaluation-logic / NIT-PDF / bidder-portal
changes, no NEGOTIATED, no RFP, no invented procurement methods.

### What Migration 040 seeds (`db/migrations/040_tender_type_modeling_config.sql`)
Added to the existing `TenderConfig` table (same mechanism as migration 036),
as separate, named option lists — never merged into one field:

| ConfigKey | Values (conservative, standard vocabulary) |
|-----------|---------------------------------------------|
| `procurementMethod`        | Open Tender, Limited Tender |
| `electronicChannel`        | E-Procurement, Offline |
| `participationMode`        | Open, Limited |
| `evaluationCriteriaPreset` | Pass/Fail (Technical), L1 Lowest Bid, Composite Scoring |

These keys are reference/configuration metadata only. **No current code reads
them** — they are inert until a future, deliberately-scoped Tender/Bid
implementation (Option 2/3) decides columns, form, persistence, detail, NIT,
bidder participation, and evaluation methodology against this stable vocabulary.

### Verification
- Migration applied cleanly via `node db/migrate.mjs` (tracked in `_migrations`).
- Configuration persisted: `GET /api/tender/config` (TenderOfficer) returns all
  four new keys alongside the pre-existing five; no key lost or altered.
- Server regression: 307/307 pass (no behavior change).
- Client build: pass.
- No existing tender/estimate behavior changed (data-only migration).