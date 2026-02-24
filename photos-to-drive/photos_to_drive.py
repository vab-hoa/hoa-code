#!/usr/bin/env python3
"""
Google Photos to Drive Sync Tool

Automatically syncs photos from Google Photos albums to Google Drive folders,
with automatic HEIF to JPEG conversion.

Perfect for HOA workflow where contractors share photos via Google Photos
and we need them in Drive folders for PropertyReport processing.
"""

import os
import sys
import io
import json
import yaml
import argparse
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload
    import requests
except ImportError as e:
    print(f"Error: Missing required library: {e}")
    print("Please install: pip install Pillow google-auth google-api-python-client PyYAML requests")
    sys.exit(1)


# Configuration
SCOPES = [
    'https://www.googleapis.com/auth/photoslibrary.readonly',
    'https://www.googleapis.com/auth/drive'
]
SERVICE_ACCOUNT_FILE = os.path.expanduser('~/.config/openclaw/google-service-account.json')
SHARED_DRIVE_ID = '0AExYZWmfRm9JUk9PVA'  # HOA Board Documents
CONFIG_FILE = 'sync_config.yaml'
SYNC_DB_FILE = 'sync_history.json'


class PhotosToDriverSync:
    """Sync photos from Google Photos to Drive with HEIF conversion"""

    def __init__(self, service_account_file, config_file=None, dry_run=False):
        self.dry_run = dry_run
        self.config_file = config_file or CONFIG_FILE
        self.sync_db_file = SYNC_DB_FILE
        self.config = None
        self.sync_history = self.load_sync_history()

        self.stats = {
            'albums_processed': 0,
            'photos_found': 0,
            'photos_synced': 0,
            'photos_skipped': 0,
            'heif_converted': 0,
            'errors': 0
        }

        # Authenticate
        print(f"Authenticating with service account...")
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file,
            scopes=SCOPES
        )

        # For Drive API - use delegated credentials
        drive_credentials = credentials.with_subject('admin@villasboulders.org')
        self.drive_service = build('drive', 'v3', credentials=drive_credentials)

        # For Photos API - use delegated credentials
        photos_credentials = credentials.with_subject('admin@villasboulders.org')
        self.photos_service = build('photoslibrary', 'v1', credentials=photos_credentials, static_discovery=False)

        print("✓ Authenticated successfully\n")

    def load_sync_history(self):
        """Load history of synced photos"""
        if os.path.exists(self.sync_db_file):
            with open(self.sync_db_file, 'r') as f:
                return json.load(f)
        return {}

    def save_sync_history(self):
        """Save sync history"""
        if not self.dry_run:
            with open(self.sync_db_file, 'w') as f:
                json.dump(self.sync_history, f, indent=2)

    def load_config(self):
        """Load sync configuration"""
        if not os.path.exists(self.config_file):
            print(f"Error: Configuration file not found: {self.config_file}")
            print(f"Run with --list-albums first to create a template")
            return None

        with open(self.config_file, 'r') as f:
            self.config = yaml.safe_load(f)

        return self.config

    def list_albums(self):
        """List all Google Photos albums"""
        print("Fetching albums from Google Photos...\n")

        try:
            results = self.photos_service.albums().list(pageSize=50).execute()
            albums = results.get('albums', [])

            if not albums:
                print("No albums found")
                return []

            print(f"Found {len(albums)} albums:\n")
            print(f"{'Album Name':<50} {'# Photos':<12} {'ID'}")
            print("=" * 100)

            for album in albums:
                name = album.get('title', 'Untitled')
                photo_count = album.get('mediaItemsCount', '?')
                album_id = album['id']
                print(f"{name:<50} {photo_count:<12} {album_id}")

            # Generate sample config
            self.generate_sample_config(albums)

            return albums

        except Exception as e:
            print(f"Error listing albums: {e}")
            return []

    def generate_sample_config(self, albums):
        """Generate a sample configuration file"""
        config_path = 'sync_config.yaml.example'

        sample_config = {
            'syncs': []
        }

        # Add first 3 albums as examples
        for album in albums[:3]:
            sample_config['syncs'].append({
                'album_name': album.get('title', 'Untitled'),
                'album_id': album['id'],
                'drive_folder': 'CONFIGURE_THIS',  # User must set this
                'auto_convert_heif': True,
                'enabled': False  # Disabled by default
            })

        # Add example for address-based album
        sample_config['syncs'].append({
            'album_name': '13737 Rock Point Unit 102',
            'album_id': 'ALBUM_ID_HERE',
            'drive_folder': 'Gutter Pictures',
            'auto_convert_heif': True,
            'enabled': True
        })

        with open(config_path, 'w') as f:
            yaml.dump(sample_config, f, default_flow_style=False, sort_keys=False)

        print(f"\n✓ Sample configuration created: {config_path}")
        print(f"  Edit this file, set 'enabled: true', and rename to '{CONFIG_FILE}'")

    def find_drive_folder(self, folder_path):
        """Find or create a Drive folder by path (e.g., 'Gutter Pictures/SubFolder')"""
        parts = folder_path.split('/')
        current_parent = None

        for part in parts:
            query = f"name = '{part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            if current_parent:
                query += f" and '{current_parent}' in parents"

            results = self.drive_service.files().list(
                q=query,
                corpora='drive',
                driveId=SHARED_DRIVE_ID,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                fields='files(id, name)'
            ).execute()

            folders = results.get('files', [])

            if folders:
                current_parent = folders[0]['id']
            else:
                # Create folder
                if self.dry_run:
                    print(f"    [DRY RUN] Would create folder: {part}")
                    return None

                print(f"    Creating folder: {part}")
                metadata = {
                    'name': part,
                    'mimeType': 'application/vnd.google-apps.folder'
                }
                if current_parent:
                    metadata['parents'] = [current_parent]

                folder = self.drive_service.files().create(
                    body=metadata,
                    supportsAllDrives=True,
                    fields='id'
                ).execute()
                current_parent = folder['id']

        return current_parent

    def get_album_photos(self, album_id):
        """Get all photos from an album"""
        photos = []
        page_token = None

        while True:
            body = {
                'albumId': album_id,
                'pageSize': 100
            }
            if page_token:
                body['pageToken'] = page_token

            results = self.photos_service.mediaItems().search(body=body).execute()
            items = results.get('mediaItems', [])
            photos.extend(items)

            page_token = results.get('nextPageToken')
            if not page_token:
                break

        return photos

    def download_photo(self, photo):
        """Download a photo from Google Photos"""
        base_url = photo['baseUrl']
        # Add parameters for full resolution download
        download_url = f"{base_url}=d"

        response = requests.get(download_url)
        response.raise_for_status()

        return io.BytesIO(response.content)

    def convert_heif_to_jpeg(self, heif_buffer, filename):
        """Convert HEIF to JPEG"""
        try:
            image = Image.open(heif_buffer)

            # Convert to RGB
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')

            # Save as JPEG
            jpeg_buffer = io.BytesIO()
            image.save(jpeg_buffer, format='JPEG', quality=90, optimize=True)
            jpeg_buffer.seek(0)

            return jpeg_buffer, True

        except Exception as e:
            print(f"      Warning: HEIF conversion failed: {e}")
            heif_buffer.seek(0)
            return heif_buffer, False

    def upload_to_drive(self, file_buffer, filename, folder_id, mime_type):
        """Upload file to Drive"""
        metadata = {
            'name': filename,
            'parents': [folder_id]
        }

        media = MediaFileUpload(
            io.BufferedReader(file_buffer),
            mimetype=mime_type,
            resumable=True
        )

        file = self.drive_service.files().create(
            body=metadata,
            media_body=media,
            supportsAllDrives=True,
            fields='id, name, webViewLink'
        ).execute()

        return file

    def is_synced(self, photo_id, drive_folder):
        """Check if photo has already been synced"""
        key = f"{photo_id}:{drive_folder}"
        return key in self.sync_history

    def mark_synced(self, photo_id, drive_folder, drive_file_id):
        """Mark photo as synced"""
        key = f"{photo_id}:{drive_folder}"
        self.sync_history[key] = {
            'photo_id': photo_id,
            'drive_folder': drive_folder,
            'drive_file_id': drive_file_id,
            'synced_at': datetime.now().isoformat()
        }

    def sync_album(self, sync_config):
        """Sync one album to a Drive folder"""
        album_name = sync_config['album_name']
        album_id = sync_config.get('album_id')
        drive_folder_path = sync_config['drive_folder']
        convert_heif = sync_config.get('auto_convert_heif', True)

        print(f"\nSyncing: {album_name}")
        print(f"  → Drive folder: {drive_folder_path}")

        # Find album if no ID provided
        if not album_id:
            print(f"  Looking up album by name...")
            results = self.photos_service.albums().list(pageSize=50).execute()
            albums = results.get('albums', [])
            matching = [a for a in albums if a.get('title') == album_name]

            if not matching:
                print(f"  ✗ Album not found: {album_name}")
                return

            album_id = matching[0]['id']
            print(f"  ✓ Found album: {album_id}")

        # Find/create Drive folder
        drive_folder_id = self.find_drive_folder(drive_folder_path)
        if not drive_folder_id:
            if self.dry_run:
                print(f"  [DRY RUN] Would create Drive folder")
            else:
                print(f"  ✗ Could not find/create Drive folder")
                return

        # Get photos from album
        print(f"  Fetching photos from album...")
        photos = self.get_album_photos(album_id)
        print(f"  Found {len(photos)} photos")
        self.stats['photos_found'] += len(photos)

        # Sync each photo
        synced_count = 0
        skipped_count = 0

        for photo in photos:
            photo_id = photo['id']
            filename = photo.get('filename', f"photo_{photo_id}.jpg")

            # Check if already synced
            if self.is_synced(photo_id, drive_folder_path):
                skipped_count += 1
                continue

            try:
                print(f"    Syncing: {filename}")

                if self.dry_run:
                    print(f"      [DRY RUN] Would download and upload")
                    synced_count += 1
                    continue

                # Download
                print(f"      ↓ Downloading...")
                photo_buffer = self.download_photo(photo)

                # Check if HEIF and convert
                mime_type = photo.get('mimeType', 'image/jpeg')
                converted = False

                if convert_heif and ('heif' in mime_type.lower() or 'heic' in mime_type.lower() or
                                     filename.lower().endswith(('.heif', '.heic'))):
                    print(f"      ⟳ Converting HEIF to JPEG...")
                    photo_buffer, converted = self.convert_heif_to_jpeg(photo_buffer, filename)

                    if converted:
                        filename = Path(filename).stem + '.jpg'
                        mime_type = 'image/jpeg'
                        self.stats['heif_converted'] += 1

                # Upload to Drive
                print(f"      ↑ Uploading to Drive...")
                uploaded = self.upload_to_drive(photo_buffer, filename, drive_folder_id, mime_type)

                # Mark as synced
                self.mark_synced(photo_id, drive_folder_path, uploaded['id'])
                synced_count += 1
                self.stats['photos_synced'] += 1

                print(f"      ✓ Synced successfully")

            except Exception as e:
                print(f"      ✗ Error: {e}")
                self.stats['errors'] += 1

        print(f"  Synced: {synced_count}, Skipped: {skipped_count}")
        self.stats['photos_skipped'] += skipped_count
        self.stats['albums_processed'] += 1

    def run_sync(self):
        """Run sync based on configuration"""
        if not self.load_config():
            return

        syncs = self.config.get('syncs', [])
        enabled_syncs = [s for s in syncs if s.get('enabled', False)]

        if not enabled_syncs:
            print("No enabled syncs found in configuration")
            return

        print(f"Starting sync of {len(enabled_syncs)} album(s)...")

        if self.dry_run:
            print("\n*** DRY RUN MODE - No changes will be made ***\n")

        start_time = datetime.now()

        for sync_config in enabled_syncs:
            self.sync_album(sync_config)

        # Save sync history
        self.save_sync_history()

        # Print summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        print(f"\n{'='*60}")
        print(f"SUMMARY")
        print(f"{'='*60}")
        print(f"Albums processed: {self.stats['albums_processed']}")
        print(f"Photos found: {self.stats['photos_found']}")
        print(f"Photos synced: {self.stats['photos_synced']}")
        print(f"Photos skipped (already synced): {self.stats['photos_skipped']}")
        print(f"HEIF conversions: {self.stats['heif_converted']}")
        print(f"Errors: {self.stats['errors']}")
        print(f"Duration: {duration:.1f} seconds")


def main():
    parser = argparse.ArgumentParser(
        description='Sync photos from Google Photos to Drive with HEIF conversion'
    )
    parser.add_argument(
        '--list-albums',
        action='store_true',
        help='List all Google Photos albums and create sample config'
    )
    parser.add_argument(
        '--sync',
        action='store_true',
        help='Run sync based on configuration file'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '--config',
        default=CONFIG_FILE,
        help=f'Configuration file (default: {CONFIG_FILE})'
    )
    parser.add_argument(
        '--service-account',
        default=SERVICE_ACCOUNT_FILE,
        help='Path to service account credentials'
    )

    args = parser.parse_args()

    if not os.path.exists(args.service_account):
        print(f"Error: Service account file not found: {args.service_account}")
        sys.exit(1)

    syncer = PhotosToDriverSync(args.service_account, args.config, dry_run=args.dry_run)

    if args.list_albums:
        syncer.list_albums()
    elif args.sync:
        syncer.run_sync()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
