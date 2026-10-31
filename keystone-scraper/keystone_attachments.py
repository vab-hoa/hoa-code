#!/usr/bin/env python3
"""Import Keystone work-order and ARC attachments into the HOA tracker.

Runs nightly in GitHub Actions after the notes import (.github/workflows/keystone-scraper.yml).
Each attachment (photos, ARC drawings, quotes) is uploaded to the tracker's
work-item-documents storage and listed in work_item_documents, so it appears in the
Documents card on the work item's page at tracker.villasboulders.org.

Linking is the same as for notes (keystone_notes.py): work orders by keystone_wo_number,
ARC requests by parcel + nearest date. Every row carries a source_key
(keystone:wo-attachment:<id> / keystone:arc-attachment:<id>); the database refuses
duplicates. Files the old backfill already imported (same work item, file name and size)
are recognised and skipped. At most MAX_DOWNLOADS files are fetched per run; the rest
follow on later nights.

Usage:
  python keystone_attachments.py            # import
  python keystone_attachments.py --dry-run  # count what would be imported; write nothing
"""
import argparse
import logging
import mimetypes
import re
import sys

from cinc_client import VILLAS_GROUPING, CincClient, CincError
from keystone_notes import arc_candidates, arc_work_item, linked_work_orders
from tracker_db import TrackerDB, TrackerError

UPLOADED_BY = "Keystone portal (imported)"
MAX_DOWNLOADS = 300

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("keystone_attachments")


# ── pure logic (tested in tests/test_keystone_attachments.py) ─────────────────

def safe_name(name):
    """Storage-safe file name: keep letters, digits, dot, dash, underscore."""
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name or "file").strip("._")
    return cleaned[:120] or "file"


def wo_attachment(item, work_item_id):
    """Normalized record for a work-order attachment list item."""
    return {"work_item_id": work_item_id, "id": str(item["_id"]), "file_name": item.get("filename") or "file",
            "database": item.get("database"), "size": item.get("fileSize"),
            "module": CincClient.WO_MODULE, "source_key": f"keystone:wo-attachment:{item['_id']}"}


def arc_attachment(item, work_item_id):
    """Normalized record for an ARC attachment list item."""
    return {"work_item_id": work_item_id, "id": str(item["attachmentId"]), "file_name": item.get("fileName") or "file",
            "database": item.get("database"), "size": item.get("fileSize"),
            "module": CincClient.ARC_MODULE, "source_key": f"keystone:arc-attachment:{item['attachmentId']}"}


def already_have(att, existing_keys, existing_files):
    """True if this attachment was imported before (by key, or by the old backfill)."""
    if att["source_key"] in existing_keys:
        return True
    return (att["work_item_id"], att["file_name"], str(att["size"])) in existing_files


def document_row(att, storage_path, size):
    return {
        "work_item_id": att["work_item_id"],
        "title": att["file_name"],
        "file_name": att["file_name"],
        "storage_path": storage_path,
        "content_type": mimetypes.guess_type(att["file_name"])[0] or "application/octet-stream",
        "file_size_bytes": size,
        "uploaded_by": UPLOADED_BY,
        "source_key": att["source_key"],
    }


# ── run ───────────────────────────────────────────────────────────────────────

def list_attachments(client, db):
    """All attachments on linked work orders and matched ARC requests."""
    found = []
    for wi in linked_work_orders(db):
        body = client.get(f"/api/v1/bod/work-orders/attachments/{wi['keystone_wo_number']}")
        found += [wo_attachment(i, wi["id"]) for i in (body.get("data") or [])]
    candidates = arc_candidates(db)
    for rec in client.get_all(f"/api/v1/bod/acc-review/{VILLAS_GROUPING}"):
        wi_id = arc_work_item(rec, candidates)
        if not wi_id:
            continue
        body = client.get(f"/api/v1/bod/acc-review/attachments/{rec['_id']}")
        found += [arc_attachment(i, wi_id) for i in (body.get("data") or [])]
    return found


def main():
    parser = argparse.ArgumentParser(description="Import Keystone attachments into the HOA tracker")
    parser.add_argument("--dry-run", action="store_true", help="count only; write nothing")
    args = parser.parse_args()

    try:
        db = TrackerDB()
        client = CincClient()
        client.login()
        attachments = list_attachments(client, db)
        docs = db.select("work_item_documents", {"select": "work_item_id,file_name,file_size_bytes,source_key"})
        existing_keys = {d["source_key"] for d in docs if d.get("source_key")}
        existing_files = {(d["work_item_id"], d["file_name"], str(d["file_size_bytes"])) for d in docs}
        todo = [a for a in attachments if not already_have(a, existing_keys, existing_files)]
        logger.info("%d attachments on linked items, %d already in the tracker, %d to import (%.0f MB)",
                    len(attachments), len(attachments) - len(todo), len(todo),
                    sum(int(a["size"] or 0) for a in todo) / 1e6)
        if args.dry_run:
            logger.info("[dry run] nothing written")
            return
        imported = 0
        for att in todo[:MAX_DOWNLOADS]:
            data = client.attachment(att["id"], att["database"], att["file_name"], att["module"])
            kind = att["source_key"].split(":")[1]
            path = f"{att['work_item_id']}/keystone-{kind}-{att['id']}-{safe_name(att['file_name'])}"
            row = document_row(att, path, len(data))
            db.upload(path, data, row["content_type"])  # file first; a rerun overwrites it
            imported += len(db.insert_new("work_item_documents", [row]))
        logger.info("Imported %d attachments%s", imported,
                    f"; {len(todo) - MAX_DOWNLOADS} left for later runs" if len(todo) > MAX_DOWNLOADS else "")
    except (CincError, TrackerError) as e:
        logger.error("Keystone attachments import failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
