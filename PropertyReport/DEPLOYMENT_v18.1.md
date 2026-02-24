# Property Report v18.1 Deployment Guide

**Version:** 18.1
**Status:** Ready for deployment
**Date:** February 15, 2026

---

## What Was Fixed

### Critical Bug #1: Corrupted onFormSubmit() Function
**Problem:** The entire `onFormSubmit(e)` function had the wrong function body - it contained the implementation of `getGutterFolderImages()` instead of form processing logic.

**Impact:** Forms could not be processed at all. The `address` variable was undefined because the function never extracted data from the form submission.

**Fix:** Completely rewrote `onFormSubmit(e)` with correct implementation:
- Extracts email from form: `e.response.getRespondentEmail()`
- Validates ownership: `HOALibrary.isHOAOwner(email)`
- Looks up address: `HOALibrary.getHomeownerFromEmail(email)`
- Processes report: gatherReportData → generatePdfReport → sendReportEmail

### Critical Bug #2: debugMode = true
**Problem:** Config had `debugMode: true` which sends all emails to admin instead of actual requesters.

**Impact:** Homeowners never received their reports; only admin got them.

**Fix:** Changed to `debugMode: false` with clear comment explaining usage.

### Critical Bug #3: HOALibrary in Development Mode
**Problem:** Library dependency was set to development mode (v0) instead of published version.

**Impact:** Unstable, changes to library could break production without notice.

**Fix:** This must be fixed in Apps Script editor (not in code). See deployment steps below.

---

## Pre-Deployment Checklist

### 1. Verify Local Changes

```bash
# Check that fixes are in place
grep "debugMode: false" ~/hoa-code/PropertyReport/Code.gs
grep "Version: 18.1" ~/hoa-code/PropertyReport/Code.gs
grep "HOALibrary.isHOAOwner" ~/hoa-code/PropertyReport/Code.gs
```

All three should return matches.

### 2. Review Code Changes

**Files Modified:**
- `/home/dee/hoa-code/PropertyReport/Code.gs` (3 changes)
  - Line 17: `debugMode: false` (was true)
  - Lines 1-15: Updated version to 18.1 with fix notes
  - Lines 32-107: Complete rewrite of `onFormSubmit(e)` function

**Files Updated:**
- `/home/dee/hoa-code/PropertyReport/CHANGELOG.md`
  - Updated v18.1 entry with accurate fix details

### 3. Backup Current Production Version

Before deploying, save current production code:

**In Apps Script Editor:**
1. Open Property Report Processor project
2. File → Make a copy
3. Rename copy to "Property Report v18.0 BACKUP - 2026-02-15"
4. Keep as emergency rollback option

---

## Deployment Steps

### Step 1: Upload Code to Apps Script

**Option A: Manual Copy-Paste (Recommended)**
1. Open Apps Script editor at script.google.com
2. Select "Property_Report_Processor_Standalone" project
3. Open Code.gs file
4. Select all (Ctrl+A) and delete
5. Open `/home/dee/hoa-code/PropertyReport/Code.gs` in text editor
6. Copy entire contents
7. Paste into Apps Script editor
8. Save (Ctrl+S)

**Option B: Using clasp (if configured)**
```bash
cd ~/hoa-code/PropertyReport
clasp push
```

### Step 2: Configure Library Dependency

**CRITICAL: Set HOALibrary to published version**

1. In Apps Script editor, click "Libraries" (+ icon in left sidebar)
2. Find "HOALibrary" in the list
3. Check current version:
   - If showing "development" or "0" → **MUST CHANGE**
   - If showing "4" or higher → Already correct
4. To change:
   - Click the version dropdown
   - Select version **4** (or latest published version)
   - Click "Save"

**Why This Matters:**
- Development mode (0) links to editable version
- Published version (4+) is stable and won't change unexpectedly
- Production should always use published versions

### Step 3: Test Configuration

**Test 1: Check Debug Mode**
```javascript
// In Apps Script editor, run this in the console:
console.log(CONFIG.debugMode);
// Should output: false
```

**Test 2: Check Library Version**
```javascript
// In Apps Script editor:
console.log(HOALibrary.VERSION);
// Should output: 4 or higher (not 0)
```

### Step 4: Verify Form Trigger

1. In Apps Script editor, click "Triggers" (clock icon)
2. Verify trigger exists:
   - Function: `onFormSubmit`
   - Event type: Form submission
   - Form: Property Report Request Form
3. If missing, create it:
   - Click "+ Add Trigger"
   - Choose function: `onFormSubmit`
   - Select event source: "From form"
   - Select form: "Property Report Request Form"
   - Save

---

## Testing Strategy

### Phase 1: Dry Run with Admin Email

**Purpose:** Test without affecting homeowners

1. **Temporarily enable debug mode:**
   ```javascript
   debugMode: true  // Change in Apps Script editor
   ```

2. **Submit test form as admin:**
   - Go to form: Property Report Request Form
   - Submit with admin@villasboulders.org
   - Check admin email for PDF report

3. **Verify:**
   - ✅ Email received
   - ✅ PDF attached
   - ✅ PDF contains correct data
   - ✅ No errors in execution log
   - ✅ Logs show: "Email verified as HOA owner"
   - ✅ Logs show: "Found address: [address]"
   - ✅ Logs show: "REPORT SENT SUCCESSFULLY"

