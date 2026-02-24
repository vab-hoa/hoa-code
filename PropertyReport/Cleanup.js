/**
 * Cleanup: Auto-delete expired property report section documents
 * Run setupCleanupTrigger() once to install the daily trigger
 */

/**
 * Create the 'Property Reports' Drive folder and log its ID.
 * Run this ONCE to get the folder ID, then update REPORT_CONFIG.reportsFolderId.
 */
function createReportsFolder() {
  var existing = DriveApp.getFoldersByName('Property Reports');
  if (existing.hasNext()) {
    var folder = existing.next();
    console.log('Existing folder found. ID: ' + folder.getId());
    console.log('URL: ' + folder.getUrl());
    return folder.getId();
  }
  var folder = DriveApp.createFolder('Property Reports');
  console.log('Created "Property Reports" folder.');
  console.log('Folder ID: ' + folder.getId());
  console.log('URL: ' + folder.getUrl());
  console.log('');
  console.log('ACTION REQUIRED: Copy the Folder ID above into ReportConfig.gs:');
  console.log('  REPORT_CONFIG.reportsFolderId = "' + folder.getId() + '"');
  return folder.getId();
}

/**
 * Delete section documents older than REPORT_CONFIG.expiryDays.
 * Runs automatically via daily time-based trigger.
 */
function cleanupExpiredReports() {
  console.log('=== Cleanup: checking for expired property report sections ===');

  if (!REPORT_CONFIG.reportsFolderId || REPORT_CONFIG.reportsFolderId === 'PLACEHOLDER') {
    console.log('reportsFolderId not set — skipping cleanup');
    return;
  }

  try {
    var folder = DriveApp.getFolderById(REPORT_CONFIG.reportsFolderId);
    var files = folder.getFiles();
    var now = new Date();
    var expiryMs = REPORT_CONFIG.expiryDays * 24 * 60 * 60 * 1000;
    var deleted = 0;
    var kept = 0;

    while (files.hasNext()) {
      var file = files.next();
      var age = now - file.getDateCreated();
      if (age > expiryMs) {
        console.log('Deleting expired file: ' + file.getName() + ' (created ' + file.getDateCreated() + ')');
        file.setTrashed(true);
        deleted++;
      } else {
        kept++;
      }
    }

    console.log('Cleanup complete: ' + deleted + ' deleted, ' + kept + ' kept');
  } catch (e) {
    console.error('Cleanup error: ' + e.toString());
  }
}

/**
 * Install a daily time-based trigger for cleanupExpiredReports.
 * Run this ONCE manually in the Apps Script editor.
 */
function setupCleanupTrigger() {
  // Remove any existing cleanup triggers first
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'cleanupExpiredReports') {
      ScriptApp.deleteTrigger(trigger);
      console.log('Removed existing cleanup trigger');
    }
  });

  ScriptApp.newTrigger('cleanupExpiredReports')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  console.log('Cleanup trigger installed: runs daily at 2am');
}
