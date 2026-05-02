#!/usr/bin/env python3
"""
Rebuild Homeowner Documents shared drive with actual files.

The drive currently has 261 shortcuts pointing to Board Documents files that
no longer exist at those IDs. This script:
  1. Trashes all shortcuts in Homeowner Documents
  2. Copies actual files from Board Documents into each section

Sources for each section:
  Budgets, Financials, Forms, Insurance, Maps, Policies, Projects,
  Reserve Studies   — from Board Docs/Homeowner Documents/[section]/
  Meetings          — PDFs from Board Docs/Meetings/YEAR/ roots (not subfolders)
  Newsletters       — PDFs from Board Docs/Communications/Monthly Updates/
  Governing Docs    — 6 specific current files from Board Docs

Exclusions (board-private, already removed):
  Insurance/2022-2023
  Maps/Rock Point/Pictures
  Maps/Rock Point/Rock Point Neighborhood Mailing List

Usage:
  python rebuild_homeowner_docs.py             # dry-run (default)
  python rebuild_homeowner_docs.py --execute   # perform changes
"""

import json
import sys
from datetime import datetime
from config import get_drive_service, SHARED_DRIVE_ID, HOMEOWNER_DRIVE_ID

DRY_RUN  = "--execute" not in sys.argv
LOG_FILE = "/home/dee/hoa-code/drive-tools/rebuild_homeowner_log.json"

# Board-private paths to skip when copying Maps and Insurance
SKIP_PATHS = {
    "Insurance":  {"2022-2023"},
    "Maps":       set(),  # Rock Point sub-items not present in nested source folder
    "Maps/Rock Point": {"Pictures", "Rock Point Neighborhood Mailing List"},
}

# Forms subfolders that are board-only
SKIP_FORMS = {"Old Signing Instruction Stuff", "Statement of Interest to Join Board"}


def find_folder(drive, parent_id, name, drive_id):
    if not parent_id or parent_id.startswith("DRY_"):
        return None
    escaped = name.replace("'", "\\'")
    resp = drive.files().list(
        q=f"name='{escaped}' and '{parent_id}' in parents and "
          f"mimeType='application/vnd.google-apps.folder' and trashed=false",
        corpora="drive", driveId=drive_id,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id,name)", pageSize=5,
    ).execute()
    files = resp.get("files", [])
    return files[0]["id"] if files else None


def find_or_create_folder(drive, parent_id, name):
    if DRY_RUN:
        return f"DRY_{name}", True
    existing = find_folder(drive, parent_id, name, HOMEOWNER_DRIVE_ID)
    if existing:
        return existing, False
    result = drive.files().create(
        body={"name": name, "mimeType": "application/vnd.google-apps.folder",
              "parents": [parent_id]},
        supportsAllDrives=True, fields="id",
    ).execute()
    return result["id"], True


def list_children(drive, parent_id, drive_id):
    resp = drive.files().list(
        q=f"'{parent_id}' in parents and trashed=false",
        corpora="drive", driveId=drive_id,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id,name,mimeType,shortcutDetails)", pageSize=200,
    ).execute()
    return resp.get("files", [])


def trash_item(drive, item_id):
    drive.files().update(
        fileId=item_id, body={"trashed": True},
        supportsAllDrives=True, fields="id",
    ).execute()


def copy_file(drive, file_id, dest_parent_id, name):
    result = drive.files().copy(
        fileId=file_id,
        body={"name": name, "parents": [dest_parent_id]},
        supportsAllDrives=True, fields="id",
    ).execute()
    return result["id"]


def find_file_by_name(drive, parent_id, name, drive_id):
    escaped = name.replace("'", "\\'")
    resp = drive.files().list(
        q=f"name='{escaped}' and '{parent_id}' in parents and "
          f"mimeType!='application/vnd.google-apps.folder' and trashed=false",
        corpora="drive", driveId=drive_id,
        includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id,name)", pageSize=5,
    ).execute()
    files = resp.get("files", [])
    return files[0]["id"] if files else None


# ── Phase 1: trash all shortcuts ───────────────────────────────────────────────

def collect_shortcuts(drive, parent_id, result):
    children = list_children(drive, parent_id, HOMEOWNER_DRIVE_ID)
    for f in children:
        if f["mimeType"] == "application/vnd.google-apps.shortcut":
            result.append((f["id"], f["name"]))
        elif f["mimeType"] == "application/vnd.google-apps.folder":
            collect_shortcuts(drive, f["id"], result)


