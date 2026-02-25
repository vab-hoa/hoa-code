# Apps Script Deployment Checklist
**Date:** February 15, 2026
**Version:** HOALibrary v5.0.0 + PropertyReport v18.1

---

## Prerequisites ✓

- ✅ HOALibrary script ID: `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
- ✅ PropertyReport script ID: `15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz`
- ✅ Keystone cache sheet ID: `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`
- ✅ Code files prepared in ~/hoa-code/

---

## Part 1: Deploy HOALibrary v5

### Step 1: Open HOA_Library Project

1. Go to https://script.google.com
2. Click on the HOA_Library project
   - Or use direct link: https://script.google.com/home/projects/1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF/edit

### Step 2: Add KeystoneIntegration.gs File

1. In the Apps Script editor, click the **+** icon next to "Files"
2. Select **"Script"**
3. Name it: `KeystoneIntegration`
4. Delete the default function
5. Open terminal and run:
   ```bash
   cat ~/hoa-code/HOALibrary/KeystoneIntegration.gs
   ```
6. Copy ALL output (423 lines)
7. Paste into the KeystoneIntegration.gs file in Apps Script
8. Click **Save** (Ctrl+S)

### Step 3: Add Version.gs File

1. Click the **+** icon next to "Files" again
2. Select **"Script"**
3. Name it: `Version`
4. Delete the default function
5. Open terminal and run:
   ```bash
   cat ~/hoa-code/HOALibrary/Version.gs
   ```
6. Copy ALL output (133 lines)
7. Paste into the Version.gs file in Apps Script
8. Click **Save** (Ctrl+S)

### Step 4: Deploy as Library Version 5

1. Click **Deploy** → **New deployment**
2. Click the **gear icon** ⚙️ next to "Select type"
3. Select **"Library"**
4. Fill in:
   - **Description:** `v5.0.0 - Added Keystone integration and version tracking`
   - **Version:** Should auto-increment to 5
5. Click **Deploy**
6. **IMPORTANT:** Note the version number shown (should be 5)
7. Click **Done**

**Checkpoint:** You should now see Version 5 in the deployment list.

---

## Part 2: Deploy PropertyReport v18.1

### Step 5: Open Property_Report_Processor_Standalone

1. Still in https://script.google.com
2. Click on Property_Report_Processor_Standalone project
   - Or use direct link: https://script.google.com/home/projects/15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz/edit

### Step 6: Update HOALibrary Dependency to v5

1. In left sidebar, find **Libraries** section
2. Click on **HOALibrary** in the list
3. In the version dropdown, change from "development" to **"5"**
4. Click **Save**

**CRITICAL:** Verify it shows version "5" (not "0" or "development")

### Step 7: Update Code.gs to v18.1

1. Click on the **Code.gs** file
2. Select ALL code (Ctrl+A / Cmd+A)
3. Delete it
4. Open terminal and run:
   ```bash
   cat ~/hoa-code/PropertyReport/Code.gs
   ```
5. Copy ALL output (entire file)
6. Paste into Code.gs in Apps Script
7. **Verify these critical fixes:**
   - Line 3: `Version: 18.1 (FIXED - Production Ready)`
   - Line 17: `debugMode: false` (MUST be false!)
   - Line 26: `keystoneCacheSheetId: '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'`
   - Lines 189-227: New `getKeystoneData()` function exists
8. Click **Save** (Ctrl+S)

**Checkpoint:** Code.gs should now be v18.1 with all fixes applied.

---

## Part 3: Verify Deployment

### Step 8: Check Library Version in PropertyReport

1. In PropertyReport editor, open the **Execution log** (View → Logs or Ctrl+Enter)
2. Run this test function in Apps Script:
   ```javascript
   function testLibraryVersion() {
     Logger.log('HOALibrary version: ' + HOALibrary.getVersion());
     HOALibrary.logVersionInfo();
   }
   ```
3. Click **Run** (select testLibraryVersion if prompted)
4. Check logs - should show:
   ```
   HOALibrary version: 5.0.0
   Released: 2026-02-15
   Description: Added Keystone Pacific integration
   ```

**If it shows a different version:** Go back to Step 6 and verify library is set to version 5.

### Step 9: Test Keystone Integration

1. Create and run this test function:
   ```javascript
   function testKeystoneIntegration() {
     var testAddress = '13737 Rock Point Unit 102';
     Logger.log('Testing Keystone integration for: ' + testAddress);

     try {
       var profile = HOALibrary.getKeystoneProfileData(testAddress);
       Logger.log('Profile: ' + JSON.stringify(profile));

       var violations = HOALibrary.getKeystoneViolations(testAddress);
       Logger.log('Violations: ' + violations.length);

       var workOrders = HOALibrary.getKeystoneWorkOrders(testAddress, null);
       Logger.log('Work Orders: ' + workOrders.length);

       var archReviews = HOALibrary.getKeystoneArchReviews(testAddress, null);
       Logger.log('Arch Reviews: ' + archReviews.length);

       Logger.log('✓ Keystone integration working!');
     } catch (error) {
       Logger.log('✗ Error: ' + error.toString());
     }
   }
   ```
2. Run the function
3. Check logs - should show counts (might be 0 if cache is empty, but no errors)

---

## Part 4: Test Complete System

### Step 10: Test with Debug Mode First

**BEFORE PRODUCTION:** Test with debugMode temporarily enabled to catch any issues.

1. In PropertyReport Code.gs, temporarily change line 17:
   ```javascript
   debugMode: true,  // Test mode - emails go to admin only
   ```
2. Save

3. Submit the Property Report form:
   - Form URL: https://docs.google.com/forms/d/1mMuV-hdcE8bVN75m8y5OxlMjMRsITslnbYSF1AMN-y0/edit
   - Use your email: admin@villasboulders.org
   - Enter a known address (e.g., "13737 Rock Point Unit 102")

4. Wait 30-60 seconds

5. Check admin@villasboulders.org email for the PDF report

6. Verify PDF contains:
   - ✓ Title page with address
   - ✓ Keystone Property Management Data section (NEW!)
   - ✓ Account Information (if in cache)
   - ✓ Violations table (if any)
   - ✓ Work Orders table (if any)
   - ✓ Architectural Reviews table (if any)
   - ✓ Gutter Maintenance section
   - ✓ Wood Trim section

7. Check execution logs in Apps Script:
   - Click **Executions** (clock icon in sidebar)
   - Find latest execution
   - Look for: "Fetching Keystone data..." and "Keystone data retrieved:"
   - Check for any red error icons

### Step 11: Deploy to Production

**If test successful:**

1. Change debugMode back to production:
   ```javascript
   debugMode: false,  // Production - emails go to requester
   ```
2. Save

3. Test one more time with a different email (board member or your personal email)

4. Verify email goes to the requester (not admin)

**Checkpoint:** System is now live in production!

---

## Part 5: Populate Keystone Cache (Manual)

**Note:** Python scraper is pending due to Playwright/Python 3.14 compatibility. Manual population for now.

### Step 12: Export Data from Keystone Portal

1. Login to Keystone: https://kppm.cincwebaxis.com
   - User: (see keystone-scraper/.env)
   - Pass: (see keystone-scraper/.env)

2. Open cache spreadsheet: https://docs.google.com/spreadsheets/d/1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ

3. Export from Keystone and populate each sheet:

   **Profiles sheet (from Community Information → Homeowner Directory):**
   - Column A: Address (e.g., "13737 Rock Point Unit 102")
   - Column B: Name
   - Column C: Phone
   - Column D: Email
   - Column E: AccountNumber
   - Column F: Leave blank (auto-filled by scraper later)

   **Violations sheet (from Board Overview → Violations):**
   - Column A: Address
   - Column B: Date
   - Column C: Description
   - Column D: Status (Open/Closed)
   - Column E: Leave blank (LastUpdated)

   **WorkOrders sheet (from Board Overview → Work Orders):**
   - Column A: Address
   - Column B: Date
   - Column C: Description
   - Column D: Status (Open/Closed/Board Review)
   - Column E: Type
   - Column F: Leave blank (LastUpdated)

   **ArchReviews sheet (from Board Overview → Architectural Review):**
   - Column A: Address
   - Column B: Date
   - Column C: Description
   - Column D: Status (Open/Closed/Approved)
   - Column E: Leave blank (LastUpdated)

**Checkpoint:** Cache populated with at least a few sample records.

---

## Part 6: Final Verification

### Step 13: Complete System Test

1. Submit form with known address that has cache data
2. Verify PDF includes Keystone data in report
3. Check execution logs for errors
4. Confirm email delivery

### Step 14: Monitor First Week

- Check Executions daily for errors
- Verify reports being sent successfully
- Respond to homeowner questions
- Watch for any Keystone data issues

---

## Rollback Plan (If Needed)

**Quick Rollback - PropertyReport Only:**
1. Open PropertyReport in Apps Script
2. Libraries → HOALibrary → Change to version 4
3. Revert Code.gs using version history
4. Save

**Full Rollback - Including HOALibrary:**
1. HOALibrary: Deploy → Manage deployments → Disable v5
2. PropertyReport: Libraries → HOALibrary → version 4
3. Remove KeystoneIntegration.gs and Version.gs files (optional)

---

## Deployment Completion Checklist

- [ ] HOALibrary v5 deployed with KeystoneIntegration.gs
- [ ] HOALibrary v5 has Version.gs
- [ ] PropertyReport uses HOALibrary v5 (verified in library settings)
- [ ] PropertyReport Code.gs updated to v18.1
- [ ] `debugMode: false` confirmed in CONFIG
- [ ] `keystoneCacheSheetId` correct in CONFIG
- [ ] Test form submission successful
- [ ] PDF includes Keystone section
- [ ] Execution logs show no errors
- [ ] Email sent to correct recipient
- [ ] Keystone cache has sample data
- [ ] System monitored for first week

---

## Support Files

- Full deployment guide: `~/hoa-code/DEPLOYMENT_INSTRUCTIONS.md`
- PropertyReport deployment: `~/hoa-code/PropertyReport/DEPLOYMENT_v18.1.md`
- Keystone scraper: `~/hoa-code/keystone-scraper/DEPLOYMENT.md`
- Architecture: `~/hoa-code/ARCHITECTURE.md`

---

**Status:** Ready for deployment
**Estimated Time:** 30-45 minutes
**Risk Level:** Low (graceful degradation, easy rollback)
