#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");

const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:20130";
const BACKUP_ROOT = process.env.DEVIN_ROUTER_BACKUP_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), "DevinRouter", "backups");

function usage() {
  console.log("Usage: node apply.cjs <apply|unapply|status> [--target devin-mod|installed] [--gateway-url URL] [--backup DIR]");
}

function parseArgs(argv) {
  const args = { command: argv[2] || "status", target: "devin-mod", gatewayUrl: GATEWAY_URL, backup: "", installDir: "", devModDir: "", userDataDir: "" };
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--target") args.target = argv[++i];
    else if (argv[i] === "--gateway-url") args.gatewayUrl = argv[++i];
    else if (argv[i] === "--backup") args.backup = argv[++i];
    else if (argv[i] === "--install-dir") args.installDir = argv[++i];
    else if (argv[i] === "--dev-mod-dir") args.devModDir = argv[++i];
    else if (argv[i] === "--user-data-dir") args.userDataDir = argv[++i];
  }
  if (!["apply", "unapply", "status"].includes(args.command)) throw new Error("Unknown command");
  if (!["devin-mod", "installed"].includes(args.target)) throw new Error("Target must be devin-mod or installed");
  return args;
}

function findInstalledDevinRoot() {
  if (process.env.DEVIN_INSTALL_DIR) return path.resolve(process.env.DEVIN_INSTALL_DIR);
  const roots = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Devin"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Devin"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Devin"),
  ].filter(Boolean);
  for (const root of roots) {
    if (fs.existsSync(path.join(root, "Devin.exe")) && fs.existsSync(path.join(root, "resources", "app", "package.json"))) return root;
  }
  throw new Error("Installed Devin not found. Set DEVIN_INSTALL_DIR to the Devin install root.");
}

function findDevinRoot(target, args = {}) {
  if (target === "installed") {
    if (args.installDir) return path.resolve(args.installDir);
    return findInstalledDevinRoot();
  }
  if (args.devModDir) return path.resolve(args.devModDir);
  return process.env.DEVIN_MOD_DIR
    ? path.resolve(process.env.DEVIN_MOD_DIR)
    : path.resolve(__dirname, "..", "..", "..", "devin-mod");
}

function findSettingsFile(target, args = {}) {
  if (args.userDataDir) return path.join(path.resolve(args.userDataDir), "User", "settings.json");
  if (process.env.DEVIN_USER_DATA_DIR) return path.join(path.resolve(process.env.DEVIN_USER_DATA_DIR), "User", "settings.json");
  if (target === "installed") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Devin", "User", "settings.json");
  }
  return path.join(findDevinRoot(target, args), "user-data", "User", "settings.json");
}

