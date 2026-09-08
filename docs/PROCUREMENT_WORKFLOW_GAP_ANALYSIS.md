# Procurement / Tender Workflow — Gap Analysis & Final Design Specification

**Status:** Design-review pass — NO CODE CHANGED.
**Date:** 2026-08-31
**Scope:** Post-MD-approval procurement, tender administration, evaluation, award, and the SLA/escalation layer. Evidence collected from the live DB (`hmwssb`), `server/controllers/*`, `server/middleware/*`, `server/utils/sla.js`, `server/routes/*`, and the existing test suites. No source, DB, or migration was modified.

---

## 0. Evidence-based findings (executive summary)

The following are **confirmed defects/gaps** with code/DB evidence, not assumptions:

| # | Finding | Evidence | Severity |
|---|---------|----------|----------|
| E1 | **Procurement SLA timers never start.** `startSla` has signature `(module, stage, recordId, table)` (sla.js:44). The three post-approval calls pass only 2 args: `startSla(estimateId, 'DirectorAdmin')` (workflowController.js:1707), `startSla(estimateId, 'GMReview')` (:1788), `startSla(estimateId, 'DGMReview')` (:1845). With the args swapped, `getSlaDefinition(module=estimateId, stage)`, `module` is a number → no `SlaDefinition` row → `def` undefined → early return. **No `SlaStatus`/`SlaDueAt` is written for FCN/DirectorAdmin/GMReview/DGMReview.** | sla.js:44-56; workflowController.js:1707,1788,1845; SlaDefinition has `DirectorAdmin`, `GMReview`, `DGMReview` stages (SlaID 12,13,14) | **CRITICAL** |
| E2 | **FCN stage has no SLA start at all.** MD final approval (workflowController.js:1209-1252) never calls `startSla('Estimate','FCN',...)`. There is no `startSla('Estimate','FCN',...)` anywhere. | grep of `startSla\(` call sites: only DGM/GM/CGM/nextSlaStage (lines 285,599,810,947) use the 4-arg form; no FCN call exists | **CRITICAL** |
| E3 | **Director dashboard "escalated" is a hardcoded 3-day cutoff, not the SLA/escalation engine.** `(NOW() - SubmissionDate/CreatedDate) > 3 days` (dashboardController.js:884-885). Not `SlaStatus`/`EscalationLevel`/`EscalationLog` based. | dashboardController.js:884-885 | **CRITICAL** |
| E4 | **No `TechnicalSanction` stage/data anywhere.** No table, no status, no handler, no `TS` SLA stage, no `TS No` field. The current post-approval chain is `FinalApproved → FCNGenerated → AdminSanctionGenerated → GMReviewed → DGMReviewed` — AS is followed by a **fixed GM→DGM two-step**, which the new architecture replaces with **competent-authority TS routing (Director XOR GM XOR DGM)**. | grep `TechnicalSanction` across `controllers/*,middleware/*,routes/*,utils/*` → zero hits; SlaDefinition has no TS stage; `Tender` table has no `TS`/sanction link columns | **MISSING FEATURE** |
| E5 | **Bid evaluation/award is gated to `Administrator`/`SoRAdmin` only** (`canManage(req)`), not any procurement/evaluation designation. There is **no evaluation-authority role** with real access. | bidController.js:115,157; userController.js:7 | **ROLE/RBAC GAP** |
| E6 | **A `ProcurementOfficer` designation exists but holds no real workflow authority in the post-approval chain** — it only drives the legacy tender/evaluation dashboard (dashboardController.js:408-451) and `agency.view/create/select` (rbac.js:127). Its dashboard references estimate statuses (`TechnicalEvaluation`, `L1Identified`, `WorkAwarded`, `WorkOrderIssued`, `AgreementExecuted`) that **do not exist** in the estimate state machine. | rbac.js:127; dashboardController.js:421-422; estimate `Status` never produced by any controller | **ROLE BUG / DEAD CODE** |
| E7 | **Two state namespaces for the same tender lifecycle.** `Tender.Status` (`Draft,ReadyForPublication,Published,BidSubmissionOpen,BidSubmissionClosed,TechnicalEvaluation,FinancialEvaluation,Awarded`) vs `EstimateHeader.Status` (estimate approving states). The Tender Officer dashboard queries estimate statuses `DGMReviewed/Signed/TenderPublished/TenderClosed` (dashboardController.js:387), but `Tender.Status` never has `TenderPublished`/`TenderClosed`; the ProcurementOfficer dashboard queries estimate statuses that don't exist. **State-machine/query mismatch.** | tenderController.js:6; dashboardController.js:387,421 | **CONFUSED DATA MODEL** |
| E8 | **No L1 stage.** `L1Identified` is referenced only in the ProcurementOfficer dashboard query (never written); `bidController.awardTender` jumps straight from `FinancialEvaluation` → `Awarded` (IsSelected=True) with no L1 determination step. | bidController.js:195-236; dashboardController.js:441 | **MISSING FEATURE** |
| E9 | **No capture of Work Order / Agreement / Award numbers in the Tender domain.** `Agency` table has `WorkOrderDate`/`AgreementDate`/`AgreementNo` but no `WorkOrderNo`, no `AwardNo`/`AwardDate`, no `Award` table. `Tender` has no award columns. | `Agency` schema; `Tender` schema | **DATA MODEL GAP** |
| E10 | **No bidder-count, and no separated technical-vs-financial bid registry beyond `TechnicalStatus` on `Bid`.** A single `Bid` row carries both technical docs and `FinancialBidAmount`, and `evaluateFinancial` ranks **only `TechnicalStatus='Eligible'`** bids (correct two-stage behaviour) — but there is no explicit "Number of Bidders", no financial-only gate reopening, and no per-bidder L1 basis. | Bid schema; bidController.js:164; tender schema | **PARTIAL** |

