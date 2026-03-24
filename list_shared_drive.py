#!/usr/bin/env python3
"""List all files on the VaB Board Documents shared drive, with folder paths."""

from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_FILE = "/home/dee/.config/openclaw/google-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]
SUBJECT = "admin@villasboulders.org"
SHARED_DRIVE_ID = "0AExYZWmfRm9JUk9PVA"


def get_service():
    creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject(SUBJECT)
    return build("drive", "v3", credentials=delegated)


def list_all_files(drive):
    """List all files on the shared drive."""
    files = []
    page_token = None
    while True:
        resp = drive.files().list(
            corpora="drive",
            driveId=SHARED_DRIVE_ID,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            fields="nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, trashed)",
            pageSize=200,
            q="trashed = false",
            pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def build_folder_map(files):
    """Build a map of folder ID -> name."""
    folders = {}
    for f in files:
        if f["mimeType"] == "application/vnd.google-apps.folder":
            folders[f["id"]] = f["name"]
    # Also add the drive root
    folders[SHARED_DRIVE_ID] = "(root)"
    return folders


def get_path(file, folders):
    """Get the folder path for a file."""
    parents = file.get("parents", [])
    if not parents:
        return "(root)"
    parts = []
    pid = parents[0]
    seen = set()
    while pid and pid not in seen:
        seen.add(pid)
        if pid in folders:
            name = folders[pid]
            if name == "(root)":
                break
            parts.insert(0, name)
            # We don't have parent-of-parent in our data easily,
            # so we'd need another lookup. For now, just show immediate parent.
            break
        else:
            parts.insert(0, f"?{pid[:8]}")
            break
    return "/".join(parts) if parts else "(root)"


def main():
    drive = get_service()
    print("Fetching all files from VaB Board Documents shared drive...\n")
    files = list_all_files(drive)
    folders = build_folder_map(files)

    # Group by folder
    by_folder = {}
    for f in files:
        if f["mimeType"] == "application/vnd.google-apps.folder":
            continue
        folder = get_path(f, folders)
        by_folder.setdefault(folder, []).append(f)

    print(f"Total files (non-folder): {sum(len(v) for v in by_folder.values())}")
    print(f"Total folders: {len(folders) - 1}")
    print()

    for folder in sorted(by_folder.keys()):
        print(f"\n📁 {folder}/")
        for f in sorted(by_folder[folder], key=lambda x: x["name"]):
            created = f.get("createdTime", "?")[:10]
            modified = f.get("modifiedTime", "?")[:10]
            print(f"  {f['id']}  {created}  {f['name']}")


if __name__ == "__main__":
    main()
