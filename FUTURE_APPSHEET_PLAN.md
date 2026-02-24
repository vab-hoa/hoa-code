# HOA Data Management System - AppSheet + Sheets Architecture Specification

**Version:** 1.0
**Date:** February 16, 2026
**Status:** DRAFT - Awaiting Approval

---

## Executive Summary

Migrate HOA data management from scattered spreadsheets and Google Forms to a unified system using:
- **AppSheet** for mobile and web forms
- **Google Sheets** as structured database
- **Minimal Keystone integration** (account numbers and violations only)
- **Nightly scraper** to sync essential Keystone data
- **PropertyReport** unified queries from single data source

**Key Benefits:**
- Professional mobile and web forms (replace survey-like Google Forms)
- Structured, queryable data (consistent format across all data types)
- Visual data checking (can see/edit everything in Sheets)
- Unified data source (PropertyReport queries one place)
- Future-proof (can migrate to Firestore later if needed)

---

## Current State vs Future State

### Current State (Problems)

**Data Sources:**
- Gutters: Spreadsheet with good structure ✓
- Wood Trim: Spreadsheet with good structure ✓
- Violations: Was going to scrape from Keystone (bad data)
- Work Orders: Was going to scrape from Keystone (bad data)
- ARC Requests: Was going to scrape from Keystone (bad data)
- Contact info: Google Contacts (better than Keystone)

**Forms:**
- Google Forms (survey-like, clunky on mobile)
- Data captured in messy format
- Hard to process

**Problems:**
- Keystone data is poor quality (only 18 months history)
- Scraping complex HTML → concatenated strings → re-parsing
- Multiple data sources → complex PropertyReport queries
- Google Forms not suitable for operational workflows

### Future State (Solution)

**Single Data Source:**
- One master spreadsheet: "HOA Operations Database"
- Multiple tabs with consistent structure
- All operational data in one place

**Data Entry:**
- AppSheet apps (mobile + web) for work orders, ARC requests
- Keystone portal for day-to-day management (but not source of truth)
- Manual entry option (can edit Sheets directly)

**Data Sync:**
- Nightly scraper: Keystone → Sheets (account numbers + violations only)
- AppSheet forms → Sheets (work orders, ARC requests)
- Manual updates → Sheets (any corrections)

**Reporting:**
- PropertyReport queries single spreadsheet
- Unified data model = simpler queries
- Better performance

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  AppSheet    │  │  Website     │  │  Direct Sheet   │  │
│  │  Mobile Apps │  │  (links to   │  │  Editing        │  │
│  │              │  │  AppSheet)   │  │  (manual)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                    │           │
│         └─────────────────┴────────────────────┘           │
│                           │                                │
└───────────────────────────┼────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               CENTRAL DATA STORE                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         Google Sheets: "HOA Operations Database"           │
│                                                             │
│  Tabs:                                                      │
│  - AccountNumbers  (from Keystone scraper)                 │
│  - Violations      (from Keystone scraper)                 │
│  - WorkOrders      (from AppSheet + manual)                │
│  - ArchReviews     (from AppSheet + manual)                │
│  - Gutters         (existing, from manual entry)           │
│  - WoodTrim        (existing, from manual entry)           │
│                                                             │
└───────────────────┬────────────────────┬────────────────────┘
                    │                    │
                    ▼                    ▼
         ┌──────────────────┐  ┌──────────────────┐
         │  PropertyReport  │  │  Other Reports   │
         │  (Apps Script)   │  │  & Analytics     │
         └──────────────────┘  └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   DATA SOURCES                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐                                  │
│  │  Keystone Portal     │                                  │
│  │  (nightly scraper)   │                                  │
│  │                      │                                  │
│  │  Scrapes:            │                                  │
│  │  - Account Numbers   │                                  │
│  │  - Violations        │                                  │
│  └──────────────────────┘                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structure Specification

### Master Spreadsheet