---

## 1. Current workflow (as implemented)

### Estimate approval (unchanged, correct)

```
Prepared → Verified → Recommended → Submitted for Approval → Approved → ED → MD → FinalApproved
```

Roles owning each stage (per workflowController guards + dashboardController):
- **Manager**: `Prepared`→`Verified`→`Recommended`
- **DGM**: `Submitted for Approval` → `Approved`
- **GM**: to `ED`
- **CGM**, **DOP**, **ED**: sequential approvals
- **MD**: final approval → `FinalApproved`; **auto-creates the `Tender` row** as `Draft` (workflowController.js:1221-1227)

### Post-approval procurement (as implemented)

```
FinalApproved
  → [FinanceHead]  FCN generated        (Status: FCNGenerated)         workflowController.js:1657-1708
  → [DirectorOfAdministration]  AS      (Status: AdminSanctionGenerated) :1741-1770
  → [GM]              Review & forward  (GMReviewed)                   :1822-1850
  → [DGM]             Review & forward  (DGMReviewed)                 :1879-1905
  → [TenderOfficer]   Tender (already auto-created, publish flow)      :1929-1943 / tenderController
```

**The current chain has NO TS stage** — GM→DGM is a fixed two-step after AS. The "Tender Officer's" job is **publish**, not create (tender auto-created at MD approval).

### Tender lifecycle (as implemented)

`Tender.Status`: `Draft → ReadyForPublication → Published → BidSubmissionOpen → BidSubmissionClosed → TechnicalEvaluation → FinancialEvaluation → Awarded`

Endpoints: `tenderController.js` (CRUD + BOQ + NIT), `bidController.js` (submitBid, evaluateTechnical, evaluateFinancial, awardTender, contractors), `agencyController.js` (create/list/update/delete agencies + agreement fields).

### Execution / Billing / Finance (relevant for SLA reuse)

- Execution: SiteEngineer / Agency start→progress→complete.
- Billing: BillingOfficer → Manager → DGM → GM → Finance.
- Finance: Inward → Verification → Recommended → Approved → Cheque (FinanceClerk → FinanceManager → FinanceHead → cheque issue).

---

## 2. Intended workflow (target architecture — per HMWSSB directive)

```
MD Final Approved
  → FCN (Director of Administration)
  → Administrative Sanction (Director of Administration)
  → Technical Sanction (competent technical authority: Director XOR GM XOR DGM)
  → TS Approved
  → Tender Officer
      → Tender Preparation → Publication → Monitoring → Closing → Bid Opening → Handoff to designated evaluation authority
  → Technical Evaluation (bidder eligibility)
  → Financial Evaluation (among eligible)
  → L1
  → Award
  → Work Order
  → Agreement
  → Execution (Agency: Start → Progress → Measurement → Complete)
  → Billing → Finance
```

**Key corrections versus current implementation:**
1. **No Procurement Officer role.**
2. **Director owns FCN + AS** (this already matches the current implementation — FinanceHead creates the FCN record but the FCN *responsibility* is Director? **needs confirmation** — see §7).
3. **TS is a competent-authority assignment**, not a fixed `Director → GM → DGM` chain.
4. **Evaluation is separated from tender administration**, owned by a designation to be confirmed (not Administrator/SoRAdmin, not Tender Officer by default).

---

## 3. Current role matrix (evidence-backed)

