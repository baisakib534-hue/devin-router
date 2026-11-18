# Devin Router Website

Next.js app for accounts, providers, models, connector credentials, devices, and request logs.

## Run locally

```powershell
cd website
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```powershell
npm run build
npm start
```

## Data

- Local dev uses SQLite at `website/data/devin-router.db` (git-ignored).
- Production uses `DATABASE_URL` (Postgres-ready).

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | production | Postgres connection string (falls back to local SQLite) |
| `SESSION_SECRET` | production | Session signing secret |

## Pages

- `/` landing, `/signup`, `/login`
- `/dashboard` account summary
- `/providers` CRUD + Fetch Models + Test Connection
- `/models` grouped list, select default
- `/connect` connector username/password + devices + revoke
- `/logs` latest 100 request log entries
- `/settings` change password, regenerate connector credentials

## Sync API (for the local app)

Auth: HTTP Basic with the connector username/password.

- `POST /api/sync/hello` — device hello
- `GET /api/sync/config` — providers + models + settings
- `POST /api/sync/config` — push standalone changes up
- `POST /api/sync/logs` — append gateway log summaries