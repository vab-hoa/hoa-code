# HOA Library

**Shared utility library for Villas at the Boulders HOA Apps Script projects**

**Type:** Google Apps Script Library
**Version:** 5.0.0 (with formal versioning)
**Script ID:** `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
**Status:** Production
**Last Updated:** February 15, 2026

**Version Management:** See [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) for release process and compatibility

---

## What It Does

Provides reusable utility functions for HOA automation projects:
- **Address Standardization** - Convert any address format to compact HOA format
- **Homeowner Lookup** - Check group membership and owner status
- **Spreadsheet Utilities** - Building-aware data retrieval
- **Project Registry** - Access gutter and wood trim project data
- **Keystone Integration** - Access cached Keystone property management data

---

## Quick Start

### Add as Library Dependency

1. Open your Apps Script project
2. Libraries (left sidebar, + icon)
3. Script ID: `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
4. Identifier: `HOALibrary`
5. Version: Select latest (v4 or higher)
6. **Important:** Use published version, NOT development mode

### Use in Your Code

```javascript
// Standardize an address
const standardized = HOALibrary.standardizeHOAAddress("13737 Rock Point Unit 102");
// Returns: "13737RP2"

// Get building address (without unit)
const building = HOALibrary.getBuildingAddress("13737 Rock Point #102");
// Returns: "13737RP"

// Extract unit number
const unit = HOALibrary.getUnitFromAddress("13737 Rock Point Unit 102");
// Returns: "2"

// Check if email is an owner
const isOwner = HOALibrary.isHOAOwner("someone@example.com");
// Returns: true or false

// Get building data from spreadsheet
const data = HOALibrary.getBuildingDataFromSheet(sheet, "13737RP2");
// Returns: All rows for building 13737RP (both units)
```

---

## Modules

### 1. AddressStandardization.gs

Converts address formats to compact HOA standard.

#### Functions

**standardizeHOAAddress(address)**
- **Purpose:** Convert any address to compact HOA format
- **Input:** Address string (any common format)
- **Output:** Standardized string (e.g., "13737RP2") or empty string if invalid
- **Example:**
  ```javascript
  HOALibrary.standardizeHOAAddress("13737 Rock Point Unit 102")
  // Returns: "13737RP2"

  HOALibrary.standardizeHOAAddress("13737 Rock PT #102")
  // Returns: "13737RP2"

  HOALibrary.standardizeHOAAddress("13737 Rock Point")
  // Returns: "13737RP"
  ```

**getBuildingAddress(address)**
- **Purpose:** Extract building address without unit number
- **Input:** Address string
- **Output:** Building-only address (e.g., "13737RP")
- **Example:**
  ```javascript
  HOALibrary.getBuildingAddress("13737 Rock Point #102")
  // Returns: "13737RP"
  ```

**getUnitFromAddress(address)**
- **Purpose:** Extract unit number (1 or 2)
- **Input:** Address string
- **Output:** "1", "2", or empty string if no unit
- **Example:**
  ```javascript
  HOALibrary.getUnitFromAddress("13737 Rock Point Unit 102")
  // Returns: "2"

  HOALibrary.getUnitFromAddress("13737 Rock Point Unit 101")
  // Returns: "1"

  HOALibrary.getUnitFromAddress("13737 Rock Point")
  // Returns: ""
  ```

**getDisplayAddress(standardizedAddress)**
- **Purpose:** Convert standardized format back to readable format
- **Input:** Standardized address (e.g., "13737RP2")
- **Output:** Human-readable format (e.g., "13737 Rock Point #102")
- **Example:**
  ```javascript
  HOALibrary.getDisplayAddress("13737RP2")
  // Returns: "13737 Rock Point #102"
  ```

#### Street Codes

| Street Name | Code | Example |
|-------------|------|---------|
| Broadlands Lane | BL | 13600BL → 13600 Broadlands Lane |
| Boulder Point | BP | 13737BP2 → 13737 Boulder Point #102 |
| Rock Point | RP | 13737RP1 → 13737 Rock Point #101 |
| Stone Circle | SC | 13704SC2 → 13704 Stone Circle #102 |
| Boulder Circle | BC | 13622BC1 → 13622 Boulder Circle #101 |
| Plaster Point | PP | 13723PP2 → 13723 Plaster Point #102 |

📖 See [ADDRESS_SPEC.md](ADDRESS_SPEC.md) for complete address format specification.

---

### 2. HomeownerLookup.gs

Check homeowner status and group membership.

#### Functions

**getHomeownerFromEmail(email)**
- **Purpose:** Look up homeowner by email using People API
- **Input:** Email address
- **Output:** Person object or null
- **Requires:** People API enabled
- **Example:**
  ```javascript
  const homeowner = HOALibrary.getHomeownerFromEmail("john@example.com");
  if (homeowner) {
    console.log("Found:", homeowner.names[0].displayName);
  }
  ```

