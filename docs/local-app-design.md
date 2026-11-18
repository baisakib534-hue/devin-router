# Local app design (Phase 4)

## Stack
- Go single binary (gateway + tray + web UI).
- UI: local web page in default browser (or WebView2 window when open). No Electron (budget: ≤60MB RAM, ~0% CPU, ≤25MB installer).

## Screens
1. Login — connector username/password + website URL (default production, changeable for localhost dev).
2. Home — mode banner (WEBSITE CONNECTED / LOCAL STANDALONE); selected provider + model; gateway status.
3. Providers — CRUD (same as website); used in standalone mode; in connected mode edits synced config.
4. Models — select + APPLY.
5. Activity — live gateway request log.
6. Settings — Background Run ON/OFF; Start with Windows; website URL.

## Tray
- Open / Background Run toggle / Quit.

## Apply (heart)
- One button: points devin-mod at this app's gateway, writes provider+model into gateway config, restarts what needs restarting, shows checklist (paths + before/after).
- UNAPPLY: restores pristine.
- Idempotent. Owner's installed Devin never touched — devin-mod only; app says so.
