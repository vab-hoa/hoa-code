/**
 * Concrete & Asphalt Section Generator
 * Displays photos from the concrete photos Drive folder if available,
 * otherwise shows repair history from spreadsheet.
 */

var CONCRETE_PHOTOS_FOLDER_ID = '10GaFTxR4uFw-KoAOSLVq-VfL9rJsxP8K';
var CONCRETE_PHOTO_MAX_WIDTH = 300;
var CONCRETE_PHOTO_MAX_HEIGHT = 250;

function generateSectionConcrete(address, displayAddress, data) {
  const sectionLabel = 'Concrete & Asphalt Repair History';
  console.log('Generating Concrete section for ' + address);

  try {
    const reportsFolder = DriveApp.getFolderById(REPORT_CONFIG.reportsFolderId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const docName = 'Report_' + address + '_concrete_' + dateStr;
    const doc = DocumentApp.create(docName);
    DriveApp.getFileById(doc.getId()).moveTo(reportsFolder);
    const body = doc.getBody();

    body.setFontFamily('Arial');

    // Header
    body.appendParagraph(sectionLabel)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setForegroundColor('#1a3c5e');
    body.appendParagraph(displayAddress)
      .setHeading(DocumentApp.ParagraphHeading.HEADING2)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setForegroundColor('#555555');
    body.appendParagraph('Generated: ' + new Date().toLocaleString('en-US', {timeZone: 'America/Denver'}))
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setFontSize(10)
      .setForegroundColor('#888888');

    body.appendParagraph('');

    // Try to find and display photos from Drive folder
    var photosDisplayed = displayConcretePhotosFromDrive(body, address);

    // If no photos found, show spreadsheet data
    if (!photosDisplayed) {
      var unitRecords = loadConcreteRecords(address);

      if (unitRecords.length > 0) {
        body.appendParagraph('Repair Records')
          .setHeading(DocumentApp.ParagraphHeading.HEADING3)
          .setForegroundColor('#1a3c5e');

        body.appendParagraph('Concrete and asphalt work scheduled or completed at this unit.')
          .setFontSize(9)
          .setItalic(true)
          .setForegroundColor('#666666');

        body.appendParagraph('');

        var table = body.appendTable();
        table.setBorderWidth(1);
        table.setBorderColor('#dddddd');

        var hdr = table.appendTableRow();
        ['Year', 'Location', 'Work', 'Source', 'Severity Notes'].forEach(function(label) {
          var cell = hdr.appendTableCell(label);
          cell.setBackgroundColor('#1a3c5e');
          cell.getChild(0).asParagraph()
            .setBold(true).setFontSize(10).setForegroundColor('#ffffff');
          cell.setPaddingTop(6); cell.setPaddingBottom(6);
          cell.setPaddingLeft(8); cell.setPaddingRight(8);
        });

        for (var i = 0; i < unitRecords.length; i++) {
          var rec = unitRecords[i];
          var dataRow = table.appendTableRow();
          var bg = (i % 2 === 0) ? '#ffffff' : '#f8f8f8';
          [rec.year, rec.location, rec.work, rec.source, rec.severity].forEach(function(val) {
            var cell = dataRow.appendTableCell(val || '');
            cell.setBackgroundColor(bg);
            cell.getChild(0).asParagraph()
              .setFontSize(10).setForegroundColor('#333333');
            cell.setPaddingTop(5); cell.setPaddingBottom(5);
            cell.setPaddingLeft(8); cell.setPaddingRight(8);
          });
        }
      } else {
        body.appendParagraph('No concrete or asphalt repair photos or records on file for this property.')
          .setItalic(true)
          .setForegroundColor('#666666');
      }
    }

    body.appendParagraph('');
    body.appendParagraph(
      'For questions about concrete and asphalt repairs, contact manager@villasboulders.org.'
    ).setFontSize(9).setItalic(true).setForegroundColor('#888888');

    body.appendParagraph('');
    body.appendHorizontalRule();
    body.appendParagraph('Villas at the Boulders HOA')
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setFontSize(9).setForegroundColor('#888888');

    doc.saveAndClose();

    var file = DriveApp.getFileById(doc.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = file.getUrl();
    console.log('Concrete section created: ' + url);
    return { label: sectionLabel, url: url };

  } catch (e) {
    console.error('Error generating Concrete section: ' + e.toString());
    throw e;
  }
}

/**
 * Look for a folder matching the property address in the concrete photos directory.
 * If found, displays photos in a 2-column layout.
 * Returns true if photos were displayed, false otherwise.
 */
function displayConcretePhotosFromDrive(body, address) {
  try {
    var parentFolder = DriveApp.getFolderById(CONCRETE_PHOTOS_FOLDER_ID);
    var childFolders = parentFolder.getFolders();

    var addressFolder = null;
    while (childFolders.hasNext()) {
      var folder = childFolders.next();
      // Match standard form (e.g., 13737RP2)
      if (folder.getName() === address) {
        addressFolder = folder;
        break;
      }
    }

    if (!addressFolder) {
      console.log('No concrete photos folder found for ' + address);
      return false;
    }

    // Collect all image files from the folder
    var photoFiles = [];
    var files = addressFolder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var mimeType = file.getMimeType();
      if (mimeType.indexOf('image') === 0 ||
          mimeType === 'image/heic' ||
          mimeType === 'image/heif') {
        photoFiles.push(file);
      }
    }

    if (photoFiles.length === 0) {
      console.log('No image files found in concrete photos folder for ' + address);
      return false;
    }

    console.log('Found ' + photoFiles.length + ' photos for ' + address);

    // Display photos in 2-column table
    body.appendParagraph('Repair Site Photos')
      .setHeading(DocumentApp.ParagraphHeading.HEADING3)
      .setForegroundColor('#1a3c5e');

    body.appendParagraph('Photos of concrete and asphalt repairs at this property.')
      .setFontSize(9)
      .setItalic(true)
      .setForegroundColor('#666666');

    body.appendParagraph('');

    // Create 2-column photo table
    displayPhotosIn2ColumnTableConcrete(body, photoFiles);

    return true;
  } catch (e) {
    console.error('Error displaying concrete photos: ' + e.toString());
    return false;
  }
}

/**
 * Display photos in a 2-column table layout
 */
function displayPhotosIn2ColumnTableConcrete(body, photoFiles) {
  if (!photoFiles || photoFiles.length === 0) return;

  var table = body.appendTable();
  table.setBorderWidth(0);
  table.setBorderColor('#ffffff');

  var colWidths = [300, 300];

  for (var i = 0; i < photoFiles.length; i += 2) {
    var tableRow = table.appendTableRow();

    // Left cell
    var leftCell = tableRow.appendTableCell('');
    leftCell.setWidth(colWidths[0]);
    leftCell.setPaddingTop(10);
    leftCell.setPaddingBottom(10);
    leftCell.setPaddingLeft(5);
    leftCell.setPaddingRight(5);

    addPhotoCellConcrete(leftCell, photoFiles[i]);

    // Right cell
    var rightCell = tableRow.appendTableCell('');
    rightCell.setWidth(colWidths[1]);
    rightCell.setPaddingTop(10);
    rightCell.setPaddingBottom(10);
    rightCell.setPaddingLeft(5);
    rightCell.setPaddingRight(5);

    if (i + 1 < photoFiles.length) {
      addPhotoCellConcrete(rightCell, photoFiles[i + 1]);
    }
  }
}

/**
 * Add a single photo to a table cell
 */
function addPhotoCellConcrete(cell, photoFile) {
  if (!photoFile) return;

  try {
    var imageBlob = photoFile.getBlob();
    var mimeType = photoFile.getMimeType();

    // Convert HEIF/HEIC if needed
    var convertedBlob = imageBlob;
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      convertedBlob = convertHeifToJpeg(imageBlob, photoFile.getName());
    }

    if (!convertedBlob) {
      convertedBlob = imageBlob;
    }

    var paragraph = cell.getChild(0);
    if (paragraph.getType() === DocumentApp.ElementType.PARAGRAPH) {
      paragraph.clear();
    }

    var inlineImage = cell.appendImage(convertedBlob);
    inlineImage.setWidth(CONCRETE_PHOTO_MAX_WIDTH);
    inlineImage.setHeight(CONCRETE_PHOTO_MAX_HEIGHT);

    // Add filename as caption
    var caption = cell.appendParagraph(photoFile.getName());
    caption.setFontSize(9);
    caption.setForegroundColor('#666666');
    caption.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  } catch (e) {
    console.error('Error adding photo ' + photoFile.getName() + ': ' + e.toString());
  }
}

