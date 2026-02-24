#!/bin/bash
#
# Pull latest HOA code from Google Drive Code directory
# Downloads files from Google Drive HOA Board Documents/Code/ to ~/hoa-code/
#
# Usage: ./pull_from_drive.sh [project_name]
#   project_name: Optional - pull specific project only
#   If no argument, pulls all projects
#

set -e  # Exit on error

# Configuration
DRIVE_CODE_FOLDER_ID="1VH1UQdEQYDY3cSXVEjIhWxq7r6x3wmvm"
LOCAL_DIR="$HOME/hoa-code"
BACKUP_DIR="$HOME/hoa-code-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Pull HOA Code from Google Drive ===${NC}\n"

# Check if service account credentials exist
if [ ! -f "$HOME/.config/openclaw/google-service-account.json" ]; then
    echo -e "${RED}Error: Service account credentials not found${NC}"
    echo "Expected: $HOME/.config/openclaw/google-service-account.json"
    exit 1
fi

# Determine what to pull
if [ -n "$1" ]; then
    PROJECTS=("$1")
    echo "Pulling specific project: $1"
else
    PROJECTS=("PropertyReport" "HOALibrary" "LabelsToGroups" "exif-to-parcel" "utilities")
    echo "Pulling all projects"
fi

echo -e "${YELLOW}This will download files from Google Drive${NC}"
echo "Drive Folder ID: $DRIVE_CODE_FOLDER_ID"
echo "Local Destination: $LOCAL_DIR"
echo ""

# Check if local directory exists
if [ -d "$LOCAL_DIR" ]; then
    echo -e "${YELLOW}Local directory exists. Creating backup...${NC}"
    echo "Backup location: $BACKUP_DIR"
    cp -r "$LOCAL_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✓ Backup created${NC}"
    echo ""
fi

# Prompt for confirmation
read -p "Continue with download? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Pull cancelled"
    exit 0
fi

echo ""
echo "Creating Python download script..."

# Create temporary Python script for download
cat > /tmp/pull_from_drive.py << 'PYEOF'
#!/usr/bin/env python3
import sys
import os
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError
import io

CREDS_PATH = os.path.expanduser('~/.config/openclaw/google-service-account.json')
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def download_file(service, file_id, file_name, dest_path):
    """Download a file from Google Drive"""
    try:
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()

        # Write to file
        with open(dest_path, 'wb') as f:
            f.write(fh.getvalue())

        print(f"  ✓ Downloaded: {file_name}")
        return True
    except HttpError as error:
        print(f"  ✗ Failed to download {file_name}: {error}")
        return False

def list_folder_contents(service, folder_id):
    """List all files in a folder"""
    try:
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            spaces='drive',
            fields='files(id, name, mimeType)',
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        return results.get('files', [])
    except HttpError as error:
        print(f"  ✗ Error listing folder: {error}")
        return []

def find_folder_by_name(service, folder_name, parent_id):
    """Find a folder by name in a parent folder"""
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and '{parent_id}' in parents and trashed=false"

    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora='allDrives'
    ).execute()

    folders = results.get('files', [])
    return folders[0]['id'] if folders else None

def pull_project(service, drive_folder_id, local_dir, project_name):
    """Pull a project from Google Drive"""
    print(f"\n📁 Pulling {project_name}...")

    # Find project folder in Drive
    project_folder_id = find_folder_by_name(service, project_name, drive_folder_id)

    if not project_folder_id:
        print(f"  ⚠ Project folder not found in Google Drive: {project_name}")
        return False

    # Create local directory if it doesn't exist
    local_project_dir = os.path.join(local_dir, project_name)
    os.makedirs(local_project_dir, exist_ok=True)

    # List and download all files
    files = list_folder_contents(service, project_folder_id)

    if not files:
        print(f"  ⚠ No files found in {project_name}")
        return True

    for file in files:
        # Skip folders (only download files)
        if file['mimeType'] == 'application/vnd.google-apps.folder':
            continue

        # Skip Google Docs (would need export, not simple download)
        if 'google-apps' in file['mimeType']:
            print(f"  ⊘ Skipping Google Doc: {file['name']} (not a regular file)")
            continue

        # Download file
        dest_path = os.path.join(local_project_dir, file['name'])
        download_file(service, file['id'], file['name'], dest_path)

    return True

def main():
    if len(sys.argv) < 4:
        print("Usage: script.py <drive_folder_id> <local_dir> <project1> [project2] ...")
        sys.exit(1)

    drive_folder_id = sys.argv[1]
    local_dir = sys.argv[2]
    projects = sys.argv[3:]

    # Authenticate
    credentials = service_account.Credentials.from_service_account_file(
        CREDS_PATH,
        scopes=SCOPES,
        subject='admin@villasboulders.org'
    )

    service = build('drive', 'v3', credentials=credentials)

    print(f"✓ Authenticated as: {credentials.service_account_email}")
    print(f"✓ Impersonating: admin@villasboulders.org\n")

    # Pull each project
    for project in projects:
        pull_project(service, drive_folder_id, local_dir, project)

    print(f"\n✓ Pull complete!")
    print(f"Files downloaded to: {local_dir}")

if __name__ == '__main__':
    main()
PYEOF

chmod +x /tmp/pull_from_drive.py

# Create local directory if it doesn't exist
mkdir -p "$LOCAL_DIR"

# Run the Python script
echo ""
python3 /tmp/pull_from_drive.py "$DRIVE_CODE_FOLDER_ID" "$LOCAL_DIR" "${PROJECTS[@]}"

# Cleanup
rm /tmp/pull_from_drive.py

echo ""
echo -e "${GREEN}Pull from Google Drive complete!${NC}"
echo ""
if [ -d "$BACKUP_DIR" ]; then
    echo "Previous version backed up to: $BACKUP_DIR"
    echo "If you need to restore: rm -rf $LOCAL_DIR && mv $BACKUP_DIR $LOCAL_DIR"
fi
