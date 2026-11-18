# Deploy Devin Router Website to Uppcoder

## 1. Create the project

- Sign in at `https://portal.uppcoder.com`.
- Go to **Stacks → Create → Blank stack**.
- Choose **Next.js** as the main app.
- Add **PostgreSQL**; Uppcoder wires `DATABASE_URL` automatically.
- On the Next.js card, choose **Connect repository** and enter:
  - Repo: `https://github.com/baisakib534-hue/devin-router`
  - Branch: `main`
  - Root directory: `website`

## 2. Build settings

| Setting | Value |
|---|---|
| Framework | Next.js |
| Install command | `npm install` |
| Build command | `npm run build` |
| Start command | `npm start` |
| Node version | 20+ |

## 3. Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `SESSION_SECRET` | Long random string (32+ chars) |

The website includes the `pg` driver and automatically uses PostgreSQL when `DATABASE_URL` is present. Without `DATABASE_URL`, local development falls back to SQLite.

Generate a secret locally:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

## 4. Port

Uppcoder injects `PORT`; `npm start` runs `next start` without a hardcoded port.

## 5. After deploy

1. Open the deployed URL.
2. Sign up for the owner account.
3. Add a provider (base URL, API key, protocol).
4. Fetch/add models and select a default.
5. Open **Connect** and copy the connector username/password for the local app.

## 6. Local dev fallback

```powershell
cd website
npm install
npm run dev
```

SQLite is used automatically when `DATABASE_URL` is unset.
