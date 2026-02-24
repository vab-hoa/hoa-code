/**
 * Gutters Section Generator
 * Generates a Google Doc section for gutter maintenance records and photos
 *
 * Follows the standard report section format - see REPORT_FORMAT_GUIDE.md
 */

// Photo sizing constants for 2 photos per page
var PHOTO_MAX_WIDTH = 350;   // ~4.9 inches
var PHOTO_MAX_HEIGHT = 250;  // ~3.5 inches - allows 2 per page with captions

function generateSectionGutters(address, displayAddress, data) {
  const sectionLabel = 'Gutter Cleaning & Inspection';
  console.log('Generating Gutters section for ' + address);

  try {
    const reportsFolder = DriveApp.getFolderById(REPORT_CONFIG.reportsFolderId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const docName = 'Report_' + address + '_gutters_' + dateStr;
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

    // Inspection Data Section
    if (data.gutters && data.gutters.rows.length > 0) {
      body.appendParagraph('Inspection Summary')
        .setHeading(DocumentApp.ParagraphHeading.HEADING3)
        .setForegroundColor('#1a3c5e');

      body.appendParagraph('Data shown for entire building (' + (data.buildingAddress || displayAddress) + ')')
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666');

      body.appendParagraph('');

      // Format gutter data as a clean table
      formatGutterDataTable(body, data.gutters);

    } else {
      body.appendParagraph('No gutter maintenance records found for this property.')
        .setItalic(true)
        .setForegroundColor('#666666');
    }

    // === PAGE 2+: Photos Section ===
    var hasPhotos = data.gutterFolderImages &&
        (data.gutterFolderImages.unitImages.length > 0 || data.gutterFolderImages.buildingImages.length > 0);

    if (hasPhotos) {
      // Force page break before photos
      body.appendPageBreak();

      body.appendParagraph('Inspection Photos')
        .setHeading(DocumentApp.ParagraphHeading.HEADING2)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setForegroundColor('#1a3c5e');

      body.appendParagraph('');

      formatGutterPhotos(body, data.gutterFolderImages);
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
    console.log('Gutters section created: ' + url);
    return { label: sectionLabel, url: url };

  } catch (e) {
    console.error('Error generating Gutters section: ' + e.toString());
    throw e;
  }
}

/**
 * Format gutter inspection data as a clean 2-column table
 */
function formatGutterDataTable(body, gutterData) {
  if (!gutterData || !gutterData.headers || !gutterData.rows) return;

  for (var r = 0; r < gutterData.rows.length; r++) {
    var row = gutterData.rows[r];

    if (r > 0) {
      body.appendParagraph('');
      body.appendHorizontalRule();
      body.appendParagraph('');
    }

    // Create a 2-column table for this record's data
    var table = body.appendTable();
    table.setBorderWidth(1);
    table.setBorderColor('#dddddd');

    // Collect non-empty, non-image fields
    var fields = [];
    for (var c = 2; c < gutterData.headers.length; c++) {
      var value = row[c];
      if (value && typeof value === 'string') {
        // Skip image URLs - handled separately
        if (value.includes('drive.google.com') || value.match(/\.(jpg|jpeg|png|heif|heic)$/i)) {
          continue;
        }
      }
      if (value) {
        fields.push({
          label: gutterData.headers[c] || 'Field ' + (c + 1),
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
  }
}

/**
 * Format gutter photos - sized for 2 per page
 */
function formatGutterPhotos(body, gutterImages) {
  if (!gutterImages) return;

  var photoCount = 0;

  // Unit-specific photos
  if (gutterImages.unitImages && gutterImages.unitImages.length > 0) {
    body.appendParagraph('Unit: ' + (gutterImages.unitFolderName || 'Your Unit'))
      .setBold(true)
      .setFontSize(11)
      .setForegroundColor('#1a3c5e');

    body.appendParagraph('');

    for (var i = 0; i < gutterImages.unitImages.length; i++) {
      var image = gutterImages.unitImages[i];
      photoCount++;
      addPhotoWithCaption(body, image, 'Photo ' + photoCount);
    }
  }

  // Building photos
  if (gutterImages.buildingImages && gutterImages.buildingImages.length > 0) {
    if (gutterImages.unitImages && gutterImages.unitImages.length > 0) {
      body.appendParagraph('');
    }

    body.appendParagraph('Building: ' + (gutterImages.buildingFolderName || 'Common Areas'))
      .setBold(true)
      .setFontSize(11)
      .setForegroundColor('#1a3c5e');

    body.appendParagraph('');

    for (var i = 0; i < gutterImages.buildingImages.length; i++) {
      var image = gutterImages.buildingImages[i];
      photoCount++;
      addPhotoWithCaption(body, image, 'Photo ' + photoCount);
    }
  }
}

/**
 * Add a single photo with caption, sized for 2 per page
 */
function addPhotoWithCaption(body, image, caption) {
  try {
    var imageFile = DriveApp.getFileById(image.fileId);
    var imageBlob = imageFile.getBlob();
    var convertedBlob = convertHeifToJpeg(imageBlob, image.name);

    if (convertedBlob) {
      var inlineImage = body.appendImage(convertedBlob);

      // Get original dimensions
      var width = inlineImage.getWidth();
      var height = inlineImage.getHeight();

      // Scale to fit within max bounds while maintaining aspect ratio
      var widthRatio = PHOTO_MAX_WIDTH / width;
      var heightRatio = PHOTO_MAX_HEIGHT / height;
      var ratio = Math.min(widthRatio, heightRatio, 1); // Don't scale up

      if (ratio < 1) {
        inlineImage.setWidth(Math.round(width * ratio));
        inlineImage.setHeight(Math.round(height * ratio));
      }

      // Caption
      body.appendParagraph(caption)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666')
        .setSpacingAfter(12);
    }
  } catch (error) {
    console.error('Error adding photo: ' + error.toString());
    body.appendParagraph('[Could not load image]')
      .setItalic(true)
      .setForegroundColor('#999999');
  }
}
