# HOA Code - Current Implementation Plan

**Version:** 1.0
**Date:** February 16, 2026
**Status:** ACTIVE - This is the current plan we're executing

**Supersedes:** All other planning documents (see INDEX.md for document status)

---

## Strategy: Finish Current System First (Incremental Approach)

We are **95% complete** with the current PropertyReport system. Rather than abandoning this work for a larger architecture change, we will:

1. **This Week:** Finish current system (5 hours) → Deliver value to homeowners
2. **Next Week:** Plan future improvements (AppSheet, database migration)
3. **Week 3+:** Execute improvements incrementally with working baseline

---

## Current System Status

### ✅ Already Completed

- PropertyReport v18.1 deployed (bug fixes, image handling)
- HOALibrary v11 deployed (address standardization for full US addresses with zip codes)
- Keystone scraper built (Selenium-based, working)
- Gutters data integration working
- Wood Trim data integration working
- Photos sync tool built (Google Photos → Drive with HEIF conversion)

### 🔧 In Progress (This Week)

1. **Fix Keystone Scraper** - Switch to better data source
2. **Test PropertyReport End-to-End** - Verify all components working
3. **Add Work Orders (if needed)** - Simple integration

### 📋 Remaining Work (5 Hours Total)

#### Task 1: Update Keystone Scraper (2 hours)

**Current Problem:**
- Scraping Homeowner Directory (messy concatenated data)
- Trying to get profile data we already have elsewhere

**Solution:**
- Switch to "Board Overview → Accounts Receivable Detail → All Homeowners"
- Scrape ONLY account numbers (the one piece of unique data from Keystone)
- Keep violations scraping (Keystone is source of truth for violations)
- Write to clean sheet format

**Script:** `~/hoa-code/keystone-scraper/keystone_scraper_selenium.py`

**Changes:**
```python
# Replace scrape_homeowner_directory() with:
def scrape_accounts_receivable():
    """
    Scrape Board Overview → Accounts Receivable Detail → All Homeowners
    Get: Street Number, Street Name, Unit, Account Number
    """
    # Navigate to accounts receivable page
    # Set dropdown to "All Homeowners"
    # Parse table (simpler structure than homeowner directory)
    # Return list of {address, accountNumber}
```

**Output Sheet:** Profiles tab
```
Address | AccountNumber | LastUpdated
13738RP1 | 123456 | 2026-02-16 03:00:00
```

**Test:**
- Run scraper
- Verify addresses standardize correctly
- Verify account numbers present
- Check for any parsing errors

#### Task 2: Test PropertyReport End-to-End (1 hour)

**Test Address:** 13738 Rock Point Unit 101 (has Keystone data in cache)

**Test Steps:**
1. Open PropertyReport in Apps Script editor
2. Run `testPropertyReport` function
3. Check execution logs for:
   - ✅ Address standardization working
   - ✅ Keystone account number found
   - ✅ No parsing errors
   - ✅ PDF generated
   - ✅ Email sent

**Expected Result:**
```
=== MANUAL TEST RUN ===
Testing address: 13738 Rock Point Unit 101
Gathering report data...
  Standardized: 13738RP1
  Building: 13738RP
  Unit: 1
  Account Number: 123456 (found)
  Gutters: X rows
  Wood Trim: X rows
  Violations: 0
PDF generated successfully!
✅ TEST COMPLETE
```

**If Issues:**
- Debug address matching
- Check sheet permissions
- Verify data format

#### Task 3: Add Work Orders (2 hours) - OPTIONAL

**Question for User:** Do you already have a work orders spreadsheet?

**Option A: Use Existing Spreadsheet**
- Get spreadsheet ID
- Add to PropertyReport CONFIG
- Write query function
- Test

**Option B: Create Simple Spreadsheet**
- Create "Work Orders" sheet with columns:
  - Address | Date | Type | Description | Status | Notes
- Manual data entry for now
- PropertyReport queries it
- Can upgrade to AppSheet later

**Option C: Skip for Now**
- PropertyReport works without work orders
- Add later when we have AppSheet forms

---

## This Week's Deliverables

### By End of Week

1. **Working Keystone Scraper**
   - Runs nightly (cron job)
   - Gets account numbers from Accounts Receivable
   - Gets violations
   - Writes to clean sheet format

2. **Tested PropertyReport**
   - Generates reports with account numbers
   - Includes all existing data (gutters, wood trim)
   - Produces PDF correctly
   - Emails to homeowners

3. **Documentation Updated**
   - This plan document (CURRENT_PLAN.md)
   - Document index (INDEX.md)
   - Archive old/conflicting docs

