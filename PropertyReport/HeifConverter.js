/**
 * HEIF to JPEG Converter for Wood Trim Spreadsheet
 *
 * This script:
 * 1. Creates a backup copy of the Wood Trim spreadsheet
 * 2. Finds all HEIF/HEIC photo links in columns 12+
 * 3. Converts each HEIF to JPEG using Drive's thumbnail API
 * 4. Updates the links in the copy to point to new JPEGs
 *
 * Run convertWoodTrimHeifPhotos() to execute.
 */

// Configuration
var HEIF_CONVERTER_CONFIG = {
  // Source spreadsheet (Wood Trim evaluation)
  sourceSheetId: '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE',

  // Sheet name to process (leave blank for first sheet)
  sheetName: '',

  // First column with photo links (1-indexed, column L = 12)
  photoStartColumn: 12,

  // Folder to store converted JPEGs (will be created if needed)
  convertedFolderName: 'Wood Trim Photos - Converted JPEGs',

  // Dry run mode - set to true to preview without making changes
  dryRun: false
};

/**
 * Main function - converts HEIF photos and updates spreadsheet copy
 */
function convertWoodTrimHeifPhotos() {
  console.log('=== HEIF Photo Converter ===');
  console.log('Dry run mode: ' + HEIF_CONVERTER_CONFIG.dryRun);

  try {
    // Step 1: Open source spreadsheet
    var sourceSpreadsheet = SpreadsheetApp.openById(HEIF_CONVERTER_CONFIG.sourceSheetId);
    console.log('Source spreadsheet: ' + sourceSpreadsheet.getName());

    // Step 2: Create backup copy
    var copyName = sourceSpreadsheet.getName() + ' - JPEG Converted ' +
                   new Date().toISOString().slice(0, 10);

    var copy;
    if (HEIF_CONVERTER_CONFIG.dryRun) {
      console.log('[DRY RUN] Would create copy: ' + copyName);
      copy = sourceSpreadsheet; // Use original for dry run analysis
    } else {
      copy = sourceSpreadsheet.copy(copyName);
      console.log('Created backup copy: ' + copyName);
      console.log('Copy ID: ' + copy.getId());
    }

    // Step 3: Get or create folder for converted JPEGs
    var convertedFolder;
    if (!HEIF_CONVERTER_CONFIG.dryRun) {
      convertedFolder = getOrCreateFolder(HEIF_CONVERTER_CONFIG.convertedFolderName);
      console.log('Converted photos folder: ' + convertedFolder.getName());
    }

    // Step 4: Get the sheet to process
    var sheet;
    if (HEIF_CONVERTER_CONFIG.sheetName) {
      sheet = copy.getSheetByName(HEIF_CONVERTER_CONFIG.sheetName);
    } else {
      sheet = copy.getSheets()[0];
    }
    console.log('Processing sheet: ' + sheet.getName());

    // Step 5: Get all data
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    console.log('Total rows: ' + data.length);
    console.log('Total columns: ' + headers.length);

    // Step 6: Find and process HEIF photos
    var stats = {
      totalCells: 0,
      heifFound: 0,
      converted: 0,
      failed: 0,
      skipped: 0
    };

    var updates = []; // Track cells to update

    for (var row = 1; row < data.length; row++) { // Skip header
      for (var col = HEIF_CONVERTER_CONFIG.photoStartColumn - 1; col < data[row].length; col++) {
        var cellValue = data[row][col];
        if (!cellValue || typeof cellValue !== 'string') continue;

        stats.totalCells++;

        // Check if this is a Drive link
        var fileId = extractFileIdFromUrl(cellValue);
        if (!fileId) continue;

        // Check if it's a HEIF file
        try {
          var file = DriveApp.getFileById(fileId);
          var mimeType = file.getMimeType();
          var fileName = file.getName();

          var isHeif = mimeType.includes('heif') ||
                       mimeType.includes('heic') ||
                       fileName.toLowerCase().endsWith('.heif') ||
                       fileName.toLowerCase().endsWith('.heic');

          if (!isHeif) {
            stats.skipped++;
            continue;
          }

          stats.heifFound++;
          console.log('Found HEIF: Row ' + (row + 1) + ', Col ' + (col + 1) + ': ' + fileName);

          if (HEIF_CONVERTER_CONFIG.dryRun) {
            console.log('[DRY RUN] Would convert: ' + fileName);
            continue;
          }

          // Convert to JPEG
          var jpegFile = convertHeifToJpegFile(file, convertedFolder);

          if (jpegFile) {
            var newUrl = 'https://drive.google.com/file/d/' + jpegFile.getId() + '/view';
            updates.push({
              row: row + 1, // 1-indexed for Sheets
              col: col + 1,
              oldUrl: cellValue,
              newUrl: newUrl,
              fileName: jpegFile.getName()
            });
            stats.converted++;
            console.log('  → Converted to: ' + jpegFile.getName());
          } else {
            stats.failed++;
            console.log('  → FAILED to convert');
          }

        } catch (e) {
          console.log('Error processing cell [' + (row + 1) + ',' + (col + 1) + ']: ' + e.toString());
          stats.failed++;
        }
      }
    }

    // Step 7: Update the spreadsheet with new URLs
    if (!HEIF_CONVERTER_CONFIG.dryRun && updates.length > 0) {
      console.log('Updating ' + updates.length + ' cells in spreadsheet...');
      for (var i = 0; i < updates.length; i++) {
        var update = updates[i];
        sheet.getRange(update.row, update.col).setValue(update.newUrl);
      }
      console.log('Spreadsheet updated successfully');
    }

    // Step 8: Report results
    console.log('');
    console.log('=== Conversion Complete ===');
    console.log('Total cells scanned: ' + stats.totalCells);
    console.log('HEIF files found: ' + stats.heifFound);
    console.log('Successfully converted: ' + stats.converted);
    console.log('Failed to convert: ' + stats.failed);
    console.log('Non-HEIF skipped: ' + stats.skipped);

    if (!HEIF_CONVERTER_CONFIG.dryRun) {
      console.log('');
      console.log('New spreadsheet URL: ' + copy.getUrl());
      console.log('Converted photos folder: ' + convertedFolder.getUrl());
    }

    return {
      success: true,
      stats: stats,
      copyUrl: HEIF_CONVERTER_CONFIG.dryRun ? null : copy.getUrl(),
      folderUrl: HEIF_CONVERTER_CONFIG.dryRun ? null : convertedFolder.getUrl()
    };

  } catch (e) {
    console.error('Fatal error: ' + e.toString());
    console.error(e.stack);
    return { success: false, error: e.toString() };
  }
}

