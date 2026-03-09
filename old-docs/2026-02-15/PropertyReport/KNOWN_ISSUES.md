# Property Report Processor - Known Issues & Limitations

Current limitations, known bugs, and planned improvements for Property Report Processor.

**Last Updated:** February 15, 2026
**Current Version:** 18.1

---

## Critical Issues

### None Currently (as of v18.1)

All critical bugs from v18.0 have been fixed in v18.1:
- ✅ Fixed undefined address variable
- ✅ Fixed debugMode default setting
- ✅ Fixed library development mode issue

---

## High Priority Limitations

### 1. Keystone Integration Not Implemented

**Status:** Planned for future release
**Impact:** Reports missing owner/dues information

**Details:**
- Function `getKeystoneData()` exists but returns empty results
- Placeholder spreadsheet configured but not populated
- No connection to actual Keystone HOA system

**Workaround:**
- Manually add owner data to reports if needed
- Use existing gutter/wood trim data only

**Timeline:** Next 2-4 weeks

---

### 2. Monolithic Code Structure

**Status:** Refactoring planned
**Impact:** Difficult to maintain, test, and extend

**Details:**
- Single file with 1,296 lines of code
- All functionality in one place
- Makes testing individual components difficult
- Hard to reuse functions in other projects

**Workaround:**
- None needed (code works fine, just not ideal structure)

**Related Work:**
- Modular version exists in `~/openclaw.jane/workspace/library_project/property_report/`
- 8 separate modules with clear responsibilities
- Migration to modular structure is P2 priority

**Timeline:** Next 1-2 months

---

### 3. No Retry Logic for API Failures

**Status:** Enhancement needed
**Impact:** Transient failures cause complete request failure

**Details:**
- No automatic retry for failed API calls
- Network hiccups can cause reports to fail
- User has to resubmit form if failure occurs

**Common Failure Scenarios:**
- Drive API timeout when accessing large folders
- Admin Directory API quota exceeded
- Network connectivity issues

**Workaround:**
- User resubmits form
- Manual intervention by admin

**Timeline:** Next month

---

## Medium Priority Issues

### 4. HEIF Image Conversion Limitations

**Status:** Partial support
**Impact:** Some iPhone photos may not convert properly

**Details:**
- iPhone photos in HEIF format need conversion to JPEG
- Conversion uses Drive API's `exportLinks` feature
- Not all HEIF variants supported
- Some photos may fail to convert silently

**Symptoms:**
- Missing photos in PDF report
- Execution log shows "HEIF conversion failed"

**Workaround:**
- Convert photos to JPEG before uploading to Drive
- Use different camera app on iPhone (set to JPEG mode)

**Related Code:**
- `convertHeifToJpeg()` function in Code.gs (line ~800)

**Timeline:** Low priority (workarounds exist)

---

### 5. Address Matching Edge Cases

**Status:** Known limitation
**Impact:** Some address variations may not match correctly

**Details:**
- Address standardization handles most common variations
- Some edge cases still fail:
  - Very old address formats
  - Addresses with typos
  - Non-standard abbreviations
  - Missing unit numbers

**Examples of Problematic Addresses:**
- "thirteen thousand seven hundred thirty-seven Rock Point" (spelled out numbers)
- "13737 RockPoint" (no space)
- "RP 13737 #102" (reversed order)

**Workaround:**
- Use standard format in form submissions: "13737 Rock Point #102"
- Admin can manually look up data if automated matching fails

**Related:**
- See HOALibrary/ADDRESS_SPEC.md for supported formats
- HOALibrary handles most common variations well

**Timeline:** Ongoing improvements

---

### 6. Large Folder Performance

**Status:** Known performance issue
**Impact:** Slow report generation for addresses with many photos

**Details:**
- Script iterates through all photos in folder
- Folders with 100+ photos can take 30+ seconds
- No pagination or limits implemented

**Workaround:**
- Organize photos into subfolders by date/project
- Keep address-specific folders under 50 photos

**Timeline:** P2 priority (not urgent)

---

## Low Priority / Minor Issues

### 7. No Dry-Run Mode

