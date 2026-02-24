#!/usr/bin/env python3
"""
Wood Trim Spreadsheet HEIF Converter

This script:
1. Makes a backup copy of the Wood Trim spreadsheet
2. Scans columns 12+ for HEIF photo HYPERLINKS (not plain text URLs)
3. Converts each HEIF to JPEG
4. Updates the hyperlinks in the COPY to point to the new JPEGs
5. Original spreadsheet is untouched

Usage:
    python convert_woodtrim_spreadsheet.py --dry-run  # Preview only
    python convert_woodtrim_spreadsheet.py            # Actually convert
"""

import os
import sys
import io
import re
import argparse
from datetime import datetime
from pathlib import Path

# Register HEIF opener with Pillow
from pillow_heif import register_heif_opener
register_heif_opener()

from PIL import Image
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload


# Configuration
SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
]
SERVICE_ACCOUNT_FILE = os.path.expanduser('~/.config/openclaw/google-service-account.json')

# Source spreadsheet
WOODTRIM_SPREADSHEET_ID = '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE'

# First column with photo links (0-indexed, column L = 11)
PHOTO_START_COLUMN = 11

# Shared Drive ID
SHARED_DRIVE_ID = '0AExYZWmfRm9JUk9PVA'

# Archive folder name for original HEIF files
ARCHIVE_FOLDER_NAME = 'HEIF Originals Archive'


