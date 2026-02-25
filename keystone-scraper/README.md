# Keystone Pacific Scraper

Automated scraper for the Keystone Pacific Property Management portal. Scrapes homeowner data, violations, work orders, and architectural reviews, then caches them in Google Sheets for use by the Property Report system.

## Features

- **Headless browser automation** using Playwright (more reliable than Selenium for modern web apps)
- **Four data sources:**
  - Homeowner Directory (profiles with contact info and account numbers)
  - Violations (all violations with status)
  - Work Orders (all work orders with filtering support)
  - Architectural Reviews (all architectural review requests)
- **Google Sheets caching** for fast access from Apps Script
- **Robust error handling** with logging and screenshots
- **Dry-run mode** for testing without writing to sheets

## Setup

### 1. Install Python Dependencies

```bash
cd ~/hoa-code/keystone-scraper
pip3 install -r requirements.txt
```

### 2. Install Playwright Browsers

Playwright requires browser binaries to be installed separately:

```bash
playwright install chromium
```

### 3. Verify Google Service Account Credentials

The scraper uses the service account credentials at:
```
~/.config/openclaw/google-service-account.json
```

Make sure this file exists and has permissions to write to the spreadsheet:
- Spreadsheet ID: `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`

### 4. Test the Scraper

Run a test scrape with visible browser and dry-run mode:

```bash
python3 test_scraper.py
```

This will:
- Open a visible browser window
- Login to Keystone
- Scrape all data
- Display results without writing to sheets

### 5. Run the Scraper

Once testing looks good, run the real scraper:

```bash
python3 keystone_scraper.py
```

## Usage

### Command Line Options

```bash
# Normal run (headless, writes to sheets)
python3 keystone_scraper.py

# Visible browser for debugging
python3 keystone_scraper.py --headed

# Dry run (doesn't write to sheets)
python3 keystone_scraper.py --dry-run

# Combination
python3 keystone_scraper.py --headed --dry-run
```

### Scheduling with Cron

To run the scraper automatically (e.g., daily at 2 AM):

1. Edit your crontab:
   ```bash
   crontab -e
   ```

2. Add this line:
   ```
   0 2 * * * cd /home/dee/hoa-code/keystone-scraper && /usr/bin/python3 keystone_scraper.py >> /tmp/keystone-scraper.log 2>&1
   ```

3. Check the log file to verify it's running:
   ```bash
   tail -f /tmp/keystone-scraper.log
   ```

### Alternative: systemd Timer

For more control, create a systemd timer:

1. Create service file: `/etc/systemd/system/keystone-scraper.service`
   ```ini
   [Unit]
   Description=Keystone Pacific Scraper

   [Service]
   Type=oneshot
   User=dee
   WorkingDirectory=/home/dee/hoa-code/keystone-scraper
   ExecStart=/usr/bin/python3 /home/dee/hoa-code/keystone-scraper/keystone_scraper.py
   ```

2. Create timer file: `/etc/systemd/system/keystone-scraper.timer`
   ```ini
   [Unit]
   Description=Run Keystone Scraper Daily

   [Timer]
   OnCalendar=daily
   OnCalendar=02:00
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable keystone-scraper.timer
   sudo systemctl start keystone-scraper.timer
   ```

## Google Sheet Structure

The scraper creates/updates 4 sheets in spreadsheet `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`:

### Profiles Sheet
| Name | Address | Phone | Email | Account Number |
|------|---------|-------|-------|----------------|
| ... | ... | ... | ... | ... |

### Violations Sheet
| Address | Date | Description | Status |
|---------|------|-------------|--------|
| ... | ... | ... | ... |

### WorkOrders Sheet
| Address | Date | Description | Status | Type |
|---------|------|-------------|--------|------|
| ... | ... | ... | ... | ... |

### ArchReviews Sheet
| Address | Date | Description | Status |
|---------|------|-------------|--------|
| ... | ... | ... | ... |

Each sheet includes a "Last Updated" timestamp at the bottom.

## Troubleshooting

### Login Issues

If login fails:
1. Check credentials in `keystone_scraper.py`
2. Run with `--headed` to see the browser
3. Check for CAPTCHA or 2FA requirements
4. Look at screenshot: `/tmp/keystone_login_failed.png`

### Scraping Issues

If data extraction fails:
1. The portal HTML may have changed
2. Run with `--headed` to see what's happening
3. Check screenshots in `/tmp/keystone_*.png`
4. Update the CSS selectors in the scraper code

### Google Sheets Issues

If writing to sheets fails:
1. Check service account permissions
2. Verify the spreadsheet ID is correct
3. Make sure the service account has Editor access to the spreadsheet
4. Run with `--dry-run` to test scraping without writing

### Debugging

Enable verbose logging by editing `keystone_scraper.py`:
```python
logging.basicConfig(level=logging.DEBUG)
```

## Security Notes

- **Do NOT commit credentials** to git (they're in .gitignore)
- The service account credentials should have minimal permissions
- Consider using environment variables for credentials:
  ```python
  KEYSTONE_USERNAME = os.environ['KEYSTONE_USERNAME']
  KEYSTONE_PASSWORD = os.environ['KEYSTONE_PASSWORD']
  ```

## Rollback Plan

If the Keystone integration causes issues:

1. **Disable the scraper cron job**:
   ```bash
   crontab -e  # Comment out the keystone line
   ```

2. **Update PropertyReport to handle missing data**:
   The Property Report code already handles null keystone data gracefully.

3. **Clear cache sheets** (optional):
   Delete the 4 sheets from the Google Spreadsheet if needed.

## Maintenance

### Portal Changes

The Keystone portal may change its HTML structure. If scraping stops working:

1. Run with `--headed` to inspect the portal
2. Update CSS selectors in the scraper methods
3. Test with `--dry-run` before running for real

### Adding New Data Sources

To scrape additional data from Keystone:

1. Add a new method like `scrape_new_data()`
2. Add a new sheet name constant
3. Call it in the `run()` method
4. Update the Google Sheet structure documentation

## Support

For issues or questions:
- Check logs: `/tmp/keystone-scraper.log`
- Review screenshots: `/tmp/keystone_*.png`
- Test with: `python3 test_scraper.py`
