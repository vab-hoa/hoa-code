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
  d) WO number known but NO sheet row for it
     ->  keystone_status = 'not in keystone'  (WO purged from cache / unknown)

`status` is our internal responsibility-model field; `keystone_status` is
purely informational (what Keystone says) and never drives workflow by itself.

Prints a JSON summary to stdout (all logging goes to stderr):
  {total_sheet_rows, matched, closed_by_keystone, wo_numbers_assigned,
   keystone_status_updated, not_in_keystone, errors}

Usage:
  python3 keystone_reconcile.py --dry-run --debug   # preview, writes nothing
  python3 keystone_reconcile.py --debug             # apply, verbose per-change log
  python3 keystone_reconcile.py                     # cron mode (quiet)

Transaction safety: one transaction per run, one SAVEPOINT per item so a bad
row cannot abort the whole batch (historical psycopg2 "current transaction is
aborted" issue). conn.rollback() runs in every error handler.
"""

import argparse
import json
import logging
import os
import re
import sys
from collections import defaultdict
from datetime import datetime

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    SHEETS_AVAILABLE = True
except ImportError:
    SHEETS_AVAILABLE = False

try:
    import psycopg2
except ImportError:
    psycopg2 = None

# ============================================================
# Configuration
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

SERVICE_ACCOUNT_FILE = os.path.expanduser(
    "~/.config/openclaw/google-service-account.json")
SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

SPREADSHEET_ID = "1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ"
WORKORDERS_SHEET = "WorkOrders"

SUPABASE_HOST = "db.obveytoovkzjrpzrhrim.supabase.co"
SUPABASE_PORT = 5432
SUPABASE_DB = "postgres"
SUPABASE_USER = "postgres"
SUPABASE_PASSWORD_FILE = os.path.join(SCRIPT_DIR, "secrets", ".supabase_db_password")

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


def read_workorders():
    """
    Read the WorkOrders tab via the Sheets API (readonly).
    Returns a list of dicts: parcel, wo_number, date, description, vendor, status.
    """
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SHEETS_SCOPES)
    svc = build("sheets", "v4", credentials=creds, cache_discovery=False)
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


def get_db_connection():
    if psycopg2 is None:
        raise ImportError("psycopg2 not available on this host")
    with open(SUPABASE_PASSWORD_FILE, "r") as f:
        password = f.read().strip()
    return psycopg2.connect(
        host=SUPABASE_HOST,
        port=SUPABASE_PORT,
        dbname=SUPABASE_DB,
        user=SUPABASE_USER,
        password=password,
        sslmode="require",
    )


def load_work_items(cur):
    """Load all non-excluded work items with their parcel code."""
    cur.execute("""
        SELECT wi.id, wi.keystone_wo_number, wi.keystone_status, wi.status,
               wi.title, wi.category, wi.created_date, p.parcel_code
        FROM work_items wi
        LEFT JOIN properties p ON p.id = wi.property_id
        WHERE wi.excluded_at IS NULL
    """)
    items = []
    for r in cur.fetchall():
        items.append({
            "id": r[0],
            "wo": (r[1] or "").strip() if r[1] else "",
            "keystone_status": r[2],
            "status": r[3],
            "title": r[4] or "",
            "category": r[5] or "",
            "created": r[6],
            "parcel": (r[7] or "").strip().upper() if r[7] else "",
        })
    return items


# ============================================================
# Reconciliation passes
# ============================================================

def assign_wo_numbers(cur, items, by_parcel, summary, dry_run):
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
        logger.info("[assign] WO %s -> %s %r (sim %.2f, sheet: %r)",
                    row["wo_number"], item["parcel"], item["title"][:60],
                    score, row["description"][:60])
        summary["wo_numbers_assigned"] += 1
        if not dry_run:
            cur.execute(
                "UPDATE work_items SET keystone_wo_number = %s, "
                "updated_date = NOW() WHERE id = %s",
                (row["wo_number"], item["id"]))
        item["wo"] = row["wo_number"]
        used_rows.add(id(row))


def refresh_keystone_statuses(cur, items, by_wo, summary, dry_run):
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
                cur.execute(
                    "UPDATE work_items SET keystone_status = %s, "
                    "updated_date = NOW() WHERE id = %s",
                    (new_status, item["id"]))
            item["keystone_status"] = new_status

        # (a) closed by Keystone — the only internal-status change we make
        if (new_status.lower() in KEYSTONE_CLOSED
                and item["status"] not in TERMINAL_INTERNAL):
            logger.info("[closed-by-keystone] WO %s (%s): status %r -> 'closed'  %r",
                        item["wo"], item["parcel"], item["status"],
                        item["title"][:60])
            summary["closed_by_keystone"] += 1
            if not dry_run:
                cur.execute(
                    "UPDATE work_items SET status = 'closed', "
                    "completed_date = NOW(), closed_date = NOW(), "
                    "status_changed_at = NOW(), updated_date = NOW() "
                    "WHERE id = %s",
                    (item["id"],))
            item["status"] = "closed"


def mark_not_in_keystone(cur, items, by_wo, summary, dry_run):
    """Case (d): WO known to us but absent from the cache sheet."""
    for item in items:
        if not item["wo"] or item["wo"] in by_wo:
            continue
        if item["keystone_status"] == NOT_IN_KEYSTONE:
            continue  # already marked, idempotent no-op
        logger.info("[not-in-keystone] WO %s (%s) keystone_status -> %r  %r",
                    item["wo"], item["parcel"], NOT_IN_KEYSTONE,
                    item["title"][:60])
        summary["not_in_keystone"] += 1
        if not dry_run:
            cur.execute(
                "UPDATE work_items SET keystone_status = %s, "
                "updated_date = NOW() WHERE id = %s",
                (NOT_IN_KEYSTONE, item["id"]))


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
    conn = None
    try:
        sheet_rows = read_workorders()
        summary["total_sheet_rows"] = len(sheet_rows)
        logger.info("Read %d WorkOrders rows from the cache sheet",
                    len(sheet_rows))

        by_wo = {}
        by_parcel = defaultdict(list)
        for row in sheet_rows:
            by_wo[row["wo_number"]] = row
            by_parcel[row["parcel"]].append(row)

        conn = get_db_connection()
        cur = conn.cursor()
        items = load_work_items(cur)
        logger.info("Loaded %d non-excluded work items from Supabase", len(items))

        # Per-item savepoints so one bad row can't abort the whole batch.
        if not dry_run:
            cur.execute("SAVEPOINT reconcile_batch")

        # Order matters: assign WOs first so newly assigned items are covered
        # by the status refresh, then mark the leftovers.
        assign_wo_numbers(cur, items, by_parcel, summary, dry_run)
        refresh_keystone_statuses(cur, items, by_wo, summary, dry_run)
        mark_not_in_keystone(cur, items, by_wo, summary, dry_run)

        if dry_run:
            conn.rollback()
            logger.info("[dry-run] rolled back — nothing was written")
        else:
            if summary["errors"]:
                conn.rollback()
                logger.error("Errors occurred — rolled back entire batch")
            else:
                conn.commit()
                logger.info("Committed %d keystone_status updates, %d closures, "
                            "%d WO assignments, %d not-in-keystone marks",
                            summary["keystone_status_updated"],
                            summary["closed_by_keystone"],
                            summary["wo_numbers_assigned"],
                            summary["not_in_keystone"])
        ok = True
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        summary["errors"].append(f"{type(e).__name__}: {e}")
        logger.exception("Reconciliation failed: %s", e)
    finally:
        if conn:
            conn.close()

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