| Designation | Permission keys (rbac.js) | Real workflow authority today |
|---|---|---|
| Manager | approve, verify, estimate.* | estimate approval stages |
| DGM | approve, verify, estimate.* | estimate approval + post-approval **DGMReview** |
| GM | approve, estimate.* | estimate approval + post-approval **GMReview** |
| CGM | approve, estimate.* | estimate approval |
| DOP | approve, estimate.* | estimate approval |
| ED | approve, estimate.* | estimate approval |
| MD | approve, estimate.* | estimate **FinalApproval**; auto-creates tender |
| **FinanceHead** | finance.approve, finance.cheque, estimate.view | **FCN generate** (workflowController 1657; finance dashboard section 788) |
| **DirectorOfAdministration** | — | **FCN/AS** inbound (dashboard 861; sanction generate 1741) |
| **TenderOfficer** | tender.view/create/publish/update, estimate.view | tender create/edit/publish/delete (guard 120); **publish flow** |
| ProcurementOfficer | agency.view/create/select, estimate.view | **no post-approval authority**; only legacy tender/eval dashboard + agency |
| SiteEngineer | — | work execution |
| BillingOfficer | billing.* | billing |
| FinanceClerk/FinanceManager | finance.* | inward/verification/recommended |
| Administrator / SoRAdmin | canManage → **only these can run evaluateTechnical/evaluateFinancial/awardTender** | **evaluation/award is orphaned to admin** |

**Confirmed FCN role mapping (per user request "Report the actual existing role mapping"):** The **FCN record is generated by `FinanceHead`** (workflowController 1657-1696 guard: `Designation === 'FinanceHead'`; audit text "FinanceHead generated FCN … Forwarded to DirectorOfAdministration"). The **Administrative Sanction is generated by `DirectorOfAdministration`** (1741+). So the actual existing mapping is:

```
FCN   → FinanceHead (generation) → DirectorOfAdministration (AS downstream)
AS    → DirectorOfAdministration
```

Note: this differs from the directive's "Director owns FCN + AS" — in the real system **FinanceHead generates the FCN** and the Director generates the AS. This is a **BUSINESS RULE NEEDS CONFIRMATION** (see §7, §22).

---

## 4. Intended role matrix (target)

| Responsibility | Designation | Current status |
|---|---|---|
| FCN | FinanceHead (today) / Director (directive) | **exists, mapping needs confirmation** |
| Administrative Sanction | DirectorOfAdministration | exists |
| Technical Sanction | **competent technical authority: Director XOR GM XOR DGM** (configurable) | **missing** |
| Tender administration | TenderOfficer | exists |
| Bid opening | TenderOfficer "as permitted" | partially exists (BidSubmissionOpen/Closed) |
| Technical evaluation | **designated evaluation authority (TBD)** | **gated to Administrator/SoRAdmin** |
| Financial evaluation | same | gated to Administrator/SoRAdmin |
| L1 | explicit stage | **missing** |
| Award / WO / Agreement | TBD | Award exists in name only; WO/Agreement data gaps |

---

## 5. Tender Officer responsibility (target)

- Receive tender-ready work (TS Approved → handoff to Tender Officer).
- Prepare tender; capture: Tender No., Estimate No., Name of Work, Tender Type, Tender Category, Estimated Contract Value, Tender Inviting Authority, Bid Opening Authority, floated/closing/opening dates, bid validity, EMD, tender fee.
- Publish, monitor submissions, close, perform/record bid opening as permitted.
- **Hand off** to designated evaluation authority. **Do NOT show Technical/Financial Evaluation as Tender Officer actions.**

### Current tender form fields (gap vs required)

`Tender` table already stores: `TenderNo, TenderDate, EstimatedCost, TenderType, BidStartDate, BidEndDate, TechnicalBidOpeningDate, FinancialBidOpeningDate, CompletionPeriod, EMD, TenderFee, BidValidity, EligibilityCriteria, RequiredDocuments, PerformanceSecurity, SpecialConditions, PublishedBy, PublishedDate`.

**Missing fields:** `Tender Category`, `Tender Inviting Authority`, `Bid Opening Authority`, `Tender Closing Date` (ascertained from `BidEndDate` today), `Number of Bidders` (derived), explicit `Bid Opening Date` vs `Technical/Financial` split, `Tender Floated Date` (vs `TenderDate`).

---

## 6. Evaluation responsibility gap

