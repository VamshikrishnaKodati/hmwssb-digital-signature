# HMWSSB E2E Workflow Validation

Playwright runner that executes the golden role-based workflow of the HMWSSB
Works Management System against the real UI and validates business state
through the app's own API. Figma frames captured from the plugin act as the
visual reference layer.

## Prerequisites

- Repo DB seeded (`db/seeds/seed.js`) and reachable.
- `client/node_modules` and `server/node_modules` installed (seeded users log in
  with `password123`).
- Chromium for Playwright: `npx playwright install chromium` (run once).

## Run

```sh
npm install            # in e2e/
node self-test.js      # sanity check of step list, report, references
node runner.js full    # full golden workflow (spawns own API + client)
node runner.js list    # list steps
node runner.js from <stepId>   # resume from a step
node runner.js only <stepId>   # run one step
node runner.js role <Role>     # steps for one role (e.g. SiteEngineer)
node runner.js replay          # rerun the steps that failed last time
```

The runner spawns its own API (`PORT=5201`, `NODE_ENV=development`) and Vite
client (`5280`, `VITE_API_TARGET=http://localhost:5201`) so it never collides
with a running docker stack on 5001/5173.

Env overrides (or `e2e/.env`):

| var | default | meaning |
|-----|---------|---------|
| `E2E_API_PORT` | `5201` | API port |
| `E2E_CLIENT_PORT` | `5280` | client port |
| `E2E_SPAWN_API` | `1` | `0` to use an already-running API |
| `E2E_SPAWN_CLIENT` | `1` | `0` to use an already-running client |
| `E2E_HEADFUL` | `` | `1` for a visible browser |
| `E2E_OTP_FILE` | `` | optional file to poll for OTP codes |

## How OTP is handled

Signature OTPs are single-use and stored hashed — the runner never sees them in
any API response. The spawned dev API logs each code:

```
[OTP][DEV] Signature OTP for estimate e/... (user ...): 123456
```

The runner captures that line from the server stdout and feeds the digits into
the sign dialog, so the OTP flow is exercised for real (including a wrong-OTP
rejection) without touching the mailer.

## Golden workflow (30 steps)

Manager creates/submits → DGM approves → GM signs with OTP (owner moves to
TenderOfficer) → tender published → 3 bids → technical + financial evaluation
(L1 award) → agency → Site Engineer starts/completes work → progress → bill →
M→DGM→GM→Accounts approval chain → archive. Negative guards (OTP reuse, signed
immutability, duplicate start-work) and a role-permission matrix run in the
same pass.

Two known product defects are surfaced as FAIL steps and validated by API
fallback so the run can continue:

1. **Agency creation**: `AgencyList` loads `/estimates?status=Signed` for the
   `Add Agency` dropdown, but the API requires `TenderPublished` — no UI path
   exists to create an agency for a live estimate.
2. **Progress entry**: `ProgressList` also loads `?status=Signed`, but progress
   is only valid for `AgencySelected`+ — active works are missing from the
   dropdown.

## Figma references

1. `node e2e/ref-server.js` (listens on `http://localhost:4725`).
2. In Figma, select a frame, open the plugin, switch to **Workflow Reference**
   and capture — the plugin POSTs `<stepId>.json` (route, status, element
   names) plus a PNG to the ref server, which stores them under
   `e2e/references/`.
3. The runner checks each step's reference (elements present, no horizontal
   overflow) and lists any step without a capture in the report notes.

Pixel-perfect comparison is deliberately out of scope for v1; structural
checks + screenshots are the contract.

## Output

`e2e/evidence/report.txt` (PASS/FAIL/SKIP per step with expected/actual),
`e2e/evidence/last-run.json` (drives `replay`), screenshots per step under
`e2e/evidence/screens/`, and server/client logs.

## Deferred (out of v1 scope)

- Expired-OTP test (needs clock/DB manipulation).
- Pixel diffing of references (add pixelmatch once the reference set is frozen).
- Heavy multi-user concurrency beyond the existing duplicate-transition guards.
