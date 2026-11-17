# Devin Router — Phase 1 REA (Reverse Engineering Analysis)

Source: `devin-mod/resources/app/` (Devin 1.141.2, VS Code fork by Exafunction/Cognition).

## Key findings

### Version & entry points
- `package.json`: name `Devin`, version `1.141.2`, main `./out/main.js`, Electron.
- Fork of Microsoft VS Code (`repository` → microsoft/vscode). Extensions include `windsurf`, `cascade`, `chat-client`, `codeium_common_pb`, `language_server_pb`, `api_server_pb` (protos generated via `buf`).
- Node engine 24.22.1, bundled Electron/Chromium runtime.

### Auth gate (Step 8a) — TO BE COMPLETED
### Endpoint list (Step 8b) — TO BE COMPLETED
### Backend address selection (Step 8c) — TO BE COMPLETED
### Wire protocol (Step 8d) — TO BE COMPLETED
### TLS / pinning (Step 8e) — TO BE COMPLETED
### ACP loader (Step 8f) — TO BE COMPLETED

## File-read log (Step 7)
TO BE COMPLETED.
