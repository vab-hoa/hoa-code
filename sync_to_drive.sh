#!/bin/bash
#
# Sync local HOA code to Google Drive Code directory
# Uploads changes from ~/hoa-code/ to Google Drive HOA Board Documents/Code/
#
# Usage: ./sync_to_drive.sh [project_name]
#   project_name: Optional - sync specific project only (PropertyReport, HOALibrary, etc.)
#   If no argument, syncs all projects
#

set -e  # Exit on error

# Configuration
DRIVE_CODE_FOLDER_ID="1VH1UQdEQYDY3cSXVEjIhWxq7r6x3wmvm"
LOCAL_DIR="$HOME/hoa-code"
SCRIPT_DIR="$HOME/openclaw.jane/workspace/scripts/google_workspace_utilities"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HOA Code to Google Drive Sync ===${NC}\n"

# Check if local directory exists
if [ ! -d "$LOCAL_DIR" ]; then
    echo -e "${RED}Error: Local directory not found: $LOCAL_DIR${NC}"
    exit 1
fi

# Check if service account credentials exist
if [ ! -f "$HOME/.config/openclaw/google-service-account.json" ]; then
    echo -e "${RED}Error: Service account credentials not found${NC}"
    echo "Expected: $HOME/.config/openclaw/google-service-account.json"
    exit 1
fi

# Determine what to sync
if [ -n "$1" ]; then
    PROJECTS=("$1")
    echo "Syncing specific project: $1"
else
    PROJECTS=("PropertyReport" "HOALibrary" "LabelsToGroups" "exif-to-parcel" "utilities")
    echo "Syncing all projects"
fi

echo -e "${YELLOW}This will upload files to Google Drive Code directory${NC}"
echo "Drive Folder ID: $DRIVE_CODE_FOLDER_ID"
echo "Local Source: $LOCAL_DIR"
echo ""

# Prompt for confirmation
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Sync cancelled"
    exit 0
fi

echo ""
echo "Creating Python upload script..."

# Create temporary Python script for upload
cat > /tmp/sync_to_drive.py << 'PYEOF'
#!/usr/bin/env python3
import sys
import os
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

CREDS_PATH = os.path.expanduser('~/.config/openclaw/google-service-account.json')
SCOPES = ['https://www.googleapis.com/auth/drive']

def upload_file(service, file_path, parent_folder_id, project_name):
    """Upload a file to Google Drive"""
    file_name = os.path.basename(file_path)

    # Check if file already exists
    query = f"name='{file_name}' and '{parent_folder_id}' in parents and trashed=false"
    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()

    existing_files = results.get('files', [])

    # Determine MIME type
    if file_name.endswith('.md'):
        mime_type = 'text/markdown'
    elif file_name.endswith('.gs'):
        mime_type = 'text/plain'
    elif file_name.endswith('.py'):
        mime_type = 'text/x-python'
    elif file_name.endswith('.json'):
        mime_type = 'application/json'
    elif file_name.endswith('.sh'):
        mime_type = 'text/x-sh'
    else:
        mime_type = 'text/plain'

    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)

    if existing_files:
        # Update existing file
        file_id = existing_files[0]['id']
        try:
            file = service.files().update(
                fileId=file_id,
                media_body=media,
                supportsAllDrives=True
            ).execute()
            print(f"  ✓ Updated: {file_name}")
            return file['id']
        except HttpError as error:
            print(f"  ✗ Failed to update {file_name}: {error}")
            return None
    else:
        # Create new file
        file_metadata = {
            'name': file_name,
            'parents': [parent_folder_id]
        }
        try:
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            ).execute()
            print(f"  ✓ Uploaded: {file_name}")
            return file['id']
        except HttpError as error:
            print(f"  ✗ Failed to upload {file_name}: {error}")
            return None

def find_or_create_folder(service, folder_name, parent_id):
    """Find or create a folder in Google Drive"""
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

    if folders:
        return folders[0]['id']
    else:
        # Create folder
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(
            body=file_metadata,
            fields='id',
            supportsAllDrives=True
        ).execute()
        print(f"  ✓ Created folder: {folder_name}")
        return folder['id']

def sync_project(service, local_project_dir, parent_folder_id, project_name):
    """Sync a project directory to Google Drive"""
    print(f"\n📁 Syncing {project_name}...")

    # Find or create project folder
    project_folder_id = find_or_create_folder(service, project_name, parent_folder_id)

    # Upload all files in the project directory
    for file_path in Path(local_project_dir).glob('*'):
        if file_path.is_file():
            upload_file(service, str(file_path), project_folder_id, project_name)

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

    # Sync each project
    for project in projects:
        project_path = os.path.join(local_dir, project)
        if os.path.exists(project_path):
            sync_project(service, project_path, drive_folder_id, project)
        else:
            print(f"⚠ Project directory not found: {project_path}")

    print(f"\n✓ Sync complete!")

if __name__ == '__main__':
    main()
PYEOF

chmod +x /tmp/sync_to_drive.py

# Run the Python script
echo ""
python3 /tmp/sync_to_drive.py "$DRIVE_CODE_FOLDER_ID" "$LOCAL_DIR" "${PROJECTS[@]}"

# Cleanup
rm /tmp/sync_to_drive.py

echo ""
echo -e "${GREEN}Sync to Google Drive complete!${NC}"
echo ""
echo "View files at: https://drive.google.com/drive/folders/$DRIVE_CODE_FOLDER_ID"
