#!/usr/bin/env python3
"""Villas portal document monitor (Keystone portal library -> HOA Documents drive).

Runs nightly in GitHub Actions after the Keystone sync (.github/workflows/keystone-scraper.yml).
Walks the whole Villas document library on the Keystone portal and compares it with
keystone_docs_manifest.json (committed to git):

  - New files in a mapped folder (monthly financial reports, general session minutes) are
    copied into the matching year folder in HOA Documents (year folder created if needed).
  - New files anywhere else trigger one alert email listing them, so the board sees what
    Keystone posted.

Usage:
  python keystone_documents.py            # nightly run
  python keystone_documents.py --dry-run  # report only; copy, email and save nothing
  python keystone_documents.py --init     # record the portal's current files as known
  python keystone_documents.py --explore  # print the portal folder tree and exit
"""
import argparse
import json
import logging
import mimetypes
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from cinc_client import VILLAS_GROUPING, CincClient, CincError
import drive_files
from notify import send_alert

MANIFEST_PATH = Path(__file__).parent / "keystone_docs_manifest.json"
MANIFEST_VERSION = 2

ALERT_EMAILS = [
    "president@villasboulders.org",
    "secretary@villasboulders.org",
    "itofficer@villasboulders.org",
    "admin@villasboulders.org",
]

# Portal folder -> Drive destination in HOA Documents. Files under "<folder>/<YYYY>/" go to
# parent[/intermediate]/YYYY; files directly in the folder go to the parent.
DOCUMENT_MAPPINGS = {
    "Board - Financials": {"parent": "1MUlUcjTZ506AOifBThfuzhZmViUbHW2Q",   # Financials
                           "intermediate": "Keystone Financial Reports"},
    "Financials": {"parent": "1MUlUcjTZ506AOifBThfuzhZmViUbHW2Q",
                   "intermediate": "Keystone Financial Reports"},
    "General Session Minutes": {"parent": "1I-A7N2b2tO-DD2nofyUd7Efhd19D2d4y",  # Meetings
                                "intermediate": None},
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("googleapiclient.discovery_cache").setLevel(logging.ERROR)
logger = logging.getLogger("keystone_documents")


# ── pure logic (tested in tests/test_document_sync.py) ────────────────────────

def mapping_for(path):
    """(mapping, year or None) for a portal folder path, or (None, None) if unmapped."""
    parts = path.split("/") if path else []
    if not parts or parts[0] not in DOCUMENT_MAPPINGS:
        return None, None
    year = parts[1] if len(parts) > 1 and re.fullmatch(r"(19|20|21)\d{2}", parts[1]) else None
    return DOCUMENT_MAPPINGS[parts[0]], year


def new_files(current, known):
    """[(path, record)] in current {path: [records]} whose name isn't in known {path: {name: ...}}."""
    return [(path, rec) for path, recs in sorted(current.items())
            for rec in recs if rec["name"] not in known.get(path, {})]


# ── manifest ──────────────────────────────────────────────────────────────────

def load_manifest():
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text())
        if manifest.get("version") == MANIFEST_VERSION:
            return manifest
    return None


def save_manifest(current):
    manifest = {
        "version": MANIFEST_VERSION,
        "last_checked": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "files": {path: {r["name"]: {"id": r["_id"], "size": r.get("size"), "updated_at": r.get("updatedAt")}
                         for r in sorted(recs, key=lambda r: r["name"])}
                  for path, recs in sorted(current.items())},
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


# ── run ───────────────────────────────────────────────────────────────────────

def destination_folder(drive, mapping, year):
    folder = mapping["parent"]
    if year:
        if mapping.get("intermediate"):
            folder = drive_files.find_or_create_folder(drive, mapping["intermediate"], folder)
        folder = drive_files.find_or_create_folder(drive, year, folder)
    return folder


def main():
    parser = argparse.ArgumentParser(description="Villas portal document monitor")
    parser.add_argument("--init", action="store_true", help="record current portal files as known")
    parser.add_argument("--dry-run", action="store_true", help="report only; change nothing")
    parser.add_argument("--explore", action="store_true", help="print the folder tree and exit")
    args = parser.parse_args()

    try:
        client = CincClient()
        client.login()
        current = {}
        for path, rec in client.walk_files(VILLAS_GROUPING):
            current.setdefault(path, []).append(rec)
    except CincError as e:
        logger.error("Villas document monitor failed: %s", e)
        sys.exit(1)
    logger.info("Portal library: %d files in %d folders",
                sum(map(len, current.values())), len(current))

    if args.explore:
        for path in sorted(current):
            mapping, year = mapping_for(path)
            print(f"  {path or '(top level)'}  [{len(current[path])} files]"
                  + ("  -> copied to Drive" if mapping else ""))
        return
    if args.init:
        if args.dry_run:
            print("[dry run] manifest not saved")
        else:
            save_manifest(current)
            logger.info("Manifest rebuilt from the portal; nothing copied")
        return

    manifest = load_manifest()
    if manifest is None:
        logger.error("%s missing or old format; run with --init first", MANIFEST_PATH.name)
        sys.exit(1)

    found = new_files(current, manifest["files"])
    copied, unmapped = [], []
    drive = None if args.dry_run else drive_files.drive_service()
    for path, rec in found:
        mapping, year = mapping_for(path)
        if not mapping:
            unmapped.append(f"  {path}/{rec['name']}")
            logger.info("NEW (not copied): %s/%s", path, rec["name"])
            continue
        logger.info("NEW: %s/%s", path, rec["name"])
        if args.dry_run:
            copied.append(f"  {path}/{rec['name']} (would copy)")
            continue
        folder = destination_folder(drive, mapping, year)
        existing = drive_files.find_child(drive, folder, rec["name"])
        if existing:  # already copied (e.g. rerun after a failed manifest commit)
            copied.append(f"  {path}/{rec['name']} (already in Drive)")
            continue
        data = client.download_file(rec)
        file_id, _ = drive_files.create_file(drive, folder, rec["name"], data,
                                             rec.get("mimetype") or mimetypes.guess_type(rec["name"])[0])
        copied.append(f"  {path}/{rec['name']}\n    {drive_files.file_link(file_id)}")

    if not found:
        logger.info("No new files")
    if unmapped:
        body = ("Keystone posted new files to the Villas portal document library that are not "
                "copied to Drive automatically:\n\n" + "\n".join(unmapped) +
                ("\n\nAlso copied to HOA Documents automatically:\n\n" + "\n".join(copied) if copied else "") +
                "\n\nPortal: https://kppm.cincconnect.com (Documents)\n")
        if args.dry_run:
            print("\n[dry run] alert that would be sent:\n" + body)
        else:
            send_alert("New Keystone portal documents", body, recipients=ALERT_EMAILS)
            logger.info("Alert emailed for %d unmapped file(s)", len(unmapped))
    for line in copied:
        logger.info("Copied:%s", line.split("\n")[0])
    if not args.dry_run:
        save_manifest(current)


if __name__ == "__main__":
    main()