def phase1_trash_shortcuts(drive, log):
    print(f"\n{'='*70}")
    print(f"  PHASE 1: Trash all shortcuts")
    print(f"{'='*70}")

    shortcuts = []
    collect_shortcuts(drive, HOMEOWNER_DRIVE_ID, shortcuts)
    print(f"  Found {len(shortcuts)} shortcuts")

    for sc_id, sc_name in shortcuts:
        if DRY_RUN:
            pass  # just count
        else:
            trash_item(drive, sc_id)
        log["shortcuts_trashed"].append({"id": sc_id, "name": sc_name})

    action = "WOULD TRASH" if DRY_RUN else "TRASHED"
    print(f"  {action}: {len(shortcuts)} shortcuts")


# ── Phase 2: copy files section by section ────────────────────────────────────

# Subfolders to skip based on the path they appear in
PATH_SKIP_RULES = {
    "Maps/Rock Point": {"Pictures", "Rock Point Neighborhood Mailing List"},
}


def copy_tree(drive, src_id, src_drive, dest_id, path, skip_names, pdf_only, log):
    """Recursively copy files from src to dest, skipping named subfolders."""
    children = list_children(drive, src_id, src_drive)
    path_specific_skips = PATH_SKIP_RULES.get(path, set())

    for f in children:
        name = f["name"]
        mime = f["mimeType"]

        if mime == "application/vnd.google-apps.folder":
            if name in skip_names or name in path_specific_skips:
                print(f"    SKIP (board-private): {path}/{name}/")
                continue
            dest_subfolder_id, created = find_or_create_folder(drive, dest_id, name)
            if created:
                log["folders_created"].append(f"{path}/{name}/")
            copy_tree(drive, f["id"], src_drive, dest_subfolder_id,
                      f"{path}/{name}", skip_names, pdf_only, log)
        else:
            if pdf_only and not name.lower().endswith(".pdf"):
                continue
            if DRY_RUN:
                print(f"    WOULD COPY: {path}/{name}")
            else:
                copy_file(drive, f["id"], dest_id, name)
                print(f"    COPIED: {path}/{name}")
            log["files_copied"].append(f"{path}/{name}")


def copy_section(drive, label, src_path_parts, src_drive, dest_folder_name,
                 skip_names, pdf_only, log):
    print(f"\n{'─'*70}")
    print(f"  {label}")
    print(f"{'─'*70}")

    # Navigate to source
    src_id = src_drive  # start at drive root
    for part in src_path_parts:
        src_id = find_folder(drive, src_id, part, src_drive)
        if not src_id:
            print(f"  ⚠ Source folder not found: {'/'.join(src_path_parts)}")
            return

    # Find destination in Homeowner Docs
    dest_id = find_folder(drive, HOMEOWNER_DRIVE_ID, dest_folder_name, HOMEOWNER_DRIVE_ID)
    if not dest_id:
        dest_id, _ = find_or_create_folder(drive, HOMEOWNER_DRIVE_ID, dest_folder_name)

    copy_tree(drive, src_id, src_drive, dest_id,
              dest_folder_name, skip_names, pdf_only, log)


def copy_meetings_pdfs(drive, log):
    """Copy published-minutes PDFs from Board Docs/Meetings/YEAR/ roots."""
    print(f"\n{'─'*70}")
    print(f"  Meetings — published PDFs only")
    print(f"{'─'*70}")

    mtg_src = find_folder(drive, SHARED_DRIVE_ID, "Meetings", SHARED_DRIVE_ID)
    mtg_dest = find_folder(drive, HOMEOWNER_DRIVE_ID, "Meetings", HOMEOWNER_DRIVE_ID)
    if not mtg_src or not mtg_dest:
        print("  ⚠ Meetings folder not found")
        return

    # Year subfolders
    years = [f for f in list_children(drive, mtg_src, SHARED_DRIVE_ID)
             if f["mimeType"] == "application/vnd.google-apps.folder"]

    for yr in sorted(years, key=lambda x: x["name"]):
        yr_name = yr["name"]
        yr_src_id = yr["id"]
        yr_dest_id, created = find_or_create_folder(drive, mtg_dest, yr_name)
        if created:
            log["folders_created"].append(f"Meetings/{yr_name}/")

        # Copy only non-folder files (the published PDFs) — skip all subfolders
        items = list_children(drive, yr_src_id, SHARED_DRIVE_ID)
        pdfs = [f for f in items
                if f["mimeType"] != "application/vnd.google-apps.folder"
                and f["name"].lower().endswith(".pdf")]
        for pdf in pdfs:
            if DRY_RUN:
                print(f"    WOULD COPY: Meetings/{yr_name}/{pdf['name']}")
            else:
                copy_file(drive, pdf["id"], yr_dest_id, pdf["name"])
                print(f"    COPIED: Meetings/{yr_name}/{pdf['name']}")
            log["files_copied"].append(f"Meetings/{yr_name}/{pdf['name']}")


