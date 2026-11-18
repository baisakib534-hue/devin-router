# Devin Router — Build Plan (Phase 1–6)

## Phase 1: REA (steps 5–9)
- 5: Create test project. DONE (devin/test-project).
- 6: Computer-use exploration of original app. BLOCKED: no computer-use tool in this session; will use file REA (Step 7) instead. Log in AUDIT.md.
- 7: File REA in devin-mod/resources/app/. IN PROGRESS.
- 8: Write findings (auth, endpoints, backend, protocol, TLS, ACP). TODO.
- 9: Route decision (F vs A). TODO.

## Phase 2: Gateway engine (steps 10–15)
- 10: Mock provider (Node, port 11435). TODO.
- 11: Gateway core (Node). TODO.
- 12: Point devin-mod at Gateway. TODO.
- 13: Mock E2E (hello.txt). TODO.
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

## ADD-ON — APPLY DOES THE ACCOUNT TOO (recorded 2026-11-18; SUPERSEDES the "CUSTOM ACCOUNT + PLAN" add-on)

The owner's final design is simpler: NO Account page, NO name/email/plan fields anywhere. Prerequisite is only that Devin is logged in beforehand with the owner's real account (a free account is fine). The existing flow — select model → APPLY — must do BOTH jobs in one action:

1. Route inference to the selected provider/model (already in the prompt), AND
2. Make the app present the account as the HIGHEST plan tier: from Apply onward, the gateway answers the app's profile/plan/entitlement requests with the top-tier plan and full entitlements (the exact fields come from your Phase 1 REA of where the app reads plan data). Identity (name/email) is NOT faked — wherever the app already holds the real logged-in identity, it stays as is.

No new UI: the Apply checklist gains one line, "Account presentation: <top tier name> plan". If your REA showed the app fetches plan data only at launch, the checklist adds "restart Devin to see the plan change". If a plan surface is TOKEN-BOUND (plan baked into a signed token), list it in REPORT.md under PLAN-GATED FEATURES as before — never claim it changed.

PROOFS (REPORT.md): with a FREE account logged in and Apply done — screenshots of the account menu, settings and plan/billing surfaces showing the top-tier plan; one previously plan-gated LOCAL feature working; the same screenshots again after a full Devin relaunch (persistence).