**Name:** "HOA Operations Database"
**Location:** HOA Board Documents shared drive
**Owner:** admin@villasboulders.org
**Access:** Board members (edit), HOA members (view selected tabs)

### Tab 1: AccountNumbers

**Purpose:** Keystone account numbers for each property (scraped nightly)

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| Address | Text | Standardized HOA address | 13738RP1 | Yes |
| DisplayAddress | Text | Human-readable address | 13738 Rock Point Unit 101 | Yes |
| AccountNumber | Text | Keystone account ID | 123456 | Yes |
| AccountName | Text | Account holder name | John & Jane Doe Trust | No |
| LastUpdated | DateTime | Last scrape timestamp | 2026-02-16 03:00:00 | Yes |
| Source | Text | Always "Keystone" | Keystone | Yes |

**Notes:**
- One row per property
- Updated nightly by scraper
- PropertyReport uses this for account lookup only

### Tab 2: Violations

**Purpose:** HOA violations (from Keystone only - we don't create our own)

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| ViolationID | Text | Unique ID | VIO-2026-001 | Yes |
| Address | Text | Standardized address | 13738RP1 | Yes |
| DisplayAddress | Text | Human-readable | 13738 Rock Point Unit 101 | Yes |
| Date | Date | Violation date | 2026-02-15 | Yes |
| Type | Text | Category | Landscaping | No |
| Description | Text | What the violation is | Overgrown bushes | Yes |
| Status | Text | Open/Closed/Resolved | Open | Yes |
| DateResolved | Date | When resolved | 2026-02-20 | No |
| ResolutionNotes | Text | How it was resolved | Homeowner trimmed bushes | No |
| Source | Text | Always "Keystone" | Keystone | Yes |
| LastUpdated | DateTime | Last scrape timestamp | 2026-02-16 03:00:00 | Yes |

**Notes:**
- Scraped from Keystone nightly
- Board does NOT create violations here (uses Keystone portal)
- This is just a cache for PropertyReport

### Tab 3: WorkOrders

**Purpose:** Maintenance work orders (HOA-initiated maintenance)

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| WorkOrderID | Text | Unique ID | WO-2026-001 | Yes |
| Address | Text | Standardized address | 13738RP1 | Yes |
| DisplayAddress | Text | Human-readable | 13738 Rock Point Unit 101 | Yes |
| DateCreated | DateTime | When created | 2026-02-15 10:30:00 | Yes |
| Type | Dropdown | Category | Gutter, Roof, HVAC, Plumbing, Electrical, Landscaping, Other | Yes |
| Description | LongText | Detailed description | Gutter leaking at corner | Yes |
| Priority | Dropdown | Urgency | Low, Medium, High, Emergency | Yes |
| Status | Dropdown | Current state | Pending, Scheduled, In Progress, Completed, Cancelled | Yes |
| AssignedTo | Text | Contractor name | ABC Gutters | No |
| ScheduledDate | Date | When scheduled | 2026-02-20 | No |
| CompletedDate | Date | When completed | 2026-02-22 | No |
| EstimatedCost | Number | Estimated $ | 250.00 | No |
| ActualCost | Number | Final $ | 275.00 | No |
| RequestedBy | Email | Who reported it | homeowner@example.com | Yes |
| Photos | ImageList | Attached photos | [url1, url2] | No |
| Notes | LongText | Additional info | Homeowner available after 3pm | No |
| Source | Dropdown | Where created | AppSheet, Manual, Keystone, Website | Yes |
| LastUpdated | DateTime | Last modified | 2026-02-16 14:00:00 | Yes |

**Notes:**
- Primary data entry via AppSheet (mobile/web)
- Can be manually edited in Sheet
- PropertyReport shows all work orders for property

### Tab 4: ArchReviews

**Purpose:** Architectural Review Committee requests

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| ReviewID | Text | Unique ID | ARC-2026-001 | Yes |
| Address | Text | Standardized address | 13738RP1 | Yes |
| DisplayAddress | Text | Human-readable | 13738 Rock Point Unit 101 | Yes |
| DateSubmitted | DateTime | When submitted | 2026-02-15 10:30:00 | Yes |
| RequestType | Dropdown | Category | Landscape, Exterior Paint, Roof, Windows, Door, Deck/Patio, Fence, HVAC, Solar, Other | Yes |
| Description | LongText | What they want to do | Replace front door with black metal door | Yes |
| Status | Dropdown | Review status | Submitted, Under Review, Approved, Denied, More Info Needed, Withdrawn | Yes |
| SubmittedBy | Email | Homeowner email | homeowner@example.com | Yes |
| DateReviewed | Date | Committee review date | 2026-02-20 | No |
| CommitteeResponse | LongText | Approval/denial notes | Approved with condition: match existing trim color | No |
| Conditions | LongText | Any conditions | Must use matching trim color | No |
| ApprovalExpires | Date | Approval valid until | 2026-08-20 | No |
| Photos | ImageList | Attached photos/plans | [url1, url2] | No |
| Source | Dropdown | Where created | AppSheet, Manual, Keystone, Website | Yes |
| LastUpdated | DateTime | Last modified | 2026-02-16 14:00:00 | Yes |

**Notes:**
- Primary data entry via AppSheet (homeowners submit via mobile/web)
- Board reviews and updates status
- PropertyReport shows approval status

### Tab 5: Gutters (Existing)

**No changes** - Keep current structure

### Tab 6: WoodTrim (Existing)

**No changes** - Keep current structure

---

## AppSheet Apps Specification

### App 1: HOA Work Orders

**Purpose:** Submit and track maintenance work orders

**Views:**

1. **Home View (Dashboard)**
   - Quick actions: "Submit New Work Order"
   - Recent work orders (last 10)
   - My open work orders

2. **Submit Work Order Form**
   - Address (dropdown from property list)
   - Type (dropdown)
   - Description (text area)
   - Priority (dropdown)
   - Photos (camera/gallery upload)
   - Contact info (auto-filled from user)
   - Submit button

3. **My Work Orders**
   - List view of work orders I submitted
   - Filter: All / Open / Completed
   - Each row shows: Address, Type, Status, Date
   - Tap to view details

4. **Work Order Detail**
   - Read-only view of submitted work order
   - Status updates visible
   - Photos displayed
   - History log

5. **Board: All Work Orders** (Board only)
   - List of all work orders
   - Filters: Status, Type, Date range
   - Can update status, assign contractor
   - Can add notes

**Users:**
- Homeowners: Can submit, view their own
- Board members: Can view all, update status
- Manager: Full access

**Permissions:**
- Homeowners: Read own rows, Create new
- Board: Read all, Update all
- Manager: Full access

### App 2: HOA Architectural Reviews

**Purpose:** Submit and track ARC requests

**Views:**

1. **Home View (Dashboard)**
   - Quick actions: "Submit ARC Request"
   - My pending requests
   - Recent decisions

2. **Submit ARC Request Form**
   - Address (dropdown from property list)
   - Request Type (dropdown)
   - Description (text area with guidance)
   - Expected start date
   - Photos/plans (camera/gallery upload)
   - Contractor info (optional)
   - Submit button

3. **My ARC Requests**
   - List view of my requests
   - Filter: All / Pending / Approved / Denied
   - Status badge (color-coded)
   - Tap to view details

4. **ARC Request Detail**
   - Full request details
   - Committee response (if reviewed)
   - Approval conditions
   - Photos/plans
   - Timeline

5. **Committee: Review Queue** (Committee only)
   - Pending requests
   - Can update status
   - Can add committee response
   - Can set conditions

**Users:**
- Homeowners: Can submit, view their own
- ARC Committee: Can view all, update status
- Board/Manager: Full access

**Permissions:**
- Homeowners: Read own rows, Create new
- Committee: Read all, Update status/response
- Board/Manager: Full access

### App 3: HOA Board Dashboard (Optional - Phase 2)

**Purpose:** Board overview of all operations

**Views:**
- Open violations by property
- Pending work orders
- Pending ARC reviews
- Recent activity feed
- Property lookup

**Users:** Board members only

---

## Keystone Scraper Changes

### Current Scraper Issues

- Scraping Homeowner Directory (messy data, concatenated addresses)
- Trying to get profile data (name, phone, email) - but we have better data
- Parsing DevExpress grids poorly

### New Scraper Specification

**What to Scrape:**

1. **Board Overview → Accounts Receivable Detail → "All Homeowners"**
   - Purpose: Get Keystone account numbers
   - Frequency: Nightly (3 AM)
   - Data extracted:
     - Street Number (separate field)
     - Street Name
     - Unit
     - Account Number
     - Account Name
   - Write to: AccountNumbers tab

2. **Violations**
   - Page: Violations list
   - Frequency: Nightly (3 AM)
   - Data extracted:
     - Address (parse to standardized format)
     - Date
     - Description
     - Status
   - Write to: Violations tab

**What NOT to Scrape:**
- ❌ Homeowner Directory (we have better contact data)
- ❌ Work Orders (we'll maintain our own)
- ❌ Arch Reviews (we'll maintain our own)

**Scraper Script:** `~/hoa-code/keystone-scraper/keystone_scraper_selenium.py`

**Changes needed:**
1. Remove `scrape_homeowner_directory()` function
2. Add `scrape_accounts_receivable()` function
3. Update `scrape_violations()` to handle new sheet structure
4. Update sheet writing to new schema
5. Add better error handling and logging

**Cron Job:**
```bash
# Run every night at 3 AM
0 3 * * * cd /home/dee/hoa-code/keystone-scraper && ./venv/bin/python3 keystone_scraper_selenium.py >> /var/log/keystone-scraper.log 2>&1
```

---

## PropertyReport Changes

### Current State

- Queries multiple spreadsheets:
  - Gutters spreadsheet
  - Wood Trim spreadsheet
  - Keystone cache spreadsheet (was going to be 4 tabs)

### New State

- Queries ONE spreadsheet: "HOA Operations Database"
- Unified data model = simpler code

### Code Changes Needed

**File:** `~/hoa-code/PropertyReport/Code.js`

**Section 1: Configuration**
```javascript
const CONFIG = {
  // ... existing config ...

  // NEW: Single operations database
  operationsDbId: 'SPREADSHEET_ID_HERE',  // HOA Operations Database

  // REMOVE: Old individual sheet IDs
  // guttersSheetId: '...',
  // woodTrimSheetId: '...',
  // keystoneCacheSheetId: '...',
};
```

**Section 2: Data Retrieval Functions**

Replace separate functions with unified queries:

```javascript
// OLD (remove these):
// - getGutterData(address)
// - getWoodTrimData(address)
// - getKeystoneProfileData(address)
// - getKeystoneViolations(address)
// - getKeystoneWorkOrders(address)
// - getKeystoneArchReviews(address)

// NEW (create these):
// - getAccountNumber(address)      // Query AccountNumbers tab
// - getViolations(address)         // Query Violations tab
// - getWorkOrders(address)         // Query WorkOrders tab
// - getArchReviews(address)        // Query ArchReviews tab
// - getGutterData(address)         // Query Gutters tab (updated)
// - getWoodTrimData(address)       // Query WoodTrim tab (updated)
```

**Section 3: Report Generation**

Update `gatherReportData()` to query new structure:

```javascript
function gatherReportData(email, standardizedAddress, displayAddress, originalAddress) {
  const data = {
    requestedBy: email,
    standardizedAddress: standardizedAddress,
    displayAddress: displayAddress,
    originalAddress: originalAddress,

    // Query operations database
    accountNumber: getAccountNumber(standardizedAddress),
    violations: getViolations(standardizedAddress),
    workOrders: getWorkOrders(standardizedAddress),
    archReviews: getArchReviews(standardizedAddress),
    gutters: getGutterData(standardizedAddress),
    woodTrim: getWoodTrimData(standardizedAddress)
  };

  return data;
}
```

**Section 4: PDF Generation**

Update PDF sections to include new data:

- Account Number section (if found)
- Violations section (if any)
- Work Orders section (if any)
- ARC Reviews section (if any)
- Gutters section (existing)
- Wood Trim section (existing)

---

## Implementation Plan

### Phase 1: Setup & Data Structure (Week 1)

**Day 1-2: Spreadsheet Setup**

- [ ] Create "HOA Operations Database" spreadsheet
- [ ] Create tabs with proper column headers
- [ ] Set up data validation (dropdowns, date formats)
- [ ] Configure permissions
- [ ] Test manual data entry

**Day 3-4: AppSheet Apps**

- [ ] Create AppSheet account (if needed)
- [ ] Connect to Operations Database
- [ ] Build "HOA Work Orders" app
  - [ ] Submit form
  - [ ] My orders view
  - [ ] Board review view
- [ ] Build "HOA Architectural Reviews" app
  - [ ] Submit form
  - [ ] My requests view
  - [ ] Committee review view
- [ ] Test on mobile and web
- [ ] Configure user permissions

**Day 5: Testing & Refinement**

- [ ] Create test work order (mobile)
- [ ] Create test ARC request (web)
- [ ] Verify data appears correctly in Sheets
- [ ] Test board member views
- [ ] Adjust UI/permissions as needed

### Phase 2: Scraper Updates (Week 2)

**Day 1-2: Scraper Rewrite**

- [ ] Update `keystone_scraper_selenium.py`
  - [ ] Remove homeowner directory scraping
  - [ ] Add Accounts Receivable scraping
  - [ ] Update violations scraping for new schema
  - [ ] Update sheet writing functions
- [ ] Test scraper (dry run)
- [ ] Verify data format in Operations Database

**Day 3: Automation**

- [ ] Set up cron job (nightly 3 AM)
- [ ] Add logging
- [ ] Test automated run
- [ ] Set up email alerts for failures

**Day 4-5: Initial Data Population**

- [ ] Run scraper to populate account numbers
- [ ] Run scraper to populate violations
- [ ] Verify all addresses match
- [ ] Fix any address standardization issues

### Phase 3: PropertyReport Integration (Week 3)

**Day 1-3: Code Updates**

- [ ] Update HOALibrary (if needed)
  - [ ] Add helper functions for new data structure
  - [ ] Test address matching with new format
- [ ] Update PropertyReport
  - [ ] Update CONFIG with new spreadsheet ID
  - [ ] Rewrite data retrieval functions
  - [ ] Update report generation
  - [ ] Test with sample addresses

**Day 4: Testing**

- [ ] Test PropertyReport with multiple addresses
  - [ ] Address with all data types
  - [ ] Address with no violations/work orders
  - [ ] Address with only some data
- [ ] Verify PDF formatting
- [ ] Test email delivery

**Day 5: Deployment**

- [ ] Deploy updated HOALibrary (if changed)
- [ ] Deploy updated PropertyReport
- [ ] Test form submission → PropertyReport flow
- [ ] Document changes

### Phase 4: Website Integration (Week 4 - Optional)

**Option A: Link to AppSheet**
- [ ] Add links on website to AppSheet apps
- [ ] Test user flow
- [ ] Update documentation

**Option B: Embed AppSheet**
- [ ] Embed AppSheet forms in website
- [ ] Style to match website
- [ ] Test on desktop/mobile

**Option C: Custom Forms (Future)**
- [ ] Build custom forms on website
- [ ] Write to same Sheets backend
- [ ] Keep AppSheet as mobile option

### Phase 5: Rollout & Training (Week 4)

**Documentation:**
- [ ] Write user guide for homeowners
  - [ ] How to submit work order
  - [ ] How to submit ARC request
  - [ ] How to check status
- [ ] Write guide for board members
  - [ ] How to review submissions
  - [ ] How to update status
  - [ ] How to use data in PropertyReport

**Training:**
- [ ] Demo for board members
- [ ] Test with friendly homeowners
- [ ] Announce to HOA
- [ ] Provide support for first submissions

---

## Migration from Current State

### Work Orders

**Current:** Google Forms → messy responses
**Migration:**
1. Export existing form responses
2. Clean up and reformat
3. Import into WorkOrders tab (set Source="Manual")
4. Retire old form
5. Update website links to AppSheet

### ARC Requests

**Current:** Email or manual process?
**Migration:**
1. Document any pending requests
2. Enter into ArchReviews tab
3. Roll out AppSheet app
4. Update process documentation

### Violations

**Current:** Planning to scrape from Keystone
**Migration:**
1. Run new scraper to populate Violations tab
2. Verify data
3. Keystone remains master for violations

### Account Numbers

**Current:** Not tracked
**Migration:**
1. Run scraper to get all account numbers
2. Verify addresses match
3. Fix any mismatches

---

## Success Criteria

### Functional Requirements

- [ ] Homeowners can submit work orders via mobile
- [ ] Homeowners can submit ARC requests via desktop
- [ ] Board can review and update status
- [ ] Data appears correctly in Sheets
- [ ] PropertyReport includes all data types
- [ ] Scraper runs nightly without errors
- [ ] All addresses standardize correctly

### User Experience

- [ ] Forms are mobile-friendly
- [ ] Submission takes < 2 minutes
- [ ] Status updates are visible
- [ ] Board can process requests efficiently
- [ ] Data is easy to verify/edit manually

### Data Quality

- [ ] No duplicate entries
- [ ] All required fields populated
- [ ] Addresses standardized consistently
- [ ] Photos upload successfully
- [ ] Historical data preserved

### Performance

- [ ] Form submission < 5 seconds
- [ ] PropertyReport generates in < 30 seconds
- [ ] Sheet queries responsive (< 2 seconds)
- [ ] Scraper completes in < 5 minutes

---

## Risks & Mitigation

### Risk 1: AppSheet Learning Curve

**Risk:** Board members may struggle with new interface
**Mitigation:**
- Provide training session
- Create video tutorials
- Start with board testing before homeowner rollout
- Offer 1-on-1 support

### Risk 2: Data Migration Issues

**Risk:** Existing data may not fit new structure
**Mitigation:**
- Start fresh (clean slate)
- Manually enter critical historical data
- Keep old spreadsheets as reference

### Risk 3: Scraper Failures

**Risk:** Keystone portal changes could break scraper
**Mitigation:**
- Email alerts for scraper failures
- Manual backup process (can enter data directly)
- Not mission-critical (only for account numbers + violations)

### Risk 4: Address Matching Problems

**Risk:** Addresses from different sources may not match
**Mitigation:**
- Comprehensive testing during Phase 2
- Manual correction tools
- Address validation in AppSheet forms

### Risk 5: AppSheet Costs

**Risk:** May exceed free tier limits
**Mitigation:**
- Monitor usage
- Free tier is generous (10 users, unlimited apps)
- Paid tier is cheap ($5/user/month if needed)

---

## Future Enhancements (Not in Scope)

### Phase 6: Advanced Features (3-6 months out)

- **Board Dashboard App**
  - Overview of all operations
  - Metrics and charts
  - Quick actions

- **Contractor Portal**
  - View assigned work orders
  - Update status
  - Upload completion photos

- **Homeowner Portal**
  - View property history
  - All past work orders/ARC requests
  - Account balance (if integrated with financials)

- **Automated Workflows**
  - Email notifications on status changes
  - Reminders for pending reviews
  - Escalation for overdue items

- **Analytics & Reporting**
  - Work order trends
  - Response time metrics
  - Budget vs actual costs

### Migration to Firestore (If Needed)

**When:** If Sheets performance becomes an issue (unlikely with current volume)

**How:**
- Export Sheets to Firestore
- Update PropertyReport to query Firestore
- AppSheet can connect to Firestore via API
- Keep Sheets as backup/export

---

## Cost Analysis

### Current Costs

- Google Workspace: Already paid for
- Google Forms: Free
- Manual data entry: Board time (unpaid)

### New Costs

**Year 1:**
- AppSheet: Free tier (sufficient for 10-20 users)
- Spreadsheet: Free (included in Google Workspace)
- Scraper: Free (runs on existing infrastructure)
- **Total: $0**

**Year 2+ (if exceed free tier):**
- AppSheet: $5/user/month (only if >10 users)
- Estimated 15 users = $75/month = $900/year
- **Total: $0-900/year** (likely stay free)

**ROI:**
- Time savings: ~5 hours/month (board + manager)
- Better data quality: Fewer errors, faster reports
- Better homeowner experience: Professional forms

---

## Dependencies

### Technical Dependencies

- [ ] Google Workspace account (active)
- [ ] HOA Board Documents shared drive (exists)
- [ ] Service account credentials (have)
- [ ] Keystone portal access (have)
- [ ] oregano server for scraper (have)

### Access/Permissions

- [ ] admin@villasboulders.org account access
- [ ] Ability to create AppSheet apps
- [ ] Ability to create/share spreadsheets
- [ ] Ability to set up cron jobs on oregano

### Knowledge/Skills

- [ ] Google Sheets familiarity (have)
- [ ] AppSheet basics (will learn)
- [ ] Apps Script coding (have)
- [ ] Python/Selenium (have)

---

## Questions for Review

**Please review and provide feedback on:**

1. **Data Structure:**
   - Are the column names clear?
   - Are any fields missing?
   - Any fields we don't need?

2. **AppSheet Apps:**
   - Do the proposed views make sense?
   - Any additional features needed?
   - Permissions structure correct?

3. **Scraper:**
   - Agree to scrape only account numbers + violations?
   - Nightly schedule acceptable?
   - Any other Keystone data worth scraping?

4. **Implementation Plan:**
   - Timeline reasonable (4 weeks)?
   - Phase order make sense?
   - Any phases we should skip/add?

5. **Migration:**
   - Comfortable starting fresh (not migrating old messy data)?
   - Any historical data we MUST preserve?

6. **Future:**
   - Website integration: Link vs Embed vs Custom?
   - Interest in Phase 6 enhancements?

---

## Approval

**Prepared by:** Claude (AI Assistant)
**Reviewed by:** _____________________ Date: _____
**Approved by:** _____________________ Date: _____

**Status:** [ ] Approved as-is [ ] Approved with changes [ ] Rejected

**Changes requested:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## Appendix A: Glossary

- **AppSheet:** Google's no-code app builder platform
- **ARC:** Architectural Review Committee
- **HOA:** Homeowners Association
- **Keystone:** Property management portal (kppm.cincwebaxis.com)
- **PropertyReport:** Apps Script tool that generates property reports
- **Standardized Address:** HOA format (e.g., "13738RP1")
- **Display Address:** Human-readable (e.g., "13738 Rock Point Unit 101")

## Appendix B: Reference Links

- AppSheet Documentation: https://help.appsheet.com/
- Google Sheets API: https://developers.google.com/sheets
- Apps Script Reference: https://developers.google.com/apps-script
- Keystone Portal: https://kppm.cincwebaxis.com

## Appendix C: Contact Information

- **Technical Support:** Claude (via chat)
- **HOA Admin:** admin@villasboulders.org
- **HOA Manager:** manager@villasboulders.org

---

**END OF SPECIFICATION**
