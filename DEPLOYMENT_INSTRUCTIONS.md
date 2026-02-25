# Manual Deployment Instructions

**Date:** February 15, 2026
**Purpose:** Deploy Keystone integration and Property Report v18.1

---

## Prerequisites ✓ Complete

- ✅ Keystone cache spreadsheet created and ready
  - URL: https://docs.google.com/spreadsheets/d/1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ
  - 4 sheets created: Profiles, Violations, WorkOrders, ArchReviews
  - Headers added to all sheets

- ✅ Code files ready in `~/hoa-code/`:
  - HOALibrary/KeystoneIntegration.gs (423 lines)
  - PropertyReport/Code.gs (v18.1 with Keystone integration)

- ⚠️ Python scraper ready (Playwright pending due to Python 3.14 compatibility)

---

## Part 1: Update HOALibrary (Add Keystone Functions)

### Step 1.1: Open HOA_Library Project

1. Go to https://script.google.com
2. Find and open the **"HOA_Library"** project
3. You should see existing files:
   - AddressStandardization
   - SpreadsheetUtils
   - HomeownerLookup
   - ProjectRegistry
   - GutterProject
   - WoodTrimProject
   - Tests

### Step 1.2: Add KeystoneIntegration File

1. Click the **+ (Plus)** icon next to "Files"
2. Select **"Script"**
3. Name the new file: **`KeystoneIntegration`**
4. Delete the default function code

### Step 1.3: Paste Keystone Integration Code

1. Open the file on your local system:
   ```bash
   cat ~/hoa-code/HOALibrary/KeystoneIntegration.gs
   ```

2. **Copy all the code** (423 lines)

3. **Paste into the Apps Script editor** (KeystoneIntegration.gs file)

4. **Save** (Ctrl+S or Cmd+S)

### Step 1.4: Deploy as Library Version 5

1. Click **"Deploy"** → **"New deployment"**
2. Click the **gear icon** next to "Select type"
3. Select **"Library"**
4. Fill in deployment details:
   - **Description:** `v5 - Added Keystone integration (Profile, Violations, Work Orders, Arch Reviews)`
   - Version: Should auto-increment to v5
5. Click **"Deploy"**
6. **Note the version number** (should be 5)
7. Click **"Done"**

**Important:** Keep the Deployment ID - you'll need it if other projects use this library.

---

## Part 2: Update PropertyReport to Use Library v5

### Step 2.1: Open Property_Report_Processor_Standalone

1. Still in https://script.google.com
2. Find and open **"Property_Report_Processor_Standalone"**

### Step 2.2: Update Library Dependency

1. Click the **+ icon** next to "Libraries" in the left sidebar
2. Find **"HOALibrary"** in the list
3. Click the **version dropdown**
4. **Select version 5** (not "development")
5. Click **"Save"**

**Critical:** Make sure it shows "5" not "development" or "0"

### Step 2.3: Update Property Report Code

1. Click on **"Code.gs"** file
2. **Select all code** (Ctrl+A / Cmd+A)
3. **Delete it**

4. Open the updated code on your local system:
   ```bash
   cat ~/hoa-code/PropertyReport/Code.gs
   ```

5. **Copy all the code** (entire file)

6. **Paste into Apps Script editor**

7. **Verify the changes:**
   - Line 3: Should say `Version: 18.1 (FIXED - Production Ready)`
   - Line 17: Should say `debugMode: false`
   - Lines 189-227: Should have new `getKeystoneData()` function
   - Lines 902-997: Should have Keystone section in PDF generation

8. **Save** (Ctrl+S)

### Step 2.4: Verify Configuration

Check the CONFIG object (lines 15-27):

```javascript
const CONFIG = {
  formId: '1mMuV-hdcE8bVN75m8y5OxlMjMRsITslnbYSF1AMN-y0',
  debugMode: false,  // ← MUST be false for production
  adminEmail: 'admin@villasboulders.org',
  managerEmail: 'manager@villasboulders.org',
  guttersSheetId: '10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A',
  woodTrimSheetId: '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE',
  keystoneCacheSheetId: '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ',  // ← Should be present
  ownersGroup: 'owners@villasboulders.org'
};
```

**All IDs should match these values exactly.**

---

## Part 3: Populate Keystone Cache (Manual for Now)

Since the Python scraper needs Playwright (pending fix), you'll populate the cache manually initially:

### Step 3.1: Log into Keystone Portal

1. Go to https://kppm.cincwebaxis.com
2. Login with credentials from keystone-scraper/.env

### Step 3.2: Export Homeowner Directory

1. Navigate to: **Community Information → Homeowner Directory**
2. Copy the data or export if available
3. Open: https://docs.google.com/spreadsheets/d/1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ
4. Go to **"Profiles"** sheet
5. Paste data starting at row 2 (row 1 has headers):
   - Column A: Address (e.g., "13737 Rock Point Unit 102")
   - Column B: Name
   - Column C: Phone
   - Column D: Email
   - Column E: AccountNumber
   - Column F: Leave blank (LastUpdated - will auto-fill when scraper runs)

### Step 3.3: Export Violations

1. In Keystone: **Board Overview → Violations**
2. Copy/export all violations
3. In spreadsheet, go to **"Violations"** sheet
4. Paste starting at row 2:
   - Column A: Address
   - Column B: Date
   - Column C: Description
   - Column D: Status (e.g., "Open", "Closed")
   - Column E: Leave blank (LastUpdated)

### Step 3.4: Export Work Orders

