# HOA Code Repository

**Local backup and development workspace for Villas at the Boulders HOA automation projects**

**Last Updated:** February 15, 2026
**Maintained By:** Dee Buck (admin@villasboulders.org)
**Source of Truth:** [Google Drive - HOA Board Documents/Code](https://drive.google.com/drive/folders/1VH1UQdEQYDY3cSXVEjIhWxq7r6x3wmvm)

---

## Quick Start

This repository contains all HOA automation code with comprehensive documentation designed for handoff to future maintainers.

**What's Here:**
- **PropertyReport/** - Automated property report generation from Google Forms
- **HOALibrary/** - Shared utility library for address standardization and data access
- **LabelsToGroups/** - Sync Google Contacts labels to Groups for community organization
- **exif-to-parcel/** - Photo organization tool using GPS EXIF data
- **utilities/** - Helper scripts for Google Workspace management

---

## Projects Overview

### 1. PropertyReport (Apps Script)
**Status:** Production
**Version:** 18
**Purpose:** Generates PDF property reports with gutter/wood trim data when homeowners submit Google Form

**Key Features:**
- Validates homeowner group membership before processing
- Retrieves building-specific data from multiple spreadsheets
- Attaches photos from Google Drive organized by address
- Emails PDF report to requester

**Location:** `PropertyReport/Code.gs` (1,296 lines)
**Dependencies:** HOA Library (v4+), Admin Directory API, People API
📖 [Full Documentation](PropertyReport/README.md)

---

### 2. HOALibrary (Apps Script Library)
**Status:** Production
**Version:** 4+
**Purpose:** Shared library providing address standardization and utility functions

**Key Modules:**
- `AddressStandardization.gs` - Convert addresses to HOA compact format (e.g., "13737RP2")
- `HomeownerLookup.gs` - Check group membership via People API
- `SpreadsheetUtils.gs` - Building-aware data retrieval
- `ProjectRegistry.gs` - Gutter and Wood Trim project interfaces
- `GutterProject.gs` - Gutter project data access
- `WoodTrimProject.gs` - Wood trim project data access
- `Tests.gs` - Test suite for address standardization

**Location:** `HOALibrary/*.gs` (7 files, 614 lines total)
**Dependencies:** Admin Directory API, People API
📖 [Full Documentation](HOALibrary/README.md) | [Address Spec](HOALibrary/ADDRESS_SPEC.md)

---

### 3. LabelsToGroups (Apps Script)
**Status:** Production
**Purpose:** Automatically sync Google Contacts labels to Google Groups

**What It Does:**
- Creates Google Groups for each street and role (14 groups total)
- Syncs Contact Group members to corresponding Google Groups
- Maintains admin as owner of all groups
- Rate-limited to prevent quota errors

**Location:** `LabelsToGroups/Code.gs` (77 lines)
**Dependencies:** Admin Groups Settings API, People API, Admin Directory API
📖 [Full Documentation](LabelsToGroups/README.md) | [Group Mappings](LabelsToGroups/SYNC_LIST.md)

---

### 4. exif-to-parcel (Python)
**Status:** Production
**Purpose:** Organize contractor photos by property using GPS EXIF data

**How It Works:**
- Phase 1: Direct GPS coordinate matching to parcels (point-in-polygon)
- Phase 2: Smart neighbor inference using sequence numbers and timestamps
- Success Rate: 90.4% (1,022 of 1,131 photos matched in latest run)

**Location:** `exif-to-parcel/match_photos.py`
**Dependencies:** Pillow, Shapely (Python 3 + venv)
📖 [Full Documentation](exif-to-parcel/README.md) | [Latest Results](exif-to-parcel/RESULTS.md)

---

### 5. utilities/ (Python Scripts)
**Purpose:** Helper scripts for Google Workspace administration

**What's Included:**
- Google Drive access and file organization tools
- Service account testing and diagnostics
- Form and Apps Script project management
- Documentation conversion utilities

📖 [Full Documentation](utilities/README.md)

---

## Prerequisites

### Google Service Account Setup
All automation uses a service account with domain-wide delegation.

**Service Account Email:** `openclaw-automation@villasboulders-automation.iam.gserviceaccount.com`
**Client ID:** `115753241775007656597`
**Credentials Location:** `~/.config/openclaw/google-service-account.json` (oregano)

**Required APIs Enabled:**
- Gmail API
- Google Drive API
- Admin SDK API (Directory, Groups Settings)
- People API
- Calendar API

**Domain-Wide Delegation Scopes:**
```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/admin.directory.group
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/groups
```

📖 See `~/openclaw.jane/workspace/docs/google-workspace-service-account-setup.md` for full setup guide.

---

## Syncing with Google Drive

This local repository mirrors the **Google Drive Code directory** which is the source of truth.

### Google Drive Location:
**Shared Drive:** HOA Board Documents
**Folder:** [Code](https://drive.google.com/drive/folders/1VH1UQdEQYDY3cSXVEjIhWxq7r6x3wmvm)
**Access:** admin@villasboulders.org, manager@villasboulders.org

### Upload Local Changes to Drive:
```bash
cd ~/hoa-code
./sync_to_drive.sh
```

### Download Latest from Drive:
```bash
cd ~/hoa-code
./pull_from_drive.sh
```

**⚠️ Important:** Always upload changes to Google Drive after making modifications. This ensures successors can access the latest code.

---

## Directory Structure

```
~/hoa-code/
├── README.md                    (this file)
├── sync_to_drive.sh            (upload changes to Google Drive)
├── pull_from_drive.sh          (download latest from Google Drive)
│
├── PropertyReport/
│   ├── Code.gs                 (v18 - main script)
│   ├── README.md               (setup and deployment guide)
│   ├── CHANGELOG.md            (version history)
│   ├── CONFIGURATION.md        (CONFIG settings explained)
│   └── KNOWN_ISSUES.md         (current limitations)
│
├── HOALibrary/
│   ├── AddressStandardization.gs
│   ├── SpreadsheetUtils.gs
│   ├── HomeownerLookup.gs
│   ├── ProjectRegistry.gs
│   ├── GutterProject.gs
│   ├── WoodTrimProject.gs
│   ├── Tests.gs
│   ├── README.md               (API reference)
│   └── ADDRESS_SPEC.md         (address format documentation)
│
├── LabelsToGroups/
│   ├── Code.gs
│   ├── README.md               (usage guide)
│   └── SYNC_LIST.md            (group mappings)
│
├── exif-to-parcel/
│   ├── match_photos.py
│   ├── requirements.txt
│   ├── test_setup.py
│   ├── README.md               (enhanced with deployment guide)
│   └── RESULTS.md              (latest run results)
│
└── utilities/
    ├── README.md               (utility scripts documentation)
    └── [Python scripts for Google Workspace management]
```

---

## For New Developers

### Getting Started:
1. **Review this README** to understand what exists
2. **Read project-specific READMEs** for details on each component
3. **Check Google Drive** for the latest code (this is the source of truth)
4. **Set up service account credentials** if running locally (see Prerequisites)
5. **Review ARCHITECTURE.md** to understand how everything fits together

### Key Concepts:
- **HOA Addresses:** Use compact format (e.g., "13737RP2" = 13737 Rock Point Unit 102)
  - See `HOALibrary/ADDRESS_SPEC.md` for full specification
- **Street Codes:** BL (Broadlands), BP (Boulder Point), RP (Rock Point), SC (Stone Circle), BC (Boulder Circle), PP (Plaster Point)
- **Unit Numbers:** 101 = Unit 1, 102 = Unit 2 (last digit is canonical)
- **Data Sources:** All project data comes from Google Spreadsheets (see CONFIGURATION.md)

---

## Troubleshooting

### "Permission Denied" Errors:
- Check service account credentials exist at `~/.config/openclaw/google-service-account.json`
- Verify domain-wide delegation is enabled in Google Admin Console
- Ensure required APIs are enabled in Google Cloud project

### Apps Script Not Finding Files:
- Check folder structure in Google Drive matches expected paths
- Verify service account has been added to HOA Board Documents shared drive
- Review Drive folder IDs in CONFIGURATION.md

### Property Reports Not Sending:
- Check `debugMode` setting in PropertyReport/Code.gs CONFIG object
- Verify HOALibrary is using published version (not development mode)
- Review form submission logs in Apps Script editor

---

## Maintenance

### Weekly:
- Check Property Report form submission logs for errors
- Review Google Drive storage usage

### Monthly:
- Sync local changes to Google Drive
- Review KNOWN_ISSUES.md and address top priorities
- Update documentation if configuration changes

### Quarterly:
- Review all documentation for accuracy
- Update version numbers
- Archive old backups
- Test all automation end-to-end

---

## Related Documentation

**On This System (oregano):**
- `~/openclaw.jane/workspace/HOA_Property_Report_Specification.md` - Complete system specification
- `~/openclaw.jane/workspace/PROJECTS.md` - Strategic planning and priorities
- `~/openclaw.jane/workspace/MEMORY.md` - Session coordination notes
- `~/openclaw.jane/workspace/docs/google-workspace-service-account-setup.md` - Service account setup guide

**On Google Drive:**
- All code files (source of truth)
- All documentation (converted to Google Docs)
- Project-specific folders with README files

---

## Support

**Primary Contact:** Dee Buck (mcdonaldbuck@gmail.com)
**HOA Email:** admin@villasboulders.org
**Manager Email:** manager@villasboulders.org

**For Issues:**
1. Check project-specific README for troubleshooting
2. Review KNOWN_ISSUES.md for documented limitations
3. Check Google Drive for latest code version
4. Contact primary contact if stuck

---

**Repository Created:** February 15, 2026
**Purpose:** Cleanup and organization for future handoff
**Next Steps:** Complete Property Report v18 bug fixes, create ARCHITECTURE.md, add git tracking to exif-to-parcel
