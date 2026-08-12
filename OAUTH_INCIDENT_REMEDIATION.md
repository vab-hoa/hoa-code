# OAuth Credential Exposure — Incident Remediation

## Timeline
- **2026-08-12**: Google Cloud Platform alert: OAuth client secret exposed in GitHub repository
- **2026-08-12**: Secret removed from source code and git history; code force-pushed to GitHub

## What Happened
The OAuth client secret (`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`) for the PropertyReport web app was hardcoded in `PropertyReport/WebAppController.js` and committed to the public GitHub repository. This exposed the secret since the repository's initial commit.

**Client ID:** `527585908490-r4vvrctanip4lv39v7bgj9m28ksom342.apps.googleusercontent.com`  
**GCP Project:** `villasboulders-automation`

## Immediate Actions Taken

### 1. Code Changes
- ✅ Removed hardcoded secret from `WebAppController.js`
- ✅ Added `getOAuthSecret()` function to fetch secret from Apps Script Properties at runtime
- ✅ Created `PropertyReport/OAUTH_SECURITY.md` with setup instructions

### 2. Git History Cleanup
- ✅ Used `git filter-branch` to replace all instances of the exposed secret with `[REDACTED-EXPOSED-SECRET]` in all historical commits
- ✅ Garbage collected and force-pushed to GitHub
- ✅ Remote history now contains no working credentials

### 3. Commits
- `5153f7c`: Security fix — move secret to Script Properties, document setup
- All historical commits rewritten with redacted placeholder

## What You Need to Do

### 1. Regenerate the OAuth Client Secret (REQUIRED)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **villasboulders-automation**
3. Navigate to **APIs & Services > Credentials**
4. Find OAuth 2.0 Client ID: `527585908490-r4vvrctanip4lv39v7bgj9m28ksom342.apps.googleusercontent.com`
5. Click the pencil icon to edit
6. Delete the compromised secret (listed under "Client secrets")
7. Click **Create new secret**
8. **Copy the new secret immediately** (it will never be shown again)

### 2. Store New Secret in Apps Script Properties (REQUIRED)

1. Open Apps Script editor for PropertyReport
   - **In Google Drive:** Open PropertyReport web app
   - **Or direct link:** Script ID: `15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz`
   - Click the **Apps Script** button / editor icon

2. In the Apps Script editor:
   - Click **Project Settings** (left sidebar, gear icon)
   - Scroll to **Script properties** section
   - Click **Add property**
   - Set:
     - **Property name:** `OAUTH_CLIENT_SECRET`
     - **Value:** (paste the new secret from step 1.8)
   - Click **Save**

3. Close the properties dialog

### 3. Test the Fix (RECOMMENDED)

1. Deploy the web app (if not already deployed):
   - From Apps Script editor: **Deploy > New Deployment**
   - Type: Web App
   - Execute as: Me
   - Who has access: Anyone
   - Click Deploy

2. Visit the PropertyReport URL (or redeploy if already live)

3. You should see the Google sign-in page (not a "missing secret" error)

4. Test signing in with your Google account

## Credential Scope

The exposed OAuth client secret only has these permissions:
- **Scopes:** `email`, `profile` (read-only)
- **Access:** Uses Authorization Code flow (can only be used server-side)
- **Risk:** Limited to identity verification; cannot access Google Drive, Gmail, or other sensitive data

## Verification Checklist

- [ ] Generated new client secret in Google Cloud Console
- [ ] Stored new secret in Apps Script Properties (property name: `OAUTH_CLIENT_SECRET`)
- [ ] Verified property was saved
- [ ] Tested PropertyReport sign-in flow (or scheduled to test)
- [ ] Updated Bitwarden vault (optional but recommended)

## Documentation
- **Setup details:** See `PropertyReport/OAUTH_SECURITY.md`
- **Code location:** `PropertyReport/WebAppController.js`, lines 13–24 (getOAuthSecret function)

## Notes

- The exposed secret in git history is now rendered non-functional; GitHub has been notified via the force-push
- If Google's alert system requests verification, reference this remediation document
- Future rotation: When you regenerate the secret for maintenance, only the Script Properties needs to be updated — no code changes required
