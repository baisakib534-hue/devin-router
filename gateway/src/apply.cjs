// Apply: point devin-mod at the local gateway
// Creates user-data/User/settings.json with codeium.apiServerUrl = gateway
const fs = require("fs");
const path = require("path");

const MOD_DIR = path.resolve(__dirname, "..", "..", "..", "devin-mod");
const USER_DATA = path.join(MOD_DIR, "user-data");
const SETTINGS_DIR = path.join(USER_DATA, "User");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");
const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:20130";

function apply() {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  
  let settings = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  }
  
  settings["codeium.apiServerUrl"] = GATEWAY_URL;
  settings["codeium.inferenceApiServerUrl"] = GATEWAY_URL;
  
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  
  console.log("Applied:");
  console.log(`  codeium.apiServerUrl = ${GATEWAY_URL}`);
  console.log(`  codeium.inferenceApiServerUrl = ${GATEWAY_URL}`);
  console.log(`  Settings file: ${SETTINGS_FILE}`);
}

function unapply() {
  if (fs.existsSync(SETTINGS_FILE)) {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    delete settings["codeium.apiServerUrl"];
    delete settings["codeium.inferenceApiServerUrl"];
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  }
  console.log("Unapplied: removed apiServerUrl settings");
}

const cmd = process.argv[2] || "apply";
if (cmd === "apply") apply();
else if (cmd === "unapply") unapply();
else console.log("Usage: node apply.js [apply|unapply]");
