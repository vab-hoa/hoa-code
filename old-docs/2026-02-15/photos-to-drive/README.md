# Google Photos to Drive Sync Tool

Automatically sync photos from Google Photos albums to Google Drive folders with automatic HEIF→JPEG conversion.

## Problem Solved

**Current manual process:**
1. Contractor shares photos via Google Photos
2. Volunteer downloads photos to computer
3. Volunteer uploads to Drive folders
4. HEIF images cause problems in PropertyReport

**With this tool:**
1. Contractor shares album with admin@villasboulders.org
2. Run sync script (one command)
3. Photos appear in Drive as JPEGs automatically
4. PropertyReport works perfectly

## Features

- ✅ Automatic HEIF → JPEG conversion
- ✅ Syncs from Google Photos albums to Drive folders
- ✅ Tracks synced photos (no duplicates)
- ✅ Supports shared drive (HOA Board Documents)
- ✅ Dry-run mode to preview
- ✅ Flexible album-to-folder mapping
- ✅ Handles both project albums and address-based albums

## Installation

```bash
cd ~/hoa-code/photos-to-drive

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Setup Workflow

### Step 1: Discover Albums

List all Google Photos albums available to admin@villasboulders.org:

```bash
./venv/bin/python3 photos_to_drive.py --list-albums
```

**Output:**
```
Found 15 albums:

Album Name                                          # Photos     ID
====================================================================================================
Gutter Cleaning Dec 2025                            24           ABnLpGp1234567890...
13737 Rock Point Unit 102                           8            ABnLpGp0987654321...
Window Wells Project 2025                           42           ABnLpGp1122334455...
...

✓ Sample configuration created: sync_config.yaml.example
```

### Step 2: Configure Syncs

Edit the generated `sync_config.yaml.example`:

```yaml
syncs:
  # Project-based album example
  - album_name: "Gutter Cleaning Dec 2025"
    album_id: "ABnLpGp1234567890..."  # From --list-albums
    drive_folder: "Gutter Pictures"   # Folder in HOA Board Documents
    auto_convert_heif: true
    enabled: true

  # Address-based album example
  - album_name: "13737 Rock Point Unit 102"
    album_id: "ABnLpGp0987654321..."
    drive_folder: "Gutter Pictures/13737 Rock Point"  # Can create subfolders
    auto_convert_heif: true
    enabled: true

  # Window wells project
  - album_name: "Window Wells Project 2025"
    album_id: "ABnLpGp1122334455..."
    drive_folder: "Window Wells/2025 Inspection"
    auto_convert_heif: true
    enabled: false  # Not ready yet
```

**Save as `sync_config.yaml`** (remove `.example` suffix)

### Step 3: Test with Dry Run

Preview what would happen without making changes:

```bash
./venv/bin/python3 photos_to_drive.py --sync --dry-run
```

**Output:**
```
Starting sync of 2 album(s)...

*** DRY RUN MODE - No changes will be made ***

Syncing: Gutter Cleaning Dec 2025
  → Drive folder: Gutter Pictures
  ✓ Found album: ABnLpGp1234567890...
  Fetching photos from album...
  Found 24 photos
    Syncing: IMG_1234.HEIC
      [DRY RUN] Would download and upload
    ...
  Synced: 24, Skipped: 0
```

### Step 4: Run Actual Sync

When dry-run looks good:

```bash
./venv/bin/python3 photos_to_drive.py --sync
```

**Output:**
```
Syncing: Gutter Cleaning Dec 2025
  → Drive folder: Gutter Pictures
  Found 24 photos
    Syncing: IMG_1234.HEIC
      ↓ Downloading...
      ⟳ Converting HEIF to JPEG...
      ↑ Uploading to Drive...
      ✓ Synced successfully
    ...
  Synced: 24, Skipped: 0

======================================
SUMMARY
======================================
Albums processed: 2
Photos found: 32
Photos synced: 32
Photos skipped (already synced): 0
HEIF conversions: 18
Errors: 0
Duration: 45.2 seconds
```

## Configuration Options

### Album Mapping

```yaml
syncs:
  - album_name: "Album Name"        # Exact name from Google Photos
    album_id: "ABnLpGp..."          # Optional but recommended (faster)
    drive_folder: "Path/To/Folder"  # Can be nested with /
    auto_convert_heif: true         # Convert HEIF to JPEG (recommended)
    enabled: true                   # Set false to skip this sync
