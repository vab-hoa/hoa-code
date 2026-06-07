# HOA Code - Villas at the Boulders

## Owner
Dee Buck (dee@wmbuck.net) - HOA President, villasboulders.org

## What This Is
Code and automation for the Villas at the Boulders HOA (Broomfield, CO).
All Google Apps Script projects deploy to the villasboulders.org Google Workspace.

## Repository: github.com/vab-hoa/hoa-code

## Projects

### Apps Script (deployed via `clasp push`)
- **PropertyReport/** - Property report generator. Web app with OAuth sign-in. Generates section-based Google Doc reports (gutters, wood trim, HOA account, property activity) and emails links to homeowners. Script ID: `15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz`
- **HOALibrary/** - Shared library for address standardization, homeowner lookups. Script ID: `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
- **LabelsToGroups/** - Gmail labels to Google Groups sync

### GitHub Actions (cloud-hosted, runs without oregano)
- **keystone-scraper/** - Selenium scraper for Keystone HOA management portal (violations, work orders, profiles). Runs nightly at 3 AM MDT via `.github/workflows/keystone-scraper.yml`. Writes to Keystone Cache spreadsheet. Credentials stored as GitHub Actions secrets (KEYSTONE_USERNAME, KEYSTONE_PASSWORD, GOOGLE_SERVICE_ACCOUNT_JSON).

### Python Tools (run locally on oregano)
- **heif-converter/** - Converts HEIF/HEIC photos (iPhone) to JPEG in Google Drive. Also updates spreadsheets with photo references.
- **photos-to-drive/** - Syncs Google Photos to Google Drive folders
- **exif-to-parcel/** - GPS-based photo-to-parcel matcher (completed v1.0)

### Utilities
- **sync_to_drive.sh** - Backs up code to Google Drive (HOA Board Documents/Code/)
- **pull_from_drive.sh** - Pulls code from Google Drive

## Google Auth

### Service Account
- **File:** `~/.config/openclaw/google-service-account.json` (NOT in this repo)
- **Email:** `openclaw-automation@villasboulders-automation.iam.gserviceaccount.com`
- **GCP Project:** `villasboulders-automation`
- **Impersonates:** `admin@villasboulders.org` via domain-wide delegation

### Auth Pattern (IMPORTANT)
Two-step credential creation — use `.with_subject()`:
```python
credentials = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
delegated = credentials.with_subject('admin@villasboulders.org')
service = build('drive', 'v3', credentials=delegated)
```

### Authorized Delegation Scopes
Only these exact scopes work with impersonation (no readonly variants):
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/admin.directory.group`
- `https://www.googleapis.com/auth/admin.directory.user.readonly`
- `https://www.googleapis.com/auth/groups`
- `https://www.googleapis.com/auth/contacts.readonly`

### Clasp
- Auth token: `~/.clasprc.json`
- Re-login: `clasp login`
- **IMPORTANT:** `clasp push` alone is not enough for production. The web app runs against a pinned deployment version. After pushing, also run:
  ```
  clasp deploy --deploymentId AKfycbx62bPhhAZFwdpQclnb8EuZF92EK5ksXxVosc7xvW6GgbFs3MfJX8x4VKLqP3Csf9JV --description "description"
  ```

## Key Spreadsheets
- Keystone Cache: `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`
- Gutters: `10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A` (in PropertyReport `CONFIG.guttersSheetId`)
- Wood Trim (current, JPEG photos): `1Eu0y6O8Uco6VZ1mYcB2ehDXwE_EV_NJHV_M5Ji6Mts0` — this is what the property report uses (`CONFIG.woodTrimSheetId`)
- Wood Trim (original, HEIC photos): `1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE` — legacy source sheet; iPhone photos in HEIF/HEIC format that Google Docs cannot render. `HeifConverter.js` reads from this sheet, converts photos to JPEG, and writes results to the current sheet above. Do not use for reporting.
- Window Wells: `1jShPXcgTiErKDQzZPlKfg_ByzS9b1AlrZcfCVoYtnjA` (in PropertyReport `CONFIG.windowWellsSheetId`)

## Key Drive Folders
- Code backup: `1VH1UQdEQYDY3cSXVEjIhWxq7r6x3wmvm`
- Property Reports (generated docs): accessible to service account directly

## Documentation
- `CURRENT_PLAN.md` - What we're working on
- `INDEX.md` - Document navigation
- `ARCHITECTURE.md` - System overview
- Project-specific READMEs in each subdirectory

## Conventions
- Apps Script files use `.js` extension locally, pushed as `.gs` by clasp
- Python projects each have their own venv/ (gitignored)
- Role-based emails: president@, admin@, manager@ villasboulders.org (Google Groups)
