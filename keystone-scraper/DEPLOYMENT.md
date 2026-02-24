# Keystone Integration - Deployment Guide

Complete guide for deploying the Keystone Pacific integration system to production.

**Version:** 1.0
**Last Updated:** February 15, 2026
**Status:** Production Ready

---

## Overview

The Keystone integration consists of three components:

1. **Python Scraper** (`keystone_scraper.py`) - Runs on oregano server via cron
2. **HOALibrary Functions** (`KeystoneIntegration.gs`) - Apps Script library
3. **PropertyReport Integration** (`Code.gs`) - Consumes Keystone data

This guide covers deployment and verification of all three components.

---

## Prerequisites

### Server Requirements

- **Python:** 3.8+ (tested with 3.10+)
- **OS:** Linux (tested on Arch Linux)
- **Network:** Access to https://kppm.cincwebaxis.com
- **Cron:** For scheduled execution

### Google Cloud Requirements

- **Service Account:** openclaw-automation@villasboulders-automation.iam.gserviceaccount.com
- **Credentials:** `~/.config/openclaw/google-service-account.json`
- **Spreadsheet:** 1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ (created and writable)
- **Scopes:**
  - `https://www.googleapis.com/auth/spreadsheets`

### Keystone Portal Access

- **URL:** https://kppm.cincwebaxis.com
- **Username:** REDACTED_EMAIL
- **Password:** REDACTED_PASSWORD

---

## Part 1: Python Scraper Deployment

### Step 1: Verify Code is in Place

```bash
cd ~/hoa-code/keystone-scraper
ls -la
```

Expected files:
- `keystone_scraper.py` (main scraper)
- `test_scraper.py` (test script)
- `requirements.txt` (dependencies)
- `README.md` (usage guide)
- `.gitignore` (excludes credentials)

### Step 2: Install Dependencies

```bash
# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate

# Install packages
pip3 install -r requirements.txt

# Install Playwright browser
playwright install chromium
```

### Step 3: Verify Service Account Credentials

```bash
# Check credentials file exists
ls -la ~/.config/openclaw/google-service-account.json

# Verify permissions (should be 600 or 400)
stat -c '%a %n' ~/.config/openclaw/google-service-account.json
```

If file doesn't exist, copy from backup or regenerate key.

### Step 4: Create Google Sheets Cache Spreadsheet

1. Create new spreadsheet in Google Drive
2. Name it: "Keystone Cache"
3. Share with service account email (Editor access):
   - `openclaw-automation@villasboulders-automation.iam.gserviceaccount.com`
4. Copy spreadsheet ID from URL
5. Verify ID matches: `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`

The scraper will create the 4 sheets automatically on first run.

### Step 5: Test Scraper (Dry Run)

```bash
cd ~/hoa-code/keystone-scraper
python3 test_scraper.py
```

This will:
- Open a visible browser window
- Login to Keystone portal
- Scrape all data
- Display sample results
- **NOT** write to Google Sheets

**Expected output:**
```
============================================================
Testing Keystone Scraper (Dry Run)
============================================================
...
INFO - Login successful
INFO - Scraping Homeowner Directory...
INFO - Found 300+ homeowner profiles
INFO - Scraping Violations...
INFO - Found XX violations
...
✓ Test completed successfully!
```

### Step 6: Test Scraper (Real Write)

```bash
# Run with actual Google Sheets write
python3 keystone_scraper.py --headed
```

This will write to the spreadsheet. Verify:
1. Check spreadsheet has 4 sheets created
2. Check each sheet has data
3. Check "Last Updated" timestamp at bottom of each sheet

### Step 7: Set Up Cron Job

**Option A: Simple Cron**

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /home/dee/hoa-code/keystone-scraper && /usr/bin/python3 keystone_scraper.py >> /tmp/keystone-scraper.log 2>&1
```

**Option B: Systemd Timer** (Recommended)

1. Create service file:

```bash
sudo nano /etc/systemd/system/keystone-scraper.service
```

Contents:
```ini
[Unit]
Description=Keystone Pacific Property Management Scraper
After=network.target

