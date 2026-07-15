# HMWSSB Works Module - Developer Handoff Plan

## 1. Project Objective
Deliver a complete HMWSSB Works Module with estimate preparation, approval workflow, reports, OTP verification, digital signature, and admin capabilities.

## 2. Current Status Summary
The project already has:
- a React/Vite frontend,
- an Express backend,
- MongoDB connectivity setup,
- an improved estimate preparation UI,
- OTP generation and verification logic,
- SHA-256 signature generation,
- email/SMS delivery hooks,
- backend tests for OTP utilities.

## 3. Milestone Checklist

### Phase 1 - Authentication
- [ ] Implement login with username and password
- [ ] Implement JWT-based session handling
- [ ] Add role-based route protection
- [ ] Create user seed data for Admin/Manager/DGM/GM/Viewer

### Phase 2 - Item Master
- [ ] Build Item Master CRUD APIs
- [ ] Create Item Master admin UI
- [ ] Support item search and autofill in estimate form
- [ ] Store item data in MongoDB

### Phase 3 - Estimate Preparation
- [ ] Save estimates to MongoDB
- [ ] Save estimate items separately
- [ ] Load previously saved estimates
- [ ] Add draft and submit states
- [ ] Validate required fields before submission

### Phase 4 - Abstract and Calculations
- [ ] Generate abstract from estimate items
- [ ] Support GST and LS totals
- [ ] Provide summary cards and downloadable views

### Phase 5 - Approval Workflow
- [ ] Implement workflow statuses
- [ ] Add DGM review and GM review actions
- [ ] Support revert and resubmit actions
- [ ] Track movement history

### Phase 6 - Reports & Search
- [ ] Add report filtering by name, date, amount, status, region, and zone
- [ ] Create report listing and detail views
- [ ] Support export-ready data structure for Excel

### Phase 7 - Version Management
- [ ] Maintain version history for estimates
- [ ] Save snapshots on each edit
- [ ] Expose version history UI

### Phase 8 - OTP & Digital Signature
- [ ] Connect OTP sending to real mail/SMS providers
- [ ] Ensure OTP expiry and attempt limits are enforced
- [ ] Generate and store signature data
- [ ] Add audit log entries for signature actions

### Phase 9 - Admin & Audit
- [ ] Add admin user management
- [ ] Track audit logs for actions
- [ ] Add soft-delete support for records

### Phase 10 - Testing & Deployment
- [ ] Add integration tests
- [ ] Improve error handling and toast messages
- [ ] Prepare production environment configuration
- [ ] Deploy frontend and backend

## 4. Sprint-Wise Task Breakdown

### Sprint 1 - Core Authentication & Data Model
- Create user model and authentication endpoints
- Add seed users
- Create item model and estimate model
- Add database validation rules

### Sprint 2 - Estimate Creation & Persistence
- Build estimate save/load APIs
- Connect UI form to backend
- Implement estimate status handling

### Sprint 3 - Workflow & Movement History
- Implement approval actions
- Create movement tracking API
- Show movement history in UI

### Sprint 4 - Reports, Versioning & Export
- Build reports with filters
- Add version history support
- Prepare data export format for Excel

### Sprint 5 - Hardening & Deployment
- Add tests, logging, and error handling
- Add responsive UI polish
- Configure deployment pipeline

## 5. Suggested Developer Notes
- Keep backend APIs modular and role-aware.
- Use consistent status values across the app.
- Keep audit logs for all approval and signature actions.
- Use environment-based configuration for mail and SMS.
- Prefer reusable services over duplicated logic.

## 6. Handoff Summary
This project is now at a strong foundation stage. The main next focus should be moving from UI-only features to full backend persistence, workflow automation, and role-based approval management.
