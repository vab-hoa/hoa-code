# Property Report Processor - Version History

All notable changes to the Property Report Processor are documented here.

---

## [18.1] - 2026-02-15 (CURRENT - Ready for Production)

### Fixed
- **Critical:** Fixed completely corrupted `onFormSubmit()` function
  - v18.0 had wrong function body (was actually getGutterFolderImages implementation)
  - Restored correct form submission handling:
    - Extracts email from form response using `e.response.getRespondentEmail()`
    - Validates user is HOA owner using `HOALibrary.isHOAOwner(email)`
    - Looks up address using `HOALibrary.getHomeownerFromEmail(email)`
    - Calls gatherReportData, generatePdfReport, and sendReportEmail
- **Critical:** Changed default `debugMode` from `true` to `false` for production
  - When false, emails go to actual requesters instead of admin only
  - Added clearer comments explaining debug mode usage
- **Critical:** Must use published HOALibrary v4+ instead of development mode
  - This is a setting in Apps Script editor, not code
  - Development mode (v0) can cause instability

### Added
- Enhanced error logging with stack traces for better debugging
- Clearer console logging for each step of form processing
- Error notification to admin includes stack trace

### Changed
- Updated version number to 18.1 in code comments
- Added critical fixes note in file header
- Improved code documentation

### Status
✅ Ready for production deployment after comprehensive testing

---

## [18.0] - 2026-02-14 (DEPRECATED - Had Critical Bugs)

### Added
- Complete rewrite with improved address matching logic
- Integration with HOALibrary for address standardization
- Support for both unit-specific and building-wide photo folders
- Enhanced HEIF to JPEG conversion for iPhone photos
- Better error messages for missing data

### Known Issues in v18.0
❌ `address` variable undefined in `onFormSubmit()` - **FIXED IN v18.1**
❌ `debugMode: true` by default - **FIXED IN v18.1**
❌ HOALibrary in development mode - **FIXED IN v18.1**

### Status
⚠️ DO NOT USE - Use v18.1 instead

---

## [17.0] - 2026-02-12

### Changed
- Improved folder search logic for Gutter Pictures
- Enhanced support for Drive shortcuts
- Better handling of folder paths

### Fixed
- Fixed issue where shortcuts weren't recognized as folders
- Improved error handling in Drive folder traversal

---

## [16.0] - 2026-02-12

### Added
- Support for Google Drive shortcuts
- Enhanced folder finding with fallback paths
- Better logging for troubleshooting folder access

---

## [15.0] - 2026-02-11

### Changed
- Improved address normalization logic
- Better handling of unit number variations
- Enhanced matching for building vs. unit folders

---

## [14.0] - 2026-02-10

### Added
- HEIF image format conversion (for iPhone photos)
- Better image handling and error recovery

### Changed
- Refactored image retrieval logic
- Improved PDF generation with better formatting

---

## [13.0] - 2026-02-10

### Changed
- Switched from Session API to Form email for requester identification
- Improved email address extraction from form responses

### Removed
- Dependency on Session API (unreliable)

---

## [12.0] - 2026-02-10

### Added
- Filename sanitization for PDF attachments
- Better handling of special characters in addresses

---

## [11.0] - 2026-02-10

### Added
- Initial wood trim data integration
- Support for multiple data sources in single report

---

## [10.0] - 2026-02-09

### Added
- Gutter maintenance data from spreadsheet
- Photo attachment from Drive folders

---

## [9.0] - 2026-02-08

### Added
- Basic PDF report generation
- Email delivery to requesters

---

## [8.0] - 2026-02-07

### Added
- Group membership validation
- Owner verification before processing requests

---

## [7.0] - 2026-02-06

### Added
- Form submission trigger integration
- Basic address parsing

---

## [6.0] - 2026-02-05

### Added
- Initial integration with HOA Library
- Address standardization

---

## [5.0] - 2026-02-04

### Added
- Spreadsheet data retrieval
- Basic data aggregation logic

---

## [4.0] - 2026-02-03

### Added
- Advanced Services integration (Admin Directory API, People API)
- Homeowner lookup functionality

---

## [3.0] - 2026-02-02

### Added
- Basic form handling
- Email notification system

---

## [2.0] - 2026-02-01

### Added
- Project structure and configuration
- CONFIG object for centralized settings

---

## [1.0] - 2026-01-31

### Added
- Initial project creation
- Basic framework for form submission handling

---

## Version Numbering

**Format:** MAJOR.MINOR

**Increment MAJOR when:**
- Breaking changes to data format
- Major feature additions
- Significant architecture changes

**Increment MINOR when:**
- Bug fixes
- Small improvements
- Configuration changes
- Documentation updates

---

## Migration Notes

### Upgrading from v18.0 to v18.1
No data migration needed. Simply:
1. Replace Code.gs with v18.1 code
2. Verify `debugMode: false` in CONFIG
3. Check HOALibrary using published version (not development)
4. Test with real form submission

### Upgrading from v17.x to v18.x
No breaking changes. Library dependency added:
1. Add HOALibrary as dependency (see README.md)
2. Update code
3. Test address standardization

### Upgrading from Earlier Versions
- Review CONFIGURATION.md for new CONFIG settings
- Ensure all spreadsheet IDs are current
- Verify form field names match expected values
- Test thoroughly before deploying

---

## Deprecation Notices

**v18.0:** Deprecated due to critical bugs - use v18.1
**v1.0 - v7.0:** Early development versions - archived for reference only

---

**Maintained by:** Dee Buck
**Last Updated:** February 15, 2026
**Next Version:** TBD (pending Keystone integration)
