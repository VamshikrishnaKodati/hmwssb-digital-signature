# HMWSSB Works Management System - Digital Signature

Full-stack application for government works estimation with OTP-based digital signature (PAdES), RFC 3161 timestamping, and role-based approval workflow.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** MongoDB
- **PDF Signing:** node-forge + @signpdf
- **Redis:** ioredis (optional, falls back to in-memory)

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MongoDB](https://www.mongodb.com/) v6+ (running on localhost:27017)
- npm

## Quick Start

### 1. Clone the project

```bash
git clone <your-repo-url> hmwssb-digital-signature
cd hmwssb-digital-signature
```

### 2. Install dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 3. Configure environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and set at minimum:

```env
JWT_SECRET=any-random-string-at-least-32-characters-long
MONGO_URI=mongodb://127.0.0.1:27017/hmwssb
P12_SIGNING_PASSWORD=dev-signing-password-1234
```

### 4. Start MongoDB

```bash
# Windows (if installed as service, it's already running)
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### 5. Start the app

```bash
# Terminal 1 - Backend (port 5000)
cd server
npm run dev

# Terminal 2 - Frontend (port 5173)
cd client
npm run dev
```

Open http://localhost:5173

## Test Accounts

All emails route to `kodativamsikrishna@gmail.com` via Gmail `+` aliasing. All SMS go to `9392598134`.

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@123456` |
| Manager | `manager01` | `Manager@1234` |
| DGM | `dgm01` | `Dgm@12345678` |
| GM | `gm01` | `Gm@123456789` |
| Chief Engineer | `ce01` | `Ce@123456789` |
| Accounts | `accounts01` | `Accounts@123` |
| Tender Officer | `tender01` | `Tender@12345` |
| Site Engineer | `engineer01` | `Engineer@1234` |

## Development Workflow

```
Admin creates users
    |
Manager logs in -> Prepares estimate -> Generates abstract -> Submits
    |
DGM reviews -> Submits
    |
GM approves -> Generates OTP
    |
    +-- Email -> kodativamsikrishna@gmail.com
    +-- SMS   -> 9392598134
    |
OTP verified -> Digital signature generated -> Signed PDF
    |
Audit log created
```

## Running Tests

```bash
cd server
node --test tests/*.test.js
```

## Project Structure

```
hmwssb-digital-signature/
  client/                  # React frontend
  server/
    config/                # DB, Redis config
    controllers/           # Route handlers
    middleware/             # Auth, rate limiting, validation
    models/                # Mongoose schemas
    routes/                # Express routes
    seeders/               # Hierarchy data
    services/              # Business logic (OTP, PKI, PDF signing, etc.)
    tests/                 # Test suite
    validations/           # Joi schemas
  docker-compose.yml
```

## Key Features

- **OTP Security:** HMAC-SHA256 hashing, timing-safe comparison, per-user/IP rate limits, cooldown, exponential backoff
- **PKI:** RSA-2048 key generation, X.509 certificates, P12 bundles (AES-256), cert chain verification
- **PDF Signing:** PAdES-B-B (ETSI.CAdES.detached) via @signpdf
- **Timestamping:** RFC 3161 via DigiCert TSA
- **Monitoring:** Prometheus-format metrics, health endpoints, threshold alerts
- **Compliance:** CERT-In 180-day log retention, append-only audit logs, 12-char password policy

## License

Internal use only - Hyderabad Metropolitan Water Supply & Sewerage Board
