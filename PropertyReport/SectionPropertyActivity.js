/**
 * Property Activity Section Generator
 * Generates a Google Doc with Work Orders, Architectural Requests, and Violations (if any).
 * The section title does not mention violations; they appear inline if present.
 */

function generateSectionPropertyActivity(address, displayAddress, data) {
  const sectionLabel = 'Work Orders & Architectural Requests';
  console.log('Generating Property Activity section for ' + address);

  try {
    const reportsFolder = DriveApp.getFolderById(REPORT_CONFIG.reportsFolderId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const docName = 'Report_' + address + '_propertyActivity_' + dateStr;
    const doc = DocumentApp.create(docName);
    DriveApp.getFileById(doc.getId()).moveTo(reportsFolder);
    const body = doc.getBody();

    // Header
    body.appendParagraph(sectionLabel)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph(displayAddress)
      .setHeading(DocumentApp.ParagraphHeading.HEADING2)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('Generated: ' + new Date().toLocaleString('en-US', {timeZone: 'America/Denver'}))
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendHorizontalRule();

    var ks = data.keystone;
    var hasData = ks && (
      (ks.workOrders && ks.workOrders.length > 0) ||
      (ks.archReviews && ks.archReviews.length > 0) ||
      (ks.violations && ks.violations.length > 0)
    );

    if (!hasData) {
      body.appendParagraph('No work orders, architectural requests, or violations on record for this property.')
        .setItalic(true);
    } else {

      // Work Orders
      body.appendParagraph('Work Orders').setBold(true).setFontSize(12);
      if (ks.workOrders && ks.workOrders.length > 0) {
        var woTable = body.appendTable();
        var woHeader = woTable.appendTableRow();
        ['WO #', 'Date', 'Description', 'Vendor', 'Status'].forEach(function(h) {
          woHeader.appendTableCell(h).getChild(0).asParagraph().setBold(true);
        });
        ks.workOrders.forEach(function(wo) {
          var row = woTable.appendTableRow();
          row.appendTableCell(wo.woNumber || '');
          row.appendTableCell(wo.date || '');
          row.appendTableCell(wo.description || '');
          row.appendTableCell(wo.vendor || '');
          row.appendTableCell(wo.status || '');
        });
      } else {
        body.appendParagraph('No work orders on record.').setItalic(true);
      }
      body.appendParagraph('');

      // Architectural Requests
      body.appendParagraph('Architectural Requests').setBold(true).setFontSize(12);
      if (ks.archReviews && ks.archReviews.length > 0) {
        var archTable = body.appendTable();
        var archHeader = archTable.appendTableRow();
        ['Date', 'Description', 'Status'].forEach(function(h) {
          archHeader.appendTableCell(h).getChild(0).asParagraph().setBold(true);
        });
        ks.archReviews.forEach(function(ar) {
          var row = archTable.appendTableRow();
          row.appendTableCell(ar.date || '');
          row.appendTableCell(ar.description || '');
          row.appendTableCell(ar.status || '');
        });
      } else {
        body.appendParagraph('No architectural requests on record.').setItalic(true);
      }
      body.appendParagraph('');

      // Violations — shown if present, no heading mention in the section title
      if (ks.violations && ks.violations.length > 0) {
        body.appendParagraph('Violations (' + ks.violations.length + ')').setBold(true).setFontSize(12);
        var vTable = body.appendTable();
        var vHeader = vTable.appendTableRow();
        ['Date', 'Description', 'Status'].forEach(function(h) {
          vHeader.appendTableCell(h).getChild(0).asParagraph().setBold(true);
        });
        ks.violations.forEach(function(v) {
          var row = vTable.appendTableRow();
          row.appendTableCell(v.date || '');
          row.appendTableCell(v.description || '');
          row.appendTableCell(v.status || '');
        });
        body.appendParagraph('');
      }
    }

    body.appendHorizontalRule();
    body.appendParagraph('Villas at the Boulders HOA — Data from Keystone Property Management')
      .setItalic(true).setFontSize(9);

    doc.saveAndClose();

    var file = DriveApp.getFileById(doc.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = file.getUrl();
    console.log('Property Activity section created: ' + url);
    return { label: sectionLabel, url: url };

  } catch (e) {
    console.error('Error generating Property Activity section: ' + e.toString());
    throw e;
  }
}
