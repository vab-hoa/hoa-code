# HOA Automation System Architecture

**System overview and technical architecture for Villas at the Boulders HOA automation**

**Version:** 1.0
**Last Updated:** February 15, 2026
**Status:** Production

---

## System Overview

The HOA automation system consists of four independent projects that work together to manage homeowner data, communications, and property information.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Villas at the Boulders HOA                       │
│                      Automation Ecosystem                            │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  PropertyReport  │    │   LabelsToGroups │    │ exif-to-parcel   │
│  (Apps Script)   │    │   (Apps Script)  │    │    (Python)      │
│                  │    │                  │    │                  │
│  Generates PDFs  │    │  Syncs Contacts  │    │ Photo Organizer  │
│  from form data  │    │  to Groups       │    │ GPS → Address    │
└──────────────────┘    └──────────────────┘    └──────────────────┘
        ▲                       ▲                        ▲
        │                       │                        │
        └───────────┬───────────┴────────────────────────┘
                    │
            ┌───────▼────────┐              ┌──────────────────┐
            │   HOALibrary   │              │ Keystone Scraper │
            │ (Apps Script)  │              │    (Python)      │
            │                │              │                  │
            │ Shared Utils   │◄─────────────│ Portal → Sheets  │
            │ Address Std    │   (reads)    │   Daily Cron     │
            │ Keystone API   │              └──────────────────┘
            └────────────────┘
```

---

## Data Flow

### Property Report System

```
Homeowner
    │
    ▼
Google Form Submission
    │
    ▼
PropertyReport Script (Apps Script)
    │
    ├──► Validate homeowner (Admin Directory API)
    │
    ├──► Standardize address (HOALibrary)
    │
    ├──► Retrieve data:
    │    ├─► Gutter Spreadsheet
    │    ├─► Wood Trim Spreadsheet
    │    ├─► Photos from Drive (Gutter Pictures folder)
    │    └─► Keystone Cache (via HOALibrary)
    │
    ├──► Generate PDF Report
    │
    └──► Email PDF (Gmail API)
         │
         ▼
    Homeowner Receives Report
```

### Contact-to-Group Sync

```
Google Contacts (admin@villasboulders.org)
    │
    │ Labels Applied:
    │ - Boulder Circle
    │ - owner-occupant
    │ - volunteers
    │ - etc.
    │
    ▼
LabelsToGroups Script (triggered daily)
    │
    ├──► For each label in SYNC_LIST:
    │    │
    │    ├─► Create Google Group if doesn't exist
    │    ├─► Configure group settings
    │    ├─► Add admin as owner
    │    └─► Sync members from label
    │
    ▼
Google Groups
    │ - bouldercircle@villasboulders.org
    │ - owneroccupant@villasboulders.org
    │ - volunteers@villasboulders.org
    │ - etc. (14 groups total)
    │
    ▼
Email Distribution Lists (ready to use)
```

### Photo Organization

```
Contractor Photos (GPS-tagged)
    │
    ▼
exif-to-parcel Script (Python)
    │
    ├──► Phase 1: GPS Direct Matching
    │    │
    │    ├─► Extract GPS from EXIF
    │    ├─► Load parcel boundaries (GeoJSON)
    │    └─► Point-in-polygon match
    │         │
    │         ├─► Match Found (58%)
    │         └─► No Match → Phase 2
    │
    ├──► Phase 2: Neighbor Inference
    │    │
    │    ├─► Parse sequence numbers from filenames
    │    ├─► Identify neighbor photos (±10)
    │    ├─► Find sandwich patterns
    │    └─► Infer address (32%)
    │
    ▼
