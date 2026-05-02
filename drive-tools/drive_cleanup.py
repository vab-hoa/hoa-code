#!/usr/bin/env python3
"""
Stage 4: Drive Structural Cleanup — organize Projects/ and standardize Contracts/.

Actions:
  1. Create Projects/Active/ and Projects/Archive/
  2. Move completed project years (2020, 2021, 2022) to Archive/
  3. Move current project years (2025, 2026) to Active/
  4. Standardize Contracts/ subfolder naming to YYYY-YYYY format

Usage:
  python drive_cleanup.py             # dry-run (default)
  python drive_cleanup.py --execute   # perform changes
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, SHARED_DRIVE_ID

DRY_RUN = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/cleanup_log.json"

# Years to archive (completed projects)
ARCHIVE_YEARS = {"2020", "2021", "2022"}
# Years to keep active
ACTIVE_YEARS = {"2025", "2026"}

# Contracts subfolder renames: old_name -> new_name
# Standardize to YYYY-YYYY format
CONTRACTS_RENAMES = {
    "2019-20": "2019-2020",
}


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


def list_subfolders(drive, parent_id):
    """List immediate subfolders of a parent."""
    q = (
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
        pageSize=200,
    ).execute()
    return resp.get("files", [])


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


def move_folder(drive, folder_id, old_parent_id, new_parent_id):
    """Move a folder from one parent to another."""
    drive.files().update(
        fileId=folder_id,
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


def main():
    drive = get_drive_service()
    log = {"timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN, "actions": []}

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'=' * 80}")
    print(f"STAGE 4: DRIVE STRUCTURAL CLEANUP — {mode}")
    print(f"{'=' * 80}\n")

    if not DRY_RUN:
        print("*** LIVE MODE — changes will be made to the shared drive ***\n")

    # ── 1. Projects/ reorganization ───────────────────────────────────────────
    print(f"{'─' * 80}")
    print("1. PROJECTS/ — ACTIVE vs ARCHIVE")
    print(f"{'─' * 80}\n")

    projects_id = find_folder(drive, SHARED_DRIVE_ID, "Projects")
    if not projects_id:
        print("  ERROR: Projects/ not found")
    else:
        print(f"  Found Projects/: {projects_id}")
        subfolders = list_subfolders(drive, projects_id)
        year_folders = {f["name"]: f["id"] for f in subfolders
                        if f["name"].isdigit() and len(f["name"]) == 4}
        print(f"  Year folders found: {sorted(year_folders.keys())}")

        # Create Active/ and Archive/
        for folder_name in ["Active", "Archive"]:
            existing = find_folder(drive, projects_id, folder_name)
            if existing:
                print(f"  {folder_name}/ already exists: {existing}")
                if folder_name == "Active":
                    active_id = existing
                else:
                    archive_id = existing
            else:
                action = {"type": "create_folder", "name": folder_name,
                          "parent": "Projects/"}
                if DRY_RUN:
                    print(f"  WOULD CREATE: Projects/{folder_name}/")
                    if folder_name == "Active":
                        active_id = "(dry-run)"
                    else:
                        archive_id = "(dry-run)"
                else:
                    new_id = create_folder(drive, folder_name, projects_id)
                    print(f"  CREATED: Projects/{folder_name}/ ({new_id})")
                    action["created_id"] = new_id
                    if folder_name == "Active":
                        active_id = new_id
                    else:
                        archive_id = new_id
                log["actions"].append(action)

        # Move archive years
        for year in sorted(ARCHIVE_YEARS):
            if year not in year_folders:
                print(f"  {year}/ not found, skipping")
                continue
            folder_id = year_folders[year]
            action = {
                "type": "move_folder",
                "folder_name": year,
                "folder_id": folder_id,
                "from": "Projects/",
                "to": "Projects/Archive/",
            }
            if DRY_RUN:
                print(f"  WOULD MOVE: Projects/{year}/ → Projects/Archive/{year}/")
            else:
                move_folder(drive, folder_id, projects_id, archive_id)
                print(f"  MOVED: Projects/{year}/ → Projects/Archive/{year}/")
            log["actions"].append(action)

        # Move active years
        for year in sorted(ACTIVE_YEARS):
            if year not in year_folders:
                print(f"  {year}/ not found, skipping")
                continue
            folder_id = year_folders[year]
            action = {
                "type": "move_folder",
                "folder_name": year,
                "folder_id": folder_id,
                "from": "Projects/",
                "to": "Projects/Active/",
            }
            if DRY_RUN:
                print(f"  WOULD MOVE: Projects/{year}/ → Projects/Active/{year}/")
            else:
                move_folder(drive, folder_id, projects_id, active_id)
                print(f"  MOVED: Projects/{year}/ → Projects/Active/{year}/")
            log["actions"].append(action)

    # ── 2. Contracts/ naming standardization ──────────────────────────────────
    print(f"\n{'─' * 80}")
    print("2. CONTRACTS/ — STANDARDIZE NAMING")
    print(f"{'─' * 80}\n")

    contracts_id = find_folder(drive, SHARED_DRIVE_ID, "Contracts")
    if not contracts_id:
        print("  ERROR: Contracts/ not found")
    else:
        print(f"  Found Contracts/: {contracts_id}")

        # Find all vendor subfolders
        vendor_folders = list_subfolders(drive, contracts_id)

        for vendor in sorted(vendor_folders, key=lambda f: f["name"]):
            vendor_id = vendor["id"]
            vendor_name = vendor["name"]
            date_folders = list_subfolders(drive, vendor_id)

            for df in date_folders:
                old_name = df["name"]
                if old_name in CONTRACTS_RENAMES:
                    new_name = CONTRACTS_RENAMES[old_name]
                    action = {
                        "type": "rename_folder",
                        "folder_id": df["id"],
                        "old_name": f"Contracts/{vendor_name}/{old_name}",
                        "new_name": f"Contracts/{vendor_name}/{new_name}",
                    }
                    if DRY_RUN:
                        print(f"  WOULD RENAME: Contracts/{vendor_name}/{old_name} → {new_name}")
                    else:
                        rename_folder(drive, df["id"], new_name)
                        print(f"  RENAMED: Contracts/{vendor_name}/{old_name} → {new_name}")
                    log["actions"].append(action)

    # ── Summary ───────────────────────────────────────────────────────────────
    create_count = sum(1 for a in log["actions"] if a["type"] == "create_folder")
    move_count = sum(1 for a in log["actions"] if a["type"] == "move_folder")
    rename_count = sum(1 for a in log["actions"] if a["type"] == "rename_folder")

    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"  Folders to create:  {create_count}")
    print(f"  Folders to move:    {move_count}")
    print(f"  Folders to rename:  {rename_count}")
    if DRY_RUN:
        print(f"\n  This was a DRY RUN. Re-run with --execute to apply changes.")

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"\n  Log written to {LOG_FILE}")


if __name__ == "__main__":
    main()