**isHOAOwner(email)**
- **Purpose:** Check if email is in any owner groups
- **Input:** Email address
- **Output:** true or false
- **Checks these groups:**
  - `owners@villasboulders.org`
  - `owneroccupant@villasboulders.org`
  - `nonoccupantowner@villasboulders.org`
- **Requires:** Admin Directory API enabled
- **Example:**
  ```javascript
  if (HOALibrary.isHOAOwner("john@example.com")) {
    console.log("Verified owner");
  } else {
    console.log("Not an owner");
  }
  ```

---

### 3. SpreadsheetUtils.gs

Utilities for working with HOA data spreadsheets.

#### Functions

**getBuildingDataFromSheet(sheet, address)**
- **Purpose:** Retrieve all data for a building (both units if applicable)
- **Input:**
  - `sheet` - Spreadsheet object
  - `address` - Address to search (any format)
- **Output:** Array of row data for the building
- **Smart Behavior:** If you search for unit 102, returns data for both 101 and 102
- **Example:**
  ```javascript
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const data = HOALibrary.getBuildingDataFromSheet(sheet, "13737RP2");
  // Returns: All rows matching building 13737RP
  ```

**extractHyperlinkUrl(cell)**
- **Purpose:** Extract URL from a hyperlinked cell
- **Input:** Cell value (may contain hyperlink)
- **Output:** URL string or empty string
- **Use Case:** Extract photo URLs from spreadsheet cells
- **Example:**
  ```javascript
  const url = HOALibrary.extractHyperlinkUrl(cell);
  if (url) {
    console.log("Photo URL:", url);
  }
  ```

---

### 4. KeystoneIntegration.gs

Functions for accessing cached Keystone Property Management data.

#### Functions

**getKeystoneProfileData(address)**
- **Purpose:** Get profile/account information for a property
- **Input:** Property address (any format, will be standardized)
- **Output:** Object with `{accountNumber, name, phone, email}` or null if not found
- **Cache:** Reads from "Profiles" sheet in Keystone cache spreadsheet
- **Example:**
  ```javascript
  const profile = HOALibrary.getKeystoneProfileData("13737 Rock Point Unit 102");
  if (profile) {
    console.log("Account #:", profile.accountNumber);
    console.log("Name:", profile.name);
  }
  ```

**getKeystoneViolations(address)**
- **Purpose:** Get all violations for a property
- **Input:** Property address (any format)
- **Output:** Array of violation objects `[{date, description, status}]`
- **Match Logic:** Matches at building level (violations apply to entire building)
- **Cache:** Reads from "Violations" sheet in Keystone cache spreadsheet
- **Example:**
  ```javascript
  const violations = HOALibrary.getKeystoneViolations("13737 Rock Point Unit 102");
  console.log("Found " + violations.length + " violations");
  violations.forEach(v => {
    console.log(v.date, v.description, v.status);
  });
  ```

**getKeystoneWorkOrders(address, status)**
- **Purpose:** Get work orders for a property, optionally filtered by status
- **Input:**
  - `address` - Property address (any format)
  - `status` - Optional status filter ("Open", "Closed", etc.) or null for all
- **Output:** Array of work order objects `[{date, description, status, type}]`
- **Match Logic:** Matches at building level
- **Cache:** Reads from "WorkOrders" sheet in Keystone cache spreadsheet
- **Example:**
  ```javascript
  // Get all work orders
  const allOrders = HOALibrary.getKeystoneWorkOrders("13737 Rock Point Unit 102", null);

  // Get only open work orders
  const openOrders = HOALibrary.getKeystoneWorkOrders("13737 Rock Point Unit 102", "Open");
  ```

**getKeystoneArchReviews(address, status)**
- **Purpose:** Get architectural review requests for a property
- **Input:**
  - `address` - Property address (any format)
  - `status` - Optional status filter ("open", "closed", "all") or null for all
- **Output:** Array of arch review objects `[{date, description, status}]`
- **Match Logic:** Matches at building level
- **Cache:** Reads from "ArchReviews" sheet in Keystone cache spreadsheet
- **Example:**
  ```javascript
  // Get all architectural reviews
  const allReviews = HOALibrary.getKeystoneArchReviews("13737 Rock Point Unit 102", null);

  // Get only open reviews
  const openReviews = HOALibrary.getKeystoneArchReviews("13737 Rock Point Unit 102", "open");
  ```

#### Cache Spreadsheet

- **Spreadsheet ID:** `1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ`
- **Updated by:** Python scraper running on oregano server
- **Update frequency:** Daily (via cron)
- **Sheets:**
  - **Profiles** - Homeowner contact and account information
  - **Violations** - All violations with status
  - **WorkOrders** - All work orders with status and type
  - **ArchReviews** - All architectural review requests

