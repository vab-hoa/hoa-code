# Keystone Scraper - Quick Start Guide

## UPDATED 2026-02-16: New Data Source

The scraper now uses **Accounts Receivable Detail** for cleaner data with account numbers!

## Test Run (Recommended First)

```bash
cd /home/dee/hoa-code/keystone-scraper
source venv/bin/activate
python3 keystone_scraper_selenium.py --headed --dry-run
```

**What this does:**
- Opens visible browser window
- Logs in to Keystone portal
- Scrapes account data from Accounts Receivable Detail page
- Shows sample data in console
- Does NOT write to Google Sheets
- Saves debug files to /tmp/

**Expected output:**
```
INFO - Login successful
INFO - Scraping Accounts Receivable Detail...
INFO - Found Accounts Receivable Detail link, clicking...
INFO - Found 150 potential rows
INFO - Found 148 homeowner profiles
[DRY RUN] Would write 148 rows to Profiles
[DRY RUN] Sample row: {'address': '13738RP1', 'account_number': '123456', ...}
```

## Production Run

```bash
cd /home/dee/hoa-code/keystone-scraper
source venv/bin/activate
python3 keystone_scraper_selenium.py
```

**What this does:**
- Runs in headless mode (no visible browser)
- Logs in to Keystone portal
- Scrapes from Accounts Receivable Detail (cleaner data!)
- Writes to Google Sheets with new format
- Updates Profiles, Violations, WorkOrders, ArchReviews tabs

## New Data Format

The **Profiles** sheet now has this format:
```
Address | AccountNumber | AccountName | LastUpdated | Source
13738RP1 | 123456 | John Smith | 2026-02-16 | Keystone
13747BP2 | 123457 | Jane Doe | 2026-02-16 | Keystone
```

**Key improvements:**
- Addresses in standardized HOA format (e.g., "13738RP1")
- Account numbers included for all homeowners
- Clean format (no timestamp rows that confuse parser)

## Verify Results

1. Check logs for "Scraping completed successfully"
2. Open spreadsheet: https://docs.google.com/spreadsheets/d/1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ
3. Look at Profiles tab - should have:
   - Header: Address | AccountNumber | AccountName | LastUpdated | Source
   - Data with standardized addresses (e.g., "13738RP1")
   - Account numbers filled in

## Debug Files

If issues occur, check:
- `/tmp/keystone_ar_source.html` - Page HTML from AR Detail
- `/tmp/keystone_ar_loaded.png` - Screenshot of loaded page
- `/tmp/keystone_ar_error.png` - Error screenshot (if error)

## Command Line Options

| Option | Description |
|--------|-------------|
| `--headed` | Show browser window (for debugging) |
| `--dry-run` | Don't write to sheets (for testing) |
| (none) | Normal run: headless mode, writes to sheets |

**Examples:**
```bash
# Normal run (headless, writes to sheets)
python3 keystone_scraper_selenium.py

# Visible browser for debugging
python3 keystone_scraper_selenium.py --headed

# Dry run (doesn't write, shows what it would do)
python3 keystone_scraper_selenium.py --dry-run

# Combination (visible + dry run)
python3 keystone_scraper_selenium.py --headed --dry-run
```

## Common Issues

**"Login failed"**
- Check credentials in script (lines 32-33)
- Try --headed to see what's happening
- Check for portal changes

**"No profiles found"**
- Run --headed --dry-run to see the page
- Check /tmp/keystone_ar_loaded.png
- Table structure may have changed

**"Unknown street name" warnings**
- Add new streets to `street_codes` dict in script
- Edit line ~225 in keystone_scraper_selenium.py:
```python
street_codes = {
    'rock point': 'RP',
    'boulder point': 'BP',
    'broadlands': 'BL',
    'stone circle': 'SC',
    'plaster point': 'PP',
    'new street': 'NS',  # Add here
}
```

**"Could not standardize address" warnings**
- Check debug files to see actual address format
- May need to adjust unit number pattern matching

## What Gets Scraped

1. **Accounts Receivable Detail** (NEW!) - Board Overview → AR Detail
   - Street Number, Street Name, Unit, Account Number, Owner Name
   - Standardized to HOA format (e.g., "13738RP1")
   - All homeowners included

2. **Violations** (`/p9060/violations/`)
   - Date, Description, Status
   - (May show "No data" if no violations)

3. **Work Orders** (`/p9060/work-orders/`)
   - WO Number, Issued Date, Due Date, Description, Status

4. **Architectural Reviews** (`/p9060/architectural-review/`)
   - Homeowner, Address, Request Type, Status, Dates

## Scheduling (Optional)

To run automatically every day at 2 AM:

```bash
crontab -e
```

Add this line:
```
0 2 * * * cd /home/dee/hoa-code/keystone-scraper && /home/dee/hoa-code/keystone-scraper/venv/bin/python3 /home/dee/hoa-code/keystone-scraper/keystone_scraper_selenium.py >> /tmp/keystone-scraper.log 2>&1
```

Check logs:
```bash
tail -f /tmp/keystone-scraper.log
```

## Files

- `keystone_scraper_selenium.py` - **Main scraper (UPDATED!)**
- `test_address_standardization.py` - Test address parsing
- `test_run.py` - Integration test
- `UPDATE_SUMMARY.md` - Detailed update documentation
- `CHANGELOG.md` - Change history
- `QUICK_START.md` - This file

## What Changed (2026-02-16)

See `UPDATE_SUMMARY.md` and `CHANGELOG.md` for full details.

**Summary:**
- ✓ Switched to Accounts Receivable Detail page (cleaner data)
- ✓ Added address standardization (e.g., "13738RP1")
- ✓ Account numbers now included
- ✓ Better data quality and reliability
- ✓ Clean sheet format (no parsing issues)
