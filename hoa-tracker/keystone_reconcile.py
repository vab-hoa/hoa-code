#!/usr/bin/env python3
"""
keystone_reconcile.py — Daily reconciliation of the Keystone work-order cache
(Google Sheet "WorkOrders" tab) into the HOA Tracker Supabase database.

The nightly keystone-scraper (GitHub Actions, ~3 AM MT) rewrites the cache
sheet. This script runs after it (cron 7:30 AM MT) and reconciles:

  a) WO number known + sheet row says "Closed" + our internal status is NOT a
     terminal status  ->  set our status = 'closed'
     (this is the ONLY internal-status change this script ever makes)
  b) Work item has NO keystone_wo_number, but the sheet has a row with the same
     parcel code and a description that plausibly describes the same issue
     ->  assign the sheet's WO number to the work item
  c) WO number known + matching sheet row
     ->  refresh the informational keystone_status field from the sheet
  d) Any work item with NO row in the cache sheet
     ->  keystone_status = 'not in keystone'  (WO purged, or an email-sourced
         item Josh never entered into the Keystone portal)
     Matching is by WO number when the item has one; WO-less items are matched
     by parcel code against the tab for their category (work_order ->
     WorkOrders, arc_request -> ArchReviews, violation -> Violations).

`status` is our internal responsibility-model field; `keystone_status` is
purely informational (what Keystone says) and never drives workflow by itself.

Prints a JSON summary to stdout (all logging goes to stderr):
  {total_sheet_rows, matched, closed_by_keystone, wo_numbers_assigned,
   keystone_status_updated, not_in_keystone, errors}

Usage:
  python3 keystone_reconcile.py --dry-run --debug   # preview, writes nothing
  python3 keystone_reconcile.py --debug             # apply, verbose per-change log
  python3 keystone_reconcile.py                     # cron mode (quiet)

Runs nightly in GitHub Actions right after the Keystone sync
(.github/workflows/keystone-scraper.yml). Talks to Supabase through its REST API
with the service secret key (keystone-scraper/tracker_db.py), so no database
password or direct Postgres connection is needed. Each change is a separate
single-row update: if a run stops part-way, the updates already made are
correct on their own and the next run finishes the rest (every pass is
idempotent). Normal logs carry WO numbers, parcels and statuses only (the repo
and its Actions logs are public); --debug adds titles for local runs.
"""

import argparse
import json
import logging
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    SHEETS_AVAILABLE = True
except ImportError:
    SHEETS_AVAILABLE = False

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "keystone-scraper"))
from tracker_db import TrackerDB  # noqa: E402  (shared Supabase REST client)

# ============================================================
# Configuration
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

SERVICE_ACCOUNT_FILE = os.path.expanduser(
    "~/.config/openclaw/google-service-account.json")
SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

SPREADSHEET_ID = "1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ"
WORKORDERS_SHEET = "WorkOrders"
# The tab normally holds 120+ work orders; fewer than this means a failed scrape.
MIN_WORKORDER_ROWS = 50


# Internal statuses that are terminal. Keystone "Closed" must never override
# these — a closed/approved/denied item stays decided by the board.
TERMINAL_INTERNAL = {"closed", "cancelled", "denied", "approved",
                     "withdrawn", "resolved"}

# Keystone sheet status (case-insensitive) that means the work order is done.
KEYSTONE_CLOSED = {"closed"}

# keystone_status value for WOs with no row in the cache sheet
NOT_IN_KEYSTONE = "not in keystone"

# Minimum similarity (0..1) between our title and the sheet description before
# a WO number is auto-assigned (case b). Two shared keywords score >= 0.28.
ASSIGN_SIM_THRESHOLD = 0.15

logger = logging.getLogger("keystone_reconcile")

# ============================================================
# Helpers
# ============================================================

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens(text):
    """Lowercase alphanumeric tokens, length >= 3."""
    return {t for t in _TOKEN_RE.findall((text or "").lower()) if len(t) >= 3}


def title_similarity(a, b):
    """
    Rough similarity between our work-item title and the sheet description.
    Jaccard on tokens, boosted by coverage for multi-token overlap.
    Single-token overlap is heavily discounted to avoid false positives.
    """
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    inter = ta & tb
    n = len(inter)
    if n == 0:
        return 0.0
    jaccard = n / len(ta | tb)
    if n >= 2:
        return max(jaccard, n / min(len(ta), len(tb)))
    return jaccard / 2.0


