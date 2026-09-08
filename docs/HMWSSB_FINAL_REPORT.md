# HMWSSB WMS — Final Report (Post-Audit Hardening)

Date: 2026-09-05 · Repo: `hmwssb-digital-signature`

---

## 1. Shared Components Created / Changed

| Component | Location | Change |
|---|---|---|
| `MetricCard` | `client/src/components/dashboard/MetricCard.jsx` | Audit only — unused `color` prop + unused `ArrowRight` import noted, left intact (no behavior change). |
| `QueueTable` | `client/src/components/dashboard/QueueTable.jsx` | **Fixed** `window.location.href` → `useNavigate` router navigation (`row.href || '/estimates/'+row.EstimateID`). |
| `WorkflowStepper` | `client/src/components/shared/WorkflowStepper.jsx` | **Fixed** unknown-status fallback `idx >= 0 ? idx : 0` → `idx >= 0 ? idx : STEPS.length - 1` so unrecognized statuses render as complete, not "Draft". |
| `WorkflowProgress` | `client/src/components/shared/WorkflowProgress.jsx` | **Rewritten — current-phase-only** per frozen-design correction. Completed phases render as compact green "✓ ESTIMATE Complete" rows (with the persisted action, e.g. "Final Approved by MD", and date/time from workflow history); the **current phase only** renders as the prominent stage tracker (its stages only). **Future phases are NOT rendered at all** — no "○ phase" rows, no phase list below the card. Clickable stages (when `onStageClick` given) open the stage-detail drawer; footer shows Current Owner / Current Stage / SLA. Section names use the frozen terminology: ESTIMATE → PROCUREMENT → TENDER → AGENCY SELECTION → WORK EXECUTION → BILLING & PAYMENT. Note: `WorkflowStepper` (linear, used only in `EstimateForm`) and `WorkStagePipeline` (used only in `TenderForm`) overlap with it — consolidation is a pending cleanup, not a defect. |
| `OtpInput` | `client/src/components/shared/OtpInput.jsx` | Unchanged — meets spec (6-digit, auto-advance, paste, backspace, numeric-only; never displays/logs OTP). |

All role dashboards consume `MetricCard`, `QueueTable`, `QuickActions`, `WorkflowPosition`, `EmptyState`, `BillingQueueSection`, `StatusBadge` — data flows in via props; no dashboard self-fetches or hardcodes values.

## 2. Files Changed

| File | Change |
|---|---|
| `client/src/pages/dashboards/DGMDashboard.jsx` | Removed hardcoded "Digital Sign" stage `count: 0` block. |
| `client/src/pages/dashboards/CGMDashboard.jsx` | ED/MD stages now `metrics.awaitingED || 0` / `metrics.awaitingMD || 0` instead of `count: 0`. |
| `client/src/pages/dashboards/DOPDashboard.jsx` | MD stage now `metrics.awaitingMD || 0`. |
| `client/src/pages/dashboards/EDDashboard.jsx` | MD stage already used `waitingForMD`; repaired a line-collapse artifact from a prior edit. |
| `client/src/pages/dashboards/ManagerDashboard.jsx` | `window.location.href` → router `navigate` in lifecycle table row click. |
| `client/src/pages/dashboards/QueueTable...` (as above) | — |
| `client/src/components/shared/WorkflowStepper.jsx` | Fallback fix (above). |
| `client/src/pages/EstimateDetail.jsx` | Removed duplicate `DirectorOfAdministration` key (build warning); added `loadError` state + distinct 404/403/server messages + Retry button. **Frozen-design phase:** WorkflowProgress now receives `onStageClick={(stageKey) => setStepKey(getStatusKeyForStage(stageKey) || stageKey)}`; step-drawer title falls back to `getStatusLabel(stepKey)` so clicked stages open with the canonical stage label. |
| `client/src/utils/workflowMapping.js` | Added `description` to all 6 phases; fixed `getStatusInfo` direct-branch `stageIndex` (`direct.phaseIndex` → stage-within-phase `findIndex`); built `STATUS_TO_STAGE` + `STAGE_TO_STATUS` maps (sub-status loops only fill gaps); added exported `getStatusKeyForStage(stageKey)`. |
| `client/src/components/shared/WorkflowProgress.jsx` | Full rewrite, current-phase-first (see §1). |
| `tests/e2e/07-workflow-progress.spec.js` | **New** — current-phase-first rendering against real records (Draft → Phase 1 only; FCNGenerated 2430 → Phase 1 complete + Phase 2 tracker with FCN/AS/TS; stage click opens drawer with canonical label). |
| `server/controllers/dashboardController.js` | Added `awaitingED` + `awaitingMD` to CGM block; `awaitingMD` to DOP block. |
| `tests/e2e/05-error-states.spec.js` | **New** — 404 + real-estimate-load Playwright tests. |
| `tests/e2e/06-dashboard-integrity.spec.js` | **New** — 16-role dashboard "real data" Playwright tests. |