### Success Criteria

- [ ] Homeowner can request property report via form
- [ ] PropertyReport generates PDF with all data
- [ ] PDF includes Keystone account number
- [ ] System runs without manual intervention
- [ ] No errors in execution logs

---

## What We're NOT Doing (Yet)

### Deferred to Next Phase

1. **AppSheet Migration** - Saved in FUTURE_APPSHEET_PLAN.md
   - Will implement after current system is stable
   - No rush - current system works fine

2. **Database Migration** - Future consideration
   - Firestore vs better Sheets structure
   - Only if performance becomes issue

3. **PropertyReport Refactoring** - Future improvement
   - Modular library structure exists at `~/openclaw.jane/workspace/library_project/`
   - Can migrate when current system is stable

4. **Website Forms** - Future enhancement
   - Current Google Forms work fine
   - Can upgrade to AppSheet or custom later

---

## Next Week's Planning Session

**After current system is working, we'll discuss:**

1. **AppSheet Migration**
   - Review FUTURE_APPSHEET_PLAN.md
   - Decide if/when to implement
   - Plan parallel testing approach

2. **Data Architecture**
   - Sheets vs Firestore
   - Work orders structure
   - Long-term scalability

3. **Website Integration**
   - Forms strategy
   - Mobile experience
   - Homeowner portal

4. **Refactoring Priorities**
   - PropertyReport modularization
   - Automated testing
   - Deployment automation

---

## Immediate Action Items (Today)

### For Claude:

- [ ] Update Keystone scraper to use Accounts Receivable Detail
- [ ] Test scraper with new data source
- [ ] Verify address matching works
- [ ] Run PropertyReport test
- [ ] Document results

### For Dee:

- [ ] Review this plan - confirm approach
- [ ] Clarify: Do we have existing work orders spreadsheet?
- [ ] Decide: Add work orders this week or defer?
- [ ] Test: Run PropertyReport when ready
- [ ] Approve: Sign off on deployment

---

## Risk Mitigation

### Risk 1: Scraper Fails with New Data Source

**Mitigation:**
- Keep old scraper code as backup
- Test thoroughly before deploying
- Manual fallback (can enter account numbers directly)

### Risk 2: Address Matching Issues

**Mitigation:**
- Already fixed in HOALibrary v11
- Test with multiple address formats
- Have manual correction process

### Risk 3: PropertyReport Errors

**Mitigation:**
- Test with multiple addresses
- Check all data sources
- Have error handling in place
- Can rollback to previous version if needed

---

## Communication Plan

### This Week (Internal)

- Board members only
- Test with known addresses
- Fix any issues found

### Next Week (Rollout)

**If all tests pass:**
- Announce to homeowners
- Provide instructions for requesting reports
- Monitor first few submissions
- Quick response to any issues

**If issues found:**
- Fix issues first
- Additional testing
- Delay announcement

---

## Appendix A: File Locations

### Active Code

- PropertyReport: `~/hoa-code/PropertyReport/Code.js`
- HOALibrary: `~/hoa-code/HOALibrary/*.gs`
- Keystone Scraper: `~/hoa-code/keystone-scraper/keystone_scraper_selenium.py`
- Photos Sync: `~/hoa-code/photos-to-drive/photos_to_drive.py`

### Spreadsheets

- Gutters: ID in PropertyReport CONFIG
- Wood Trim: ID in PropertyReport CONFIG
- Keystone Cache: `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`

### Documentation

- This Plan: `~/hoa-code/CURRENT_PLAN.md`
- Document Index: `~/hoa-code/INDEX.md`
- Future Plans: `~/hoa-code/FUTURE_APPSHEET_PLAN.md`

---

## Appendix B: Timeline

```
Week 1 (This Week)
├─ Monday: Update scraper
├─ Tuesday: Test PropertyReport
├─ Wednesday: Add work orders (optional)
├─ Thursday: Final testing
└─ Friday: Documentation & review

Week 2 (Next Week)
├─ Monday-Tuesday: Planning session (AppSheet, architecture)
├─ Wednesday-Friday: Start next phase (if approved)
```

---

## Appendix C: Contact & Support

- **Technical Questions:** Claude (this session)
- **HOA Admin:** admin@villasboulders.org
- **Management:** manager@villasboulders.org

---

**Status Updates:**

| Date | Status | Notes |
|------|--------|-------|
| 2026-02-16 | Plan Created | Documented incremental approach |
| | | |

---

**END OF CURRENT PLAN**

**Next Steps:** Execute Task 1 (Update Keystone Scraper)