1. In Keystone: **Board Overview → Work Orders**
2. Export all work orders (all statuses)
3. In spreadsheet, go to **"WorkOrders"** sheet
4. Paste starting at row 2:
   - Column A: Address
   - Column B: Date
   - Column C: Description
   - Column D: Status (e.g., "Open", "Closed", "Board Review")
   - Column E: Type (if available)
   - Column F: Leave blank (LastUpdated)

### Step 3.5: Export Architectural Reviews

1. In Keystone: **Board Overview → Architectural Review**
2. Export all reviews
3. In spreadsheet, go to **"ArchReviews"** sheet
4. Paste starting at row 2:
   - Column A: Address
   - Column B: Date
   - Column C: Description
   - Column D: Status ("Open", "Closed", "Approved", etc.)
   - Column E: Leave blank (LastUpdated)

**Note:** This manual process is temporary. Once Python/Playwright is fixed, the scraper will automate this.

---

## Part 4: Test the System

### Step 4.1: Test with Debug Mode First

1. In PropertyReport Code.gs, **temporarily** change:
   ```javascript
   debugMode: true  // Test mode
   ```

2. Save

3. Submit the **Property Report Request Form** using your email (admin@villasboulders.org)

4. **Wait 30-60 seconds**

5. Check your email for the PDF report

6. **Verify the PDF contains:**
   - Title page with address
   - **Keystone Property Management Data section** (NEW!)
     - Account Information (if populated in cache)
     - Violations table (if any)
     - Work Orders table (if any)
     - Architectural Reviews table (if any)
   - Gutter Maintenance section
   - Wood Trim section

### Step 4.2: Check Execution Logs

1. In Apps Script editor: **Executions** (clock icon in left sidebar)
2. Find the latest execution
3. Click to view details
4. **Look for:**
   ```
   Fetching Keystone data...
   Keystone data retrieved:
     Profile: found
     Violations: X
     Work Orders: Y
     Arch Reviews: Z
   ```

5. **Check for errors** (red error icons)

### Step 4.3: Deploy to Production

If test is successful:

1. Change back to production:
   ```javascript
   debugMode: false  // Production mode
   ```

2. Save

3. **Test again** with a real homeowner (board member friend):
   - Ask them to submit the form
   - Verify they receive the email (not you)
   - Ask them to confirm the report looks good

### Step 4.4: Monitor First Week

**Daily for first week:**
- Check Executions for errors
- Verify reports are being sent
- Respond to any homeowner questions
- Check that Keystone data appears correctly

---

## Part 5: Set Up Automated Keystone Scraping (Future)

This will be set up once Playwright installation is resolved:

1. **Fix Playwright installation:**
   - Option A: Use Python 3.12 or 3.13 (wait for greenlet to support 3.14)
   - Option B: Install system build tools for compiling greenlet
   - Option C: Use alternative scraping approach (requests + BeautifulSoup)

2. **Test scraper:**
   ```bash
   cd ~/hoa-code/keystone-scraper
   source venv/bin/activate
   python3 keystone_scraper.py --headed  # Watch it work
   ```

3. **Set up cron job:**
   ```bash
   crontab -e
   # Add this line (runs daily at 2 AM):
   0 2 * * * cd /home/dee/hoa-code/keystone-scraper && /home/dee/hoa-code/keystone-scraper/venv/bin/python3 keystone_scraper.py >> /tmp/keystone-scraper.log 2>&1
   ```

4. **Monitor logs:**
   ```bash
   tail -f /tmp/keystone-scraper.log
   ```

---

## Rollback Plan

If problems occur:

### Quick Rollback (PropertyReport Only)

1. Open Apps Script: Property_Report_Processor_Standalone
2. Libraries → HOALibrary → Change to version 4
3. Revert Code.gs to previous version (use version history if needed)
4. Save

**System will work without Keystone data** (graceful degradation built in)

### Full Rollback (Including HOALibrary)

1. HOALibrary: Deploy → Manage deployments → Archive v5
2. PropertyReport: Use v4 of library
3. Remove KeystoneIntegration.gs file from HOALibrary (optional)

---

## Verification Checklist

Before marking deployment complete:

- [ ] HOALibrary v5 deployed with KeystoneIntegration.gs
- [ ] PropertyReport uses HOALibrary v5 (not development)
- [ ] PropertyReport Code.gs updated to v18.1
- [ ] `debugMode: false` in CONFIG
- [ ] Keystone cache spreadsheet has sample data
- [ ] Test form submission successful
- [ ] PDF includes Keystone section
- [ ] Execution logs show no errors
- [ ] Email sent to actual requester (not just admin)
- [ ] Homeowner confirms report received and looks correct

---

## Next Steps After Deployment

1. **Fix Playwright installation** for automated scraping
2. **Run scraper daily** to keep cache fresh
3. **Monitor for errors** in first month
4. **Gather feedback** from homeowners
5. **Document any issues** in PropertyReport/KNOWN_ISSUES.md
6. **Plan improvements** from REFACTORING_ROADMAP.md

---

## Support

- **Deployment Guide:** This file
- **PropertyReport Deployment:** `~/hoa-code/PropertyReport/DEPLOYMENT_v18.1.md`
- **Keystone Scraper:** `~/hoa-code/keystone-scraper/DEPLOYMENT.md`
- **Architecture:** `~/hoa-code/ARCHITECTURE.md`

**Questions?** Review the documentation or check execution logs for specific errors.

---

**Status:** Ready for manual deployment
**Estimated Time:** 30-45 minutes
**Risk Level:** Low (graceful degradation if Keystone data unavailable)

