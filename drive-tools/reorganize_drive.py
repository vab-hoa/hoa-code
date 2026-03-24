#!/usr/bin/env python3
"""
Reorganize the VaB Board Documents shared drive.

- Protects canonical file IDs (the ones the website links to)
- Trashes symlink artifacts (Current.Signed.Policies/ copies, Covenants.Amendment doc)
- Implements "Current folder" pattern for versioned documents
- Deduplicates files by (name, md5Checksum)

Usage:
  python reorganize_drive.py             # dry-run (default)
  python reorganize_drive.py --execute   # perform changes
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, SHARED_DRIVE_ID, list_all_drive_files
from link_fix_report import REPLACEMENTS

DRY_RUN = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/reorganize_log.json"

# ─── Protected IDs: canonical files linked from the website ───────────────────
# These must NEVER be trashed, regardless of deduplication logic.
PROTECTED_IDS = set()
for old_id, (desc, new_id, url_type) in REPLACEMENTS.items():
    if new_id and url_type != "form":  # Google Form IDs aren't Drive files
        PROTECTED_IDS.add(new_id)

# ─── Symlink artifacts to trash by specific ID ───────────────────────────────
# Covenants.Amendment Google Docs are symlink artifacts.
SYMLINK_ARTIFACT_IDS = {
    "1spgSu-R3wVLPzBhvH8t8yqJ8j1TLCPn3",  # Covenants.Amendment (Google Doc, symlink copy)
    "1g5OwINyTZijQO1tfUH5cYjgZHbd4cmtG",  # Covenants.Amendment (duplicate)
}

# ─── Symlink artifact patterns ───────────────────────────────────────────────
# These are rclone-resolved symlinks that should be trashed:
# 1. All files in Current.Signed.Policies/ folder
# 2. All "current.pdf" files under Policies and Procedures/Final/*/
# 3. The "current.do.pdf" file (Directors & Officers symlink)
SYMLINK_ARTIFACT_NAMES = {"current.pdf", "current.do.pdf"}


def build_tree(files):
    """Build folder_id->name map and folder_id->parent_id map."""
    folders = {}
    parent_map = {}
    for f in files:
        fid = f["id"]
        parents = f.get("parents", [])
        parent_map[fid] = parents[0] if parents else None
        if f["mimeType"] == "application/vnd.google-apps.folder":
            folders[fid] = f["name"]
    folders[SHARED_DRIVE_ID] = "(root)"
    return folders, parent_map


def get_full_path(file_id, folders, parent_map, _cache={}):
    """Get full folder path for a file/folder ID."""
    if file_id in _cache:
        return _cache[file_id]
    if file_id == SHARED_DRIVE_ID or file_id not in parent_map:
        return ""
    parent = parent_map.get(file_id)
    if parent is None or parent == SHARED_DRIVE_ID:
        name = folders.get(file_id, file_id)
        _cache[file_id] = name
        return name
    parent_path = get_full_path(parent, folders, parent_map, _cache)
    name = folders.get(file_id, file_id)
    result = f"{parent_path}/{name}" if parent_path else name
    _cache[file_id] = result
    return result


def find_folder_by_name(drive, parent_id, folder_name):
    """Find a folder by name under a parent, or return None."""
    escaped = folder_name.replace("'", "\\'")
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


def trash_file(drive, file_id):
    """Trash a file (recoverable)."""
    drive.files().update(
        fileId=file_id,
        body={"trashed": True},
        supportsAllDrives=True,
        fields="id",
    ).execute()


def find_folder_id_by_name(files, name):
    """Find a folder's ID by exact name from the file list."""
    for f in files:
        if f["mimeType"] == "application/vnd.google-apps.folder" and f["name"] == name:
            return f["id"]
    return None