- **Current:** `evaluateTechnical`, `evaluateFinancial`, `awardTender` all require `canManage(req)` = **Administrator or SoRAdmin**. No procurement/evaluation designation has these permissions.
- **Intended:** a designated evaluation authority (exact designation **must be confirmed** from HMWSSB workflow) owns the technical → financial → L1 → award sequence.
- **Technical evaluation** (eligibility/qualification per bidder: criteria, documents, score/result, qualified/disqualified, remarks, evaluator, date) is represented only by `Bid.TechnicalStatus` (`Pending`/`Eligible`/`Rejected`) + `TechnicalRemarks`. Missing: explicit criteria, score, evaluator, date, disqualification-not-proceeding gate enforcement (enforced in code at rank time — but no explicit "financial gate" reopened check).
- **Financial evaluation** ranks only `Eligible` bids (bidController.js:164) — **correct two-stage behaviour already present**.
- **L1** is not an explicit stage (see E8).

---

## 7. FCN flow

**Current (implemented):**
```
FinalApproved
 → FinanceHead: generate FCN (FCNNo, FCNDate, GeneratedBy/Date)   [Status → FCNGenerated, CurrentOwner → Director]
 → DirectorOfAdministration: generate Administrative Sanction     [Status → AdminSanctionGenerated]
```

- `FCN` table: `FCNID, EstimateID, FCNNo, FCNDate, GeneratedBy, GeneratedDate, VerifiedBy, VerifiedDate, Status, Remarks`. **VerifiedBy/VerifiedDate exist but no "confirm FCN" action is enforced before AS** — AS handler only checks `Status === 'FCNGenerated'` (1741). The directive's "Generate / Confirm FCN" is only half-supported.

**Intended:** FCN **generated/confirmed** before procurement proceeds; responsible role per confirmed designation. **BUSINESS CONFIRMATION NEEDED:** is the FCN author FinanceHead (current) or Director (directive)?

---

## 8. AS flow

- **Current:** DirectorOfAdministration generates `AdministrativeSanction` (`SanctionNo, SanctionDate, GeneratedBy/Date, Status`), status → `AdminSanctionGenerated`, owner → GM.
- **Intended:** Director reviews, generates/confirms AS, records number/date, forwards to **TS determination**. (Not automatically GM.)

---

## 9. TS routing model (design)

No code yet. Configurable authority map, per the user's answer ("Config map, default to current roles"):

```
TS REQUIRED
  → determine competent technical authority   (config-driven)
  → Director XOR GM XOR DGM                   (exactly ONE, not a chain)
  → TS Approved
  → Tender Officer
```

### Config structure (future-proof; no invented thresholds)

```sql
TechnicalSanctionAuthority (
  AuthorityID serial PK,
  WorkCategory text NULL,          -- nullable = applies to all
  MinValue numeric NULL,
  MaxValue numeric NULL,
  Designation text NOT NULL,       -- 'Director' | 'GM' | 'DGM'
  Priority int NOT NULL,
  Active boolean DEFAULT TRUE,
  Constraint: at most one active match applies (priority resolves ties)
)
```

- **No financial thresholds invented.** Until HMWSSB delegation confirms authority, defaults are the application's current designated roles (GM/DGM).
- Resolution algorithm (to be implemented later, per design): pick the highest-priority **active** row whose `WorkCategory` and value range match the estimate; if none matches, fall back to a single configured default authority; exactly one recipient.
- Data design: `TechnicalSanction` table (`TSID, EstimateID, TSNo, TSDate, AuthorityDesignation, AuthorityUserID, GeneratedBy/Date, Status (Pending/Approved/Returned), Remarks`). New estimate status `TechnicalSanctionPending` + `TSSanctioned` (naming TBD at implementation).

---

## 10. Tender data model (current vs required)

**Current `Tender`:** has most tender-form fields (see §5). Missing: `TenderCategory`, `TenderInvitingAuthority`, `BidOpeningAuthority`, explicit closing/floated/opening dates, `NumberOfBidders` (derived from `Bid` count).

**Required beyond create form**:
- **Number of Bidders** → derive `COUNT(Bid)`.
- **Bidder Details** → `Bid` table covers BidID, ContractorID→name, BidDate, TechnicalBid, FinancialBidAmount, Documents, EMD, TechnicalStatus, TechnicalRemarks, Rank, IsSelected, Status. Missing: `SubmissionDate/Time` (only date), technical docs registry, financial offer per bidder is present (FinancialBidAmount).
- **Technical Evaluation** → `TechnicalStatus` + `TechnicalRemarks`; missing explicit evaluation date/evaluator columns.
- **Financial Evaluation** → `Rank` column exists; missing `Evaluator`, `EvaluationDate`, `FinancialRemarks`.
- **L1** → missing (see §13).
- **Work Award** → `Bid.IsSelected/Status='Awarded'`; missing `AwardNo`, `AwardDate`, `Agency`.
- **Work Order** → `Agency.WorkOrderDate`; missing `WorkOrderNo`.
- **Agreement** → `Agency.AgreementNo/AgreementDate` present.

