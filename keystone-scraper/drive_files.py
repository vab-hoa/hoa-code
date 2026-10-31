"""Google Drive helpers shared by the Keystone jobs (shared drives, as admin@ via delegation).

Every call goes through sheets_retry.retry_sheets_call (backoff on 429/5xx).
Updating a file in place keeps its file ID, so links on the website and in documents
keep working; that's why the document syncs track Drive file IDs, never just names.
"""
import io
import os

from sheets_retry import retry_sheets_call

CREDENTIALS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
DELEGATED_USER = "admin@villasboulders.org"
FOLDER_MIME = "application/vnd.google-apps.folder"


def drive_service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/drive"])
    return build("drive", "v3", credentials=creds.with_subject(DELEGATED_USER), cache_discovery=False)


def _q(value):
    """Escape a value for a Drive query string."""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def list_children(drive, folder_id, folders=False):
    """Non-trashed files (or folders) directly in a folder: [{id, name, size, modifiedTime}]."""
    kind = "=" if folders else "!="
    query = f"'{folder_id}' in parents and trashed = false and mimeType {kind} '{FOLDER_MIME}'"
    items, token = [], None
    while True:
        resp = retry_sheets_call(lambda: drive.files().list(
            q=query, corpora="allDrives", includeItemsFromAllDrives=True, supportsAllDrives=True,
            fields="nextPageToken, files(id, name, size, modifiedTime)", pageSize=200,
            pageToken=token).execute())
        items.extend(resp.get("files", []))
        token = resp.get("nextPageToken")
        if not token:
            return items


def find_child(drive, folder_id, name, folder=False):
    """ID of the child with this exact name, or None."""
    kind = "=" if folder else "!="
    query = (f"name = '{_q(name)}' and '{folder_id}' in parents and trashed = false "
             f"and mimeType {kind} '{FOLDER_MIME}'")
    found = retry_sheets_call(lambda: drive.files().list(
        q=query, corpora="allDrives", includeItemsFromAllDrives=True, supportsAllDrives=True,
        fields="files(id)").execute()).get("files", [])
    return found[0]["id"] if found else None


def find_or_create_folder(drive, name, parent_id):
    existing = find_child(drive, parent_id, name, folder=True)
    if existing:
        return existing
    return retry_sheets_call(lambda: drive.files().create(
        body={"name": name, "mimeType": FOLDER_MIME, "parents": [parent_id]},
        supportsAllDrives=True, fields="id").execute())["id"]


def file_exists(drive, file_id):
    """True if the file exists and isn't trashed."""
    from googleapiclient.errors import HttpError
    try:
        meta = retry_sheets_call(lambda: drive.files().get(
            fileId=file_id, fields="id, trashed", supportsAllDrives=True).execute())
    except HttpError as e:
        if e.resp.status == 404:
            return False
        raise
    return not meta.get("trashed", False)


def _media(data, mimetype):
    from googleapiclient.http import MediaIoBaseUpload
    return MediaIoBaseUpload(io.BytesIO(data), mimetype=mimetype or "application/octet-stream",
                             resumable=False)


def create_file(drive, folder_id, name, data, mimetype=None):
    """Create a new file; returns (file_id, web link)."""
    result = retry_sheets_call(lambda: drive.files().create(
        body={"name": name, "parents": [folder_id]}, media_body=_media(data, mimetype),
        supportsAllDrives=True, fields="id, webViewLink").execute())
    return result["id"], result.get("webViewLink", "")


def update_file(drive, file_id, data, mimetype=None):
    """Replace a file's contents in place (same ID, same link, same name); returns the link."""
    result = retry_sheets_call(lambda: drive.files().update(
        fileId=file_id, media_body=_media(data, mimetype), supportsAllDrives=True,
        fields="id, webViewLink").execute())
    return result.get("webViewLink", "")


def file_link(file_id):
    return f"https://drive.google.com/file/d/{file_id}/view"
