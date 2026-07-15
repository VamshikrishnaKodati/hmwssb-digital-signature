# HMWSSB Works Module - Master Implementation Blueprint

## 1. Project Goal
Build a complete HMWSSB Works Module for estimate preparation, approval workflow, reports, OTP verification, and digital signature.

## 2. User Roles

| Role | Responsibilities | Permissions |
|------|------------------|-------------|
| Admin | Manage users, item master, permissions, reports | Full |
| Manager | Create/edit estimates, save draft, submit | Own estimates |
| DGM | Review, edit, revert, resubmit | Review assigned |
| GM | Final review, OTP verification, digital signature | Approve |
| Viewer | Read-only reports | View only |

## 3. Complete Modules
- Login & Authentication
- Dashboard
- Prepare Estimate
- Item Master
- Abstract
- Estimates With Me
- Reports
- Estimate Movement
- Version Management
- OTP Verification
- Digital Signature
- Excel Export
- Audit Logs
- Admin Panel

## 4. UI Pages
- Login
- Dashboard
- Prepare Estimate
- Estimate Details
- Estimates With Me
- Reports
- Movement History
- Version History
- OTP Modal
- Admin - Item Master
- Admin - User Management

## 5. Backend APIs
- POST /api/login
- POST /api/estimates
- GET /api/estimates
- PUT /api/estimates/:id
- POST /api/otp/send
- POST /api/otp/verify
- GET /api/reports
- GET /api/movement
- GET /api/version-history
- POST /api/items

## 6. MongoDB Collections
- users
- items
- estimates
- estimateItems
- abstracts
- estimateMovements
- estimateVersions
- otp
- auditLogs

## 7. Approval Workflow
Draft → Submitted → DGM Review → Reverted (optional) → Resubmitted → GM Review → OTP Verification → Digital Signature → Approved

## 8. Remaining Work
- Role-based login with JWT
- Item Master search with auto unit/rate
- Save estimate to MongoDB
- Abstract generation
- GST and LS calculation
- Estimate movement tracking
- Version management
- Reports with filters
- OTP backend
- Email & SMS integration
- Digital signature generation
- Excel export
- Audit logs
- Dashboard analytics
- Responsive UI polishing

## 9. Recommended Improvements
- Use React Select for searchable item master.
- Use React Hook Form for validation.
- Use Toast notifications.
- Prevent duplicate estimate IDs.
- Use soft delete instead of hard delete.
- Maintain version history for every edit.
- Store OTP hashes only.
- Log every approval action.
- Add loading indicators and skeleton screens.
- Implement centralized error handling.

## 10. Suggested Folder Structure

client/
  components/
  pages/
  services/
  hooks/
  context/

server/
  controllers/
  routes/
  models/
  services/
  middleware/
  utils/

## 11. Development Roadmap
- Phase 1: Authentication
- Phase 2: Item Master
- Phase 3: Estimate Preparation
- Phase 4: Abstract
- Phase 5: Estimates With Me
- Phase 6: Reports
- Phase 7: Movement & Version History
- Phase 8: OTP & Digital Signature
- Phase 9: Excel Export
- Phase 10: Testing & Deployment

## 12. Definition of Done
- All user roles functional
- End-to-end approval workflow working
- Reports searchable
- OTP verification working
- Digital signature generated
- Audit logs maintained
- Production-ready UI

## 13. Current Implementation Status
The project currently includes:
- frontend and backend project structure,
- estimate preparation UI with calculation logic,
- item master search and autofill experience,
- OTP generation and verification flow,
- SHA-256 signature generation,
- email and SMS delivery integration hooks,
- basic backend tests for OTP utilities.

## 14. Suggested Next Implementation Order
1. Authentication and role-based access
2. Item Master CRUD APIs
3. Estimate save and load APIs
4. Approval workflow and movement history
5. Report filtering and export
6. Audit logs and version history
7. UI polish and deployment preparation
