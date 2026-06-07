# Keystone Scraper

Scrapes the Keystone Pacific HOA management portal and caches the data in Google Sheets for use by the Property Report system.

## What It Does

Logs into [kppm.cincwebaxis.com](https://kppm.cincwebaxis.com) as the board account and scrapes:
- **Profiles** — unit addresses and account numbers (from Accounts Receivable Detail)
- **Violations** — open violations (from Board Violations view)
- **Work Orders** — service requests and status
- **Architectural Reviews** — ARC requests and status

Data is written to the **Keystone Portal Cache** spreadsheet (`1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`), which HOALibrary reads to populate Property Reports.

The **Directory** and **Full Directory** tabs in that spreadsheet are NOT updated by this scraper — they are built manually by `build_full_directory.py`, which merges Keystone profile data with Google Contacts.

## Schedule

Runs nightly at **3 AM MDT** via GitHub Actions (`.github/workflows/keystone-scraper.yml`). No dependency on oregano or any local machine.

After each successful run, the workflow commits `last_run.txt` with a timestamp. This keeps the GitHub Actions schedule active (GitHub pauses workflows on repos with no commits in 60 days).

## Credentials

Stored as GitHub Actions secrets — not in this repo, not in `.env` (which is gitignored):
- `KEYSTONE_USERNAME` / `KEYSTONE_PASSWORD` — Keystone portal login
- `GOOGLE_SERVICE_ACCOUNT_JSON` — service account for writing to Google Sheets

For local runs on oregano, credentials are loaded from `.env` (see `.env.example` if present, or check LastPass).

## Running Locally

```bash
cd keystone-scraper
source .env          # loads KEYSTONE_USERNAME and KEYSTONE_PASSWORD
source venv/bin/activate
python keystone_scraper_selenium.py
```

Uses Firefox + geckodriver locally. The `USE_CHROME=true` env var switches to Chrome (used in GitHub Actions CI).

## Other Scripts

- `work_order_schedule.py` — calendar-aware emailer; sends work order summaries to board before meetings. Runs via oregano cron.
- `build_full_directory.py` — merges Keystone + Google Contacts into the Directory tabs.
- `broadlands_docs.py` — monitors Broadlands document changes.
- `run_scraper.sh` — oregano cron wrapper (disabled 2026-06-07, replaced by GitHub Actions).