**Award/WO/Agreement should not imply "work started"** — `Agency.StartDate/CompletionDate` are separate; no state pairing today.
**Note (anti-footgun):** `Tender` and `Agency` both carry `EstimateID` + `TenderID`; `Bid` links `ContractorID` while `Agency` stores `AgencyName`. There is **no Contractor→Agency relationship table** — a contract-owner identity gap worth confirming.

---

## 11. Technical Evaluation model

| Required | Current | Status |
|---|---|---|
| Bidder | `Bid.ContractorID → Contractor` | PASS |
| Eligibility | `Bid.TechnicalStatus Pending/Eligible/Rejected` | PASS |
| Technical criteria | `Tender.EligibilityCriteria` (on tender) | PARTIAL (not per-bidder assessment record) |
| Technical documents | `Bid.Documents`/`TechnicalBid` | PASS |
| Score/result | none | MISSING |
| Qualified/Disqualified | `Eligible`/`Rejected` | PASS |
| Remarks | `TechnicalRemarks` | PASS |
| Evaluator | not recorded (only AuditLog action + `req.user` in transaction) | PARTIAL |
| Evaluation date | not recorded on `Bid` | MISSING |
| Unsuccessful bidder blocked from financial | enforced in `evaluateFinancial` (filters `Eligible`) | PASS |

---

## 12. Financial Evaluation model

| Required | Current | Status |
|---|---|---|
| Bidder | `Bid` | PASS |
| Financial offer | `FinancialBidAmount` | PASS |
| Rank | `Bid.Rank` (set in evaluateFinancial) | PASS |
| Evaluator | only `req.user.Designation` in AuditLog | PARTIAL |
| Evaluation date | not on `Bid` | MISSING |
| Remarks | none on financial | MISSING |
| Only eligible proceed | **PASS** (bidController.js:164 filters `TechnicalStatus='Eligible'`) | PASS |

---

## 13. L1 model

- `L1Identified` exists **only** as an unreachable estimate status in the ProcurementOfficer query.
- **No L1 table/state/step.** `awardTender` jumps FinancialEvaluation → Awarded.
- Required to design: `L1` explicit stage capturing **L1 Bidder, Financial Offer, Rank, Basis, Approving authority, Date, Remarks** (new table e.g. `L1Selection`), plus an estimate/tender status `L1Identified` written before award.

---

## 14. Award / Work Order / Agreement

| Required | Current | Status |
|---|---|---|
| Award No. / Award Date | none | **MISSING** |
| Selected Agency | `Bid.IsSelected`/`Agency` | PARTIAL |
| Accepted Amount | `Agency.TenderValue` | PARTIAL |
| Work Order No. / Date | `Agency.WorkOrderDate` only, no `WorkOrderNo` | PARTIAL |
| Agreement No. / Date | `Agency.AgreementNo/AgreementDate` | PASS |

No `Work Started` state implicitly set by award/agreement (correct); execution state is separately driven by Site Engineer/Agency.

---

## 15. Dashboard design (target)

### 15.1 Director of Administration
- **Header:** FCN / Sanction responsibilities.
- **Operational Overview KPIs:** FCN Pending, AS Pending, AS Completed, Awaiting TS, Overdue, Escalated.
- **Primary queue:** `NEEDS YOUR ACTION — FCN / AS`. Row fields: Estimate No., Work Name, Amount, FCN No./Date, AS No./Date, SLA, Overdue flag, [Generate/Confirm FCN] [Generate Sanction] [Forward to TS].
- **Inside detail:** Estimate info + FCN card (FCN No, Date, Generate/Confirm) + AS card (Sanction No, Date, Generate) + [Forward to TS].
- **Actions:** generate/confirm FCN, generate sanction, forward to TS.
- **SLA/escalation:** per config (508-752 minute defaults exist; reuse SLA engine once E1 fixed).
- **Supporting docs / audit / version:** document viewers + AuditLog + EstimateHeader.Version as today.

### 15.2 TS Competent Authority (Director XOR GM XOR DGM)
- **Header:** TECHNICAL SANCTION — NEEDS YOUR ACTION.
- **KPIs:** TS Pending, TS Completed, Returned, Overdue, Escalated.
- **Primary queue:** only records assigned to the selected authority. Row: Estimate No., Work Name, AS No., FCN No., Estimated Value, Received Date, SLA.
- **Detail:** Estimate info, General Abstract, Civil Items, Material Items, Quantity/Rate/Amount, Specifications, Drawings/Documents, FCN, AS, Audit Trail, Version History; **Technical Authority**, TS No., TS Date, Remarks; [Return] [Approve Technical Sanction].