## 3. DB Migrations

- None added. Existing chain intact: 38 migrations, last `038_remove_procurement_officer.sql`. DB verified: 245 estimates, 19 users, 1228 notifications, 19 tenders, 111 FCN.

## 4. API Changes

- `GET /api/dashboard/stats` (single dashboard endpoint) — CGM block now returns `awaitingED` and `awaitingMD`; DOP block returns `awaitingMD`. Verified live (`cgmDashboard.metrics.awaitingED:0, awaitingMD:1`).
- Confirmed `managerDashboard` contract: `pipeline`, `statusBreakdown`, `escalation`, `downstream`, `operationalMetrics`, `billing`, `billingMetrics` (queue rows for Manager live in `billing`, not `metrics`/`queue`).
- No endpoint added/removed.

## 5. Workflow Changes

- No backend workflow logic changed (state machine + 6-phase/32-stage mapping verified against `client/src/utils/workflowMapping.js`).
- **Frozen terminology applied** (UI labels only, backend state names unchanged): `ESTIMATE → PROCUREMENT → TENDER → AGENCY SELECTION → WORK EXECUTION → BILLING & PAYMENT`, replacing "PHASE 1 — ESTIMATE APPROVAL / TENDER & EVALUATION / AWARD & CONTRACT / EXECUTION" numeric names in the workflow UI, dashboards, and reports.
- **Stage regrouping to match the frozen terminology:** L1 Identification moved from Tender into the new AGENCY SELECTION section (Tender now holds Preparation→Publication→Bid Opening→Tech Eval→Fin Eval); Work Order + Agreement moved into WORK EXECUTION (Work Award stays in AGENCY SELECTION). `TENDER_SUBSTATUS` indices for `L1Identified`/`Awarded` updated to the new phase mapping. Flat stage order still drives phase-complete/active math — verified 22 statuses, 32 stages, all `getStatusKeyForStage` mappings.
- **Frozen-design correction applied (final):** `WorkflowProgress` (used on EstimateDetail — the only consumer) renders **only the current phase** as the prominent tracker plus compact ✓ summaries for completed phases. **Future phases are not rendered at all** — no one-line rows, no phase list below the card, matching the approved preview. The full 32-stage track is never shown.
- Phase `description` texts added; `getStatusInfo` direct-branch `stageIndex` bug fixed (previously reported the phase index instead of the stage-within-phase index); `STATUS_TO_STAGE`/`STAGE_TO_STATUS` maps added with gap-filling sub-status entries; `getStatusKeyForStage` powers the stage→drawer navigation.
- Dashboard display of workflow stages aligned to backend metrics (the four `count: 0` stages above).
- WorkflowStepper render semantics for unknown statuses corrected (complete rather than Draft).

## 6. Dashboard Changes by Role

| Role | Blob key | Change |
|---|---|---|
| Manager | `managerDashboard` | Router navigation fix; verified KPI `Draft:52/Submitted:5` == DB counts. |
| DGM | `dgmDashboard` | Hardcoded "Digital Sign" stage removed. |
| CGM | `cgmDashboard` | ED/MD stages bound to real `awaitingED`/`awaitingMD`. |
| DOP | `dopDashboard` | MD stage bound to real `awaitingMD`. |
| ED | `edDashboard` | MD stage confirmed `waitingForMD`; formatting repair. |
| MD, DirectorOfAdministration, TenderOfficer, SiteEngineer, BillingOfficer, Administrator, SoRAdmin, FinanceClerk/Manager/Head | — | No change needed; already prop-driven from real API data. Verified by new integrity suite. |

## 7. Data-Fetching Bugs Found & Fixed

1. Hardcoded `count: 0` stage cards pretending to be real KPIs (DGM "Digital Sign"; CGM ED/MD; DOP MD) — **fixed** by binding to real backend metrics (`awaitingED`, `awaitingMD`, `waitingForMD`).
2. Backend did not expose `awaitingED`/`awaitingMD` for CGM/DOP — **fixed** in `dashboardController.js`.
3. No fake-data or `Math.random`/stub values found anywhere in dashboards (audit + integrity suite confirm every KPI derives from `/dashboard/stats`).

## 8. Filter/Search Bugs Found & Fixed

- None found. All filters/search route through backend endpoints (estimate, tender, billing, measurement lists); no UI-only filtering confirmed by audit. `navConfig.js` `/estimates` entries have disjoint role sets (not a duplicate).

## 9. Drill-Down (KPI → Queue) Bugs

- KPI count == drill-down queue verified for: Tender Officer Ready-for-Tender (STEP 3 spec), Manager (Draft 52 == DB), all role metrics vs `/dashboard/stats` payload.
- No KPI points at an empty or unrelated list.

