/**
 * Report Generation Module
 *
 * Handles the creation of PDF property reports from gathered data.
 *
 * Main workflow:
 * 1. generatePdfReport(): Creates a Google Doc with all report sections
 * 2. Adds Keystone data (profile, violations, work orders, arch reviews)
 * 3. Adds gutter maintenance data and photos
 * 4. Adds wood trim assessment data and photos
 * 5. Converts the document to PDF and returns it
 *
 * Helper functions handle special formatting for different data types:
 * - appendTableFromDataWithImages(): Handles gutters and wood trim with embedded images
 * - appendGutterFolderImages(): Adds photos from Drive folders
 * - appendTableFromData(): Generic table formatter
 * - appendWoodTrimData(): Legacy formatter for wood trim
 * - appendGutterData(): Legacy formatter for gutters
 */

function generatePdfReport(address, data) {
  console.log('generatePdfReport called with address: "' + address + '"');

  // Safety checks
  if (!address) {
    console.error('WARNING: No address provided to generatePdfReport');
    address = 'Unknown Address';
  }

  if (!data) {
    console.error('WARNING: No data provided to generatePdfReport');
    data = {
      standardizedAddress: '',
      buildingAddress: '',
      unitNumber: null,
      generatedAt: new Date().toLocaleString('en-US', {timeZone: 'America/Denver'}),
      gutters: null,
      woodTrim: null,
      keystone: null
    };
  }

  // Convert address to string and sanitize
  const sanitizedAddress = String(address).replace(/[\/\\:*?"<>|#]/g, '-');
  console.log('Sanitized address: "' + sanitizedAddress + '"');

  const docName = 'Property Report - ' + sanitizedAddress;
  console.log('Creating document with name: "' + docName + '"');

  const doc = DocumentApp.create(docName);
  const body = doc.getBody();

  // Title
  body.appendParagraph('Property Report')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Address info
  body.appendParagraph(address)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Show standardized format
  const addressInfo = 'Building: ' + (data.buildingAddress || 'Unknown') +
                     (data.unitNumber ? ' | Unit: ' + (data.unitNumber === '1' ? '101' : '102') : '');
  body.appendParagraph(addressInfo)
    .setFontSize(10)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('Generated: ' + (data.generatedAt || new Date().toLocaleString('en-US', {timeZone: 'America/Denver'})))
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendHorizontalRule();

  // Keystone Section
  if (data.keystone && (data.keystone.profile || data.keystone.violations.length > 0 ||
                        data.keystone.workOrders.length > 0 || data.keystone.archReviews.length > 0)) {
    body.appendParagraph('Keystone Property Management Data')
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);

    // Profile / Account Information
    if (data.keystone.profile) {
      body.appendParagraph('Account Information')
        .setBold(true)
        .setFontSize(12);

      var profile = data.keystone.profile;
      if (profile.accountNumber) {
        body.appendParagraph('Account Number: ' + profile.accountNumber).setIndentFirstLine(20);
      }
      if (profile.name) {
        body.appendParagraph('Name: ' + profile.name).setIndentFirstLine(20);
      }
      if (profile.phone) {
        body.appendParagraph('Phone: ' + profile.phone).setIndentFirstLine(20);
      }
      if (profile.email) {
        body.appendParagraph('Email: ' + profile.email).setIndentFirstLine(20);
      }
      body.appendParagraph('');
    }

    // Violations
    if (data.keystone.violations.length > 0) {
      body.appendParagraph('Violations (' + data.keystone.violations.length + ')')
        .setBold(true)
        .setFontSize(12);

      var violationTable = body.appendTable();
      var headerRow = violationTable.appendTableRow();
      headerRow.appendTableCell('Date').setBold(true);
      headerRow.appendTableCell('Description').setBold(true);
      headerRow.appendTableCell('Status').setBold(true);

      for (var v = 0; v < Math.min(data.keystone.violations.length, 50); v++) {
        var violation = data.keystone.violations[v];
        var vRow = violationTable.appendTableRow();
        vRow.appendTableCell(violation.date || '');
        vRow.appendTableCell(violation.description || '');
        vRow.appendTableCell(violation.status || '');
      }
      body.appendParagraph('');
    }

    // Work Orders
    if (data.keystone.workOrders.length > 0) {
      body.appendParagraph('Work Orders (' + data.keystone.workOrders.length + ')')
        .setBold(true)
        .setFontSize(12);

      var workOrderTable = body.appendTable();
      var woHeaderRow = workOrderTable.appendTableRow();
      woHeaderRow.appendTableCell('Date').setBold(true);
      woHeaderRow.appendTableCell('Description').setBold(true);
      woHeaderRow.appendTableCell('Status').setBold(true);
      woHeaderRow.appendTableCell('Type').setBold(true);

      for (var w = 0; w < Math.min(data.keystone.workOrders.length, 50); w++) {
        var workOrder = data.keystone.workOrders[w];
        var woRow = workOrderTable.appendTableRow();
        woRow.appendTableCell(workOrder.date || '');
        woRow.appendTableCell(workOrder.description || '');
        woRow.appendTableCell(workOrder.status || '');
        woRow.appendTableCell(workOrder.type || '');
      }
      body.appendParagraph('');
    }

    // Architectural Reviews
    if (data.keystone.archReviews.length > 0) {
      body.appendParagraph('Architectural Reviews (' + data.keystone.archReviews.length + ')')
        .setBold(true)
        .setFontSize(12);

      var archTable = body.appendTable();
      var archHeaderRow = archTable.appendTableRow();
      archHeaderRow.appendTableCell('Date').setBold(true);
      archHeaderRow.appendTableCell('Description').setBold(true);
      archHeaderRow.appendTableCell('Status').setBold(true);

      for (var a = 0; a < Math.min(data.keystone.archReviews.length, 50); a++) {
        var archReview = data.keystone.archReviews[a];
        var archRow = archTable.appendTableRow();
        archRow.appendTableCell(archReview.date || '');
        archRow.appendTableCell(archReview.description || '');
        archRow.appendTableCell(archReview.status || '');
      }
      body.appendParagraph('');
    }
  }

  // Gutters Section
  body.appendParagraph('Gutter Maintenance')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  if (data.gutters && data.gutters.rows.length > 0) {
    body.appendParagraph('Data shown for entire building (' + (data.buildingAddress || address) + ')')
      .setFontSize(10)
      .setItalic(true);
    appendTableFromDataWithImages(body, data.gutters, 'Gutters');
  } else {
    body.appendParagraph('No gutter maintenance records found.');
  }

  // Add gutter folder images
  if (data.gutterFolderImages) {
    appendGutterFolderImages(body, data.gutterFolderImages);
  }

  // Wood Trim Section
  body.appendParagraph('Wood Trim Assessment')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  if (data.woodTrim && data.woodTrim.rows.length > 0) {
    body.appendParagraph('Data shown for entire building (' + (data.buildingAddress || address) + ')')
      .setFontSize(10)
      .setItalic(true);
    appendTableFromDataWithImages(body, data.woodTrim, 'Wood Trim');
  } else {
    body.appendParagraph('No wood trim assessment records found.');
  }

  // Footer
  body.appendHorizontalRule();
  body.appendParagraph('This report was generated automatically from Villas at the Boulders HOA records.')
    .setItalic(true);

    doc.saveAndClose();

  // Convert to PDF with error handling
  let pdf = null;
  try {
    const docFile = DriveApp.getFileById(doc.getId());
    console.log('Document created: ' + docFile.getName());

    pdf = docFile.getAs('application/pdf');

    if (!pdf) {
      throw new Error('getAs returned null');
    }

    // Set a proper name on the PDF
    pdf.setName('Property_Report_' + sanitizedAddress + '.pdf');
    console.log('PDF created: ' + pdf.getName() + ', size: ' + pdf.getBytes().length);

    // Delete temporary doc
    docFile.setTrashed(true);

  } catch (pdfError) {
    console.error('Error creating PDF: ' + pdfError.toString());
    // Try to clean up the doc if it exists
    try {
      const tempDoc = DriveApp.getFileById(doc.getId());
      tempDoc.setTrashed(true);
    } catch (e) {}

    throw new Error('PDF generation failed: ' + pdfError.toString());
  }

  return pdf;
}

/**
 * Enhanced appendTableFromData function that handles images with HEIF conversion
 */
function appendTableFromDataWithImages(body, data, sheetName) {
  if (!data || !data.headers || !data.rows || data.rows.length === 0) {
    return;
  }

  // For Wood Trim, special handling with images
  if (sheetName === 'Wood Trim') {
    for (var r = 0; r < data.rows.length; r++) {
      var row = data.rows[r];

      if (r > 0) {
        body.appendParagraph('').setSpacingAfter(10);
      }

      // Show fields as labeled pairs (columns 2-11)
      for (var c = 1; c < Math.min(11, data.headers.length); c++) {
        if (row[c]) {
          var label = data.headers[c] || 'Column ' + (c + 1);
          body.appendParagraph(label + ': ' + row[c]).setIndentFirstLine(20);
        }
      }

      // Handle images from column 12 onwards
      for (var imgCol = 11; imgCol < data.headers.length; imgCol++) {
        if (row[imgCol] && typeof row[imgCol] === 'string') {
          try {
            var cellValue = row[imgCol];
            var imageUrl = cellValue;

            // Convert Google Drive URLs to direct download links
            imageUrl = convertDriveUrl(imageUrl);

            var imageBlob = UrlFetchApp.fetch(imageUrl).getBlob();
            var filename = 'image_' + r + '_' + imgCol + '.jpg';

            // Convert HEIF to JPEG if needed
            var convertedBlob = convertHeifToJpeg(imageBlob, filename);

            if (convertedBlob) {
              body.appendParagraph(data.headers[imgCol] || 'Image').setBold(true).setSpacingBefore(10);
              var inlineImage = body.appendImage(convertedBlob);

              // Set reasonable image size
              var width = inlineImage.getWidth();
              var height = inlineImage.getHeight();
              var maxWidth = 400;

              if (width > maxWidth) {
                var ratio = maxWidth / width;
                inlineImage.setWidth(maxWidth);
                inlineImage.setHeight(height * ratio);
              }
            } else {
              body.appendParagraph('[HEIF image could not be converted: ' + (data.headers[imgCol] || 'Column ' + (imgCol + 1)) + ']').setItalic(true);
            }

          } catch (imageError) {
            console.error('Error loading image from column ' + imgCol + ': ' + imageError.toString());
            body.appendParagraph('[Image could not be loaded: ' + (data.headers[imgCol] || 'Column ' + (imgCol + 1)) + ']').setItalic(true);
          }
        }
      }
    }
  } else if (sheetName === 'Gutters') {
    // For Gutters, show columns 3+ as labeled fields
    for (var r = 0; r < data.rows.length; r++) {
      var row = data.rows[r];

      if (r > 0) {
        body.appendParagraph('').setSpacingAfter(10);
      }

      for (var c = 2; c < data.headers.length; c++) {
        if (row[c]) {
          var label = data.headers[c] || 'Column ' + (c + 1);

          // Check if this might be an image URL
          if (typeof row[c] === 'string' && (row[c].includes('drive.google.com') || row[c].match(/\.(jpg|jpeg|png|heif|heic)$/i))) {
            try {
              var directUrl = convertDriveUrl(row[c]);
              var imageBlob = UrlFetchApp.fetch(directUrl).getBlob();
              var filename = 'gutter_image_' + r + '_' + c + '.jpg';

              var convertedBlob = convertHeifToJpeg(imageBlob, filename);

              if (convertedBlob) {
                body.appendParagraph(label).setBold(true).setSpacingBefore(10);
                var inlineImage = body.appendImage(convertedBlob);

                var width = inlineImage.getWidth();
                var height = inlineImage.getHeight();
                var maxWidth = 400;

                if (width > maxWidth) {
                  var ratio = maxWidth / width;
                  inlineImage.setWidth(maxWidth);
                  inlineImage.setHeight(height * ratio);
                }
              } else {
                body.appendParagraph(label + ': [HEIF image could not be converted]').setItalic(true);
              }
            } catch (e) {
              body.appendParagraph(label + ': ' + row[c]).setIndentFirstLine(20);
            }
          } else {
            body.appendParagraph(label + ': ' + row[c]).setIndentFirstLine(20);
          }
        }
      }
    }
  } else {
    // For other sheets (Keystone), use regular table format
    appendTableFromData(body, data);
  }

  body.appendParagraph('');
}

function appendGutterFolderImages(body, gutterImages) {
  if (!gutterImages || (!gutterImages.unitImages.length && !gutterImages.buildingImages.length)) {
    return;
  }

  body.appendParagraph('Gutter Cleaning Photos')
    .setBold(true)
    .setSpacingBefore(10);

  // Add unit images
  if (gutterImages.unitImages.length > 0) {
    body.appendParagraph('Unit Photos (' + gutterImages.unitFolderName + ')')
      .setItalic(true)
      .setFontSize(10);

    for (const image of gutterImages.unitImages) {
      try {
        console.log('Adding unit gutter image: ' + image.name);
        const imageBlob = UrlFetchApp.fetch(image.url).getBlob();

        // Convert HEIF if needed
        const convertedBlob = convertHeifToJpeg(imageBlob, image.name);

        if (convertedBlob) {
          const inlineImage = body.appendImage(convertedBlob);

          // Set reasonable size
          const width = inlineImage.getWidth();
          const height = inlineImage.getHeight();
          const maxWidth = 400;

          if (width > maxWidth) {
            const ratio = maxWidth / width;
            inlineImage.setWidth(maxWidth);
            inlineImage.setHeight(height * ratio);
          }

          body.appendParagraph(image.name)
            .setFontSize(9)
            .setItalic(true);
        }
      } catch (error) {
        console.error('Error adding gutter image: ' + error.toString());
        body.appendParagraph('[Could not load image: ' + image.name + ']')
          .setItalic(true);
      }
    }
  }

  // Add building images
  if (gutterImages.buildingImages.length > 0) {
    if (gutterImages.unitImages.length > 0) {
      body.appendParagraph(''); // Add spacing
    }

    body.appendParagraph('Building Photos (' + gutterImages.buildingFolderName + ')')
      .setItalic(true)
      .setFontSize(10);

    for (const image of gutterImages.buildingImages) {
      try {
        console.log('Adding building gutter image: ' + image.name);
        const imageBlob = UrlFetchApp.fetch(image.url).getBlob();

        // Convert HEIF if needed
        const convertedBlob = convertHeifToJpeg(imageBlob, image.name);

        if (convertedBlob) {
          const inlineImage = body.appendImage(convertedBlob);

          // Set reasonable size
          const width = inlineImage.getWidth();
          const height = inlineImage.getHeight();
          const maxWidth = 400;

          if (width > maxWidth) {
            const ratio = maxWidth / width;
            inlineImage.setWidth(maxWidth);
            inlineImage.setHeight(height * ratio);
          }

          body.appendParagraph(image.name)
            .setFontSize(9)
            .setItalic(true);
        }
      } catch (error) {
        console.error('Error adding gutter image: ' + error.toString());
        body.appendParagraph('[Could not load image: ' + image.name + ']')
          .setItalic(true);
      }
    }
  }

  body.appendParagraph(''); // Final spacing
}

/**
 * Helper function to append table data to document
 */
function appendTableFromData(body, sheetData) {
  if (!sheetData || !sheetData.headers || !sheetData.rows || sheetData.rows.length === 0) {
    return;
  }

  const table = body.appendTable();

  // Add header row
  const headerRow = table.appendTableRow();
  sheetData.headers.forEach(function(header) {
    headerRow.appendTableCell(String(header || '')).setBold(true);
  });

  // Add data rows (limit to reasonable number of rows)
  const maxRows = Math.min(sheetData.rows.length, 50); // Limit to 50 rows
  for (let i = 0; i < maxRows; i++) {
    const row = sheetData.rows[i];
    const tableRow = table.appendTableRow();

    // Limit columns to prevent overly wide tables
    const maxCols = Math.min(row.length, 10); // Limit to 10 columns
    for (let j = 0; j < maxCols; j++) {
      const cellValue = row[j];
      tableRow.appendTableCell(String(cellValue || ''));
    }
  }
}

/**
 * Helper function to append wood trim data with images
 */
function appendWoodTrimData(body, sheetData) {
  if (!sheetData || !sheetData.headers || !sheetData.rows || sheetData.rows.length === 0) {
    body.appendParagraph('No wood trim data found.').setItalic(true);
    return;
  }

  // Process each row of wood trim data
  sheetData.rows.forEach((row, rowIndex) => {
    if (rowIndex > 0) {
      body.appendParagraph('').setSpacingAfter(20);  // Add spacing between records
      body.appendHorizontalRule();
      body.appendParagraph('').setSpacingAfter(10);
    }

    // Display columns 2-11 as name-value pairs (skip column 1 which is address)
    for (let i = 1; i < Math.min(11, sheetData.headers.length); i++) {
      const label = String(sheetData.headers[i] || 'Field ' + (i+1));
      const value = String(row[i] || '(empty)');

      const para = body.appendParagraph(label + ': ' + value);
      para.setBold(false);

      // Make the label part bold
      const labelLength = label.length + 1;  // +1 for colon
      para.editAsText().setBold(0, labelLength - 1, true);
    }

    // Add images from column 12 onwards
    if (row.length > 11) {
      body.appendParagraph('').setSpacingAfter(10);  // Add some spacing
      body.appendParagraph('Photos:').setBold(true).setFontSize(12);

      let imageCount = 0;
      for (let i = 11; i < row.length; i++) {
        if (row[i]) {
          const cellValue = String(row[i]).trim();
          if (cellValue && cellValue !== '(empty)' && cellValue !== '') {
            try {
              console.log('Attempting to add image from column ' + (i+1) + ': ' + cellValue);

              let imageBlob = null;

              // Check if this is a Drive file ID or URL
              if (cellValue.includes('drive.google.com') || cellValue.includes('docs.google.com')) {
                // Extract file ID from URL - improved regex
                const patterns = [
                  /\/d\/([a-zA-Z0-9_-]+)/,  // /d/FILE_ID format
                  /id=([a-zA-Z0-9_-]+)/,    // id=FILE_ID format
                  /\/([a-zA-Z0-9_-]{25,})/  // Just a long ID in the path
                ];

                let fileId = null;
                for (const pattern of patterns) {
                  const match = cellValue.match(pattern);
                  if (match) {
                    fileId = match[1];
                    break;
                  }
                }

                if (fileId) {
                  console.log('Extracted file ID: ' + fileId);
                  const file = DriveApp.getFileById(fileId);
                  imageBlob = file.getBlob();
                }
              } else if (cellValue.match(/^[a-zA-Z0-9_-]{25,}$/)) {
                // Direct file ID
                console.log('Direct file ID: ' + cellValue);
                const file = DriveApp.getFileById(cellValue);
                imageBlob = file.getBlob();
              }

              if (imageBlob) {
                // Check if it's actually an image
                const mimeType = imageBlob.getContentType();
                // Check if it's a supported image format
                const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
                console.log('Blob MIME type: ' + mimeType);

                if (supportedFormats.includes(mimeType.toLowerCase())) {
                  console.log('Supported image format, adding to document...');
                  try {
                    const inlineImage = body.appendImage(imageBlob);

                    // Scale image to fit page width
                    const maxWidth = 450;
                    inlineImage.setWidth(maxWidth);

                    // Add caption
                    body.appendParagraph('Photo ' + (imageCount + 1))
                      .setItalic(true)
                      .setFontSize(10)
                      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

                    body.appendParagraph('');  // Add spacing after image
                    imageCount++;
                    console.log('Successfully added image ' + imageCount);
                  } catch (embedError) {
                    console.error('Error embedding image: ' + embedError.toString());

                    // Add a placeholder with link instead
                    const para = body.appendParagraph('Photo ' + (imageCount + 1) + ': ');
                    para.appendText('[View Image - ' + file.getName() + ']')
                      .setLinkUrl(cellValue)
                      .setForegroundColor('#1a73e8')
                      .setUnderline(true);
                    para.setItalic(true);
                    imageCount++;
                  }
                } else if (mimeType.startsWith('image/')) {
                  console.log('Unsupported image format: ' + mimeType);

                  // For HEIC and other unsupported formats, add a link
                  const para = body.appendParagraph('Photo ' + (imageCount + 1) + ': ');

                  let linkText = '[View ';
                  if (mimeType === 'image/heif' || mimeType === 'image/heic') {
                    linkText += 'HEIC Image';
                  } else {
                    linkText += 'Image';
                  }
                  linkText += ' - ' + file.getName() + ']';

                  para.appendText(linkText)
                    .setLinkUrl(cellValue)
                    .setForegroundColor('#1a73e8')
                    .setUnderline(true);

                  para.appendText(' (Format not supported for embedding)')
                    .setItalic(true)
                    .setForegroundColor('#666666');

                  body.appendParagraph('');  // Add spacing
                  imageCount++;
                  console.log('Added link for unsupported format');
                } else {
                  console.log('File is not an image: ' + mimeType);
                }
              }
            } catch (imgError) {
              console.error('Could not add image from column ' + (i+1) + ': ' + imgError.toString());
            }
          }
        }
      }

      if (imageCount === 0) {
        body.appendParagraph('No photos available').setItalic(true);
      }
    }
  });
}

/**
 * Helper function to append gutter data as name-value pairs
 */
function appendGutterData(body, sheetData) {
  if (!sheetData || !sheetData.headers || !sheetData.rows || sheetData.rows.length === 0) {
    body.appendParagraph('No gutter maintenance records found.').setItalic(true);
    return;
  }

  // Process each row of gutter data
  sheetData.rows.forEach((row, rowIndex) => {
    if (rowIndex > 0) {
      body.appendParagraph('').setSpacingAfter(10);  // Add spacing between records
      body.appendHorizontalRule();
      body.appendParagraph('').setSpacingAfter(5);
    }

    // Display columns 3 onwards as name-value pairs (skip columns 1-2: task and address)
    for (let i = 2; i < sheetData.headers.length; i++) {
      const label = String(sheetData.headers[i] || 'Field ' + (i+1));
      const value = String(row[i] || '(empty)');

      const para = body.appendParagraph(label + ': ' + value);
      para.setBold(false);

      // Make the label part bold
      const labelLength = label.length + 1;  // +1 for colon
      para.editAsText().setBold(0, labelLength - 1, true);
    }
  });
}
