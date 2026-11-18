# Patches to Devin (devin-mod only)

Every change to devin-mod: file, before → after, why. Owner's installed Devin and devin-pristine/ are never modified.


## Step 12: Point devin-mod at gateway
- **File**: devin-mod/user-data/User/settings.json (new, user data dir - not app files)
- **Before**: (file did not exist)
- **After**: {"codeium.apiServerUrl": "http://127.0.0.1:20130", "codeium.inferenceApiServerUrl": "http://127.0.0.1:20130"}`n- **Why**: Native VS Code configuration setting; no app code modified.
- **Method**: gateway/src/apply.cjs writes the settings. UNAPPLY removes them.

