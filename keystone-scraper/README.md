# Keystone integration (keystone-scraper/)

Keystone Pacific, the HOA's management company, keeps our work orders, violations, ARC
requests, homeowner accounts and documents in its portal, **kppm.cincconnect.com**
("CINC Connect"). The jobs in this folder copy that data every night into places the HOA
owns, so the board can use it and so we never lose it if we change management companies
(we lost years of data that way in 2024).

Everything here runs in **GitHub Actions** (in the cloud). No home computer is involved.

> This repository is **public**. Never put a password, key or homeowner data in any file here.

---

## Part 1 — For whoever looks after this

### What runs, and when

| Job (GitHub → Actions) | When | What it does |
|---|---|---|
| **Keystone Scraper** | nightly, 09:00 UTC (3 AM summer / 2 AM winter, Colorado; GitHub sometimes starts it hours late) | 1. Copies work orders, violations, ARC requests and owner contacts into the **Keystone Cache** spreadsheet (including the **Directory** tab of owner names and phones), and saves the raw data to **HOA Board Documents → Keystone Archive**. Then updates the **HOA tracker** with Keystone's status for each work item, closing items Keystone closed. 2. Copies new financial reports and minutes from the portal into **HOA Documents** (year folders) and emails the board about other new portal files. 3. Copies Keystone notes and attachments into the **HOA tracker** (tracker.villasboulders.org). 4. Rebuilds the Full Directory and per-street member lists. |
| **Broadlands Document Sync** | Mondays 10:30 UTC | Keeps **HOA Documents → BRL Master Documents** matching the Broadlands master association's Architectural and Governing Documents folders on the portal. Changed files are replaced in place, so links never break. |
| **Work Order Schedule** | daily 13:00 UTC | Emails the work-order status report before board meetings. **Switched off on purpose since Sept 2026**; turn it back on under Actions if wanted. |
| **Sync Keystone Status** | nightly 09:30 UTC | Numbers ARC requests in the tracker (ARC serials). |
| **Labels to Groups Sync** | nightly 09:00 UTC | Gmail contact labels → Google Groups (not Keystone; lives here for convenience). |

To run any of them by hand: GitHub → the repository → **Actions** → pick the job →
**Run workflow**.

### The emails you may get

| Subject | Means | What to do |
|---|---|---|
| **Keystone nightly sync FAILED** | Something in the nightly job failed. The spreadsheet was **left as it was**, so nothing downstream is damaged; it is just a day old. | Open the link in the email to see which step failed. Most often: the Keystone password changed (see below). If it fails one night and works the next, ignore it. |
| **Broadlands document sync FAILED** | The weekly Broadlands job failed. Drive files were not removed. The failure may be the sync, or the git push of the manifest if main moved during the job. | Open the link in the email. A rejected git push is fixed by re-running the workflow. |
| **Broadlands documents updated** | The master association changed a document; Drive now has the new version. | Updated files keep their links. A *NEW* file has a new link: add it to the website if it should be linked. |
| **New Keystone portal documents** | Keystone posted files to our portal library that aren't copied automatically. | Look at them on the portal; file them in Drive if they matter. |

### Common fixes

- **The Keystone password changed** → GitHub → repository → **Settings → Secrets and
  variables → Actions** → edit `KEYSTONE_PASSWORD`. Then re-run the job.
- **A tab "would shrink sharply" (in the failure log)** → the job refused to replace a
  spreadsheet tab with far fewer rows than it had, because that usually means a bad fetch.
  If the drop is real (Keystone really closed out many items), run
  `python keystone_sync.py --force` once (see "Running it yourself").
- **"login rejected"** → wrong or changed password, or Keystone locked the account. Check
  you can log in at kppm.cincconnect.com with the same account.
- **"API records no longer have field(s)…" or "Unexpected response shape"** → Keystone
  changed their portal. The job stops rather than writing wrong data. This needs someone
  technical (see Part 2, "If Keystone changes the portal again").

### Credentials (names only — values live in GitHub secrets)

| Secret | What it is |
|---|---|
| `KEYSTONE_USERNAME` / `KEYSTONE_PASSWORD` | A Keystone portal login with board access. **Handover:** this is a personal homeowner login (Keystone has no "service" accounts). A new IT Officer must put their own board login here; nothing else needs to change. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The HOA's Google service account; acts as admin@villasboulders.org for Sheets, Drive and Gmail. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | The HOA tracker database. The key is a Supabase *secret* key (`sb_secret_…`); full access, so it must never appear anywhere else. |

The full credential inventory and the October 2026 key incident are documented in the
board's auth notes (Jane's `AUTH-AND-API-KEYS.md`).

---

## Part 2 — How it works (for whoever maintains the code)

### The portal API

The portal is a Flutter web app over a JSON REST API at `https://integrations-prod.onrapp.us`.
It's undocumented; everything below was worked out from the portal's own public app code
(`https://kppm.cincconnect.com/main.dart.js`) in October 2026. **No browser is used.**

- **Login:** `POST /users/cinc/connect/authenticate` with `{"email","password"}` and the
  header `x-cinc-requested-from: kppm` (without that header the API returns 500). Returns a
  token already prefixed `JWT `, valid about 8 hours, sent as `Authorization` on later calls.
- **Associations ("groupings"):** Villas at the Boulders = **1261**, Broadlands master = **1167**.
  The same login reads both; the grouping goes in the URL or the `cincGrouping` parameter.