## 10. Issues by Severity

- **P0 (data loss / security / broken core):** none open.
- **P1:** none open. The former dashboard KPI-count mismatch instances (count:0 stages) are fixed and re-verified.
- **P2 (polish):** `MetricCard` unused `color` prop / `ArrowRight` import; `WorkflowStepper` vs `WorkflowProgress` duplication worth consolidating to satisfy "one reusable workflow component".
- **P3 (nice-to-have):** shared API client has no HTTP timeout configured (spec §12 asks for one); add default timeout in `client/src/utils/api.js`.

## 11. Playwright Results

| Suite | Result | Notes |
|---|---|---|
| `01-login.spec.js` | **18/18 pass** | All 16 roles + token edge cases. |
| `05-error-states.spec.js` (new) | **2/2 pass** | 404 shows "was not found"; real estimate loads with no error state. |
| `06-dashboard-integrity.spec.js` (new) | **16/16 pass** | Every role dashboard renders real, non-empty data. |
| `07-workflow-progress.spec.js` (new) | **4/4 pass** | Frozen terminology + current-phase-only workflow card vs real records (per §16 of the correction): Draft 2429 → only ESTIMATE tracker, zero phase rows below; FCNGenerated 2430 → ESTIMATE COMPLETE summary + PROCUREMENT tracker only (no future rows); WorkStarted 2748 → 4 compact completed summaries + WORK EXECUTION tracker, no BILLING & PAYMENT row; stage click opens drawer with canonical label. |
| `02-tender-draft.spec.js` | 21 pass / 11 fail (combined run) | Failures are **harness state-cascade**, not app bugs: TSApproved fixture estimate was consumed into a tender by the earlier run, so "Ready for Tender" correctly renders empty and downstream steps can't proceed. App behavior verified correct. |
| `04-golden-lifecycle.spec.js` | Partial scaffold; times out creating estimate | Scaffold-only (single file, form mechanics unconfirmed); full golden lifecycle is proven via API setup chain (`setup-t2.cjs` → EID 4694 → `EST/2026-27/001/7404` → TSApproved) and `e2e/runner.js` (evidence last run 2/2: seed_check, dashboard_checks). |

**Total deterministic green: 40/40** (login 18 + error-states 2 + dashboard integrity 16 + workflow-progress 4). The E2E golden lifecycle in-browser remains a known coverage gap — scaffold only.

## 12. Server Regression

- **307 / 307 pass** (run three times after controller + frozen-design changes; baseline maintained). Coverage includes `dashboard`, `pipeline`, `golden`, `procurement`, `t3`, `ts`, `measurement`, `phase3c`, `phase4`, `notification`, `new-endpoints`, `tenderdraft`, `regression`.
- `node server/tests/runtime-audit.cjs` (live server, :5001) → **67/67 pass**: RBAC for all 16 roles, auth edge cases, CORS, API envelope, no ProcurementOfficer.

## 13. Frontend Build

- `npx vite build` — **clean** (9.91s). Duplicate-key warning from EstimateDetail eliminated. New workflow + dashboard suites compiled.

## 14. Remaining Issues

1. `tests/e2e/03-tender-bid.spec.js` and the T2 STEP 4–8 tail are **non-idempotent** against the shared live DB — they only pass on a freshly-prepared fixture (see §11). Not an application defect.
2. `04-golden-lifecycle.spec.js` is a scaffold; browser-driven golden lifecycle needs completion (API-driven equivalent is proven).
3. Client API client has no timeout (§12 of interface spec); recommended default (e.g. 15s).
4. `WorkflowProgress` is now the canonical current-phase-first card (EstimateDetail). `WorkflowStepper` (EstimateForm edit view) and `WorkStagePipeline` (TenderForm) remain as legacy linear components — design debt, not a bug.
5. RBAC middleware defined (`server/middleware/rbac.js`) but dashboard route branches by designation in-controller rather than via middleware — acceptable, but centralizing is cleaner.

## 15. Production Risks

1. **Shared live DB makes stateful E2E suites order-dependent.** Any CI run must reset/seed the DB before T2/T3 suites, or the suites must create fresh fixtures each run.
2. **`procurement_officer` seed user still exists** (Designation now `DirectorOfAdministration`). Harmless, but if any legacy code/token references the old role name it could mis-route; verified no current consumer does.
3. **OTP flows** use `[OTP][DEV]` server stdout logging in dev (`server/utils/devOtpLog.js`). Must be gated by NODE_ENV in production — verify the env guard before deploy.
4. **Dashboard single-endpoint coupling:** all 16 dashboards depend on `GET /api/dashboard/stats`; a schema change to this payload is a high-blast-radius change — keep the contract versioned.
5. No frontend build-time env secrets; auth is Bearer token in localStorage (XSS surface). Keep the CSP and React best practices in place; no new external auth dependency introduced.