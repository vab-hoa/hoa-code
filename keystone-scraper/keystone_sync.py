#!/usr/bin/env python3
"""Nightly Keystone sync: CINC Connect API -> raw archive (Drive) -> Keystone Cache (Sheet).

Runs in GitHub Actions (.github/workflows/keystone-scraper.yml). Steps:
  1. Log in to the portal API (cinc_client.py; no browser) and fetch work orders,
     violations, ARC/ACC reviews and home-owner profiles for Villas (grouping 1261).
  2. Save the raw API responses as one gzipped JSON file per day in
     HOA Board Documents / Keystone Archive / YYYY / YYYY-MM-DD-1261.json.gz.
     This is the permanent history (it contains owner contact details, so it lives only
     in the board-private drive, never in git). Saved before the sheet, so even a run
     that fails later leaves the evidence behind.
  3. Shape rows (keystone_extract.py) and write the WorkOrders, Violations, ArchReviews and
     Profiles tabs of the Keystone Cache sheet.

Safety: everything is fetched and checked before any tab is written; a tab is never
replaced by a much smaller one (bad fetch) unless --force is given; writes never leave a
tab empty. Logs carry counts only, never names, emails or phone numbers.

Usage:
  python keystone_sync.py              # normal run
  python keystone_sync.py --dry-run    # fetch + check, write nothing (no archive, no sheet)
  python keystone_sync.py --force      # accept a sharp drop in a tab's size (real drops only)
"""
import argparse
import gzip
import json
import logging
import os
import sys
from datetime import datetime, timezone

from cinc_client import CincClient, CincError, VILLAS_GROUPING
import drive_files
from keystone_extract import (DENVER, HEADERS, SchemaError, arch_review_rows, profile_rows,
                              violation_rows, work_order_rows)
from sheets_retry import retry_sheets_call

CREDENTIALS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
SPREADSHEET_ID = "1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ"  # Keystone Cache

BOARD_DRIVE_ID = "0AExYZWmfRm9JUk9PVA"  # HOA Board Documents (board-private)
ARCHIVE_FOLDER_NAME = "Keystone Archive"

ENDPOINTS = {
    "work_orders": f"/api/v1/bod/work-orders/{VILLAS_GROUPING}",
    "violations": f"/api/v1/bod/violations/{VILLAS_GROUPING}",
    "acc_reviews": f"/api/v1/bod/acc-review/{VILLAS_GROUPING}",
    "home_owners": f"/api/v1/bod/home-owner/grouping/{VILLAS_GROUPING}",
}

# Refuse to replace a tab with far fewer rows than it has now: a sudden drop almost always
# means a bad fetch, not real data. Small tabs (violations) legitimately swing, so the
# percentage rule only applies once a tab has GUARD_MIN_ROWS rows.
MIN_KEEP_FRACTION = 0.7
GUARD_MIN_ROWS = 20

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("googleapiclient.discovery_cache").setLevel(logging.ERROR)
logger = logging.getLogger("keystone_sync")


# ── Google services ───────────────────────────────────────────────────────────

