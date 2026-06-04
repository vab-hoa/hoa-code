/**
 * Window Wells Section Generator
 * Displays window well installation records for a property.
 * Data source: Window Well Installations sheet (Board Documents/Project/2026/Window Wells)
 */

function generateSectionWindowWells(address, displayAddress, data) {
  const sectionLabel = 'Window Well Installations';
  console.log('Generating Window Wells section for ' + address);

  try {
    const reportsFolder = DriveApp.getFolderById(REPORT_CONFIG.reportsFolderId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const docName = 'Report_' + address + '_windowWells_' + dateStr;
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

    var installs = data.windowWells;

    if (installs && installs.length > 0) {
      body.appendParagraph('Installation Records')
        .setHeading(DocumentApp.ParagraphHeading.HEADING3)
        .setForegroundColor('#1a3c5e');

      body.appendParagraph('Window well installations on record for this unit.')
        .setFontSize(9)
        .setItalic(true)
        .setForegroundColor('#666666');

      body.appendParagraph('');

      // Table with one row per install record
      var table = body.appendTable();
      table.setBorderWidth(1);
      table.setBorderColor('#dddddd');

      // Header row
      var hdr = table.appendTableRow();
      ['Install Date', 'Location', 'Notes'].forEach(function(label) {
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
      for (var i = 0; i < installs.length; i++) {
        var rec = installs[i];
        var dataRow = table.appendTableRow();
        var bg = (i % 2 === 0) ? '#ffffff' : '#f8f8f8';

        [rec.date, rec.location, rec.notes].forEach(function(val) {
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

    } else {
      body.appendParagraph('No window well installation records found for this property.')
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
    console.log('Window Wells section created: ' + url);
    return { label: sectionLabel, url: url };

  } catch (e) {
    console.error('Error generating Window Wells section: ' + e.toString());
    throw e;
  }
}
