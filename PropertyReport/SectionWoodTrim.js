/**
 * Wood Trim Section Generator
 * Generates a Google Doc section for wood trim assessment data and photos
 *
 * Follows the standard report section format - see REPORT_FORMAT_GUIDE.md
 * Phase 2: Narrative paragraphs + 2-column photo table layout
 */

// Photo sizing constants for 2-column table layout
var WOODTRIM_PHOTO_MAX_WIDTH = 300;   // ~4.2 inches per column (fits 2 in 8.5" page)
var WOODTRIM_PHOTO_MAX_HEIGHT = 250;  // ~3.5 inches - maintains aspect ratio

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

    // === PAGE 1: Header and Narrative ===

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
    var allPhotos = [];
    var narrativeData = null;

    if (data.woodTrim && data.woodTrim.rows.length > 0) {
      // Extract narrative data and photos from spreadsheet
      var result = buildWoodTrimNarrative(body, data.woodTrim);
      allPhotos = result.photos;
      narrativeData = result.narrative;

      // === PAGE 2+: Photos Section ===
      if (allPhotos && allPhotos.length > 0) {
        body.appendPageBreak();

        body.appendParagraph('Assessment Photos')
          .setHeading(DocumentApp.ParagraphHeading.HEADING2)
          .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
          .setForegroundColor('#1a3c5e');

        body.appendParagraph('');

        // Display photos in 2-column table layout
        displayPhotosIn2ColumnTable(body, allPhotos);
      }

    } else {
      body.appendParagraph('No wood trim assessment records found for this property.')
        .setItalic(true)
        .setForegroundColor('#666666');
    }

    // Folder-based photos — only if no spreadsheet photos (to avoid duplicates)
    if (!allPhotos || allPhotos.length === 0) {
      var hasFolderPhotos = data.woodTrimFolderImages &&
          (data.woodTrimFolderImages.unitImages.length > 0 || data.woodTrimFolderImages.buildingImages.length > 0);

      if (hasFolderPhotos) {
        body.appendPageBreak();

        body.appendParagraph('Site Photos')
          .setHeading(DocumentApp.ParagraphHeading.HEADING2)
          .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
          .setForegroundColor('#1a3c5e');

        body.appendParagraph('');

        formatWoodTrimFolderPhotos(body, data.woodTrimFolderImages);
      }
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
 * Build narrative paragraphs and extract photos from wood trim data
 * Returns {photos: [], narrative: {trimRepair: [], trimReplacement: []}}
 */
function buildWoodTrimNarrative(body, woodTrimData) {
  if (!woodTrimData || !woodTrimData.headers || !woodTrimData.rows) {
    return { photos: [], narrative: { trimRepair: [], trimReplacement: [] } };
  }

  var allPhotos = [];
  var trimRepairPhotos = [];
  var trimReplacementPhotos = [];
  var photoCounter = 1;

  // Find column indices for the two special columns
  var trimRepairColIndex = -1;
  var trimReplacementColIndex = -1;

  for (var c = 0; c < woodTrimData.headers.length; c++) {
    var header = String(woodTrimData.headers[c] || '').toLowerCase();
    if (header.includes('trim repair') && header.includes('sand') && header.includes('paint')) {
      trimRepairColIndex = c;
    }
    if (header.includes('trim replacement')) {
      trimReplacementColIndex = c;
    }
  }

  console.log('Found trim repair column at index: ' + trimRepairColIndex);
  console.log('Found trim replacement column at index: ' + trimReplacementColIndex);

  // Process each row
  for (var r = 0; r < woodTrimData.rows.length; r++) {
    var row = woodTrimData.rows[r];

    // Extract photo numbers from the two special columns
    if (trimRepairColIndex >= 0 && row[trimRepairColIndex]) {
      var repairPhotos = extractPhotoNumbers(String(row[trimRepairColIndex]));
      trimRepairPhotos = trimRepairPhotos.concat(repairPhotos);
      console.log('Row ' + r + ' trim repair photos: ' + repairPhotos.join(', '));
    }

    if (trimReplacementColIndex >= 0 && row[trimReplacementColIndex]) {
      var replacementPhotos = extractPhotoNumbers(String(row[trimReplacementColIndex]));
      trimReplacementPhotos = trimReplacementPhotos.concat(replacementPhotos);
      console.log('Row ' + r + ' trim replacement photos: ' + replacementPhotos.join(', '));
    }

    // Collect all image column references (excluding the two special narrative columns)
    for (var imgCol = 0; imgCol < woodTrimData.headers.length; imgCol++) {
      // Skip the narrative columns
      if (imgCol === trimRepairColIndex || imgCol === trimReplacementColIndex) continue;

      var cellValue = row[imgCol];
      if (cellValue && typeof cellValue === 'string') {
        var fileId = extractDriveFileId(cellValue);
        if (fileId) {
          allPhotos.push({
            fileId: fileId,
            label: woodTrimData.headers[imgCol] || 'Photo',
            photoNumber: photoCounter,
            recordIndex: r + 1
          });
          photoCounter++;
        }
      }
    }
  }

  // Remove duplicates from photo number lists
  trimRepairPhotos = trimRepairPhotos.filter(function(item, pos) {
    return trimRepairPhotos.indexOf(item) === pos;
  }).sort(function(a, b) { return a - b; });

  trimReplacementPhotos = trimReplacementPhotos.filter(function(item, pos) {
    return trimReplacementPhotos.indexOf(item) === pos;
  }).sort(function(a, b) { return a - b; });

  // Build and display the three narrative paragraphs
  body.appendParagraph('Assessment Summary')
    .setHeading(DocumentApp.ParagraphHeading.HEADING3)
    .setForegroundColor('#1a3c5e');

  body.appendParagraph('Data shown for entire building')
    .setFontSize(9)
    .setItalic(true)
    .setForegroundColor('#666666');

  body.appendParagraph('');

  // Paragraph 1: Photo categorization
  var para1Text = 'These are photographs taken by volunteers of potential issues with the trim on this unit. ' +
    'The photos have been initially divided (by inspection of the photos) into those which can probably be repaired, ' +
    'and those which will probably require board replacement. ';

  if (trimRepairPhotos.length > 0) {
    para1Text += 'These photos appear to have issues which can probably be repaired by sanding, caulking and painting: ' +
      trimRepairPhotos.join(', ') + '. ';
  }

  if (trimReplacementPhotos.length > 0) {
    para1Text += 'These photos appear to require full or partial board replacement: ' +
      trimReplacementPhotos.join(', ') + '.';
  }

  body.appendParagraph(para1Text)
    .setFontSize(11)
    .setForegroundColor('#333333')
    .setSpacingAfter(12);

  // Paragraph 2: RFP and contractor work
  var para2Text = 'An RFP has been issued by the board for bids from contractors to undertake the board replacement ' +
    'portion of this task. Depending on the responses, and the costs, we will likely contract for that work, which is ' +
    'more urgent, to begin. As the contractors work they will be better able to evaluate the condition of other boards ' +
    'than volunteers were able to do from the ground, and may recommend change orders to the contract as the work proceeds.';

  body.appendParagraph(para2Text)
    .setFontSize(11)
    .setForegroundColor('#333333')
    .setSpacingAfter(12);

  // Paragraph 3: Repair timeline
  var para3Text = 'The Trim Repair section is less urgent, and some part of those repairs can probably be done either ' +
    'by volunteers (if they are close to the ground), or by the handyman contractors. Some will have to be done in another ' +
    'round of General Contractor work in following years.';

  body.appendParagraph(para3Text)
    .setFontSize(11)
    .setForegroundColor('#333333')
    .setSpacingAfter(12);

  body.appendParagraph('');

  return {
    photos: allPhotos,
    narrative: {
      trimRepair: trimRepairPhotos,
      trimReplacement: trimReplacementPhotos
    }
  };
}

/**
 * Extract photo numbers from text (handles "1, 2, 3" or "1 2 3" or mixed formats)
 */
function extractPhotoNumbers(text) {
  if (!text || typeof text !== 'string') return [];

  // Match all numbers in the text
  var matches = text.match(/\d+/g);
  if (!matches) return [];

  // Convert to integers and return
  return matches.map(function(n) { return parseInt(n); });
}

/**
 * Display photos in a 2-column table layout for responsive mobile viewing
 * Table structure: 2 columns, alternating images and captions
 */
function displayPhotosIn2ColumnTable(body, allPhotos) {
  if (!allPhotos || allPhotos.length === 0) return;

  // Create table with 2 columns
  var table = body.appendTable();
  table.setBorderWidth(0);
  table.setBorderColor('#ffffff');

  // Set column widths (equal columns, ~4.25" each for 8.5" page)
  var colWidths = [300, 300];

  // Process photos in pairs
  for (var i = 0; i < allPhotos.length; i += 2) {
    var tableRow = table.appendTableRow();

    // Left cell (photo + caption)
    var leftCell = tableRow.appendTableCell('');
    leftCell.setWidth(colWidths[0]);
    leftCell.setPaddingTop(10);
    leftCell.setPaddingBottom(10);
    leftCell.setPaddingLeft(5);
    leftCell.setPaddingRight(5);

    addPhotoToCell(leftCell, allPhotos[i]);

    // Right cell (photo + caption if exists)
    var rightCell = tableRow.appendTableCell('');
    rightCell.setWidth(colWidths[1]);
    rightCell.setPaddingTop(10);
    rightCell.setPaddingBottom(10);
    rightCell.setPaddingLeft(5);
    rightCell.setPaddingRight(5);

    if (i + 1 < allPhotos.length) {
      addPhotoToCell(rightCell, allPhotos[i + 1]);
    }
  }
}

/**
 * Add a single photo to a table cell with caption
 */
function addPhotoToCell(cell, photoData) {
  if (!photoData) return;

  try {
    var imageFile = DriveApp.getFileById(photoData.fileId);
    var imageBlob = imageFile.getBlob();
    var convertedBlob = convertHeifToJpeg(imageBlob, 'photo.jpg');

    if (convertedBlob) {
      // Clear cell and add image
      var paragraph = cell.getChild(0);
      if (paragraph.getType() === DocumentApp.ElementType.PARAGRAPH) {
        paragraph.clear();
      } else {
        paragraph = cell.appendParagraph('');
      }

      var inlineImage = cell.appendImage(convertedBlob);

      // Scale image to fit column width
      var width = inlineImage.getWidth();
      var height = inlineImage.getHeight();
      var widthRatio = WOODTRIM_PHOTO_MAX_WIDTH / width;
      var heightRatio = WOODTRIM_PHOTO_MAX_HEIGHT / height;
      var ratio = Math.min(widthRatio, heightRatio, 1);

      if (ratio < 1) {
        inlineImage.setWidth(Math.round(width * ratio));
        inlineImage.setHeight(Math.round(height * ratio));
      }

      // Add caption paragraph below image
      var captionPara = cell.appendParagraph(
        'Photo ' + photoData.photoNumber +
        (photoData.label && photoData.label !== 'Photo' ? ' - ' + photoData.label : '')
      );
      captionPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666')
        .setSpacingBefore(6)
        .setSpacingAfter(0);
    } else {
      var para = cell.appendParagraph('[HEIF image could not be displayed]');
      para.setItalic(true).setForegroundColor('#999999');
    }
  } catch (error) {
    console.error('Error adding photo to cell: ' + error.toString());
    var errorPara = cell.appendParagraph('[Could not load image]');
    errorPara.setItalic(true).setForegroundColor('#999999');
  }
}

/**
 * Format wood trim photos from Drive folder (unit + building)
 */
function formatWoodTrimFolderPhotos(body, folderImages) {
  if (!folderImages) return;
  var photoCount = 0;

  if (folderImages.unitImages && folderImages.unitImages.length > 0) {
    body.appendParagraph('Unit: ' + (folderImages.unitFolderName || 'Your Unit'))
      .setBold(true).setFontSize(11).setForegroundColor('#1a3c5e');
    body.appendParagraph('');
    for (var i = 0; i < folderImages.unitImages.length; i++) {
      photoCount++;
      addScaledPhoto_(body, folderImages.unitImages[i].fileId, 'Photo ' + photoCount);
    }
  }

  if (folderImages.buildingImages && folderImages.buildingImages.length > 0) {
    if (folderImages.unitImages && folderImages.unitImages.length > 0) {
      body.appendParagraph('');
    }
    body.appendParagraph('Building: ' + (folderImages.buildingFolderName || 'Common Areas'))
      .setBold(true).setFontSize(11).setForegroundColor('#1a3c5e');
    body.appendParagraph('');
    for (var i = 0; i < folderImages.buildingImages.length; i++) {
      photoCount++;
      addScaledPhoto_(body, folderImages.buildingImages[i].fileId, 'Photo ' + photoCount);
    }
  }
}

/**
 * Add a scaled photo with caption (shared by spreadsheet and folder photos)
 */
function addScaledPhoto_(body, fileId, captionText) {
  try {
    var imageFile = DriveApp.getFileById(fileId);
    var imageBlob = imageFile.getBlob();
    var convertedBlob = convertHeifToJpeg(imageBlob, 'photo.jpg');

    if (convertedBlob) {
      var inlineImage = body.appendImage(convertedBlob);
      var width = inlineImage.getWidth();
      var height = inlineImage.getHeight();
      var widthRatio = WOODTRIM_PHOTO_MAX_WIDTH / width;
      var heightRatio = WOODTRIM_PHOTO_MAX_HEIGHT / height;
      var ratio = Math.min(widthRatio, heightRatio, 1);
      if (ratio < 1) {
        inlineImage.setWidth(Math.round(width * ratio));
        inlineImage.setHeight(Math.round(height * ratio));
      }
      body.appendParagraph(captionText)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setFontSize(9).setItalic(true).setForegroundColor('#666666')
        .setSpacingAfter(12);
    } else {
      body.appendParagraph('[HEIF image could not be displayed]')
        .setItalic(true).setForegroundColor('#999999');
    }
  } catch (error) {
    console.error('Error adding photo: ' + error.toString());
    body.appendParagraph('[Could not load image]')
      .setItalic(true).setForegroundColor('#999999');
  }
}
