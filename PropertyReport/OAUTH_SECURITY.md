# OAuth Client Secret Management

## Background
The OAuth client secret was previously hardcoded in WebAppController.js and accidentally exposed in the GitHub repository. This document covers the secure setup process.

## Setup (One-Time)

### 1. Generate New Client Secret in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **villasboulders-automation**
3. Navigate to **APIs & Services > Credentials**
4. Find the OAuth 2.0 Client ID: `527585908490-r4vvrctanip4lv39v7bgj9m28ksom342.apps.googleusercontent.com`
5. Click edit
6. Delete the compromised secret (if shown)
7. Click **Create new secret** (under "Client secrets")
8. Copy the new secret (it will not be shown again)

### 2. Store Secret in Script Properties

In the Apps Script editor for PropertyReport:

1. Open the Script Editor (Extensions > Apps Script)
2. Go to **Project Settings** (left sidebar)
3. Click **Add a new property** (in the "Script properties" section) — **Note:** This is NOT the same as the Workspace settings
4. Add property:
   - **Name:** `OAUTH_CLIENT_SECRET`
   - **Value:** (paste the new secret from step 1.8)
5. Click **Save**

### 3. Test the Configuration

1. Deploy the web app (if not already deployed)
2. Visit the PropertyReport URL
3. You should be redirected to Google sign-in (not an error about missing secret)

## Secure Practices

- **Never commit secrets to git.** The code now fetches the secret from Script Properties at runtime.
- **Script Properties are private to the Apps Script project** and not exported to git.
- When deploying to a new script or environment, repeat "Setup" above.

## Troubleshooting

**"OAUTH_CLIENT_SECRET not set" error:**
- Ensure you added the property to **Script Properties** (in Project Settings), not as a comment or code variable
- Properties are case-sensitive: must be exactly `OAUTH_CLIENT_SECRET`

**"Invalid client" error on sign-in:**
- The client secret may have expired or been regenerated without updating Script Properties
- Repeat the setup process above

## Future Secret Rotation

When you rotate the OAuth secret for maintenance or security:

1. Generate a new secret in Google Cloud Console (repeat section 1 above)
2. Update the Script Property in Apps Script editor (repeat section 2)
3. Old secret becomes invalid immediately; no code changes needed
