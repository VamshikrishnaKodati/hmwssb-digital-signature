# End-to-End Test & Review Report — "Reservoir" Work

**Project:** HMWSSB Digital Signature / Works Management System
**Test date:** 08-Aug-2026
**Test scope:** Full life-cycle of a single work ("Reservoir") across all modules — Estimate, BOQ, Workflow (approval + digital signature), Tender (NIT), Agencies/Bids, Work Progress, Billing (Finance), Roles & Responsibilities, and Dashboard.
**Test approach:** Pure API-level testing. **No application source code was modified**; all changes were data created through the live REST APIs.

---

## 1. Test Environment

| Item | Value |
|---|---|
| Backend | Express on `http://localhost:5001` |
| Frontend (proxy) | Vite on `http://localhost:5173` → proxies `/api` to `:5001` |
| Database | PostgreSQL `hmwssb` |
| Roles tested | 9 (Manager, DGM, GM, SoRAdmin, TenderOfficer, ProcurementOfficer, SiteEngineer, BillingOfficer, Administrator) |
| Authentication | JWT bearer token per role (`password123`) |

---

## 2. Work Under Test

| Field | Value |
|---|---|
| Estimate ID | **EST/2026-27/001/0054** (DB `EstimateID` = 178) |
| Name of Work | **Construction of 10.0 MLD Clear Water Reservoir (CWR) — Reservoir at Serilingampally** |
| Work Category | Water Supply |
| Location | MMC / Malkajgiri / Division 1 / 1 – Keesara / Ward 1 (IDs: Region 4, Zone 13, Division 25, Circle 61, Ward 301) |
| Financial Year | 2026-27 |
| GST | 18% |

---

## 3. BOQ (Bill of Quantities) — 11 Items

| Item | Unit | Qty | Rate (₹) | Amount (₹) | Category |
|---|---|---|---|---|---|
| EXC-001 Earthwork excavation | Cum | 675.000 | 74.30 | 50,152.50 | Civil |
| CC-001 Cement concrete 1:2:4 | Cum | 33.750 | 5,236.00 | 176,715.00 | Civil |
| BRICK-001 Brick masonry | Cum | 19.200 | 4,562.00 | 87,590.40 | Civil |
| PLASTER-001 Cement plaster | Sqm | 200.000 | 285.00 | 57,000.00 | Civil |
| REINF-001 Reinforcement steel | MT | 45.000 | 5,896.00 | 265,320.00 | Civil |
| FORM-001 Form work | Sqm | 250.000 | 385.00 | 96,250.00 | Civil |
| REFILL-001 Refilling trenches | Cum | 450.000 | 45.00 | 20,250.00 | Civil |
| DIP-100MM DI pipes 100 mm | Rmt | 180.000 | 2,011.29 | 362,032.20 | Material |
| VALVE-100MM Gate valves | Nos | 4.000 | 8,500.00 | 34,000.00 | Material |
| SC-100MM Sluice valves | Nos | 2.000 | 12,500.00 | 25,000.00 | Material |
| AIRVALVE-50MM Air valves | Nos | 3.000 | 3,200.00 | 9,600.00 | Material |

### Abstract (computed by system)

| Component | Amount (₹) |
|---|---|
| Civil Total | 753,277.90 |
| Material Total | 430,632.20 |
| Cost of Estimate | 1,183,910.10 |
| GST @ 18% | 213,103.82 |
| LS Provision | 0.00 |
| **Grand Total** | **1,397,013.92** |

Math verified: `Cost = Civil + Material`; `GST = Cost × 18%`; `GrandTotal = Cost + GST`. ✅

---

## 4. Role-Wise Responsibilities Executed

| Step | Role (User) | Action | Result |
|---|---|---|---|
| 1 | Manager (Rajesh Kumar) | Create estimate with BOQ | ✅ 201, Status=Draft |
| 2 | DGM (Srinivas Reddy) | Review / forward | ✅ Status=Submitted, owner=DGM |
| 3 | DGM | Approve → forward to GM | ✅ Status=DGM_Approved, owner=GM |
| 4 | GM (Venkatesh Rao) | Request OTP + Digital Sign | ✅ Status=Signed, SHA-256 hash stored |
| 5 | TenderOfficer (Tender Officer) | Publish tender (NIT) | ✅ Status=TenderPublished |
| 6 | ProcurementOfficer (Procurement Officer) | Create 3 agencies/bids, select winner | ✅ Status=AgencySelected |
| 7 | SiteEngineer (Site Engineer) | Start work + 4 progress entries | ✅ Status=WorkStarted |
| 8 | SiteEngineer | Complete work | ✅ Status=WorkCompleted |
| 9 | BillingOfficer (Billing Officer) | Create + submit Final bill | ✅ Status=Billing (estimate), Bill=Submitted |
| 10 | Manager → DGM → GM → Administrator | Bill approval chain | ✅ Bill Status=Paid |
| 11 | Administrator (Administrator) | Archive | ✅ Status=Completed |

**Workflow history recorded (9 steps):** Submit → Approve → DigitallySign → PublishTender → SelectAgency → StartWork → CompleteWork → SubmitBill → Archive. All timestamps and from/to users captured correctly.

