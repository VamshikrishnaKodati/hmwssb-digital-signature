# T3 Bid Submission & Opening — Acceptance Report

Date: 2026-09-02 | Status: Complete | Tests: 307/307 pass

## 1. Scope & Deliverables

**Implemented:**
- Publish gate + snapshot lock (TenderDraft → Published, PublishedDate frozen)
- Server-time bid submission window (BidStartDate/BidEndDate enforced server-side)
- Bid + bidder records with submission references (`SB-{tenderId}-{seq}`)
- Duplicate bid rejection (TenderID + ContractorID unique constraint → 409)
- Segregated bid documents (array → `BidDocument` rows by Category)
- Bid opening workflow (TO cannot start; PO drives Open → Complete)
- Financial masking (TO sees `— masked (financial)`; PO+ can see amounts)
- Dashboard KPIs for Tender Officer (9 metric cards)
- RBAC across all new endpoints
- Audit logging for publish, bid submit, bid open, close
- SLA entries for BidSubmission and BidOpening stages

**NOT implemented (out of scope — later phases):**
- Technical evaluation
- Financial evaluation
- L1 shortlisting
- Award decision
- Work order / agreement
- Contractor/bidder self-service portal (bids are officer-managed via API, no bidder login)

## 2. Status Flow

```
TenderDraft → Published → BidSubmissionOpen → BidsClosed
  → BidOpeningInProgress → TechnicalEvaluationPending
```

`effectiveStatus()` computes status on read from stored `PublishedDate`, `BidStartDate`, `BidEndDate`, `BidOpeningStatus`, `SubmittedCount`. Writes call `persistExpiry()` to cache the resolved status.

## 3. Database Schema

Tables (all in `037_t3_bid_submission_opening.sql`):
- `Tender` — added `PublishedDate`, `PublishedBy`, `EffectiveStatus`, `BidOpeningStatus`, `BidOpeningStartDate`, `BidOpeningCompletedAt`
- `Bid` — TenderID FK, ContractorName, SubmissionReference, OpeningStatus, FinancialBidAmount, EMD
- `BidDocument` — BidID FK, Category (Technical/Financial/EMD/Declaration), DocumentName, FilePath
- `Contractor` — ContractorID PK, ContractorName, RegistrationNo, Email, Phone, Address
- `BidOpening` — TenderID FK + UNIQUE, Status, OpenedCount, TotalCount, StartedBy, CompletedBy
- `BidOpeningItem` — BidID FK + UNIQUE, OpenedBy, OpenedAt, OpeningRemarks
- RBAC: `bid.submit` → TenderOfficer; `bid.view` → TO+PO; `bid.open` → ProcurementOfficer
- SLA: BidSubmission (7 days), BidOpening (3 days)

## 4. API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/tender/:id/publish` | `tender.publish` | Snapshot lock + open window |
| POST | `/api/tender/:id/close` | `tender.publish` | Manual early close |
| GET | `/api/tender/:id` | `tender.view` | + capabilities + readiness |
| GET | `/api/tender/:id/bid-opening` | `bid.view` | Opening panel data |
| POST | `/api/tender/:id/bid-opening/start` | `bid.open` | Start opening session |
| POST | `/api/tender/:id/bid-opening/complete` | `bid.open` | Finalize → TechEvalPending |
| POST | `/api/bids/tender/:id` | `bid.submit` | Submit bid (window + dup check) |
| GET | `/api/bids/tender/:id` | `bid.view` | List bids (financial masked for non-PO) |
| POST | `/api/bids/:bidId/open` | `bid.open` | Open individual bid (idempotent) |

## 5. Security & RBAC

- All new endpoints wrapped with `requirePermission(permission)`.
- Financial amounts: server returns `null` for `FinancialBidAmount` when caller lacks `bid.view` — frontend renders `— masked (financial)`.
- Bid opening: only `ProcurementOfficer` can start/open/complete. `TenderOfficer` gets 403.
- Duplicate bid: `UNIQUE(TenderID, ContractorID)` → 409 at DB level.
- Tender publish: `PublishedDate` set once; subsequent publishes → 400.

## 6. Concurrency & Atomicity

- `generateTenderNo` uses `pg_advisory_xact_lock(736254)` on the same transaction as the INSERT — no duplicate tender numbers under parallel load.
- Bid opening uses `UNIQUE(TenderID)` on `BidOpening` + `ON CONFLICT ... DO UPDATE` — idempotent.
- `openBid` uses conditional UPDATE (`WHERE OpeningStatus = 'Pending'`) — safe for double-clicks.

## 7. Frontend Components

| File | Purpose |
|------|---------|
| `client/src/pages/TenderDetail.jsx` | Full rewrite: capability-driven buttons (publish/submit/open/complete), publish confirm modal, bid table with masked financials, opening panel |
| `client/src/pages/TenderList.jsx` | Imports `StatusBadge`, uses `effectiveStatus` for status display |
| `client/src/components/shared/StatusBadge.jsx` | Colors+labels for TenderDraft, Published, BidSubmissionOpen, BidsClosed, BidOpeningInProgress, TechnicalEvaluationPending |
| `client/src/pages/dashboards/TenderOfficerDashboard.jsx` | 9 KPI cards: TenderDrafts, Published, BidOpen, ClosingSoon, BidsClosed, BidOpeningInProgress, TechEvalPending, TotalBids, ReadyForTender |

