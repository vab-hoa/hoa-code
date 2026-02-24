/**
 * HOA Account Section Generator
 * Generates a Google Doc with homeowner identity and account information.
 * Data sources: HOA Contacts (Google People API) + Keystone account number.
 * Includes a note to contact the property manager for corrections.
 */

function generateSectionHOAAccount(address, displayAddress, data) {
  const sectionLabel = 'HOA Account';
  console.log('Generating HOA Account section for ' + address);

  try {
    const reportsFolder = DriveApp.getFolderById(REPORT_CONFIG.reportsFolderId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const docName = 'Report_' + address + '_hoaAccount_' + dateStr;
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

    // Contact Information table
    body.appendParagraph('Homeowner Information').setBold(true).setFontSize(12);

    var infoTable = body.appendTable();
    infoTable.setBorderWidth(0);

    function addRow(label, value) {
      var row = infoTable.appendTableRow();
      var labelCell = row.appendTableCell(label);
      labelCell.getChild(0).asParagraph().setBold(true);
      labelCell.setWidth(120);
      row.appendTableCell(value || '—');
    }

    // Name: prefer HOA Contacts, fall back to Keystone profile
    var name = (data.contact && data.contact.name) ||
               (data.keystone && data.keystone.profile && data.keystone.profile.name) || '';
    // Address: from HOA Contacts
    var contactAddress = (data.contact && data.contact.address) || displayAddress;
    // Email: from HOA Contacts (the email used to submit the form)
    var email = (data.contact && data.contact.email) || data.email || '';
    // Phone: from HOA Contacts, fall back to Keystone profile
    var phone = (data.contact && data.contact.phone) ||
                (data.keystone && data.keystone.profile && data.keystone.profile.phone) || '';
    // Keystone account number (strip any # since label already has it)
    var accountNumber = (data.keystone && data.keystone.profile && data.keystone.profile.accountNumber) || '';
    accountNumber = accountNumber.replace(/#/g, '').trim();

    addRow('Name', name);
    addRow('Address', contactAddress);
    addRow('Email', email);
    addRow('Phone', phone);
    addRow('Keystone Account #', accountNumber);

    body.appendParagraph('');

    // Corrections note
    body.appendHorizontalRule();
    var note = body.appendParagraph(
      'If any of the information above requires an update or correction, ' +
      'please contact the property manager at manager@villasboulders.org.'
    );
    note.setItalic(true).setFontSize(10);

    body.appendParagraph('');
    body.appendParagraph('Villas at the Boulders HOA')
      .setItalic(true).setFontSize(9);

    doc.saveAndClose();

    var file = DriveApp.getFileById(doc.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = file.getUrl();
    console.log('HOA Account section created: ' + url);
    return { label: sectionLabel, url: url };

  } catch (e) {
    console.error('Error generating HOA Account section: ' + e.toString());
    throw e;
  }
}