def find_duplicates(files, folders, parent_map):
    """Find duplicate files by (name, md5Checksum).

    Protected IDs are always kept. Symlink artifact IDs are always trashed.

    Returns:
        duplicates: list of (keep_file, trash_file, reason) tuples
        conflicts: list of (files, reason) — same name, different content
    """
    by_key = {}
    for f in files:
        if f["mimeType"] == "application/vnd.google-apps.folder":
            continue
        md5 = f.get("md5Checksum")
        if not md5:
            continue
        key = (f["name"], md5)
        by_key.setdefault(key, []).append(f)

    duplicates = []
    for key, group in by_key.items():
        if len(group) <= 1:
            continue

        # Sort: protected files first, then by creation time
        def sort_key(f):
            is_protected = f["id"] in PROTECTED_IDS
            return (0 if is_protected else 1, f.get("createdTime", ""))

        group.sort(key=sort_key)
        keep = group[0]

        for dup in group[1:]:
            if dup["id"] in PROTECTED_IDS:
                # Never trash a protected file — even if it looks like a duplicate
                continue
            keep_path = get_full_path(
                parent_map.get(keep["id"], SHARED_DRIVE_ID),
                folders, parent_map
            )
            dup_path = get_full_path(
                parent_map.get(dup["id"], SHARED_DRIVE_ID),
                folders, parent_map
            )
            duplicates.append((
                keep,
                dup,
                f"Exact duplicate (same name + md5). Keep in {keep_path}/, trash from {dup_path}/",
            ))

    # Same-name-different-content conflicts (excluding already-handled symlink artifacts)
    by_name = {}
    for f in files:
        if f["mimeType"] == "application/vnd.google-apps.folder":
            continue
        if f["name"] in SYMLINK_ARTIFACT_NAMES:
            continue  # current.pdf etc. — all symlink artifacts, not real conflicts
        by_name.setdefault(f["name"], []).append(f)

    conflicts = []
    for name, group in by_name.items():
        if len(group) <= 1:
            continue
        md5s = set(f.get("md5Checksum") for f in group if f.get("md5Checksum"))
        if len(md5s) > 1:
            conflicts.append((
                group,
                f"Same name '{name}' but different content ({len(md5s)} variants)",
            ))

    return duplicates, conflicts


