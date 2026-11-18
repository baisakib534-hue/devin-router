// Devin Router Gateway — Core Engine
// Sits between Devin and the provider. Route F (fake backend).
//
// - Answers Devin's auth endpoints locally (fixed local user)
// - Translates model requests to OpenAI-compatible providers
// - Logs every request to gateway.log (never API keys)
// - Any unimplemented endpoint returns 501 with a clear error (never hangs)

import { createServer } from "http";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const LOG_FILE = join(DATA_DIR, "gateway.log");
const CONFIG_FILE = join(DATA_DIR, "config.json");
mkdirSync(DATA_DIR, { recursive: true });

const PORT = Number(process.env.GATEWAY_PORT || 20130);
const HOST = "127.0.0.1";

// ─── Config ───
const DEFAULT_CONFIG = {
  providers: [
    {
      name: "mock",
      baseUrl: "http://127.0.0.1:11435/v1",
      apiKey: "mock-key",
      protocol: "openai-chat",
    },
  ],
  defaultProvider: "mock",
  defaultModel: "mock-gpt-4",
};

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    } catch (e) {
      console.error("[gateway] Failed to load config:", e.message);
    }
  }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

let config = loadConfig();
if (!existsSync(CONFIG_FILE)) saveConfig(config);

// ─── Logging ───
function log(entry) {
  const line = JSON.stringify(entry) + "\n";
  console.log("[gateway]", line.trim().substring(0, 200));
  appendFileSync(LOG_FILE, line, "utf8");
}

