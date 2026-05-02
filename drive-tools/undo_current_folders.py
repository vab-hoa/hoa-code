#!/usr/bin/env python3
"""
Undo the Current/ folder pattern in Board Documents.

Moves files back to their year/parent folders and trashes the empty Current/ dirs.
Skips any Current/ folder whose ID is linked from the website (link_registry.json).

Usage:
  python undo_current_folders.py             # dry-run (default)
  python undo_current_folders.py --execute   # perform changes
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, SHARED_DRIVE_ID

DRY_RUN  = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/undo_current_log.json"
REGISTRY = "/home/dee/hoa-code/drive-tools/link_registry.json"

# From quick_wins_log.json — exact IDs known
KNOWN_CURRENT_FOLDERS = [
    {
        "current_folder_id": "1Ij8noiGYV_dyiPgPJQWu5Cp8pa8M8xv-",
        "label": "Budget/Current/",
        "return_to_id": None,   # resolved at runtime via Budget/2026/
        "return_to_label": "Budget/2026/",
        "files": [
            {"id": "1Nwzq-Fi-H0IqliKJWw9uCow1SpalAxod", "name": "2025 11 17 Budget meeting.pdf"},
            {"id": "16j2aJXvQLHF7PaM5d4BR4vCO1jNF3PNY", "name": "2026 VATB Budget.pdf"},
        ],
    },
    {
        "current_folder_id": "1GAAHEohSlB1naLNKiCdlcX23QZSaGTqk",
        "label": "Rules and Regulations Document/Current/",
        "return_to_id": None,
        "return_to_label": "Rules and Regulations Document/2026/",
        "files": [
            {"id": "19hxAt3aSH4D1Fj1ZruszcR-a3CKGmsLS", "name": "Rules and Regulations new layout.docx"},
            {"id": "18LzGuaz5gZMIMumIQVbuJleY7a2lrlat", "name": "Rules and Regulations (2026.02).docx"},
        ],
    },
]

# March 23 cleanup Current/ folders — paths from drive root
MARCH_CURRENT_ENTRIES = [
    {
        "parent_path": ["Committees", "ARC Design Guidelines"],
        "label": "Committees/ARC Design Guidelines/Current/",
    },
    {
        "parent_path": ["Governing Documents", "Bylaws"],
        "label": "Governing Documents/Bylaws/Current/",
    },
    {
        "parent_path": ["Governing Documents", "Covenants"],
        "label": "Governing Documents/Covenants/Current/",
    },
    {
        "parent_path": ["Policies and Procedures", "Policy Directory"],
        "label": "Policies and Procedures/Policy Directory/Current/",
    },
]


def load_registry():
    try:
        with open(REGISTRY) as f:
            return set(json.load(f).keys())
    except FileNotFoundError:
        return set()


def find_folder(drive, parent_id, name, drive_id=SHARED_DRIVE_ID):
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


def list_children(drive, parent_id, drive_id=SHARED_DRIVE_ID):
    resp = drive.files().list(
        q=f"'{parent_id}' in parents and trashed=false",
        corpora="drive", driveId=drive_id,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id, name, mimeType)", pageSize=200,
    ).execute()
    return resp.get("files", [])


def move_file(drive, file_id, old_parent, new_parent):
    drive.files().update(
        fileId=file_id,
        addParents=new_parent,
        removeParents=old_parent,
        supportsAllDrives=True,
        fields="id",
    ).execute()


def trash_folder(drive, folder_id):
    drive.files().update(
        fileId=folder_id,
        body={"trashed": True},
        supportsAllDrives=True,
        fields="id",
    ).execute()


def process_current_folder(drive, current_id, label, return_to_id, return_to_label,
                            files, linked_ids, log):
    print(f"\n{'─'*70}")
    print(f"  {label}")
    print(f"{'─'*70}")

    if current_id in linked_ids:
        print(f"  ⚠ SKIP — folder ID {current_id} is linked from the website")
        log["skipped"].append({"label": label, "reason": "linked from website", "id": current_id})
        return

    if return_to_id is None:
        print(f"  ERROR: return destination not resolved")
        return

    for f in files:
        if DRY_RUN:
            print(f"  WOULD MOVE: {f['name']} → {return_to_label}")
        else:
            move_file(drive, f["id"], current_id, return_to_id)
            print(f"  MOVED: {f['name']} → {return_to_label}")
        log["actions"].append({
            "type": "move_file",
            "file_id": f["id"],
            "file_name": f["name"],
            "from": label,
            "to": return_to_label,
        })

    # Verify folder is now empty before trashing
    remaining = list_children(drive, current_id)
    if remaining:
        print(f"  ⚠ Folder not empty after moves ({len(remaining)} items remain) — not trashing")
        return

    if DRY_RUN:
        print(f"  WOULD TRASH: {label} (now empty)")
    else:
        trash_folder(drive, current_id)
        print(f"  TRASHED: {label}")
    log["actions"].append({"type": "trash_folder", "folder_id": current_id, "label": label})


def main():
    drive = get_drive_service()
    linked_ids = load_registry()
    log = {"timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN,
           "actions": [], "skipped": []}

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'='*70}")
    print(f"  UNDO CURRENT/ FOLDERS — {mode}")
    print(f"{'='*70}")
    if not DRY_RUN:
        print("  *** LIVE MODE ***")

    # ── Known folders from quick_wins_log ────────────────────────────────────
    print("\n=== FROM APR 27 QUICK WINS SCRIPT ===")

    # Resolve Budget/2026/ parent
    budget_id = find_folder(drive, SHARED_DRIVE_ID, "Budget")
    budget_2026_id = find_folder(drive, budget_id, "2026") if budget_id else None

    # Resolve R&R/2026/ parent
    pp_id = find_folder(drive, SHARED_DRIVE_ID, "Policies and Procedures")
    rr_id = find_folder(drive, pp_id, "Rules and Regulations Document") if pp_id else None
    rr_2026_id = find_folder(drive, rr_id, "2026") if rr_id else None

    for entry in KNOWN_CURRENT_FOLDERS:
        if entry["label"].startswith("Budget"):
            return_to_id = budget_2026_id
        else:
            return_to_id = rr_2026_id

        process_current_folder(
            drive,
            current_id=entry["current_folder_id"],
            label=entry["label"],
            return_to_id=return_to_id,
            return_to_label=entry["return_to_label"],
            files=entry["files"],
            linked_ids=linked_ids,
            log=log,
        )

    # ── March 23 Current/ folders — discovered at runtime ────────────────────
    print("\n=== FROM MARCH 23 CLEANUP ===")

    for entry in MARCH_CURRENT_ENTRIES:
        label = entry["label"]
        parent_path = entry["parent_path"]

        # Navigate nested path from drive root
        parent_id = SHARED_DRIVE_ID
        for part in parent_path:
            parent_id = find_folder(drive, parent_id, part)
            if not parent_id:
                print(f"\n  {label} — folder '{part}' not found in path, skipping")
                break
        else:
            current_id = find_folder(drive, parent_id, "Current")
            if not current_id:
                print(f"\n  {label} — Current/ not found (already removed?)")
                continue

            files = [f for f in list_children(drive, current_id)
                     if f["mimeType"] != "application/vnd.google-apps.folder"]

            process_current_folder(
                drive,
                current_id=current_id,
                label=label,
                return_to_id=parent_id,
                return_to_label="/".join(parent_path) + "/",
                files=files,
                linked_ids=linked_ids,
                log=log,
            )

    # ── Summary ───────────────────────────────────────────────────────────────
    moves   = sum(1 for a in log["actions"] if a["type"] == "move_file")
    trashes = sum(1 for a in log["actions"] if a["type"] == "trash_folder")
    skipped = len(log["skipped"])

    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"  Files moved:      {moves}")
    print(f"  Folders trashed:  {trashes}")
    print(f"  Folders skipped (website-linked): {skipped}")
    if DRY_RUN:
        print(f"\n  DRY RUN — re-run with --execute to apply.")

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"  Log: {LOG_FILE}")


if __name__ == "__main__":
    main()
