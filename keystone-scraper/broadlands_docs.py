#!/usr/bin/env python3
"""Broadlands Master Association document sync (Keystone portal -> HOA Documents drive).

Keeps two folders of the Broadlands portal library mirrored into
HOA Documents / BRL Master Documents / {Architectural, Governing Documents}.
Runs weekly in GitHub Actions (.github/workflows/broadlands-sync.yml).

Each run compares the portal's files against broadlands_manifest.json (committed to git):
  NEW      a file name not seen before -> copied to Drive as a new file
  UPDATED  same name, different size or upload time -> the existing Drive file is
           replaced *in place by its Drive file ID*, so its link never changes
  REMOVED  gone from the portal -> reported; the Drive copy is kept
Any change is emailed to president@ and itofficer@.

Usage:
  python broadlands_docs.py            # weekly run
  python broadlands_docs.py --dry-run  # report changes; download/upload/save nothing
  python broadlands_docs.py --init     # rebuild the manifest from the portal and link each
                                       # file to its existing Drive copy (prints the matches
                                       # for review; copies nothing)

The manifest records, per portal file: its size, upload time, and the Drive file ID it
is mirrored to. Only top-level files of each folder are mirrored (the portal's Bylaws and
CC&Rs subfolders hold copies of top-level files).
"""
import argparse
import json
import logging
import mimetypes
import sys
from datetime import datetime, timezone
from pathlib import Path

from cinc_client import BROADLANDS_GROUPING, CincClient, CincError
import drive_files
from notify import send_alert

BRL_FOLDER_ID = "1OmARhr1cvEyKYPYSfc1XNTHi0WK5x3ie"  # HOA Documents / BRL Master Documents
# portal folder name -> Drive folder ID
TARGET_FOLDERS = {
    "Architectural": "16StU165ncThAnnEd-NCtUXMKYgcmIxYh",
    "Governing Documents": "1-w80QUYhD930EMvKujCuSHsreoBBi35C",
}
MANIFEST_PATH = Path(__file__).parent / "broadlands_manifest.json"
MANIFEST_VERSION = 2
CHANGE_RECIPIENTS = ["president@villasboulders.org", "itofficer@villasboulders.org"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("googleapiclient.discovery_cache").setLevel(logging.ERROR)
logger = logging.getLogger("broadlands_docs")


# ── pure logic (tested in tests/test_document_sync.py) ────────────────────────

def classify(entry, record):
    """'new', 'updated' or 'unchanged' for a portal file against its manifest entry."""
    if entry is None:
        return "new"
    if entry.get("size") != record.get("size") or entry.get("updated_at") != record.get("updatedAt"):
        return "updated"
    return "unchanged"


def _base(name):
    """Comparable name: lowercase, no extension, no 'BRL ' prefix."""
    stem = name.rsplit(".", 1)[0] if "." in name else name
    stem = stem.strip().lower()
    return stem[4:] if stem.startswith("brl ") else stem


def match_drive_file(portal_name, portal_size, drive_items):
    """Pick the existing Drive file that mirrors a portal file, for --init.

    In order: exact name; same name ignoring extension case and a 'BRL ' prefix; same size.
    Ties go to the most recently modified file (the one the old sync was maintaining).
    Returns (drive item or None, how it matched).
    """
    def newest(items):
        return max(items, key=lambda d: d.get("modifiedTime", "")) if items else None

    exact = [d for d in drive_items if d["name"] == portal_name]
    if exact:
        return newest(exact), "exact name"
    by_name = [d for d in drive_items if _base(d["name"]) == _base(portal_name)]
    if by_name:
        return newest(by_name), "similar name"
    by_size = [d for d in drive_items if portal_size is not None and str(d.get("size")) == str(portal_size)]
    if by_size:
        return newest(by_size), "same size"
    return None, "no match"


# ── manifest ──────────────────────────────────────────────────────────────────

def load_manifest():
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text())
        if manifest.get("version") == MANIFEST_VERSION:
            return manifest
    return None


