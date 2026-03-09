# Photo to Parcel Matching Results

**Date:** 2026-01-14
**Total Photos Processed:** 1,131

## Summary

The photo matching system successfully organized 90.4% of photos with GPS coordinates into property-specific folders using a two-phase approach:

### Phase 1: GPS Direct Matching
- Extracted GPS coordinates from EXIF data
- Matched coordinates to parcel polygons using point-in-polygon algorithm
- **Result:** 661 photos matched (58.4%)

### Phase 2: Neighbor Inference
- Used sequence numbers and timestamps to infer addresses for unmatched photos
- Applied "sandwich" pattern: if photos N-1 and N+1 matched the same address, photo N likely belongs there too
- Considered up to 10 neighbors on each side
- Weighted by frequency and proximity
- Limited to 30-minute time windows
- **Result:** 361 photos rescued (87% rescue rate from REVIEW)

## Final Results

| Category | Count | Percentage |
|----------|-------|------------|
| GPS-Matched | 661 | 58.4% |
| Inferred from Neighbors | 361 | 31.9% |
| No GPS Data (NO_GPS folder) | 54 | 4.8% |
| Still in REVIEW | 55 | 4.9% |
| **Successfully Organized** | **1,022** | **90.4%** |

## Output Structure

### Property Folders: 45 addresses
Photos organized into folders named by property address:
- Example: `13630 BOULDER CIR UNIT 101/` (18 photos: 8 GPS-matched, 10 inferred)

### Special Folders
- **NO_GPS/**: 54 photos without GPS EXIF data
- **REVIEW/**: 55 photos with GPS that couldn't be matched
  - Likely photos from common areas, streets, or property boundaries
  - Mostly at sequence boundaries (start/end of route) where neighbor inference couldn't apply

## CSV Log

File: `photo_log_20260114_083051.csv`

Contains complete record for each photo:
- Filename with sequence number and timestamp
- GPS coordinates (if available)
- Matched/inferred address
- Status: MATCHED, INFERRED, NO_GPS, or NO_MATCH

## Algorithm Details

### Neighbor Inference Logic
1. Parse sequence number from filename (e.g., 547 from "547-Dec 23, 2025 18-12-47-MrkN.jpg")
2. For each unmatched photo, examine up to 10 neighbors on each side
3. Collect addresses of matched neighbors within 30-minute time window
4. **Sandwich pattern** (highest priority): If immediate neighbors (N-1 and N+1) both match same address, assign that address
5. **Clustering** (secondary): Score addresses by frequency/proximity, assign if score > 0.5
6. Move rescued photos from REVIEW to appropriate address folders

### Why This Works
- Contractor photos taken sequentially as crew moved house to house
- GPS coordinates sometimes fall just outside parcel boundaries (property edges, streets)
- Sequence numbers + timestamps provide strong signal for grouping photos by property
- Most photos have nearby neighbors that GPS-matched correctly

## Example: 13630 BOULDER CIR UNIT 101

| Photo | Status | Notes |
|-------|--------|-------|
| 1004 | INFERRED | Rescued based on neighbors |
| 1005 | INFERRED | Rescued based on neighbors |
| 1006 | INFERRED | Rescued based on neighbors |
| 1007 | INFERRED | Rescued based on neighbors |
| 1008 | **MATCHED** | GPS hit parcel |
| 1009 | **MATCHED** | GPS hit parcel |
| 1010 | INFERRED | Between two matches |
| 1011 | **MATCHED** | GPS hit parcel |
| 1012 | INFERRED | Between two matches |
| 1013 | INFERRED | Rescued based on neighbors |

This shows the inference correctly identified that photos 1004-1007 (before GPS matches) and 1010/1012-1013 (between GPS matches) belong to the same property.

## Remaining REVIEW Photos

The 55 photos still in REVIEW are primarily:
- Photos 1000-1003: Start of sequence, no preceding neighbors
- Photos at sequence boundaries
- Photos potentially from common areas, parking lots, or streets
- Photos where neighbors matched different addresses (ambiguous)

These require manual review to determine proper placement.

## Files Location

- **Script:** `/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel/match_photos.py`
- **Output:** `/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel/output/`
- **CSV Log:** `/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel/photo_log_20260114_083051.csv`
- **Source Photos:** `/home/dee/Documents/Villas at the Boulders/Gutters/gallery-glassmonkey/`