#### Error Handling

All Keystone functions:
- Accept address in any format (will be standardized internally)
- Return null or empty array if data not found
- Log errors to console without throwing exceptions
- Handle missing cache spreadsheet gracefully

---

### 5. ProjectRegistry.gs

Factory for accessing project-specific data.

#### Functions

**getAvailableProjects()**
- **Purpose:** List all available project types
- **Output:** Array of project objects
- **Example:**
  ```javascript
  const projects = HOALibrary.getAvailableProjects();
  // Returns: [GutterProject, WoodTrimProject]
  ```

**getActiveProjects()**
- **Purpose:** List only active projects
- **Output:** Array of active project objects
- **Example:**
  ```javascript
  const active = HOALibrary.getActiveProjects();
  ```

**getProjectById(projectId)**
- **Purpose:** Get specific project by ID
- **Input:** Project ID ("gutters" or "woodtrim")
- **Output:** Project object or null
- **Example:**
  ```javascript
  const gutters = HOALibrary.getProjectById("gutters");
  const data = gutters.getReportData("13737RP2");
  ```

---

### 5. GutterProject.gs

Gutter maintenance project interface.

#### Properties

- **id:** "gutters"
- **name:** "Gutter Maintenance"
- **spreadsheetId:** `10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A`

#### Methods

**isActive()** - Returns true
**getSpreadsheetId()** - Returns spreadsheet ID
**getReportData(address)** - Returns gutter data for address
**appendToDocument(doc, data)** - Formats gutter data in PDF

---

### 6. WoodTrimProject.gs

Wood trim assessment project interface.

#### Properties

- **id:** "woodtrim"
- **name:** "Wood Trim Assessment"
- **spreadsheetId:** `1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE`

#### Methods

**isActive()** - Returns true
**getSpreadsheetId()** - Returns spreadsheet ID
**getReportData(address)** - Returns wood trim data for address
**appendToDocument(doc, data)** - Formats wood trim data in PDF

---

### 7. Tests.gs

Test suite for address standardization.

#### Functions

**testHOAAddressStandardization()**
- **Purpose:** Run 20 test cases for address parsing
- **Output:** Logs results to console
- **Example:**
  ```javascript
  HOALibrary.testHOAAddressStandardization();
  // Logs test results for various address formats
  ```

**testBuildingAddressExtraction()**
- **Purpose:** Test building address extraction
- **Output:** Logs results to console

---

### 8. Version.gs

Version tracking and compatibility checking for HOALibrary.

#### Functions

**getVersion()**
- **Purpose:** Get the current version number
- **Output:** String in semantic versioning format (e.g., "5.0.0")
- **Example:**
  ```javascript
  var version = HOALibrary.getVersion();
  console.log('Using HOALibrary v' + version);
  // Logs: "Using HOALibrary v5.0.0"
  ```

**getVersionInfo()**
- **Purpose:** Get detailed version information
- **Output:** Object with version, releaseDate, description, features
- **Example:**
  ```javascript
  var info = HOALibrary.getVersionInfo();
  console.log(info.description);  // "Added Keystone Pacific integration"
  console.log(info.features);     // Array of feature descriptions
  ```

**logVersionInfo()**
- **Purpose:** Log formatted version information to console
- **Output:** None (logs to console)
- **Example:**
  ```javascript
  HOALibrary.logVersionInfo();
  // Logs formatted version details including features list
  ```

**isCompatibleWith(requiredVersion)**
- **Purpose:** Check if current version meets minimum requirement
- **Input:** Required version string (e.g., "4.0.0")
- **Output:** Boolean - true if compatible
- **Example:**
  ```javascript
  if (!HOALibrary.isCompatibleWith('4.0.0')) {
    throw new Error('HOALibrary version 4.0.0 or higher required');
  }
  ```

