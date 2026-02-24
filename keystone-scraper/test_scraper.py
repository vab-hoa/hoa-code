#!/usr/bin/env python3
"""
Test script for Keystone scraper.
Run this to test the scraper without writing to Google Sheets.
"""

import sys
from keystone_scraper import KeystoneScraper

def test_scraper():
    """Test the scraper in dry-run mode."""
    print("=" * 60)
    print("Testing Keystone Scraper (Dry Run)")
    print("=" * 60)
    print()
    print("This will:")
    print("  1. Open a visible browser window")
    print("  2. Login to Keystone portal")
    print("  3. Scrape all data sources")
    print("  4. Display sample data (without writing to Google Sheets)")
    print()
    input("Press Enter to continue...")

    with KeystoneScraper(headless=False, dry_run=True) as scraper:
        success = scraper.run()

    if success:
        print("\n✓ Test completed successfully!")
        print("\nNext steps:")
        print("  1. Review the scraped data above")
        print("  2. If it looks good, run: python keystone_scraper.py")
        print("  3. Set up a cron job to run regularly (see README.md)")
        return 0
    else:
        print("\n✗ Test failed!")
        print("\nTroubleshooting:")
        print("  1. Check that credentials are correct in keystone_scraper.py")
        print("  2. Check that the Keystone portal is accessible")
        print("  3. Look at screenshots in /tmp/keystone_*.png")
        return 1


if __name__ == '__main__':
    sys.exit(test_scraper())
