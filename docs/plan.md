# Devin Router — Build Plan (Phase 1–6)

## Phase 1: REA (steps 5–9)
- 5: Create test project. DONE (devin/test-project).
- 6: Computer-use exploration of original app. BLOCKED: no computer-use tool in this session; will use file REA (Step 7) instead. Log in AUDIT.md.
- 7: File REA in devin-mod/resources/app/. IN PROGRESS.
- 8: Write findings (auth, endpoints, backend, protocol, TLS, ACP). TODO.
- 9: Route decision (F vs A). TODO.

## Phase 2: Gateway engine (steps 10–15)
- 10: Mock provider (Node, port 11435). DONE.
- 11: Gateway core (Node). DONE.
- 12: Point devin-mod at Gateway. DONE.
- 13: Mock E2E (hello-router.txt). DONE.
- 14: Real E2E (hello2.txt, test provider). TODO.
- 15: Commit + push gateway/. TODO.

## Phase 3: Website (steps 16–20)
- 16: Design doc + Next.js scaffold. TODO.
- 17: Build pages (Dashboard, Providers, Models, Connect, Devices, Logs, Settings). TODO.
- 18: Sync API (GET/POST config, device hello, logs). TODO.
- 19: Local test loop (signup, add mock provider, fetch models, test, connect, regenerate, revoke). TODO.
- 20: README + DEPLOY.md. TODO.

## Phase 4: Local software (steps 21–26)
- 21: Design doc (Go route, tray, web UI). TODO.
- 22: Embed gateway, background run. TODO.
- 23: Connected mode (sync). TODO.
- 24: Apply (point devin-mod at gateway). TODO.
- 25: Local test loop (installer, login, apply, standalone, tray, weight gate). TODO.
- 26: Commit + push. TODO.

## Phase 5: Full E2E (steps 27–30)
- 27: Fresh-user run (website + local app + devin-mod + hello3.txt). TODO.
- 28: Standalone run (hello4.txt). TODO.
- 29: Parity + safety sweep. TODO.
- 30: Fix + retest. TODO.

## Phase 6: Release (steps 31–35)
- 31: Final code pass. TODO.
- 32: Push. TODO.
- 33: Create Release v1.0.0 with installer. TODO.
- 34: Verify release. TODO.
- 35: Finish REPORT.md. TODO.

## ADD-ON — APPLY DOES THE ACCOUNT TOO (this SUPERSEDES the "CUSTOM ACCOUNT + PLAN" add-on — cancel its Account-page work if recorded)

The owner's final design is simpler: NO Account page, NO name/email/plan fields anywhere. Prerequisite is only that Devin is logged in beforehand with the owner's real account (a free account is fine). The existing flow — select model → APPLY — must do BOTH jobs in one action:

1. Route inference to the selected provider/model (already in the prompt), AND
2. Make the app present the account as the HIGHEST plan tier: from Apply onward, the gateway answers the app's profile/plan/entitlement requests with the top-tier plan and full entitlements (the exact fields come from your Phase 1 REA of where the app reads plan data). Identity (name/email) is NOT faked — wherever the app already holds the real logged-in identity, it stays as is.

No new UI: the Apply checklist gains one line, "Account presentation: <top tier name> plan". If your REA showed the app fetches plan data only at launch, the checklist adds "restart Devin to see the plan change". If a plan surface is TOKEN-BOUND (plan baked into a signed token), list it in REPORT.md under PLAN-GATED FEATURES as before — never claim it changed.

PROOFS (REPORT.md): with a FREE account logged in and Apply done — screenshots of the account menu, settings and plan/billing surfaces showing the top-tier plan; one previously plan-gated LOCAL feature working; the same screenshots again after a full Devin relaunch (persistence).

## ADD-ON — OWNER'S FINAL USE (apply this on top of the Devin Router prompt; where it conflicts, this wins)

The owner will use the finished product like this: DELETE all of Devin (app + user data), install Devin FRESH, then connect it with the local app and run it on his own API. Build and prove for exactly that use:

