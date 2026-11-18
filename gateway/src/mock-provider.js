// Mock OpenAI-compatible provider for testing.
// Implements GET /v1/models and POST /v1/chat/completions on port 11435.
// Logs every request to mock.log.

import { createServer } from "http";
import { createWriteStream } from "fs";
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = join(__dirname, "..", "data", "mock.log");
mkdirSync(join(__dirname, "..", "data"), { recursive: true });

function log(entry) {
  const line = JSON.stringify(entry) + "\n";
  console.log("[mock]", line.trim());
  appendFileSync(LOG_FILE, line, "utf8");
}

const PORT = 11435;

const MODELS = [
  { id: "mock-gpt-4", object: "model", created: 0, owned_by: "mock" },
  { id: "mock-llama-3", object: "model", created: 0, owned_by: "mock" },
  { id: "mock-claude", object: "model", created: 0, owned_by: "mock" },
];

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(data));
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function generateResponse(body) {
  const {
    model = "mock-gpt-4",
    messages = [],
    stream = false,
    tools = [],
    tool_choice,
  } = body;

  const lastMessage = messages[messages.length - 1];
  const lastRole = lastMessage?.role || "user";
  const userText =
    lastMessage?.content?.text || lastMessage?.content || "";

  // If tools are available and the user asks to create a file, use a tool call
  const createFileTool = tools.find(
    (t) =>
      t.function?.name?.includes("create_file") ||
      t.function?.name?.includes("write_file") ||
      t.function?.name === "write" ||
      t.function?.name?.includes("create")
  );

  if (createFileTool && lastRole === "user" && /creat|write/i.test(userText)) {
    const filename = (userText.match(/file\s+named?\s+(\S+)/i) ||
      userText.match(/(\S+\.txt)/i) || [])[1] || "hello.txt";
    const contentMatch = userText.match(
      /containing\s+(?:exactly\s*:?\s*)?["\x27]?(.+?)["\x27]?\s*$/i
    );
    const content = contentMatch ? contentMatch[1] : "mock-content";
    const schemaProperties = createFileTool.function?.parameters?.properties;
    const pathKey = schemaProperties && "file_path" in schemaProperties ? "file_path" : "path";
    const toolArgs = JSON.stringify({ [pathKey]: filename, content });

    if (stream) {
      return {
        toolCall: true,
        toolName: createFileTool.function.name,
        toolArgs,
        model,
      };
    }
    return {
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_mock_001",
                type: "function",
                function: {
                  name: createFileTool.function.name,
                  arguments: toolArgs,
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
  }

  const reply = `Mock provider received your message: "${userText}". This is a simulated response for testing the Devin Router gateway.`;

  if (stream) {
    return { content: reply, model };
  }

  return {
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: reply },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 25, total_tokens: 35 },
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  log({ time: new Date().toISOString(), method: req.method, path });

  if (req.method === "GET" && path === "/v1/models") {
    sendJson(res, 200, { object: "list", data: MODELS });
    return;
  }

  if (req.method === "POST" && path === "/v1/chat/completions") {
    const bodyText = await readBody(req);
    log({ time: new Date().toISOString(), method: req.method, path, body: bodyText.slice(0, 1000) });
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      sendJson(res, 400, { error: { message: "Invalid JSON" } });
      return;
    }

    const result = generateResponse(body);

    if (body.stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      if (result.toolCall) {
        // Stream a tool call
        const chunks = [
          { id: "chatcmpl-mock", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: result.model, choices: [{ index: 0, delta: { role: "assistant", content: null }, finish_reason: null }] },
          { id: "chatcmpl-mock", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: result.model, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call_mock_001", type: "function", function: { name: result.toolName, arguments: result.toolArgs } }] }, finish_reason: null }] },
          { id: "chatcmpl-mock", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: result.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
        ];
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      } else {
        // Stream text content word by word
        const words = result.content.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = {
            id: "chatcmpl-mock",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: result.model,
            choices: [{
              index: 0,
              delta: { content: (i > 0 ? " " : "") + words[i] },
              finish_reason: null,
            }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ id: "chatcmpl-mock", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: result.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: { message: "Not found" } });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock] Mock provider listening on http://127.0.0.1:${PORT}`);
  log({ time: new Date().toISOString(), event: "started", port: PORT });
});
