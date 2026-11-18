# Bugs

Every error hit (build, runtime, test), its cause, its fix. Loop until tests pass clean twice.

## BUG-001: Identity clobbered by never-logged-in target (FRESH-INSTALL / no-hidden-session violation)

- Symptom: `writeIdentity()` overwrote the owner's real logged-in identity (`Sakib` / `sakibwriter7@gmail.com`) with an empty record when Apply/flow ran against a fresh, never-logged-in Devin copy (throwaway user-data with no `state.vscdb` profile). This is a direct violation of the "NO HIDDEN SESSION DEPENDENCY" add-on: a test could pass or fail based on a stale `identity.json` rather than the real login.
- Root cause: `loadIdentity()` only consulted a single `userDataDir()`; when that dir had no profile, `writeIdentity()` wrote an empty identity over the good one. There was no fallback chain and no preservation guard.
- Fix (gateway/src/identity.cjs):
  - `identityCandidateDirs()` now checks, in order: `DEVIN_IDENTITY_SOURCE` (accepts a `.vscdb` path or a dir) -> `DEVIN_USER_DATA_DIR` -> `%APPDATA%\Devin` -> `userDataDir()`.
  - `loadIdentity()` returns the FIRST candidate that actually holds an email/name, plus `attempts` for debugging.
  - `writeIdentity()` preserves the existing populated identity when the new load is empty, unless `{force:true}` is passed (returns `preserved:true`).
- Verification:
  - Normal env (owner profile present) -> loads `Sakib` / `sakibwriter7@gmail.com`.
  - Throwaway env (no profile) -> returns empty identity, attempts listed.
  - `DEVIN_ROUTER_IDENTITY_FILE` temp test -> `preserved:true` when new load empty and existing populated.
- Status: FIXED in working tree (commit pending).

## BUG-002: "testprovider" E2E was actually the mock (false proof)

- Symptom: the fresh-install E2E log `out-testprovider.log` and the file `hello-fresh-testprovider.txt` were presented as proof that the real test provider worked, but both providers in `test-project/run-fresh-e2e.ps1` were configured with `baseUrl = http://127.0.0.1:11435/v1` (the mock). The real provider was never exercised.
- Root cause: `Set-GatewayProvider($name, $model)` in `run-fresh-e2e.ps1` ignores `$name` and always writes the mock base URL; the "testprovider" run only changed the model string.
- Fix:
  - Added `test-project/provider-probe.ps1` (parses the test-provider base URL/key from the task attachment, never prints the key) — real provider returned HTTP 200, model `openai/gpt-oss-120b`.
  - Added `test-project/run-real-e2e.ps1` and `test-project/run-real-fresh.ps1`, which configure the gateway with the real provider and restore the mock config afterwards.
  - Real E2E produced `test-project/real-e2e/hello-real.txt` (28 bytes, `HELLO FROM DEVIN ROUTER REAL`) and `test-project/fresh-e2e/work/hello-real-fresh.txt` (34 bytes).
  - `repo/gateway/data/gateway.log` records six `provider-forward` entries with `"provider":"realtest"`, `"model":"auto"` at 17:24:55–17:25:20Z.
- Verification: file contents + gateway log + provider probe (above). The mock config is restored after each run.
- Status: FIXED (real-provider E2E now proven, not inferred).
## BUG-003: Installed-target test touched the owner's real user data

- Symptom: proving the installed-target Apply path through the local app against a throwaway install still wrote `settings.json` (and checked `credentials.toml`) under the owner's real `%APPDATA%\Devin`, because only the install root was overridden.
- Root cause: `apply.cjs` had `--install-dir` for the app root but no user-data override; `findSettingsFile("installed")` hardcoded `%APPDATA%\Devin`, and the local app's `cleanDevEnv()` stripped the `DEVIN_USER_DATA_DIR` test hook.
- Impact: the owner's real `User\settings.json` did not exist before the test, was created by Apply, and was removed by UNAPPLY (net state unchanged; `credentials.toml` was never modified). This still violated the "never test the installed target on the owner's current install" rule, so it is logged as a bug.
- Fix:
  - `apply.cjs` now accepts `--user-data-dir` (highest priority for the settings/credentials location).
  - The local app config gained `devUserDataDir` and passes it to Apply.
  - Verified: test6 Apply output shows `settingsFile` and `credentialsFile` under `test-project\fresh-e2e\user-data`, not `%APPDATA%\Devin`.
- Verification: owner `settings.json` absent before and after; UNAPPLY `{"restored":2,"settingsRestored":false,"removedCreatedFiles":1}`; throwaway files hash-restored.
- Status: FIXED (installed-target tests are now fully isolated).