[Service]
Type=oneshot
User=dee
WorkingDirectory=/home/dee/hoa-code/keystone-scraper
ExecStart=/usr/bin/python3 /home/dee/hoa-code/keystone-scraper/keystone_scraper.py
StandardOutput=append:/var/log/keystone-scraper.log
StandardError=append:/var/log/keystone-scraper.log
```

2. Create timer file:

```bash
sudo nano /etc/systemd/system/keystone-scraper.timer
```

Contents:
```ini
[Unit]
Description=Run Keystone Scraper Daily at 2 AM
Requires=keystone-scraper.service

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

3. Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable keystone-scraper.timer
sudo systemctl start keystone-scraper.timer

# Verify timer is active
sudo systemctl status keystone-scraper.timer
sudo systemctl list-timers keystone-scraper.timer
```

### Step 8: Verify Automated Runs

After 24 hours, check:

```bash
# Check log file
tail -f /tmp/keystone-scraper.log
# or
sudo tail -f /var/log/keystone-scraper.log

# Check spreadsheet timestamp
# Open spreadsheet, check "Last Updated" row at bottom of each sheet

# Check systemd journal (if using systemd)
sudo journalctl -u keystone-scraper.service -n 50
```

---

## Part 2: HOALibrary Deployment

### Step 1: Verify KeystoneIntegration.gs is in Library

1. Open HOALibrary Apps Script project
2. Check for file: `KeystoneIntegration.gs`
3. Verify it contains 4 functions:
   - `getKeystoneProfileData(address)`
   - `getKeystoneViolations(address)`
   - `getKeystoneWorkOrders(address, status)`
   - `getKeystoneArchReviews(address, status)`

### Step 2: Update Library Version

1. Apps Script editor → Deploy → New deployment
2. Type: Library
3. Description: "Add Keystone integration functions"
4. Click Deploy
5. Note the new version number (should be v5 or higher)

### Step 3: Test Library Functions

Create a test function in HOALibrary:

```javascript
function testKeystoneIntegration() {
  var testAddress = "13737 Rock Point Unit 102";

  console.log("Testing Keystone integration...");

  // Test profile lookup
  var profile = getKeystoneProfileData(testAddress);
  console.log("Profile:", JSON.stringify(profile));

  // Test violations
  var violations = getKeystoneViolations(testAddress);
  console.log("Violations count:", violations.length);

  // Test work orders
  var workOrders = getKeystoneWorkOrders(testAddress, null);
  console.log("Work orders count:", workOrders.length);

  // Test arch reviews
  var archReviews = getKeystoneArchReviews(testAddress, null);
  console.log("Arch reviews count:", archReviews.length);
}
```

Run the function and verify output shows data from cache spreadsheet.

---

## Part 3: PropertyReport Integration Deployment

### Step 1: Update HOALibrary Dependency

1. Open PropertyReport Apps Script project
2. Libraries → HOALibrary
3. **Version:** Select latest (v5+)
4. **CRITICAL:** Must NOT be "development mode"
5. Click Save

### Step 2: Verify Keystone Functions are Called

Check `Code.gs` contains:

```javascript
function getKeystoneData(address) {
  // Get profile data
  var profile = HOALibrary.getKeystoneProfileData(address);

  // Get violations
  var violations = HOALibrary.getKeystoneViolations(address);

  // Get work orders
  var workOrders = HOALibrary.getKeystoneWorkOrders(address, null);

  // Get arch reviews
  var archReviews = HOALibrary.getKeystoneArchReviews(address, null);

  return {
    profile: profile,
    violations: violations,
    workOrders: workOrders,
    archReviews: archReviews
  };
}
```

And in `gatherReportData()`:

```javascript
data.keystone = getKeystoneData(standardizedAddress);
```

And in `generatePdfReport()` there's a Keystone section that renders the data.

### Step 3: Test PropertyReport End-to-End

1. Set `debugMode: true` in CONFIG
2. Submit test form with known address
3. Check admin email for report
4. Verify report contains Keystone section with:
   - Account information (if available)
   - Violations (if any)
   - Work orders (if any)
   - Architectural reviews (if any)

### Step 4: Production Deployment

1. Set `debugMode: false` in CONFIG
2. Save
3. Submit real test with your own email
4. Verify you receive report with Keystone data

---

## Verification Checklist

### Python Scraper

- [ ] Dependencies installed (`pip3 list | grep playwright`)
- [ ] Service account credentials present and readable
- [ ] Cache spreadsheet created and shared with service account
- [ ] Test run completes successfully
- [ ] Live run writes data to spreadsheet
- [ ] Cron job or systemd timer configured
- [ ] Log file location known and accessible
- [ ] First automated run completes successfully

### HOALibrary

- [ ] KeystoneIntegration.gs file present
- [ ] All 4 functions implemented
- [ ] Library version updated (v5+)
- [ ] Test function runs successfully
- [ ] Data retrieved from cache spreadsheet

### PropertyReport

- [ ] HOALibrary dependency updated to v5+
- [ ] NOT using development mode
- [ ] `getKeystoneData()` function present
- [ ] `gatherReportData()` calls Keystone functions
- [ ] `generatePdfReport()` renders Keystone section
- [ ] Test report includes Keystone data
- [ ] Production test successful

---

## Rollback Plan

If issues arise after deployment:

### Emergency Rollback (Quick)

1. **Disable scraper cron job:**
   ```bash
   crontab -e  # Comment out keystone line
   # or
   sudo systemctl stop keystone-scraper.timer
   sudo systemctl disable keystone-scraper.timer
   ```

2. **PropertyReport continues to work:**
   - Code handles missing/empty Keystone data gracefully
   - Report will simply omit Keystone section if no data
   - No changes needed to PropertyReport code

### Full Rollback (Remove Integration)

1. **Remove Keystone calls from PropertyReport:**
   ```javascript
   // In gatherReportData(), comment out:
   // data.keystone = getKeystoneData(standardizedAddress);
   ```

2. **Revert HOALibrary version:**
   - PropertyReport → Libraries → HOALibrary
   - Select previous version (v4)

3. **Delete cache spreadsheet:**
   - Optional: only if you want to completely remove data

---

## Monitoring

### Daily Checks (First Week)

- [ ] Check scraper log for errors
- [ ] Verify spreadsheet "Last Updated" timestamp is current
- [ ] Spot-check data in cache spreadsheet
- [ ] Test a Property Report to ensure Keystone data appears

### Weekly Checks (Ongoing)

- [ ] Review scraper logs for patterns/issues
- [ ] Verify data freshness (Last Updated timestamp)
- [ ] Check PropertyReport executions log for Keystone errors

### Alerts to Watch For

**Scraper Issues:**
- Login failures (credential change, CAPTCHA added)
- Portal structure changes (HTML selectors broken)
- Network timeouts
- Google Sheets API errors

**PropertyReport Issues:**
- Empty Keystone data when expected
- Errors reading from cache spreadsheet
- Missing account numbers or wrong data

### Log Locations

- **Scraper:** `/tmp/keystone-scraper.log` or `/var/log/keystone-scraper.log`
- **PropertyReport:** Apps Script → Executions
- **Systemd:** `sudo journalctl -u keystone-scraper.service`

---

## Troubleshooting

### Scraper Won't Login

**Symptoms:** Login fails, screenshot shows login page

**Causes:**
- Credentials changed
- Portal added CAPTCHA
- Portal structure changed

**Fix:**
1. Run with `--headed` to see what's happening
2. Check credentials in `keystone_scraper.py`
3. Try logging in manually to portal
4. Update selectors if portal changed

### No Data in Spreadsheet

**Symptoms:** Sheets empty or missing

**Causes:**
- Scraper not writing (check dry-run mode)
- Service account lacks permissions
- Wrong spreadsheet ID

**Fix:**
1. Check scraper logs
2. Verify service account has Editor access to spreadsheet
3. Run manually with `--headed` to debug

### PropertyReport Shows No Keystone Data

**Symptoms:** Report missing Keystone section

**Causes:**
- Cache spreadsheet empty
- Wrong spreadsheet ID in HOALibrary
- Address mismatch (standardization issue)

**Fix:**
1. Check cache spreadsheet has data
2. Verify KEYSTONE_CACHE_SHEET_ID in KeystoneIntegration.gs
3. Test address standardization:
   ```javascript
   var std = HOALibrary.standardizeHOAAddress("13737 Rock Point Unit 102");
   console.log(std); // Should be "13737RP2"
   ```

### Data is Stale

**Symptoms:** Last Updated timestamp is old

**Causes:**
- Cron job not running
- Scraper errors not noticed

**Fix:**
1. Check cron status: `crontab -l`
2. Check systemd timer: `sudo systemctl status keystone-scraper.timer`
3. Review logs for recent runs
4. Run manually to verify it works

---

## Performance Expectations

### Scraper

- **Execution time:** 2-5 minutes per run
- **Frequency:** Daily at 2 AM
- **Data size:** ~300 profiles, ~50-200 violations/work orders
- **Spreadsheet size:** <1 MB

### PropertyReport

- **Keystone data retrieval:** <1 second (reads from cache)
- **Impact on report generation:** Minimal (~500ms added)

---

## Security Notes

### Credentials

- **Never commit** Keystone credentials to git
- **File permissions:** 600 on service account JSON
- **Consider environment variables** for credentials:
  ```bash
  export KEYSTONE_USER="REDACTED_EMAIL"
  export KEYSTONE_PASS="REDACTED_PASSWORD"
  ```

### Data Privacy

- Cache spreadsheet contains homeowner contact info
- Ensure proper access controls:
  - Service account only
  - HOA staff as needed
  - No public sharing

### Portal Access

- Use dedicated account (not personal)
- Rotate password periodically
- Monitor for unusual access patterns

---

## Maintenance Schedule

### Daily

- [ ] Automated scraper runs (via cron/systemd)

### Weekly

- [ ] Check logs for errors
- [ ] Verify data freshness

### Monthly

- [ ] Review spreadsheet size/performance
- [ ] Test end-to-end flow with sample report
- [ ] Check for Keystone portal updates

### Quarterly

- [ ] Rotate Keystone portal password
- [ ] Review and update documentation
- [ ] Consider performance optimizations

### Annually

- [ ] Full system review
- [ ] Update dependencies (`pip3 list --outdated`)
- [ ] Renew service account key if needed

---

## Success Criteria

Deployment is successful when:

1. ✅ Python scraper runs automatically daily
2. ✅ Cache spreadsheet updates with fresh data daily
3. ✅ PropertyReport successfully retrieves Keystone data
4. ✅ Generated reports include Keystone section
5. ✅ All 4 data sources (profiles, violations, work orders, arch reviews) populated
6. ✅ Address matching works correctly
7. ✅ No errors in logs for 1 week
8. ✅ Monitoring/alerting in place

---

## Support

**Developer:** Dee Buck (mcdonaldbuck@gmail.com)
**Documentation:** ~/hoa-code/keystone-scraper/README.md
**Architecture:** ~/hoa-code/ARCHITECTURE.md

For issues:
1. Check logs first
2. Review troubleshooting section
3. Test components individually
4. Contact developer if needed

---

**Deployed:** [DATE]
**Deployed By:** [NAME]
**Status:** Production
**Next Review:** [DATE + 1 month]
