#!/usr/bin/env python3
"""
Reorganize step 2: Move files into Current/ folders.

Implements the "Current folder" pattern:
  Governing Documents/Bylaws/Current/         ← current bylaws
  Governing Documents/Covenants/Current/      ← current covenants + amendment
  Committees/ARC Design Guidelines/Current/   ← current ARC guidelines

Also cleans up empty folders and stale shortcuts from the earlier run.

Usage:
  python reorganize_moves.py             # dry-run (default)
  python reorganize_moves.py --execute   # perform changes
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, SHARED_DRIVE_ID

DRY_RUN = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/reorganize_moves_log.json"

# ─── Files to move (all PROTECTED website-linked IDs) ────────────────────────

MOVES = [
    {
        "file_id": "1bjoZLU2hAVZOpMo2VJwNZzP73zXLS3_L",
        "file_name": "ByLaws.Current",
        "dest_folder_path": "Governing Documents > Bylaws > Current",
    },
    {
        "file_id": "1w0QpFQHc9zQlORNKxdSSvyo3L-g4rAin",
        "file_name": "Covenants.Current",
        "dest_folder_path": "Governing Documents > Covenants > Current",
    },
    {
        "file_id": "18CbXaVwhasENdTlsaMGigOeHRdCPoRfO",
        "file_name": "Amendment 1 to Declaration of Covenants...",
        "dest_folder_path": "Governing Documents > Covenants > Current",
    },
    {
        "file_id": "1aX1kP741jWARBx3tU5KXWiCtnzm3OSpG",
        "file_name": "ARC Design Guidelines (2025.9a).pdf",
        "dest_folder_path": "Committees > ARC Design Guidelines > Current",
    },
]

# ─── Empty folders to trash (created in error by previous run) ────────────────

TRASH_FOLDERS = [
    ("14zIcljiU4DzdxcQdfSPwhd1kyB6aYCoh", "Bylaws Archive (at root — wrong)"),
    ("1-mvWNTU2PJ-RpKzLjdmN0wcEsYGSbGrV", "Current Bylaws (under Gov Docs — wrong level)"),
    ("1tyBlVAwo8lKgxt4eEt5CRY3ilc9sjz20", "Current Covenants (under Gov Docs — wrong level)"),
    ("1B6zF3_QXcY_xoY5ZCr-y8_ukZlFxpFG3", "Current ARC Guidelines (under Gov Docs — wrong level)"),
]

# ─── Stale shortcuts to trash ────────────────────────────────────────────────

TRASH_SHORTCUTS = [
    ("1cXcnU6_vBFGhzV0CokYC5Jirwcl_FkDV", "Current Bylaws shortcut in Governing Documents/"),
    ("1VqJqUBePw3p4sXE3ioxFdP8kBAXIW0ID", "Current Coventants shortcut in Governing Documents/"),
    ("1vCZH4fY_8iDBR7icuiLvGg4HCqKpzCNQ", "Current Bylaws shortcut in Bylaws/2025 Bylaws/"),
]

# ─── Stale file to trash ─────────────────────────────────────────────────────

TRASH_FILES = [
    ("1VXi66Dn9ZmEzJL-2NOLqHv-aNK1fAJVX", "ARC Design Guidelines (current).pdf in Governing Documents/ (old copy)"),
]


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
        q=q, corpora="drive", driveId=SHARED_DRIVE_ID,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id, name)", pageSize=5,
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
        body=metadata, supportsAllDrives=True, fields="id",
    ).execute()
    return f["id"]


def get_file_info(drive, file_id):
    """Get a file's name and parent."""
    f = drive.files().get(
        fileId=file_id, supportsAllDrives=True,
        fields="id, name, parents, mimeType, trashed",
    ).execute()
    return f


def move_file(drive, file_id, old_parent_id, new_parent_id):
    """Move a file from one parent to another (preserves file ID)."""
    drive.files().update(
        fileId=file_id,
        addParents=new_parent_id,
        removeParents=old_parent_id,
        supportsAllDrives=True,
        fields="id",
    ).execute()


def trash_file(drive, file_id):
    """Trash a file (recoverable)."""
    drive.files().update(
        fileId=file_id, body={"trashed": True},
        supportsAllDrives=True, fields="id",
    ).execute()


def resolve_folder_path(drive, path_str):
    """Resolve 'A > B > C' to a folder ID, creating C if needed.

    Returns (folder_id, created_new).
    """
    parts = [p.strip() for p in path_str.split(">")]
    parent_id = SHARED_DRIVE_ID

    for i, part in enumerate(parts[:-1]):
        folder_id = find_folder(drive, parent_id, part)
        if not folder_id:
            raise RuntimeError(f"Could not find folder '{part}' under parent {parent_id}")
        parent_id = folder_id

    # Last part: find or create
    target_name = parts[-1]
    existing = find_folder(drive, parent_id, target_name)
    if existing:
        return existing, False
    return parent_id, True  # return parent so caller can create


