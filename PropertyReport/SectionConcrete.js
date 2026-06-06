/**
 * Concrete & Asphalt Section Generator
 * Displays concrete repair history for a property (unit-specific and common areas).
 * Data source: VBB Concrete Work History (Board Documents/Projects/Active/Concrete-Asphalt)
 */

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

    var concrete = data.concrete;

    // --- Unit-specific records ---
    body.appendParagraph('Your Property')
      .setHeading(DocumentApp.ParagraphHeading.HEADING3)
      .setForegroundColor('#1a3c5e');

    if (concrete && concrete.unitRecords && concrete.unitRecords.length > 0) {
      body.appendParagraph('Concrete and asphalt work scheduled or completed at this unit.')
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666');
      body.appendParagraph('');

      appendConcreteTable(body, concrete.unitRecords, false);
    } else {
      body.appendParagraph('No concrete or asphalt work on record for this unit.')
        .setItalic(true)
        .setForegroundColor('#666666');
    }

    body.appendParagraph('');

    // --- Common areas ---
    body.appendParagraph('Common Areas')
      .setHeading(DocumentApp.ParagraphHeading.HEADING3)
      .setForegroundColor('#1a3c5e');

    if (concrete && concrete.commonRecords && concrete.commonRecords.length > 0) {
      body.appendParagraph('Concrete and asphalt work in shared driveways, walkways, and other common areas.')
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666');
      body.appendParagraph('');

      appendConcreteTable(body, concrete.commonRecords, true);
    } else {
      body.appendParagraph('No common area records found.')
        .setItalic(true)
        .setForegroundColor('#666666');
    }

    // Note about historical data
    body.appendParagraph('');
    body.appendParagraph(
      'Note: Records prior to 2025 are reconstructed from HOA documents and may be incomplete. ' +
      'For questions about this history, contact manager@villasboulders.org.'
    )
      .setFontSize(9)
      .setItalic(true)
      .setForegroundColor('#888888');

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
    console.log('Concrete section created: ' + url);
    return { label: sectionLabel, url: url };

  } catch (e) {
    console.error('Error generating Concrete section: ' + e.toString());
    throw e;
  }
}

function appendConcreteTable(body, records, isCommon) {
  var table = body.appendTable();
  table.setBorderWidth(1);
  table.setBorderColor('#dddddd');

  // Header row
  var headers = isCommon
    ? ['Year', 'Location', 'Work', 'Status', 'Severity']
    : ['Year', 'Location', 'Work', 'Status', 'Severity'];

  var hdr = table.appendTableRow();
  headers.forEach(function(label) {
    var cell = hdr.appendTableCell(label);
    cell.setBackgroundColor('#1a3c5e');
    cell.getChild(0).asParagraph()
      .setBold(true)
      .setFontSize(10)
      .setForegroundColor('#ffffff');
    cell.setPaddingTop(6);
    cell.setPaddingBottom(6);
    cell.setPaddingLeft(8);
    cell.setPaddingRight(8);
  });

  // Data rows
  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    var dataRow = table.appendTableRow();
    var bg = (i % 2 === 0) ? '#ffffff' : '#f8f8f8';

    [rec.year, rec.location, rec.work, rec.status, rec.severity].forEach(function(val) {
      var cell = dataRow.appendTableCell(val || '');
      cell.setBackgroundColor(bg);
      cell.getChild(0).asParagraph()
        .setFontSize(10)
        .setForegroundColor('#333333');
      cell.setPaddingTop(5);
      cell.setPaddingBottom(5);
      cell.setPaddingLeft(8);
      cell.setPaddingRight(8);
    });
  }
}
