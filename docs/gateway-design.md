# Devin Router — Phase 2: Gateway Engine

Build: mock provider + gateway core + throwaway devin-mod pointing + mock E2E + real E2E.

## Architecture (Route F)

```
Devin → HTTP (Connect-RPC/protobuf) → Gateway (Node, localhost) → OpenAI-compatible Provider
```

- Gateway listens on localhost, speaks Devin's protocol (Connect-RPC with protobuf, healthz)
- Gateway forwards inference to a configured provider (OpenAI chat completions, Anthropic, etc.)
- Auth answered locally (fixed local user)
- All traffic logged to gateway.log

## Gateway components

1. **healthz**: `GET /api/healthz` → "OK"
2. **Auth**: Connect-RPC endpoints for `SeatManagementService`, `LanguageServerService` → fixed local user
3. **Inference**: Translate Connect-RPC chat messages ↔ OpenAI chat completions (streaming + tool calls)
4. **Registry**: Serve ACP registry locally
5. **Logging**: Every request logged (time, model, provider, result — no keys)
