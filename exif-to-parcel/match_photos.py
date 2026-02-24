#!/usr/bin/env python3
"""
Match contractor photos to HOA parcels using GPS EXIF data.
Organizes photos into folders by property address.
"""

import json
import os
import shutil
import csv
import re
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from shapely.geometry import Point, shape
from datetime import datetime
from collections import defaultdict


def get_gps_from_exif(image_path):
    """
    Extract GPS coordinates from image EXIF data.
    Returns (latitude, longitude) as decimal degrees, or None if not found.
    """
    try:
        image = Image.open(image_path)
        exif_data = image._getexif()

        if not exif_data:
            return None

        gps_info = {}
        for tag, value in exif_data.items():
            tag_name = TAGS.get(tag, tag)
            if tag_name == 'GPSInfo':
                for gps_tag in value:
                    gps_tag_name = GPSTAGS.get(gps_tag, gps_tag)
                    gps_info[gps_tag_name] = value[gps_tag]

        if not gps_info:
            return None

        # Extract latitude and longitude
        lat = gps_info.get('GPSLatitude')
        lat_ref = gps_info.get('GPSLatitudeRef')
        lon = gps_info.get('GPSLongitude')
        lon_ref = gps_info.get('GPSLongitudeRef')

        if not all([lat, lat_ref, lon, lon_ref]):
            return None

        # Convert from degrees/minutes/seconds to decimal degrees
        def dms_to_decimal(dms, ref):
            degrees = float(dms[0])
            minutes = float(dms[1])
            seconds = float(dms[2])
            decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
            if ref in ['S', 'W']:
                decimal = -decimal
            return decimal

        latitude = dms_to_decimal(lat, lat_ref)
        longitude = dms_to_decimal(lon, lon_ref)

        return (latitude, longitude)

    except Exception as e:
        print(f"Error reading EXIF from {image_path}: {e}")
        return None


def load_parcels(geojson_path):
    """
    Load parcels from GeoJSON file.
    Returns list of (address, polygon) tuples.
    """
    parcels = []

    print(f"Loading parcels from {geojson_path}...")
    with open(geojson_path, 'r') as f:
        data = json.load(f)

    for feature in data['features']:
        properties = feature.get('properties', {})
        address = properties.get('SITUS_FULL_ADDRESS')

        # Skip parcels without an address
        if not address or address == 'null':
            continue

        # Create shapely polygon from geometry
        try:
            polygon = shape(feature['geometry'])
            parcels.append((address, polygon))
        except Exception as e:
            print(f"Warning: Could not parse geometry for {address}: {e}")
            continue

    print(f"Loaded {len(parcels)} parcels with addresses")
    return parcels


def find_parcel_for_point(lat, lon, parcels):
    """
    Find which parcel contains the given GPS point.
    Returns address or None if not found.
    """
    point = Point(lon, lat)  # Note: shapely uses (x, y) = (lon, lat)

    for address, polygon in parcels:
        if polygon.contains(point):
            return address

    return None


def find_nearest_parcels(lat, lon, parcels, num_results=3):
    """
    Find the nearest parcels to a GPS point.
    Returns list of (address, distance_meters) tuples, sorted by distance.
    """
    point = Point(lon, lat)
    distances = []

    for address, polygon in parcels:
        # Calculate distance from point to polygon boundary
        distance = point.distance(polygon)
        # Convert to approximate meters (at this latitude, ~1 degree = ~111km)
        # More accurate: use geodesic distance, but this is close enough for sorting
        distance_meters = distance * 111000
        distances.append((address, distance_meters))

    # Sort by distance and return top N
    distances.sort(key=lambda x: x[1])
    return distances[:num_results]


def get_review_subfolder_name(nearest_parcels):
    """
    Generate a descriptive subfolder name for REVIEW based on nearest parcels.
    """
    if not nearest_parcels:
        return "unknown_location"

    if len(nearest_parcels) == 1:
        addr = nearest_parcels[0][0].replace(' ', '_').replace('/', '_')
        return f"near_{addr}"

    # If multiple parcels are very close (within 5 meters), it's between them
    if len(nearest_parcels) >= 2 and nearest_parcels[1][1] < 5:
        addr1 = nearest_parcels[0][0].split()[0]  # Get house number
        addr2 = nearest_parcels[1][0].split()[0]
        street = ' '.join(nearest_parcels[0][0].split()[1:]).replace(' ', '_').replace('/', '_')
        return f"between_{addr1}_and_{addr2}_{street}"
    else:
        # Just use the nearest one
        addr = nearest_parcels[0][0].replace(' ', '_').replace('/', '_')
        return f"near_{addr}"