1. NO HIDDEN SESSION DEPENDENCY: nothing in the gateway, the wiring, or Apply may depend on the owner's current Devin login session/token existing. If any test passed only because a session was already present, that is a BUG — log it in BUGS.md and fix it so the flow works with zero prior login.
2. FRESH-INSTALL END-TO-END TEST (add to Phase 5, mandatory): (a) identify Devin's user-data locations from your REA (app data / config / .codeium / .windsurf / devin config dirs) and rename them aside; (b) take a fresh copy of the install with NO user data — an install that has never been logged in anywhere; (c) run the whole product flow on it: local app Apply → launch → no login screen → agent creates hello-fresh.txt via the mock AND via the test provider; (d) restore the renamed user data afterwards. All proofs in REPORT.md. The build is not done if this test is missing or fails.
3. APPLY MUST SUPPORT THE INSTALLED DEVIN: the shipped local app offers two Apply targets — "Devin (installed)" (the owner's real use) and "Devin copy (devin-mod)" (development). For the installed target: before changing ANYTHING, the app makes a full automatic backup of every file/setting it will touch (timestamped, listed in the Apply checklist), and UNAPPLY restores from that backup byte-for-byte. During YOUR development, keep using the devin-mod target only — never test the installed target on the owner's current install; prove the installed-target code path against a throwaway install copy in a separate folder instead.
4. NO HARDCODED WIRING: Apply must detect how to point whatever Devin it targets (its version, its file layout, its backend-address location) at Apply time, from the app's own REA logic — a fresh install may be a newer Devin version than the dev copy, and Apply must either handle it or stop with a clear "unsupported version" message in the app, never a half-applied change.
## STATUS SNAPSHOT (2026-11-18)

- 1–4 (setup/audit): DONE
- 5–9 (REA + route decision): DONE — Route F, evidence in docs/rea.md
- 10–11 (mock + gateway core): DONE
- 12 (point devin-mod at gateway): DONE
- 13 (mock E2E): DONE — hello-router.txt
- 14 (real provider E2E): DONE — hello-real.txt + hello-real-fresh.txt (BUG-002 fixed)
- 15 (gateway commit/push): PARTIAL — gateway code complete; final push pending
- 16–18 (website design/build/sync API): DONE
- 19 (website local test loop): DONE — production build, pages, signup, and login verified with the async SQLite/PostgreSQL data layer
- 20 (README/DEPLOY): DONE — website README exists; docs/DEPLOY.md matches Uppcoder’s Next.js + PostgreSQL workflow
- 21–24 (local app design/build/connected/Apply): DONE
- 25 (installer test loop + weight gate): DONE — installer + install/run/apply/standalone/background/tray verified; idle RAM/CPU 42.08–50.09 MB at 0.00% CPU
- 26 (local-app commit/push): PENDING
- 27 (fresh-user full product run): DONE — localapp-e2e/hello-localapp.txt
- 28 (standalone run): DONE — standalone-e2e/hello-standalone.txt
- 29 (parity + offline sweep): PARTIAL — source/runtime parity and proxy-offline E2E done; exact hosts-file block pending owner elevation
- 30 (fix + retest): DONE for BUG-001/002/003
- 31 (final code pass): DONE — repo tidy, .gitignore, no secrets; version/tag v1.0.0
- 32 (push): DONE
- 33 (GitHub Release v1.0.0 + installer): DONE
- 34 (verify release download): DONE — HTTP 200, 16,366,592 bytes
- 35 (finish REPORT.md): DONE (this file)

Owner final-use add-on:
- No hidden session dependency: DONE (BUG-001 fixed)
- Fresh-install E2E (mock + real provider): DONE
- Apply installed target with backup/byte-for-byte unapply: DONE (throwaway only; BUG-003 fixed for user-data isolation)
- No hardcoded wiring / unsupported-version stop: DONE

Account add-on:
- Apply does route + top-tier plan presentation in one action: DONE
- Identity not faked: DONE
- PLAN-GATED (token-bound) features listed in REPORT.md: DONE
