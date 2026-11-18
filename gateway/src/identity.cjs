#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const IDENTITY_FILE = process.env.DEVIN_ROUTER_IDENTITY_FILE
  ? path.resolve(process.env.DEVIN_ROUTER_IDENTITY_FILE)
  : path.join(__dirname, "..", "data", "identity.json");

function stateDbFile(dir) {
  return path.join(dir, "User", "globalStorage", "state.vscdb");
}

function userDataDir() {
  if (process.env.DEVIN_USER_DATA_DIR) return path.resolve(process.env.DEVIN_USER_DATA_DIR);
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appData, "Devin");
}

// Identity is the owner's real logged-in account. It must come from a Devin
// user-data dir that actually holds a profile; a never-logged-in throwaway
// target must never clobber it with an empty record.
function identityCandidateDirs() {
  const dirs = [];
  const push = (value) => {
    if (!value) return;
    const resolved = path.resolve(value);
    if (!dirs.includes(resolved)) dirs.push(resolved);
  };
  const source = process.env.DEVIN_IDENTITY_SOURCE;
  if (source) {
    if (source.endsWith(".vscdb")) {
      push(path.dirname(path.dirname(path.dirname(source))));
    } else {
      push(source);
    }
  }
  push(process.env.DEVIN_USER_DATA_DIR);
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  push(path.join(appData, "Devin"));
  push(userDataDir());
  return dirs;
}

function readItem(db, key) {
  try {
    const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key);
    return row ? row.value : null;
  } catch {
    return null;
  }
}

function parseJson(value) {
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function splitIdentityText(text) {
  if (typeof text !== "string") return { email: "", name: "" };
  const marker = text.indexOf(" - ");
  if (marker < 0) return { email: text.trim(), name: "" };
  return {
    email: text.slice(0, marker).trim(),
    name: text.slice(marker + 3).trim(),
  };
}

function loadIdentityFromDir(dir) {
  const dbFile = stateDbFile(dir);
  const result = {
    email: "",
    name: "",
    id: "",
    source: fs.existsSync(dbFile) ? dbFile : "missing-state-db",
  };
  if (!fs.existsSync(dbFile)) return result;

  let db;
  try {
    const Database = require("better-sqlite3");
    db = new Database(dbFile, { readonly: true });
  } catch (error) {
    result.source = "sqlite-error";
    result.error = error.message;
    return result;
  }

  try {
    const authRows = db.prepare("SELECT key, value FROM ItemTable WHERE key LIKE 'codeium.windsurf-auth%'").all();
    for (const row of authRows) {
      const value = parseJson(row.value) || {};
      if (!result.email && typeof value.lastLoginEmail === "string") {
        result.email = value.lastLoginEmail.trim();
      }
    }

    const planRows = db
      .prepare("SELECT key, value FROM ItemTable WHERE key LIKE 'windsurf.reactSettings.cachedPlanInfoData:%' ORDER BY key DESC")
      .all();
    for (const row of planRows) {
      const value = parseJson(row.value);
      if (!value) continue;
      if (!result.id) {
        const parsedKey = row.key.slice(row.key.lastIndexOf(":") + 1);
        if (parsedKey) result.id = parsedKey;
      }
      if ((!result.email || !result.name) && typeof value.accountIdentityText === "string") {
        const identity = splitIdentityText(value.accountIdentityText);
        if (!result.email) result.email = identity.email;
        if (!result.name) result.name = identity.name;
      }
      if (result.email && result.name) break;
    }

    if (!result.name) {
      const usageRow = db
        .prepare("SELECT key FROM ItemTable WHERE key LIKE 'windsurf_auth-%-usages' ORDER BY key DESC LIMIT 1")
        .get();
      if (usageRow) {
        result.name = usageRow.key.slice("windsurf_auth-".length, -"-usages".length);
      }
    }
  } finally {
    db.close();
  }

  return result;
}

function loadIdentity() {
  const candidates = identityCandidateDirs();
  const attempts = [];
  for (const dir of candidates) {
    const result = loadIdentityFromDir(dir);
    attempts.push({ dir, email: result.email, name: result.name, source: result.source });
    if (result.email || result.name) {
      result.attempts = attempts;
      return result;
    }
  }
  return {
    email: "",
    name: "",
    id: "",
    source: candidates.length ? "no-identity-in-candidates" : "no-candidates",
    attempts,
  };
}

function readIdentityFile(file = IDENTITY_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { email: "", name: "" };
  }
}

function writeIdentity(file = IDENTITY_FILE, options = {}) {
  const identity = loadIdentity();
  const existing = readIdentityFile(file);
  const hasNew = Boolean(identity.email || identity.name);
  const hasExisting = Boolean(existing.email || existing.name);
  if (!hasNew && hasExisting && !options.force) {
    return Object.assign({}, existing, { preserved: true, attemptedSource: identity.source });
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(identity, null, 2) + "\n", "utf8");
  return identity;
}

if (require.main === module) {
  if (process.argv.includes("--write")) {
    console.log(JSON.stringify(writeIdentity(), null, 2));
  } else {
    console.log(JSON.stringify(loadIdentity(), null, 2));
  }
}

module.exports = { loadIdentity, loadIdentityFromDir, writeIdentity, readIdentityFile, stateDbFile, identityCandidateDirs, IDENTITY_FILE };