### 15.3 Tender Officer
- **Header:** Tender Administration (no evaluation).
- **KPIs:** Ready for Tender, Draft Tenders, Published, Closing Soon, Closed, Bid Opening Pending, Overdue.
- **Operational overview + primary queue:** `READY FOR TENDER` — Estimate No., Tender No., Name of Work, Tender Type, Category, Estimated Contract Value, AS No., TS No., SLA, Action.
- **Tender form:** full required field set (§5), no Technical/Financial evaluation actions.

### 15.4 Evaluation Authority (designation TBD)
- **Separate queues:** Technical Evaluation Queue, Financial Evaluation Queue, L1 Pending, Award Pending.
- Clear UX separation:
  - **Technical:** "Is this bidder technically eligible?"
  - **Financial:** "Among technically eligible bidders, what is the financial ranking?"
- Respective detail screens: bidder cards with eligibility/product + rank; evaluate → award; L1 → award → WO → Agreement.

### 15.5 Tender detail pipeline (target)
```
TS Approved ● → Tender Draft ○ → Tender Published ○ → Bid Submission ○ → Bid Opening ○
→ Technical Evaluation ○ → Financial Evaluation ○ → L1 ○ → Work Award ○ → Work Order ○ → Agreement ○
```
(Current stage highlighted; drives all detail screens.)

---

## 16. SLA / Escalation

### Current working
- Estimate approval stages map: `DGM, GM, CGM, DOP, ED, MD` (SlaDefinition module `Estimate`) — 4-arg `startSla` calls start these correctly (workflowController 285,599,810,947).
- Billing stages (module `Billing`), Finance stages (module `Finance`) — all started with the correct 4-arg signature.
- Tender SLA stages `TenderPreparation`, `TenderEvaluation`, `Award` exist in SlaDefinition (module `Tender`) but **their `startSla` calls were not seen in controllers** (only Estimate/Finance module calls observed) — needs verification at implementation.
- SLA checker (`checkModuleSlas`) escalates via `checkEscalation` writing `EscalationLog`, resolving on `stopSla` with `ResolutionType`.

### Current failures (the "not escalating" bugs)
| Id | Symptom | Root cause | Fix direction |
|---|---|---|---|
| S1 | FCN/DirectorAdmin/GMReview/DGMReview never go Warning/Overdue/Escalated | wrong `startSla` arg signature (E1) | call `startSla('Estimate', stage, estimateId, 'EstimateHeader')`; add `FCN`/`DirectorAdmin`/`GMReview`/`DGMReview` to WORKFLOW_SLA_MAP used by `checkModuleSlas` (which keys by `row.Status`, i.e. estimate statuses, not SlaDefinition stage names) |
| S2 | FCN stage has no SLA at all | no `startSla('Estimate','FCN',...)` at MD final approval (E2) | start at FinalApproved handoff |
| S3 | Director "escalated" is a hardcoded 3-day guess (E3) | dashboard bypasses the SLA engine | remove hardcoded cutoff; derive from `SlaStatus`/`EscalationLog` |
| S4 | `checkModuleSlas` looks up `getSlaDefinition(module, row.Status)` where `row.Status` is the **estimate status** (`FCNGenerated`, etc.), but SlaDefinition stages are **workflow-marker names** (`FCN`, `DirectorAdmin`). The WORKFLOW_SLA_MAP bridges this for estimate approval statuses — **procurement statuses are absent from WORKFLOW_SLA_MAP**, so even with a started timer the checker would not escalate them. | mapping gap | add procurement statuses → stages to WORKFLOW_SLA_MAP (or key SLAs by status directly) |
| S5 | Escalation notification linkage | `sendNotification` used in FCN/AS handlers but **`checkEscalation`'s escalation path** — verify it writes `EscalationLog` and notifies the target; DB shows EscalationLog exists | verify/complete at implementation |
| S6 | Re-running scheduler must not duplicate escalations — `stopSla` resolves open EscalationLog; checker must guard on `EscalationLevel` | sla.js escalated-guard | confirm no duplicate on rerun |

**SLA durations:** All existing defaults are fictional placeholders (e.g. DGM=480min, MD=1440min). Per directive, **do not invent durations**; keep them config-driven in `SlaDefinition` (already true) and only set real numbers when HMWSSB provides them. For each stage the design documents *start / due / warning / overdue / escalation target / notification* — the engine already supports these fields.