def main():
    drive = get_drive_service()
    log = {"timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN, "actions": []}

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'=' * 70}")
    print(f"REORGANIZE MOVES — {mode}")
    print(f"{'=' * 70}\n")

    if not DRY_RUN:
        print("*** LIVE MODE — changes will be made ***\n")

    # ── Step 1: Create Current/ folders and move files ──
    print(f"{'─' * 70}")
    print("FILE MOVES (into Current/ folders)")
    print(f"{'─' * 70}\n")

    # Resolve destination folders (create Current/ if needed)
    dest_cache = {}  # path_str -> folder_id
    for move in MOVES:
        path = move["dest_folder_path"]
        if path in dest_cache:
            continue

        parts = [p.strip() for p in path.split(">")]
        parent_id = SHARED_DRIVE_ID
        for part in parts[:-1]:
            fid = find_folder(drive, parent_id, part)
            if not fid:
                print(f"  ERROR: Cannot find '{part}' — aborting")
                sys.exit(1)
            parent_id = fid

        target_name = parts[-1]
        existing = find_folder(drive, parent_id, target_name)
        if existing:
            print(f"  Folder exists: {path} ({existing})")
            dest_cache[path] = existing
        else:
            if DRY_RUN:
                print(f"  WOULD CREATE: {path}")
                dest_cache[path] = f"(new-{target_name})"
            else:
                new_id = create_folder(drive, target_name, parent_id)
                print(f"  CREATED: {path} ({new_id})")
                dest_cache[path] = new_id
            log["actions"].append({
                "type": "create_folder",
                "path": path,
                "parent": parent_id,
                "name": target_name,
            })

    print()

    # Move files
    for move in MOVES:
        file_id = move["file_id"]
        dest_path = move["dest_folder_path"]
        dest_id = dest_cache[dest_path]

        info = get_file_info(drive, file_id)
        if info.get("trashed"):
            print(f"  SKIP (trashed): {info['name']} ({file_id[:16]}...)")
            continue

        old_parent = info.get("parents", [None])[0]
        action = {
            "type": "move_file",
            "file_id": file_id,
            "file_name": info["name"],
            "from_parent": old_parent,
            "to_folder": dest_path,
        }

        if DRY_RUN:
            print(f"  WOULD MOVE: {info['name']}")
            print(f"    → {dest_path}")
        else:
            move_file(drive, file_id, old_parent, dest_id)
            print(f"  MOVED: {info['name']}")
            print(f"    → {dest_path}")
        log["actions"].append(action)

    # ── Step 2: Trash wrong empty folders ──
    print(f"\n{'─' * 70}")
    print("TRASH EMPTY FOLDERS (created in error)")
    print(f"{'─' * 70}\n")

    for folder_id, reason in TRASH_FOLDERS:
        try:
            info = get_file_info(drive, folder_id)
            if info.get("trashed"):
                print(f"  Already trashed: {reason}")
                continue
        except Exception:
            print(f"  Not found: {reason}")
            continue

        action = {"type": "trash_folder", "id": folder_id, "reason": reason}
        if DRY_RUN:
            print(f"  WOULD TRASH: {reason}")
        else:
            trash_file(drive, folder_id)
            print(f"  TRASHED: {reason}")
        log["actions"].append(action)

    # ── Step 3: Trash stale shortcuts ──
    print(f"\n{'─' * 70}")
    print("TRASH STALE SHORTCUTS")
    print(f"{'─' * 70}\n")

    for sc_id, reason in TRASH_SHORTCUTS:
        try:
            info = get_file_info(drive, sc_id)
            if info.get("trashed"):
                print(f"  Already trashed: {reason}")
                continue
        except Exception:
            print(f"  Not found: {reason}")
            continue

        action = {"type": "trash_shortcut", "id": sc_id, "reason": reason}
        if DRY_RUN:
            print(f"  WOULD TRASH: {reason}")
        else:
            trash_file(drive, sc_id)
            print(f"  TRASHED: {reason}")
        log["actions"].append(action)

    # ── Step 4: Trash stale files ──
    print(f"\n{'─' * 70}")
    print("TRASH STALE FILES")
    print(f"{'─' * 70}\n")

    for f_id, reason in TRASH_FILES:
        try:
            info = get_file_info(drive, f_id)
            if info.get("trashed"):
                print(f"  Already trashed: {reason}")
                continue
        except Exception:
            print(f"  Not found: {reason}")
            continue

        action = {"type": "trash_file", "id": f_id, "reason": reason}
        if DRY_RUN:
            print(f"  WOULD TRASH: {reason}")
        else:
            trash_file(drive, f_id)
            print(f"  TRASHED: {reason}")
        log["actions"].append(action)

    # ── Summary ──
    from collections import Counter
    counts = Counter(a["type"] for a in log["actions"])
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    for action_type, count in counts.most_common():
        print(f"  {action_type}: {count}")
    if DRY_RUN:
        print(f"\n  This was a DRY RUN. Re-run with --execute to apply.")

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"\n  Log: {LOG_FILE}")


if __name__ == "__main__":
    main()