def copy_newsletters_pdfs(drive, log):
    """Copy newsletter PDFs from Board Docs/Communications/Monthly Updates/YEAR/."""
    print(f"\n{'─'*70}")
    print(f"  Newsletters — PDFs only")
    print(f"{'─'*70}")

    comm = find_folder(drive, SHARED_DRIVE_ID, "Communications", SHARED_DRIVE_ID)
    mu = find_folder(drive, comm, "Monthly Updates", SHARED_DRIVE_ID) if comm else None
    nl_dest = find_folder(drive, HOMEOWNER_DRIVE_ID, "Newsletters", HOMEOWNER_DRIVE_ID)

    if not mu or not nl_dest:
        print("  ⚠ Source or destination not found")
        return

    years = [f for f in list_children(drive, mu, SHARED_DRIVE_ID)
             if f["mimeType"] == "application/vnd.google-apps.folder"
             and f["name"] != "Final PDF"]

    for yr in sorted(years, key=lambda x: x["name"]):
        yr_name = yr["name"]
        items = list_children(drive, yr["id"], SHARED_DRIVE_ID)
        pdfs = [f for f in items
                if f["mimeType"] != "application/vnd.google-apps.folder"
                and f["name"].lower().endswith(".pdf")]
        if not pdfs:
            continue
        yr_dest_id, created = find_or_create_folder(drive, nl_dest, yr_name)
        if created:
            log["folders_created"].append(f"Newsletters/{yr_name}/")
        for pdf in pdfs:
            if DRY_RUN:
                print(f"    WOULD COPY: Newsletters/{yr_name}/{pdf['name']}")
            else:
                copy_file(drive, pdf["id"], yr_dest_id, pdf["name"])
                print(f"    COPIED: Newsletters/{yr_name}/{pdf['name']}")
            log["files_copied"].append(f"Newsletters/{yr_name}/{pdf['name']}")


def copy_governing_docs(drive, log):
    """Copy current governing doc PDFs from their Board Docs locations."""
    print(f"\n{'─'*70}")
    print(f"  Governing Documents — current versions")
    print(f"{'─'*70}")

    gd_dest = find_folder(drive, HOMEOWNER_DRIVE_ID, "Governing Documents", HOMEOWNER_DRIVE_ID)
    if not gd_dest:
        print("  ⚠ Governing Documents folder not found in Homeowner Docs")
        return

    bd_gd = find_folder(drive, SHARED_DRIVE_ID, "Governing Documents", SHARED_DRIVE_ID)
    bd_bylaws = find_folder(drive, bd_gd, "Bylaws", SHARED_DRIVE_ID) if bd_gd else None
    bd_covenants = find_folder(drive, bd_gd, "Covenants", SHARED_DRIVE_ID) if bd_gd else None
    bd_committees = find_folder(drive, SHARED_DRIVE_ID, "Committees", SHARED_DRIVE_ID)
    bd_arc = find_folder(drive, bd_committees, "ARC Design Guidelines", SHARED_DRIVE_ID) if bd_committees else None

    # Files to copy: (source_parent_id, filename, dest_name)
    targets = [
        (bd_bylaws,    "ByLaws.Current",                                          "ByLaws.Current.pdf"),
        (bd_covenants, "Covenants.Current",                                       "Covenants.Current.pdf"),
        (bd_covenants, "Amendment 1 to Declaration of Covenants, Conditions and Restrictions (2022).pdf",
                       "Covenants.Amendment.1.2022.pdf"),
        (bd_covenants, "Articles of Incorporation 2002.pdf",                      "Articles of Incorporation 2002.pdf"),
        (bd_gd,        "Colorado Certificate.pdf",                                "Colorado Certificate.pdf"),
        (bd_arc,       "ARC Design Guidelines (2025.9a).pdf",                     "ARC Design Guidelines (current).pdf"),
    ]

    for src_parent, src_name, dest_name in targets:
        if not src_parent:
            print(f"  ⚠ SKIP {dest_name} — source parent not found")
            continue
        file_id = find_file_by_name(drive, src_parent, src_name, SHARED_DRIVE_ID)
        if not file_id:
            print(f"  ⚠ NOT FOUND: {src_name}")
            continue
        if DRY_RUN:
            print(f"    WOULD COPY: Governing Documents/{dest_name}")
        else:
            copy_file(drive, file_id, gd_dest, dest_name)
            print(f"    COPIED: Governing Documents/{dest_name}")
        log["files_copied"].append(f"Governing Documents/{dest_name}")


