# Devin Router — File REA (Step 7)

Target: `devin-mod/resources/app/` — Devin 1.141.2 (VS Code fork by Exafunction).

## 1. Version & structure
- `package.json`: name `Devin`, version `1.141.2`, distro `a0e7521b2a1e3289e4118fad155277b200aebd35`.
- Fork of microsoft/vscode. Entry: `./out/main.js`.
- Bundled extensions include: `windsurf`, `cascade`, `chat-client`, `codeium_common_pb`, `language_server_pb`, `api_server_pb`, `dev_pb`, `desktop_bridge_pb`.
- Protos generated via `buf` from `../exa/*_pb/*.proto`.
- `product.json` present (52 KB) — likely holds backend URLs / auth config.

## 2. Search results (TO BE COMPLETED with actual grep)
Searches to run:
- "sign in", "login", "auth", session/user getters
- "api.devin.ai", "cognition", "codeium"
- "telemetry", update terms
- "acp", "registry.json"
- cloud session/handoff terms from UI

## 3. product.json
TO BE COMPLETED — read it for backend URLs.

## 4. Auth gate
TO BE COMPLETED.

## 5. Endpoint list
TO BE COMPLETED.

## 6. Backend address selection
TO BE COMPLETED.

## 7. Wire protocol
TO BE COMPLETED.

## 8. TLS
TO BE COMPLETED.

## 9. ACP loader
TO BE COMPLETED.
