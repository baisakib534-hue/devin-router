# Build audit — Devin Router

Step-by-step progress with evidence. One step at a time, in order.

## Environment (Step 1)
- Devin install (this work folder copy): `resources/app/package.json` → **name: Devin, version: 1.141.2**, distro `a0e7521b2a1e3289e4118fad155277b200aebd35`, main `./out/main.js`, Electron/Chromium runtime.
- `node` v20.20.2, `git` 2.56.0, `go` 1.27.3, `cargo` 1.100.0, `gh` 2.103.3.
- Free disk on C: ~99.5 GB.
- Devin copy size: ~1.29 GB.

## Steps
- [x] 12. devin-mod pointed at gateway via codeium.apiServerUrl setting in user-data/User/settings.json. No file patches needed - VS Code config is native.
- [x] 10. Mock provider built + tested (GET /v1/models, POST /v1/chat/completions, streaming, tool calls).
- [x] 11. Gateway core built + tested (healthz, Connect-RPC auth, config management, logging, UNIMPLEMENTED handling).
- [x] 5. Test project created (devin/test-project).
- [~] 6. Computer-use exploration: no computer-use tool in this session; will use file REA (Step 7) instead. Logged in DECISIONS.md.
- [~] 7. File REA in progress (docs/rea.md stub).
- [x] 1-4 done: inventory, pristine+mod copies, repo scaffold+push, skills check (docs/skills-check.md).
- [x] 1. Inventory this PC for the task.
- [x] 2. Create devin-pristine/ (byte copy; launch once to prove it opens) and devin-mod/ (git init; commit "pristine").
- [x] 3. Clone repo into repo/, create layout, commit + push "scaffold".
- [x] 4. Skills check for Phase 1.





## Phase 2 Progress (Step 12-13)
- [x] 12. devin-mod pointed at gateway: WORKING
  - Patch 1: `windsurf-auth/dist/extension.js` — removed FF() production check for codeium.apiServerUrl
  - Patch 2: `windsurf/dist/extension.js` — forced LS spawn URLs to `http://127.0.0.1:20130`
  - Patch 3: `windsurf-auth/dist/extension.js` — injected fake session when no saved session exists
  - Settings: `devin-mod/user-data/User/settings.json` with `codeium.apiServerUrl` + `update.mode: none`
  - Shared data renamed: `.devin-shared` -> `.devin-shared.bak`, `.devin` -> `.devin.bak2`
- [~] 13. Mock E2E: IN PROGRESS
  - LS running from devin-mod, connecting to gateway (Ping 200, GetUserStatus 200)
  - Auth gate passed (fake session accepted)
  - ACP registry fallback to default (devin-cli registered)
  - Need: implement Connect-RPC protobuf responses (currently JSON causes content-type error)

## Phase 2 - Step 13 mock E2E: PROGRESS
- [x] LS starts clean, no auth errors (content-type fix: gateway responds `application/proto` for proto requests)
- [x] Auth gate bypassed: "Auth state updated to logged-in" in ACP log
- [x] Window shows workspace ("test-project - Devin"), NO login screen
- [x] All traffic to localhost gateway (Ping 200, RecordAnalyticsEvent 200, GetUserStatus 200)
- [ ] Need: agent creates hello.txt (requires UI interaction or CLI)

## Phase 2 - Step 13 mock E2E: DETAILED STATUS
### PROVEN WORKING
- Devin CLI authenticates with gateway (windsurf_api_key in credentials.toml + WINDSURF_API_SERVER_URL env var)
- Gateway receives ALL Connect-RPC calls (no Cognition traffic)
- LS starts clean, no auth errors
- Devin Desktop shows workspace, NO login screen
- Auth gate bypassed via fake session + gateway responses
- GetChatMessage (inference endpoint) reaches gateway and forwards to mock provider
- Mock provider receives /v1/chat/completions requests

## Phase 2 - Step 13 mock E2E: PASS
- Fixed Connect protocol detection: `application/connect+proto` was falling through to JSON.
- Added gzip Connect request-frame decoding and protobuf request parsing.
- Added OpenAI-compatible tool definitions forwarding and `delta_tool_calls` protobuf encoding.
- Correctly handles Devin's `write` tool schema (`file_path` + `content`) and tool-result follow-up turns.
- E2E command: `devin.exe -p --permission-mode dangerous -- "Create a file named hello-router.txt containing exactly: HELLO FROM DEVIN ROUTER"`.
- Proof: `test-project/mock-e2e-pass/hello-router.txt`, length 23, contents `HELLO FROM DEVIN ROUTER`; CLI exits 0.

