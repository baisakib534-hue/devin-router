# Devin Router Gateway

The engine that sits between Devin and the owner's AI providers.

## Run standalone

cd gateway
npm start
npm run start:mock

## How it works

1. Devin connects to the gateway via the codeium.apiServerUrl setting.
2. Gateway answers Devin auth endpoints locally - fixed local user, no Cognition cloud.
3. Gateway translates model requests to OpenAI-compatible providers.
4. Gateway logs every request to data/gateway.log (never API keys).

## Endpoints

- GET /api/healthz - returns OK
- POST /exa.*.*/* - Connect-RPC endpoints (auth, models, user status)
- GET /gateway/config - current config (keys redacted)
- POST /gateway/config - update config
- GET /gateway/logs - last 100 log entries