/**
 * Convert a HEIF file to JPEG using Drive's thumbnail API
 * This works because Google generates JPEG thumbnails for HEIF files
 */
function convertHeifToJpegFile(heifFile, destFolder) {
  try {
    var fileId = heifFile.getId();
    var fileName = heifFile.getName();

    // Method 1: Try to get high-res thumbnail from Drive API
    // Google generates thumbnails for most image types including HEIF
    var thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w2000';

    var response = UrlFetchApp.fetch(thumbnailUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      var blob = response.getBlob();

      // Check if we got a real image
      var contentType = blob.getContentType();
      if (contentType && contentType.startsWith('image/')) {
        // Create new filename
        var jpegName = fileName.replace(/\.(heif|heic)$/i, '.jpg');
        if (jpegName === fileName) {
          jpegName = fileName + '.jpg';
        }

        blob.setName(jpegName);

        // Save to destination folder
        var jpegFile = destFolder.createFile(blob);
        jpegFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return jpegFile;
      }
    }

    // Method 2: Try export link (sometimes works for images)
    var exportUrl = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';

    response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      var blob = response.getBlob();
      // Even if we get the original HEIF, Google Docs might be able to use it
      // via the preview system. But this usually won't help.
      console.log('  Got raw file, but cannot convert HEIF in Apps Script');
    }

    console.log('  Thumbnail method failed for: ' + fileName);
    return null;

  } catch (e) {
    console.error('Error converting ' + heifFile.getName() + ': ' + e.toString());
    return null;
  }
}

/**
 * Extract file ID from various Google Drive URL formats
 */
function extractFileIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // Pattern: /d/FILE_ID/
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Pattern: id=FILE_ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Pattern: /file/d/FILE_ID
  match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Direct file ID (25+ chars, alphanumeric with dashes/underscores)
  if (url.match(/^[a-zA-Z0-9_-]{25,}$/)) return url;

  return null;
}

/**
 * Get or create a folder by name
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Preview what would be converted (dry run)
 */
function previewHeifConversion() {
  HEIF_CONVERTER_CONFIG.dryRun = true;
  return convertWoodTrimHeifPhotos();
}

/**
 * Run the actual conversion
 */
function runHeifConversion() {
  HEIF_CONVERTER_CONFIG.dryRun = false;
  return convertWoodTrimHeifPhotos();
}
