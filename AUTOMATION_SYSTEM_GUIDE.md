# Villas at the Boulders HOA — Automation System Guide

**Last updated:** 2026-09-07  
**Owner:** Dee Buck, HOA President & IT Officer  
**Repository:** github.com/vab-hoa/hoa-code (private)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Infrastructure](#infrastructure)
3. [Projects & Applications](#projects--applications)
4. [Authentication & Credentials](#authentication--credentials)
5. [Scheduled Tasks](#scheduled-tasks)
6. [Development & Deployment](#development--deployment)
7. [Key Spreadsheets & Data](#key-spreadsheets--data)
8. [Conventions & Standards](#conventions--standards)
9. [Troubleshooting & Common Tasks](#troubleshooting--common-tasks)

---

## System Overview

The HOA automation system is a suite of interconnected tools for managing neighbor communications, property violations, work orders, and community board discussions. It replaces manual processes with cloud-based Google Workspace integration, GitHub Actions for scheduled tasks, and a modern Next.js dashboard for board visibility.

**Key principles:**
- **No on-premises critical dependencies** — all automation runs in the cloud (GitHub Actions, Google Apps Script, Vercel)
- **Git-first workflow** — code changes go through git; no out-of-band manual edits
- **Service account impersonation** — automation runs as `admin@villasboulders.org` via a GCP service account
- **Modular design** — each project is independent but shares common infrastructure (Google Workspace, GitHub, Supabase)

---

## Infrastructure

### Google Workspace (villasboulders.org)

- **Domain:** villasboulders.org (registered at Namecheap; delegated manager access to Dee)
- **Workspace admin:** admin@villasboulders.org (only licensed Workspace user; other board members use external Gmail)
- **Role-based groups:**
  - `owners@villasboulders.org` — all 124 homeowners
  - `board@villasboulders.org` — HOA board members
  - `president@villasboulders.org` — IT Officer / current president
  - `manager@villasboulders.org` — management company contact (Josh Hall, Keystone Pacific)
  - `admin@villasboulders.org` — automation impersonation target (service account with domain-wide delegation)
  - Six street groups: `bouldercircle@`, `boulderpoint@`, `broadlandslane@`, `plasterpoint@`, `rockpoint@`, `stonecircle@`, plus `residents@` for community board all-streets posts

**Key services:**
- **Google Drive** — source of truth for HOA documents, property reports, community board data
- **Google Sheets** — all automation data lives in sheets (Keystone Cache, Property Reports, Community Board responses, etc.)
- **Gmail API** — used by automation to send notifications and board emails
- **Google Groups** — street groups for neighbor discussions
- **Google Sites** — public website (villasboulders.org)

### GitHub (vab-hoa Organization)

- **Repository:** `vab-hoa/hoa-code` (private)
- **Owners:** vab-it-officer (succession account), deebuck (Dee)
- **Permissions:** All code changes go through git (no manual out-of-band edits)

**GitHub Actions:** All scheduled automation runs here. No dependencies on oregano (Dee's local machine).
- Workflows stored in `.github/workflows/`
- Secrets stored in GitHub organization settings (encrypted at rest, decrypted only at runtime)

### Google Cloud Platform (villasboulders-automation)

- **GCP Project:** `villasboulders-automation`
- **Service Account:** `openclaw-automation@villasboulders-automation.iam.gserviceaccount.com`
- **Key details:**
  - Domain-wide delegation enabled (impersonates admin@villasboulders.org)
  - Authorized scopes: drive, spreadsheets, gmail.send, gmail.readonly, calendar, admin.directory.group, admin.directory.user.readonly, groups, contacts.readonly
  - Multiple key generations in circulation (see [Authentication § 1](#1-gcp-service-account--openclaw-automation) for inventory)

**Used for:**
- GitHub Actions runners (Sheets/Drive writes, Gmail sending, Google Group management)
- Vercel deployments (Supabase Postgres auth, Gmail sending from the dashboard)
- Apps Script (optional; PropertyReport uses OAuth instead)

### Supabase (Database)

- **Project:** hoa-tracker-dashboard database
- **URL:** https://obveytoovkzjrpzrhrim.supabase.co
- **Provider:** Supabase (Postgres on managed infrastructure)
- **Used by:** hoa-tracker-dashboard (Next.js), GitHub Actions sync-keystone-status workflow
- **Tables:** work orders, ARC requests, violations, correspondence, email activity
- **Auth:** Service role key (full access, server-side only) + anon key (public, read-only via RLS)

**Important:** Never expose the service role key client-side.

### Vercel (Hosting)

- **Project:** `vab-hoa/hoa-tracker-dashboard`
- **Domain:** tracker.villasboulders.org
- **Deployment:** Automatic on git push to main branch
- **Environments:** Production (main), Preview (branch deployments), Development (local `vercel dev`)

**URL schema:**
- Production: https://tracker.villasboulders.org (or vercel URL)
- Preview: temporary URLs for each PR or branch
- Development: local dev with `vercel dev`

---

## Projects & Applications

### 1. Apps Script Projects (Google Apps Script)

All deployed via `clasp push` + `clasp deploy --deploymentId <ID>`.

#### PropertyReport
- **Type:** OAuth-protected web app (users sign in with Google account)
- **Script ID:** `15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz`
- **Deployment ID:** See [important_ids.md](important_ids.md)
- **URL:** Deployed web app endpoint (accessible to homeowners on villasboulders.org)
- **Scopes:** email, profile (OAuth only; no Drive/Sheets/Gmail scopes)
- **Function:** Generates property report Google Docs for homeowners showing gutters, wood trim, violations, and account status
- **Data sources:** Gutters, Wood Trim, Window Wells, and Concrete spreadsheets; Keystone scraper data
- **Output:** Email links to generated Google Docs

#### HOALibrary
- **Type:** Shared library (no web app UI)
- **Script ID:** `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
- **Function:** Address standardization, homeowner lookups, shared utilities for other Apps Script projects
- **Used by:** PropertyReport, LinkMonitor, ARC/LBC/WO/Volunteer forms

#### LinkMonitor
- **Type:** Scheduled web crawler
- **Script ID:** `1NDs6kxjB1z4LO8liXNFlNfHkb5o9I6ovYrS2RQtcKGR5tgchpzA5eFPt`
- **Schedule:** Daily, 3 AM MDT (Apps Script time trigger)
- **Function:** Crawls villasboulders.org, checks all links, emails admin@ on new broken links
- **Output:** Email to admin@villasboulders.org

#### LabelsToGroups (RETIRED)
- **Status:** Replaced by labels_to_groups.py (GitHub Actions, 2026-06-XX)
- **Note:** Directory kept for history; run `deleteTriggers()` from the Apps Script editor once to remove the old daily trigger

#### ARC Request Form, LBC Request Form, WO Request Form, Volunteer Form, Volunteer Expense Form
- **Type:** Single-page web apps with form submission → Sheet moderation → email notification
- **Function:** Collect requests from homeowners, route to admin for approval, send notifications
- **Deployment pattern:** Direct URLs (not iframes) link from Google Sites
- **Data flow:** Form submission writes to Google Sheet → admin approves/rejects via Sheet → status updated
- **Authentication:** ANYONE_ANONYMOUS (no login required)

#### Community Board
- **Type:** Web app with Browse + Post pages (combined single deployment)
- **Deployment ID:** See [CommunityBoard/DEPLOYMENT_INFO.txt](CommunityBoard/DEPLOYMENT_INFO.txt)
- **URL:** Public link from Google Sites
- **Features:** 
  - Browse page: filterable list of approved posts (category, street, search)
  - Post form: submit vendor recommendations, help requests, items for sale, general tips
  - Manual moderation: admin sets Approved=TRUE/FALSE in Sheet
  - Street group links: posts link to street Google Groups for discussion
  - "All streets" default: posts default to residents@ group instead of single street
- **Data:** Google Sheet with Form Responses tab (raw) and Config tab (street → group mapping)

### 2. GitHub Actions Workflows

All cloud-hosted; no oregano dependencies except `daily_memory_sync.sh`. Workflows stored in `.github/workflows/`.

#### keystone-scraper.yml
- **Trigger:** Daily, 3 AM MDT
- **Function:** Scrapes Keystone HOA management portal for violations, work orders, homeowner profiles
- **Implementation:** Selenium + Python (in `keystone-scraper/` directory)
- **Output:** Writes to "Keystone Cache" Google Sheet
- **Secrets used:** KEYSTONE_USERNAME, KEYSTONE_PASSWORD, GOOGLE_SERVICE_ACCOUNT_JSON
- **Dependencies:** Keystone Pacific portal (kppm.cincwebaxis.com)

#### work-order-schedule.yml
- **Trigger:** Daily, 7 AM MDT
- **Function:** Calendar-aware work order report emailer
- **Implementation:** Python script reads Keystone Cache sheet, builds PDF report
- **Output:** 
  - Emails to board@, manager@ before monthly meetings
  - Emails to board@ before check-in Thursdays
- **Secrets used:** GOOGLE_SERVICE_ACCOUNT_JSON

#### broadlands-sync.yml
- **Trigger:** Weekly, Monday 4:30 AM MDT
- **Function:** Syncs Broadlands Master Association documents from Keystone
- **Output:** Updates `broadlands_manifest.json` in git (auto-commit on changes)
- **Secrets used:** KEYSTONE_USERNAME, KEYSTONE_PASSWORD, GOOGLE_SERVICE_ACCOUNT_JSON

#### labels-to-groups.yml
- **Trigger:** Daily, 3 AM MDT (can be triggered on-demand from GitHub UI)
- **Function:** Gmail contact group labels → Google Groups sync
- **Implementation:** Python script in `keystone-scraper/labels_to_groups.py`
- **Replaces:** Old Apps Script `LabelsToGroups` project (2026-06-XX)
- **Output:** Gmail contacts labeled with street names synced to street Google Groups
- **Secrets used:** GOOGLE_SERVICE_ACCOUNT_JSON

#### sync-keystone-status.yml
- **Trigger:** Daily, 4 AM MDT (after keystone-scraper completes)
- **Function:** Syncs scraped Keystone data to Supabase Postgres (for hoa-tracker-dashboard)
- **Implementation:** Node.js scripts (`generate-arc-serials.js`, `sync-keystone-status.js`)
- **Output:** Supabase tables updated (work_orders, arc_requests, violations, etc.)
- **Secrets used:** GOOGLE_SERVICE_ACCOUNT_JSON, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

### 3. Next.js Dashboard (Vercel)

#### hoa-tracker-dashboard
- **Type:** Read-only issue tracker dashboard (no editing, no login in Phase 1)
- **Language:** TypeScript/React
- **Hosted on:** Vercel (tracker.villasboulders.org)
- **URL:** https://tracker.villasboulders.org
- **Data source:** Supabase Postgres
- **Features:**
  - Displays work items, ARC requests, violations, correspondence, email activity
  - Filterable by status, category, street
  - Board can view real-time Keystone data without logging into Keystone portal
- **Development:** `vercel dev` locally; `vercel env pull` for environment setup
- **Deployment:** Automatic on git push to main; preview deployments for branches

**Phase status:** Phase 1.5 complete (dark theme, sortable columns). Phase 2 in progress.

### 4. Python Tools (Run Locally on oregano)

Note: These are NOT part of the critical automation path (which is all in GitHub Actions now).

- **heif-converter/** — Converts iPhone HEIF/HEIC photos to JPEG in Google Drive; updates spreadsheets
- **photos-to-drive/** — Syncs Google Photos to Drive folders
- **exif-to-parcel/** — GPS-based photo-to-parcel matcher (v1.0 complete)
- **hoa-tracker/email_processor.py** — Ingests board emails into Supabase (local oregano only; uses app password in `~/hoa-code/hoa-tracker/secrets/`)

### 5. Utilities

- **sync_to_drive.sh** — Backs up code to Google Drive (HOA Board Documents/Code/)
- **pull_from_drive.sh** — Pulls code from Google Drive (legacy; git is now authoritative)

---

## Authentication & Credentials

**Complete credential inventory:** See [memory/auth_inventory.md](../memory/auth_inventory.md) for detailed up-to-date list of every credential, where it lives, when it was last touched, and current vs deprecated status.

**Architecture reference:** See [memory/gcp_apps_script_architecture.md](../memory/gcp_apps_script_architecture.md) for explanation of how GCP projects, Apps Script OAuth, and Workspace delegation relate to each other.

### 1. GCP Service Account — `openclaw-automation`

**Email:** openclaw-automation@villasboulders-automation.iam.gserviceaccount.com  
**GCP Project:** villasboulders-automation  
**Domain-wide delegation:** Impersonates admin@villasboulders.org via `.with_subject()`

**Authorized scopes (these specific scopes ONLY):**
- https://www.googleapis.com/auth/drive
- https://www.googleapis.com/auth/spreadsheets
- https://www.googleapis.com/auth/gmail.send
- https://www.googleapis.com/auth/gmail.readonly
- https://www.googleapis.com/auth/calendar
- https://www.googleapis.com/auth/admin.directory.group
- https://www.googleapis.com/auth/admin.directory.user.readonly
- https://www.googleapis.com/auth/groups
- https://www.googleapis.com/auth/contacts.readonly

**CRITICAL:** Do NOT use `.readonly` variants (e.g., `drive.readonly`). Domain-wide delegation doesn't work with read-only scopes.

**Key locations:**
| # | Location | Status | Used by |
|---|----------|--------|---------|
| 1 | `~/.config/openclaw/google-service-account.json` (oregano) | Stale (Feb 2026) | Nothing currently; candidate for deletion |
| 2 | GitHub Actions secret `GOOGLE_SERVICE_ACCOUNT_JSON` | Active (last updated Aug 25) | keystone-scraper, broadlands-sync, labels-to-groups, work-order-schedule, sync-keystone-status |
| 3 | Vercel env var `GOOGLE_SERVICE_ACCOUNT_B64` | Active (refreshed Aug 30) | hoa-tracker-dashboard `/send` page (Gmail API) |

**Python usage pattern:**
```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

credentials = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
delegated = credentials.with_subject('admin@villasboulders.org')
service = build('drive', 'v3', credentials=delegated)
```

**Node.js usage pattern (JWT):**
```javascript
const {JWT} = require('google-auth-library');
const jwt = new JWT({
  email: 'openclaw-automation@villasboulders-automation.iam.gserviceaccount.com',
  key: privateKey,
  scopes: SCOPES,
  subject: 'admin@villasboulders.org'
});
const authClient = await jwt.authorize();
const sheets = google.sheets({version: 'v4', auth: authClient});
```

### 2. PropertyReport OAuth Client

**Client ID:** 527585908490-r4vvrctanip4lv39v7bgj9m28ksom342.apps.googleusercontent.com  
**GCP Project:** villasboulders-automation  
**Scopes:** email, profile only (no Drive/Sheets/Gmail access)  
**Secret storage:** Apps Script Script Properties (PropertyReport project, property name `OAUTH_CLIENT_SECRET`)

**Security:** Original secret was exposed in public GitHub commit (2026-08-12). Incident remediated:
- Removed hardcoded secret from code
- Moved to Script Properties at runtime
- Git history rewritten with `git filter-branch`
- Old secret revoked; new secret generated and stored in Script Properties
- See [OAUTH_INCIDENT_REMEDIATION.md](OAUTH_INCIDENT_REMEDIATION.md) for full details

### 3. GitHub Actions Secrets

Managed via `gh secret` CLI or GitHub web UI. Last audited 2026-08-30:

| Secret | Last updated | Used by | Purpose |
|--------|---------------|---------|---------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 2026-08-25 | All Python/Node workflows | GCP service account (see §1) |
| `KEYSTONE_USERNAME` | 2026-06-07 | keystone-scraper, broadlands-sync | Keystone portal login |
| `KEYSTONE_PASSWORD` | 2026-06-07 | keystone-scraper, broadlands-sync | Keystone portal login |
| `SUPABASE_URL` | 2026-08-25 | sync-keystone-status | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 2026-08-25 | sync-keystone-status | Server-side Supabase full access |

**Adding a new secret:**
```bash
gh secret set MY_SECRET --repo vab-hoa/hoa-code --body "secret value"
```

**Rotating a secret:**
```bash
gh secret set MY_SECRET --repo vab-hoa/hoa-code --body "new value"
```

### 4. Vercel Environment Variables

Managed via `vercel env` CLI or Vercel web dashboard. For hoa-tracker-dashboard project:

| Variable | Environments | Purpose | Sensitive |
|----------|--------------|---------|-----------|
| `GOOGLE_SERVICE_ACCOUNT_B64` | Prod, Preview, Dev | Base64-encoded GCP service account JSON for Gmail API | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Prod, Preview, Dev | Supabase project URL (public) | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod, Preview, Dev | Public anon key for client-side Supabase access (RLS enforced) | No |

**For local development:**
```bash
cd hoa-tracker-dashboard
vercel env pull  # Downloads current environment
npm run dev
```

### 5. Apps Script Script Properties

PropertyReport stores `OAUTH_CLIENT_SECRET` here (cannot be exported via git or clasp — must be managed in the Apps Script editor).

**To access or update:**
1. Go to script.google.com
2. Open PropertyReport project
3. Click Project Settings
4. Scroll to Script Properties
5. Edit or add `OAUTH_CLIENT_SECRET`

### 6. clasp Authentication

**File:** `~/.clasprc.json` (OAuth token for Apps Script CLI)  
**Status:** Check expiry before deploying — if expired, re-auth:
```bash
clasp login
```

### 7. Local oregano Secrets (outside git)

| File | Contents | Status | Used by |
|------|----------|--------|---------|
| `~/hoa-code/hoa-tracker/secrets/.gmail_pw_mcdonaldbuckhoa` | Gmail app password | Active (mode 600) | hoa-tracker/email_processor.py |
| `~/hoa-code/hoa-tracker/secrets/.supabase_db_password` | Supabase DB password | Active (mode 600) | hoa-tracker/email_processor.py |
| `~/.clasprc.json` | clasp OAuth token | Active | `clasp push`/`clasp deploy` |

---

## Scheduled Tasks

All times are MDT. Most tasks run in GitHub Actions (cloud); LinkMonitor runs in Apps Script.

| Time | Frequency | Task | Workflow | Output |
|------|-----------|------|----------|--------|
| 3 AM | Daily | Scrape Keystone portal (violations, work orders, profiles) | keystone-scraper.yml | Keystone Cache sheet |
| 3 AM | Daily | Sync Gmail labels to Google Groups | labels-to-groups.yml | Street group memberships |
| 3 AM | Daily | Link check villasboulders.org | LinkMonitor (Apps Script time trigger) | Email to admin@ on new broken links |
| 4 AM | Daily | Sync Keystone data to Supabase | sync-keystone-status.yml | hoa-tracker-dashboard database |
| 7 AM | Daily | Work order report email | work-order-schedule.yml | Email to board@, manager@ |
| 4:30 AM | Weekly (Mon) | Sync Broadlands Master Association docs | broadlands-sync.yml | broadlands_manifest.json commit |

---

## Development & Deployment

### Apps Script Deployment (clasp)

**Workflow:**
1. Make code changes in the local directory (e.g., `CommunityBoard/Code.gs`)
2. Push to git (required by project policy)
3. Run `clasp push --force` to update the Apps Script editor
4. Run `clasp deploy -i <DEPLOYMENT_ID> -d "description"` to update the public deployment

**CRITICAL:** `clasp push` alone does NOT update what users see. It only updates the editor. You must also deploy.

**Example:**
```bash
cd /home/dee/hoa-code/CommunityBoard
clasp push --force
clasp deploy -i AKfycbzyn986Bx40Fv6SdeWNQcWTHEhsXeXFXR9S92ZppM03USOZ16-hWkB8bOAoCF-kk3I9Fw -d "Add All streets option"
```

**Verify deployment landed:**
```bash
curl -s "https://script.google.com/macros/s/AKfycbzyn986Bx40Fv6SdeWNQcWTHEhsXeXFXR9S92ZppM03USOZ16-hWkB8bOAoCF-kk3I9Fw/exec" | grep -c "showPostModal"
```
(Should return 1 if the new code is live)

**clasp is not installed globally on oregano:**
```bash
npx --yes @google/clasp@3.0.6-alpha <cmd>
```
(v3 required — ~/.clasprc.json uses v3 `tokens.default` format)

### GitHub Actions Deployment

**Workflow:**
1. Code changes go to a branch
2. Open PR (optional, but encouraged)
3. Merge to main → GitHub Actions automatically triggers workflows
4. Workflows read git@main, execute, and may commit back (e.g., broadlands-sync)

**Secrets are inherited from organization settings** — no need to re-add them per-repo.

**To test a workflow locally:**
```bash
gh act  # Requires act CLI: https://github.com/nektos/act
```

### Next.js Dashboard Deployment (Vercel)

**Workflow:**
1. Code changes to `hoa-tracker-dashboard/`
2. Push to branch or main
3. GitHub <→ Vercel integration automatically triggers deployments
4. Branch deployments: temporary preview URLs
5. Main branch: auto-deploys to https://tracker.villasboulders.org

**To check deployment status:**
- Vercel dashboard: https://vercel.com/teams/vab-hoa
- CLI: `vercel ls` (list deployments), `vercel inspect <url>` (details)

**Environment secrets:**
- Managed in Vercel dashboard or `vercel env` CLI
- Pulled locally via `vercel env pull`
- **Note:** Preview/Development copies of `GOOGLE_SERVICE_ACCOUNT_B64` are stale (2026-08-28); recommend syncing to Production copy (2026-08-30)

---

## Key Spreadsheets & Data

| Name | ID | Used by | Purpose |
|------|----|---------|---------| 
| Keystone Cache | 1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ | keystone-scraper, work-order-schedule, dashboard | Raw scraped data from Keystone (violations, work orders, profiles) |
| Gutters | 10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A | PropertyReport | Gutter inspection records |
| Wood Trim (current, JPEG) | 1Eu0y6O8Uco6VZ1mYcB2ehDXwE_EV_NJHV_M5Ji6Mts0 | PropertyReport | Wood trim photos (JPEG, can render in Google Docs) |
| Wood Trim (legacy, HEIC) | 1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE | heif-converter | Legacy iPhone photos; converted to JPEG sheet above |
| Window Wells | 1jShPXcgTiErKDQzZPlKfg_ByzS9b1AlrZcfCVoYtnjA | PropertyReport | Window well inspection records |
| Community Board | 1mhbzm-qoUvdp_AI8P59gzJrGNnBo3Zmcxjkn0Um86xE | Community Board web app | Form responses (raw) + Config (street→group mapping) |

**Important:** All spreadsheets are in "My Drive" (not Shared Drives), owned by admin@villasboulders.org. Service account has access via domain-wide delegation.

---

## Conventions & Standards

### Git Workflow
- Main branch is authoritative
- All code changes committed to git before deployment
- `clasp push` updates editor; `clasp deploy --deploymentId` updates public URL
- GitHub Actions workflows committed in `.github/workflows/`
- No manual out-of-band changes (Jane's OpenClaw gate ensures this)

### Naming
- Apps Script files: `.js` locally, pushed as `.gs` by clasp
- Python projects: each has its own `venv/` (gitignored)
- Google Groups: lowercase, hyphenated (`bouldercircle@`, not `Boulder Circle@`)
- Role-based emails: `president@`, `admin@`, `manager@` (Google Groups, not personal mailboxes)

### Error Handling
- Apps Script: use `Logger.log()` for debugging (visible in execution logs)
- Python: log to stdout; GitHub Actions captures in workflow run output
- Node.js: standard `console.log()`; Vercel captures in deployment logs

### Security
- Never log or print credential values, even masked
- Service account JSON never stored in public git repos
- OAuth secrets stored in Apps Script Script Properties, not in code
- GitHub Actions secrets used instead of environment files
- Supabase service role key never exposed client-side

---

## Troubleshooting & Common Tasks

### Apps Script Deployments

**Problem:** Public URL still shows old code after `clasp push`  
**Solution:** You must also run `clasp deploy --deploymentId <ID>`. The push only updates the editor.

**Problem:** Browser tab shows "No posts" or stale data after deployment  
**Solution:** Close all tabs, open fresh incognito window. Apps Script caches iframe sessions at page-load time.

**Problem:** `clasp login` fails  
**Solution:** Check `~/.clasprc.json` expiry. If expired, delete it and re-run `clasp login`.

### GitHub Actions Workflows

**Problem:** Workflow fails with "permission denied" on Sheets API call  
**Solution:** Check the `GOOGLE_SERVICE_ACCOUNT_JSON` secret is up-to-date. Older keys may lack the required scopes. Compare against current key in GCP IAM.

**Problem:** Workflow runs but data doesn't appear in sheet  
**Solution:** Verify the sheet name is spelled correctly and `GOOGLE_SERVICE_ACCOUNT_JSON` has `spreadsheets` scope with domain-wide delegation.

**Problem:** Link-checker sends email even when links are fixed  
**Solution:** LinkMonitor tracks NEW broken links only. If a link was fixed, manually update the email list in LinkMonitor script.

### Supabase / Dashboard

**Problem:** Dashboard shows stale work order data  
**Solution:** Check sync-keystone-status workflow runs correctly (4 AM daily). If failing, check `SUPABASE_SERVICE_ROLE_KEY` is valid in GitHub Actions secrets.

**Problem:** `/send` page returns 500 error  
**Solution:** Check Vercel logs. Likely `GOOGLE_SERVICE_ACCOUNT_B64` is corrupted or outdated. Verify in Vercel env vars that the base64 JSON is valid.

### General Debugging

**To check what a GitHub Actions workflow is using:**
```bash
gh secret list --repo vab-hoa/hoa-code
```

**To run a workflow on-demand:**
```bash
gh workflow run labels-to-groups.yml --repo vab-hoa/hoa-code
```

**To view logs from last workflow run:**
```bash
gh run list --repo vab-hoa/hoa-code --limit 5
gh run view <run-id> --repo vab-hoa/hoa-code --log
```

**To manually test an Apps Script function:**
1. Open the script in script.google.com
2. Select function from dropdown
3. Click "Run"
4. Check "Execution log" for output

**To check current Supabase data:**
1. Go to https://app.supabase.com
2. Login with Workspace Google account
3. Navigate to hoa-tracker-dashboard project
4. Browse SQL Editor or Table view

---

## Related Documentation

- **[CLAUDE.md](CLAUDE.md)** — Project structure, script IDs, deployment IDs
- **[memory/auth_inventory.md](../memory/auth_inventory.md)** — Complete credential inventory (current/deprecated status, key IDs, locations)
- **[memory/gcp_apps_script_architecture.md](../memory/gcp_apps_script_architecture.md)** — Architecture explanation (GCP projects, OAuth, delegation)
- **[OAUTH_INCIDENT_REMEDIATION.md](OAUTH_INCIDENT_REMEDIATION.md)** — PropertyReport OAuth secret exposure incident (2026-08-12)
- **[PropertyReport/OAUTH_SECURITY.md](PropertyReport/OAUTH_SECURITY.md)** — Ongoing OAuth management
- **[hoa-tracker-dashboard/README.md](hoa-tracker-dashboard/README.md)** — Dashboard local dev and deployment
- **[CommunityBoard/README.md](CommunityBoard/README.md)** — Community Board web app
- **[important_ids.md](important_ids.md)** — All script IDs, deployment IDs, folder IDs, spreadsheet IDs

---

**For questions or updates to this guide:** Contact the IT Officer (Dee Buck, dee@wmbuck.net).

Last reviewed: 2026-09-07  
Next review recommended: 2026-12-31