def sanitize_folder_name(address):
    """
    Convert address to a safe folder name.
    """
    # Remove invalid characters for folder names
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        address = address.replace(char, '_')

    # Trim whitespace and dots
    address = address.strip('. ')

    return address


def parse_sequence_number(filename):
    """
    Extract sequence number from filename.
    Pattern: <sequence>-MMM DD, YYYY hh-mm-ss-<id>.jpg
    Returns sequence number as int, or None if not found.
    """
    match = re.match(r'^(\d+)-', filename)
    if match:
        return int(match.group(1))
    return None


def parse_timestamp(filename):
    """
    Extract timestamp from filename.
    Pattern: <sequence>-MMM DD, YYYY hh-mm-ss-<id>.jpg
    Returns datetime object, or None if not found.
    """
    # Pattern: 547-Dec 23, 2025 18-12-47-MrkN.jpg
    pattern = r'^\d+-([A-Za-z]+) (\d+), (\d{4}) (\d+)-(\d+)-(\d+)-'
    match = re.match(pattern, filename)

    if match:
        month_str, day, year, hour, minute, second = match.groups()
        try:
            dt = datetime.strptime(f"{month_str} {day} {year} {hour}:{minute}:{second}",
                                   "%b %d %Y %H:%M:%S")
            return dt
        except ValueError:
            return None
    return None


def infer_addresses_from_neighbors(results, output_base_dir, max_time_gap_minutes=30):
    """
    Infer addresses for NO_MATCH photos using sequence numbers and timestamps.
    If neighbors on both sides (or a strong cluster) match the same address,
    assign that address to the unmatched photo.

    Returns updated results and stats about rescued photos.
    """
    output_base_dir = Path(output_base_dir)
    review_dir = output_base_dir / "REVIEW"

    # Build a map of sequence -> result
    seq_to_result = {}
    for result in results:
        seq = parse_sequence_number(result['filename'])
        if seq is not None:
            seq_to_result[seq] = result

    # Find NO_MATCH photos
    no_match_results = [r for r in results if r['status'] == 'NO_MATCH']

    print(f"\n\nAttempting to infer addresses for {len(no_match_results)} unmatched photos...")

    rescued = 0
    still_unmatched = 0

    for result in no_match_results:
        seq = parse_sequence_number(result['filename'])
        timestamp = parse_timestamp(result['filename'])

        if seq is None:
            still_unmatched += 1
            continue

        # Look at neighbors by sequence number
        # Check up to 10 neighbors on each side
        neighbor_range = 10
        neighbor_addresses = []

        for offset in range(-neighbor_range, neighbor_range + 1):
            if offset == 0:
                continue

            neighbor_seq = seq + offset
            neighbor_result = seq_to_result.get(neighbor_seq)

            if neighbor_result and neighbor_result['status'] == 'MATCHED':
                neighbor_addr = neighbor_result['address']
                neighbor_ts = parse_timestamp(neighbor_result['filename'])

                # Check time proximity if timestamps available
                if timestamp and neighbor_ts:
                    time_diff_minutes = abs((timestamp - neighbor_ts).total_seconds() / 60)
                    if time_diff_minutes <= max_time_gap_minutes:
                        neighbor_addresses.append((neighbor_addr, abs(offset), time_diff_minutes))
                else:
                    # No timestamp check, just use sequence proximity
                    neighbor_addresses.append((neighbor_addr, abs(offset), 999))

        # Infer address from neighbors
        if neighbor_addresses:
            # Count addresses by frequency
            address_counts = defaultdict(list)
            for addr, distance, time_gap in neighbor_addresses:
                address_counts[addr].append((distance, time_gap))

            # Find the most common address
            # Weight by frequency and proximity
            best_address = None
            best_score = 0

            for addr, occurrences in address_counts.items():
                # Score = count / average_distance
                count = len(occurrences)
                avg_distance = sum(d for d, _ in occurrences) / count
                score = count / avg_distance

                if score > best_score:
                    best_score = score
                    best_address = addr

            # Check for immediate neighbors (sandwich pattern)
            # If both immediate neighbors match, that's very strong evidence
            prev_result = seq_to_result.get(seq - 1)
            next_result = seq_to_result.get(seq + 1)

            sandwich_match = False
            if (prev_result and prev_result['status'] == 'MATCHED' and
                next_result and next_result['status'] == 'MATCHED' and
                prev_result['address'] == next_result['address']):
                best_address = prev_result['address']
                sandwich_match = True

            # Assign the inferred address
            if best_address and (sandwich_match or best_score >= 0.5):
                result['address'] = best_address
                result['status'] = 'INFERRED'

                # Move photo from REVIEW to address folder
                src_path = review_dir / result['filename']
                if src_path.exists():
                    folder_name = sanitize_folder_name(best_address)
                    address_dir = output_base_dir / folder_name
                    address_dir.mkdir(parents=True, exist_ok=True)

                    dest_path = address_dir / result['filename']
                    shutil.move(str(src_path), str(dest_path))

                    rescued += 1
                else:
                    still_unmatched += 1
            else:
                still_unmatched += 1
        else:
            still_unmatched += 1

    print(f"  Rescued {rescued} photos using neighbor inference")
    print(f"  Still in REVIEW: {still_unmatched}")

    return results, rescued