Organized Photos by Address
    │
    ├─► 13737RP2/ (photos for this address)
    ├─► 13704SC1/ (photos for this address)
    ├─► REVIEW/ (couldn't match - 5%)
    └─► NO_GPS/ (no GPS data - 5%)
    │
    ▼
Upload to Google Drive/Gutter Pictures/
```

---

## Technology Stack

### Apps Script Projects

**Runtime:** V8 JavaScript Engine
**Platform:** Google Apps Script (cloud-hosted)
**Authentication:** Service Account with Domain-Wide Delegation

**PropertyReport:**
- Language: JavaScript (Apps Script)
- Size: 1,296 lines (monolithic)
- Dependencies: HOALibrary (v4+)
- APIs: Admin Directory, People, Drive, Gmail

**HOALibrary:**
- Language: JavaScript (Apps Script)
- Size: 614 lines (7 modules)
- Type: Shared Library
- APIs: Admin Directory, People

**LabelsToGroups:**
- Language: JavaScript (Apps Script)
- Size: 77 lines
- APIs: Admin Directory, Groups Settings, People

### Python Project

**exif-to-parcel:**
- Language: Python 3.10+
- Dependencies: Pillow, Shapely
- Runtime: Local (oregano server)
- Environment: Virtual environment (venv/)

### Infrastructure

**Storage:**
- Google Drive (Shared Drives)
- Google Spreadsheets (data sources)
- Local file system (oregano)

**Authentication:**
- Service Account: openclaw-automation@villasboulders-automation.iam.gserviceaccount.com
- Client ID: 115753241775007656597
- Credentials: `~/.config/openclaw/google-service-account.json`

**APIs Used:**
- Gmail API (send reports)
- Google Drive API (file access)
- Admin SDK API (groups, users)
- People API (contacts)
- Calendar API (future)
- Groups Settings API (group config)

---

## Dependencies

### Inter-Project Dependencies

```
PropertyReport
    └─► depends on: HOALibrary (v4+)

HOALibrary
    └─► standalone (no dependencies)

LabelsToGroups
    └─► standalone (no dependencies)

exif-to-parcel
    └─► standalone (no dependencies)
```

### External Dependencies

**PropertyReport:**
- HOALibrary (Apps Script Library)
- Gutters Spreadsheet (ID: 10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A)
- Wood Trim Spreadsheet (ID: 1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE)
- Keystone Cache Spreadsheet (ID: 1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ)
- Gutter Pictures Drive folder
- Google Form (ID: 1mMuV-hdcE8bVN75m8y5OxlMjMRsITslnbYSF1AMN-y0)

**HOALibrary:**
- Keystone Cache Spreadsheet (ID: 1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ)

**Keystone Scraper:**
- Playwright (Python package)
- Google Sheets API
- Service account credentials (~/.config/openclaw/google-service-account.json)

**LabelsToGroups:**
- Google Contacts (admin@villasboulders.org account)
- SYNC_LIST configuration (hardcoded in Code.gs)

**exif-to-parcel:**
- Pillow >= 10.0.0 (Python package)
- Shapely >= 2.0.0 (Python package)
- Parcels GeoJSON file (county GIS data)
- Photo source directory

---

## Data Sources

### Google Spreadsheets

**Gutters Maintenance:**
- ID: `10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A`
- Owner: admin@villasboulders.org
- Structure: Address | Data columns...
- Used by: PropertyReport

**Wood Trim Assessment:**
- ID: `1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE`
- Owner: admin@villasboulders.org
- Structure: Address | Assessment data...
- Used by: PropertyReport

**Keystone Cache:**
- ID: `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`
- Owner: admin@villasboulders.org
- Structure: 4 sheets (Profiles, Violations, WorkOrders, ArchReviews)
- Updated by: Keystone Scraper (Python, daily cron)
- Used by: HOALibrary (Keystone functions), PropertyReport

### Google Drive Folders

**Gutter Pictures:**
- Path: `HOA Board Documents/Gutters/Gutter Pictures/`
- Structure: `[Address]/[Photos]`
- Used by: PropertyReport, exif-to-parcel

**Code (This Repository):**
- Path: `HOA Board Documents/Code/`
- Structure: `[ProjectName]/[Files]`
- Purpose: Source of truth for all code

### Google Contacts

**admin@villasboulders.org Contacts:**
- All homeowner contacts
- Labels for organization (street, role, status)
- Used by: LabelsToGroups

### Google Groups

**Created/Managed by LabelsToGroups:**
- 14 groups for streets and roles
- Domain: @villasboulders.org
- Used by: PropertyReport (for validation)

---

## Authentication & Authorization

### Service Account

**Email:** openclaw-automation@villasboulders-automation.iam.gserviceaccount.com
**Project:** villasboulders-automation
**Credentials:** JSON key file

**Domain-Wide Delegation:**
- Enabled: Yes
- Impersonates: admin@villasboulders.org
- Scopes:
  ```
  https://www.googleapis.com/auth/drive
  https://www.googleapis.com/auth/gmail.send
  https://www.googleapis.com/auth/gmail.readonly
  https://www.googleapis.com/auth/calendar
  https://www.googleapis.com/auth/admin.directory.group
  https://www.googleapis.com/auth/admin.directory.user.readonly
  https://www.googleapis.com/auth/groups
  ```

### Security Model

**Principle:** Service account acts as admin, scripts enforce HOA policies

**Access Control:**
- PropertyReport: Only owners can request reports (group membership check)
- LabelsToGroups: Only admin can manage groups
- exif-to-parcel: Local script, no external access needed

**Data Protection:**
- Service account key: 600 permissions (~/.config/openclaw/)
- Never committed to version control
- Credentials treated as sensitive

---

## Deployment Model

### Apps Script Projects

**Hosting:** Google Apps Script (cloud)
**Deployment:** No separate deployment step (standalone scripts)
**Triggers:**
- PropertyReport: Form submission (installable trigger)
- LabelsToGroups: Time-driven (daily, optional)

**Updates:**
1. Edit code in Apps Script editor
2. Save
3. Changes take effect immediately

### Python Projects

**Hosting:** Local server (oregano)
**Deployment:** Copy to destination, run manually or via cron
**Environment:** Virtual environment (isolated dependencies)

**Updates:**
1. Edit code locally
2. Test in venv
3. Run when needed (no daemon/service)

---

## Integration Points

### PropertyReport ↔ HOALibrary

**Interface:** Apps Script Library dependency
**Methods Used:**
- `HOALibrary.standardizeHOAAddress(address)`
- `HOALibrary.getBuildingAddress(address)`
- `HOALibrary.getUnitFromAddress(address)`
- `HOALibrary.getBuildingDataFromSheet(sheet, address)`
- `HOALibrary.isHOAOwner(email)`
- `HOALibrary.getKeystoneProfileData(address)`
- `HOALibrary.getKeystoneViolations(address)`
- `HOALibrary.getKeystoneWorkOrders(address, status)`
- `HOALibrary.getKeystoneArchReviews(address, status)`

**Version:** PropertyReport requires HOALibrary v4+

### Keystone Scraper → Google Sheets

**Interface:** Google Sheets API (Python)
**Data Flow:** Keystone portal → Python scraper → Google Sheets cache
**Schedule:** Daily at 2 AM (cron job on oregano server)
**Process:**
1. Playwright browser automation logs into Keystone portal
2. Scrapes 4 data sources (profiles, violations, work orders, arch reviews)
3. Writes to 4 sheets in cache spreadsheet
4. Logs timestamp of update

### HOALibrary → Keystone Cache

**Interface:** SpreadsheetApp (Google Sheets)
**Data Flow:** Cache spreadsheet → HOALibrary functions → PropertyReport
**Methods:**
- Read from "Profiles" sheet
- Read from "Violations" sheet
- Read from "WorkOrders" sheet
- Read from "ArchReviews" sheet
**Address Matching:** Uses standardizeHOAAddress() for consistent matching

### PropertyReport ↔ Google Form

**Interface:** Installable trigger (onFormSubmit)
**Data Flow:** Form → Event object → Script
**Fields Required:**
- Address (text)
- Email (email)

### exif-to-parcel ↔ Google Drive

**Interface:** Manual upload (not automated)
**Process:**
1. Run script locally
2. Organize photos in output/
3. Manually upload to Drive Gutter Pictures folder

**Future:** Could automate upload step

### LabelsToGroups ↔ Google Contacts

**Interface:** People API (read contacts by label)
**Data Flow:**
1. Script reads contact labels
2. Extracts email addresses
3. Adds to corresponding groups

**Sync Frequency:** Daily (optional trigger) or manual

---

## Error Handling

### PropertyReport

**Strategy:** Fail gracefully, log errors, notify admin

**Handled Errors:**
- Missing data sources → Empty report section
- No photos found → Report without photos
- Invalid address → User error message
- Non-owner request → Rejection email

**Unhandled:**
- API quota exceeded (no retry)
- Network failures (no retry)

### LabelsToGroups

**Strategy:** Continue on individual failures

**Handled:**
- Contact without email → Skip
- Duplicate member → Ignore
- Group settings already set → Ignore

**Rate Limiting:**
- 200ms delay between member adds

### exif-to-parcel

**Strategy:** Log failures, continue processing

**Handled:**
- No GPS data → NO_GPS folder
- No match → REVIEW folder
- EXIF read error → Skip photo, log

### Keystone Scraper

**Strategy:** Log errors, take screenshots, fail gracefully

**Handled:**
- Login failures → Screenshot saved, error logged
- Portal structure changes → Empty data returned, error logged
- Missing data → Empty arrays/null returned
- Network timeouts → Retry once, then fail
- Google Sheets write errors → Logged with details

**Rollback:**
- PropertyReport continues to work with empty Keystone data
- Can disable scraper cron job without breaking reports
- Cache data persists until next successful scrape

---

## Monitoring & Logging

### Apps Script Execution Logs

**Location:** Apps Script editor → Executions
**Retention:** Limited (days to weeks)
**Contents:** Console logs, errors, execution time

**Key Metrics:**
- PropertyReport: Reports generated per day
- LabelsToGroups: Members synced per run

### Python Script Logs

**exif-to-parcel:**
- **Location:** CSV files (photo_log_*.csv)
- **Retention:** Indefinite (manual cleanup)
- **Contents:** Per-photo processing results

**Keystone Scraper:**
- **Location:** `/tmp/keystone-scraper.log` (when run via cron)
- **Retention:** Overwritten on each run (manual rotation recommended)
- **Contents:** Login status, scrape progress, data counts, errors
- **Screenshots:** `/tmp/keystone_*.png` (on errors when running headed mode)

**Monitoring:**
- Check cron execution: `grep keystone /var/log/syslog`
- Check scraper log: `tail -f /tmp/keystone-scraper.log`
- Check last update timestamp in cache spreadsheet

---

## Performance Characteristics

### PropertyReport

**Execution Time:** 10-30 seconds per report
**Bottlenecks:**
- Drive API calls (photo retrieval)
- PDF generation
- HEIF → JPEG conversion

**Optimization Opportunities:**
- Caching frequently accessed data
- Parallel photo retrieval
- Lazy loading of data sources

### LabelsToGroups

**Execution Time:** 1-5 minutes (depends on contact count)
**Bottlenecks:**
- People API rate limits (200ms delay required)
- Sequential member adds

**Optimization Opportunities:**
- Batch member operations
- Skip already-synced members

### exif-to-parcel

**Execution Time:** 15-20 minutes for 1,000 photos
**Bottlenecks:**
- EXIF extraction (I/O bound)
- Shapely point-in-polygon (CPU bound)

**Performance:** ~1-2 seconds per photo

### Keystone Scraper

**Execution Time:** 2-5 minutes per run
**Bottlenecks:**
- Browser automation (Playwright page loads)
- Network latency to Keystone portal
- Google Sheets API write operations

**Performance:**
- ~30-60 seconds for login
- ~30 seconds per data source (4 sources)
- ~10-20 seconds for Sheets writes

**Schedule:** Daily at 2 AM (low usage time)

---

## Scalability

### Current Limits

**PropertyReport:**
- Concurrent requests: Low (form-driven, sequential)
- Data size: Limited by spreadsheet size (~1,000 rows safe)
- Photos per report: ~50 max (Drive API limits)

**LabelsToGroups:**
- Contacts: ~500 max (API quota limits)
- Groups: 14 (hardcoded)
- Members per group: ~100 typical

**exif-to-parcel:**
- Photos per batch: Tested with 1,131, could handle 10,000+
- Parcels: 26,640 (all of Washoe County)

**Keystone Scraper:**
- Homeowner records: ~300 (current HOA size)
- Violations: ~50-100 typical
- Work orders: ~100-200 typical
- Arch reviews: ~20-50 typical
- Cache spreadsheet size: <1 MB, well within limits

### Growth Considerations

**If HOA grows:**
- PropertyReport: May need caching, database
- LabelsToGroups: May need batch processing
- exif-to-parcel: Scales well (linear time)

---

## Disaster Recovery

### Code Backup

**Primary:** Google Drive Code folder
**Secondary:** Local ~/hoa-code/ on oregano
**Tertiary:** Google Apps Script project history

**Recovery:**
1. Pull from Google Drive using pull_from_drive.sh
2. Or copy from Apps Script project directly

### Data Backup

**Spreadsheets:** Google Sheets native versioning
**Photos:** Google Drive (redundant storage)
**Contacts:** Google Contacts (cloud-based)

**No separate backup needed** (cloud-native)

---

## Future Architecture

### Planned Improvements

**Keystone Integration:** ✅ **COMPLETED**
- Python scraper running daily (via cron)
- Four data sources cached in Google Sheets
- Integrated into PropertyReport via HOALibrary

**Modular PropertyReport:**
- Refactor monolithic script → library modules
- Already designed (library_project/ in openclaw.jane)
- Benefits: Easier testing, maintenance, reuse

**Automated Photo Upload:**
- exif-to-parcel could upload directly to Drive
- Eliminates manual step

**Report History Database:**
- Track who requested what reports
- Useful for auditing, analytics

---

## Related Documentation

- `README.md` - Master project index
- `PropertyReport/README.md` - Property report system
- `HOALibrary/README.md` - Shared library documentation
- `LabelsToGroups/README.md` - Group sync system
- `exif-to-parcel/README.md` - Photo organizer
- `REFACTORING_ROADMAP.md` - Planned improvements

---

**Maintained By:** Dee Buck
**Last Updated:** February 15, 2026
**Version:** 1.0