def main():
    drive = get_drive_service()
    log = {"timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN, "actions": []}

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'=' * 80}")
    print(f"SHARED DRIVE REORGANIZATION — {mode}")
    print(f"{'=' * 80}\n")

    if not DRY_RUN:
        print("*** LIVE MODE — changes will be made to the shared drive ***\n")

    print(f"Protected IDs (website canonical files): {len(PROTECTED_IDS)}")

    # Fetch all files
    print("Fetching all files from shared drive...")
    files = list_all_drive_files(drive)
    folders, parent_map = build_tree(files)
    non_folders = [f for f in files if f["mimeType"] != "application/vnd.google-apps.folder"]
    print(f"  {len(non_folders)} files, {len(folders) - 1} folders\n")

    # ── Step 1: Find key folders ──
    gov_docs_id = None
    csp_folder_id = None  # Current.Signed.Policies
    for f in files:
        if f["mimeType"] != "application/vnd.google-apps.folder":
            continue
        parent = parent_map.get(f["id"])
        if f["name"] == "Governing Documents" and parent == SHARED_DRIVE_ID:
            gov_docs_id = f["id"]
        if f["name"] == "Current.Signed.Policies":
            csp_folder_id = f["id"]

    if not gov_docs_id:
        print("ERROR: Could not find 'Governing Documents' folder at drive root.")
        sys.exit(1)
    print(f"Found Governing Documents: {gov_docs_id}")
    if csp_folder_id:
        print(f"Found Current.Signed.Policies: {csp_folder_id}")

    # ── Step 2: Trash symlink artifacts ──
    print(f"\n{'─' * 80}")
    print("SYMLINK ARTIFACT CLEANUP")
    print(f"{'─' * 80}\n")

    # Track all IDs we mark as symlink artifacts (to avoid double-counting in dedup)
    symlink_trash_ids = set()

    def trash_as_symlink(f, reason):
        """Queue a file for trashing as a symlink artifact."""
        if f["id"] in PROTECTED_IDS:
            print(f"  SKIP (protected): {f['name']} ({f['id'][:12]}...)")
            return
        if f["id"] in symlink_trash_ids:
            return  # already handled
        symlink_trash_ids.add(f["id"])
        action = {
            "type": "trash_symlink_artifact",
            "file_id": f["id"],
            "file_name": f["name"],
            "reason": reason,
        }
        if DRY_RUN:
            print(f"  WOULD TRASH: {f['name']} ({f['id'][:12]}...)")
            print(f"    Reason: {reason}")
        else:
            trash_file(drive, f["id"])
            print(f"  TRASHED: {f['name']} ({f['id'][:12]}...)")
            print(f"    Reason: {reason}")
        log["actions"].append(action)

    # 1. Trash all files in Current.Signed.Policies/ (all symlink copies)
    csp_files = []
    if csp_folder_id:
        for f in files:
            if f["mimeType"] == "application/vnd.google-apps.folder":
                continue
            if parent_map.get(f["id"]) == csp_folder_id:
                csp_files.append(f)

    print(f"Current.Signed.Policies/ — {len(csp_files)} files (all symlink copies)")
    for f in csp_files:
        trash_as_symlink(f, "Current.Signed.Policies/ symlink copy")

    # 2. Trash current.pdf and current.do.pdf under Policies and Procedures/Final/
    #    These are rclone-resolved symlinks that pointed to the current signed version.
    final_folder_id = find_folder_id_by_name(files, "Final")
    current_pdf_count = 0
    if final_folder_id:
        # Find all descendant folders of Final/
        def get_descendant_folders(parent_id):
            descendants = {parent_id}
            for f in files:
                if f["mimeType"] == "application/vnd.google-apps.folder":
                    if parent_map.get(f["id"]) in descendants:
                        descendants.add(f["id"])
            # Iterate again since folders may be nested
            changed = True
            while changed:
                changed = False
                for f in files:
                    if f["mimeType"] == "application/vnd.google-apps.folder":
                        if parent_map.get(f["id"]) in descendants and f["id"] not in descendants:
                            descendants.add(f["id"])
                            changed = True
            return descendants

        final_descendants = get_descendant_folders(final_folder_id)

        for f in files:
            if f["mimeType"] == "application/vnd.google-apps.folder":
                continue
            if f["name"] in SYMLINK_ARTIFACT_NAMES and parent_map.get(f["id"]) in final_descendants:
                parent_path = get_full_path(parent_map.get(f["id"]), folders, parent_map)
                trash_as_symlink(f, f"Symlink artifact ({f['name']} under Final/{parent_path})")
                current_pdf_count += 1

    print(f"\ncurrent.pdf/current.do.pdf under Final/ — {current_pdf_count} files")

    # 3. Trash specific symlink artifact files by ID
    for artifact_id in SYMLINK_ARTIFACT_IDS:
        artifact = next((f for f in files if f["id"] == artifact_id), None)
        if artifact:
            trash_as_symlink(artifact, "Symlink artifact (Google Doc copy)")

    print(f"\nTotal symlink artifacts to trash: {len(symlink_trash_ids)}")

    # ── Step 3: Create Current folders ──
    print(f"\n{'─' * 80}")
    print("FOLDER CREATION")
    print(f"{'─' * 80}\n")

    current_folders = {
        "Current Bylaws": gov_docs_id,
        "Current Covenants": gov_docs_id,
        "Current ARC Guidelines": gov_docs_id,
    }

    reserve_id = find_folder_by_name(drive, SHARED_DRIVE_ID, "Reserve Studies")

    created_folders = {}
    for folder_name, parent_id in current_folders.items():
        existing = find_folder_by_name(drive, parent_id, folder_name)
        if existing:
            print(f"  Folder exists: {folder_name} ({existing})")
            created_folders[folder_name] = existing
        else:
            action = {
                "type": "create_folder",
                "name": folder_name,
                "parent": parent_id,
            }
            if DRY_RUN:
                print(f"  WOULD CREATE: {folder_name} under Governing Documents/")
                created_folders[folder_name] = f"(new-{folder_name})"
            else:
                new_id = create_folder(drive, folder_name, parent_id)
                print(f"  CREATED: {folder_name} ({new_id})")
                created_folders[folder_name] = new_id
                action["created_id"] = new_id
            log["actions"].append(action)

    # Reserve Studies subfolders
    if not reserve_id:
        action = {"type": "create_folder", "name": "Reserve Studies", "parent": SHARED_DRIVE_ID}
        if DRY_RUN:
            print(f"  WOULD CREATE: Reserve Studies at drive root")
            reserve_id = "(new-reserve-studies)"
        else:
            reserve_id = create_folder(drive, "Reserve Studies", SHARED_DRIVE_ID)
            print(f"  CREATED: Reserve Studies ({reserve_id})")
            action["created_id"] = reserve_id
        log["actions"].append(action)
    else:
        print(f"  Found Reserve Studies: {reserve_id}")

    for year in ["2006", "2015", "2022"]:
        can_check = not DRY_RUN or reserve_id != "(new-reserve-studies)"
        existing = find_folder_by_name(drive, reserve_id, year) if can_check else None
        if not existing:
            action = {"type": "create_folder", "name": year, "parent": reserve_id}
            if DRY_RUN:
                print(f"  WOULD CREATE: Reserve Studies/{year}")
            else:
                yr_id = create_folder(drive, year, reserve_id)
                print(f"  CREATED: Reserve Studies/{year} ({yr_id})")
                action["created_id"] = yr_id
            log["actions"].append(action)

    # Bylaws Archive
    archive_id = find_folder_by_name(drive, SHARED_DRIVE_ID, "Bylaws Archive")
    if not archive_id:
        action = {"type": "create_folder", "name": "Bylaws Archive", "parent": SHARED_DRIVE_ID}
        if DRY_RUN:
            print(f"  WOULD CREATE: Bylaws Archive at drive root")
        else:
            archive_id = create_folder(drive, "Bylaws Archive", SHARED_DRIVE_ID)
            print(f"  CREATED: Bylaws Archive ({archive_id})")
            action["created_id"] = archive_id
        log["actions"].append(action)
    else:
        print(f"  Found Bylaws Archive: {archive_id}")

    # ── Step 4: Deduplicate ──
    print(f"\n{'─' * 80}")
    print("DEDUPLICATION ANALYSIS")
    print(f"{'─' * 80}\n")

    duplicates, conflicts = find_duplicates(files, folders, parent_map)

    # Filter out any duplicates we already handled as symlink artifacts
    new_duplicates = [(k, d, r) for k, d, r in duplicates if d["id"] not in symlink_trash_ids]

    print(f"Exact duplicates found: {len(new_duplicates)} (excludes {len(duplicates) - len(new_duplicates)} already handled as symlink artifacts)")
    print(f"Same-name-different-content conflicts: {len(conflicts)}")

    for keep, dup, reason in new_duplicates:
        action = {
            "type": "trash_duplicate",
            "file_id": dup["id"],
            "file_name": dup["name"],
            "reason": reason,
            "kept_id": keep["id"],
        }
        if DRY_RUN:
            print(f"\n  WOULD TRASH: {dup['name']} ({dup['id'][:12]}...)")
            print(f"    Reason: {reason}")
        else:
            trash_file(drive, dup["id"])
            print(f"\n  TRASHED: {dup['name']} ({dup['id'][:12]}...)")
            print(f"    Reason: {reason}")
        log["actions"].append(action)

    if conflicts:
        print(f"\n{'─' * 80}")
        print("CONFLICTS — SAME NAME, DIFFERENT CONTENT (not auto-resolved)")
        print(f"{'─' * 80}")
        for group, reason in conflicts:
            print(f"\n  {reason}")
            for f in group:
                path = get_full_path(
                    parent_map.get(f["id"], SHARED_DRIVE_ID),
                    folders, parent_map
                )
                protected = " [PROTECTED]" if f["id"] in PROTECTED_IDS else ""
                print(f"    {f['id'][:16]}...  {path}/{f['name']}  md5={f.get('md5Checksum', 'n/a')[:12]}...{protected}")
            log["actions"].append({
                "type": "conflict_flagged",
                "reason": reason,
                "files": [{"id": f["id"], "name": f["name"]} for f in group],
            })

    # ── Summary ──
    symlink_count = sum(1 for a in log["actions"] if a["type"] == "trash_symlink_artifact")
    dup_count = sum(1 for a in log["actions"] if a["type"] == "trash_duplicate")
    folder_count = sum(1 for a in log["actions"] if a["type"] == "create_folder")
    conflict_count = sum(1 for a in log["actions"] if a["type"] == "conflict_flagged")

    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"  Protected IDs (never trashed):     {len(PROTECTED_IDS)}")
    print(f"  Symlink artifacts to trash:         {symlink_count}")
    print(f"  Additional duplicates to trash:     {dup_count}")
    print(f"  Folders to create:                  {folder_count}")
    print(f"  Conflicts flagged (manual review):  {conflict_count}")
    print(f"  Total files to trash:               {symlink_count + dup_count}")
    if DRY_RUN:
        print(f"\n  This was a DRY RUN. Re-run with --execute to apply changes.")

    # Write log
    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"\n  Log written to {LOG_FILE}")


if __name__ == "__main__":
    main()
