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