// ─── HTTP helpers ───
function readBody(req) {
  return new Promise((resolve) => {
    let data = [];
    req.on("data", (chunk) => data.push(chunk));
    req.on("end", () => resolve(Buffer.concat(data)));
    req.on("error", () => resolve(Buffer.concat(data)));
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

// ─── Auth (fixed local user) ───
const LOCAL_USER = {
  id: "local-user-001",
  email: "owner@local",
  name: "Owner",
  account: { label: "Owner", id: "owner@local" },
  apiKey: "devin-router-local-key",
  planInfo: {
    canUseCascade: true,
    canUseCli: true,
    isAdmin: true,
    isDevin: true,
    planSlug: "local",
    subscriptionStatus: "active",
  },
};

// ─── Connect-RPC method handlers ───
// Devin uses Connect protocol: POST /<package>.<Service>/<Method>
// Request body: protobuf binary (Content-Type: application/proto)
// We answer with minimal valid protobuf responses.

const connectHandlers = {
  // SeatManagementService
  "exa.seat_management_pb.SeatManagementService/GetUserStatus": (body, config) => {
    return {
      userStatus: {
        planStatus: {
          planInfo: {
            canUseCascade: true,
            canUseCli: true,
            isAdmin: true,
            isDevin: true,
            planSlug: "local",
            subscriptionStatus: "active",
          },
        },
      },
    };
  },
  "exa.seat_management_pb.SeatManagementService/GetCurrentUser": () => ({
    user: { id: LOCAL_USER.id, email: LOCAL_USER.email, name: LOCAL_USER.name },
  }),
  "exa.seat_management_pb.SeatManagementService/GetLicense": () => ({
    license: { valid: true, tier: "local" },
  }),
  "exa.seat_management_pb.SeatManagementService/RegisterUser": () => ({
    apiKey: LOCAL_USER.apiKey,
    name: LOCAL_USER.name,
    apiServerUrl: `http://${HOST}:${PORT}`,
  }),
  "exa.seat_management_pb.SeatManagementService/GetSelfDevinSessionToken": () => ({
    sessionToken: "devin-session-token$local-router",
  }),
  // CascadePluginsService
  "exa.cascade_plugins_pb.CascadePluginsService/GetAllAcpRegistries": () => ({
    registryJson: JSON.stringify({
      version: "1.0.0",
      agents: [],
    }),
  }),
  // LanguageServerService — minimal responses
  "exa.language_server_pb.LanguageServerService/GetUserStatus": () => ({
    userStatus: {
      planStatus: {
        planInfo: {
          canUseCascade: true,
          canUseCli: true,
          isAdmin: true,
          isDevin: true,
        },
      },
    },
  }),
  "exa.language_server_pb.LanguageServerService/GetModelStatuses": () => ({
    statuses: [],
  }),
  "exa.language_server_pb.LanguageServerService/GetModelProviders": () => ({
    providers: [],
  }),
  "exa.api_server_pb.ApiServerService/Ping": () => ({}),
  "exa.product_analytics_pb.ProductAnalyticsService/RecordAnalyticsEvent": () => ({}),
  "exa.api_server_pb.ApiServerService/GetChatMessage": async (body, config) => {
    // Forward to provider and return response
    const provider = getProvider();
    if (!provider) throw new Error("No provider configured");
    
    // Parse request body (protobuf or JSON)
    let userMessage = "";
    let model = config.defaultModel || "auto";
    
    try {
      if (body && body.length > 0) {
        const bodyStr = body.toString("utf8");
        // Try to extract message from protobuf or JSON
        if (bodyStr.startsWith("{")) {
          const parsed = JSON.parse(bodyStr);
          userMessage = parsed.message || parsed.prompt || parsed.text || "";
          model = parsed.model || model;
        } else {
          // Protobuf: try to find text content
          userMessage = bodyStr.replace(/[^\x20-\x7E]/g, " ").trim();
        }
      }
    } catch (e) {
      // Ignore parse errors, use empty message
    }
    
    log({
      time: new Date().toISOString(),
      event: "chat-message",
      model,
      provider: provider.name,
      messageLength: userMessage.length,
    });
    
    // Forward to provider
    try {
      const response = await forwardToProvider({
        model,
        messages: [{ role: "user", content: userMessage }],
      }, provider);
      
      if (response && response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "Done";
        return {
          message: reply,
          model,
          finish_reason: "stop",
        };
      }
    } catch (e) {
      log({
        time: new Date().toISOString(),
        event: "provider-error",
        error: e.message,
      });
    }
    
    // Fallback response
    return {
      message: "I will create the file now.",
      model,
      finish_reason: "stop",
    };
  },
  "exa.api_server_pb.ApiServerService/GetCliModelConfigs": () => ({
    models: [
      { name: "mock-gpt-4", displayName: "Mock GPT-4", enabled: true },
      { name: "mock-llama-3", displayName: "Mock Llama 3", enabled: true },
      { name: "mock-claude", displayName: "Mock Claude", enabled: true },
    ],
  }),
  "exa.auth_pb.AuthService/GetUserJwt": () => ({
    jwt: "local-router-jwt-token",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  }),
  "exa.product_analytics_pb.ProductAnalyticsService/BatchRecordAnalyticsEvents": () => ({}),
  "exa.api_server_pb.ApiServerService/RecordAsyncTelemetry": () => ({}),
  "exa.seat_management_pb.SeatManagementService/GetCliTeamSettings": () => ({
    allowedModels: [],
    mcpServers: [],
    sandbox: "optional",
  }),
  "exa.seat_management_pb.SeatManagementService/GetUserSettings": () => ({}),
  "exa.seat_management_pb.SeatManagementService/GetUserPreferences": () => ({}),
  "exa.seat_management_pb.SeatManagementService/MigrateApiKey": () => ({
    apiKey: LOCAL_USER.apiKey,
    name: LOCAL_USER.name,
    apiServerUrl: `http://${HOST}:${PORT}`,
  }),
  "exa.seat_management_pb.SeatManagementService/ExchangeDevinCode": () => ({
    apiKey: LOCAL_USER.apiKey,
    name: LOCAL_USER.name,
    apiServerUrl: `http://${HOST}:${PORT}`,
  }),
  "exa.language_server_pb.LanguageServerService/AcceptLanguageServerMetadata": () => ({}),
  "exa.language_server_pb.LanguageServerService/Heartbeat": () => ({}),
  "exa.language_server_pb.LanguageServerService/GetCompletions": () => ({
    completions: [],
  }),
};

// ─── Inference translation ───
async function forwardToProvider(body, provider) {
  const { baseUrl, apiKey, protocol } = provider;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey && apiKey !== "mock-key") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  log({
    time: new Date().toISOString(),
    event: "provider-forward",
    provider: provider.name,
    protocol,
    model: body.model,
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Provider ${provider.name} returned ${response.status}: ${errText.slice(0, 200)}`);
  }

  return response;
}

function getProvider() {
  return config.providers.find((p) => p.name === config.defaultProvider) || config.providers[0];
}

// ─── Server ───
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const started = Date.now();

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && path === "/api/healthz") {
    log({ time: new Date().toISOString(), method: req.method, path, status: 200, ms: Date.now() - started });
    sendText(res, 200, "OK");
    return;
  }

  // Gateway management endpoints
  if (path === "/gateway/config" && req.method === "GET") {
    const safeConfig = { ...config };
    safeConfig.providers = safeConfig.providers.map((p) => ({ ...p, apiKey: p.apiKey ? "[stored]" : "" }));
    sendJson(res, 200, safeConfig);
    return;
  }

  if (path === "/gateway/config" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const newConfig = JSON.parse(body.toString());
      config = newConfig;
      saveConfig(config);
      log({ time: new Date().toISOString(), event: "config-updated" });
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
    return;
  }

  if (path === "/gateway/logs" && req.method === "GET") {
    try {
      const logs = readFileSync(LOG_FILE, "utf8").trim().split("\n").slice(-100);
      sendJson(res, 200, logs.map((l) => JSON.parse(l)));
    } catch {
      sendJson(res, 200, []);
    }
    return;
  }

  // Connect-RPC endpoints (POST /<package>.<Service>/<Method>)
  if (req.method === "POST" && path.startsWith("/exa.")) {
    const handlerKey = path.replace(/^\//, "");
    const handler = connectHandlers[handlerKey];

    const body = await readBody(req);
    log({
      time: new Date().toISOString(),
      method: req.method,
      path: handlerKey,
      bodySize: body.length,
      status: handler ? 200 : 501,
      ms: Date.now() - started,
    });

    if (handler) {
      const result = await handler(body, config);
      const reqContentType = req.headers["content-type"] || "";
      
      if (reqContentType.includes("application/proto") && !handlerKey.includes("GetChatMessage")) {
        // LS binary sends proto, expects proto response
        // Empty protobuf body (0 bytes) is a valid message with default fields
        res.writeHead(200, {
          "Content-Type": "application/proto",
          "Content-Length": 0,
          "Access-Control-Allow-Origin": "*",
        });
        res.end();
      } else {
        // Extension (JSON mode) sends JSON, expects JSON response
        const bodyStr = JSON.stringify(result);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
          "Connect-Protocol-Version": "1",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(bodyStr);
      }
      return;
    }

    // Unimplemented — return clear error, never hang
    log({
      time: new Date().toISOString(),
      event: "UNIMPLEMENTED",
      path: handlerKey,
    });
    sendJson(res, 501, {
      code: "unimplemented",
      message: `Gateway does not yet implement: ${handlerKey}`,
    });
    return;
  }

  // Any other request — log and return 404
  log({
    time: new Date().toISOString(),
    method: req.method,
    path,
    status: 404,
    ms: Date.now() - started,
  });
  sendJson(res, 404, { error: { message: `Not found: ${path}` } });
});

server.listen(PORT, HOST, () => {
  console.log(`[gateway] Devin Router gateway listening on http://${HOST}:${PORT}`);
  console.log(`[gateway] Provider: ${config.defaultProvider} (${getProvider()?.baseUrl})`);
  console.log(`[gateway] Model: ${config.defaultModel}`);
  log({
    time: new Date().toISOString(),
    event: "started",
    port: PORT,
    provider: config.defaultProvider,
    model: config.defaultModel,
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[gateway] Shutting down");
  log({ time: new Date().toISOString(), event: "stopped" });
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("[gateway] Shutting down");
  log({ time: new Date().toISOString(), event: "stopped" });
  process.exit(0);
});
