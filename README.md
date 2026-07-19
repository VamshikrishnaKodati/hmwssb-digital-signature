# HMWSSB Digital Signature System

A complete works management system for Hyderabad Metropolitan Water Supply and Sewerage Board (HMWSSB) with digital signature capabilities, OTP-based authentication, and PAdES-compliant PDF signing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Bootstrap 5, React Router 7 |
| Backend | Node.js 20+, Express 5, Mongoose 9 |
| Database | MongoDB 7 |
| PDF Signing | @signpdf, node-forge (RSA-2048), RFC 3161 timestamps |
| Auth | JWT, bcrypt, HMAC-SHA256 OTP |
| Docker | Multi-stage builds, health checks, auto-restart |

## Requirements

- Node.js 20+
- MongoDB 7 (local or Docker)
- Docker & Docker Compose (optional)

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

### Option 2: Local Development

```bash
# Setup (installs deps, generates .env if missing)
bash setup.sh          # Linux/macOS
.\setup.ps1            # Windows PowerShell

# Start both server and client
bash start.sh          # Linux/macOS
.\start.ps1            # Windows PowerShell
```

Or manually:

```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:5000

## Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Min 32 characters. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | No | Server port (default: 5000) |
| `SMTP_*` | No | Email delivery settings |
| `TWILIO_*` | No | SMS delivery settings |
| `P12_SIGNING_PASSWORD` | No | Password for P12 signing certificate |
| `REDIS_ENABLED` | No | Set to `false` to use in-memory cache (default) |

## Default Test Accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@123456` | Admin |
| `manager01` | `Manager@1234` | Manager |
| `dgm01` | `Dgm@12345678` | DGM |
| `gm01` | `Gm@123456789` | GM |
| `ce01` | `Ce@123456789` | Chief Engineer |
| `engineer01` | `Engineer@1234` | Engineer |

## Project Structure

```
├── server/                  # Backend API
│   ├── config/              # DB, Redis configuration
│   ├── controllers/         # Route handlers
│   ├── middleware/           # Auth, validation, error handling
│   ├── models/              # Mongoose schemas (14 models)
│   ├── routes/              # Express routes (9 route groups)
│   ├── services/            # Business logic (11 services)
│   ├── tests/               # Node.js built-in tests (11 files)
│   ├── utils/               # Helpers (logger, email, SMS, PDF)
│   └── validations/         # Joi schemas
├── client/                  # Frontend SPA
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # Auth context
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # 9 page components
│   │   ├── services/        # API client (axios)
│   │   └── styles/          # Global CSS
│   └── nginx.conf           # Production reverse proxy
├── docker-compose.yml       # Full stack orchestration
├── .github/workflows/ci.yml # CI/CD pipeline
├── setup.sh / setup.ps1     # One-command setup
└── start.sh / start.ps1     # One-command start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/profile` | Get current user profile |
| POST | `/api/estimates` | Create estimate |
| GET | `/api/estimates` | List estimates (paginated) |
| PATCH | `/api/estimates/:id/status` | Update workflow status |
| POST | `/api/otp/send` | Send OTP for signing |
| POST | `/api/otp/verify` | Verify OTP and sign |
| POST | `/api/pdf/generate` | Generate abstract PDF |
| GET | `/api/signatures/verify/:id` | Verify digital signature |
| GET | `/api/health` | Health check |
| GET | `/api/status` | Service status |

## Workflow

```
Draft → Abstract Generated → Submitted → DGM Review → GM Review → OTP Pending → Digitally Signed → Completed
                    ↑                   ↓
                    └── Reverted ←──────┘
```

## Running Tests

```bash
cd server
npm test
```

## Docker Commands

```bash
docker compose up --build -d    # Start all services
docker compose down              # Stop all services
docker compose logs -f server    # View server logs
docker compose restart server    # Restart server
```

## License

ISC