// Hardcoded so this file works independently of any cached Code.js version
var CONCRETE_SHEET_ID = '1lW1CwzKp0uQuBce2MozmZtuPQV3Gp6mkTiGjR8KM2Bs';

function loadConcreteRecords(address) {
  try {
    var targetStd = HOALibrary.standardizeHOAAddress(address);
    var ss = SpreadsheetApp.openById(CONCRETE_SHEET_ID);
    var sheet = ss.getSheetByName('Scheduled Work');
    if (!sheet) return [];

    var rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return [];

    var h = rows[0];
    function colIdx(name) {
      var n = name.toLowerCase();
      for (var i = 0; i < h.length; i++) {
        if (h[i].toString().toLowerCase() === n) return i;
      }
      return -1;
    }

    var yearCol     = colIdx('year');
    var addrCol     = colIdx('address');
    var locCol      = colIdx('location');
    var workCol     = colIdx('work');
    var sourceCol   = colIdx('source');
    var severityCol = colIdx('severity');

    var results = [];
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[addrCol]) continue;
      var rowStd = HOALibrary.standardizeHOAAddress(String(row[addrCol]));
      if (rowStd === targetStd) {
        results.push({
          year:     String(row[yearCol]     || '').trim(),
          location: String(row[locCol]      || '').trim(),
          work:     String(row[workCol]     || '').trim(),
          source:   String(row[sourceCol]   || '').trim(),
          severity: String(row[severityCol] || '').trim()
        });
      }
    }
    console.log('Concrete records for ' + targetStd + ': ' + results.length);
    return results;
  } catch (e) {
    console.error('Error loading concrete records: ' + e.toString());
    return [];
  }
}
