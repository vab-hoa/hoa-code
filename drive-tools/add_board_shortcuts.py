#!/usr/bin/env python3
"""
Create shortcuts in Board Documents root pointing to Homeowner Documents folders.

Shortcuts use a '→ ' prefix so they sort together and are visually distinct
from the native Board Documents folders.

Usage:
  python add_board_shortcuts.py             # dry-run (default)
  python add_board_shortcuts.py --execute   # create shortcuts
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, SHARED_DRIVE_ID, HOMEOWNER_DRIVE_ID

DRY_RUN  = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/shortcuts_log.json"

SHORTCUTS = [
    {"name": "→ Homeowner Budgets",           "target_folder": "Budgets"},
    {"name": "→ Homeowner Financials",         "target_folder": "Financials"},
    {"name": "→ Forms",                        "target_folder": "Forms"},
    {"name": "→ Governing Documents",          "target_folder": "Governing Documents"},
    {"name": "→ Homeowner Maps",               "target_folder": "Maps"},
    {"name": "→ Meeting Minutes (Published)",  "target_folder": "Meetings"},
    {"name": "→ Newsletters",                  "target_folder": "Newsletters"},
    {"name": "→ Policies (Canonical)",         "target_folder": "Policies"},
    {"name": "→ Projects",                     "target_folder": "Projects"},
    {"name": "→ Reserve Studies",              "target_folder": "Reserve Studies"},
]


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


def find_existing_shortcut(drive, name):
    """Check if a shortcut with this name already exists in Board Documents root."""
    escaped = name.replace("'", "\\'")
    resp = drive.files().list(
        q=f"name='{escaped}' and '{SHARED_DRIVE_ID}' in parents and trashed=false",
        corpora="drive", driveId=SHARED_DRIVE_ID,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id, name, mimeType)", pageSize=5,
    ).execute()
    files = resp.get("files", [])
    return files[0]["id"] if files else None


def create_shortcut(drive, name, target_id):
    result = drive.files().create(
        body={
            "name": name,
            "mimeType": "application/vnd.google-apps.shortcut",
            "parents": [SHARED_DRIVE_ID],
            "shortcutDetails": {"targetId": target_id},
        },
        supportsAllDrives=True,
        fields="id",
    ).execute()
    return result["id"]


def main():
    drive = get_drive_service()
    log = {"timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN,
           "actions": [], "skipped": []}

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'='*70}")
    print(f"  ADD BOARD SHORTCUTS — {mode}")
    print(f"  Creating shortcuts in Board Documents → Homeowner Documents folders")
    print(f"{'='*70}")
    if not DRY_RUN:
        print("  *** LIVE MODE ***")

    print()
    for sc in SHORTCUTS:
        name   = sc["name"]
        target_folder = sc["target_folder"]

        target_id = find_folder(drive, HOMEOWNER_DRIVE_ID, target_folder, HOMEOWNER_DRIVE_ID)
        if not target_id:
            print(f"  ⚠ SKIP  {name!r} — target '{target_folder}' not found in Homeowner Docs")
            log["skipped"].append({"name": name, "reason": f"target '{target_folder}' not found"})
            continue

        existing_id = find_existing_shortcut(drive, name)
        if existing_id:
            print(f"  SKIP  {name!r} — shortcut already exists ({existing_id})")
            log["skipped"].append({"name": name, "reason": "already exists", "id": existing_id})
            continue

        if DRY_RUN:
            print(f"  WOULD CREATE: {name!r}  →  Homeowner Docs/{target_folder}/")
        else:
            new_id = create_shortcut(drive, name, target_id)
            print(f"  CREATED: {name!r}  →  Homeowner Docs/{target_folder}/  ({new_id})")
        log["actions"].append({"type": "create_shortcut", "name": name,
                               "target_folder": target_folder, "target_id": target_id})

    created = len(log["actions"])
    skipped = len(log["skipped"])
    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"  Shortcuts created: {created}")
    print(f"  Skipped:           {skipped}")
    if DRY_RUN:
        print(f"\n  DRY RUN — re-run with --execute to apply.")

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"  Log: {LOG_FILE}")


if __name__ == "__main__":
    main()