def read_workorders(svc):
    """
    Read the WorkOrders tab via the Sheets API (readonly).
    Returns a list of dicts: parcel, wo_number, date, description, vendor, status.
    """
    res = svc.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{WORKORDERS_SHEET}!A1:F5000").execute()
    rows = res.get("values", [])
    out = []
    for raw in rows[1:]:
        if not raw or len(raw) < 2:
            continue
        parcel = (raw[0] or "").strip().upper()
        wo = (raw[1] or "").strip()
        if not parcel or not wo:
            continue  # header/footer rows ("Last Updated:")
        out.append({
            "parcel": parcel,
            "wo_number": wo,
            "date": (raw[2].strip() if len(raw) > 2 else ""),
            "description": (raw[3].strip() if len(raw) > 3 else ""),
            "vendor": (raw[4].strip() if len(raw) > 4 else ""),
            "status": (raw[5].strip() if len(raw) > 5 else ""),
        })
    return out


def read_parcel_set(svc, tab):
    """Set of parcel codes (column A) present in a cache sheet tab."""
    res = svc.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{tab}!A1:A5000").execute()
    return {(r[0] or "").strip().upper()
            for r in res.get("values", [])[1:] if r and r[0].strip()}


def load_work_items(db):
    """Load all non-excluded work items with their parcel code."""
    rows = db.select("work_items", {
        "select": "id,keystone_wo_number,keystone_status,status,title,category,"
                  "created_date,properties(parcel_code)",
        "excluded_at": "is.null"})
    items = []
    for r in rows:
        parcel = (r.get("properties") or {}).get("parcel_code")
        created = r.get("created_date")
        items.append({
            "id": r["id"],
            "wo": (r.get("keystone_wo_number") or "").strip(),
            "keystone_status": r.get("keystone_status"),
            "status": r.get("status"),
            "title": r.get("title") or "",
            "category": r.get("category") or "",
            "created": datetime.fromisoformat(created[:19]) if created else None,
            "parcel": (parcel or "").strip().upper(),
        })
    return items


def now_utc():
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# Reconciliation passes
# ============================================================

def assign_wo_numbers(db, items, by_parcel, summary, dry_run):
    """
    Case (b): give WO-less, still-open work_order items the WO number from a
    same-parcel sheet row whose description matches their title. Closed or
    terminal items are left alone; only open items are candidates.
    """
    candidates = [it for it in items
                  if not it["wo"]
                  and it["category"] == "work_order"
                  and it["status"] not in TERMINAL_INTERNAL
                  and it["parcel"]]
    candidates.sort(key=lambda it: it["created"] or datetime.min, reverse=True)

    used_rows = set()  # ids of sheet rows already consumed by an assignment
    for item in candidates:
        best = None  # (score, row)
        for row in by_parcel.get(item["parcel"], []):
            if id(row) in used_rows:
                continue
            score = title_similarity(item["title"], row["description"])
            if score >= ASSIGN_SIM_THRESHOLD and (best is None or score > best[0]):
                best = (score, row)
        if not best:
            if logger.isEnabledFor(logging.DEBUG):
                sheet_descs = [r["description"] for r in by_parcel.get(item["parcel"], [])]
                logger.debug("[no-assign] %s %r (sheet rows here: %s)",
                             item["parcel"], item["title"][:60],
                             sheet_descs if sheet_descs else "none")
            continue
        score, row = best
        logger.info("[assign] WO %s -> %s (sim %.2f)", row["wo_number"], item["parcel"], score)
        logger.debug("   item %r, sheet %r", item["title"][:60], row["description"][:60])
        summary["wo_numbers_assigned"] += 1
        if not dry_run:
            db.update("work_items", item["id"],
                      {"keystone_wo_number": row["wo_number"], "updated_date": now_utc()})
        item["wo"] = row["wo_number"]
        used_rows.add(id(row))


def refresh_keystone_statuses(db, items, by_wo, summary, dry_run):
    """
    Cases (a) and (c) for every work item that has a WO number present in the
    sheet: refresh keystone_status, and close our item if Keystone closed it.
    """
    for item in items:
        if not item["wo"]:
            continue
        row = by_wo.get(item["wo"])
        if row is None:
            continue  # handled by mark_not_in_keystone()

        summary["matched"] += 1
        new_status = row["status"]

        # (c) informational keystone_status refresh
        if item["keystone_status"] != new_status:
            logger.info("[keystone_status] WO %s (%s): %r -> %r",
                        item["wo"], item["parcel"],
                        item["keystone_status"], new_status)
            summary["keystone_status_updated"] += 1
            if not dry_run:
                db.update("work_items", item["id"],
                          {"keystone_status": new_status, "updated_date": now_utc()})
            item["keystone_status"] = new_status

        # (a) closed by Keystone — the only internal-status change we make
        if (new_status.lower() in KEYSTONE_CLOSED
                and item["status"] not in TERMINAL_INTERNAL):
            logger.info("[closed-by-keystone] WO %s (%s): status %r -> 'closed'",
                        item["wo"], item["parcel"], item["status"])
            logger.debug("   item %r", item["title"][:60])
            summary["closed_by_keystone"] += 1
            if not dry_run:
                stamp = now_utc()
                db.update("work_items", item["id"],
                          {"status": "closed", "completed_date": stamp, "closed_date": stamp,
                           "status_changed_at": stamp, "updated_date": stamp})
            item["status"] = "closed"