class WoodTrimConverter:
    """Convert HEIF images in Wood Trim spreadsheet to JPEG"""

    def __init__(self, service_account_file, dry_run=False):
        self.dry_run = dry_run
        self.stats = {
            'cells_scanned': 0,
            'heif_found': 0,
            'converted': 0,
            'skipped': 0,
            'errors': 0
        }

        # Authenticate
        print(f"Authenticating with service account...")
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file,
            scopes=SCOPES
        )

        # Delegate to admin user
        delegated_credentials = credentials.with_subject('admin@villasboulders.org')

        self.drive_service = build('drive', 'v3', credentials=delegated_credentials)
        self.sheets_service = build('sheets', 'v4', credentials=delegated_credentials)
        print("✓ Authenticated successfully\n")

    def extract_file_id(self, url):
        """Extract Drive file ID from various URL formats"""
        if not url or not isinstance(url, str):
            return None

        # Pattern: /d/FILE_ID/
        match = re.search(r'/d/([a-zA-Z0-9_-]+)', url)
        if match:
            return match.group(1)

        # Pattern: id=FILE_ID
        match = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', url)
        if match:
            return match.group(1)

        # Pattern: /file/d/FILE_ID
        match = re.search(r'/file/d/([a-zA-Z0-9_-]+)', url)
        if match:
            return match.group(1)

        # Direct file ID (25+ chars)
        if re.match(r'^[a-zA-Z0-9_-]{25,}$', url):
            return url

        return None

    def is_heif_file(self, file_metadata):
        """Check if a file is HEIF/HEIC format"""
        mime_type = file_metadata.get('mimeType', '')
        name = file_metadata.get('name', '').lower()

        return ('heif' in mime_type or 'heic' in mime_type or
                name.endswith('.heif') or name.endswith('.heic'))

    def get_file_parent(self, file_id):
        """Get the parent folder ID of a file"""
        try:
            file = self.drive_service.files().get(
                fileId=file_id,
                fields='parents',
                supportsAllDrives=True
            ).execute()
            parents = file.get('parents', [])
            return parents[0] if parents else None
        except Exception as e:
            print(f"      Error getting parent: {e}")
            return None

    def download_file(self, file_id):
        """Download a file from Drive to memory"""
        request = self.drive_service.files().get_media(fileId=file_id)
        file_buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(file_buffer, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()

        file_buffer.seek(0)
        return file_buffer

    def convert_heif_to_jpeg(self, heif_buffer):
        """Convert HEIF image to JPEG"""
        image = Image.open(heif_buffer)

        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            if image.mode in ('RGBA', 'LA'):
                background.paste(image, mask=image.split()[-1])
            else:
                background.paste(image)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        # Save as JPEG
        jpeg_buffer = io.BytesIO()
        image.save(jpeg_buffer, format='JPEG', quality=90, optimize=True)
        jpeg_buffer.seek(0)

        return jpeg_buffer

    def get_or_create_archive_folder(self, parent_folder_id):
        """Get or create an archive subfolder for HEIF originals"""
        # Check if archive folder already exists
        query = f"name = '{ARCHIVE_FOLDER_NAME}' and '{parent_folder_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        results = self.drive_service.files().list(
            q=query,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            fields='files(id, name)'
        ).execute()

        files = results.get('files', [])
        if files:
            return files[0]['id']

        # Create archive folder
        folder_metadata = {
            'name': ARCHIVE_FOLDER_NAME,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_folder_id]
        }
        folder = self.drive_service.files().create(
            body=folder_metadata,
            supportsAllDrives=True,
            fields='id'
        ).execute()

        return folder['id']

    def move_to_archive(self, file_id, current_parent_id, archive_folder_id):
        """Move a file to the archive folder"""
        self.drive_service.files().update(
            fileId=file_id,
            addParents=archive_folder_id,
            removeParents=current_parent_id,
            supportsAllDrives=True
        ).execute()

    def find_existing_jpeg(self, filename, parent_folder_id):
        """Check if a JPEG with this name already exists in the folder"""
        query = f"name = '{filename}' and '{parent_folder_id}' in parents and trashed = false"
        results = self.drive_service.files().list(
            q=query,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            fields='files(id, name)'
        ).execute()
        files = results.get('files', [])
        return files[0] if files else None

    def upload_jpeg(self, jpeg_buffer, filename, parent_folder_id):
        """Upload JPEG to Drive (or return existing if already converted)"""
        # Check if already exists (from previous partial run)
        existing = self.find_existing_jpeg(filename, parent_folder_id)
        if existing:
            print(f"    → Already exists, reusing: {filename}")
            return existing

        file_metadata = {
            'name': filename,
            'parents': [parent_folder_id]
        }

        media = MediaIoBaseUpload(
            jpeg_buffer,
            mimetype='image/jpeg',
            resumable=True
        )

        file = self.drive_service.files().create(
            body=file_metadata,
            media_body=media,
            supportsAllDrives=True,
            fields='id, name, webViewLink'
        ).execute()

        # Make it viewable with link (may fail if inherited from parent - that's OK)
        try:
            self.drive_service.permissions().create(
                fileId=file['id'],
                body={'type': 'anyone', 'role': 'reader'},
                supportsAllDrives=True
            ).execute()
        except Exception as perm_error:
            # Permission might already exist from parent folder inheritance
            pass

        return file

    def copy_spreadsheet(self, spreadsheet_id):
        """Create a copy of the spreadsheet"""
        # Get original name
        original = self.sheets_service.spreadsheets().get(
            spreadsheetId=spreadsheet_id
        ).execute()
        original_name = original.get('properties', {}).get('title', 'Unknown')

        # Create copy name
        copy_name = f"{original_name} - JPEG Converted {datetime.now().strftime('%Y-%m-%d')}"

        # Copy the file
        copy_metadata = {'name': copy_name}
        copy = self.drive_service.files().copy(
            fileId=spreadsheet_id,
            body=copy_metadata,
            supportsAllDrives=True,
            fields='id, name, webViewLink'
        ).execute()

        print(f"✓ Created copy: {copy_name}")
        print(f"  Copy ID: {copy['id']}")
        print(f"  URL: {copy.get('webViewLink', 'N/A')}")

        return copy

    def run(self, use_copy_id=None):
        """Main conversion process"""
        print("=" * 60)
        print("Wood Trim Spreadsheet HEIF Converter")
        print("=" * 60)
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        if self.dry_run:
            print("\n*** DRY RUN MODE - No changes will be made ***\n")

        # Step 1: Get spreadsheet data WITH HYPERLINKS
        print(f"\nReading spreadsheet {WOODTRIM_SPREADSHEET_ID}...")
        result = self.sheets_service.spreadsheets().get(
            spreadsheetId=WOODTRIM_SPREADSHEET_ID,
            includeGridData=True
        ).execute()

        sheet = result['sheets'][0]
        sheet_id = sheet['properties']['sheetId']
        rows = sheet['data'][0].get('rowData', [])

        if not rows:
            print("No data found in spreadsheet!")
            return

        print(f"Found {len(rows)} rows")

        # Step 2: Create copy or use existing (unless dry run)
        copy_id = None
        if not self.dry_run:
            if use_copy_id:
                copy_id = use_copy_id
                print(f"\nUsing existing copy: {copy_id}")
            else:
                print("\nCreating backup copy of spreadsheet...")
                copy = self.copy_spreadsheet(WOODTRIM_SPREADSHEET_ID)
                copy_id = copy['id']
        else:
            print("\n[DRY RUN] Would create backup copy")

        # Step 3: Scan for HEIF files in hyperlinks and convert
        print(f"\nScanning columns {PHOTO_START_COLUMN + 1}+ for HEIF images...")
        updates = []  # [(row_idx, col_idx, new_url), ...]

        for row_idx, row in enumerate(rows):
            if row_idx == 0:  # Skip header
                continue

            cells = row.get('values', [])
            for col_idx in range(PHOTO_START_COLUMN, len(cells)):
                cell = cells[col_idx] if col_idx < len(cells) else None
                if not cell:
                    continue

                # Get hyperlink (not text value)
                hyperlink = cell.get('hyperlink')
                if not hyperlink:
                    continue

                self.stats['cells_scanned'] += 1
                file_id = self.extract_file_id(hyperlink)

                if not file_id:
                    continue

                # Check if it's a HEIF file
                try:
                    file_metadata = self.drive_service.files().get(
                        fileId=file_id,
                        fields='id, name, mimeType, parents',
                        supportsAllDrives=True
                    ).execute()
                except Exception as e:
                    print(f"  Row {row_idx + 1}, Col {col_idx + 1}: Error accessing file - {e}")
                    self.stats['errors'] += 1
                    continue

                if not self.is_heif_file(file_metadata):
                    self.stats['skipped'] += 1
                    continue

                self.stats['heif_found'] += 1
                filename = file_metadata.get('name', 'unknown')
                print(f"  Row {row_idx + 1}, Col {col_idx + 1}: {filename}")

                if self.dry_run:
                    jpeg_name = Path(filename).stem + '.jpg'
                    print(f"    [DRY RUN] Would convert to: {jpeg_name}")
                    continue

                # Convert the file
                try:
                    # Get parent folder
                    parents = file_metadata.get('parents', [])
                    parent_id = parents[0] if parents else None
                    if not parent_id:
                        print(f"    ✗ Could not determine parent folder")
                        self.stats['errors'] += 1
                        continue

                    # Download HEIF
                    print(f"    ↓ Downloading...")
                    heif_buffer = self.download_file(file_id)

                    # Convert to JPEG
                    print(f"    ⟳ Converting...")
                    jpeg_buffer = self.convert_heif_to_jpeg(heif_buffer)

                    # Upload JPEG
                    jpeg_name = Path(filename).stem + '.jpg'
                    print(f"    ↑ Uploading {jpeg_name}...")
                    jpeg_file = self.upload_jpeg(jpeg_buffer, jpeg_name, parent_id)

                    # Record update for spreadsheet
                    new_url = f"https://drive.google.com/file/d/{jpeg_file['id']}/view"
                    updates.append((row_idx, col_idx, new_url, cell.get('formattedValue', 'View Photo')))

                    # Archive the original HEIF file
                    print(f"    📦 Archiving original...")
                    archive_folder_id = self.get_or_create_archive_folder(parent_id)
                    self.move_to_archive(file_id, parent_id, archive_folder_id)

                    print(f"    ✓ Converted and archived")
                    self.stats['converted'] += 1

                except Exception as e:
                    print(f"    ✗ Error: {e}")
                    self.stats['errors'] += 1

        # Step 4: Update the copy with new hyperlinks
        if updates and copy_id and not self.dry_run:
            print(f"\nUpdating {len(updates)} hyperlinks in copied spreadsheet...")

            # Get the copied sheet's ID
            copy_sheets = self.sheets_service.spreadsheets().get(
                spreadsheetId=copy_id
            ).execute()
            copy_sheet_id = copy_sheets['sheets'][0]['properties']['sheetId']

            # Build batch update requests
            requests = []
            for row_idx, col_idx, new_url, display_text in updates:
                requests.append({
                    'updateCells': {
                        'rows': [{
                            'values': [{
                                'userEnteredValue': {'stringValue': display_text},
                                'textFormatRuns': [{
                                    'startIndex': 0,
                                    'format': {'link': {'uri': new_url}}
                                }]
                            }]
                        }],
                        'fields': 'userEnteredValue,textFormatRuns',
                        'start': {
                            'sheetId': copy_sheet_id,
                            'rowIndex': row_idx,
                            'columnIndex': col_idx
                        }
                    }
                })

            # Execute batch update
            self.sheets_service.spreadsheets().batchUpdate(
                spreadsheetId=copy_id,
                body={'requests': requests}
            ).execute()

            print("✓ Spreadsheet hyperlinks updated")

        # Print summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Cells scanned:          {self.stats['cells_scanned']}")
        print(f"HEIF files found:       {self.stats['heif_found']}")
        print(f"Successfully converted: {self.stats['converted']}")
        print(f"Non-HEIF skipped:       {self.stats['skipped']}")
        print(f"Errors:                 {self.stats['errors']}")

        if copy_id:
            print(f"\n✓ Converted spreadsheet: https://docs.google.com/spreadsheets/d/{copy_id}")
            print(f"\nIMPORTANT: Update PropertyReport CONFIG.woodTrimSheetId to use the new spreadsheet!")


def main():
    parser = argparse.ArgumentParser(
        description='Convert HEIF images in Wood Trim spreadsheet to JPEG'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview what would be done without making changes'
    )
    parser.add_argument(
        '--service-account',
        default=SERVICE_ACCOUNT_FILE,
        help='Path to service account credentials JSON file'
    )
    parser.add_argument(
        '--use-copy',
        help='Use existing spreadsheet copy ID instead of creating new one'
    )

    args = parser.parse_args()

    if not os.path.exists(args.service_account):
        print(f"Error: Service account file not found: {args.service_account}")
        sys.exit(1)

    converter = WoodTrimConverter(args.service_account, dry_run=args.dry_run)
    converter.run(use_copy_id=args.use_copy)


if __name__ == '__main__':
    main()
