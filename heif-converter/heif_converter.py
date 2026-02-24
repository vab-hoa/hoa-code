#!/usr/bin/env python3
"""
HEIF to JPEG Auto-Converter for Google Drive

Scans specified Drive folders for HEIF/HEIC images, converts them to JPEG,
and uploads the converted versions back to Drive.

This solves the issue where Apps Script cannot handle HEIF images in PDFs.
"""

import os
import sys
import io
import argparse
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload
except ImportError as e:
    print(f"Error: Missing required library: {e}")
    print("Please install: pip install Pillow google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    sys.exit(1)


# Configuration
SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = os.path.expanduser('~/.config/openclaw/google-service-account.json')

# Shared Drive configuration
SHARED_DRIVE_ID = '0AExYZWmfRm9JUk9PVA'  # HOA Board Documents
SHARED_DRIVE_NAME = 'HOA Board Documents'

# Folders to scan (folder names - script will search for them)
TARGET_FOLDERS = [
    'Gutter Pictures',
    # Add more folder names here as needed
]

# Archive folder for HEIF originals (will be created if it doesn't exist)
ARCHIVE_FOLDER_NAME = 'HEIF Originals Archive'


class HeifConverter:
    """Convert HEIF images to JPEG in Google Drive"""

    def __init__(self, service_account_file, dry_run=False):
        self.dry_run = dry_run
        self.stats = {
            'found': 0,
            'converted': 0,
            'skipped': 0,
            'errors': 0
        }

        # Authenticate with Google Drive
        print(f"Authenticating with service account: {service_account_file}")
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file,
            scopes=SCOPES
        )

        # Delegate to admin user for access to all files
        delegated_credentials = credentials.with_subject('admin@villasboulders.org')
        self.drive_service = build('drive', 'v3', credentials=delegated_credentials)
        print("✓ Authenticated successfully\n")

    def find_folder_by_name(self, folder_name, parent_id=None):
        """Find a folder by name, optionally within a parent folder"""
        query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        results = self.drive_service.files().list(
            q=query,
            corpora='drive',
            driveId=SHARED_DRIVE_ID,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            spaces='drive',
            fields='files(id, name, parents)'
        ).execute()

        items = results.get('files', [])
        return items[0] if items else None

    def find_or_create_archive_folder(self, parent_folder_id):
        """Find or create the archive folder for HEIF originals"""
        # Check if archive folder exists
        archive = self.find_folder_by_name(ARCHIVE_FOLDER_NAME, parent_folder_id)

        if archive:
            print(f"  ✓ Found archive folder: {ARCHIVE_FOLDER_NAME}")
            return archive['id']

        # Create archive folder
        if self.dry_run:
            print(f"  [DRY RUN] Would create archive folder: {ARCHIVE_FOLDER_NAME}")
            return None

        print(f"  Creating archive folder: {ARCHIVE_FOLDER_NAME}")
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

        print(f"  ✓ Created archive folder")
        return folder.get('id')

    def find_heif_images(self, folder_id, folder_name):
        """Find all HEIF/HEIC images in a folder (recursive)"""
        heif_images = []

        # Query for HEIF images
        query = f"'{folder_id}' in parents and trashed = false and (mimeType = 'image/heif' or mimeType = 'image/heic' or name contains '.heif' or name contains '.HEIF' or name contains '.heic' or name contains '.HEIC')"

        page_token = None
        while True:
            results = self.drive_service.files().list(
                q=query,
                corpora='drive',
                driveId=SHARED_DRIVE_ID,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                spaces='drive',
                fields='nextPageToken, files(id, name, mimeType, size)',
                pageToken=page_token
            ).execute()

            items = results.get('files', [])
            heif_images.extend(items)

            page_token = results.get('nextPageToken')
            if not page_token:
                break

        # Also check subfolders
        subfolder_query = f"'{folder_id}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'"
        results = self.drive_service.files().list(
            q=subfolder_query,
            corpora='drive',
            driveId=SHARED_DRIVE_ID,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            spaces='drive',
            fields='files(id, name)'
        ).execute()

        subfolders = results.get('files', [])
        for subfolder in subfolders:
            subfolder_path = f"{folder_name}/{subfolder['name']}"
            print(f"  Scanning subfolder: {subfolder_path}")
            heif_images.extend(self.find_heif_images(subfolder['id'], subfolder_path))

        return heif_images

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
        # Open HEIF image
        image = Image.open(heif_buffer)

        # Convert to RGB if necessary (HEIF can be RGBA)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        # Convert to JPEG
        jpeg_buffer = io.BytesIO()
        image.save(jpeg_buffer, format='JPEG', quality=90, optimize=True)
        jpeg_buffer.seek(0)

        return jpeg_buffer

    def upload_file(self, file_buffer, filename, parent_folder_id, mime_type='image/jpeg'):
        """Upload a file to Drive"""
        file_metadata = {
            'name': filename,
            'parents': [parent_folder_id]
        }

        media = MediaFileUpload(
            io.BufferedReader(file_buffer),
            mimetype=mime_type,
            resumable=True
        )

        file = self.drive_service.files().create(
            body=file_metadata,
            media_body=media,
            supportsAllDrives=True,
            fields='id, name'
        ).execute()

        return file

    def move_to_archive(self, file_id, archive_folder_id, current_parent_id):
        """Move a file to the archive folder"""
        # Remove from current parent and add to archive
        self.drive_service.files().update(
            fileId=file_id,
            addParents=archive_folder_id,
            removeParents=current_parent_id,
            supportsAllDrives=True,
            fields='id, parents'
        ).execute()

    def process_image(self, image_file, parent_folder_id, archive_folder_id):
        """Download, convert, upload, and archive a single HEIF image"""
        filename = image_file['name']
        file_id = image_file['id']

        try:
            print(f"    Processing: {filename}")

            # Generate JPEG filename
            jpeg_filename = Path(filename).stem + '.jpg'

            # Check if JPEG already exists
            query = f"name = '{jpeg_filename}' and '{parent_folder_id}' in parents and trashed = false"
            results = self.drive_service.files().list(
                q=query,
                corpora='drive',
                driveId=SHARED_DRIVE_ID,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                spaces='drive',
                fields='files(id, name)'
            ).execute()

            if results.get('files'):
                print(f"      ⊘ Skipped - JPEG already exists: {jpeg_filename}")
                self.stats['skipped'] += 1
                return

            if self.dry_run:
                print(f"      [DRY RUN] Would convert to: {jpeg_filename}")
                self.stats['converted'] += 1
                return

            # Download HEIF
            print(f"      ↓ Downloading...")
            heif_buffer = self.download_file(file_id)

            # Convert to JPEG
            print(f"      ⟳ Converting to JPEG...")
            jpeg_buffer = self.convert_heif_to_jpeg(heif_buffer)

            # Upload JPEG
            print(f"      ↑ Uploading: {jpeg_filename}")
            uploaded = self.upload_file(jpeg_buffer, jpeg_filename, parent_folder_id)

            # Move HEIF to archive
            if archive_folder_id:
                print(f"      📦 Archiving original...")
                self.move_to_archive(file_id, archive_folder_id, parent_folder_id)

            print(f"      ✓ Converted successfully")
            self.stats['converted'] += 1

        except Exception as e:
            print(f"      ✗ Error: {e}")
            self.stats['errors'] += 1

    def process_folder(self, folder_name):
        """Process all HEIF images in a folder"""
        print(f"\n{'='*60}")
        print(f"Processing folder: {folder_name}")
        print(f"{'='*60}")

        # Find folder
        folder = self.find_folder_by_name(folder_name)
        if not folder:
            print(f"✗ Folder not found: {folder_name}")
            return

        folder_id = folder['id']
        print(f"✓ Found folder: {folder_name} (ID: {folder_id})")

        # Find or create archive folder
        archive_folder_id = self.find_or_create_archive_folder(folder_id)

        # Find all HEIF images
        print(f"\nSearching for HEIF/HEIC images...")
        heif_images = self.find_heif_images(folder_id, folder_name)

        if not heif_images:
            print(f"  No HEIF images found")
            return

        print(f"  Found {len(heif_images)} HEIF image(s)")
        self.stats['found'] += len(heif_images)

        # Process each image
        print(f"\nConverting images...")
        for image in heif_images:
            self.process_image(image, folder_id, archive_folder_id)

    def run(self, folders=None):
        """Run the converter on specified folders"""
        if folders is None:
            folders = TARGET_FOLDERS

        start_time = datetime.now()
        print(f"HEIF to JPEG Converter")
        print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        if self.dry_run:
            print("\n*** DRY RUN MODE - No changes will be made ***\n")

        # Process each folder
        for folder_name in folders:
            self.process_folder(folder_name)

        # Print summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        print(f"\n{'='*60}")
        print(f"SUMMARY")
        print(f"{'='*60}")
        print(f"HEIF images found:  {self.stats['found']}")
        print(f"Successfully converted: {self.stats['converted']}")
        print(f"Skipped (already exists): {self.stats['skipped']}")
        print(f"Errors: {self.stats['errors']}")
        print(f"Duration: {duration:.1f} seconds")
        print(f"Completed: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")


def main():
    parser = argparse.ArgumentParser(
        description='Convert HEIF images to JPEG in Google Drive folders'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '--folders',
        nargs='+',
        help=f'Folder names to process (default: {", ".join(TARGET_FOLDERS)})'
    )
    parser.add_argument(
        '--service-account',
        default=SERVICE_ACCOUNT_FILE,
        help='Path to service account credentials JSON file'
    )

    args = parser.parse_args()

    # Check service account file exists
    if not os.path.exists(args.service_account):
        print(f"Error: Service account file not found: {args.service_account}")
        sys.exit(1)

    # Run converter
    converter = HeifConverter(args.service_account, dry_run=args.dry_run)
    converter.run(folders=args.folders)


if __name__ == '__main__':
    main()
