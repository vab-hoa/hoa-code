#!/usr/bin/env python3
"""
Stage 2: Drive Quick Wins — create Current/ folders, rename confusing folders.

Actions:
  1. Create Budget/Current/ and move 2026 budget files into it
  2. Create Policies and Procedures/Rules and Regulations Document/Current/
     and move 2026 R&R files into it
  3. Rename Final/ → Policy Source Documents/
  4. Rename Z_Downloaded Stuff to Remove/ → Reviewed - Legacy Downloads (2013-2019)/

Usage:
  python drive_quick_wins.py             # dry-run (default)
  python drive_quick_wins.py --execute   # perform changes
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, SHARED_DRIVE_ID, list_all_drive_files

DRY_RUN = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/quick_wins_log.json"


def find_folder(drive, parent_id, name):
    """Find a folder by name under a parent."""
    escaped = name.replace("'", "\\'")
    q = (
        f"name = '{escaped}' and "
        f"'{parent_id}' in parents and "
        f"mimeType = 'application/vnd.google-apps.folder' and "
        f"trashed = false"
    )
    resp = drive.files().list(
        q=q,
        corpora="drive",
        driveId=SHARED_DRIVE_ID,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
        fields="files(id, name)",
        pageSize=5,
    ).execute()
    files = resp.get("files", [])
    return files[0]["id"] if files else None


def create_folder(drive, name, parent_id):
    """Create a folder on the shared drive."""
    metadata = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    f = drive.files().create(
        body=metadata,
        supportsAllDrives=True,
        fields="id",
    ).execute()
    return f["id"]


def move_file(drive, file_id, old_parent_id, new_parent_id):
    """Move a file from one parent to another."""
    drive.files().update(
        fileId=file_id,
        addParents=new_parent_id,
        removeParents=old_parent_id,
        supportsAllDrives=True,
        fields="id",
    ).execute()


def rename_folder(drive, folder_id, new_name):
    """Rename a folder."""
    drive.files().update(
        fileId=folder_id,
        body={"name": new_name},
        supportsAllDrives=True,
        fields="id, name",
    ).execute()


def list_children(drive, parent_id, folders_only=False):
    """List non-trashed children of a folder."""
    q = f"'{parent_id}' in parents and trashed = false"
    if folders_only:
        q += " and mimeType = 'application/vnd.google-apps.folder'"
    else:
        q += " and mimeType != 'application/vnd.google-apps.folder'"
    resp = drive.files().list(
        q=q,
        corpora="drive",
        driveId=SHARED_DRIVE_ID,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
        fields="files(id, name, mimeType)",
        pageSize=100,
    ).execute()
    return resp.get("files", [])


def main():
    drive = get_drive_service()
    log = {"timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN, "actions": []}

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'=' * 80}")
    print(f"STAGE 2: DRIVE QUICK WINS — {mode}")
    print(f"{'=' * 80}\n")

    if not DRY_RUN:
        print("*** LIVE MODE — changes will be made to the shared drive ***\n")

    # ── 1. Budget/Current/ ────────────────────────────────────────────────────
    print(f"{'─' * 80}")
    print("1. CREATE Budget/Current/ WITH 2026 FILES")
    print(f"{'─' * 80}\n")

    budget_id = find_folder(drive, SHARED_DRIVE_ID, "Budget")
    if not budget_id:
        print("  ERROR: Budget/ folder not found at drive root")
    else:
        print(f"  Found Budget/: {budget_id}")

        # Find Budget/2026/
        budget_2026_id = find_folder(drive, budget_id, "2026")
        if not budget_2026_id:
            print("  ERROR: Budget/2026/ folder not found")
        else:
            print(f"  Found Budget/2026/: {budget_2026_id}")

            # Find or create Budget/Current/
            current_id = find_folder(drive, budget_id, "Current")
            if current_id:
                print(f"  Budget/Current/ already exists: {current_id}")
            else:
                action = {"type": "create_folder", "name": "Current", "parent": "Budget/"}
                if DRY_RUN:
                    print("  WOULD CREATE: Budget/Current/")
                    current_id = "(dry-run)"
                else:
                    current_id = create_folder(drive, "Current", budget_id)
                    print(f"  CREATED: Budget/Current/ ({current_id})")
                    action["created_id"] = current_id
                log["actions"].append(action)

            # Move 2026 files into Current/
            if current_id and current_id != "(dry-run)":
                files_2026 = list_children(drive, budget_2026_id)
                for f in files_2026:
                    action = {
                        "type": "move_file",
                        "file_id": f["id"],
                        "file_name": f["name"],
                        "from": "Budget/2026/",
                        "to": "Budget/Current/",
                    }
                    if DRY_RUN:
                        print(f"  WOULD MOVE: {f['name']} → Budget/Current/")
                    else:
                        move_file(drive, f["id"], budget_2026_id, current_id)
                        print(f"  MOVED: {f['name']} → Budget/Current/")
                    log["actions"].append(action)
            elif current_id == "(dry-run)":
                files_2026 = list_children(drive, budget_2026_id)
                for f in files_2026:
                    print(f"  WOULD MOVE: {f['name']} → Budget/Current/")
                    log["actions"].append({
                        "type": "move_file",
                        "file_id": f["id"],
                        "file_name": f["name"],
                        "from": "Budget/2026/",
                        "to": "Budget/Current/",
                    })

    # ── 2. Rules and Regulations Document/Current/ ────────────────────────────
    print(f"\n{'─' * 80}")
    print("2. CREATE Rules and Regulations Document/Current/ WITH 2026 FILES")
    print(f"{'─' * 80}\n")

    pp_id = find_folder(drive, SHARED_DRIVE_ID, "Policies and Procedures")
    if not pp_id:
        print("  ERROR: Policies and Procedures/ not found")
    else:
        rr_id = find_folder(drive, pp_id, "Rules and Regulations Document")
        if not rr_id:
            print("  ERROR: Rules and Regulations Document/ not found")
        else:
            print(f"  Found Rules and Regulations Document/: {rr_id}")

            rr_2026_id = find_folder(drive, rr_id, "2026")
            if not rr_2026_id:
                print("  ERROR: Rules and Regulations Document/2026/ not found")
            else:
                print(f"  Found 2026/: {rr_2026_id}")

                current_id = find_folder(drive, rr_id, "Current")
                if current_id:
                    print(f"  Current/ already exists: {current_id}")
                else:
                    action = {"type": "create_folder", "name": "Current",
                              "parent": "Rules and Regulations Document/"}
                    if DRY_RUN:
                        print("  WOULD CREATE: Rules and Regulations Document/Current/")
                        current_id = "(dry-run)"
                    else:
                        current_id = create_folder(drive, "Current", rr_id)
                        print(f"  CREATED: Current/ ({current_id})")
                        action["created_id"] = current_id
                    log["actions"].append(action)

                # Move 2026 files
                if current_id and current_id != "(dry-run)":
                    files_2026 = list_children(drive, rr_2026_id)
                    for f in files_2026:
                        action = {
                            "type": "move_file",
                            "file_id": f["id"],
                            "file_name": f["name"],
                            "from": "Rules and Regulations Document/2026/",
                            "to": "Rules and Regulations Document/Current/",
                        }
                        if DRY_RUN:
                            print(f"  WOULD MOVE: {f['name']} → Current/")
                        else:
                            move_file(drive, f["id"], rr_2026_id, current_id)
                            print(f"  MOVED: {f['name']} → Current/")
                        log["actions"].append(action)
                elif current_id == "(dry-run)":
                    files_2026 = list_children(drive, rr_2026_id)
                    for f in files_2026:
                        print(f"  WOULD MOVE: {f['name']} → Current/")
                        log["actions"].append({
                            "type": "move_file",
                            "file_id": f["id"],
                            "file_name": f["name"],
                            "from": "Rules and Regulations Document/2026/",
                            "to": "Rules and Regulations Document/Current/",
                        })

    # ── 3. Rename Final/ → Policy Source Documents/ ───────────────────────────
    print(f"\n{'─' * 80}")
    print("3. RENAME Final/ → Policy Source Documents/")
    print(f"{'─' * 80}\n")

    if pp_id:
        final_id = find_folder(drive, pp_id, "Final")
        if not final_id:
            print("  Final/ not found (may already be renamed)")
        else:
            print(f"  Found Final/: {final_id}")
            action = {
                "type": "rename_folder",
                "folder_id": final_id,
                "old_name": "Final",
                "new_name": "Policy Source Documents",
            }
            if DRY_RUN:
                print("  WOULD RENAME: Final/ → Policy Source Documents/")
            else:
                rename_folder(drive, final_id, "Policy Source Documents")
                print("  RENAMED: Final/ → Policy Source Documents/")
            log["actions"].append(action)

    # ── 4. Rename Z_Downloaded Stuff to Remove/ ──────────────────────────────
    print(f"\n{'─' * 80}")
    print("4. RENAME Z_Archive/Z_Downloaded Stuff to Remove/")
    print(f"{'─' * 80}\n")

    z_archive_id = find_folder(drive, SHARED_DRIVE_ID, "Z_Archive")
    if not z_archive_id:
        print("  Z_Archive/ not found")
    else:
        old_name = "Z_Downloaded Stuff to Remove"
        z_download_id = find_folder(drive, z_archive_id, old_name)
        if not z_download_id:
            print(f"  '{old_name}' not found (may already be renamed)")
        else:
            new_name = "Reviewed - Legacy Downloads (2013-2019)"
            print(f"  Found: {old_name} ({z_download_id})")
            action = {
                "type": "rename_folder",
                "folder_id": z_download_id,
                "old_name": old_name,
                "new_name": new_name,
            }
            if DRY_RUN:
                print(f"  WOULD RENAME: {old_name} → {new_name}")
            else:
                rename_folder(drive, z_download_id, new_name)
                print(f"  RENAMED: → {new_name}")
            log["actions"].append(action)

    # ── Summary ───────────────────────────────────────────────────────────────
    create_count = sum(1 for a in log["actions"] if a["type"] == "create_folder")
    move_count = sum(1 for a in log["actions"] if a["type"] == "move_file")
    rename_count = sum(1 for a in log["actions"] if a["type"] == "rename_folder")

    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"  Folders to create:  {create_count}")
    print(f"  Files to move:      {move_count}")
    print(f"  Folders to rename:  {rename_count}")
    if DRY_RUN:
        print(f"\n  This was a DRY RUN. Re-run with --execute to apply changes.")

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"\n  Log written to {LOG_FILE}")


if __name__ == "__main__":
    main()