def process_photos(photo_dir, parcels, output_base_dir):
    """
    Process all photos: extract GPS, match to parcels, organize into folders.
    Returns list of results for CSV logging.
    """
    photo_dir = Path(photo_dir)
    output_base_dir = Path(output_base_dir)

    # Create output directories
    no_gps_dir = output_base_dir / "NO_GPS"
    review_dir = output_base_dir / "REVIEW"
    no_gps_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)

    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'}
    photo_files = [f for f in photo_dir.iterdir()
                   if f.is_file() and f.suffix in image_extensions]

    # Sort by filename to maintain sequence order
    photo_files.sort(key=lambda x: x.name)

    print(f"\nProcessing {len(photo_files)} photos...")

    results = []
    stats = {
        'total': len(photo_files),
        'matched': 0,
        'no_gps': 0,
        'no_match': 0
    }

    for i, photo_path in enumerate(photo_files, 1):
        if i % 100 == 0:
            print(f"  Processed {i}/{len(photo_files)} photos...")

        result = {
            'filename': photo_path.name,
            'latitude': None,
            'longitude': None,
            'address': None,
            'status': None,
            'nearest_parcels': None,
            'distance_to_nearest': None,
            'previous_photo_address': None,
            'next_photo_address': None
        }

        # Extract GPS coordinates
        coords = get_gps_from_exif(photo_path)

        if coords is None:
            # No GPS data
            result['status'] = 'NO_GPS'
            dest_path = no_gps_dir / photo_path.name
            shutil.copy2(photo_path, dest_path)
            stats['no_gps'] += 1
        else:
            lat, lon = coords
            result['latitude'] = lat
            result['longitude'] = lon

            # Find matching parcel
            address = find_parcel_for_point(lat, lon, parcels)

            if address:
                # Match found
                result['address'] = address
                result['status'] = 'MATCHED'

                # Create address folder and copy photo
                folder_name = sanitize_folder_name(address)
                address_dir = output_base_dir / folder_name
                address_dir.mkdir(parents=True, exist_ok=True)

                dest_path = address_dir / photo_path.name
                shutil.copy2(photo_path, dest_path)
                stats['matched'] += 1
            else:
                # No matching parcel - will be organized later with hints
                result['status'] = 'NO_MATCH'
                stats['no_match'] += 1

        results.append(result)

    print(f"\nProcessing complete!")
    print(f"  Total photos: {stats['total']}")
    print(f"  Matched to parcels: {stats['matched']}")
    print(f"  No GPS data: {stats['no_gps']}")
    print(f"  No matching parcel: {stats['no_match']}")

    return results


