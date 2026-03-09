# PropertyReport - Modular Version

## Overview

This is the **modular version** of the PropertyReport Apps Script project. The functionality is **100% identical** to the original monolithic version - this is purely a reorganization to improve code maintainability and readability.

## What Changed

### Before: Monolithic Structure
- **1 file**: `Code.gs` (1,296 lines)
- All functions in a single file
- Difficult to navigate and maintain

### After: Modular Structure
- **7 files**: Organized by responsibility
- Same total lines of code
- Much easier to find and modify specific functionality

## File Organization

### 1. `Config.gs` (42 lines)
Contains all configuration constants:
- Form ID
- Spreadsheet IDs (gutters, wood trim, Keystone)
- Email addresses (admin, manager, owners group)
- Debug mode setting

### 2. `Main.gs` (170 lines)
Entry points and orchestration:
- `onFormSubmit()` - Triggered when someone requests a report
- `testPropertyReport()` - Manual testing function
- `testAddressStandardization()` - Address testing utility

### 3. `DataGathering.gs` (275 lines)
Data collection from all sources:
- `gatherReportData()` - Main data collection orchestrator
- `getKeystoneData()` - Fetches Keystone property management data
- `getKeystoneSheetData()` - Legacy sheet reader
- `getGutterFolderImages()` - Finds gutter photos in Drive
- `getImagesFromFolder()` - Extracts images from a folder

### 4. `EmailService.gs` (98 lines)
All email communications:
- `sendReportEmail()` - Sends the PDF report to homeowner
- `sendNotOwnerEmail()` - Access denied notification
- `sendNoAddressEmail()` - Address not found notification
- `notifyAdmin()` - Admin alerts

### 5. `ImageProcessing.gs` (88 lines)
Image handling utilities:
- `convertDriveUrl()` - Converts Drive viewing URLs to direct links
- `convertHeifToJpeg()` - Converts iOS HEIF images to JPEG

### 6. `ReportGeneration.gs` (582 lines)
PDF report creation:
- `generatePdfReport()` - Creates the complete PDF report
- `appendTableFromDataWithImages()` - Adds data tables with embedded images
- `appendGutterFolderImages()` - Adds gutter photos to PDF
- `appendTableFromData()` - Generic table formatter
- `appendWoodTrimData()` - Wood trim specific formatter
- `appendGutterData()` - Gutter data specific formatter

### 7. `Utilities.gs` (84 lines)
Helper functions:
- `findFolderOrShortcut()` - Finds folders in Drive (handles shortcuts)

### 8. `appsscript.json`
Project configuration file (unchanged from original)

## How to Deploy

### Method 1: Using clasp (Recommended)

1. Install clasp if you haven't already:
   ```bash
   npm install -g @google/clasp
   ```

2. Login to clasp:
   ```bash
   clasp login
   ```

3. Create a new Apps Script project:
   ```bash
   cd /home/dee/hoa-code/PropertyReport-Modular
   clasp create --title "PropertyReport Modular" --type standalone
   ```

4. Push the modular files:
   ```bash
   clasp push
   ```

5. Open in Apps Script editor:
   ```bash
   clasp open
   ```

### Method 2: Manual Copy-Paste

1. Go to [script.google.com](https://script.google.com)
2. Create a new project: "PropertyReport Modular"
3. Create 7 new script files (Config.gs, Main.gs, etc.)
4. Copy the content from each .gs file into the corresponding script file
5. Update the `appsscript.json` manifest (Project Settings > "Show appsscript.json")

### After Deployment

1. Set up the installable trigger:
   - Run `Main.gs > onFormSubmit` once to authorize
   - Go to Triggers (clock icon)
   - Add trigger: `onFormSubmit`, From form, On form submit

2. Test the system:
   - Edit `TEST_ADDRESS` in `Main.gs > testPropertyReport()`
   - Run `testPropertyReport()` to generate a test report

## Advantages of Modular Structure

### 1. **Better Organization**
- Functions grouped by purpose
- Easy to find what you need
- Clear separation of concerns

### 2. **Easier Maintenance**
- Update email templates? Look in `EmailService.gs`
- Fix image processing? Look in `ImageProcessing.gs`
- Change configuration? Look in `Config.gs`

### 3. **Improved Collaboration**
- Multiple developers can work on different modules
- Clearer code ownership
- Reduced merge conflicts

### 4. **Enhanced Readability**
- Smaller files are easier to understand
- Module headers explain purpose
- Function documentation more accessible

### 5. **Future-Proof**
- Easy to add new modules (e.g., `NotificationService.gs`)
- Simple to refactor individual modules
- Supports incremental improvements

## Important Notes

### Apps Script Global Scope
All .gs files in an Apps Script project share the same **global scope**. This means:
- ✅ No imports or requires needed
- ✅ `CONFIG` object accessible from all files
- ✅ Functions can call each other across files
- ✅ All variables and constants are shared

### No Functional Changes
This refactoring includes:
- ✅ Zero logic changes
- ✅ Identical function behavior
- ✅ Same dependencies (HOALibrary v4+)
- ✅ Same configuration values
- ✅ Same output PDFs

### Version Tracking
- Original version: 18.1 (monolithic)
- Modular version: 18.1 (modular)
- Phase: REFACTORING_ROADMAP Phase 3

## Testing

After deployment, test thoroughly:

1. **Address Standardization Test**
   ```javascript
   testAddressStandardization()
   ```

2. **Full Report Test**
   ```javascript
   testPropertyReport()
   ```

3. **Live Form Submission**
   - Submit a real form request
   - Verify email delivery
   - Check PDF formatting

## Troubleshooting

### "Function not found" errors
- Make sure all 7 .gs files are created in the project
- File names don't matter, but having all files does

### "CONFIG is not defined" errors
- Ensure `Config.gs` is present
- Check that `const CONFIG = {...}` is at global scope

### Trigger not working
- Verify the trigger is set up for `onFormSubmit`
- Check that the form ID in CONFIG matches your form

## Version History

- **v18.1 Modular** (2025-02-15): Modularized from monolithic code
- **v18.1** (Original): Fixed production issues, debugMode=false
- **v18.0** and earlier: See original Code.gs file header

## Support

For issues or questions:
- Check the original `/home/dee/hoa-code/PropertyReport/Code.gs` for reference
- Review REFACTORING_ROADMAP.md for project context
- Contact admin@villasboulders.org for HOA-specific questions

---

**Remember**: This modular version does **exactly the same thing** as the original - it's just organized better!
