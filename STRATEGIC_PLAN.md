# HOA Automation — Strategic Plan

**Owner:** Dee Buck, IT Officer, Villas at the Boulders HOA
**Last Updated:** June 7, 2026
**Status:** LIVING DOCUMENT — revise as we go

This replaces CURRENT_PLAN.md, REFACTORING_ROADMAP.md, and
FUTURE_APPSHEET_PLAN.md as the single source of truth for direction.
Those older documents are kept for reference but are no longer
authoritative.

---

## Why This System Exists

The Villas at the Boulders is a 124-homeowner HOA in Broomfield, CO.
The HOA has already lost data once — in the 2024 transition from
AdvanceHOA to Keystone Pacific, historical records were lost because they
existed only in the management company's portal. That will happen again
someday when the management company changes.

This automation system exists to:

1. **Own the HOA's data** — not depend on a management company portal as
   the only copy of violations, work orders, account numbers, and property
   history
2. **Communicate with homeowners** — property reports, group emails,
   document sharing
3. **Reduce manual work** — contact group management, photo organization,
   report generation

The system must eventually run without Dee. The IT Officer position
continues regardless of who holds it, but the next person may not be
technical. The system should be as self-running as possible, with clear
documentation of what it does, why, and what to do if something breaks.

---

## What We Have

### Runs in Google's Cloud (Survives Oregano)

These keep running even if Dee's home server dies or is shut down.

| Component | What It Does | State |
|-----------|-------------|-------|
| **PropertyReport** (16 Apps Script files) | Homeowner requests report → generates Google Docs for 6 sections (HOA account, work orders/ARC, gutters, wood trim, window wells, concrete & asphalt) → emails links | Deployed and tested. Production deployment ID in CLAUDE.md. |
| **HOALibrary** (Apps Script library) | Shared library: address standardization, homeowner lookup, Keystone cache queries | Deployed, stable |
| **LabelsToGroups** (Apps Script) | Syncs Gmail contact labels → Google Groups for streets and roles | Deployed, daily Apps Script trigger |
| **Keystone Scraper + Directory Builder** (Python/GitHub Actions) | Logs into Keystone portal nightly, caches profiles/violations/work orders/ARC to Google Sheets; rebuilds Directory and Full Directory tabs from Keystone + Google Contacts | Running nightly via GitHub Actions (moved from oregano June 2026). No local machine dependency. |

### Runs on Oregano (Single Point of Failure)

These stop if oregano dies. They are useful but not critical — the HOA
ran without them before and could again.

| Component | What It Does | State |
|-----------|-------------|-------|
| **Drive Link Monitor** (Python) | Checks all HOA website links nightly, emails admin@ on broken links | Working. Cron 3:30 AM daily. |
| **Work Order Schedule** (Python) | Calendar-aware emailer; sends work order report to board/manager before meetings and check-ins | Working. Cron 7 AM daily. |
| **Broadlands Doc Sync** (Python) | Monitors Broadlands-related Drive documents for changes | Working. Cron Monday 4:30 AM. |
| **HEIF Converter** (Python) | Converts iPhone HEIC photos to JPEG in Google Drive | Working, run manually |
| **Photos-to-Drive** (Python) | Syncs Google Photos albums to Drive folders | Working, run manually |
| **exif-to-parcel** (Python, v1.0) | Matches GPS-tagged contractor photos to property addresses | Complete, run manually |

### Data

| Data | Where | Who Owns It |
|------|-------|-------------|
| Gutters maintenance records | Google Sheets `10UiY9...` | We do (board data) |
| Wood trim assessments | Google Sheets `1K9Olp...` | We do (board data) |
| Keystone cache (accounts, violations, work orders, ARC) | Google Sheets `1TBC1B...` | We do (scraped copy of Keystone data) |
| Homeowner contacts | Google Contacts (admin@) | We do |
| Board documents | VaB Board Documents shared drive | We do |
| Homeowner documents | VaB Homeowner Documents shared drive | We do |
| Contractor photos | Google Drive, organized by address | We do |
| Code | github.com/vab-hoa/hoa-code (private) | We do |

### Credentials & Access

All credentials are in LastPass. A successor needs the admin@ password
and GitHub org access — everything else can be regenerated from those.

#### Master Credentials (Successor Must Have)

| What | LastPass Entry | Notes |
|------|---------------|-------|
| Google Workspace admin | admin@villasboulders.org | Master key to everything Google. Also logs into Google Cloud Console (console.cloud.google.com). |
| GitHub org | vab-hoa org, owner: deebuck | Successor must be added as org owner. Code repository. |

#### Google OAuth Clients & Service Account

