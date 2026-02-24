# Keystone Scraper Update Summary

## What Changed

The Keystone scraper has been updated to use a cleaner data source with better data quality.

### Before
- Scraped from: Homeowner Directory page
- Problems:
  - Messy concatenated data in DevExpress grid
  - No account numbers available
  - Difficult to parse reliably
  - Inconsistent address formats

### After
- Scrapes from: Board Overview → Accounts Receivable Detail
- Benefits:
  - Clean, separated columns
  - Account numbers included
  - Easier to parse
  - Standardized address format

## New Features

### 1. Address Standardization
Addresses are now automatically standardized to HOA format:
- `"13738 Rock Point Unit 101"` → `"13738RP1"`
- `"13747 Boulder Point #202"` → `"13747BP2"`

Street code mappings:
- Rock Point → RP
- Boulder Point → BP
- Broadlands → BL
- Stone Circle → SC
- Plaster Point → PP

### 2. Account Numbers
All homeowner profiles now include their Keystone account number, enabling better integration with the portal.

### 3. Updated Sheet Format
The Profiles sheet now uses this format:
```
Address | AccountNumber | AccountName | LastUpdated | Source
13738RP1 | 123456 | John Smith | 2026-02-16 | Keystone
```

This format:
- Works seamlessly with Apps Script address lookups
- No confusing timestamp rows
- Tracks data source and freshness

## Technical Details

### Functions Added
- `standardize_address(street_number, street_name, unit)` - Converts addresses to HOA format
- `scrape_accounts_receivable()` - New data scraping function

### Functions Modified
- `run()` - Uses new data source
- `write_to_sheet()` - Better handling of camelCase headers

### Functions Removed
- `scrape_homeowner_directory()` - Replaced by `scrape_accounts_receivable()`

## How to Test

### 1. Test Address Standardization
```bash
cd /home/dee/hoa-code/keystone-scraper
source venv/bin/activate
python3 test_address_standardization.py
```

Expected: All 10 tests pass ✓

### 2. Dry Run Test (Recommended First)
```bash
cd /home/dee/hoa-code/keystone-scraper
source venv/bin/activate
python3 keystone_scraper_selenium.py --headed --dry-run
```

This will:
- Show the browser (headed mode)
- Log in to Keystone portal
- Navigate to Accounts Receivable Detail
- Scrape data and show sample in logs
- NOT write to Google Sheets (dry-run)
- Save screenshots to /tmp/ for verification

Check the output for:
- Successful login
- Number of profiles found
- Sample profile data

### 3. Full Run (Write to Sheets)
Once dry-run looks good:
```bash
cd /home/dee/hoa-code/keystone-scraper
source venv/bin/activate
python3 keystone_scraper_selenium.py --headless
```

### 4. Verify in Google Sheets
Open the spreadsheet:
https://docs.google.com/spreadsheets/d/1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ

Check the Profiles tab:
- Header row: Address | AccountNumber | AccountName | LastUpdated | Source
- Data rows with standardized addresses (e.g., "13738RP1")
- Account numbers present
- No extra timestamp rows

### 5. Test Apps Script Lookup
Try looking up an address in your Property Report system to verify:
- Address standardization works
- Account numbers are retrieved
- No parsing errors

## Debug Files

If issues occur, check these files:
- `/tmp/keystone_ar_source.html` - Page source from AR Detail page
- `/tmp/keystone_ar_loaded.png` - Screenshot of loaded page
- `/tmp/keystone_ar_error.png` - Screenshot if error occurs

## Expected Results

A successful run should:
1. Log in successfully to Keystone portal
2. Navigate to Accounts Receivable Detail
3. Find 100+ homeowner profiles (adjust based on actual HOA size)
4. Standardize all addresses correctly
5. Write clean data to Profiles sheet
6. Log "Scraping completed successfully"

Sample output:
```
INFO - Logging into Keystone portal...
INFO - Login successful - redirected to https://kppm.cincwebaxis.com/...
INFO - Scraping Accounts Receivable Detail...
INFO - Found Accounts Receivable Detail link, clicking...
INFO - Found 150 potential rows
INFO - Found 148 homeowner profiles
INFO - Writing 148 rows to Profiles...
INFO - Successfully wrote 148 rows to Profiles
INFO - Scraping completed successfully
```

## Troubleshooting

### "Unknown street name" warnings
If you see warnings about unknown streets, add them to the `street_codes` dict in `standardize_address()`:
```python
street_codes = {
    'rock point': 'RP',
    'boulder point': 'BP',
    'broadlands': 'BL',
    'stone circle': 'SC',
    'plaster point': 'PP',
    'new street name': 'NS',  # Add new streets here
}
```

### "Could not standardize address" warnings
Check the debug files to see what format the addresses are in. May need to adjust parsing logic.

### No data found
- Check `/tmp/keystone_ar_loaded.png` to see what page was loaded
- Verify login was successful
- Check if page structure has changed
- Try running in headed mode (`--headed`) to watch the browser

### Account numbers missing
- Verify you're on the correct page (Accounts Receivable Detail)
- Check column order in the table
- Adjust cell indices in `scrape_accounts_receivable()` if needed

## Next Steps After Testing

1. ✓ Verify address standardization works (run test script)
2. ✓ Run dry-run to test scraping without writing
3. ☐ Run full scraper to write to sheets
4. ☐ Verify data in Google Sheets
5. ☐ Test Apps Script lookup functionality
6. ☐ Set up scheduled runs (cron job)

## Questions?

Check the code comments in `keystone_scraper_selenium.py` for detailed documentation of each function.