def add_review_hints_and_organize(results, parcels, photo_dir, output_base_dir):
    """
    For remaining NO_MATCH photos, add hints and organize into REVIEW subfolders.
    Calculates nearest parcels, sequence neighbors, and creates organized subfolders.
    """
    photo_dir = Path(photo_dir)
    output_base_dir = Path(output_base_dir)
    review_base = output_base_dir / "REVIEW"

    # Build sequence map for neighbor lookups
    seq_to_result = {}
    for result in results:
        seq = parse_sequence_number(result['filename'])
        if seq is not None:
            seq_to_result[seq] = result

    no_match_results = [r for r in results if r['status'] == 'NO_MATCH']

    if not no_match_results:
        print("\nNo photos in REVIEW - all photos were matched or inferred!")
        return results

    print(f"\n\nAdding review hints for {len(no_match_results)} unmatched photos...")

    for result in no_match_results:
        # Find nearest parcels
        if result['latitude'] and result['longitude']:
            nearest = find_nearest_parcels(result['latitude'], result['longitude'], parcels, num_results=3)

            if nearest:
                # Format nearest parcels as "addr1 (5m), addr2 (12m), addr3 (18m)"
                nearest_str = "; ".join([f"{addr} ({dist:.1f}m)" for addr, dist in nearest])
                result['nearest_parcels'] = nearest_str
                result['distance_to_nearest'] = f"{nearest[0][1]:.1f}"

        # Find sequence neighbors
        seq = parse_sequence_number(result['filename'])
        if seq is not None:
            # Previous photo
            prev_result = seq_to_result.get(seq - 1)
            if prev_result and prev_result.get('address'):
                result['previous_photo_address'] = prev_result['address']

            # Next photo
            next_result = seq_to_result.get(seq + 1)
            if next_result and next_result.get('address'):
                result['next_photo_address'] = next_result['address']

        # Organize into subfolder
        if result['latitude'] and result['longitude']:
            nearest = find_nearest_parcels(result['latitude'], result['longitude'], parcels, num_results=3)
            subfolder_name = get_review_subfolder_name(nearest)
        else:
            subfolder_name = "no_gps_data"

        subfolder_path = review_base / subfolder_name
        subfolder_path.mkdir(parents=True, exist_ok=True)

        # Copy photo to subfolder
        src_path = photo_dir / result['filename']
        dest_path = subfolder_path / result['filename']

        if src_path.exists():
            shutil.copy2(src_path, dest_path)

    print(f"  Organized into REVIEW subfolders by location")

    return results


def write_csv_log(results, output_path):
    """
    Write results to CSV log file.
    """
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'filename', 'latitude', 'longitude', 'address', 'status',
            'nearest_parcels', 'distance_to_nearest',
            'previous_photo_address', 'next_photo_address'
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\nCSV log written to: {output_path}")


def main():
    # Configuration
    PHOTO_DIR = "/home/dee/Documents/Villas at the Boulders/Gutters/gallery-glassmonkey"
    PARCELS_FILE = "/home/dee/Documents/Villas at the Boulders/Maps/GIS Data/Parcels.geojson"
    OUTPUT_DIR = "/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel/output"

    print("=" * 60)
    print("Photo to Parcel Matcher")
    print("=" * 60)

    # Load parcels
    parcels = load_parcels(PARCELS_FILE)

    # Process photos (initial GPS-based matching)
    results = process_photos(PHOTO_DIR, parcels, OUTPUT_DIR)

    # Infer addresses for unmatched photos using neighbor/clustering logic
    results, rescued_count = infer_addresses_from_neighbors(results, OUTPUT_DIR)

    # Add hints and organize remaining REVIEW photos
    results = add_review_hints_and_organize(results, parcels, PHOTO_DIR, OUTPUT_DIR)

    # Write CSV log
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = f"/home/dee/Documents/Villas at the Boulders/Code/exif-to-parcel/photo_log_{timestamp}.csv"
    write_csv_log(results, csv_path)

    # Final summary
    matched = len([r for r in results if r['status'] == 'MATCHED'])
    inferred = len([r for r in results if r['status'] == 'INFERRED'])
    no_gps = len([r for r in results if r['status'] == 'NO_GPS'])
    no_match = len([r for r in results if r['status'] == 'NO_MATCH'])

    print("\n" + "=" * 60)
    print("Final Summary:")
    print(f"  Total photos: {len(results)}")
    print(f"  GPS-matched to parcels: {matched}")
    print(f"  Inferred from neighbors: {inferred}")
    print(f"  No GPS data: {no_gps}")
    print(f"  Still in REVIEW: {no_match}")
    print(f"\nSuccessfully organized: {matched + inferred} photos")
    print("=" * 60)
    print("Done!")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"REVIEW photos organized in subfolders by nearest location")
    print("=" * 60)


if __name__ == "__main__":
    main()
