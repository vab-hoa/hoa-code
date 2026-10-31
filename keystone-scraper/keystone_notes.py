#!/usr/bin/env python3
"""Import Keystone work-order notes and ARC committee responses into the HOA tracker.

Runs nightly in GitHub Actions after the Keystone sync (.github/workflows/keystone-scraper.yml).
Notes land in the tracker's work_item_notes table, so they appear on each work item's page
on tracker.villasboulders.org next to the board's own notes.

  - Work orders: each tracker work item with a keystone_wo_number gets that work order's
    portal notes.
  - ARC requests: a Keystone ARC request's committee response is added to the tracker ARC
    item at the same parcel with the nearest date (within ARC_MATCH_DAYS); ambiguous or
    distant matches are skipped and counted, never guessed.

Every imported note carries a source_key (schema_v6.sql) such as
keystone:wo-note:110259:<fingerprint of date+text>; the database refuses duplicates, so
reruns add nothing. An edited note in Keystone has a new fingerprint and is added as a new
note; nothing is ever changed or deleted in the tracker.

Usage:
  python keystone_notes.py            # import
  python keystone_notes.py --dry-run  # count what would be imported; write nothing
"""
import argparse
import hashlib
import logging
import sys
from datetime import date, datetime

from cinc_client import VILLAS_GROUPING, CincClient, CincError
from keystone_extract import DENVER, normalize_date, unit_address
from tracker_db import TrackerDB, TrackerError

SOURCE = "Keystone portal (imported)"
ARC_MATCH_DAYS = 14

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("keystone_notes")


# ── pure logic (tested in tests/test_keystone_notes.py) ───────────────────────

def fingerprint(*parts):
    return hashlib.sha1("\x1f".join(str(p or "") for p in parts).encode("utf-8")).hexdigest()[:16]


def wo_note_rows(wo_number, work_item_id, notes):
    """work_item_notes rows for one work order's portal notes (blank notes skipped)."""
    rows = []
    for n in notes:
        text = (n.get("note") or "").strip()
        if not text:
            continue
        rows.append({
            "work_item_id": work_item_id,
            "note_date": normalize_date(n.get("noteDate")) or None,
            "content": text,
            "source": SOURCE,
            "source_key": f"keystone:wo-note:{wo_number}:{fingerprint(n.get('noteDate'), text)}",
        })
    return rows


def match_arc(parcel, request_date, candidates):
    """Tracker ARC work item id for a Keystone ARC request, or None.

    candidates: [{"id", "parcel", "created_date"}]. Picks the same-parcel item with the
    nearest created_date within ARC_MATCH_DAYS; returns None if none is that close or if
    two are equally close.
    """
    if not parcel or not request_date:
        return None
    target = date.fromisoformat(request_date)
    scored = []
    for c in candidates:
        if c["parcel"] != parcel or not c.get("created_date"):
            continue
        days = abs((date.fromisoformat(c["created_date"][:10]) - target).days)
        if days <= ARC_MATCH_DAYS:
            scored.append((days, c["id"]))
    scored.sort()
    if not scored or (len(scored) > 1 and scored[0][0] == scored[1][0]):
        return None
    return scored[0][1]


def arc_note_row(record, work_item_id, today):
    """A note holding the committee's response to an ARC request, or None if there is none."""
    text = (record.get("committeeResponse") or "").strip()
    if not text:
        return None
    return {
        "work_item_id": work_item_id,
        "note_date": today,
        "content": f"ARC committee response ({record.get('requestType') or 'request'}): {text}",
        "source": SOURCE,
        "source_key": f"keystone:arc-response:{record['_id']}:{fingerprint(text)}",
    }


# ── run ───────────────────────────────────────────────────────────────────────

def portal_notes(client, wo_number):
    """All notes for one work order (this endpoint returns its page fields at the top level)."""
    notes, page = [], 1
    while True:
        body = client.get(f"/api/v1/bod/work-orders/notes/{wo_number}", params={"page": page, "limit": 100})
        docs = body.get("docs")
        if not isinstance(docs, list):
            raise CincError(f"Unexpected notes response for work order {wo_number}")
        notes.extend(docs)
        if page >= (body.get("totalPages") or 1) or not docs:
            return notes
        page += 1


def main():
    parser = argparse.ArgumentParser(description="Import Keystone notes into the HOA tracker")
    parser.add_argument("--dry-run", action="store_true", help="count only; write nothing")
    args = parser.parse_args()
    today = datetime.now(DENVER).date().isoformat()

    try:
        db = TrackerDB()
        client = CincClient()
        client.login()

        work_orders = db.select("work_items", {
            "select": "id,keystone_wo_number", "category": "eq.work_order",
            "excluded_at": "is.null", "keystone_wo_number": "not.is.null"})
        rows = []
        for wi in work_orders:
            rows += wo_note_rows(wi["keystone_wo_number"], wi["id"],
                                 portal_notes(client, wi["keystone_wo_number"]))
        logger.info("Work orders: %d linked tracker items, %d portal notes", len(work_orders), len(rows))

        arcs = db.select("work_items", {
            "select": "id,created_date,properties(parcel_code)", "category": "eq.arc_request",
            "excluded_at": "is.null"})
        candidates = [{"id": a["id"], "created_date": a.get("created_date"),
                       "parcel": (a.get("properties") or {}).get("parcel_code")} for a in arcs]
        matched = unmatched = 0
        for rec in client.get_all(f"/api/v1/bod/acc-review/{VILLAS_GROUPING}"):
            if not (rec.get("committeeResponse") or "").strip():
                continue
            parcel = unit_address((rec.get("unit") or {}).get("name", ""))
            wi_id = match_arc(parcel, normalize_date(rec.get("postedDate")), candidates)
            if not wi_id:
                unmatched += 1
                continue
            matched += 1
            rows.append(arc_note_row(rec, wi_id, today))
        logger.info("ARC committee responses: %d matched to tracker items, %d skipped (no clear match)",
                    matched, unmatched)

        existing = {r["source_key"] for r in db.select(
            "work_item_notes", {"select": "source_key", "source_key": "like.keystone:*"})}
        new = [r for r in rows if r["source_key"] not in existing]
        logger.info("%d notes total, %d already imported, %d new", len(rows), len(rows) - len(new), len(new))
        if args.dry_run:
            logger.info("[dry run] nothing written")
            return
        inserted = db.insert_new("work_item_notes", new)
        logger.info("Inserted %d notes", len(inserted))
    except (CincError, TrackerError) as e:
        logger.error("Keystone notes import failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
