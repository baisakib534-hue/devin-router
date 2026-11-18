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
import { gunzipSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const LOG_FILE = join(DATA_DIR, "gateway.log");
const CONFIG_FILE = join(DATA_DIR, "config.json");
const IDENTITY_FILE = join(DATA_DIR, "identity.json");
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

function readVarint(buffer, offset) {
  let value = 0n;
  let shift = 0n;
  let cursor = offset;
  while (cursor < buffer.length) {
    const byte = buffer[cursor++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7n;
  }
  return { value, end: cursor };
}

function decodeProtoFields(buffer) {
  const fields = [];
  let offset = 0;
  while (offset < buffer.length) {
    const key = readVarint(buffer, offset);
    offset = key.end;
    const fieldNumber = Number(key.value >> 3n);
    const wireType = Number(key.value & 7n);
    if (wireType === 0) {
      const value = readVarint(buffer, offset);
      offset = value.end;
      fields.push({ fieldNumber, wireType, value: Number(value.value) });
    } else if (wireType === 2) {
      const length = readVarint(buffer, offset);
      offset = length.end;
      const end = offset + Number(length.value);
      if (end > buffer.length) break;
      fields.push({ fieldNumber, wireType, value: buffer.subarray(offset, end) });
      offset = end;
    } else if (wireType === 5) {
      const end = offset + 4;
      if (end > buffer.length) break;
      fields.push({ fieldNumber, wireType, value: buffer.subarray(offset, end) });
      offset = end;
    } else if (wireType === 1) {
      const end = offset + 8;
      if (end > buffer.length) break;
      fields.push({ fieldNumber, wireType, value: buffer.subarray(offset, end) });
      offset = end;
    } else {
      break;
    }
  }
  return fields;
}

function unwrapConnectProtoMessage(buffer) {
  if (buffer.length >= 5 && buffer.readUInt32BE(1) === buffer.length - 5) {
    const message = buffer.subarray(5);
    if (buffer[0] & 1) return gunzipSync(message);
    return message;
  }
  return buffer;
}

function decodeChatMessageRequest(buffer) {
  const fields = decodeProtoFields(unwrapConnectProtoMessage(buffer));
  const text = (fieldNumber) => fields
    .filter((field) => field.fieldNumber === fieldNumber && field.wireType === 2)
    .map((field) => field.value.toString("utf8"))[0] || "";
  const tools = fields
    .filter((field) => field.fieldNumber === 10 && field.wireType === 2)
    .map((field) => {
      const toolFields = decodeProtoFields(field.value);
      const toolText = (fieldNumber) => toolFields
        .filter((toolField) => toolField.fieldNumber === fieldNumber && toolField.wireType === 2)
        .map((toolField) => toolField.value.toString("utf8"))[0] || "";
      return {
        name: toolText(1),
        description: toolText(2),
        jsonSchemaString: toolText(3),
      };
    });
  const chatMessages = fields
    .filter((field) => field.fieldNumber === 3 && field.wireType === 2)
    .map((field) => {
      const messageFields = decodeProtoFields(field.value);
      const prompt = messageFields
        .filter((messageField) => messageField.fieldNumber === 3 && messageField.wireType === 2)
        .map((messageField) => messageField.value.toString("utf8"))[0] || "";
      const source = messageFields
        .filter((messageField) => messageField.fieldNumber === 2 && messageField.wireType === 0)
        .map((messageField) => messageField.value)[0] || 0;
      const toolCallId = messageFields
        .filter((messageField) => messageField.fieldNumber === 7 && messageField.wireType === 2)
        .map((messageField) => messageField.value.toString("utf8"))[0] || "";
      const toolCalls = messageFields
        .filter((messageField) => messageField.fieldNumber === 6 && messageField.wireType === 2)
        .map((messageField) => {
          const callFields = decodeProtoFields(messageField.value);
          const callText = (fieldNumber) => callFields
            .filter((callField) => callField.fieldNumber === fieldNumber && callField.wireType === 2)
            .map((callField) => callField.value.toString("utf8"))[0] || "";
          return { id: callText(1), name: callText(2), argumentsJson: callText(3) };
        });
      return { source, prompt, toolCallId, toolCalls };
    });
  return {
    prompt: text(2),
    userPrompt: chatMessages.find((message) => message.source === 1 && !/^<(system_info|available_skills|system_guidance)>/.test(message.prompt))?.prompt || "",
    chatMessages,
    chatModelName: text(14),
    chatModelUid: text(21),
    tools,
  };
}

function chatMessagesToOpenAiMessages(messages) {
  const relevantMessages = messages.filter((message) =>
    !/^<(system_info|available_skills|system_guidance)>/.test(message.prompt)
  );
  return relevantMessages.map((message) => {
    if (message.source === 4) {
      return {
        role: "tool",
        tool_call_id: message.toolCallId || "router-tool-call-1",
        content: message.prompt,
      };
    }
    if (message.source === 2 || message.source === 5) {
      return { role: "system", content: message.prompt };
    }
    return { role: "user", content: message.prompt };
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

function encodeVarint(value) {
  const chunks = [];
  let remaining = value;
  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    chunks.push(Buffer.from([byte]));
  } while (remaining > 0);
  return Buffer.concat(chunks);
}

function encodeLengthDelimited(fieldNumber, value) {
  const key = encodeVarint(fieldNumber << 3 | 2);
  const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return Buffer.concat([key, encodeVarint(data.length), data]);
}

function encodeChatToolCall({ id, name, argumentsJson }) {
  return Buffer.concat([
    encodeLengthDelimited(1, id),
    encodeLengthDelimited(2, name),
    encodeLengthDelimited(3, argumentsJson),
  ]);
}

function encodeGetChatMessageResponse({ messageId, deltaText, stopReason, deltaToolCalls = [] }) {
  const parts = [];
  if (messageId) parts.push(encodeLengthDelimited(1, messageId));
  if (deltaText) parts.push(encodeLengthDelimited(3, deltaText));
  if (stopReason) parts.push(encodeVarintField(5, stopReason));
  parts.push(...deltaToolCalls.map((toolCall) => encodeLengthDelimited(6, encodeChatToolCall(toolCall))));
  return Buffer.concat(parts);
}

function connectStreamFrame(message) {
  const header = Buffer.alloc(5);
  header.writeUInt8(0, 0);
  header.writeUInt32BE(message.length, 1);
  return Buffer.concat([header, message]);
}

function connectEndStreamFrame() {
  const endStreamResponse = Buffer.from("{}", "utf8");
  const frame = Buffer.alloc(5 + endStreamResponse.length);
  frame.writeUInt8(0x02, 0);
  frame.writeUInt32BE(endStreamResponse.length, 1);
  endStreamResponse.copy(frame, 5);
  return frame;
}

function encodeVarintField(fieldNumber, value) {
  return Buffer.concat([encodeVarint(fieldNumber << 3 | 0), encodeVarint(value)]);
}

function encodeBoolField(fieldNumber, value) {
  return encodeVarintField(fieldNumber, value ? 1 : 0);
}

function encodeDevinPlanInfo() {
  const user = localUser();
  const parts = [
    encodeBoolField(1, true),
    encodeBoolField(2, true),
    encodeBoolField(3, true),
    encodeLengthDelimited(4, "local-router"),
    encodeLengthDelimited(5, `http://${HOST}:${PORT}`),
    encodeLengthDelimited(7, `http://${HOST}:${PORT}`),
  ];
  if (user.name) parts.push(encodeLengthDelimited(8, user.name));
  return Buffer.concat(parts);
}

function encodePlanInfo() {
  return Buffer.concat([
    encodeVarintField(1, 17),
    encodeLengthDelimited(2, "Devin Max"),
    encodeBoolField(3, true),
    encodeBoolField(4, true),
    encodeBoolField(5, true),
    encodeBoolField(15, true),
    encodeBoolField(16, true),
    encodeBoolField(17, true),
    encodeBoolField(18, true),
    encodeBoolField(19, true),
    encodeBoolField(20, true),
    encodeBoolField(25, true),
    encodeBoolField(27, true),
    encodeBoolField(28, true),
    encodeBoolField(29, true),
    encodeBoolField(31, true),
    encodeLengthDelimited(33, encodeDevinPlanInfo()),
    encodeBoolField(34, true),
    encodeVarintField(35, 3),
    encodeBoolField(36, true),
    encodeBoolField(37, true),
  ]);
}

function encodePlanStatus() {
  return encodeLengthDelimited(1, encodePlanInfo());
}

function encodeUserStatus() {
  const user = localUser();
  const parts = [encodeBoolField(1, true)];
  if (user.name) parts.push(encodeLengthDelimited(3, user.name));
  if (user.email) parts.push(encodeLengthDelimited(7, user.email));
  parts.push(
    encodeVarintField(10, 17),
    encodeLengthDelimited(13, encodePlanStatus()),
    encodeBoolField(31, true),
  );
  if (user.id) parts.push(encodeLengthDelimited(36, user.id));
  return Buffer.concat(parts);
}

function encodeSeatManagementUser() {
  const user = localUser();
  const parts = [encodeLengthDelimited(1, user.apiKey)];
  if (user.name) parts.push(encodeLengthDelimited(2, user.name));
  if (user.email) parts.push(encodeLengthDelimited(3, user.email));
  if (user.id) parts.push(encodeLengthDelimited(6, user.id));
  parts.push(encodeBoolField(13, true));
  return Buffer.concat(parts);
}

function encodeGetUserStatusResponse() {
  return Buffer.concat([
    encodeLengthDelimited(1, encodeUserStatus()),
    encodeLengthDelimited(2, encodePlanInfo()),
  ]);
}

function encodeGetCurrentUserResponse() {
  return Buffer.concat([
    encodeLengthDelimited(1, encodeSeatManagementUser()),
    encodeLengthDelimited(6, encodePlanInfo()),
  ]);
}

const binaryResponseEncoders = {
  "exa.seat_management_pb.SeatManagementService/GetUserStatus": encodeGetUserStatusResponse,
  "exa.language_server_pb.LanguageServerService/GetUserStatus": encodeGetUserStatusResponse,
  "exa.seat_management_pb.SeatManagementService/GetCurrentUser": encodeGetCurrentUserResponse,
};

// ─── Auth (local gateway user) ───
// Identity is copied from Devin's own profile at Apply time. It is never
// invented here: a fresh login-less install simply has empty identity fields.
function loadIdentityFile() {
  try {
    const parsed = JSON.parse(readFileSync(IDENTITY_FILE, "utf8"));
    return {
      id: typeof parsed.id === "string" ? parsed.id : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      name: typeof parsed.name === "string" ? parsed.name : "",
    };
  } catch {
    return { id: "", email: "", name: "" };
  }
}

function localUser() {
  const identity = loadIdentityFile();
  const id = identity.id || identity.email;
  return {
    id,
    email: identity.email,
    name: identity.name,
    account: { label: identity.name || identity.email, id: identity.email || id },
    apiKey: "devin-router-local-key",
    planInfo: {
      canUseCascade: true,
      canUseCli: true,
      isAdmin: true,
      isDevin: true,
      planSlug: "devin-max",
      subscriptionStatus: "active",
    },
  };
}

// ─── Connect-RPC method handlers ───
// Devin uses Connect protocol: POST /<package>.<Service>/<Method>
// Request body: protobuf binary (Content-Type: application/proto)
// We answer with minimal valid protobuf responses.

const connectHandlers = {
  // SeatManagementService
  "exa.seat_management_pb.SeatManagementService/GetUserStatus": () => {
    const user = localUser();
    return {
      userStatus: {
        name: user.name,
        email: user.email,
        userId: user.id,
        planStatus: {
          planInfo: {
            teamsTier: 17,
            planName: "Devin Max",
            canUseCascade: true,
            canUseCli: true,
            isAdmin: true,
            isDevin: true,
            hasPaidFeatures: true,
            devinInfo: {
              canUseCascade: true,
              canUseCli: true,
              isAdmin: true,
              accountDisplayName: user.name,
            },
          },
        },
      },
    };
  },
  "exa.seat_management_pb.SeatManagementService/GetCurrentUser": () => {
    const user = localUser();
    return { user: { id: user.id, email: user.email, name: user.name } };
  },
  "exa.seat_management_pb.SeatManagementService/GetLicense": () => ({
    license: { valid: true, tier: "local" },
  }),
  "exa.seat_management_pb.SeatManagementService/RegisterUser": () => {
    const user = localUser();
    return {
      apiKey: user.apiKey,
      name: user.name,
      email: user.email,
      apiServerUrl: `http://${HOST}:${PORT}`,
    };
  },
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
    
    const chatRequest = body ? decodeChatMessageRequest(body) : { prompt: "", tools: [] };
    const userMessage = chatRequest.userPrompt || chatRequest.prompt;
    const model = config.defaultModel || chatRequest.chatModelUid || chatRequest.chatModelName || "auto";

    log({
      time: new Date().toISOString(),
      event: "chat-message",
      model,
      provider: provider.name,
      messageLength: userMessage.length,
      tools: chatRequest.tools.map((tool) => tool.name),
      messageSources: chatRequest.chatMessages.map((message) => message.source),
    });
    
    // Forward to provider
    try {
      const response = await forwardToProvider({
        model,
        messages: chatMessagesToOpenAiMessages(chatRequest.chatMessages),
        tools: chatRequest.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: JSON.parse(tool.jsonSchemaString || "{}"),
          },
        })),
      }, provider);
      
      if (response && response.ok) {
        const data = await response.json();
        const choice = data.choices?.[0];
        const providerToolCalls = choice?.message?.tool_calls || [];
        return [
          {
            messageId: "router-message-1",
            deltaText: choice?.message?.content || "",
            deltaToolCalls: providerToolCalls.map((toolCall) => ({
              id: toolCall.id || "router-tool-call-1",
              name: toolCall.function?.name || "write",
              argumentsJson: toolCall.function?.arguments || "{}",
            })),
          },
          { messageId: "router-message-1", stopReason: 2 },
        ];
      }
    } catch (e) {
      log({
        time: new Date().toISOString(),
        event: "provider-error",
        error: e.message,
      });
    }
    
    // Fallback response
    return [
      { messageId: "router-message-1", deltaText: "I will create the file now." },
      { messageId: "router-message-1", stopReason: 2 },
    ];
  },
  "exa.api_server_pb.ApiServerService/GetCliModelConfigs": () => ({
    models: config.defaultModel
      ? [{ name: config.defaultModel, displayName: config.defaultModel, enabled: true }]
      : [
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
  "exa.seat_management_pb.SeatManagementService/MigrateApiKey": () => {
    const user = localUser();
    return { apiKey: user.apiKey, name: user.name, email: user.email, apiServerUrl: `http://${HOST}:${PORT}` };
  },
  "exa.seat_management_pb.SeatManagementService/ExchangeDevinCode": () => {
    const user = localUser();
    return { apiKey: user.apiKey, name: user.name, email: user.email, apiServerUrl: `http://${HOST}:${PORT}` };
  },
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

  if (req.method === "GET" && path === "/v3/self") {
    log({ time: new Date().toISOString(), method: req.method, path, status: 200, ms: Date.now() - started });
    const user = localUser();
    const self = {
      account_id: "local-router",
      organization_id: "local-router",
      plan: "devin-max",
    };
    if (user.id) self.user_id = user.id;
    if (user.name) self.name = user.name;
    if (user.email) self.email = user.email;
    sendJson(res, 200, self);
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
      contentType: req.headers["content-type"],
      contentEncoding: req.headers["content-encoding"],
    });

    if (handler) {
      const result = await handler(body, config);
      const reqContentType = req.headers["content-type"] || "";

      const isConnectProto = reqContentType.includes("application/connect+proto");
      const isProto = reqContentType.includes("application/proto");
      if (isConnectProto || isProto) {
        if (isConnectProto && handlerKey === "exa.api_server_pb.ApiServerService/GetChatMessage") {
          const payload = Buffer.concat([
            ...result.map((message) => connectStreamFrame(encodeGetChatMessageResponse(message))),
            connectEndStreamFrame(),
          ]);
          res.writeHead(200, {
            "Content-Type": "application/connect+proto",
            "Content-Length": payload.length,
            "Connect-Protocol-Version": "1",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(payload);
        } else {
          // LS binary sends proto, expects proto response
          // Empty protobuf body (0 bytes) is a valid message with default fields
          const responseBody = binaryResponseEncoders[handlerKey]?.() || Buffer.alloc(0);
          res.writeHead(200, {
            "Content-Type": "application/proto",
            "Content-Length": responseBody.length,
            "Access-Control-Allow-Origin": "*",
          });
          res.end(responseBody);
        }
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