def main():
    drive = get_drive_service()
    log = {
        "timestamp": datetime.now().isoformat(), "dry_run": DRY_RUN,
        "shortcuts_trashed": [], "files_copied": [], "folders_created": [],
    }

    mode = "DRY RUN" if DRY_RUN else "EXECUTE"
    print(f"{'='*70}")
    print(f"  REBUILD HOMEOWNER DOCUMENTS — {mode}")
    print(f"{'='*70}")
    if not DRY_RUN:
        print("  *** LIVE MODE — copying files, trashing shortcuts ***")

    # ── Phase 1: trash shortcuts ───────────────────────────────────────────────
    phase1_trash_shortcuts(drive, log)

    # ── Phase 2: copy content ──────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  PHASE 2: Copy files from Board Documents")
    print(f"{'='*70}")

    hod = find_folder(drive, SHARED_DRIVE_ID, "Homeowner Documents", SHARED_DRIVE_ID)

    # Budgets: Board Docs/Budget/ — PDFs only (presentations, not working spreadsheets)
    copy_section(drive, "Budgets — PDFs only",
                 ["Budget"], SHARED_DRIVE_ID,
                 "Budgets", set(), True, log)

    # Financials: Board Docs/Financials/ — all files (Aurora monthly PDFs)
    copy_section(drive, "Financials",
                 ["Financials"], SHARED_DRIVE_ID,
                 "Financials", set(), False, log)

    # Forms: Board Docs/Forms/ — skip board-only subfolders
    copy_section(drive, "Forms",
                 ["Forms"], SHARED_DRIVE_ID,
                 "Forms", SKIP_FORMS, False, log)

    copy_governing_docs(drive, log)

    # Insurance: Board Docs/Insurance/ — skip 2022-2023 (litigation docs)
    copy_section(drive, "Insurance (skipping 2022-2023)",
                 ["Insurance"], SHARED_DRIVE_ID,
                 "Insurance", {"2022-2023"}, False, log)

    # Maps: Board Docs/Maps/ — PATH_SKIP_RULES handles Rock Point private items
    copy_section(drive, "Maps",
                 ["Maps"], SHARED_DRIVE_ID,
                 "Maps", set(), False, log)

    copy_meetings_pdfs(drive, log)

    copy_newsletters_pdfs(drive, log)

    # Policies: nested Homeowner Documents folder — has the 13 canonical PDFs
    copy_section(drive, "Policies — canonical PDFs",
                 ["Homeowner Documents", "Policies"], SHARED_DRIVE_ID,
                 "Policies", set(), False, log)

    # Projects: only the Roofing project docs are homeowner-visible; skip board ops
    print(f"\n{'─'*70}")
    print(f"  Projects — NOTE: Projects/Active is board-internal.")
    print(f"  If roofing or other completed project docs should be here,")
    print(f"  add them manually to Homeowner Documents/Projects/ after this run.")
    print(f"{'─'*70}")

    # Reserve Studies: Board Docs/Reserve Studies/ — all files
    copy_section(drive, "Reserve Studies",
                 ["Reserve Studies"], SHARED_DRIVE_ID,
                 "Reserve Studies", set(), False, log)

    # Root-level files
    print(f"\n{'─'*70}")
    print(f"  Root-level files")
    print(f"{'─'*70}")
    for fname in ["Directors and Officers.pdf", "Policy Directory.pdf"]:
        file_id = find_file_by_name(drive, hod, fname, SHARED_DRIVE_ID) if hod else None
        if file_id:
            if DRY_RUN:
                print(f"    WOULD COPY: {fname}")
            else:
                copy_file(drive, file_id, HOMEOWNER_DRIVE_ID, fname)
                print(f"    COPIED: {fname}")
            log["files_copied"].append(fname)
        else:
            print(f"    NOT FOUND: {fname}")

    # ── Summary ────────────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"  Shortcuts trashed:  {len(log['shortcuts_trashed'])}")
    print(f"  Files copied:       {len(log['files_copied'])}")
    print(f"  Folders created:    {len(log['folders_created'])}")
    if DRY_RUN:
        print(f"\n  DRY RUN — re-run with --execute to apply.")

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"  Log: {LOG_FILE}")


if __name__ == "__main__":
    main()
