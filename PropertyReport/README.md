# Property Report Processor

**Automated property report generation system for Villas at the Boulders HOA**

**Version:** 18.1 (with bug fixes)
**Status:** Ready for Production Deployment
**Type:** Google Apps Script (Standalone)
**Last Updated:** February 15, 2026

---

## What It Does

Generates comprehensive PDF property reports when homeowners submit a Google Form request. Reports include:
- Gutter maintenance data with photos
- Wood trim assessment data
- Future: Keystone HOA system data (planned)

**Workflow:**
1. Homeowner submits Google Form with their address
2. Script validates they're in owner groups
3. Retrieves building-specific data from spreadsheets
4. Finds photos in Google Drive organized by address
5. Generates PDF report with all data
6. Emails PDF to homeowner

---

## Prerequisites

### 1. Google Services Access
- **Admin Directory API** - Check group membership
- **People API** - Look up homeowner info
- **Service Account** with domain-wide delegation configured
- **HOA Library** (v4+) deployed as Apps Script library

### 2. Google Form Setup
**Form ID:** `1mMuV-hdcE8bVN75m8y5OxlMjMRsITslnbYSF1AMN-y0`

**Required Form Fields:**
- Property Address (text)
- Email Address (email)
- Request Type (multiple choice)

### 3. Data Sources

**Gutters Spreadsheet:**
- ID: `10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A`
- Contains: Gutter maintenance history by address

**Wood Trim Spreadsheet:**
- ID: `1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE`
- Contains: Wood trim assessment data by address

**Keystone Cache Spreadsheet:**
- ID: `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`
- Contains: HOA member data (planned integration)

### 4. Google Drive Folders
**Gutter Pictures Folder:**
- Located in: `HOA Board Documents/Gutters/Gutter Pictures/`
- Organization: Subfolders by address (e.g., "13737RP2" or "13737RP")

---

## Installation

### Step 1: Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. New Project → Name it "Property Report Processor (Standalone)"
3. Copy contents of `Code.gs` into the script editor

### Step 2: Add HOA Library Dependency
1. In Apps Script editor: Libraries (left sidebar)
2. Add library by Script ID: `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
3. Identifier: `HOALibrary`
4. Version: Select latest version (v4 or higher)
5. **Important:** Use published version, NOT development mode

### Step 3: Enable Advanced Services
1. Services (left sidebar, + icon)
2. Enable: Admin Directory API
3. Enable: People API

### Step 4: Configure the Form Trigger
1. In Apps Script editor: Triggers (left sidebar, clock icon)
2. Add Trigger:
   - Function: `onFormSubmit`
   - Event source: From form
   - Event type: On form submit
   - Select your form: Property Report Request Form
3. Authorize the script when prompted

### Step 5: Configure Settings
**Before deploying to production:**
1. Open `Code.gs`
2. Find the `CONFIG` object (near line 15)
3. Set `debugMode: false` (currently true)
4. Verify all spreadsheet IDs match your data sources
5. Save

---

## Configuration

See [CONFIGURATION.md](CONFIGURATION.md) for detailed explanation of all CONFIG settings.

**Key Settings:**
- `debugMode` - When true, emails go to admin only (for testing)
- `formId` - The Google Form that triggers this script
- `adminEmail` - admin@villasboulders.org
- `managerEmail` - manager@villasboulders.org
- `guttersSheetId` - Gutters spreadsheet
- `woodTrimSheetId` - Wood trim spreadsheet
- `keystoneCacheSheetId` - Keystone cache spreadsheet
- `ownersGroup` - owners@villasboulders.org

---

## Testing

### Test with Debug Mode ON
1. Ensure `debugMode: true` in CONFIG
2. Submit test form with a known address (e.g., "13737 Rock Point Unit 102")
3. Check admin email for PDF report
4. Verify:
   - PDF generated successfully
   - Gutter data appears if available
   - Wood trim data appears if available
   - Photos attached if folder exists
   - No errors in execution logs

### Test Matrix

| Test Case | Address | Expected Result |
|-----------|---------|----------------|
| Known address + gutter data | 13737 Rock Point #102 | PDF with gutter section |
| Known address + wood trim | 13737 Rock Point #102 | PDF with wood trim section |
| Known address + both | 13737 Rock Point #102 | PDF with all sections |
| Unknown address | 99999 Fake Street | Email with "no data found" message |
| Malformed address | "test" | Validation error or graceful handling |
| Non-owner email | test@example.com | Rejected (not in owner groups) |

### Checking Logs
1. Apps Script editor → Executions (left sidebar)
2. Review latest execution
3. Check for errors or warnings
4. Console logs show detailed processing steps

---

## Deployment to Production

### Pre-Deployment Checklist
- [ ] All bugs fixed (see CHANGELOG v18.1)
- [ ] HOA Library using published version v4+ (not development)
- [ ] `debugMode: false` in CONFIG
- [ ] Tested with real form submissions
- [ ] All spreadsheet IDs verified
- [ ] Form trigger configured and authorized
- [ ] Execution logs reviewed (no errors)

### Deployment Steps
1. **Backup Current Version:**
   - File → Make a copy
   - Name: "Property Report Processor (Backup - DATE)"

2. **Update Code:**
   - Paste fixed Code.gs into editor
   - Save (Ctrl+S)

3. **Verify Library:**
   - Libraries → HOALibrary → Check version is v4+, not development mode

4. **Deploy:**
   - No separate deployment needed (standalone script runs on trigger)

5. **Test in Production:**
   - Submit real form with your own address
   - Verify email arrives to correct recipient
   - Check PDF content is accurate

6. **Monitor:**
   - Check execution logs daily for first week
   - Review any error emails
   - Adjust as needed

### Rollback Plan
If critical errors occur:
1. Open backup version created in step 1
2. File → Make a copy
3. Rename to "Property Report Processor (Standalone)"
4. Delete broken version
5. Reconfigure trigger on backup version
6. Document what went wrong in KNOWN_ISSUES.md

---

## Common Issues & Troubleshooting

### "Address not found" in Reports
**Cause:** Address standardization mismatch or photos not in expected folder structure

**Solution:**
1. Check address format in form submission
2. Verify folder exists in Gutter Pictures
3. Try both unit-specific and building-wide folder names
4. Review HOALibrary/ADDRESS_SPEC.md for correct format

### Reports Going to Admin Instead of Requesters
**Cause:** `debugMode: true` in CONFIG

**Solution:**
1. Set `debugMode: false`
2. Save script
3. Test with real form submission

### "Missing required fields" Error
**Cause:** Form submission missing address or email

**Solution:**
1. Check form configuration
2. Ensure address and email fields are required
3. Verify field titles match what script expects

### No Photos in Report
**Cause:** Gutter Pictures folder structure doesn't match expected format

**Solution:**
1. Check folder path: `HOA Board Documents/Gutters/Gutter Pictures/[address]/`
2. Verify address folder naming (e.g., "13737RP2" or "13737RP")
3. Ensure photos are in correct subfolder
4. Check service account has access to shared drive

### Library Not Found Error
**Cause:** HOA Library not added as dependency or wrong version

**Solution:**
1. Libraries → Add library
2. Script ID: `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
3. Select version 4 or higher
4. Identifier must be: `HOALibrary`