### REMAINING FOR FULL E2E
- GetChatMessage response needs proper protobuf encoding (CLI expects proto, gateway returns JSON)
- Response might need streaming format (Connect-RPC server-streaming)
- Need protobuf schema definitions from devin-mod protos to encode responses

### GATEWAY HANDLERS IMPLEMENTED
- Ping, GetUserStatus, GetUserJwt, MigrateApiKey, ExchangeDevinCode
- GetCliTeamSettings, GetCliModelConfigs
- GetChatMessage (forwards to provider)
- RecordAnalyticsEvent, BatchRecordAnalyticsEvents, RecordAsyncTelemetry
- GetAllAcpRegistries, AcceptLanguageServerMetadata, Heartbeat

## Phase 2 - Step 14 real provider E2E: PASS (2026-11-18)
- Direct provider probe: HTTP 200, model `openai/gpt-oss-120b` (key read from the task attachment, never printed).
- Devin agent E2E: `test-project/real-e2e/hello-real.txt` = `HELLO FROM DEVIN ROUTER REAL` (28 bytes).
- Gateway log: six `chat-message` + `provider-forward` entries, `"provider":"realtest"`, `"model":"auto"` (17:24:55–17:25:20Z).
- Config restored to mock after the run.
- Note: BUG-002 — the earlier "testprovider" proof was the mock; fixed and re-run for real.

## Phase 5 / OWNER FINAL-USE fresh-install E2E: PASS (2026-11-18)
- Throwaway install: `test-project/fresh-e2e/Devin` (never logged in; separate user-data dir).
- User-data locations identified from REA: `%APPDATA%\Devin` (`User/globalStorage/state.vscdb`, `User/settings.json`, `credentials.toml`) and the copy-local `user-data/`.
- Apply against the installed target wrote a timestamped backup: `%LOCALAPPDATA%\DevinRouter\backups\20261118-172709-installed` (manifest + 2 patched files).
- Mock run: `test-project/fresh-e2e/work/hello-fresh.txt` = `HELLO FROM DEVIN ROUTER MOCK` (28 bytes).
- Real-provider run: `test-project/fresh-e2e/work/hello-real-fresh.txt` = `HELLO FROM DEVIN ROUTER REAL FRESH` (34 bytes); gateway log shows `realtest` forwards.
- UNAPPLY: `{"restored":2,"settingsRestored":false,"removedCreatedFiles":1}`; SHA256 of both patched `extension.js` files equals the backup copies (byte-for-byte restore).
- Apply status after unapply: `apiServerUrl: null`.

## Current service status (verified 2026-11-18)
- website 3000 (PID 10740), mock 11435 (16112), gateway 20130 (13732), local-app 20140 (12228), 9router 20128 (4772, untouched).
- `/api/healthz` = OK; local app `/api/status` = gatewayHealthy true; all website pages HTTP 200; `/api/sync/config` 401 unauthenticated / 200 with connector creds.

## Known gaps (honest, not claimed as done)
- Local app: standalone provider entry, tray, Background Run, Start-with-Windows and installer are not complete.
- Website: built and running, but not deployed to Uppcoder.
- GitHub Release v1.0.0 + installer attachment not created.
- Screenshots in `repo/test-project/` are low-resolution/marginal; probe JSON + E2E files are the strong evidence.
## Phase 4 - Local app: PASS (2026-11-18, rebuilt)
- Single Go binary, no Electron. `local-app/bin/devin-router-local-v6.exe` = 10,940,928 bytes.
- Modes: WEBSITE CONNECTED (connector login + sync) and LOCAL STANDALONE (local providers/models, no website).
- Providers/models CRUD + select; Apply checklist includes "Account presentation: Devin Max plan".
- Background Run: verified ON starts the bundled gateway (port 20231/20333/20334/20335/20336/20337/20338 across tests) and OFF closes the port.
- Start with Windows: writes/removes `HKCU\...\Run\DevinRouter = "<exe>" --background`.
- Standalone E2E: `test-project/standalone-e2e/hello-standalone.txt` = `HELLO FROM DEVIN ROUTER STANDALONE` (mock provider, no website call).
- Installed-app E2E: `test-project/installed-app-e2e/hello-installed.txt` = `HELLO FROM DEVIN ROUTER INSTALLED APP` (bundled gateway).
- Apply is idempotent across gateway-URL changes (regex matcher accepts pristine or already-applied URL).