| Client ID | LastPass Entry | GCP Project | What It Does |
|-----------|---------------|-------------|-------------|
| `115753241775007656597` | Google Service Account — HOA Automation | villasboulders-automation | Workhorse credential. All Python tools (scraper, HEIF converter, photos-to-drive) use this to access Google APIs. Impersonates admin@ via domain-wide delegation. Key file on oregano: `~/.config/openclaw/google-service-account.json` |
| `527585908490-r4vr...` | Google OAuth — PropertyReport Web App Sign-In | villasboulders-automation | OAuth client for homeowner sign-in to the PropertyReport web app. Handles the Google sign-in redirect flow. Secret in Google Cloud Console. |
| `409889727313-ff4m...` | Google OAuth — rclone / Desktop Drive Access | vab-shared-documents | Desktop OAuth client used by rclone to sync files between oregano and Google Shared Drives. Key file on oregano: `~/client_secret_409889727313-....json` |
| `542285250298-ao08...` | Google OAuth — GAM (Workspace Admin CLI) | (unknown) | Used by GAM (`~/.gam/`), a command-line Google Workspace admin tool on oregano. Not critical for automation — nothing breaks if GAM disappears. |
| `1072944905499-vm2v...` | (not ours — don't store) | Google's | Built into the `clasp` tool. Google owns this client. Token stored in `~/.clasprc.json` after `clasp login`. |

#### Other Credentials

| What | LastPass Entry | Location on Oregano | Notes |
|------|---------------|-------------------|-------|
| Keystone portal login | Keystone Pacific HOA Portal | `keystone-scraper/.env` | Username/password for kppm.cincwebaxis.com. Used by scraper. |
| GitHub CLI auth | (same as GitHub org) | `gh` CLI authenticated | `gh auth` handles this. |

#### GitHub Organization Ownership Risk ⚠️ TODO

The vab-hoa GitHub organization is currently owned solely by the `deebuck` personal
account. This creates a succession risk:

**What keeps working after Dee dies:**
- GitHub Actions workflows keep running (the last_run.txt commit keeps the schedule active)
- Apps Script deployments keep running indefinitely — no GitHub involvement needed
- The code repository remains readable on GitHub

**What breaks:**
- Nobody can update GitHub Actions secrets (Keystone password, service account key)
- If the Keystone scraper breaks due to portal changes, nobody can push a fix
- If the deebuck account is ever compromised, the repo could be deleted

**The fix (not yet done):**
Add a second owner to the vab-hoa org that is tied to a role, not to Dee personally.
Best option: create a GitHub account linked to `admin@villasboulders.org` (or a
dedicated `it@villasboulders.org`), add it as org owner, and store its credentials
in LastPass under HOA IT — not under Dee Buck personally. That account passes to
whoever holds the IT Officer role.

**- [ ] TODO: Create role-based GitHub account, add as vab-hoa org owner, store in LastPass**

#### Succession Summary

A successor needs **only the admin@ password and GitHub org access**.
From admin@, they can:
- Log into Google Cloud Console and regenerate service account keys
- Regenerate any OAuth client secret
- Re-run `clasp login` to get a new clasp token
- Access all Google Workspace settings, groups, drives

Everything on oregano (service account key file, rclone config, .env
files) can be rebuilt from the admin@ login. LastPass should be
organized so a successor can find what they need — reorganizing
LastPass is a TODO.

---

## Priorities

Ordered by what matters most for the HOA, not what's most interesting
technically.

### Priority 1: Protect the Data

The HOA lost data in the AdvanceHOA → Keystone transition. Keystone
could be replaced tomorrow. The data that matters:

- **Account numbers** — the link between addresses and Keystone records
- **Violation history** — what's been cited, when, resolution
- **Work order history** — maintenance done on each property
- **ARC request history** — architectural changes approved/denied

The Keystone scraper exists to capture this data. It is built and
working — Dee has used it. It uses Selenium with Firefox
(`keystone_scraper_selenium.py`). It just needs a cron job.

(A Playwright version also exists but was never completed — Playwright
browsers were never installed on oregano. Ignore it.)

**Status:**
- [x] Set up cron job — nightly 3 AM (Feb 24); moved to GitHub Actions (Jun 2026)
- [x] Failure alerts — GitHub Actions emails on workflow failure
- [x] Cache spreadsheet being populated — confirmed working
- [x] Scraper uses Accounts Receivable Detail page — done
- [x] Violations use board view (violations-review/) not homeowner view — fixed Jun 2026
- [x] Violations and ARC reviews match by unit (not building) — fixed Jun 2026
- [x] Directory/Full Directory rebuilt automatically nightly via GitHub Actions — done Jun 2026

### Priority 2: Verify What's Deployed Works

PropertyReport was significantly refactored Feb 22-23 (section-based
architecture, OAuth web app). It has not been tested end-to-end since.

LabelsToGroups runs daily but nobody checks if it's working correctly.

**Status:**
- [x] PropertyReport tested end-to-end — working as of May/Jun 2026
- [x] Web app OAuth sign-in working
- [x] LabelsToGroups — daily Apps Script trigger, working
- [x] Keystone cache spreadsheet populated nightly

### Priority 3: Reduce Dependence on Oregano

Everything in Google's cloud (PropertyReport, HOALibrary, LabelsToGroups)
survives without oregano. The Python tools don't. Of those, only the
Keystone scraper matters for ongoing operations — the others (HEIF
converter, photos-to-drive, exif-to-parcel) are used occasionally for
specific projects.

If oregano goes down:
- PropertyReport keeps working
- LabelsToGroups keeps working
- Keystone data keeps updating (GitHub Actions, no oregano dependency)
- Directory and Full Directory tabs keep rebuilding nightly
- Drive link monitor stops (non-critical)
- Work order schedule emailer stops (non-critical — can email manually)
- Code is safe on GitHub

**Mitigations:**
- [x] Keystone scraper moved to GitHub Actions — Jun 2026
- [x] Code committed and pushed to GitHub
- [ ] Document oregano cron jobs so someone could set them up elsewhere if needed

### Priority 4: Document for a Successor

The next IT Officer might be non-technical. They need to understand:

1. **What the system does** — in plain English, not code
2. **What runs automatically** — and what happens if it stops
3. **What credentials exist** — and how to get into them
4. **Who to call** — if they need technical help (or want to shut it down)

The code is on GitHub. The credentials can be regenerated. What doesn't
exist yet is the human-readable operations manual.

**Status:**
- [ ] Write OPERATIONS_MANUAL.md — plain English, for a non-technical
  successor
- [ ] Include: what the system does, what's automatic, what breaks if
  oregano dies, how to get help
- [ ] Include: credential inventory with recovery procedures
- [ ] Include: "if you want to shut it all down" instructions

### Priority 5: New Capabilities (When Priorities 1-4 Are Solid)

These are real HOA needs but they don't have to happen right now:

- **Work orders / ARC request forms** — RESOLVED 2026-04-26. Using JotForm with simple text-box signatures.
- **Additional report sections** — DONE. Window wells (May 2026), concrete & asphalt (Jun 2026) added.
- **Better monitoring** — email alerts for errors. GitHub Actions handles scraper failures. Drive link monitor handles website links. Further dashboard: not prioritized.
- **Overarching automation guide** — DONE Jun 2026. "Villas at the Boulders HOA — Automation System Guide" in root of Board Documents.

---

## Architecture (Current State)

### PropertyReport Pipeline

```
Entry Points:
  Google Form → Code.js:onFormSubmit()
  Web App (OAuth) → WebAppController.js → WebAppTrigger.js:processReportAsync()

Data Gathering:
  Code.js:gatherReportData()
    → HOALibrary (address standardization, homeowner lookup)
    → Gutters spreadsheet
    → Wood Trim spreadsheet
    → Keystone cache spreadsheet (via HOALibrary)

Report Generation (config-driven, in EmailAssembly.js):
  ReportConfig.sections[] defines active sections:
    → SectionHOAAccount.js    — identity, account number
    → SectionPropertyActivity.js — violations, work orders, ARC requests
    → SectionGutters.js       — inspection data + photos
    → SectionWoodTrim.js      — assessment + photos

Output:
  Each section → its own Google Doc
  Email with links to all section docs
  Cleanup.js deletes expired docs daily
```

Adding a new section = add entry to ReportConfig.js + create SectionXYZ.js.

### Address System

All data is keyed on standardized HOA addresses:

| Human Address | Standardized | Building | Unit |
|--------------|-------------|----------|------|
| 13737 Rock Point Unit 102 | 13737RP2 | 13737RP | 2 |
| 13704 Stone Circle #1 | 13704SC1 | 13704SC | 1 |
| 12345 Boulder Circle | 12345BC | 12345BC | (none) |

Six streets: BL (Broadlands), BP (Boulder Point), RP (Rock Point),
SC (Stone Circle), BC (Boulder Circle), PP (Plaster Point).

HOALibrary.standardizeHOAAddress() handles all the variations.

### Google Auth

Python tools use a service account with domain-wide delegation:
```python
credentials = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
delegated = credentials.with_subject('admin@villasboulders.org')
service = build('drive', 'v3', credentials=delegated)
```

Only these exact scopes work (no readonly variants):
`drive`, `spreadsheets`, `gmail.send`, `gmail.readonly`, `calendar`,
`admin.directory.group`, `admin.directory.user.readonly`, `groups`

### Code Management

- Source of truth: `github.com/vab-hoa/hoa-code` (private, vab-hoa org)
- Deploy Apps Script: `clasp push` from project directories
- Deploy Python: run directly on oregano
- Credentials: gitignored, in `~/.config/openclaw/` and `.env` files

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Jun 2026 | Keystone scraper moved to GitHub Actions | Succession: doesn't require oregano to be running |
| Jun 2026 | clasp push + clasp deploy both required for PropertyReport | Production deployment is pinned to a version; push alone doesn't update it |
| Jun 2026 | Violations and ARC matched by unit not building | Bug fix: building-level match would show one unit's violations to neighbors |
| Jun 2026 | Overarching automation guide in Board Documents | Succession: single plain-English entry point for the whole system |
| Apr 26 | JotForm for work orders/ARC forms, not AppSheet | JotForm already mobile-friendly, text-box signatures sufficient, no custom code needed |
| Feb 24 | Keystone scraper cron on oregano (since superseded) | Pragmatic at the time |
| Feb 24 | LabelsToGroups via Apps Script trigger, not cron | Runs in Google's cloud, no oregano dependency |
| Feb 24 | GitHub (vab-hoa org) for code | Org survives individual. Succession. |
| Feb 24 | Credentials in .env files, not code | Were in git history — scrubbed with filter-repo |
| Feb 23 | Section-based PropertyReport | Add sections via config, not monolith surgery |
| Feb 23 | OAuth web app (server-side redirect) | Client-side auth impossible on googleusercontent.com |
| Feb 23 | Google Doc links, not PDF attachments | Simpler, handles photos, no size limits |
| Feb 15 | HOALibrary as shared Apps Script library | Reuse address standardization across projects |

---

## Things We're Not Doing (and Why)

- **Firestore/database migration** — Google Sheets works fine for 124
  homeowners. No performance problem exists.
- **CI/CD pipeline** — `clasp push` is fine for a one-person operation.
- **Custom web portal** — AppSheet or Google Forms cover the need. Custom
  code is more to maintain.
- **Full PropertyReport rewrite** — the section-based refactor already
  happened. It works.
- **Moving ALL Python tools off oregano** — the Keystone scraper and directory builder moved to GitHub Actions (Jun 2026). Remaining oregano cron jobs (link monitor, work order schedule, Broadlands sync) are non-critical. The HOA ran without them before.

---

## History of This System

For context — how we got here:

- **Jan 2026:** Started building PropertyReport in Apps Script. Versions
  1-7 developed with Jane/OpenClaw, then v8-v18.1 with Claude Code.
- **Feb 1-14:** Built HOALibrary, Keystone scraper (Playwright then
  Selenium), HEIF converter, photos-to-drive, exif-to-parcel.
- **Feb 15:** Major cleanup session. Created planning docs, fixed v18.1
  bugs. Synced code to Google Drive.
- **Feb 16:** Wrote CURRENT_PLAN.md, REFACTORING_ROADMAP.md,
  FUTURE_APPSHEET_PLAN.md. None were executed — tactical work kept
  intervening.
- **Feb 22-23:** Section-based PropertyReport refactor. OAuth web app.
  HEIF converter working on Drive photos.
- **Feb 24:** Claude Code crash, context recovery. Migrated to GitHub.
  Scrubbed credentials from git history. Created this strategic plan.

The pattern: every planning session gets derailed by a tactical issue
that "should only take an hour." This plan tries to break that pattern
by being clear about what matters most (data protection, succession)
versus what's interesting but optional (new features, code elegance).

---

## Open Questions

1. **Has anyone actually requested a property report via the form?**
   If not, the whole pipeline is academic until tested with real use.

2. **What does the Keystone cache spreadsheet contain right now?**
   Populated? Stale? Empty?

3. **What does the HOA board actually need next?** Work orders? ARC
   tracking? Something else entirely? The automation should serve real
   operational needs, not imagined ones.

4. **What happens if Dee can't run this anymore?** Dee's sister Neville
   has said she can't run the technology. Does that mean the successor
   IT Officer needs to be someone else on the board? Should the system
   be designed to run unattended indefinitely, or is graceful shutdown
   acceptable?

---

## File Reference

| Document | Status | Purpose |
|----------|--------|---------|
| `STRATEGIC_PLAN.md` | **ACTIVE** | This document. The plan. |
| `CLAUDE.md` | **ACTIVE** | Context for Claude Code sessions |
| `CURRENT_PLAN.md` | Superseded | Was "finish PropertyReport this week" |
| `REFACTORING_ROADMAP.md` | Superseded | 4-phase code quality plan |
| `FUTURE_APPSHEET_PLAN.md` | Reference | Detailed AppSheet spec (still useful if we go that direction) |
| `ARCHITECTURE.md` | Stale | System overview (needs updating) |
| `INDEX.md` | Stale | Document navigation (needs updating) |

---

**Revise this document when things change. Don't create a new planning
document — update this one.**
