# HMWSSB Works Management System

A complete works management system for Hyderabad Metropolitan Water Supply and Sewerage Board (HMWSSB) covering estimate preparation, multi-level approval workflow, tenders, agencies, work progress, billing, reports and PDF/Excel document export.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3.4, React Router 6 |
| Backend | Node.js 20+, Express 4, pg (node-postgres) |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Documents | PDFKit (PDF), ExcelJS (workbook export) |
| Tests | Node built-in test runner (`node --test`) |

## Requirements

- Node.js 20+
- PostgreSQL 16 (local or Docker)

## Quick Start

### Local Development

```bash
# Install dependencies (root + client + server)
npm run install:all

# Copy the env template and set DATABASE_URL / JWT_SECRET
copy server\.env.example server\.env

# Create the database (e.g. hmwssb), then run migrations and seeds
npm run migrate
npm run seed

# Start server + client together
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:5001
- Health: http://localhost:5001/api/health

Or run separately:

```bash
# Terminal 1 - Server
cd server && npm run dev

# Terminal 2 - Client
cd client && npm run dev
```

### Docker

```bash
docker compose up --build
```

## Environment Variables

Copy `server/.env.example` to `server/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/hmwssb` |
| `JWT_SECRET` | Yes | Signing secret. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | No | Server port (default: 5001) |
| `JWT_EXPIRES_IN` | No | Token lifetime (default: 8h) |
| `NODE_ENV` | No | `development` / `production` / `test` |

## Demo Accounts

All accounts share the password `password123`.

| Username | Role |
|----------|------|
| `manager` | Manager |
| `dgm` | DGM |
| `gm` | GM |
| `soradmin` | SoR Admin |
| `tender_officer` | Tender Officer |
| `director_admin` | Director of Administration |
| `site_engineer` | Site Engineer |
| `billing_officer` | Billing Officer |
| `admin_officer` | Administrator |

## Project Structure

```
├── db/                      # SQL migrations + seeds
│   ├── migrations/          # versioned SQL schema changes
│   ├── scripts/             # migration runner
│   └── seeds/               # core seed data
├── server/                  # Backend API (Express + pg)
│   ├── config/              # DB pool configuration
│   ├── controllers/         # Route handlers
│   ├── middleware/          # Auth, error handling
│   ├── routes/              # Express route groups
│   ├── seeds/               # users, SOR items, golden test data
│   ├── tests/               # node:test golden tests
│   └── utils/               # calc, PDF/Excel exporters, number-to-words
├── client/                  # Frontend SPA (React + Vite + Tailwind)
│   └── src/
│       ├── components/      # UI components
│       ├── contexts/        # Auth context
│       ├── pages/           # Route pages
│       └── utils/           # API client, helpers
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## API Endpoints

Main groups (all under `/api`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | Logout (clears client session) |
| GET | `/api/auth/profile` | Current user profile |
| PUT | `/api/auth/change-password` | Change password |
| GET/POST | `/api/estimates` | List / create estimates |
| GET/PUT | `/api/estimates/:id` | Get / update estimate |
| GET | `/api/estimates/:id/versions` | Version history |
| POST | `/api/workflow/:id/submit` | Submit for review |
| POST | `/api/workflow/:id/{revert,approve,sign,publish-tender,select-agency,start-work,complete-work,submit-bill,archive}` | Workflow transitions |
| GET | `/api/workflow/pending` | Pending approvals |
| GET | `/api/workflow/:id/history` | Workflow history |
| GET | `/api/items` | SOR item master (search/filter) |
| GET | `/api/lookups/*` | Regions, zones, divisions, circles, wards, users |
| GET | `/api/reports/*` | estimate-register, pending, approved, tender, agency, work-progress, billing, estimate-movement |
| GET | `/api/exports/:id/{pdf,excel}` | Complete PDF / Excel document export |
| GET | `/api/dashboard/stats` | Dashboard statistics |

## Workflow

```
Draft → Submitted → DGM_Approved → Approved → Signed → TenderPublished → AgencySelected → WorkStarted → WorkCompleted → Billing → Completed
   │       ↑
   └───────┴── Reverted (returns to creator, requires Action Taken Report)
```

Roles: Manager (create/submit) → DGM (approve) → GM (approve + digital sign & audit) → TenderOfficer (publish tender) → ProcurementOfficer (select agency) → SiteEngineer (start/complete work) → BillingOfficer (submit bill) → Administrator (archive/complete).

## Running Tests

```bash
cd server
npm test
```

Seeds a golden estimate and asserts the full workflow end-to-end (9 tests).

## Common Commands

```bash
npm run migrate     # run DB migrations (node db/migrate.mjs)
npm run seed        # seed hierarchy, users and item master
npm run build       # production build of client
npm run dev         # server + client concurrently
```

## License

ISC
