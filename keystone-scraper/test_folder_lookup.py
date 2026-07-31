#!/usr/bin/env python3
"""Test: List subfolders in a given Google Drive folder"""

import os
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
SCOPES = ['https://www.googleapis.com/auth/drive']

# Folder to inspect
FOLDER_ID = "1MUlUcjTZ506AOifBThfuzhZmViUbHW2Q"  # Financials

credentials = service_account.Credentials.from_service_account_file(CREDS_PATH, scopes=SCOPES)
delegated = credentials.with_subject('admin@villasboulders.org')
drive = build('drive', 'v3', credentials=delegated)

print(f"Listing subfolders in {FOLDER_ID}...\n")

query = f"'{FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
results = drive.files().list(
    q=query,
    spaces='drive',
    pageSize=50,
    supportsAllDrives=True,
    fields='files(id, name)'
).execute()

folders = results.get('files', [])
print(f"Found {len(folders)} subfolders:\n")

for folder in sorted(folders, key=lambda x: x['name']):
    print(f"  - {folder['name']} (ID: {folder['id']})")