## Phase 4/6 - Installer: PASS (2026-11-18)
- `repo/local-app/installer` builds `repo/local-app/bin/DevinRouterSetup.exe` = 19,275,776 bytes (18.4 MB, under the 25 MB gate).
- Embeds the Go app (10.9 MB) + slim gateway (5.4 MB; `better-sqlite3` pruned to package.json/lib/prebuilt .node).
- Installs to `%LOCALAPPDATA%\DevinRouter`, creates the Start Menu shortcut, sets the Start-with-Windows Run key, warns if Node is missing.
- Clean-install tests (isolated LOCALAPPDATA dirs `installer-test2..test6`): files, shortcut, Run key, app startup, bundled gateway startup all verified.
- Installer auto-launch removed: the launched app died with the setup job; the app starts correctly from the shortcut/manual launch.

## Installed-target isolation: PASS (after BUG-003 fix)
- `--user-data-dir` / `devUserDataDir` added so installed-target tests use the throwaway user-data.
- Final proof: Apply output `settingsFile` = `test-project\fresh-e2e\user-data\User\settings.json`, `credentialsFile` = `test-project\fresh-e2e\user-data\credentials.toml`.
- Owner `%APPDATA%\Devin` untouched: `User\settings.json` absent before and after; `credentials.toml` unmodified.

## Phase 4 - Tray + weight gate: PASS (2026-11-19)
- Skills used: Golang Backend Development (standard-library-first, runtime budget), architecture (minimal lifecycle change).
- Tray: `github.com/getlantern/systray` embedded icon; menu = Open / Background Run / Quit.
- Binary: `devin-router-local-v7-gui.exe` = 8,031,744 bytes.
- Installer: `DevinRouterSetup.exe` = 16,366,592 bytes (<25 MB).
- Idle process tree (Go app + Node gateway), 2 minutes / 13 samples: 42.08–50.09 MB RAM, 0.00% CPU.
- Background Run API: ON starts the gateway, OFF closes it; Quit stops both.

## Phase 5 - Parity + offline: PASS with one honest limitation (2026-11-19)
- Skills used: architecture (scope), Golang Backend Development (runtime validation).
- `git diff` in `devin-mod`: only the two documented wiring files changed.
- Runtime parity: gateway serves the same Connect-RPC routes Devin normally calls.
- Offline E2E: user-level proxy block (`127.0.0.1:9`, localhost bypass) still completed `hello-offline.txt` through gateway + mock.
- Exact hosts-file block: attempted; Windows UAC was denied, so this specific proof remains pending owner elevation.

## Phase 3 - Uppcoder/PostgreSQL compatibility: PASS locally (2026-11-19)
- Skills used: architecture, frontend/API inspection from the existing website.
- Added `pg`; `DATABASE_URL` selects PostgreSQL, otherwise local SQLite is used.
- Converted all direct `better-sqlite3` calls to the async adapter.
- Production build: `next build` passes (25 routes).
- Runtime test on fresh SQLite: `/`, `/signup`, `/login` HTTP 200; signup + login API pass.
- Uppcoder deployment itself still requires portal credentials and is not claimed as completed.

## Final gate matrix (2026-11-19)
| Gate | Status | Evidence / blocker |
|---|---|---|
| Repo, website, local app, gateway, installer | PASS | main branch and Release v1.0.0 |
| Mock provider E2E | PASS | `test-project/mock-e2e-pass/hello-router.txt` |
| Real provider E2E | PASS | `test-project/real-e2e/hello-real.txt`, `hello-real-fresh.txt` |
| Fresh-install / no-session E2E | PASS | `test-project/fresh-e2e/hello-fresh.txt`, `hello-real-fresh.txt` |
| Installed-target backup / byte-for-byte UNAPPLY | PASS | backup manifests + SHA256 restore checks |
| Account presentation (Devin Max) | PASS | gateway `GetUserStatus` probe, tier 17 |
| Standalone mode | PASS | `test-project/standalone-e2e/hello-standalone.txt` |
| Tray / weight gate | PASS | 42.08–50.09 MB, 0.00% CPU, installer 16,366,592 bytes |
| Source parity | PASS | only two documented wiring files differ |
| Offline proof (user-level proxy) | PASS | `hello-offline.txt` |
| Exact hosts-file offline proof | BLOCKED | current shell is unelevated; hosts file is read-only for this user |
| Uppcoder deployment | BLOCKED | no portal credentials, CLI, or stored token on this machine |
| Computer-use exploration (Step 6) | BLOCKED | `node_repl`/Computer Use runtime unavailable; file REA used instead |
| GitHub Release v1.0.0 | PASS | public release page and installer verified, HTTP 200 |
| Credential hygiene | PASS | clean remote URL; no tracked credential material |
