#!/usr/bin/env python3
"""Quick inspection of Wood Trim spreadsheet photo columns - with hyperlink extraction"""

import os
import re
from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = os.path.expanduser('~/.config/openclaw/google-service-account.json')
WOODTRIM_SPREADSHEET_ID = '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
delegated = credentials.with_subject('admin@villasboulders.org')

sheets = build('sheets', 'v4', credentials=delegated)
drive = build('drive', 'v3', credentials=delegated)

# Get spreadsheet data including hyperlinks
print("Fetching spreadsheet with hyperlink data...")
result = sheets.spreadsheets().get(
    spreadsheetId=WOODTRIM_SPREADSHEET_ID,
    includeGridData=True
).execute()

sheet_data = result['sheets'][0]['data'][0]  # First sheet, first grid
rows = sheet_data.get('rowData', [])

print(f"Rows: {len(rows)}")

# Get headers
if rows:
    headers = []
    for cell in rows[0].get('values', []):
        val = cell.get('formattedValue', '')
        headers.append(val)
    print(f"Headers: {headers}")

print()

# Look at columns 12+ (index 11+) for hyperlinks
print("Extracting hyperlinks from photo columns (L onwards)...")
photo_links = []

for row_idx, row in enumerate(rows[1:], start=2):  # Skip header
    cells = row.get('values', [])
    for col_idx in range(11, len(cells)):  # Column L = index 11
        cell = cells[col_idx] if col_idx < len(cells) else None
        if not cell:
            continue

        # Check for hyperlink
        hyperlink = cell.get('hyperlink')
        if hyperlink:
            photo_links.append({
                'row': row_idx,
                'col': col_idx + 1,
                'url': hyperlink,
                'display': cell.get('formattedValue', '')
            })

print(f"Found {len(photo_links)} hyperlinks in photo columns")
print()

# Show first 10
print("First 10 hyperlinks:")
for link in photo_links[:10]:
    print(f"  Row {link['row']}, Col {link['col']}: {link['url'][:80]}...")

# Check file types
print("\n\nChecking file types...")
heif_count = 0
jpeg_count = 0
other_count = 0
errors = 0

for link in photo_links[:50]:  # Check first 50
    url = link['url']
    # Extract file ID
    match = re.search(r'/d/([a-zA-Z0-9_-]+)', url)
    if not match:
        match = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', url)

    if match:
        file_id = match.group(1)
        try:
            file_meta = drive.files().get(
                fileId=file_id,
                fields='name, mimeType',
                supportsAllDrives=True
            ).execute()
            mime = file_meta['mimeType']
            name = file_meta['name']

            if 'heif' in mime.lower() or 'heic' in mime.lower() or name.lower().endswith(('.heif', '.heic')):
                heif_count += 1
                print(f"  HEIF: {name} ({mime})")
            elif 'jpeg' in mime.lower() or 'jpg' in mime.lower():
                jpeg_count += 1
            else:
                other_count += 1
                print(f"  Other: {name} ({mime})")
        except Exception as e:
            errors += 1
            print(f"  Error: {file_id} - {e}")

print(f"\nSummary (of first 50 links):")
print(f"  HEIF: {heif_count}")
print(f"  JPEG: {jpeg_count}")
print(f"  Other: {other_count}")
print(f"  Errors: {errors}")
