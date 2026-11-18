# Patches to Devin (devin-mod only)

Every change to devin-mod: file, before → after, why. Owner's installed Devin and devin-pristine/ are never modified.


## Step 12: Point devin-mod at gateway
- **File**: devin-mod/user-data/User/settings.json (new, user data dir - not app files)
- **Before**: (file did not exist)
- **After**: {"codeium.apiServerUrl": "http://127.0.0.1:20130", "codeium.inferenceApiServerUrl": "http://127.0.0.1:20130"}`n- **Why**: Native VS Code configuration setting; no app code modified.
- **Method**: gateway/src/apply.cjs writes the settings. UNAPPLY removes them.


## Step 12-13: Point devin-mod at gateway + auth bypass

### Patch 1: windsurf-auth FF() production check removal
- **File**: `devin-mod/resources/app/extensions/windsurf-auth/dist/extension.js`
- **Before**: `if(!Zn()&&!jn())return Eo(n)` (blocks reading codeium.* settings in production)
- **After**: `if(!1)return Eo(n)` (always reads from configuration)
- **Why**: Allows `codeium.apiServerUrl` setting to override the default API server URL in production builds.

### Patch 2: windsurf LS spawn URL override
- **File**: `devin-mod/resources/app/extensions/windsurf/dist/extension.js`
- **Before**: `"--api_server_url",e.apiServerUrl` and `"--inference_api_server_url",e.inferenceApiServerUrl`
- **After**: `"--api_server_url","http://127.0.0.1:20130"` and `"--inference_api_server_url","http://127.0.0.1:20130"`
- **Why**: Forces the language server to always connect to the local gateway regardless of config resolution.

### Patch 3: windsurf-auth fake session injection
- **File**: `devin-mod/resources/app/extensions/windsurf-auth/dist/extension.js`
- **Before**: `if(!e){let t=n.readDevCredentials();if(t!==void 0)return t}return[]}`
- **After**: `if(!e){let t=n.readDevCredentials();if(t!==void 0)return t}return[{id:"local-router",accessToken:"devin-router-local-key",account:{label:"Local Owner",id:"local-owner"},scopes:[]}]}`
- **Why**: When no saved session exists, returns a fixed local session to bypass the login screen.

### Patch 4: useBinaryFormat JSON mode
- **File**: `devin-mod/resources/app/extensions/windsurf/dist/extension.js` (4 occurrences) and `windsurf-auth/dist/extension.js` (1 occurrence)
- **Before**: `useBinaryFormat:!0`
- **After**: `useBinaryFormat:!1`
- **Why**: Extension JavaScript uses JSON mode for Connect-RPC instead of binary protobuf. Note: LS binary still uses proto format internally.