def sheets_service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets"])
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def archive_raw(drive, raw, run_time):
    """Upload the day's raw responses; a same-day rerun replaces that day's file."""
    local = run_time.astimezone(DENVER)
    payload = {
        "fetched_at": run_time.isoformat(),
        "grouping": VILLAS_GROUPING,
        "endpoints": ENDPOINTS,
        "data": raw,
    }
    blob = gzip.compress(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    archive_id = drive_files.find_or_create_folder(drive, ARCHIVE_FOLDER_NAME, BOARD_DRIVE_ID)
    year_id = drive_files.find_or_create_folder(drive, str(local.year), archive_id)
    name = f"{local.date().isoformat()}-{VILLAS_GROUPING}.json.gz"
    existing = drive_files.find_child(drive, year_id, name)
    if existing:
        drive_files.update_file(drive, existing, blob, "application/gzip")
    else:
        drive_files.create_file(drive, year_id, name, blob, "application/gzip")
    logger.info("Archived raw responses: %s/%s/%s (%d KB)",
                ARCHIVE_FOLDER_NAME, local.year, name, len(blob) // 1024)


# ── Sheet ─────────────────────────────────────────────────────────────────────

def current_row_count(svc, tab):
    """Data rows (excluding header) currently in a tab; 0 if the tab doesn't exist."""
    from googleapiclient.errors import HttpError
    try:
        result = retry_sheets_call(lambda: svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=f"{tab}!A:A").execute())
    except HttpError as e:
        if e.resp.status == 400:
            return 0
        raise
    return max(0, len(result.get("values", [])) - 1)


def guard_problem(tab, new_count, current_count):
    """A reason to refuse replacing this tab, or None if it looks safe."""
    if new_count == 0 and current_count > 0:
        return f"{tab}: fetched 0 rows but the tab has {current_count}"
    if current_count >= GUARD_MIN_ROWS and new_count < MIN_KEEP_FRACTION * current_count:
        return (f"{tab}: fetched {new_count} rows, below {MIN_KEEP_FRACTION:.0%} "
                f"of the {current_count} currently in the tab")
    return None


def write_tab(svc, tab, rows):
    """Write header+rows from A1, then clear only the stale rows below (tab never empty)."""
    values = [HEADERS[tab]] + rows
    ss = retry_sheets_call(lambda: svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute())
    if not any(s["properties"]["title"] == tab for s in ss["sheets"]):
        retry_sheets_call(lambda: svc.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={"requests": [{"addSheet": {"properties": {"title": tab}}}]}).execute())
    last_col = chr(ord("A") + len(HEADERS[tab]) - 1)
    retry_sheets_call(lambda: svc.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID, range=f"{tab}!A1:{last_col}{len(values)}",
        valueInputOption="RAW", body={"values": values}).execute())
    retry_sheets_call(lambda: svc.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID, range=f"{tab}!A{len(values) + 1}:Z").execute())
    logger.info("Wrote %d rows to %s", len(rows), tab)


# ── Main ──────────────────────────────────────────────────────────────────────

def run(dry_run=False, force=False):
    run_time = datetime.now(timezone.utc)

    client = CincClient()
    client.login()
    raw = {name: client.get_all(path) for name, path in ENDPOINTS.items()}

    if dry_run:
        logger.info("[dry run] would archive %d KB of raw responses",
                    len(gzip.compress(json.dumps(raw).encode())) // 1024)
    else:
        archive_raw(drive_files.drive_service(), raw, run_time)

    tabs = {
        "WorkOrders": work_order_rows(raw["work_orders"]),
        "Violations": violation_rows(raw["violations"]),
        "ArchReviews": arch_review_rows(raw["acc_reviews"]),
        "Profiles": profile_rows(raw["home_owners"], today=run_time.astimezone(DENVER).date().isoformat()),
    }

    svc = sheets_service()
    problems = []
    for tab, rows in tabs.items():
        current = current_row_count(svc, tab)
        logger.info("%s: %d new rows, %d currently in sheet", tab, len(rows), current)
        problem = guard_problem(tab, len(rows), current)
        if problem:
            problems.append(problem)
    if problems:
        for p in problems:
            logger.error("Guard: %s", p)
        if not force:
            raise RuntimeError("Refusing to write; sheet left untouched "
                               "(rerun with --force only if the drop is real)")
        logger.warning("--force given; writing despite guard warnings")

    if dry_run:
        logger.info("[dry run] sheet not written")
        return
    for tab, rows in tabs.items():
        write_tab(svc, tab, rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="fetch and check only; write nothing")
    parser.add_argument("--force", action="store_true",
                        help="write even if a tab would shrink sharply (only when the drop is real)")
    args = parser.parse_args()
    try:
        run(dry_run=args.dry_run, force=args.force)
    except (CincError, SchemaError, RuntimeError) as e:
        logger.error("Keystone sync failed: %s", e)
        sys.exit(1)
    logger.info("Keystone sync completed")


if __name__ == "__main__":
    main()
