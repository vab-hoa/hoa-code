/**
 * Wood Trim Section Generator
 * Generates a Google Doc section for wood trim assessment data and photos
 *
 * Follows the standard report section format - see REPORT_FORMAT_GUIDE.md
 */

// Photo sizing constants for 2 photos per page
var WOODTRIM_PHOTO_MAX_WIDTH = 350;   // ~4.9 inches
var WOODTRIM_PHOTO_MAX_HEIGHT = 250;  // ~3.5 inches - allows 2 per page with captions

function generateSectionWoodTrim(address, displayAddress, data) {
  const sectionLabel = 'Wood Trim Evaluation';
  console.log('Generating Wood Trim section for ' + address);

  try {
    const reportsFolder = DriveApp.getFolderById(REPORT_CONFIG.reportsFolderId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const docName = 'Report_' + address + '_woodTrim_' + dateStr;
    const doc = DocumentApp.create(docName);
    DriveApp.getFileById(doc.getId()).moveTo(reportsFolder);
    const body = doc.getBody();

    // Set default font
    body.setFontFamily('Arial');

    // === PAGE 1: Header and Data Table ===

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

    // Assessment Data Section
    if (data.woodTrim && data.woodTrim.rows.length > 0) {
      body.appendParagraph('Assessment Summary')
        .setHeading(DocumentApp.ParagraphHeading.HEADING3)
        .setForegroundColor('#1a3c5e');

      body.appendParagraph('Data shown for entire building (' + (data.buildingAddress || displayAddress) + ')')
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666');

      body.appendParagraph('');

      // Format wood trim data - collect photos for later
      var allPhotos = formatWoodTrimDataTable(body, data.woodTrim);

      // === PAGE 2+: Photos Section ===
      if (allPhotos && allPhotos.length > 0) {
        body.appendPageBreak();

        body.appendParagraph('Assessment Photos')
          .setHeading(DocumentApp.ParagraphHeading.HEADING2)
          .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
          .setForegroundColor('#1a3c5e');

        body.appendParagraph('');

        for (var i = 0; i < allPhotos.length; i++) {
          addWoodTrimPhoto(body, allPhotos[i], 'Photo ' + (i + 1));
        }
      }

    } else {
      body.appendParagraph('No wood trim assessment records found for this property.')
        .setItalic(true)
        .setForegroundColor('#666666');
    }

    // Footer
    body.appendParagraph('');
    body.appendHorizontalRule();
    body.appendParagraph('Villas at the Boulders HOA')
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setFontSize(9)
      .setForegroundColor('#888888');

    doc.saveAndClose();

    var file = DriveApp.getFileById(doc.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = file.getUrl();
    console.log('Wood Trim section created: ' + url);
    return { label: sectionLabel, url: url };

  } catch (e) {
    console.error('Error generating Wood Trim section: ' + e.toString());
    throw e;
  }
}

/**
 * Format wood trim data as clean 2-column tables
 * Returns array of photo objects to be displayed after page break
 */
function formatWoodTrimDataTable(body, woodTrimData) {
  if (!woodTrimData || !woodTrimData.headers || !woodTrimData.rows) return [];

  var allPhotos = [];

  for (var r = 0; r < woodTrimData.rows.length; r++) {
    var row = woodTrimData.rows[r];

    if (r > 0) {
      body.appendParagraph('');
      body.appendHorizontalRule();
      body.appendParagraph('');
    }

    // Create a 2-column table for this record's data
    var table = body.appendTable();
    table.setBorderWidth(1);
    table.setBorderColor('#dddddd');

    // Collect non-empty, non-image fields (columns 1-10, skip column 0 which is often address)
    var fields = [];
    for (var c = 1; c < Math.min(11, woodTrimData.headers.length); c++) {
      var value = row[c];
      if (value) {
        fields.push({
          label: woodTrimData.headers[c] || 'Field ' + (c + 1),
          value: String(value)
        });
      }
    }

    // Add fields to table
    for (var f = 0; f < fields.length; f++) {
      var tableRow = table.appendTableRow();

      // Label cell (gray background)
      var labelCell = tableRow.appendTableCell(fields[f].label);
      labelCell.setWidth(150);
      labelCell.setBackgroundColor('#f5f5f5');
      labelCell.getChild(0).asParagraph()
        .setBold(true)
        .setFontSize(10)
        .setForegroundColor('#333333');
      labelCell.setPaddingTop(6);
      labelCell.setPaddingBottom(6);
      labelCell.setPaddingLeft(8);
      labelCell.setPaddingRight(8);

      // Value cell
      var valueCell = tableRow.appendTableCell(fields[f].value);
      valueCell.getChild(0).asParagraph()
        .setFontSize(10)
        .setForegroundColor('#333333');
      valueCell.setPaddingTop(6);
      valueCell.setPaddingBottom(6);
      valueCell.setPaddingLeft(8);
      valueCell.setPaddingRight(8);
    }

    // Collect photos from columns 11+ for display after page break
    for (var imgCol = 11; imgCol < woodTrimData.headers.length; imgCol++) {
      var cellValue = row[imgCol];
      if (cellValue && typeof cellValue === 'string') {
        var fileId = extractDriveFileId(cellValue);
        if (fileId) {
          allPhotos.push({
            fileId: fileId,
            label: woodTrimData.headers[imgCol] || 'Photo',
            recordIndex: r + 1
          });
        }
      }
    }
  }

  return allPhotos;
}

/**
 * Add a single wood trim photo with caption, sized for 2 per page
 */
function addWoodTrimPhoto(body, photo, caption) {
  try {
    var imageFile = DriveApp.getFileById(photo.fileId);
    var imageBlob = imageFile.getBlob();
    var convertedBlob = convertHeifToJpeg(imageBlob, 'woodtrim_photo.jpg');

    if (convertedBlob) {
      var inlineImage = body.appendImage(convertedBlob);

      // Get original dimensions
      var width = inlineImage.getWidth();
      var height = inlineImage.getHeight();

      // Scale to fit within max bounds while maintaining aspect ratio
      var widthRatio = WOODTRIM_PHOTO_MAX_WIDTH / width;
      var heightRatio = WOODTRIM_PHOTO_MAX_HEIGHT / height;
      var ratio = Math.min(widthRatio, heightRatio, 1); // Don't scale up

      if (ratio < 1) {
        inlineImage.setWidth(Math.round(width * ratio));
        inlineImage.setHeight(Math.round(height * ratio));
      }

      // Caption with photo label info
      var captionText = caption;
      if (photo.label && photo.label !== 'Photo') {
        captionText += ' - ' + photo.label;
      }

      body.appendParagraph(captionText)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666')
        .setSpacingAfter(12);

    } else {
      body.appendParagraph('[HEIF image could not be displayed]')
        .setItalic(true)
        .setForegroundColor('#999999');
    }
  } catch (error) {
    console.error('Error adding wood trim photo: ' + error.toString());
    body.appendParagraph('[Could not load image]')
      .setItalic(true)
      .setForegroundColor('#999999');
  }
}