```

### Drive Folder Paths

- **Simple:** `"Gutter Pictures"` - Top-level folder in HOA Board Documents
- **Nested:** `"Gutter Pictures/2025"` - Creates subfolder if needed
- **Deep:** `"Projects/Gutters/Dec 2025"` - Multiple levels

The tool will create folders if they don't exist.

## Workflow Examples

### Scenario 1: Gutter Cleaning Project

1. Contractor shares album: "Gutter Cleaning Dec 2025" with admin@villasboulders.org
2. Run: `--list-albums` to see it
3. Add to config: map to `"Gutter Pictures"`
4. Run: `--sync`
5. All photos appear in Drive, HEIF converted to JPEG
6. PropertyReport can now use them

### Scenario 2: Per-House Photos

1. Contractor creates albums per house: "13737 Rock Point Unit 102", etc.
2. Shares all albums with admin@villasboulders.org
3. Add each to config with drive_folder like: `"Gutter Pictures/13737RP2"`
4. Run: `--sync`
5. Each house gets its own subfolder

### Scenario 3: Mixed Workflow

Some photos in:
- Shared albums (from contractors)
- Main Google Photos library (uploaded by volunteers)

**Solution:** Have volunteers create albums in Google Photos, then use this tool to sync.

## Sync History & Duplicates

The tool tracks synced photos in `sync_history.json`:

```json
{
  "ABnLpGp123:Gutter Pictures": {
    "photo_id": "ABnLpGp123",
    "drive_folder": "Gutter Pictures",
    "drive_file_id": "1abc...def",
    "synced_at": "2026-02-15T14:30:00"
  }
}
```

**Benefits:**
- Run sync multiple times safely (won't duplicate)
- Add new photos to album, re-run sync (only new ones transfer)
- Can delete local sync_history.json to re-sync everything

## Automation

Run automatically when new photos arrive:

```bash
# Edit crontab
crontab -e

# Add daily sync at 4 AM
0 4 * * * cd /home/dee/hoa-code/photos-to-drive && /home/dee/hoa-code/photos-to-drive/venv/bin/python3 photos_to_drive.py --sync >> /tmp/photos-sync.log 2>&1
```

Or run manually whenever contractor sends photos.

## Sharing Albums

**Contractors/Volunteers:**
1. Create album in Google Photos
2. Click "Share" → "Send in Google Photos"
3. Share with: admin@villasboulders.org
4. Photos appear when running `--list-albums`

**Access types:**
- Shared album (contractor owns, HOA can view)
- Collaborative album (multiple people can add photos)

Both work with this tool.

## Troubleshooting

### "No albums found"

- Check admin@villasboulders.org actually has albums
- Make sure albums are shared WITH admin (not just links)
- Try web interface: photos.google.com to verify

### "Album not found"

- Album name might have changed
- Use `--list-albums` to get current names
- Try using `album_id` instead of name

### "Drive folder not found"

- Check folder exists in HOA Board Documents shared drive
- Verify exact spelling (case-sensitive)
- Check folder path uses `/` for nesting

### HEIF conversion fails

- Some HEIF variants need extra codecs
- Set `auto_convert_heif: false` to upload as-is
- Or manually convert before uploading to Photos

### Permission errors

- Service account needs Photos API scope
- Service account needs Drive access to shared drive
- Check domain-wide delegation includes Photos API

## Command Reference

```bash
# List all albums
python3 photos_to_drive.py --list-albums

# Test sync (no changes)
python3 photos_to_drive.py --sync --dry-run

# Actually sync
python3 photos_to_drive.py --sync

# Use custom config file
python3 photos_to_drive.py --sync --config my_config.yaml

# Custom service account
python3 photos_to_drive.py --sync --service-account /path/to/creds.json
```

## Integration with PropertyReport

Once photos are in Drive:

1. **Gutter folder images**: PropertyReport automatically finds them in folders
2. **Wood trim spreadsheet**: Add Drive file links to spreadsheet columns
3. **All JPEGs**: PropertyReport can include them in PDFs

No code changes needed in PropertyReport!

## Notes

- **HEIF → JPEG**: Quality set to 90% (good balance)
- **Transparency**: Converted to white background
- **File names**: Preserved from Google Photos
- **Duplicates**: Detected by photo ID, not filename
- **Speed**: ~1-2 photos/second (depends on size)

---

**Created:** February 15, 2026
**Maintained By:** Dee Buck
