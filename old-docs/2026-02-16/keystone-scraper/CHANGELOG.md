# Keystone Scraper Changelog

## 2026-02-16 - Major Update: Accounts Receivable Data Source

### Summary
Switched from Homeowner Directory to Accounts Receivable Detail page for cleaner, more structured data.

### Changes Made

#### 1. New Data Source
- **Old**: Homeowner Directory page (`/p9060/homeowner-directory/`)
  - Had messy concatenated data in DevExpress grid
  - Difficult to parse reliably
  - No account numbers available

- **New**: Accounts Receivable Detail page (`/p9060/accounts-receivable-detail/`)
  - Cleaner table structure
  - Separate columns for: Street Number, Street Name, Unit, Account Number, Owner Name
  - Easier to parse and more reliable

#### 2. New Functions Added

**`standardize_address(street_number, street_name, unit)`**
- Converts raw address components to HOA standard format
- Maps street names to codes:
  - Rock Point → RP
  - Boulder Point → BP
  - Broadlands → BL
  - Stone Circle → SC
  - Plaster Point → PP
- Extracts unit suffix (e.g., "101" → "1", "202" → "2")
- Returns formatted address (e.g., "13738RP1")

**`scrape_accounts_receivable()`**
- Replaces `scrape_homeowner_directory()`
- Navigates to Board Overview → Accounts Receivable Detail
- Sets dropdown to "All Homeowners" if available
- Parses simpler table structure
- Returns list of dicts with: `address`, `account_number`, `account_name`, `last_updated`, `source`

#### 3. Updated Sheet Format

**Profiles Tab**
- **Old**: Name | Address | Phone | Email | Account Number
- **New**: Address | AccountNumber | AccountName | LastUpdated | Source

Benefits:
- Cleaner format (no timestamp rows that confuse Apps Script parser)
- Address in standardized format for reliable lookups
- Account numbers now available for all homeowners
- Tracking of data source and last update time

#### 4. Code Improvements

**`write_to_sheet()`**
- Updated header-to-key mapping to handle camelCase headers
- Converts "AccountNumber" → "account_number" correctly
- More robust dict key lookup

**`run()`**
- Updated to call `scrape_accounts_receivable()` instead of `scrape_homeowner_directory()`
- Updated sheet headers for Profiles tab

#### 5. Testing

Created test scripts:
- `test_address_standardization.py` - Validates address parsing logic
- `test_run.py` - End-to-end test in dry-run mode

### Why These Changes?

**Data Quality Issues Solved:**
1. Account numbers are now available (were missing from Homeowner Directory)
2. Address components are separated, making standardization reliable
3. No more dealing with messy concatenated data
4. Consistent data structure across all rows

**Improved Reliability:**
1. Simpler table structure = fewer parsing errors
2. Standard address format = reliable lookups in Apps Script
3. Clean sheet format = no parser confusion
4. Better error handling and logging

### Testing Performed

✓ Address standardization logic tested with 10 test cases
✓ Syntax validation passed
✓ Ready for live testing with actual portal

### Next Steps

1. Run `python3 keystone_scraper_selenium.py --headed --dry-run` to verify scraping
2. Inspect screenshots and debug files in /tmp/
3. Run full scraper without --dry-run to write to sheets
4. Verify data in Google Sheet
5. Test Apps Script lookup with standardized addresses

### Files Modified

- `keystone_scraper_selenium.py` - Main scraper (updated data source and format)

### Files Created

- `test_address_standardization.py` - Unit tests for address parsing
- `test_run.py` - Integration test script
- `CHANGELOG.md` - This file

### Known Limitations

1. Street name mapping is hardcoded (only works for known streets)
2. Unit number parsing assumes XXX01 or XXX02 pattern
3. Requires manual verification of first run to ensure table structure matches expectations

### Rollback Instructions

If issues occur, the old `scrape_homeowner_directory()` function is still in the code (commented out).
To rollback:
1. Uncomment the old function
2. Update `run()` to call `scrape_homeowner_directory()` instead
3. Revert sheet headers to old format
