# Devin Router

A system that lets the real **Devin Desktop** run on the owner's own AI providers — no Devin login, no Cognition cloud.

## Three parts, one product

- **Website** (`website/`) — the owner's home for accounts, providers, models, connector credentials, devices, and request logs. Next.js, deploys to Uppcoder.
- **Local software** (`local-app/`) — a small, light Windows desktop app + installer. Login with connector credentials → pull providers/models → select a model → **Apply** points Devin at the local gateway. Also has a **Standalone** mode (runs the gateway itself, tray-resident, syncs up when the website returns).
- **Gateway** (`gateway/`) — the engine inside the local software. Sits between Devin and the provider: answers Devin's auth as "logged in" locally, translates model requests to the selected provider's API (incl. streaming + tool calls). Cognition's servers receive nothing.

## Status

See `AUDIT.md` for the step-by-step build log, `DECISIONS.md` for logged decisions, `PATCHES.md` for Devin patches, `BUGS.md` for the bug loop, and `REPORT.md` for the final report.

## Layout

```
website/      Next.js app (accounts, providers, models, connect, devices, logs)
local-app/    Go desktop app + gateway + installer
gateway/      Standalone gateway engine (shared by local-app)
docs/         Design docs, deploy recipe, reference screenshots
```
