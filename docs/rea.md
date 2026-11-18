# Devin Router — File REA (Steps 7–8)

Target: `devin-mod/resources/app/` — Devin 1.141.2 (VS Code fork by Exafunction/Cognition).

## 1. Version & structure
- `package.json`: name `Devin`, version `1.141.2`, distro `a0e7521b2a1e3289e4118fad155277b200aebd35`.
- Fork of microsoft/vscode. Entry: `./out/main.js`.
- Key extensions: `windsurf` (main agent logic), `windsurf-auth` (auth), `windsurf-remote-devin`.
- Bundled binaries: `language_server_windows_x64.exe` (121 MB), `devin.exe` (253 MB, ACP agent).
- Protos: `language_server_pb`, `codeium_common_pb`, `seat_management_pb`, `api_server_pb`, `dev_pb`, `chat_client_server_pb`.

## 2. Auth gate (Step 8a)
**File**: `extensions/windsurf-auth/dist/extension.js`

Flow:
1. Extension registers auth provider `windsurf_auth` via VS Code authentication API.
2. Sessions stored in VS Code secrets under key `windsurf_auth.sessions` (JSON array).
3. On startup: `activate()` → `getAuthSession()` → `authentication.getSession("windsurf_auth", ["login"], {silent: true})`
4. If session exists, `accessToken` is passed to `MetadataProvider.updateApiKey(accessToken)`.
5. `MetadataProvider.isUserLoggedIn()` returns `apiKey !== undefined && apiKey !== ""`.
6. If not logged in, ACP registry fetch is skipped: "Skipping registry fetch: user not logged in yet".
7. The language server receives auth metadata as protobuf binary via stdin on startup.

**Bypass method**: Write a fake session to VS Code secrets (windsurf_auth.sessions), OR patch the auth extension to return a fixed session. The simpler approach: the extension has a dev credentials fallback at `~/.windsurf-dev/credentials.json` (only in dev mode), so we need either:
- Set VS Code setting + write to secret storage, OR
- Patch `getSessions()` to return a fixed session

## 3. Endpoint list (Step 8b)
| Domain | Purpose |
|--------|---------|
| `server.codeium.com` | Main API server (Connect-RPC, protobuf) |
| `server-beta.codeium.com` | Beta API server |
| `server-staging.codeium.com` | Staging API server |
| `eu.windsurf.com/_route/api_server` | EU multi-tenant |
| `windsurf.fedstart.com/_route/api_server` | FedStart |
| `app.devin.ai` | Devin web app |
| `app.beta.devin.ai` | Devin beta web app |
| `register.windsurf.com` | User registration |
| `marketplace.windsurf.com` | Extension marketplace |
| `windsurf-stable.codeium.com` | Updates |
| `codeium.com/windsurf/update_linux` | Linux updates |
| Sentry ingest | Telemetry/minidumps |

## 4. Backend address selection (Step 8c)
**Configurable**: YES — via VS Code configuration setting `codeium.apiServerUrl`.

Resolution (in `windsurf-auth/dist/extension.js`, function `qe()`):
1. Check `windsurf` → `devin` config section for override
2. Check `codeium` / `codeiumDev` config sections
3. Fall back to product-specific defaults based on build flavor (insiders/EU/fedstart/beta/staging)
4. Default: `https://server.codeium.com`

The language server is spawned with `--api_server_url <resolved_url>`.
The inference API server URL is separately configurable via `codeium.inferenceApiServerUrl`.

**Patch method**: Set `codeium.apiServerUrl` in user settings to `http://127.0.0.1:<gateway_port>`.

## 5. Wire protocol (Step 8d)
**Protocol**: Connect-RPC (protobuf over HTTP/1.1, binary format)

- Transport: `createConnectTransport({baseUrl: <apiServerUrl>, useBinaryFormat: true, httpVersion: "1.1"})`
- Auth: `X-Api-Key` header (API key from session)
- Language server auth: metadata protobuf written to stdin on LS startup

Services:
- `LanguageServerService` — user status, completions, models
- `SeatManagementService` — user registration, auth, session tokens
- `CascadePluginsService` — ACP registry fetch (`GetAllAcpRegistries`)
- `DevService` — agent/dev operations

Key endpoints used:
- `{apiServerUrl}/api/healthz` — health check (must return "OK")
- Connect-RPC POST to `{apiServerUrl}/<service>/<method>` — all API calls

## 6. TLS (Step 8e)
**No certificate pinning found.** The extension uses standard `fetch` and Connect transport. Electron/Chromium respects system CA store. A local CA certificate would be trusted, or we can use plain HTTP by setting `codeium.apiServerUrl` to `http://127.0.0.1:<port>` — no TLS needed at all.

## 7. ACP loader (Step 8f)
**Registry path** (Windows): `%APPDATA%\Code\User\acp\registry.json`
(Resolved via `getWindsurfConfigDirectory()` → `AppData/Roaming/Code/User`)

**Registry schema** (Zod validated):
```json
{
  "version": "1.0.0",
  "agents": [
    {
      "id": "my-agent",
      "name": "My Agent",
      "version": "1.0.0",
      "description": "Description",
      "distribution": {
        "binary": {
          "windows-x86_64": {
            "archive": "",
            "cmd": "path/to/binary.exe",
            "args": ["--acp"]
          }
        }
      }
    }
  ]
}
```

Distribution types: `binary`, `npx`, `uvx`, `websocket`.
Default Devin agent ID: `devin-cloud` (bundled `devin.exe acp`).

The local registry is loaded when `windsurf.acp.enabledAgents` is configured, or as fallback when cloud registry is unreachable.

## 8. Route decision (Step 9)
**ROUTE F (Fake Backend + ACP Bridge)**

All conditions hold:
1. ✅ Backend address configurable: `codeium.apiServerUrl` VS Code setting
2. ✅ No pinning: uses standard fetch/Connect, plain HTTP for localhost works
3. ✅ Protocol implementable: Connect-RPC + protobuf; healthz endpoint is simple HTTP; complex methods can be answered with minimal valid protobuf responses
4. ✅ ACP registry is local and controllable: `registry.json` in user config dir

**Approach**:
1. Set `codeium.apiServerUrl` → `http://127.0.0.1:<gateway_port>`
2. Gateway serves `/api/healthz` → "OK"
3. Gateway serves Connect-RPC auth endpoints → fixed local user
4. Gateway registers a custom ACP agent in registry.json → our agent binary that translates to OpenAI-compatible API
5. Gateway intercepts and answers all other cloud calls with valid minimal responses
6. Zero requests to Cognition domains
