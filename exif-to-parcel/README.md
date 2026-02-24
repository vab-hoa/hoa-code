# Photo to Parcel Matcher

Matches contractor photos to HOA properties using GPS data from EXIF metadata.

## Features

### Phase 1: GPS Direct Matching
- Extracts GPS coordinates from photo EXIF data
- Matches GPS points to parcel polygons from GeoJSON using Shapely point-in-polygon
- Organizes photos into folders by property address

### Phase 2: Neighbor Inference (Smart Clustering)
- Parses sequence numbers and timestamps from filenames
- Infers addresses for unmatched photos based on neighbors
- **Sandwich pattern**: If photos N-1 and N+1 matched the same address, photo N likely belongs there
- **Clustering**: Scores addresses by frequency and proximity (up to 10 neighbors each side)
- **Time windows**: Only considers neighbors within 30-minute windows
- Typically rescues 85-90% of unmatched photos

### Special Handling
- `NO_GPS/` - Photos without GPS coordinates
- `REVIEW/` - Photos that couldn't be matched (typically 5%)
- Generates timestamped CSV log with status: MATCHED, INFERRED, NO_GPS, or NO_MATCH

## Installation

A virtual environment with all dependencies is already set up in the `venv/` directory.

If you need to recreate it:
```bash
cd "/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Usage

Activate the virtual environment and run the script:

```bash
cd "/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel"
source venv/bin/activate
python match_photos.py
```

Or use the venv Python directly without activating:
```bash
cd "/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel"
venv/bin/python match_photos.py
```

The script will:
1. Load parcels from the GeoJSON file (26,640 parcels)
2. Process all photos in the gallery directory
3. Match photos to parcels using GPS coordinates
4. Infer addresses for unmatched photos using neighbor clustering
5. Copy photos to folders organized by address
6. Generate a CSV log file with complete results

## Output

### Directory Structure
```
output/
├── NO_GPS/              # Photos without GPS data
├── REVIEW/              # Photos that don't match any parcel
├── [Address 1]/         # Photos matched to address 1
├── [Address 2]/         # Photos matched to address 2
└── ...
```

### CSV Log
File: `photo_log_[timestamp].csv`

Columns:
- `filename` - Original photo filename (includes sequence number and timestamp)
- `latitude` - Decimal degrees latitude (if available)
- `longitude` - Decimal degrees longitude (if available)
- `address` - Matched or inferred property address (if found)
- `status` - One of:
  - `MATCHED` - GPS coordinates matched a parcel directly
  - `INFERRED` - Address inferred from neighbor photos
  - `NO_GPS` - No GPS data in EXIF
  - `NO_MATCH` - Has GPS but couldn't match or infer address

## Latest Results

**Date:** 2026-01-14
**Photos:** 1,131 total

| Category | Count | Percentage |
|----------|-------|------------|
| GPS-Matched | 661 | 58.4% |
| Inferred from Neighbors | 361 | 31.9% |
| Successfully Organized | **1,022** | **90.4%** |
| No GPS Data | 54 | 4.8% |
| Still in REVIEW | 55 | 4.9% |

See `RESULTS.md` for detailed analysis.

## Configuration

Edit the following variables in `match_photos.py` if needed:
- `PHOTO_DIR` - Source photo directory
- `PARCELS_FILE` - Path to GeoJSON parcels file
- `OUTPUT_DIR` - Where to organize photos

## Data Sources

- Photos: `/home/dee/Documents/Villas at the Boulders/Gutters/gallery-glassmonkey/`
- Parcels: `/home/dee/Documents/Villas at the Boulders/Maps/GIS Data/Parcels.geojson`
- Members: `/home/dee/Documents/Villas at the Boulders/Member Lists/2026/Simple Member List Template.xls`

---

## Deployment

### Prerequisites

**Python Version:** Python 3.10 or higher

**Dependencies:**
- `Pillow >= 10.0.0` - Image processing and EXIF extraction
- `Shapely >= 2.0.0` - Geometric operations (point-in-polygon)

**Data Files Required:**
1. Parcels GeoJSON file (HOA property boundaries)
2. Photo directory with GPS-tagged images
3. (Optional) Member list for address validation

### Initial Setup

```bash
# Clone or copy project to desired location
cd "/path/to/project"

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify installation
python test_setup.py
```

### Running on New Photo Batch

1. **Place photos in source directory**
   ```bash
   # Copy new photos to gallery directory
   cp /path/to/new/photos/* "/home/dee/Documents/Villas at the Boulders/Gutters/gallery-glassmonkey/"
   ```

2. **Run the matcher**
   ```bash
   cd "/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel"
   venv/bin/python match_photos.py
   ```

3. **Review results**
   ```bash
   # Check output directory
   ls -la output/

   # Review log file
   cat photo_log_*.csv | tail -20

   # Check REVIEW folder for unmatched photos
   ls output/REVIEW/
   ```

4. **Upload organized photos to Google Drive**
   ```bash
   # Upload to Gutter Pictures folder
   # (Use Google Drive sync or manual upload)
   ```

---

## Troubleshooting

### Common Issues

#### 1. "No module named 'PIL'" or "No module named 'shapely'"

**Cause:** Dependencies not installed or virtual environment not activated

**Fix:**
```bash
# Activate virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

#### 2. "Parcels file not found"

**Cause:** GeoJSON file path incorrect or missing

**Fix:**
```bash
# Verify file exists
ls "/home/dee/Documents/Villas at the Boulders/Maps/GIS Data/Parcels.geojson"

# Update path in match_photos.py if needed
PARCELS_FILE = "/correct/path/to/Parcels.geojson"
```

#### 3. Photos Not Matching (High NO_MATCH rate)

**Possible Causes:**
- GPS coordinates not in EXIF data
- GPS coordinates outside parcel boundaries
- Parcel GeoJSON file outdated

**Diagnosis:**
```bash
# Check EXIF data manually
venv/bin/python -c "from PIL import Image; img = Image.open('photo.jpg'); print(img._getexif())"

# Check GPS coordinates in log file
cat photo_log_*.csv | grep "NO_GPS"
```

**Fixes:**
- Update parcels GeoJSON with latest HOA boundaries
- Verify photos are GPS-tagged (iPhone Camera, Android Camera)
- Check camera GPS settings enabled

#### 4. Low Inference Success Rate

**Cause:** Photos not sequentially numbered or taken far apart in time

**Expected:**
- Photos named like: `IMG_0001.jpg`, `IMG_0002.jpg`, `IMG_0003.jpg`
- Taken within 30 minutes of each other

**Not Supported:**
- Random filenames without sequence numbers
- Photos from different days mixed together

**Fix:**
- Ensure contractor numbers photos sequentially
- Process photos in batches by date/location

#### 5. Permission Denied on output/ directory

**Cause:** Insufficient permissions to write to output directory

**Fix:**
```bash
# Create output directory with correct permissions
mkdir -p output
chmod 755 output

# Or run with sudo (not recommended)
```

#### 6. Script Runs Very Slowly

**Cause:** Large number of photos or parcels

**Normal Performance:**
- ~1-2 seconds per photo
- 1,000 photos = ~15-20 minutes total

**Optimizations:**
- None needed for typical batches (< 2,000 photos)
- Consider parallel processing for very large batches (10,000+ photos)

#### 7. Photos Organized to Wrong Address

**Cause:** GPS coordinates on parcel boundary, neighbor inference error

**Fix:**
1. Check `REVIEW/` folder for borderline cases
2. Manually verify addresses using photo content
3. Move photos to correct folder if needed
4. Report systematic errors to developer

---

## Performance Metrics

**Typical Results:**
- 55-65% direct GPS matches
- 30-35% neighbor inference
- 5-10% review needed
- 90-95% overall success rate

**Success Factors:**
- GPS accuracy: ±5-10 meters typical for smartphone cameras
- Photo sequences: Contractor takes photos in order while walking property
- Time windows: Photos taken within 30 minutes for same property

---

## Maintenance

### Regular Tasks

**After Each Run:**
- Review `REVIEW/` folder for unmatched photos
- Check log file for error patterns
- Archive or delete old output directories

**Monthly:**
- Update parcels GeoJSON if boundaries change
- Clean up old log files
- Back up organized photo directories to Google Drive

**Annually:**
- Update member list for address validation
- Review and update parcel data from county GIS

### Updating Parcel Data

```bash
# Get latest GeoJSON from county
# Download to: /home/dee/Documents/Villas at the Boulders/Maps/GIS Data/Parcels_new.geojson

# Test with new file
PARCELS_FILE = "/path/to/Parcels_new.geojson"

# If successful, replace old file
mv Parcels_new.geojson Parcels.geojson
```

---

## Advanced Usage

### Custom Filtering

Edit `match_photos.py` to filter specific photo types:

```python
# Only process photos from specific date range
if '202601' in filename:  # January 2026 photos only
    process_photo(filename)
```

### Batch Processing

Process multiple photo directories:

```bash
for dir in gallery-1 gallery-2 gallery-3; do
    PHOTO_DIR="/path/to/$dir"
    venv/bin/python match_photos.py
done
```

### Export to Different Format

Modify output to create symlinks instead of copies:

```python
# In match_photos.py, replace shutil.copy2 with:
os.symlink(src, dst)
```

---

## Version Control

**Current Version:** 1.0 (January 2026)
**Status:** Production-ready

**To Add Git Tracking:**
```bash
cd "/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel"
git init
git add match_photos.py requirements.txt README.md RESULTS.md test_setup.py
git commit -m "Initial commit - Production version 1.0"
```

---

## Related Documentation

- `RESULTS.md` - Detailed analysis of latest run
- `REVIEW_HINTS_UPDATE.md` - Manual review guidance
- `~/hoa-code/README.md` - Master project index

---

## Support

**Developer:** Dee Buck (mcdonaldbuck@gmail.com)
**Purpose:** HOA gutter maintenance photo organization
**Status:** Actively maintained

**For Issues:**
1. Check this README troubleshooting section
2. Review log files for error details
3. Verify data sources are current
4. Contact developer if systematic errors occur

---

**Last Updated:** February 15, 2026
**Next Review:** After next photo batch processing
