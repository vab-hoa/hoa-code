# Property Report Processor - Configuration Guide

Complete reference for all configuration settings in the Property Report Processor.

**Location:** `Code.gs` - CONFIG object (approximately line 15)

---

## CONFIG Object Reference

### debugMode

```javascript
debugMode: true  // or false
```

**Purpose:** Controls where report emails are sent

**Values:**
- `true` - Emails sent to `adminEmail` only (for testing)
- `false` - Emails sent to actual form submitter (production)

**When to Use:**
- **Development/Testing:** Set to `true`
  - All reports go to admin for review
  - Safe to test without bothering homeowners
  - Can verify report content before going live

- **Production:** Set to `false`
  - Reports sent to actual requesters
  - Normal operation mode

**⚠️ IMPORTANT:** Always verify this is `false` before production deployment!

**Example Testing Flow:**
1. Set `debugMode: true`
2. Submit test form with any address
3. Check admin email for report
4. Verify report looks correct
5. Set `debugMode: false` for production
6. Submit real test to verify it goes to requester

---

### formId

```javascript
formId: '1mMuV-hdcE8bVN75m8y5OxlMjMRsITslnbYSF1AMN-y0'
```

**Purpose:** ID of the Google Form that triggers this script

**How to Find:**
1. Open your Google Form
2. Look at URL: `https://docs.google.com/forms/d/FORM_ID_HERE/edit`
3. Copy the ID between `/d/` and `/edit`

**When to Change:**
- If you create a new form
- If you want to switch to a different trigger form

**Notes:**
- Form must have trigger configured (see README.md Installation)
- Form should have required fields: Address, Email

---

### adminEmail

```javascript
adminEmail: 'admin@villasboulders.org'
```

**Purpose:** Email address for admin notifications and debug mode

**Used For:**
- Receiving reports when `debugMode: true`
- Error notifications
- System alerts

**When to Change:**
- If admin email address changes
- If you want a different person to receive admin emails

---

### managerEmail

```javascript
managerEmail: 'manager@villasboulders.org'
```

**Purpose:** Email address for HOA manager

**Currently Used For:**
- Future notifications (not yet implemented)
- Documentation reference

**Notes:**
- Not actively used in current version
- Reserved for future manager-specific features

---

### guttersSheetId

```javascript
guttersSheetId: '10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A'
```

**Purpose:** Google Spreadsheet containing gutter maintenance data

**How to Find:**
1. Open the Gutters spreadsheet
2. Look at URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. Copy the ID between `/d/` and `/edit`

**Expected Structure:**
- Column A: Address (standardized format preferred)
- Additional columns: Gutter data (dates, notes, status, etc.)
- Photos referenced via Drive folder structure

**When to Change:**
- If you move gutter data to a new spreadsheet
- If spreadsheet is accidentally deleted and needs restoration

**⚠️ IMPORTANT:** Service account must have read access to this spreadsheet!

---

### woodTrimSheetId

```javascript
woodTrimSheetId: '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE'
```

**Purpose:** Google Spreadsheet containing wood trim assessment data

**How to Find:**
1. Open the Wood Trim spreadsheet
2. Look at URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. Copy the ID

**Expected Structure:**
- Column A: Address (standardized format preferred)
- Additional columns: Wood trim data (assessment dates, findings, photos, etc.)

**When to Change:**
- If you move wood trim data to a new spreadsheet

**⚠️ IMPORTANT:** Service account must have read access to this spreadsheet!

---

### keystoneCacheSheetId

```javascript
keystoneCacheSheetId: '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'
```

**Purpose:** Google Spreadsheet containing cached Keystone Property Management data

**How to Find:**
1. Open the Keystone cache spreadsheet
2. Look at URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. Copy the ID

**Expected Structure:**
The spreadsheet should contain 4 sheets:
- **Profiles** - Columns: Name, Address, Phone, Email, Account Number
- **Violations** - Columns: Address, Date, Description, Status
- **WorkOrders** - Columns: Address, Date, Description, Status, Type
- **ArchReviews** - Columns: Address, Date, Description, Status

**Data Source:**
- Updated by Python scraper: `~/hoa-code/keystone-scraper/keystone_scraper.py`
- Runs daily via cron job (2 AM)
- Scrapes live data from Keystone Pacific portal

**When to Change:**
- If you create a new cache spreadsheet
- If cache location is moved

**Rollback:**
If Keystone integration causes issues, you can disable it by:
1. Setting this to `null` in CONFIG, or
2. Commenting out Keystone section in `generatePdfReport()`, or
3. Disabling the Python scraper cron job

**⚠️ IMPORTANT:**
- Service account must have write access (Python scraper writes to it)
- Service account must have read access (Apps Script reads from it)
- See `~/hoa-code/keystone-scraper/README.md` for scraper setup
- If spreadsheet structure is reorganized

**⚠️ IMPORTANT:** Service account must have read access to this spreadsheet!

---

### ownersGroup

```javascript
ownersGroup: 'owners@villasboulders.org'
```

**Purpose:** Primary Google Group email for all HOA owners

