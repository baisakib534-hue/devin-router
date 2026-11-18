# Devin Router — Final Report

Date: 2026-11-18
Repo: `https://github.com/baisakib534-hue/devin-router`
Work folder: `C:\Users\sakim\OneDrive\Desktop\devin`

## 1. Route decision

**ROUTE F — fake backend.** The gateway speaks Devin's own Connect-RPC/protobuf surface and translates inference to OpenAI-compatible providers.

Evidence (full REA in `docs/rea.md`):
- The backend address is configurable/patchable via `codeium.apiServerUrl` plus two extension patches (`windsurf-auth`, `windsurf`).
- The protocol is Connect-RPC with protobuf, implemented in `gateway/src/server.js` (auth, user status, models, chat, telemetry, ACP registry).
- No TLS pinning blocks a local HTTP endpoint; all Devin traffic goes to `http://127.0.0.1:<gateway port>`.
- No Cognition domain receives traffic in any E2E proof (gateway log is the only inference path).

## 2. What runs

| Part | Port | Status |
|---|---|---|
| Website (Next.js + SQLite) | 3000 | Running, all pages HTTP 200 |
| Mock provider | 11435 | Running, `/v1/models` + `/v1/chat/completions` |
| Gateway | 20130 (dev), 2033x (installed tests) | Running |
| Local app (Go) | 20140 (dev), 202xx (tests) | Running |
| 9router | 20128 | **Untouched, never stopped** |

`gateway/src/probe-userstatus.mjs` returns:

```json
{
  "httpStatus": 200,
  "identity": { "name": "Sakib", "email": "sakibwriter7@gmail.com" },
  "plan": { "teamsTier": 17, "planName": "Devin Max" }
}
```

## 3. End-to-end proofs

### 3.1 Mock provider
- File: `test-project/mock-e2e-pass/hello-router.txt` (23 bytes) = `HELLO FROM DEVIN ROUTER`
- Chain: Devin CLI → gateway → mock provider (`mock.log` records the prompt and tool round-trip).

### 3.2 Real test provider
- Direct probe: HTTP 200, model `openai/gpt-oss-120b` (key parsed from the task file, never printed or committed).
- File: `test-project/real-e2e/hello-real.txt` (28 bytes) = `HELLO FROM DEVIN ROUTER REAL`
- Gateway log: six `provider-forward` entries, `"provider":"realtest"`, `"model":"auto"` (17:24:55–17:25:20Z).

### 3.3 Full product (website → local app → Devin)
- Local app `/api/apply` on port 20140 returned `ok:true` with the checklist (gateway, website route, backup, Devin Max plan, restart note).
- File: `test-project/localapp-e2e/hello-localapp.txt` = `HELLO FROM DEVIN ROUTER LOCAL APP`
- Website sync API verified with the connector credentials: `/api/sync/hello` 200, `/api/sync/config` 200; unauthenticated `/api/sync/config` correctly returns 401.

## 4. Fresh-install E2E (owner final-use add-on, mandatory)

Throwaway install: `test-project/fresh-e2e/Devin` (separate folder, never logged in; separate user-data dir `test-project/fresh-e2e/user-data`).

- **No hidden session dependency:** the flow needs no Devin login/session. `identity.cjs` has a candidate chain + preserve guard (BUG-001 fixed), and Apply works on a user-data dir with no `state.vscdb`.
- **Mock run:** `test-project/fresh-e2e/work/hello-fresh.txt` (28 bytes) = `HELLO FROM DEVIN ROUTER MOCK`
- **Real provider run:** `test-project/fresh-e2e/work/hello-real-fresh.txt` (34 bytes) = `HELLO FROM DEVIN ROUTER REAL FRESH`; gateway log shows `realtest` forwards.
- **Apply backup:** `%LOCALAPPDATA%\DevinRouter\backups\20261118-172709-installed` (manifest + 2 patched files).
- **UNAPPLY:** `{"restored":2,"settingsRestored":false,"removedCreatedFiles":1}`; SHA256 of both patched `extension.js` files equals the backup copies (byte-for-byte).
- **Apply status after unapply:** `apiServerUrl: null`.

## 5. Apply targets, backup, and UNAPPLY

The local app offers two targets:
- **Devin copy (devin-mod)** — development target.
- **Devin (installed)** — the owner's real use; full timestamped backup before any change, byte-for-byte restore.

Installed-target isolation (after BUG-003):
- `apply.cjs` accepts `--install-dir` and `--user-data-dir`.
- The local app config supports `devInstallDir`, `devModDir`, `devUserDataDir`.
- Final proof wrote `settingsFile`/`credentialsFile` only under `test-project/fresh-e2e/user-data`; the owner's `%APPDATA%\Devin` was untouched (`User\settings.json` absent before and after, `credentials.toml` unmodified).

