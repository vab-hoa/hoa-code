# Property Report OAuth Session Notes
**Date:** 2026-02-23

## Problem Being Solved
The Property Report web app needs to:
1. Run with admin permissions (Execute as: Me) to access spreadsheets, send emails
2. Identify the user who is accessing it (their email)

## Why Original Approach Failed
- Original approach used client-side Google Sign-In (GIS)
- GIS requires registering JavaScript origins in OAuth client
- Apps Script serves web apps from `*.googleusercontent.com` subdomains
- Google doesn't allow `googleusercontent.com` in OAuth origins (forbidden domain)

## Current Approach: Server-side OAuth Redirect
Using redirect-based OAuth flow instead of client-side:
1. User visits app
2. App redirects to Google OAuth consent page
3. User signs in
4. Google redirects back with authorization code
5. App exchanges code for tokens server-side
6. App extracts email from ID token

## Key Configuration
- **Script ID:** `15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz`
- **OAuth Client ID:** `527585908490-r4vvrctanip4lv39v7bgj9m28ksom342.apps.googleusercontent.com`
- **OAuth Client Secret:** (see Google Cloud Console - not stored in repo)
- **Deployment ID:** `AKfycbxvKgAmbdtBie6WumLoI_7NC7OscV3LmjORbvV7Mag6tDBM6JoQa_FwTe8v7n16R92PIQ`

## Important URL Discovery
- `ScriptApp.getService().getUrl()` returns domain-specific URL: `https://script.google.com/a/villasboulders.org/macros/s/.../exec`
- External users (non-villasboulders.org) get 403 on domain-specific URL
- Must use non-domain URL: `https://script.google.com/macros/s/.../exec`
- Redirect URI is hardcoded in OAUTH_CONFIG to use non-domain URL

## Current Status
- Sign-in page loads correctly
- Google OAuth flow initiates correctly
- Callback receives authorization code
- Token exchange is failing with "Authentication error"
- Need to add detailed error logging to see what's failing

## Files Modified
- `/home/dee/hoa-code/PropertyReport/WebAppController.js` - OAuth flow
- `/home/dee/hoa-code/PropertyReport/WebApp.html` - Template with server-side variables

## OAuth Client Settings Required
**Authorized redirect URIs:**
```
https://script.google.com/macros/s/AKfycbxvKgAmbdtBie6WumLoI_7NC7OscV3LmjORbvV7Mag6tDBM6JoQa_FwTe8v7n16R92PIQ/exec
```

## Resolution
**SOLVED** - 2026-02-23

The missing piece was the `https://www.googleapis.com/auth/script.external_request` scope in appsscript.json. This scope is required for UrlFetchApp to make the token exchange request to Google's OAuth endpoint.

## Final Working Configuration
- Deploy as: **Execute as: Me** / **Who has access: Anyone**
- Sign-in opens in new tab (avoids iframe issues)
- After successful OAuth, user clicks "Continue to App" link
- Session stored in UserCache for 6 hours

## Production URL
```
https://script.google.com/macros/s/AKfycbxvKgAmbdtBie6WumLoI_7NC7OscV3LmjORbvV7Mag6tDBM6JoQa_FwTe8v7n16R92PIQ/exec
```