---

## 5. Module-wise Results

### 5.1 Estimate & Digital Signature
- Estimate auto-numbered `EST/2026-27/001/0054`; version 1 snapshot created.
- GM signing required an OTP delivered to the dev mailbox and printed to the server console (dev mode). One attempt failed with `OTP has expired` (5-min window) — a fresh OTP succeeded. OTP is never returned to the client; only a masked email is shown. ✅
- Signature record persisted: `IsDigitallySigned=true`, `CertificateID=HMWSSB-DSC-000178`, `SignatureHash=943cb3eb…a9ef6a`.

### 5.2 Tender / NIT
- Tender **eTNO/2026-27/0020** (TenderID 21) auto-created on signing with `EstimatedCost = ₹13,97,013.92`. ✅

### 5.3 Agencies / Bids (3 samples)
| Agency | Code | Bid (₹) | Result |
|---|---|---|---|
| Hyderabad Infra Developers Pvt Ltd | AGY-001 | 13,20,000 | **Selected (lowest bidder)** |
| Sree Venkateswara Constructions | AGY-002 | 13,50,000 | Rejected (higher) |
| Megha Engineering & Infrastructures Ltd | AGY-003 | 13,87,500 | Rejected (higher) |

Agreement, security deposit (5%), performance guarantee (5%), contractor & work-order data stored for AGY-001. ✅

### 5.4 Work Progress (SiteEngineer)
| % | Stage | Remark |
|---|---|---|
| 25 | Foundation | Excavation + PCC base done |
| 50 | Superstructure | Masonry + RCC in progress |
| 75 | Piping & Valves | Hydro test passed |
| 100 | Testing & Commissioning | Commissioned |

### 5.5 Finance / Billing
- Final bill **BILL/RES-001/2026** (BillID 12): Bill Amount ₹11,74,148.67, GST ₹2,11,346.76, Net ₹13,85,495.43.
- Approval chain: Manager → DGM → GM → Accounts; on final approval `ApprovedAmount = NetAmount` and status **Paid**. ✅

### 5.6 Dashboard & Notifications
- Administrator dashboard: `completed = 1`, `total = 77`, `pendingTenders = 21`, `agenciesAssigned = 3`, `worksInProgress = 1`, `billsPending = 0`, `billsPaid = 12`.
- Notifications generated for each workflow transition; unread-count endpoint returned `{"count":1}` for the Administrator. ✅
- The original `ECONNREFUSED` proxy errors (back-end not running) are resolved — `/api` proxy and `/api/health` both return 200.

---

## 6. Review Findings

### 6.1 High — Role check flaw in `submitEstimate`
- **Observation:** The `POST /api/workflow/:id/submit` endpoint validates the **creator's** designation (`SELECT Designation FROM Users WHERE UserID = est.CreatedBy` must be `Manager`) instead of the **acting** user (`req.user`). It also has no ownership check.
- **Impact:** Any authenticated user can submit *any* Draft/Reverted estimate. Verified: the DGM token submitted the Manager's estimate and got **HTTP 200**; the workflow history records `Submit by Srinivas Reddy (DGM)`. The Manager's own later submit then failed because status was already `Submitted`.
- **Suggestion:** Check `req.user` is the creator/owner (`est.CreatedBy === req.user.UserID`), or at least that `req.user.Designation === 'Manager'`.

### 6.2 Medium — Tender status never advances during workflow
- **Observation:** After `publish-tender` and `select-agency`, the `Tender.Status` remains `Draft`; it is never updated to `Open`/`Awarded`.
- **Impact:** `dashboard.stats.modules.awardedTenders = 0` even though an agency was selected and work began; NIT lists show stale status.
- **Suggestion:** Set `Tender.Status = 'Open'` on publish and `'Awarded'` on agency selection.

### 6.3 Low — `worksInProgress` miscounts completed works
- **Observation:** Dashboard counts distinct estimates having *any* progress row `< 100%`. A fully completed work with staged entries (25/50/75/100) still counts as "in progress" after completion.
- **Suggestion:** Exclude estimates whose header status is `WorkCompleted`/`Billing`/`Completed`, or drive the count from the estimate status.

### 6.4 Info — OTP 5-minute expiry
- Expired OTP correctly rejected with `400 OTP has expired`; the resend flow (30 s cooldown) worked. Expected behaviour, no change needed.

### 6.5 Info — Estimate numbering continuity
- The new estimate took sequence `0054` in FY 2026-27 / ward code `001`, continuing cleanly from existing data with no collision.

---

## 7. Conclusion

The complete life-cycle of a "Reservoir" work — from BOQ-based estimate creation through approval, OTP-verified digital signing, tender publication, bid evaluation/agency selection, work progress, billing and final archive to `Completed` — works end-to-end across all 9 roles. Core financial calculations (abstract, GST, bill net amounts) are accurate and persisted. No source code was modified during this test.

The **role-check flaw in `submitEstimate` (6.1)** is recommended for immediate fix as it affects workflow integrity. The tender-status (6.2) and dashboard counting (6.3) issues are low-risk consistency improvements.