**No hardcoded wiring:** `validatePatches()` checks the Devin version/layout and throws a clear `Unsupported Devin version <v>: pattern not found...` before changing anything. Re-Apply with a different gateway URL is idempotent (regex matcher accepts pristine or already-applied URLs).

## 6. Account presentation

- Apply does both jobs in one action: route inference **and** present the top-tier plan.
- `encodePlanInfo()` returns field 1 = 17, field 2 = `Devin Max`; `localUser().planInfo.planSlug = "devin-max"`.
- Handlers: `SeatManagementService/GetUserStatus`, `GetCurrentUser`, `GetLicense`, `RegisterUser`, `GetSelfDevinSessionToken`, `LanguageServerService/GetUserStatus`, etc.
- Identity is **not** faked: the real logged-in identity (`Sakib` / `sakibwriter7@gmail.com`) is preserved wherever Devin already holds it.
- Checklist line: `Account presentation: Devin Max plan` plus the restart note if the plan is only read at launch.

### PLAN-GATED FEATURES
- `GetSelfDevinSessionToken` returns a local placeholder token. Any plan/entitlement baked into a **signed Cognition token** is not changed and is not claimed as changed.
- Surfaces that require Cognition to validate a real signed plan token remain gated.
- All plan/profile/entitlement requests the app makes to the gateway are answered with Devin Max (tier 17) and full local entitlements.

## 7. Standalone mode

- The local app has **LOCAL STANDALONE** mode: add provider + API key + model locally, no website required.
- Apply in standalone uses the local config and never calls the website.
- Proof: `test-project/standalone-e2e/hello-standalone.txt` = `HELLO FROM DEVIN ROUTER STANDALONE`
- Background Run verified: ON starts the bundled gateway (port opens), OFF closes it.
- Start with Windows writes/removes `HKCU\...\Run\DevinRouter`.

## 8. Local app + installer (weight gate)

- Local app: single Go binary, **10.94 MB**, no Electron.
- Installer: `repo/local-app/bin/DevinRouterSetup.exe` = **19,275,776 bytes (18.4 MB)** — under the 25 MB gate.
- Bundled gateway: 5.4 MB (pruned `better-sqlite3` to `package.json` + `lib` + prebuilt `.node`).
- Installer lays down `%LOCALAPPDATA%\DevinRouter` (app + gateway), Start Menu shortcut, Start-with-Windows Run key, and warns if Node.js is missing.
- Installed-copy E2E: `test-project/installed-app-e2e/hello-installed.txt` = `HELLO FROM DEVIN ROUTER INSTALLED APP` (bundled gateway).
- **Not yet measured:** idle RAM/CPU over 2 minutes with the UI closed. Installer size passes; the RAM/CPU measurement is still pending.
- **Not implemented:** tray icon (Open / Background Run / Quit). Background Run and Start-with-Windows work without a tray.

## 9. Parity / offline sweep

Honest status: **not completed.**
- The full EXPLORATION-LOG route parity pass and the hosts-block offline test were not re-run after the latest changes.
- Strong indirect evidence exists (all E2E runs complete with no Cognition traffic in `gateway.log`), but this is not a substitute for the required sweep.

## 10. Bugs

| Bug | Found | Fixed |
|---|---|---|
| BUG-001 identity clobbered on fresh target | yes | yes |
| BUG-002 "testprovider" E2E was actually the mock | yes | yes |
| BUG-003 installed-target test touched real user data | yes | yes |

Total: **3 found, 3 fixed, 0 open.**

## 11. Screenshots

Screenshots exist in `repo/test-project/` (`account-proof-*.png`, `persist-*.png`, `acct-*.png`), but they are **low-resolution and not cleanly legible**. They are not treated as proof. The hard evidence is:
- `probe-userstatus.mjs` JSON (plan tier 17, Devin Max, real identity),
- E2E file contents and sizes,
- gateway log entries,
- backup manifests and SHA256 restore checks.

## 12. Known gaps (not claimed as done)

- Parity + offline hosts-block sweep: not run.
- Website not deployed to Uppcoder (recipe in `docs/DEPLOY.md` still to be written).
- Tray icon not implemented.
- Idle RAM/CPU weight measurement not taken.
- GitHub Release v1.0.0 not yet created.

## 13. What the owner does next

1. Deploy the website (see `docs/DEPLOY.md`; for now run locally with `cd website && npm run dev`).
2. Create an account, add a provider, fetch/add models, open **Connect** and copy the connector username/password.
3. Run `DevinRouterSetup.exe` (18.4 MB) — it installs to `%LOCALAPPDATA%\DevinRouter`.
4. Start **Devin Router** from the Start Menu.
5. Log in with the connector credentials (or switch to **standalone** and add the provider/API key/model directly).
6. Select the model, choose **Devin (installed)**, click **APPLY**.
7. Restart Devin if the plan was only read at launch; the account menu should show **Devin Max**.
8. **UNAPPLY** at any time restores the backed-up files byte-for-byte.