| Stage (target) | SLA start | due | warning | overdue | escalation target | notification |
|---|---|---|---|---|---|---|
| FCN | FinalApproved handoff | config | config | config | Director/confirm-recipient | FCN pending |
| AS (DirectorAdmin) | FCN generated | config | config | config | Director | AS pending |
| TS (competent authority) | AS generated | config | config | config | current authority | TS pending |
| Tender prep | TS Approved | config | config | config | Tender Officer | tender pending |
| Bid open | close date | config | config | config | Tender Officer | bid-opening pending |
| Technical eval | bid closed | config | config | config | evaluation authority | tech eval pending |
| Financial eval | tech eval done | config | config | config | evaluation authority | fin eval pending |
| L1 / Award | fin eval done | config | config | config | evaluation authority | award pending |

---

## 17. RBAC (target)

Introduce (only after designation confirmation):
- **Evaluation authority permissions:** `tender.evaluateTechnical`, `tender.evaluateFinancial`, `tender.l1`, `tender.award` (or fold into an existing designation once HMWSSB confirms who evaluates).
- Remove/tighten **`canManage` falling back to Administrator/SoRAdmin** for evaluation (E5).
- **TS authority** is data-driven (per-authority config), not a static permission.
- **Tender Officer**: keep `tender.view/create/publish/update`; add `tender.close`, `tender.openBids`; do **not** grant evaluation permissions.

**RBAC anti-pattern found:** `ProcurementOfficer` role grants `agency.create/select` and a misleading dashboard but no post-approval workflow power (E6). Recommend decommissioning or explicitly repurposing once evaluation authority is named.

---

## 18. Notifications

- Current: `sendNotification(estimateId, userId, action, message, {email})` used in FCN/AS and approval handlers; supports DB + email (nodemailer/smtp). `notification.test.js` exists.
- Gap: no notification on TS determination, tender readiness handoff, bid-opening window, evaluation handoff, L1, award. Must reuse `sendNotification`.
- Escalation notifications (S5) must route to the escalation target and be generated exactly once per escalation.

---

## 19. Audit

- `AuditLog` records `EstimateID, UserID, Action, Remarks, CreatedDate`. All workflow actions write entries (evidence: GenerateFCN, GenerateSanction, GM/DGM review, AwardTender, TechnicalEvaluation entries).
- TS stage must write its own audit entries (`TS Assigned`, `TS Approved`, `TS Returned`).
- Bid-open and each evaluation handoff must write audit entries.

---

## 20. Versioning

- `EstimateHeader.Version` increments on approval actions (e.g. "v${currentVersion}" in MD approval; GM/DGM review messages reference version). Latest-signed-version logic is authoritative; `Signed` is legacy/extinct and must not be reintroduced.
- New procurement addenda (FCN/AS/TS numbers, tender fields) should be version-stamped / immutable-history consistent with existing versioning.

---

## 21. Defect list (classified)

| ID | Category | Finding | Status |
|---|---|---|---|
| D01 | **SLA BUG** | `startSla` wrong signature at workflowController 1707/1788/1845 → no SLA for DirectorAdmin/GMReview/DGMReview | FAIL |
| D02 | **SLA BUG** | No `startSla('Estimate','FCN',...)` at MD final approval | FAIL |
| D03 | **ESCALATION BUG** | Director dashboard "escalated" = hardcoded `>3 days`, not SLA/EscalationLog | FAIL |
| D04 | **SLA BUG** | WORKFLOW_SLA_MAP lacks procurement statuses → checker can't look up timelines | FAIL |
| D05 | **MISSING FEATURE** | No TechnicalSanction table/status/handler/TS SLA | MISSING |
| D06 | **ROLE BUG** | Evaluation/award gated to Administrator/SoRAdmin (`canManage`), not an evaluation designation | INCORRECT |
| D07 | **ROLE BUG / DEAD CODE** | `ProcurementOfficer` role + dashboard present but no workflow authority; queries estimate statuses that don't exist | PARTIAL/INCORRECT |
| D08 | **STATE BUG / CONFUSED DATA MODEL** | Two status namespaces (Tender.Status vs EstimateHeader.Status) mismatch dashboard filters | FAIL |
| D09 | **MISSING FEATURE** | No explicit L1 stage (only a phantom `L1Identified` in a query) | MISSING |
| D10 | **DATA MODEL GAP** | No AwardNo/AwardDate, WorkOrderNo, TS link on Tender; Agency has AgreementNo/Date + WorkOrderDate only | PARTIAL |
| D11 | **DATA MODEL GAP** | Bid lacks explicit submission datetime, evaluator, evaluation date; financial remarks absent | PARTIAL |
| D12 | **MISSING FEATURE** | No Number-of-Bidders/derived metric; tender closing date and inviting/bid-opening authorities not explicit fields | PARTIAL |
| D13 | **UI BUG** | Tender detail lacks TS pipeline stage; evaluation queues shown on Tender Officer/Procurement Officer dashboards (wrong owner) | FAIL |
| D14 | **BUSINESS RULE NEEDS CONFIRMATION** | FCN author: FinanceHead (today) vs Director (directive); who is evaluation authority; AS/TS thresholds | NEEDS CONFIRMATION |
| D15 | **PASS references dead refs** | dashboardController queries estimate statuses `TechnicalEvaluation/L1Identified/...` that no controller ever sets | FAIL |
| D16 | **NOTIFICATION BUG (verify)** | Ensure `checkEscalation` sends to escalation target exactly once and resolves on stopSla | PARTIAL/verify |