- **Lists** are paged (`page`, `limit` ≤ 100) and return `{data: {docs, totalDocs, totalPages}}`.

| Data | Endpoint |
|---|---|
| Work orders | `GET /api/v1/bod/work-orders/1261` |
| Violations | `GET /api/v1/bod/violations/1261` |
| ARC requests | `GET /api/v1/bod/acc-review/1261` (committee response in `committeeResponse`) |
| Owners/contacts | `GET /api/v1/bod/home-owner/grouping/1261` (one record per contact, not per unit) |
| WO notes | `GET /api/v1/bod/work-orders/notes/{wo}` (paging fields at the top level, not under `data`) |
| WO / ARC attachment lists | `GET /api/v1/bod/work-orders/attachments/{wo}`, `GET /api/v1/bod/acc-review/attachments/{acc}` |
| Attachment download | `GET /api/v1/bod/helpers/getSqlAttachmentAndUploadToS3/{id}?fileDatabase=…&fileName=…&boardModule=boardWorkOrders` (or `boardAccReview`) → `data.url_path`, a signed link |
| Document library | `GET /api/v2/file/list/byUser?cincGrouping=…&id=<folder>` (folder IDs are shared across associations) |
| Document download | `POST /api/v2/file/download/url` `{"key": location + name}` → `data.url`, a signed link |

The API also has endpoints that **change** things (e.g. invoice approval). Our client
refuses them.

### The code

| File | Role |
|---|---|
| `cinc_client.py` | The only code that talks to the portal. Read-only by construction (GET, plus the login and download-link POSTs); sends the token only to the API host, never to signed links; never retries a rejected login (account lockout); refuses partial lists. |
| `keystone_extract.py` | Turns API records into Keystone Cache rows (addresses → parcel codes like `13713BP2`, dates → `YYYY-MM-DD` Denver time). Pure functions, fully tested. **The sheet layout is a contract** with `work_order_report.py`, `hoa-tracker/keystone_reconcile.py`, `HOALibrary/KeystoneIntegration.gs` and the dashboard: keep tab names, headers and column order. |
| `keystone_sync.py` | Nightly: fetch all → archive raw JSON → write the WorkOrders, Violations, ArchReviews, Profiles and Directory tabs. Directory keeps a phone already in the tab when Keystone has none, for the same family only. Fetches everything before writing anything; refuses to shrink a tab below 70% (`--force` overrides); writes before clearing, so a tab is never empty. |
| `keystone_documents.py` | Villas portal library monitor (manifest: `keystone_docs_manifest.json`). |
| `broadlands_docs.py` | Broadlands library mirror (manifest: `broadlands_manifest.json`, which records the Drive file ID each portal file is mirrored to). |
| `keystone_notes.py` / `keystone_attachments.py` | Copy notes and attachments into the tracker. Every row has a `source_key`; the database's unique index (`hoa-tracker/schema_v6.sql`) makes repeats impossible. Identical duplicate attachments are skipped and listed in `keystone_attachment_duplicates.json`. |
| `../hoa-tracker/keystone_reconcile.py` | Nightly, after the sync: copies Keystone status into tracker work items, closes items Keystone closed, assigns WO numbers to matching items. Uses the tracker's REST API (no database password); refuses to run on a short WorkOrders tab. |
| `drive_files.py`, `tracker_db.py`, `notify.py`, `sheets_retry.py` | Shared helpers: Google Drive, the tracker database (Supabase REST), alert emails (to itofficer@ and admin@), retry with backoff. |
| `work_order_report.py` / `work_order_schedule.py` | The work-order status report and its meeting-aware schedule. |
| `build_full_directory.py` / `build_street_directories.py` | Full Directory tab and per-street member spreadsheets (from the Directory tab + Google Contacts; not Keystone data). |
| `labels_to_groups.py` | Gmail labels → Google Groups. |
| `tests/` | Unit tests, run before every nightly sync. Synthetic data only — never real owner data. |

### Running it yourself (oregano)

```bash
cd ~/hoa-code/keystone-scraper
./venv/bin/python -m pytest -q tests          # tests
./venv/bin/python keystone_sync.py --dry-run  # fetch + check, write nothing
./venv/bin/python keystone_documents.py --explore   # print the portal library tree
./venv/bin/python broadlands_docs.py --dry-run
./venv/bin/python keystone_notes.py --dry-run
./venv/bin/python keystone_attachments.py --dry-run
```

Locally the Keystone login comes from `keystone-scraper/.env` and the tracker key from
`hoa-tracker-dashboard/.env.local` (both gitignored).

### Adding something new from the portal

1. Find the endpoint: open the portal in a browser with developer tools → Network, or search
   `main.dart.js` for `/api/`.
2. Fetch it with `CincClient().get(...)` / `.get_all(...)` — never add a write call.
3. Put any record→row shaping in a pure function with a test in `tests/` (synthetic data).
4. Run it with `--dry-run` first; add a workflow step; keep logs to counts, never names or
   contact details (the Actions logs of a public repo are public).

### If Keystone changes the portal again

That is what happened in October 2026 (the old portal, kppm.cincwebaxis.com, was replaced
overnight). The jobs are built to **fail loudly and change nothing** when the API's shape
changes. To adapt: download the new `main.dart.js`, search it for the endpoint paths and the
login call, update `cinc_client.py` / `keystone_extract.py`, and run every script with
`--dry-run` before re-enabling the schedule.