function findUserDataDir(target, settingsFile) {
  if (process.env.DEVIN_USER_DATA_DIR) return path.resolve(process.env.DEVIN_USER_DATA_DIR);
  return path.dirname(path.dirname(settingsFile));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function patchDefinitions(gatewayUrl) {
  return [
    {
      file: path.join("resources", "app", "extensions", "windsurf-auth", "dist", "extension.js"),
      replacements: [
        {
          from: "if(!Zn()&&!jn())return Eo(n)",
          to: "if(!1)return Eo(n)",
        },
        {
          from: "if(!e){let t=n.readDevCredentials();if(t!==void 0)return t}return[]}",
          to: "if(!e){let t=n.readDevCredentials();if(t!==void 0)return t}return[{id:\"local-router\",accessToken:\"devin-router-local-key\",account:{label:\"Local Owner\",id:\"local-owner\"},scopes:[]}]}",
        },
      ],
    },
    {
      file: path.join("resources", "app", "extensions", "windsurf", "dist", "extension.js"),
      replacements: [
        {
          pattern: /"--api_server_url",(?:"[^"]*"|e\.apiServerUrl)/,
          to: `"--api_server_url","${gatewayUrl}"`,
        },
        {
          pattern: /"--inference_api_server_url",(?:"[^"]*"|e\.inferenceApiServerUrl)/,
          to: `"--inference_api_server_url","${gatewayUrl}"`,
        },
        {
          from: "useBinaryFormat:!0",
          to: "useBinaryFormat:!1",
          all: true,
        },
      ],
    },
  ];
}

function validatePatches(root, gatewayUrl) {
  const packageFile = path.join(root, "resources", "app", "package.json");
  if (!fs.existsSync(packageFile)) throw new Error(`Unsupported Devin layout: missing ${packageFile}`);
  const pkg = readJson(packageFile);
  const plan = [];
  for (const patch of patchDefinitions(gatewayUrl)) {
    const file = path.join(root, patch.file);
    if (!fs.existsSync(file)) throw new Error(`Unsupported Devin layout: missing ${file}`);
    let text = fs.readFileSync(file, "utf8");
    const replacements = [];
    for (const replacement of patch.replacements) {
      if (replacement.from !== undefined) {
        if (text.includes(replacement.to)) continue;
        if (!text.includes(replacement.from)) {
          throw new Error(`Unsupported Devin version ${pkg.version}: pattern not found in ${path.basename(file)}: ${replacement.from.slice(0, 80)}`);
        }
        if (replacement.all) {
          text = text.split(replacement.from).join(replacement.to);
        } else {
          text = text.replace(replacement.from, replacement.to);
        }
        replacements.push(replacement);
      } else if (replacement.pattern) {
        if (!replacement.pattern.test(text)) {
          throw new Error(`Unsupported Devin version ${pkg.version}: pattern not found in ${path.basename(file)}: ${replacement.pattern}`);
        }
        const updated = text.replace(replacement.pattern, replacement.to);
        if (updated !== text) {
          text = updated;
          replacements.push(replacement);
        }
      }
    }
    if (replacements.length > 0) plan.push({ file, text, replacements });
  }
  return { version: pkg.version, plan };
}

function backupFile(backupDir, root, file) {
  const relative = path.relative(root, file);
  const target = path.join(backupDir, "files", relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
  return relative;
}

function apply(args) {
  const root = findDevinRoot(args.target, args);
  const settingsFile = findSettingsFile(args.target, args);
  const { version, plan } = validatePatches(root, args.gatewayUrl);
  let identity = null;
  try {
    identity = require("./identity.cjs").writeIdentity();
  } catch (error) {
    identity = { source: "identity-error", error: error.message };
  }
  const userDataDir = findUserDataDir(args.target, settingsFile);
  const credentialsFile = path.join(userDataDir, "credentials.toml");
  let credentialsCreated = false;
  if (!fs.existsSync(credentialsFile)) {
    fs.mkdirSync(path.dirname(credentialsFile), { recursive: true });
    fs.writeFileSync(credentialsFile, "windsurf_api_key = \"devin-router-local-key\"\n", "utf8");
    credentialsCreated = true;
  }
  const settings = fs.existsSync(settingsFile) ? readJson(settingsFile) : {};
  const settingsExisted = fs.existsSync(settingsFile);
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 15);
  const backupDir = args.backup || path.join(BACKUP_ROOT, `${stamp}-${args.target}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const manifest = {
    createdAt: new Date().toISOString(),
    target: args.target,
    root,
    settingsFile,
    settingsExisted,
    gatewayUrl: args.gatewayUrl,
    version,
    identity,
    createdFiles: credentialsCreated ? [{ path: credentialsFile }] : [],
    files: [],
  };

  for (const item of plan) {
    const relative = backupFile(backupDir, root, item.file);
    manifest.files.push({ relative, patchFile: path.relative(root, item.file) });
  }
  if (settingsExisted) {
    const settingsRelative = path.relative(root, settingsFile);
    const target = path.join(backupDir, "settings", path.basename(settingsFile));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(settingsFile, target);
    manifest.settingsBackup = path.relative(backupDir, target);
    manifest.settingsRelative = settingsRelative;
  }
  writeJson(path.join(backupDir, "manifest.json"), manifest);

  for (const item of plan) fs.writeFileSync(item.file, item.text, "utf8");

  settings["codeium.apiServerUrl"] = args.gatewayUrl;
  settings["codeium.inferenceApiServerUrl"] = args.gatewayUrl;
  writeJson(settingsFile, settings);

  return {
    root,
    settingsFile,
    backupDir,
    version,
    identity,
    credentialsFile,
    credentialsCreated,
    changedFiles: plan.length,
  };
}

function latestBackup(target) {
  if (!fs.existsSync(BACKUP_ROOT)) return null;
  const dirs = fs.readdirSync(BACKUP_ROOT)
    .filter((name) => name.endsWith(`-${target}`))
    .map((name) => path.join(BACKUP_ROOT, name))
    .filter((dir) => fs.existsSync(path.join(dir, "manifest.json")))
    .sort()
    .reverse();
  return dirs[0] || null;
}

function unapply(args) {
  const backupDir = args.backup || latestBackup(args.target);
  if (!backupDir || !fs.existsSync(path.join(backupDir, "manifest.json"))) {
    throw new Error("No backup found for unapply");
  }
  const manifest = readJson(path.join(backupDir, "manifest.json"));
  for (const item of manifest.files) {
    const source = path.join(backupDir, "files", item.relative);
    const target = path.join(manifest.root, item.relative);
    fs.copyFileSync(source, target);
  }
  for (const item of manifest.createdFiles || []) {
    if (fs.existsSync(item.path)) fs.unlinkSync(item.path);
  }
  if (manifest.settingsExisted && manifest.settingsBackup) {
    const source = path.join(backupDir, manifest.settingsBackup);
    fs.mkdirSync(path.dirname(manifest.settingsFile), { recursive: true });
    fs.copyFileSync(source, manifest.settingsFile);
  } else if (!manifest.settingsExisted && fs.existsSync(manifest.settingsFile)) {
    const settings = readJson(manifest.settingsFile);
    delete settings["codeium.apiServerUrl"];
    delete settings["codeium.inferenceApiServerUrl"];
    writeJson(manifest.settingsFile, settings);
    if (Object.keys(settings).length === 0) fs.unlinkSync(manifest.settingsFile);
  }
  return {
    restored: manifest.files.length,
    settingsRestored: manifest.settingsExisted,
    removedCreatedFiles: (manifest.createdFiles || []).length,
    backupDir,
  };
}

function status(args) {
  const root = findDevinRoot(args.target, args);
  const settingsFile = findSettingsFile(args.target, args);
  const pkg = readJson(path.join(root, "resources", "app", "package.json"));
  const settings = fs.existsSync(settingsFile) ? readJson(settingsFile) : {};
  return { target: args.target, root, version: pkg.version, settingsFile, apiServerUrl: settings["codeium.apiServerUrl"] || null };
}

const args = parseArgs(process.argv);
try {
  const result = args.command === "apply" ? apply(args) : args.command === "unapply" ? unapply(args) : status(args);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`apply.cjs: ${error.message}`);
  process.exit(1);
}
