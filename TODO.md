# HMWSSB Works Module - Implementation TODO

## Step 1: Codebase inspection (completed)
- Reviewed OTP backend (send/verify), OTP model, and OTP frontend modal.
- Reviewed JWT auth middleware and estimate create/get endpoints.
- Reviewed Item master backend (Item model/controller).
- Reviewed Prepare Estimate UI: EstimateForm + MaterialTable.
- Reviewed abstract PDF generation: pdfService/pdfTemplate/pdfController/pdfRoutes.

## Step 2: Planned improvements (to implement)
### 2.1 OTP hardening + workflow integration
- Remove hardcoded `managerId: "EMP001"` in `client/src/components/OTP/OTPModal.jsx`.
- Update `server/controllers/otpController.js` to derive managerId from JWT (`req.user`) instead.
- Add workflow guards so OTP send/verify only allowed after `Approved` state.

### 2.2 Prepare Estimate: item master + calculations
- Move from hardcoded `itemMaster` in `MaterialTable.jsx` to backend-driven item master (search + auto-fill unit/rate/gst/category).
- Ensure MaterialTable uses correct GST/LS/grand total calculation rules.
- Ensure estimate row persistence includes all required fields and aligns with backend schemas.

### 2.3 Data model extensions for workflow/versioning
- Add/implement `estimateMovements` and `estimateVersions` models + routes.
- Extend `server/models/Estimate.js` / `EstimateItem.js` to include GST totals, LS, grandTotal, and status transitions metadata.

### 2.4 Abstract generation persistence
- After generating PDF, store abstract metadata/path in `abstracts` collection.
- Link abstract to estimateId + version.

### 2.5 Reports + Excel export + audit logs
- Implement reports filters endpoint and UI wiring.
- Add Excel export endpoint.
- Add auditLogs for approval actions, movement/version creation, and OTP/signature.

## Step 3: Testing
- Run backend + frontend sanity checks.
- Verify OTP rules: expiry (5 min), max 3 attempts, hashed OTP storage.
- Verify estimate save and abstract generation end-to-end.

