"""Shared auth and utilities for drive-tools scripts."""

from google.oauth2 import service_account
from googleapiclient.discovery import build
import base64
from email.mime.text import MIMEText

SA_FILE = "/home/dee/.config/openclaw/google-service-account.json"
SUBJECT = "admin@villasboulders.org"
SHARED_DRIVE_ID = "0AExYZWmfRm9JUk9PVA"  # VaB Board Documents

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
ALERT_RECIPIENT = "admin@villasboulders.org"


def _get_credentials(scopes):
    creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=scopes)
    return creds.with_subject(SUBJECT)


def get_drive_service():
    return build("drive", "v3", credentials=_get_credentials(DRIVE_SCOPES))


def get_gmail_service():
    return build("gmail", "v1", credentials=_get_credentials(GMAIL_SCOPES))


def send_alert_email(subject, body):
    """Send an alert email from admin@villasboulders.org to dee@wmbuck.net."""
    gmail = get_gmail_service()
    msg = MIMEText(body)
    msg["to"] = ALERT_RECIPIENT
    msg["from"] = SUBJECT
    msg["subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    gmail.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()


def list_all_drive_files(drive):
    """List all non-trashed files on the shared drive."""
    files = []
    page_token = None
    while True:
        resp = drive.files().list(
            corpora="drive",
            driveId=SHARED_DRIVE_ID,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            fields="nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, md5Checksum)",
            pageSize=200,
            q="trashed = false",
            pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def check_file_accessible(drive, file_id):
    """Check if a file ID is accessible (not trashed/deleted)."""
    try:
        f = drive.files().get(
            fileId=file_id,
            fields="id,name,trashed",
            supportsAllDrives=True,
        ).execute()
        return not f.get("trashed", False), f.get("name", "")
    except Exception:
        return False, ""
