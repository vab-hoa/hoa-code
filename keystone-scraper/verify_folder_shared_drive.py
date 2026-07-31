#!/usr/bin/env python3
"""List items in a shared drive folder with correct parameters"""

import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
SCOPES = ['https://www.googleapis.com/auth/drive']

FOLDER_ID = "1MUlUcjTZ506AOifBThfuzhZmViUbHW2Q"  # Financials
SHARED_DRIVE_ID = "0ALIbXXUEyG4GUk9PVA"  # VaB Homeowner Documents

credentials = service_account.Credentials.from_service_account_file(CREDS_PATH, scopes=SCOPES)
delegated = credentials.with_subject('admin@villasboulders.org')
drive = build('drive', 'v3', credentials=delegated)

print(f"Listing items in Financials folder (on shared drive)...\n")

# Query with shared drive parameters
query = f"'{FOLDER_ID}' in parents and trashed=false"

results = drive.files().list(
    q=query,
    spaces='drive',
    pageSize=50,
    corpora='drive',
    driveId=SHARED_DRIVE_ID,
    includeItemsFromAllDrives=True,
    supportsAllDrives=True,
    fields='files(id, name, mimeType)'
).execute()

items = results.get('files', [])
print(f"Found {len(items)} items:\n")

for item in sorted(items, key=lambda x: x['name']):
    item_type = "📁" if 'folder' in item['mimeType'] else "📄"
    print(f"  {item_type} {item['name']} (ID: {item['id']})")