### Permission Denied Errors
**Cause:** Service account not configured or APIs not enabled

**Solution:**
1. Verify Admin Directory API enabled
2. Verify People API enabled
3. Check domain-wide delegation configured
4. Ensure service account has required OAuth scopes

---

## How It Works (Technical Overview)

### Main Flow
```
onFormSubmit(e)
  ↓
Extract address from form submission
  ↓
Validate homeowner (check group membership)
  ↓
Standardize address using HOALibrary
  ↓
Gather data from multiple sources:
  - getGutterFolderImages()
  - getGutterData()
  - getWoodTrimData()
  - getKeystoneData() [not yet implemented]
  ↓
Generate PDF report
  ↓
Send email to requester (or admin if debugMode)
```

### Key Functions

**onFormSubmit(e)** - Main entry point, triggered by form submission
**gatherReportData(address, email)** - Aggregates all data sources
**generatePdfReport(data)** - Creates PDF document
**sendReportEmail(recipient, pdfBlob, data)** - Sends email with attachment
**getGutterFolderImages(address)** - Finds and retrieves photos from Drive
**getGutterData(address)** - Retrieves gutter data from spreadsheet
**getWoodTrimData(address)** - Retrieves wood trim data from spreadsheet
**findFolderOrShortcut(name, parent)** - Handles Drive folders and shortcuts
**validateFormSubmission(itemResponses)** - Ensures required fields present

### Data Standardization
All addresses are standardized using HOALibrary to ensure consistent matching:
- Input: "13737 Rock Point Unit 102"
- Standardized: "13737RP2"
- Building-only: "13737RP"

See HOALibrary/ADDRESS_SPEC.md for full details.

---

## File Structure

```
PropertyReport/
├── Code.gs                 (1,296 lines - main script)
├── appsscript.json         (project manifest)
├── README.md               (this file)
├── CHANGELOG.md            (version history)
├── CONFIGURATION.md        (CONFIG settings explained)
└── KNOWN_ISSUES.md         (current limitations)
```

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

**Current:** v18.1 (Feb 15, 2026)
- Fixed undefined address variable bug
- Changed debugMode default to false
- Updated library to use published v4+
- Added input validation

**Previous:** v18 (Feb 14, 2026)
- Original release with known bugs

---

## Known Issues & Limitations

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for complete list.

**Major Limitations:**
- Keystone integration not yet implemented
- HEIF image conversion may fail on some iPhone photos
- No retry logic for API failures
- Large monolithic code file (refactoring planned)

---

## Future Enhancements

**Near-term (next 2 weeks):**
- Complete Keystone data integration
- Add retry logic for transient failures
- Improve error messages to users

**Long-term (next quarter):**
- Refactor to modular library structure (code exists in library_project/)
- Add automated testing
- Create deployment automation
- Implement caching for frequently accessed data

---

## Support & Contact

**Developer:** Dee Buck (mcdonaldbuck@gmail.com)
**HOA Admin:** admin@villasboulders.org
**Manager:** manager@villasboulders.org

**For Issues:**
1. Check this README troubleshooting section
2. Review KNOWN_ISSUES.md
3. Check execution logs in Apps Script editor
4. Contact developer if stuck

---

**Created:** February 13, 2026
**Last Updated:** February 15, 2026
**Next Review:** After production deployment
