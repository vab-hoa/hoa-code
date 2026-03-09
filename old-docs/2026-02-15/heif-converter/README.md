# HEIF to JPEG Auto-Converter

Automatically converts HEIF/HEIC images to JPEG in Google Drive folders.

## Problem

- Apps Script cannot handle HEIF images (iPhone photos) in PDF generation
- PropertyReport fails when trying to include HEIF images
- Manual conversion is tedious

## Solution

This script:
1. Scans specified Google Drive folders for HEIF/HEIC images
2. Downloads and converts them to JPEG format
3. Uploads the JPEG versions to the same folder
4. Moves original HEIF files to an archive folder

## Requirements

- Python 3.8+ (tested with 3.14)
- Pillow (image processing library)
- Google API client libraries
- Service account with Drive access

## Installation

```bash
cd ~/hoa-code/heif-converter

# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

Edit `heif_converter.py` to configure:

```python
# Folders to scan (line 24)
TARGET_FOLDERS = [
    'Gutter Pictures',
    # Add more folder names here
]

# Service account file location (line 23)
SERVICE_ACCOUNT_FILE = os.path.expanduser('~/.config/openclaw.jane/service-account-key.json')

# Archive folder name (line 29)
ARCHIVE_FOLDER_NAME = 'HEIF Originals Archive'
```

## Usage

### Dry Run (Safe - Shows What Would Happen)

```bash
./heif_converter.py --dry-run
```

### Convert All Images

```bash
./heif_converter.py
```

### Convert Specific Folders

```bash
./heif_converter.py --folders "Gutter Pictures" "Wood Trim Photos"
```

### Custom Service Account

```bash
./heif_converter.py --service-account /path/to/credentials.json
```

## How It Works

1. **Authentication**: Uses service account to access Drive as admin@villasboulders.org
2. **Scanning**: Recursively searches folders for HEIF/HEIC images
3. **Conversion**:
   - Downloads HEIF image
   - Converts to JPEG (90% quality)
   - Handles transparency (converts to white background)
4. **Upload**: Saves JPEG with same name (`.jpg` extension)
5. **Archive**: Moves original HEIF to "HEIF Originals Archive" subfolder
6. **Skip Duplicates**: Won't reconvert if JPEG already exists

## Automation

Run daily via cron to automatically convert new HEIF uploads:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 3 AM)
0 3 * * * cd /home/dee/hoa-code/heif-converter && /home/dee/hoa-code/heif-converter/venv/bin/python3 heif_converter.py >> /tmp/heif-converter.log 2>&1
```

## Output Example

```
HEIF to JPEG Converter
Started: 2026-02-15 14:30:00

============================================================
Processing folder: Gutter Pictures
============================================================
✓ Found folder: Gutter Pictures (ID: 1abc...)
✓ Found archive folder: HEIF Originals Archive

Searching for HEIF/HEIC images...
  Found 5 HEIF image(s)

Converting images...
    Processing: IMG_1234.HEIC
      ↓ Downloading...
      ⟳ Converting to JPEG...
      ↑ Uploading: IMG_1234.jpg
      📦 Archiving original...
      ✓ Converted successfully
    ...

============================================================
SUMMARY
============================================================
HEIF images found:  5
Successfully converted: 5
Skipped (already exists): 0
Errors: 0
Duration: 12.3 seconds
Completed: 2026-02-15 14:30:12
```

## Troubleshooting

### "Service account file not found"
- Check the path in `SERVICE_ACCOUNT_FILE`
- Make sure `~/.config/openclaw.jane/service-account-key.json` exists

### "Folder not found"
- Verify folder names match exactly (case-sensitive)
- Make sure admin@villasboulders.org has access to the folders

### "Permission denied"
- Service account needs domain-wide delegation
- Needs Drive API scope: `https://www.googleapis.com/auth/drive`

### PIL/Pillow errors
- Install/update Pillow: `pip install --upgrade Pillow`
- Some HEIF variants require additional codecs

## Safety Features

- **Dry run mode** - Test without making changes
- **Duplicate detection** - Won't overwrite existing JPEGs
- **Archive originals** - HEIF files preserved, not deleted
- **Error handling** - Continues processing on errors
- **Logging** - Detailed output of all actions

## Integration with PropertyReport

Once images are converted to JPEG:
1. PropertyReport will automatically find and use the JPEG versions
2. No code changes needed in PropertyReport
3. PDFs will include all images successfully

## Notes

- HEIF images are typically 30-50% smaller than equivalent JPEGs
- Conversion to JPEG increases file size but ensures compatibility
- Quality is set to 90% to balance file size and image quality
- Transparency in HEIF images is converted to white background

---

**Maintained By:** Dee Buck
**Created:** February 15, 2026
**Last Updated:** February 15, 2026