**Version Management:**
- See [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) for full version history
- Follows [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
- Always use numbered versions in production (never "development")

---

## Prerequisites

### Advanced Services Required

Enable in your Apps Script project that uses this library:

1. **Admin Directory API** (directory_v1)
   - For: `isHOAOwner()` function
   - Checks group membership

2. **People API** (v1)
   - For: `getHomeownerFromEmail()` function
   - Looks up contact information

### Domain-Wide Delegation

If using service account with domain-wide delegation, ensure these scopes:

```
https://www.googleapis.com/auth/admin.directory.group
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/contacts.readonly
```

---

## Installation as Library

### For New Projects

1. Open your Apps Script project
2. Click Libraries (+ icon in left sidebar)
3. Enter Script ID: `1vxq3cRUqQMvwdmmq_W-FsMGwQqECOpucfIPM5aGDKB_FDyrAZcLOZFzF`
4. Select latest version (4 or higher)
5. Identifier: `HOALibrary`
6. Click Add

### For Existing Projects Using Development Mode

⚠️ **Important:** Switch from development mode to published version!

1. Libraries → Find HOALibrary
2. Click version dropdown
3. Select latest version number (not "development mode")
4. Save

**Why?** Development mode can introduce instability and unexpected behavior.

---

## Testing the Library

### Quick Test

```javascript
function testLibrary() {
  // Test address standardization
  const addr1 = HOALibrary.standardizeHOAAddress("13737 Rock Point Unit 102");
  Logger.log("Test 1:", addr1); // Should log: "13737RP2"

  const addr2 = HOALibrary.getBuildingAddress("13737 Rock Point #102");
  Logger.log("Test 2:", addr2); // Should log: "13737RP"

  const unit = HOALibrary.getUnitFromAddress("13737 Rock Point Unit 102");
  Logger.log("Test 3:", unit); // Should log: "2"

  // Test owner lookup (requires APIs enabled)
  const isOwner = HOALibrary.isHOAOwner("admin@villasboulders.org");
  Logger.log("Test 4:", isOwner); // Should log: true
}
```

### Run Built-in Tests

```javascript
function runLibraryTests() {
  HOALibrary.testHOAAddressStandardization();
  HOALibrary.testBuildingAddressExtraction();
}
```

---

## Common Use Cases

### Validate and Standardize Form Input

```javascript
function processFormSubmission(e) {
  const response = e.response.getItemResponses();
  const address = response[0].getResponse();

  // Standardize address
  const stdAddress = HOALibrary.standardizeHOAAddress(address);

  if (!stdAddress) {
    throw new Error("Invalid address format");
  }

  console.log("Standardized:", stdAddress);
  // Use stdAddress for lookups...
}
```

### Check Building vs Unit

```javascript
function identifyAddressType(address) {
  const unit = HOALibrary.getUnitFromAddress(address);

  if (unit) {
    console.log("This is a unit-specific address");
    console.log("Unit number:", unit);
  } else {
    console.log("This is a building-wide address");
  }

  const building = HOALibrary.getBuildingAddress(address);
  console.log("Building:", building);
}
```

### Retrieve Related Data

```javascript
function getCompleteBuilding Data(address) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();

  // Get all data for the building (both units)
  const allData = HOALibrary.getBuildingDataFromSheet(sheet, address);

  console.log("Found", allData.length, "rows for this building");
  return allData;
}
```

---

## Versioning

**Current Version:** 4+

**How to Check Version:**
1. Libraries → HOALibrary
2. Version dropdown shows current version

**When to Update:**
- When new features are added
- When bugs are fixed
- When prompted by dependent projects

**Breaking Changes:**
- None currently
- Major version changes will be documented

---

## Troubleshooting

### "Library not found" Error

**Cause:** Library not added or wrong script ID

**Fix:**
1. Add library with correct script ID
2. Verify identifier is exactly: `HOALibrary`

### "Function not defined" Error

**Cause:** Wrong version or development mode

**Fix:**
1. Check version is 4 or higher
2. Switch from development mode to published version

### Standardization Returns Empty String

**Cause:** Address format not recognized

**Fix:**
1. Check address contains street number (4-5 digits)
2. Verify street name matches one of 6 streets
3. See ADDRESS_SPEC.md for supported formats

### Group Membership Check Fails

**Cause:** Admin Directory API not enabled

**Fix:**
1. Enable Admin Directory API in your project
2. Verify service account has domain-wide delegation
3. Check scopes include directory.group

---

## File Structure

```
HOALibrary/
├── AddressStandardization.gs   (186 lines)
├── SpreadsheetUtils.gs          (102 lines)
├── HomeownerLookup.gs           (102 lines)
├── ProjectRegistry.gs           (32 lines)
├── GutterProject.gs             (73 lines)
├── WoodTrimProject.gs           (64 lines)
├── Tests.gs                     (55 lines)
├── appsscript.json              (project manifest)
├── README.md                    (this file)
└── ADDRESS_SPEC.md              (address format specification)
```

**Total:** 614 lines of code

---

## Related Documentation

- [ADDRESS_SPEC.md](ADDRESS_SPEC.md) - Complete address format specification
- [PropertyReport/README.md](../PropertyReport/README.md) - Main user of this library
- [PropertyReport/CONFIGURATION.md](../PropertyReport/CONFIGURATION.md) - How to configure library dependency

---

## Support

**Developer:** Dee Buck (mcdonaldbuck@gmail.com)
**HOA Admin:** admin@villasboulders.org

**For Issues:**
1. Check this README for function documentation
2. Review ADDRESS_SPEC.md for address format questions
3. Run built-in tests to verify library is working
4. Contact developer if issues persist

---

**Created:** February 13, 2026
**Last Updated:** February 15, 2026
**Next Update:** TBD (stable, no changes planned)
