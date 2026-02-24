/**
 * Configuration Module
 *
 * Contains all configuration constants used throughout the Property Report system.
 * This includes form IDs, spreadsheet IDs, email addresses, and system settings.
 *
 * In Apps Script, all .gs files in a project share the same global scope,
 * so CONFIG can be accessed from any file without imports.
 */

/**
 * Property Report Processor (Standalone)
 * Version: 18.1 (FIXED - Production Ready)
 * Requires: HOALibrary v4+
 *
 * CRITICAL FIXES in v18.1:
 * - Fixed corrupted onFormSubmit() function (was using wrong function body)
 * - Changed debugMode from true to false for production
 * - Note: Must use published HOALibrary v4+ (not development mode)
 *
 * Generates property reports with data from multiple sources:
 * - Keystone HOA system (planned)
 * - Gutter maintenance spreadsheets and photos
 * - Wood trim assessment data
 *
 * This is a standalone script that processes form submissions via installable trigger.
 */

// Configuration
const CONFIG = {
  formId: '1mMuV-hdcE8bVN75m8y5OxlMjMRsITslnbYSF1AMN-y0',  // Your form
  debugMode: false,  // Set to false for production, true for testing
  adminEmail: 'admin@villasboulders.org',
  managerEmail: 'manager@villasboulders.org',

  // Spreadsheet IDs
  guttersSheetId: '10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A',
  woodTrimSheetId: '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE',
  keystoneCacheSheetId: '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ',

  ownersGroup: 'owners@villasboulders.org'
};
