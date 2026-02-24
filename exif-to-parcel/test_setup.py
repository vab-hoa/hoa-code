#!/usr/bin/env python3
"""
Test script to verify installation and check a few sample photos.
"""

import sys
import os
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed."""
    print("Checking dependencies...")

    missing = []

    try:
        import PIL
        print("  ✓ Pillow (PIL) installed")
    except ImportError:
        print("  ✗ Pillow (PIL) NOT installed")
        missing.append("Pillow")

    try:
        import shapely
        print("  ✓ Shapely installed")
    except ImportError:
        print("  ✗ Shapely NOT installed")
        missing.append("shapely")

    if missing:
        print(f"\nMissing dependencies: {', '.join(missing)}")
        print("Install with: pip install " + " ".join(missing))
        return False

    print("\nAll dependencies installed!")
    return True


def test_data_files():
    """Check if data files exist."""
    print("\nChecking data files...")

    files = {
        "Photos": "/home/dee/Documents/Villas at the Boulders/Gutters/gallery-glassmonkey",
        "Parcels": "/home/dee/Documents/Villas at the Boulders/Maps/GIS Data/Parcels.geojson"
    }

    all_exist = True
    for name, path in files.items():
        if os.path.exists(path):
            print(f"  ✓ {name}: {path}")
        else:
            print(f"  ✗ {name} NOT FOUND: {path}")
            all_exist = False

    return all_exist


def test_sample_photos():
    """Test GPS extraction from a few sample photos."""
    print("\nTesting sample photos...")

    try:
        from PIL import Image
        from PIL.ExifTags import TAGS, GPSTAGS
    except ImportError:
        print("  Skipping (Pillow not installed)")
        return

    photo_dir = Path("/home/dee/Documents/Villas at the Boulders/Gutters/gallery-glassmonkey")

    if not photo_dir.exists():
        print("  Photo directory not found")
        return

    # Test first 5 photos
    photos = list(photo_dir.glob("*.jpg"))[:5]

    gps_count = 0
    no_gps_count = 0

    for photo in photos:
        try:
            image = Image.open(photo)
            exif_data = image._getexif()

            has_gps = False
            if exif_data:
                for tag, value in exif_data.items():
                    if TAGS.get(tag) == 'GPSInfo':
                        has_gps = True
                        gps_count += 1
                        print(f"  ✓ {photo.name}: Has GPS data")
                        break

            if not has_gps:
                no_gps_count += 1
                print(f"  - {photo.name}: No GPS data")

        except Exception as e:
            print(f"  ✗ {photo.name}: Error - {e}")

    print(f"\nSample results: {gps_count} with GPS, {no_gps_count} without GPS")


def main():
    print("=" * 60)
    print("Photo to Parcel Matcher - Setup Test")
    print("=" * 60)
    print()

    deps_ok = check_dependencies()
    files_ok = test_data_files()

    if deps_ok:
        test_sample_photos()

    print("\n" + "=" * 60)

    if deps_ok and files_ok:
        print("✓ Setup looks good! Ready to run match_photos.py")
    else:
        print("✗ Please fix the issues above before running match_photos.py")

    print("=" * 60)


if __name__ == "__main__":
    main()
