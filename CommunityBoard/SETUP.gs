// Run this ONCE to set up the Community Board Google Sheet and Config.
// Instructions:
// 1. Go to https://script.google.com/home
// 2. Open the CommunityBoard Apps Script project
// 3. Click the "SETUP.gs" tab
// 4. Click the play button (▶) next to "setupSheet()" function
// 5. Grant permissions when prompted
// 6. Wait for completion (check the Execution log)
// 7. Copy the SHEET_ID from the output
// 8. Edit Code.gs and set CONFIG.sheetId = 'SHEET_ID'
// 9. clasp push, then deploy
// 10. Delete this file

function setupSheet() {
  const parentFolderId = '1MTV9Rbl79Kp1E0-oNEQbFZ6Kz5EC6pub'; // Villas at the Boulders Website Forms and Surveys
  const sheetName = 'Community Board Responses';

  try {
    // Check if folder and subfolder exist
    let parentFolder = DriveApp.getFolderById(parentFolderId);
    let cbFolder = null;

    const cbFolders = parentFolder.getFoldersByName('Community Board');
    if (cbFolders.hasNext()) {
      cbFolder = cbFolders.next();
      Logger.log('Found existing Community Board folder');
    } else {
      cbFolder = parentFolder.createFolder('Community Board');
      Logger.log('Created Community Board folder');
    }

    // Create the Sheet
    const sheet = SpreadsheetApp.create(sheetName);
    const sheetId = sheet.getId();
    Logger.log('Sheet created: ' + sheetId);

    // Move it to the Community Board folder
    const sheetFile = DriveApp.getFileById(sheetId);
    cbFolder.addFile(sheetFile);
    parentFolder.removeFile(sheetFile); // Remove from parent if it was added there
    Logger.log('Sheet moved to Community Board folder');

    // Set up tabs
    const activeSheet = sheet.getActiveSheet();
    activeSheet.setName('Form Responses');

    // Add headers to Form Responses
    activeSheet.appendRow([
      'Timestamp',
      'Display name',
      'Street',
      'Unit / address',
      'Category',
      'Title',
      'Details',
      'Vendor name',
      'Contact OK',
      'Publishable contact',
      'Email-to-street-group',
      'Approved',
      'Hidden reason',
    ]);

    // Create Config tab
    const configSheet = sheet.insertSheet('Config');
    configSheet.appendRow(['Street', 'Group email', 'Groups web URL']);
    configSheet.appendRow(['Boulder Circle', 'bouldercircle@villasboulders.org', 'https://groups.google.com/a/villasboulders.org/g/bouldercircle']);
    configSheet.appendRow(['Boulder Point', 'boulderpoint@villasboulders.org', 'https://groups.google.com/a/villasboulders.org/g/boulderpoint']);
    configSheet.appendRow(['Broadlands Lane', 'broadlandslane@villasboulders.org', 'https://groups.google.com/a/villasboulders.org/g/broadlandslane']);
    configSheet.appendRow(['Plaster Point', 'plasterpoint@villasboulders.org', 'https://groups.google.com/a/villasboulders.org/g/plasterpoint']);
    configSheet.appendRow(['Rock Point', 'rockpoint@villasboulders.org', 'https://groups.google.com/a/villasboulders.org/g/rockpoint']);
    configSheet.appendRow(['Stone Circle', 'stonecircle@villasboulders.org', 'https://groups.google.com/a/villasboulders.org/g/stonecircle']);

    // Add sample posts (Approved=TRUE so they show)
    activeSheet.appendRow([
      new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }),
      'SAMPLE Admin',
      'Boulder Circle',
      '123 Boulder Circle',
      'General',
      'SAMPLE — delete before go-live',
      'This is a sample post. It will show on the Community Board because Approved=TRUE. Once you test the board, please delete this row.',
      '',
      'No',
      '',
      'No',
      'TRUE',
      '',
    ]);

    activeSheet.appendRow([
      new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }),
      'SAMPLE Vendor',
      'Boulder Point',
      '456 Boulder Point',
      'Vendor recommendation',
      'SAMPLE — Great local plumber',
      'SAMPLE: This is a sample vendor recommendation. Contact info shows because Contact OK = Yes. Delete before go-live.',
      'Sample Plumbing Co',
      'Yes',
      '(303) 555-1234',
      'No',
      'TRUE',
      '',
    ]);

    Logger.log('✓ Setup complete!');
    Logger.log('');
    Logger.log('Sheet ID: ' + sheetId);
    Logger.log('Sheet URL: https://docs.google.com/spreadsheets/d/' + sheetId + '/edit');
    Logger.log('');
    Logger.log('NEXT STEPS:');
    Logger.log('1. Copy the Sheet ID above');
    Logger.log('2. Edit CommunityBoard/Code.gs');
    Logger.log('3. Set CONFIG.sheetId = "' + sheetId + '"');
    Logger.log('4. Run: clasp push');
    Logger.log('5. Deploy: clasp deploy --deploymentId <deploymentId> --description "Initial deployment"');
    Logger.log('6. Delete SETUP.gs from the project');

  } catch (err) {
    Logger.log('ERROR: ' + err.toString());
  }
}
