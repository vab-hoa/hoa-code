#!/usr/bin/env python3
"""Verify folder access and list contents"""

import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
SCOPES = ['https://www.googleapis.com/auth/drive']

FOLDER_ID = "1MUlUcjTZ506AOifBThfuzhZmViUbHW2Q"

credentials = service_account.Credentials.from_service_account_file(CREDS_PATH, scopes=SCOPES)
delegated = credentials.with_subject('admin@villasboulders.org')
drive = build('drive', 'v3', credentials=delegated)

print(f"Checking folder {FOLDER_ID}...\n")

# Try to get folder metadata
try:
    folder = drive.files().get(fileId=FOLDER_ID, supportsAllDrives=True, fields='id,name,mimeType,parents').execute()
    print(f"Folder name: {folder.get('name')}")
    print(f"Folder type: {folder.get('mimeType')}")
    print(f"Parents: {folder.get('parents')}\n")
except Exception as e:
    print(f"ERROR accessing folder: {e}\n")

# List ALL items (not just folders) - try different queries
queries_to_try = [
    (f"'{FOLDER_ID}' in parents and trashed=false", "All items in parents"),
    (f"'{FOLDER_ID}' in parents and trashed=false", "All items (no type filter)"),
    (f"'{FOLDER_ID}' in parents", "All items (no trash filter)"),
]

for query_str, description in queries_to_try:
    print(f"Query: {description}")
    print(f"  {query_str}\n")

    results = drive.files().list(
        q=query_str,
        spaces='drive',
        pageSize=50,
        supportsAllDrives=True,
        fields='files(id, name, mimeType)'
    ).execute()

    items = results.get('files', [])
    print(f"  Found {len(items)} items:\n")

    for item in sorted(items, key=lambda x: x['name']):
        item_type = "📁" if item['mimeType'] == 'application/vnd.google-apps.folder' else "📄"
        print(f"    {item_type} {item['name']}")
    print()
