#!/usr/bin/env python3
"""
Remove board-private items from Homeowner Documents.

All four targets are confirmed to exist in Board Documents, so trashing the
Homeowner Documents copies causes no data loss.

Targets:
  Insurance/2022-2023/          — attorney letters, litigation docs
  Maps/Rock Point/Pictures/     — personal resident photos
  Maps/Rock Point/Rock Point Neighborhood Mailing List/  — contact data
  Meetings/2025/ subfolders     — working .docx files (keep root-level PDFs)

Usage:
  python homeowner_docs_cleanup.py             # dry-run (default)
  python homeowner_docs_cleanup.py --execute   # perform changes
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, HOMEOWNER_DRIVE_ID, SHARED_DRIVE_ID

DRY_RUN  = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/homeowner_cleanup_log.json"


def find_folder(drive, parent_id, name, drive_id):
    escaped = name.replace("'", "\\'")
    resp = drive.files().list(
        q=f"name='{escaped}' and '{parent_id}' in parents and "
          f"mimeType='application/vnd.google-apps.folder' and trashed=false",
        corpora="drive", driveId=drive_id,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id, name)", pageSize=5,
    ).execute()
    files = resp.get("files", [])
    return files[0]["id"] if files else None


def list_children(drive, parent_id, drive_id):
    resp = drive.files().list(
        q=f"'{parent_id}' in parents and trashed=false",
        corpora="drive", driveId=drive_id,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id, name, mimeType)", pageSize=200,
    ).execute()
    return resp.get("files", [])


def count_recursive(drive, folder_id, drive_id):
    total = 0
    children = list_children(drive, folder_id, drive_id)
    for f in children:
        total += 1
        if f["mimeType"] == "application/vnd.google-apps.folder":
            total += count_recursive(drive, f["id"], drive_id)
    return total


def trash_item(drive, item_id):
    drive.files().update(
        fileId=item_id,
        body={"trashed": True},
        supportsAllDrives=True,
        fields="id",
    ).execute()


def process_folder(drive, folder_id, label, board_verified, log):
    """Trash a folder from Homeowner Documents (Drive cascades to all contents)."""
    print(f"\n{'─'*70}")
    print(f"  {label}")
    print(f"{'─'*70}")

    if not board_verified:
        print(f"  ⚠ SKIP — could not confirm this exists in Board Documents")
        log["skipped"].append({"label": label, "reason": "not verified in Board Docs"})
        return

    count = count_recursive(drive, folder_id, HOMEOWNER_DRIVE_ID)
    if DRY_RUN:
        print(f"  WOULD TRASH: {label} ({count} items inside)")
    else:
        trash_item(drive, folder_id)
        print(f"  TRASHED: {label} ({count} items)")
    log["actions"].append({"type": "trash_folder", "folder_id": folder_id,
                           "label": label, "item_count": count})


def main():
    drive = get_drive_service()
    log = {"timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN,
           "actions": [], "skipped": []}

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'='*70}")
    print(f"  HOMEOWNER DOCS CLEANUP — {mode}")
    print(f"  Removing board-private items from Homeowner Documents")
    print(f"{'='*70}")
    if not DRY_RUN:
        print("  *** LIVE MODE ***")

    # ── Resolve roots ──────────────────────────────────────────────────────────
    ho_ins_id    = find_folder(drive, HOMEOWNER_DRIVE_ID, "Insurance",  HOMEOWNER_DRIVE_ID)
    ho_maps_id   = find_folder(drive, HOMEOWNER_DRIVE_ID, "Maps",       HOMEOWNER_DRIVE_ID)
    ho_rp_id     = find_folder(drive, ho_maps_id,         "Rock Point", HOMEOWNER_DRIVE_ID) if ho_maps_id else None
    ho_mtg_id    = find_folder(drive, HOMEOWNER_DRIVE_ID, "Meetings",   HOMEOWNER_DRIVE_ID)
    ho_mtg25_id  = find_folder(drive, ho_mtg_id,          "2025",       HOMEOWNER_DRIVE_ID) if ho_mtg_id else None

    bd_ins_id    = find_folder(drive, SHARED_DRIVE_ID,    "Insurance",  SHARED_DRIVE_ID)
    bd_maps_id   = find_folder(drive, SHARED_DRIVE_ID,    "Maps",       SHARED_DRIVE_ID)
    bd_rp_id     = find_folder(drive, bd_maps_id,         "Rock Point", SHARED_DRIVE_ID) if bd_maps_id else None
    bd_mtg_id    = find_folder(drive, SHARED_DRIVE_ID,    "Meetings",   SHARED_DRIVE_ID)
    bd_mtg25_id  = find_folder(drive, bd_mtg_id,          "2025",       SHARED_DRIVE_ID) if bd_mtg_id else None

    # ── 1. Insurance/2022-2023/ ────────────────────────────────────────────────
    print("\n=== INSURANCE ===")
    ho_ins22_id = find_folder(drive, ho_ins_id, "2022-2023", HOMEOWNER_DRIVE_ID) if ho_ins_id else None
    bd_ins22_id = find_folder(drive, bd_ins_id, "2022-2023", SHARED_DRIVE_ID)    if bd_ins_id else None

    if not ho_ins22_id:
        print("\n  Insurance/2022-2023/ — not found in Homeowner Docs (already removed?)")
    else:
        process_folder(drive, ho_ins22_id, "Insurance/2022-2023/",
                       board_verified=(bd_ins22_id is not None), log=log)

    # ── 2. Maps/Rock Point/Pictures/ ──────────────────────────────────────────
    print("\n=== MAPS / ROCK POINT ===")
    ho_pics_id = find_folder(drive, ho_rp_id, "Pictures",                          HOMEOWNER_DRIVE_ID) if ho_rp_id else None
    ho_ml_id   = find_folder(drive, ho_rp_id, "Rock Point Neighborhood Mailing List", HOMEOWNER_DRIVE_ID) if ho_rp_id else None
    bd_pics_id = find_folder(drive, bd_rp_id, "Pictures",                          SHARED_DRIVE_ID)    if bd_rp_id else None
    bd_ml_id   = find_folder(drive, bd_rp_id, "Rock Point Neighborhood Mailing List", SHARED_DRIVE_ID) if bd_rp_id else None

    if not ho_pics_id:
        print("\n  Maps/Rock Point/Pictures/ — not found in Homeowner Docs (already removed?)")
    else:
        process_folder(drive, ho_pics_id, "Maps/Rock Point/Pictures/",
                       board_verified=(bd_pics_id is not None), log=log)

    if not ho_ml_id:
        print("\n  Maps/Rock Point/Rock Point Neighborhood Mailing List/ — not found (already removed?)")
    else:
        process_folder(drive, ho_ml_id, "Maps/Rock Point/Rock Point Neighborhood Mailing List/",
                       board_verified=(bd_ml_id is not None), log=log)

    # ── 3. Meetings/2025/ working-doc subfolders ──────────────────────────────
    print("\n=== MEETINGS — working-doc subfolders ===")

    if not ho_mtg25_id:
        print("\n  Meetings/2025/ — not found in Homeowner Docs")
    else:
        children = list_children(drive, ho_mtg25_id, HOMEOWNER_DRIVE_ID)
        subfolders = [f for f in children if f["mimeType"] == "application/vnd.google-apps.folder"]
        pdfs       = [f for f in children if f["mimeType"] != "application/vnd.google-apps.folder"]
        print(f"\n  Keeping {len(pdfs)} published PDFs in Meetings/2025/ root")

        if not subfolders:
            print("  No subfolders found — nothing to remove")
        else:
            for sf in sorted(subfolders, key=lambda x: x["name"]):
                # Verify this subfolder exists in Board Docs Meetings/2025/
                bd_sf_id = find_folder(drive, bd_mtg25_id, sf["name"], SHARED_DRIVE_ID) if bd_mtg25_id else None
                process_folder(drive, sf["id"],
                               f"Meetings/2025/{sf['name']}/",
                               board_verified=(bd_sf_id is not None), log=log)

    # ── Summary ───────────────────────────────────────────────────────────────
    trashed = len([a for a in log["actions"] if a["type"] == "trash_folder"])
    skipped = len(log["skipped"])
    total_items = sum(a.get("item_count", 0) for a in log["actions"])

    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"  Folders trashed:  {trashed}")
    print(f"  Total items:      {total_items}")
    print(f"  Folders skipped:  {skipped}")
    if DRY_RUN:
        print(f"\n  DRY RUN — re-run with --execute to apply.")

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"  Log: {LOG_FILE}")


if __name__ == "__main__":
    main()