## 8. Testing

| Suite | Tests | Port | Notes |
|-------|-------|------|-------|
| `t3.test.js` | 6/6 | 5001 | Publish gate, submissions, window enforcement, manual close, bid opening (TO/PO), dashboard KPIs |
| `golden.test.js` | 36/36 | 5099 | Full tender lifecycle including publish snapshot lock + published-tender edit rejection |
| `phase3c.test.js` | 29/29 | 5397 | RBAC, item CRUD, audit (standalone) — boot race fixed (port polling) |
| `tenderdraft.test.js` | 47/47 | 5421 | Tender CRUD, versions, NIT, dashboard |
| `procurement.test.js` | 24/24 | 5402 | Full lifecycle + tender number atomicity |
| `dashboard.test.js` | 7/7 | 5399 | Dashboard stats + worksInProgress |
| All other suites | — | — | No regressions from T3 changes |
| **Total** | **307/307** | — | **0 failures** |

Playwright E2E: `tests/e2e/03-tender-bid.spec.js` (15 steps) + `tests/e2e/setup-t3.cjs` — ready to run against a live dev server.

## 9. Key Bugs Fixed During Implementation

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `uq_tender_no` collisions under parallel test files | `SELECT MAX + INSERT` in separate transactions — no lock | Advisory lock `pg_advisory_xact_lock(736254)` on same conn as INSERT |
| `phase3c.test.js` ECONNREFUSED 5397 | `startServer` resolved on log-line heuristic or 8s timeout; child not ready | Port-polling with `http.get` until child accepts connections (30s timeout) |
| `publishTender` PG 42P08 inconsistent types | Same `$2` param used for `PublishedDate` (timestamp without tz) and `UpdatedAt` (timestamptz) | Use `now()` for both columns |
| `generateTenderNo` return inconsistent with `workflowController` auto-create | Number computed in one tx, INSERT in another — gap allows duplicate | Pass the caller's `client` to `generateTenderNo` so lock spans compute+insert |

## 10. File Inventory

```
server/utils/tenderState.js          — effectiveStatus, persistExpiry, capabilities, notifyOpeningAuthority
server/utils/tenderNo.js             — generateTenderNo with advisory lock + client-passing
server/utils/sla.js                  — Tender module entries, WORKFLOW_SLA_MAP, force param
server/controllers/tenderController.js — publishTender, closeTender, updateTender lock, get caps/readiness, list effectiveStatus
server/controllers/bidController.js  — submitBid, listBids, getBidOpening, startBidOpening, openBid, completeBidOpening
server/controllers/dashboardController.js — TO T3 metrics block
server/controllers/workflowController.js — exports sendNotification/formatIstTime, generateTenderNo(client)
server/routes/tender.js              — POST /:id/publish, POST /:id/close, GET /:id/bid-opening, POST start, POST complete
server/routes/bids.js                — POST /:bidId/open with requirePermission
server/tests/t3.test.js             — 6 tests: T3 API-level E2E
server/tests/golden.test.js         — date fix: relative today±Nd instead of hardcoded 2026-09-01
server/tests/phase3c.test.js        — boot race fix: port polling
db/migrations/037_t3_bid_submission_opening.sql — all T3 schema + RBAC + SLA
client/src/pages/TenderDetail.jsx   — full rewrite for T3
client/src/pages/TenderList.jsx     — StatusBadge import + effectiveStatus
client/src/components/shared/StatusBadge.jsx — T3 status colors/labels
client/src/pages/dashboards/TenderOfficerDashboard.jsx — 9 KPI cards
tests/e2e/setup-t3.cjs             — creates/finds tender for Playwright
tests/e2e/03-tender-bid.spec.js    — 15-step Playwright E2E
```

## 11. Contractor/Bidder Portal Status

Bids are **officer-managed** — there is no bidder self-service portal. Tender Officers submit bids on behalf of contractors through the `POST /api/bids/tender/:id` endpoint (authenticated as `TenderOfficer`). The `Contractor` table stores contractor metadata; the `Bid` table stores the actual submission. No bidder login, registration, or self-service flow exists.

## 12. What Was NOT Implemented (and Why)

| Omitted | Reason |
|---------|--------|
| Technical evaluation | Explicitly excluded — "later phases" |
| Financial evaluation | Explicitly excluded |
| L1 shortlisting | Explicitly excluded |
| Award / work order | Explicitly excluded |
| Bidder self-service portal | Out of scope — current requirement is officer-managed bids |
| WebSocket real-time status | Not needed — status is polled on page load; SLA checker runs periodically |
| Email notifications for bid events | `sendNotification` called for window open/close; individual bid email not in spec |

## 13. Deployment Notes

- Run migration: `node db/migrate.js` (037 applied)
- RBAC permissions must be seeded: `bid.submit`, `bid.view`, `bid.open` added to `037` migration
- SLA entries auto-created by `startSla` with `force` param on publish
- No environment variable changes required
- No new npm dependencies added