def save_manifest(manifest):
    manifest["version"] = MANIFEST_VERSION
    manifest["last_checked"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def entry_for(record, drive_file_id):
    return {"size": record.get("size"), "updated_at": record.get("updatedAt"),
            "drive_file_id": drive_file_id}


# ── run ───────────────────────────────────────────────────────────────────────

def portal_files(client, folder_name):
    folder_id = client.find_folder(BROADLANDS_GROUPING, folder_name)
    return [i for i in client.list_folder(BROADLANDS_GROUPING, folder_id) if i.get("type") != "folder"]


def init(client, drive, dry_run):
    manifest = {"folders": {}}
    for folder_name, drive_folder in TARGET_FOLDERS.items():
        drive_items = drive_files.list_children(drive, drive_folder)
        entries = manifest["folders"][folder_name] = {}
        print(f"\n{folder_name}:")
        for rec in portal_files(client, folder_name):
            match, how = match_drive_file(rec["name"], rec.get("size"), drive_items)
            entries[rec["name"]] = entry_for(rec, match["id"] if match else None)
            target = f"{match['name']} ({how})" if match else "NO MATCH - next run copies it as a new file"
            print(f"  {rec['name']:<50} -> {target}")
    if dry_run:
        print("\n[dry run] manifest not saved")
    else:
        save_manifest(manifest)
        print(f"\nManifest saved to {MANIFEST_PATH.name}. Review the matches above.")


def sync(client, drive, manifest, dry_run):
    changes = []
    for folder_name, drive_folder in TARGET_FOLDERS.items():
        saved = manifest["folders"].setdefault(folder_name, {})
        current = portal_files(client, folder_name)
        logger.info("%s: %d files on the portal", folder_name, len(current))
        for rec in current:
            name = rec["name"]
            entry = saved.get(name)
            state = classify(entry, rec)
            if state == "unchanged":
                continue
            logger.info("  %s: %s", state.upper(), name)
            if dry_run:
                changes.append(f"  {state.upper()}: {folder_name}/{name}")
                continue
            data = client.download_file(rec)
            mime = rec.get("mimetype") or mimetypes.guess_type(name)[0]
            file_id = entry.get("drive_file_id") if entry else None
            if file_id and drive_files.file_exists(drive, file_id):
                drive_files.update_file(drive, file_id, data, mime)
                note = "updated in place (same link)"
            else:
                # New to us. Reuse a same-named Drive file if one exists (e.g. a rerun after
                # a failed manifest commit) rather than creating a duplicate.
                file_id = drive_files.find_child(drive, drive_folder, name)
                if file_id:
                    drive_files.update_file(drive, file_id, data, mime)
                    note = "replaced same-named Drive file"
                else:
                    file_id, _ = drive_files.create_file(drive, drive_folder, name, data, mime)
                    note = "copied as a NEW Drive file (new link)"
            saved[name] = entry_for(rec, file_id)
            changes.append(f"  {state.upper()}: {folder_name}/{name}\n"
                           f"    {note}: {drive_files.file_link(file_id)}")
        for name in [n for n in saved if n not in {r['name'] for r in current}]:
            logger.info("  REMOVED from portal: %s", name)
            changes.append(f"  REMOVED from portal: {folder_name}/{name} (Drive copy kept; review)")
            if not dry_run:
                del saved[name]
    return changes


def main():
    parser = argparse.ArgumentParser(description="Broadlands document sync")
    parser.add_argument("--init", action="store_true", help="rebuild manifest and link existing Drive files")
    parser.add_argument("--dry-run", action="store_true", help="report only; change nothing")
    args = parser.parse_args()

    try:
        client = CincClient()
        client.login()
        drive = drive_files.drive_service()
        if args.init:
            init(client, drive, args.dry_run)
            return
        manifest = load_manifest()
        if manifest is None:
            raise CincError(f"{MANIFEST_PATH.name} missing or old format; run with --init first")
        changes = sync(client, drive, manifest, args.dry_run)
    except CincError as e:
        logger.error("Broadlands sync failed: %s", e)
        sys.exit(1)

    if not args.dry_run:
        save_manifest(manifest)
    if not changes:
        logger.info("No changes")
        return
    body = (f"Broadlands Master Association documents changed "
            f"({datetime.now().strftime('%Y-%m-%d')}):\n\n" + "\n".join(changes) +
            f"\n\nDrive folder: https://drive.google.com/drive/folders/{BRL_FOLDER_ID}\n\n"
            "Reminders:\n"
            "  - Updated files keep their Drive link; no website change needed.\n"
            "  - NEW files have a new link: add it on the website if it should be linked.\n"
            "  - Review the Policy Directory and consider telling homeowners if governing\n"
            "    documents changed.\n")
    if args.dry_run:
        print("\n[dry run] email that would be sent:\n" + body)
    else:
        send_alert("Broadlands documents updated", body, recipients=CHANGE_RECIPIENTS)
        logger.info("Change summary emailed")


if __name__ == "__main__":
    main()