4. **Check execution logs:**
   - Apps Script editor → "Executions" (left sidebar)
   - Find latest execution
   - Review console output for errors

5. **If successful, disable debug mode:**
   ```javascript
   debugMode: false  // Change back
   ```

### Phase 2: Test with Known Owner

**Purpose:** Full end-to-end test with real homeowner

1. **Coordinate with a friendly board member:**
   - Explain you're testing improved report system
   - Ask them to submit form request
   - Have them verify they receive report

2. **Submit form as that board member:**
   - Use their actual email (must be in owners group)
   - Verify they have address in contacts

3. **Monitor:**
   - Check execution logs for errors
   - Confirm board member receives email within 1 minute
   - Ask them to verify PDF looks correct

### Phase 3: Production Monitoring

**First Week After Deployment:**

1. **Daily Log Review:**
   - Apps Script editor → Executions
   - Check for any red error icons
   - Verify reports are being sent

2. **Watch for Common Issues:**
   - "Not an HOA owner" errors (contact not in group)
   - "Could not find address" errors (contact missing address)
   - PDF generation failures
   - API quota errors (unlikely but possible)

3. **Response Plan:**
   - If critical errors: Revert to v18.0 backup immediately
   - If minor issues: Document in KNOWN_ISSUES.md
   - If widespread failures: Notify admin, disable form

---

## Rollback Procedure

If critical issues occur:

### Emergency Rollback (< 5 minutes)

1. Open Apps Script editor
2. Find "Property Report v18.0 BACKUP - 2026-02-15" project
3. Copy entire Code.gs contents
4. Open "Property_Report_Processor_Standalone" (production)
5. Replace Code.gs with backup code
6. **IMPORTANT:** Set `debugMode: false` in backup if needed
7. Save
8. Verify form trigger still points to `onFormSubmit`
9. Test with admin email immediately

### Post-Rollback

1. Document what went wrong in KNOWN_ISSUES.md
2. Fix issues in local ~/hoa-code/PropertyReport/Code.gs
3. Test fixes locally if possible
4. Re-attempt deployment when fixed

---

## Success Criteria

### Deployment Successful If:

- ✅ Form submissions trigger script execution
- ✅ Owner validation works (owners get reports, non-owners get rejection)
- ✅ Address lookup succeeds for contacts with addresses
- ✅ PDF reports generated with correct data
- ✅ Emails sent to actual requesters (not just admin)
- ✅ No errors in execution logs
- ✅ Response time reasonable (< 30 seconds per request)

### Known Limitations (Not Bugs):

- Keystone data not implemented (shows empty sections)
- HEIF conversion may fail for some iPhone photos (rare)
- No retry logic for API failures (manual resubmit needed)
- Single address per contact (multiple properties not supported)

---

## Post-Deployment Tasks

### Immediate (Day 1)

- [ ] Monitor first 5 form submissions closely
- [ ] Verify PDF reports look correct
- [ ] Check execution logs for errors
- [ ] Respond quickly to any homeowner questions

### First Week

- [ ] Review execution logs daily
- [ ] Track success/failure rate
- [ ] Document any new issues found
- [ ] Update KNOWN_ISSUES.md if needed

### First Month

- [ ] Gather feedback from homeowners
- [ ] Measure average execution time
- [ ] Check API quota usage
- [ ] Plan improvements for next version

---

## Configuration Reference

### CONFIG Settings (After Deployment)

```javascript
const CONFIG = {
  formId: '1mMuV-hdcE8bVN75m8y5OxlMjMRsITslnbYSF1AMN-y0',
  debugMode: false,  // ← MUST BE FALSE for production
  adminEmail: 'admin@villasboulders.org',
  managerEmail: 'manager@villasboulders.org',
  guttersSheetId: '10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A',
  woodTrimSheetId: '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE',
  keystoneCacheSheetId: '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ',
  ownersGroup: 'owners@villasboulders.org'
};
```

### Library Dependencies

- **HOALibrary:** Version 4+ (published, not development)
- **Script ID:** Check in Libraries section

---

## Support

### If Issues Occur

1. **Check execution logs first:**
   - Apps Script editor → Executions
   - Click on failed execution
   - Read error message and stack trace

2. **Common Errors:**
   - "Exception: Not an HOA owner" → User not in owners group
   - "Could not find address" → Contact missing address field
   - "API quota exceeded" → Too many requests, wait and retry

3. **Contact:**
   - Developer: Dee Buck (mcdonaldbuck@gmail.com)
   - Admin: admin@villasboulders.org

### Related Documentation

- `README.md` - Setup and usage guide
- `CONFIGURATION.md` - Detailed config reference
- `KNOWN_ISSUES.md` - Current limitations
- `CHANGELOG.md` - Version history

---

## Version Information

**Previous Version:** 18.0 (Had critical bugs, deprecated)
**Current Version:** 18.1 (Fixed, ready for production)
**Next Version:** 19.0 (Planned: Keystone integration, retry logic)

---

**Last Updated:** February 15, 2026
**Deployment Status:** READY - Awaiting testing and deployment
**Deployed By:** [To be filled in after deployment]
**Deployment Date:** [To be filled in after deployment]