**Status:** Enhancement idea
**Impact:** Can't preview reports without sending email

**Details:**
- No way to generate report without sending it
- Testing always sends emails (even to admin in debug mode)

**Workaround:**
- Use `debugMode: true` to send test reports to admin only

**Timeline:** Nice to have

---

### 8. Limited Error Messages to Users

**Status:** Known UX issue
**Impact:** Users don't always know why request failed

**Details:**
- Technical errors not translated to user-friendly messages
- Users may get generic "error occurred" message
- No feedback about what data was missing

**Example:**
- If no gutter data found, report says "No data available" without explaining why

**Workaround:**
- Admin can check logs and contact user with explanation

**Timeline:** Next quarter

---

### 9. No Report History Tracking

**Status:** Feature not implemented
**Impact:** Can't see who requested what reports

**Details:**
- No database of report requests
- No tracking of what data was sent to whom
- Form responses stored but not linked to report generation

**Workaround:**
- Check form responses in Google Forms
- Review email sent history in Gmail
- Check Apps Script execution logs (limited retention)

**Timeline:** Future enhancement

---

### 10. PDF Formatting Limitations

**Status:** Acceptable but could be better
**Impact:** Reports are functional but not polished

**Details:**
- Basic text formatting only
- No HOA logo or branding
- Simple table layouts
- Photos not optimized for size

**Workaround:**
- None needed (reports are readable)

**Timeline:** Low priority

---

## Resolved Issues (Fixed in Recent Versions)

### ✅ Undefined Address Variable (Fixed in v18.1)
**Was:** Critical bug causing script failure
**Fixed:** Address now properly extracted from form submission
**Version:** 18.1

### ✅ Debug Mode Defaults to True (Fixed in v18.1)
**Was:** Reports always going to admin
**Fixed:** Default is now `false` for production
**Version:** 18.1

### ✅ Library in Development Mode (Fixed in v18.1)
**Was:** Unstable library references
**Fixed:** Now uses published version 4+
**Version:** 18.1

### ✅ Drive Shortcuts Not Recognized (Fixed in v16.0)
**Was:** Script couldn't find folders that were shortcuts
**Fixed:** Added support for shortcuts
**Version:** 16.0

### ✅ Session API Unreliable (Fixed in v13.0)
**Was:** Couldn't reliably get form submitter email
**Fixed:** Switched to form email field
**Version:** 13.0

---

## Not Issues (Working As Designed)

### Service Account Required
**Not a bug:** This is the intended authentication method
**Why:** Allows server-to-server operation without user login
**Documentation:** See service account setup guide

### Reports Only for Owners
**Not a bug:** Intentional security/privacy feature
**Why:** Prevents non-owners from accessing property data
**Configuration:** `ownersGroup` in CONFIG

### No Real-Time Keystone Data
**Not a bug:** Integration not yet built
**Status:** Planned feature, not a regression

---

## Issue Reporting

### How to Report New Issues

1. **Check Execution Logs:**
   - Apps Script editor → Executions
   - Review error messages and stack traces

2. **Gather Information:**
   - What address was submitted?
   - What email was used?
   - What was the expected behavior?
   - What actually happened?
   - Any error messages?

3. **Document:**
   - Add to this file under appropriate priority
   - Include reproduction steps
   - Note any workarounds discovered

4. **Contact:**
   - Email: admin@villasboulders.org
   - Include execution log ID if available

---

## Prioritization Criteria

**Critical:** Prevents all reports from being generated
**High:** Affects many users or core functionality
**Medium:** Affects some users in specific scenarios
**Low:** Nice to have, minor inconvenience

---

## Roadmap

See `REFACTORING_ROADMAP.md` in root directory for planned improvements.

**Next 2 Weeks:**
- Implement Keystone integration
- Add retry logic for API calls
- Improve error messages

**Next Month:**
- Refactor to modular structure
- Add automated testing
- Performance optimization

**Next Quarter:**
- Enhanced PDF formatting
- Report history tracking
- Dry-run mode

---

**Maintained By:** Dee Buck
**Last Review:** February 15, 2026
**Next Review:** After production deployment
