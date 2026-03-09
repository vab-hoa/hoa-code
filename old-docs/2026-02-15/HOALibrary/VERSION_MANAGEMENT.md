# HOALibrary Version Management

**Purpose:** Track and manage versions of the HOALibrary shared library for Apps Script projects.

**Current Version:** 5.0.0
**Last Updated:** February 15, 2026

---

## Semantic Versioning

HOALibrary follows [Semantic Versioning (SemVer)](https://semver.org/):

**Format:** `MAJOR.MINOR.PATCH`

- **MAJOR** version: Incompatible API changes (breaking changes)
- **MINOR** version: New functionality, backwards-compatible
- **PATCH** version: Bug fixes, backwards-compatible

**Examples:**
- `4.0.0` → `4.0.1`: Bug fix (safe to upgrade)
- `4.0.0` → `4.1.0`: New feature added (safe to upgrade)
- `4.0.0` → `5.0.0`: Breaking change (review before upgrading)

---

## Version History

### v5.0.0 (2026-02-15) - Current

**Added:**
- Keystone Integration module (`KeystoneIntegration.gs`)
  - `getKeystoneProfileData(address)` - Account and contact info
  - `getKeystoneViolations(address)` - Property violations
  - `getKeystoneWorkOrders(address, status)` - Work orders
  - `getKeystoneArchReviews(address, status)` - Architectural reviews
- Version tracking system (`Version.gs`)
- Version management documentation

**Changed:**
- None

**Deprecated:**
- None

**Breaking Changes:**
- None (backwards compatible with v4)

**Migration from v4:**
- No changes required
- New functions available but optional
- Existing code continues to work

---

### v4.0.0 (2026-02-14) - Stable

**Features:**
- Address standardization
- Building vs unit address handling
- Spreadsheet utilities
- Homeowner lookup and validation

**Status:** Production stable, recommended baseline

---

### v3.0.0 (2026-02-12)

**Added:**
- Project registry system
- Gutter project module
- Wood trim project module

---

### v2.0.0 (2026-02-10)

**Changed:**
- Refactored into multiple modules
- Improved address parsing

**Breaking Changes:**
- Function signatures changed
- Module names reorganized

---

### v1.0.0 (2026-02-08)

**Initial Release:**
- Basic address standardization
- Monolithic structure

---

## Release Process

When releasing a new version of HOALibrary:

### Step 1: Prepare the Release

1. **Update Version.gs:**
   ```javascript
   function getVersion() {
     return 'X.Y.Z';  // New version number
   }
   ```

2. **Update VERSION_HISTORY:**
   ```javascript
   {
     version: 'X.Y.Z',
     date: 'YYYY-MM-DD',
     changes: [
       'Description of change 1',
       'Description of change 2'
     ],
     breaking: false  // or true
   }
   ```

3. **Update README.md:**
   - Add version number to top
   - Document new functions/features
   - Add migration guide if breaking changes

4. **Update this file (VERSION_MANAGEMENT.md):**
   - Add new version entry above
   - Update "Current Version" at top

### Step 2: Test the Changes

1. **Create test Apps Script project**
2. **Add HOALibrary as dependency** (development mode first)
3. **Run tests:**
   ```javascript
   HOALibrary.logVersionInfo();
   HOALibrary.runAllTests();  // If you have test suite
   ```
4. **Verify new features work**
5. **Verify existing features still work** (backwards compatibility)

### Step 3: Deploy to Apps Script

1. **Open HOA_Library project** in https://script.google.com
2. **Add/update all .gs files**
3. **Save all changes**
4. **Deploy → New deployment**
5. **Select "Library"**
6. **Description:** `vX.Y.Z - Brief description`
7. **Click "Deploy"**
8. **Note the version number** (should auto-increment)

### Step 4: Update Dependent Projects

For each project using HOALibrary:

1. **Open the project** (e.g., PropertyReport)
2. **Libraries → HOALibrary**
3. **Select new version** (X)
4. **Save**
5. **Test thoroughly**

**Projects that depend on HOALibrary:**
- PropertyReport
- (Add others as they're created)

### Step 5: Document and Communicate

1. **Update Google Drive documentation**
2. **Sync to local: `~/hoa-code/pull_from_drive.sh`**
3. **Commit to git** (if using git for HOALibrary)
4. **Notify users** of new version (if team)

---

## Version Compatibility Matrix

| HOALibrary Version | PropertyReport Version | Compatible? | Notes |
|--------------------|------------------------|-------------|-------|
| v5.0.0             | v18.1                  | ✅ Yes      | Keystone integration |
| v5.0.0             | v18.0                  | ✅ Yes      | New functions optional |
| v4.0.0             | v18.0                  | ✅ Yes      | Production stable |
| v3.0.0             | v17.0                  | ✅ Yes      | Older stable |
| v2.0.0             | v16.0 and earlier      | ⚠️ Partial  | May need updates |
| v1.0.0             | Any                    | ❌ No       | Deprecated |

---

## Best Practices

### For Library Developers

1. **Never break backwards compatibility in MINOR/PATCH releases**
   - Adding new functions: MINOR version
   - Fixing bugs: PATCH version
   - Changing function signatures: MAJOR version

2. **Document breaking changes clearly**
   - Update VERSION_HISTORY with `breaking: true`
   - Provide migration guide
   - Warn dependent project owners

3. **Test thoroughly before deploying**
   - Run all test suites
   - Test with actual dependent projects
   - Verify in both development and production mode

4. **Use development mode for testing**
   - Test changes using development mode (v0)
   - Only deploy as numbered version when stable
   - Don't use development mode in production projects

### For Library Users

1. **Pin to specific versions in production**
   - Never use "development" mode in production
   - Select a numbered version (e.g., v5)
   - Only upgrade after testing

2. **Test upgrades before deploying**
   - Upgrade in test project first
   - Run full test matrix
   - Check execution logs for errors

3. **Monitor after upgrades**
   - Watch execution logs for first week
   - Be ready to rollback if issues occur
   - Report bugs to library developers

4. **Stay on supported versions**
   - Don't use deprecated versions
   - Upgrade when security fixes released
   - Follow recommended version path

---

## Checking Library Version

### In Apps Script Code

```javascript
// Log version information
HOALibrary.logVersionInfo();

// Get version string
var version = HOALibrary.getVersion();
console.log('Using HOALibrary v' + version);

// Check compatibility
var compatible = HOALibrary.isCompatibleWith('4.0.0');
if (!compatible) {
  throw new Error('HOALibrary version too old. Need 4.0.0 or higher.');
}

// Get full version details
var info = HOALibrary.getVersionInfo();
console.log(info.description);
console.log('Features:', info.features);
```

### In Apps Script Editor

1. **Libraries section** shows version number
2. **Hover over library name** shows version info
3. **Click version dropdown** shows all available versions

---

## Troubleshooting

### Problem: "Wrong version showing"

**Cause:** Project using development mode instead of published version

**Fix:**
1. Libraries → HOALibrary
2. Change from "development" to specific version number
3. Save

---

### Problem: "Function not found"

**Cause:** Using older version that doesn't have new functions

**Fix:**
1. Check version: `HOALibrary.getVersion()`
2. Upgrade to required version
3. Or check if function name changed

---

### Problem: "Breaking changes after upgrade"

**Cause:** Upgraded across major version boundary

**Fix:**
1. Read VERSION_HISTORY for breaking changes
2. Update calling code to match new API
3. Or rollback to previous major version

---

## Future Improvements

**Planned for v6.0.0 and beyond:**
- Automated testing suite
- Type definitions (for better IDE support)
- Performance optimizations
- More granular error handling
- Additional utility functions

See `~/hoa-code/REFACTORING_ROADMAP.md` for full roadmap.

---

**Maintained By:** Dee Buck
**Questions:** admin@villasboulders.org
**Last Review:** February 15, 2026