---

## 22. Business decisions required (before implementation)

1. **FCN author:** FinanceHead (current system) or Director of Administration (directive)? (Both exist; system currently does FinanceHead→Director.) Decide before touching roles.
2. **Evaluation authority designation:** Who is the designated technical+financial evaluation authority in the actual HMWSSB business model? (Not Administrator/SoRAdmin, not Tender Officer by default.) **Mandatory before evaluation implementation.**
3. **TS authority mapping:** confirm the approach "config map with Director/GM/DGM as possible authorities, defaults to current roles, no invented thresholds" is the agreed model.
4. **AS/TS sanction delegation:** which designation actually holds sanction power per work-category/value — to be filled into the config, not hard-coded.
5. **Bid Opening:** does the Tender Officer perform bid opening, or is that also a designated authority?
6. **L1 basis:** which authority approves L1 (configurable same as TS)?
7. **SLA durations:** actual durations for each stage, or keep config placeholder until HMWSSB supplies policy.
8. Whether to **decommission `ProcurementOfficer`** (dead role) or repurpose it as the evaluation designation.

---

## 23. Recommended implementation order

> All items below are *design-approved next steps*; **none implemented in this pass.**

**Phase A — Fix the escalation engine (highest priority, independent of role questions):**
1. Fix `startSla` call signatures for FCN/DirectorAdmin/GMReview/DGMReview (D01).
2. Add `startSla('Estimate','FCN',...)` at MD final approval (D02).
3. Extend WORKFLOW_SLA_MAP/checkModuleSlas to cover procurement statuses (D04).
4. Replace Director dashboard hardcoded 3-day "escalated" with SLA/EscalationLog-derived value (D03).
5. Re-run existing test suites to confirm no regression; add escalation re-run idempotency check (D16).

**Phase B — TS stage (needs decision #3):**
6. Add `TechnicalSanction` table + competent-authority config table + estimate status(es) + TS handler + SLA stage + audit + notifications (D05, D14).
7. Route AS-forward to the configured TS authority (not GM); after TS approval, hand off to Tender Officer.

**Phase C — Tender Officer separation:**
8. Add missing tender fields (category, inviting/bid-opening authority, closing/floated/opening dates, Number of Bidders) (D12).
9. Tender Officer dashboard: remove evaluation queues; align filters with Tender.Status not estimate statuses (D08, D13).
10. Add tender close + bid-opening actions with audit.

**Phase D — Evaluation (needs decision #2):**
11. Move `evaluateTechnical`/`evaluateFinancial`/`awardTender` permission from `canManage` to the designated evaluation authority (D06).
12. Add evaluator/evaluation-date/financial-remarks columns; keep the two-stage gate (D11).

**Phase E — L1 / Award / Work Order / Agreement (design only until decisions after evaluation):**
13. Add explicit `L1` stage (D09), `AwardNo/AwardDate`, `WorkOrderNo`, agreement link (D10).

**Phase F — Lifecycle verification:**
14. Full browser+API+DB pass: FinalApproved → FCN → AS → TS → Tender Create → Publish → Close → Bid Opening → Tech Eval → Fin Eval → L1 → Award → WO → Agreement; assert UI + API + DB + state + owner + permission + SLA + notification + audit agree at each stage. Run existing suites exactly as-is; do not modify tests to pass.

---

## Testing principle (agreed)

PASS requires **UI + API + database + workflow state + owner + permission** to agree. Do not mark PASS merely because a button exists, an API returns 200, a DB row exists, or a page loads.