**Used For:**
- Validating that form submitter is an actual owner
- Preventing non-owners from requesting reports
- Group membership check via Admin Directory API

**Related Groups Checked:**
The script checks membership in three groups:
1. `owners@villasboulders.org` - All owners
2. `owneroccupant@villasboulders.org` - Owner-occupants
3. `nonoccupantowner@villasboulders.org` - Non-occupant owners

**When to Change:**
- If primary owners group email changes
- If group structure is reorganized

**⚠️ IMPORTANT:** Service account needs Admin Directory API access to check group membership!

---

## Google Drive Folder Paths

These are not in CONFIG but are important configuration values:

### Gutter Pictures Folder Path

**Expected Path:**
```
HOA Board Documents/
  └── Gutters/
      └── Gutter Pictures/
          ├── [Address Folder 1]/
          ├── [Address Folder 2]/
          └── ...
```

**How the Script Finds It:**
1. Search for "Gutter Pictures" folder (direct search)
2. If not found, look in "HOA Board Documents/Gutters/"
3. Handles both actual folders and Drive shortcuts

**Address Folder Naming:**
- Unit-specific: "13737RP2" (preferred) or "13737 Rock Point #102"
- Building-wide: "13737RP" or "13737 Rock Point"

**Notes:**
- Script tries multiple search methods
- Logs detailed path traversal for debugging
- If folder not found, photos section omitted from report

---

## HOALibrary Dependency

**Library Script ID:**
```
1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF
```

**Identifier:** `HOALibrary`

**Required Version:** 4 or higher

**⚠️ CRITICAL:** Must use published version, NOT development mode!

**How to Check:**
1. Apps Script editor → Libraries (left sidebar)
2. Find HOALibrary
3. Version should show a number (4, 5, 6, etc.)
4. If it says "development mode" or "0", switch to latest published version

**Functions Used from Library:**
- `HOALibrary.standardizeHOAAddress(address)` - Converts to compact format
- `HOALibrary.getBuildingAddress(address)` - Extracts building portion
- `HOALibrary.getUnitFromAddress(address)` - Extracts unit number

---

## Advanced Services Required

Must be enabled in Apps Script editor:

### 1. Admin Directory API
**Identifier:** `directory_v1`
**Used For:** Checking group membership, validating owners

### 2. People API
**Identifier:** `v1`
**Used For:** Looking up homeowner contact information

**How to Enable:**
1. Apps Script editor → Services (left sidebar, + icon)
2. Find service name
3. Add

---

## Environment Variables / External Dependencies

### Service Account Credentials

**Not in CONFIG** but critical for local development:

**Location (on oregano):** `~/.config/openclaw/google-service-account.json`

**Required Permissions:**
- Read access to all spreadsheets
- Read access to Gutter Pictures Drive folder
- Domain-wide delegation for group membership checks
- Admin Directory API scope
- People API scope

See `~/openclaw.jane/workspace/docs/google-workspace-service-account-setup.md` for setup.

---

## Testing Configuration

### Minimal Test Configuration

For testing with minimal setup:

```javascript
const CONFIG = {
  formId: 'YOUR_TEST_FORM_ID',
  debugMode: true,              // ← Send all emails to admin
  adminEmail: 'your@email.com', // ← Your email for testing
  managerEmail: 'manager@example.com',

  // Use real IDs or test spreadsheets:
  guttersSheetId: '10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A',
  woodTrimSheetId: '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE',
  keystoneCacheSheetId: 'TEST_SHEET_ID_OR_EMPTY',

  ownersGroup: 'owners@villasboulders.org'
};
```

---

## Production Configuration Checklist

Before deploying to production:

- [ ] `debugMode: false` ← **CRITICAL**
- [ ] `formId` points to real production form
- [ ] `adminEmail` is correct admin address
- [ ] `guttersSheetId` is production Gutters spreadsheet
- [ ] `woodTrimSheetId` is production Wood Trim spreadsheet
- [ ] `ownersGroup` is correct production group
- [ ] HOALibrary using published version (not dev mode)
- [ ] Advanced Services enabled (Admin Directory, People)
- [ ] Form trigger configured and authorized
- [ ] Service account has access to all resources

---

## Troubleshooting Configuration Issues

### Reports Not Sending to Requesters
**Check:** `debugMode` setting
**Fix:** Set to `false`

### "Spreadsheet not found" Errors
**Check:** Sheet IDs in CONFIG
**Fix:** Verify IDs are correct, service account has access

### "Not authorized" Group Membership Errors
**Check:** Admin Directory API enabled, domain-wide delegation configured
**Fix:** Enable API, configure service account scopes

### Photos Not Appearing in Reports
**Check:** Gutter Pictures folder structure
**Fix:** Verify folder path and naming match expected format

### Library Not Found Errors
**Check:** HOALibrary dependency version
**Fix:** Switch from development mode to published version

---

**Last Updated:** February 15, 2026
**Related Documentation:** README.md, KNOWN_ISSUES.md, HOALibrary/ADDRESS_SPEC.md