def mark_not_in_keystone(db, items, by_wo, parcel_tabs, summary, dry_run):
    """
    Case (d): any work item with no row in the cache sheet. Items with a WO
    number match by WO; WO-less items match by parcel against the tab for
    their category. Covers email-sourced items that were never entered in
    the Keystone portal, telling us Josh isn't tracking them.
    """
    for item in items:
        if item["wo"]:
            matched = item["wo"] in by_wo
        else:
            parcels = parcel_tabs.get(item["category"], set())
            matched = bool(item["parcel"]) and item["parcel"] in parcels
        if matched or item["keystone_status"] == NOT_IN_KEYSTONE:
            continue  # in the cache, or already marked (idempotent no-op)
        logger.info("[not-in-keystone] %s (parcel=%s) keystone_status -> %r",
                    item["wo"] or item["category"], item["parcel"] or "none", NOT_IN_KEYSTONE)
        logger.debug("   item %r", item["title"][:60])
        summary["not_in_keystone"] += 1
        if not dry_run:
            db.update("work_items", item["id"],
                      {"keystone_status": NOT_IN_KEYSTONE, "updated_date": now_utc()})


# ============================================================
# Main
# ============================================================

def run_reconciliation(dry_run, debug):
    summary = {
        "total_sheet_rows": 0,
        "matched": 0,
        "closed_by_keystone": 0,
        "wo_numbers_assigned": 0,
        "keystone_status_updated": 0,
        "not_in_keystone": 0,
        "errors": [],
    }
    ok = False
    try:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SHEETS_SCOPES)
        sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
        sheet_rows = read_workorders(sheets)
        summary["total_sheet_rows"] = len(sheet_rows)
        logger.info("Read %d WorkOrders rows from the cache sheet",
                    len(sheet_rows))
        # An empty or truncated tab means the scraper failed, not that Keystone dropped
        # its work orders. Reconciling against it would mark every linked item
        # "not in keystone", so stop before touching the database.
        if len(sheet_rows) < MIN_WORKORDER_ROWS:
            raise RuntimeError(
                f"WorkOrders tab has only {len(sheet_rows)} rows "
                f"(minimum {MIN_WORKORDER_ROWS}); refusing to reconcile")

        # Parcel sets per category, for matching WO-less items (case d)
        parcel_tabs = {
            "work_order": {r["parcel"] for r in sheet_rows},
            "arc_request": read_parcel_set(sheets, "ArchReviews"),
            "violation": read_parcel_set(sheets, "Violations"),
        }

        by_wo = {}
        by_parcel = defaultdict(list)
        for row in sheet_rows:
            by_wo[row["wo_number"]] = row
            by_parcel[row["parcel"]].append(row)

        db = TrackerDB()
        items = load_work_items(db)
        logger.info("Loaded %d non-excluded work items from Supabase", len(items))

        # Order matters: assign WOs first so newly assigned items are covered
        # by the status refresh, then mark the leftovers.
        assign_wo_numbers(db, items, by_parcel, summary, dry_run)
        refresh_keystone_statuses(db, items, by_wo, summary, dry_run)
        mark_not_in_keystone(db, items, by_wo, parcel_tabs, summary, dry_run)

        if dry_run:
            logger.info("[dry-run] nothing was written")
        else:
            logger.info("Applied %d keystone_status updates, %d closures, "
                        "%d WO assignments, %d not-in-keystone marks",
                        summary["keystone_status_updated"],
                        summary["closed_by_keystone"],
                        summary["wo_numbers_assigned"],
                        summary["not_in_keystone"])
        ok = True
    except Exception as e:
        summary["errors"].append(f"{type(e).__name__}: {e}")
        logger.error("Reconciliation failed: %s: %s", type(e).__name__, e)

    return summary, ok


def main():
    parser = argparse.ArgumentParser(
        description="Reconcile the Keystone cache sheet into Supabase work_items.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would change without writing to Supabase")
    parser.add_argument("--debug", action="store_true",
                        help="Verbose per-item logging to stderr")
    args = parser.parse_args()

    logging.basicConfig(
        stream=sys.stderr,
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(levelname)s: %(message)s")

    if not SHEETS_AVAILABLE:
        print(json.dumps({"errors": ["google-api-python-client not installed"]}))
        return 1

    summary, ok = run_reconciliation(args.dry_run, args.debug)
    print(json.dumps(summary))
    return 0 if ok and not summary["errors"] else 1


if __name__ == "__main__":
    sys.exit(main())
