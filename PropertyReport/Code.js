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
  woodTrimSheetId: '1Eu0y6O8Uco6VZ1mYcB2ehDXwE_EV_NJHV_M5Ji6Mts0',  // JPEG converted 2026-02-23
  keystoneCacheSheetId: '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ',
  
  // Window Wells installation sheet (Board Documents/Projects/Active/Window Wells)
  windowWellsSheetId: '1jShPXcgTiErKDQzZPlKfg_ByzS9b1AlrZcfCVoYtnjA',

  // Concrete repair history (Board Documents/Projects/Active/Concrete-Asphalt)
  concreteSheetId: '1lW1CwzKp0uQuBce2MozmZtuPQV3Gp6mkTiGjR8KM2Bs',

  // Gutter Pictures folder (on VaB Board Documents shared drive, under Gutters/)
  gutterPicturesFolderId: '1dWjvxclLYYeP8yP8fIyIySVrnoa5psrs',
  // Wood Trim Photos folder (on VaB Board Documents shared drive, under Wood Trim Damage Repair/Wood Trim Project/)
  woodTrimPhotosFolderId: '1P-Jsvh1yDD0dBISP4A5e_r0Bl8zBuBBw',

  ownersGroup: 'owners@villasboulders.org',
  boardGroup: 'board@villasboulders.org'
};

// Change this address, then select testPropertyReport and click Run
const TEST_ADDRESS = '13662BP1';
const TEST_EMAIL = 'admin@villasboulders.org';

/**
 * Diagnostic: test gutter folder image lookup.
 * Run from Apps Script editor to verify gutter photos work.
 */
function testGutterImages() {
  console.log('=== GUTTER IMAGE DIAGNOSTIC ===');
  console.log('Address: ' + TEST_ADDRESS);
  const standardized = HOALibrary.standardizeHOAAddress(TEST_ADDRESS);
  console.log('Standardized: ' + standardized);
  const result = getGutterFolderImages(standardized);
  console.log('Unit images: ' + result.unitImages.length);
  console.log('Building images: ' + result.buildingImages.length);
  if (result.unitImages.length > 0) {
    result.unitImages.forEach(function(img) { console.log('  Unit: ' + img.name); });
  }
  if (result.buildingImages.length > 0) {
    result.buildingImages.forEach(function(img) { console.log('  Bldg: ' + img.name); });
  }
  console.log('=== END DIAGNOSTIC ===');
}

/**
 * ONE-TIME SETUP: Run this function to connect to your form
 */
/**
 * Main function - triggered on form submission
 * Works exactly the same as form-bound, but in a standalone script!
 */
function onFormSubmit(e) {
  try {
    console.log('=== PROPERTY REPORT REQUEST RECEIVED ===');

    // Get respondent email (form is set to collect verified emails)
    const email = e.response.getRespondentEmail();

    if (!email) {
      console.error('No email found in submission');
      notifyAdmin('Form submission received with no email');
      return;
    }

    console.log('Processing report request from: ' + email);

    // Check if email is in owners group using HOALibrary
    if (!HOALibrary.isHOAOwner(email)) {
      console.log('Email ' + email + ' is not an HOA owner');
      sendNotOwnerEmail(email);
      return;
    }

    console.log('Email verified as HOA owner');

    // Look up homeowner info and address using HOALibrary
    const homeowner = HOALibrary.getHomeownerFromEmail(email);

    if (!homeowner || !homeowner.address) {
      console.log('Could not find address for ' + email);
      sendNoAddressEmail(email);
      notifyAdmin('Could not find address for owner: ' + email);
      return;
    }

    const originalAddress = homeowner.address;
    console.log('Found address: ' + originalAddress);

    // Standardize the address
    const standardizedAddress = HOALibrary.standardizeHOAAddress(originalAddress);
    console.log('Standardized to: ' + standardizedAddress);

    // Gather all report data
    const reportData = gatherReportData(email, standardizedAddress, HOALibrary.getDisplayAddress(standardizedAddress), originalAddress);

    // Generate section documents and get links
    const sections = generateAllSections(standardizedAddress, HOALibrary.getDisplayAddress(standardizedAddress), reportData);

    if (!sections || sections.length === 0) {
      console.error('No sections generated');
      notifyAdmin('Failed to generate any report sections for ' + email + ' at ' + originalAddress);
      return;
    }

    // Send email with section links
    const recipient = CONFIG.debugMode ? CONFIG.adminEmail : email;
    console.log('Sending report to: ' + recipient + (CONFIG.debugMode ? ' (debug mode)' : ''));
    sendPropertyReportEmail(recipient, HOALibrary.getDisplayAddress(standardizedAddress), sections);

    console.log('=== REPORT SENT SUCCESSFULLY ===');
    console.log('Property: ' + originalAddress);
    console.log('Recipient: ' + recipient);

  } catch (error) {
    console.error('Error processing form submission:', error);
    console.error('Stack trace:', error.stack);
    notifyAdmin('Error processing report request: ' + error.message + '\n\nStack: ' + error.stack);
  }
}

/**
 * Gather all property report data
 * @param {string} email - The homeowner email
 * @param {string} standardizedAddress - The standardized address (e.g., "13664SC1")
 * @param {string} displayAddress - The display address (e.g., "13664 Stone Circle Unit 101")
 * @param {string} originalAddress - The original address as stored
 * @return {object} - All report data
 */
function gatherReportData(email, standardizedAddress, displayAddress, originalAddress) {
  console.log('=== GATHERING REPORT DATA ===');
  console.log('Email: ' + email);  console.log('Display: ' + displayAddress);
  console.log('Original: ' + originalAddress);
  
  const data = {
    email: email,
    contact: null,
    generatedAt: new Date().toLocaleString(),
    gutters: null,
    woodTrim: null,
    windowWells: null,
    concrete: null,
    keystone: null,
    gutterFolderImages: null,
    woodTrimFolderImages: null
  };

  // Get homeowner contact info from HOA Contacts
  try {
    data.contact = HOALibrary.getHomeownerFromEmail(email);
  } catch (e) {
    console.error('Error getting contact data: ' + e.toString());
  }

  // Already standardized - just extract components
  try {
    data.standardizedAddress = standardizedAddress; // Already standardized
    data.displayAddress = displayAddress;
    data.originalAddress = originalAddress;
    data.buildingAddress = HOALibrary.getBuildingAddress(standardizedAddress);
    data.unitNumber = HOALibrary.getUnitFromAddress(standardizedAddress);
  } catch (e) {
    console.error('Error extracting address components: ' + e.toString());
  }
  
  // Get Gutters data (using standardized address)
  try {
    console.log('Fetching gutters data...');
    data.gutters = HOALibrary.getBuildingDataFromSheet(CONFIG.guttersSheetId, standardizedAddress);
    if (data.gutters) {
      console.log('Gutters data: ' + data.gutters.rows.length + ' rows');
    }
  } catch (error) {
    console.error('Error getting gutters data: ' + error.toString());
  }
  
  // Get gutter folder images (using standardized address)
  try {
    data.gutterFolderImages = getGutterFolderImages(standardizedAddress);
  } catch (error) {
    console.error('Error getting gutter folder images: ' + error.toString());
    data.gutterFolderImages = null;
  }
  
  // Get Wood Trim data (using standardized address)
  try {
    console.log('Fetching wood trim data...');
    data.woodTrim = HOALibrary.getBuildingDataFromSheet(CONFIG.woodTrimSheetId, standardizedAddress);
    if (data.woodTrim) {
      console.log('Wood trim data: ' + data.woodTrim.rows.length + ' rows');
    }
  } catch (error) {
    console.error('Error getting wood trim data: ' + error.toString());
  }
  
  // Get wood trim folder images (using standardized address)
  try {
    data.woodTrimFolderImages = getWoodTrimFolderImages(standardizedAddress);
  } catch (error) {
    console.error('Error getting wood trim folder images: ' + error.toString());
    data.woodTrimFolderImages = null;
  }

  // Get Window Wells data (unit-level match)
  try {
    console.log('Fetching window wells data...');
    data.windowWells = getWindowWellsData(standardizedAddress);
    console.log('Window wells: ' + (data.windowWells ? data.windowWells.length + ' records' : 'none'));
  } catch (error) {
    console.error('Error getting window wells data: ' + error.toString());
    data.windowWells = null;
  }

  // Get Concrete repair history (unit-level + common areas)
  try {
    console.log('Fetching concrete data...');
    data.concrete = getConcreteData(standardizedAddress);
    console.log('Concrete: ' + (data.concrete ? data.concrete.unitRecords.length + ' unit, ' + data.concrete.commonRecords.length + ' common' : 'none'));
  } catch (error) {
    console.error('Error getting concrete data: ' + error.toString());
    data.concrete = null;
  }

  // Get Keystone data (using standardized address)
  try {
    console.log('Fetching Keystone data...');
    data.keystone = getKeystoneData(standardizedAddress);
  } catch (error) {
    console.error('Error getting Keystone data: ' + error.toString());
  }

  return data;
}

/**
 * Get Keystone data for a property
 * Uses HOALibrary Keystone integration functions
 */
function getKeystoneData(address) {
  console.log('Fetching Keystone data from cache...');

  try {
    // Get profile data (account number, contact info)
    var profile = HOALibrary.getKeystoneProfileData(address);

    // Get violations
    var violations = HOALibrary.getKeystoneViolations(address);

    // Get all work orders (no status filter)
    var workOrders = HOALibrary.getKeystoneWorkOrders(address, null);

    // Get architectural reviews
    var archReviews = HOALibrary.getKeystoneArchReviews(address, null);

    console.log('Keystone data retrieved:');
    console.log('  Profile: ' + (profile ? 'found' : 'not found'));
    console.log('  Violations: ' + violations.length);
    console.log('  Work Orders: ' + workOrders.length);
    console.log('  Arch Reviews: ' + archReviews.length);

    return {
      profile: profile,
      violations: violations,
      workOrders: workOrders,
      archReviews: archReviews
    };

  } catch (error) {
    console.error('Error fetching Keystone data: ' + error.toString());
    return {
      profile: null,
      violations: [],
      workOrders: [],
      archReviews: []
    };
  }
}

/**
 * Get window well installation records for a specific unit.
 * Returns array of {date, location, notes} objects, or null if none found.
 */
function getWindowWellsData(address) {
  var ss = SpreadsheetApp.openById(CONFIG.windowWellsSheetId);
  var sheet = ss.getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;

  var targetStd = HOALibrary.standardizeHOAAddress(address);
  var results = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var rowAddr = row[0];
    if (!rowAddr) continue;
    var rowStd = HOALibrary.standardizeHOAAddress(String(rowAddr));
    if (rowStd === targetStd) {
      results.push({
        date: String(row[1] || '').trim(),
        location: String(row[2] || '').trim(),
        notes: String(row[3] || '').trim()
      });
    }
  }

  return results.length > 0 ? results : null;
}

/**
 * Get concrete repair history for a unit.
 * Reads "Scheduled Work" tab (unit-specific) and "Common Areas" tab (everyone).
 * Returns {unitRecords, commonRecords} or null.
 */
function getConcreteData(address) {
  var ss = SpreadsheetApp.openById(CONFIG.concreteSheetId);
  var targetStd = HOALibrary.standardizeHOAAddress(address);

  function colIdx(headers, name) {
    var n = name.toLowerCase();
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].toString().toLowerCase() === n) return i;
    }
    return -1;
  }

  function rowToObj(row, headers, cols) {
    var obj = {};
    for (var k in cols) {
      obj[k] = cols[k] !== -1 ? String(row[cols[k]] || '').trim() : '';
    }
    return obj;
  }

  // --- Scheduled Work tab (unit-specific) ---
  var unitRecords = [];
  var swSheet = ss.getSheetByName('Scheduled Work');
  if (swSheet) {
    var swData = swSheet.getDataRange().getValues();
    if (swData.length > 1) {
      var h = swData[0];
      var cols = {
        year:     colIdx(h, 'year'),
        location: colIdx(h, 'location'),
        work:     colIdx(h, 'work'),
        status:   colIdx(h, 'status'),
        estCost:  colIdx(h, 'est cost'),
        severity: colIdx(h, 'severity'),
        source:   colIdx(h, 'source'),
        address:  colIdx(h, 'address')
      };
      for (var i = 1; i < swData.length; i++) {
        var row = swData[i];
        if (!row[cols.address]) continue;
        var rowStd = HOALibrary.standardizeHOAAddress(String(row[cols.address]));
        if (rowStd === targetStd) {
          unitRecords.push(rowToObj(row, h, cols));
        }
      }
    }
  }

  if (unitRecords.length === 0) return null;
  return { unitRecords: unitRecords };
}

/**
 * Get data from a Keystone sheet
 */
function getKeystoneSheetData(sheet, searchAddress, exactMatch = false) {
  // Check if sheet exists
  if (!sheet) {
    console.error("Keystone sheet is null");
    return null;
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  
  const headers = data[0];
  const addressCol = headers.findIndex(function(h) {
    const header = h.toString().toLowerCase();
    return header.includes('address') || header.includes('property') || header.includes('unit');
  });
  
  if (addressCol === -1) return null;
  
  const matches = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[addressCol]) continue;
    
    const rowStandardized = HOALibrary.standardizeHOAAddress(row[addressCol]);
    
    if (exactMatch) {
      if (rowStandardized === HOALibrary.standardizeHOAAddress(searchAddress)) {
        matches.push(row);
      }
    } else {
      // For work orders/violations, match building
      const searchBuilding = HOALibrary.getBuildingAddress(searchAddress);
      const rowBuilding = HOALibrary.getBuildingAddress(row[addressCol]);
      
      if (rowBuilding === searchBuilding) {
        matches.push(row);
      }
    }
  }
  
  return matches.length > 0 ? {headers: headers, rows: matches} : null;
}


/**
 * Send email to non-owners
 */
function sendNotOwnerEmail(email) {
  const subject = 'Property Report Request - Access Denied';
  const body = `Dear User,

Your email address (${email}) is not registered as a property owner in our system.

Property reports are only available to verified owners. If you believe this is an error, please contact the HOA office.

Best regards,
Villas at the Boulders HOA`;
  
  MailApp.sendEmail(email, subject, body);
  notifyAdmin('Non-owner attempted to request report: ' + email);
}

/**
 * Send email when no address found
 */
function sendNoAddressEmail(email) {
  const subject = 'Property Report Request - No Address Found';
  const body = `Dear Homeowner,

We could not find a property address associated with your email (${email}) in our records.

Please contact the HOA office to update your contact information.

Best regards,
Villas at the Boulders HOA`;
  
  MailApp.sendEmail(email, subject, body);
  notifyAdmin('No address found for owner: ' + email);
}

/**
 * Notify admin of issues
 */
function notifyAdmin(message) {
  if (CONFIG.adminEmail) {
    MailApp.sendEmail(
      CONFIG.adminEmail,
      'Property Report System Notification',
      message + '\n\nTimestamp: ' + new Date().toString()
    );
  }
}


/**
 * Get all image files from a folder
 * @param {Folder} folder - The Google Drive folder
 * @return {Array} - Array of {name: string, url: string} objects
 */


/**
 * Find a folder by name, handling both regular folders and shortcuts
 * @param {string} folderName - The folder name to search for
 * @param {Folder} parentFolder - Optional parent folder to search within
 * @return {Folder|null} - The folder or null if not found
 */
/**
 * Find a folder by name, handling both regular folders and shortcuts
 * @param {string} folderName - The folder name to search for
 * @param {Folder} parentFolder - Optional parent folder to search within
 * @return {Folder|null} - The folder or null if not found
 */
function findFolderOrShortcut(folderName, parentFolder) {
  try {
    // First try regular folder
    if (parentFolder) {
      const folders = parentFolder.getFoldersByName(folderName);
      if (folders.hasNext()) {
        console.log('Found folder: ' + folderName);
        return folders.next();
      }
    } else {
      const folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        console.log('Found folder: ' + folderName);
        return folders.next();
      }
    }
    
    // If not found, look for shortcuts by iterating through files
    console.log('Folder not found, checking for shortcuts named: ' + folderName);
    
    try {
      // Get all files in the parent folder (or root)
      const files = parentFolder ? parentFolder.getFiles() : DriveApp.getFiles();
      
      while (files.hasNext()) {
        const file = files.next();
        
        // Check if this is a shortcut with the right name
        if (file.getName() === folderName && 
            file.getMimeType() === 'application/vnd.google-apps.shortcut') {
          
          console.log('Found shortcut: ' + folderName);
          
          // For shortcuts to folders, we need to get the target
          try {
            // Get the shortcut's target ID
            const targetId = file.getTargetId();
            console.log('Shortcut target ID: ' + targetId);
            
            // Try to open as folder
            const targetFolder = DriveApp.getFolderById(targetId);
            console.log('Successfully opened target folder');
            return targetFolder;
            
          } catch (e) {
            console.log('Could not open shortcut target as folder: ' + e.toString());
          }
        }
      }
      
    } catch (iterError) {
      console.log('Error iterating files: ' + iterError.toString());
    }
    
    console.log('Neither folder nor shortcut found for: ' + folderName);
    return null;
    
  } catch (error) {
    console.error('Error in findFolderOrShortcut: ' + error.toString());
    return null;
  }
}

/**
 * Get gutter images from Drive folders using HOA standardization
 * @param {string} address - The property address (standardized)
 * @return {object} - {unitImages: [], buildingImages: [], unitFolderName: string, buildingFolderName: string}
 */
function getGutterFolderImages(address) {
  console.log('Looking for gutter images for: ' + address);

  try {
    // Use Advanced Drive Service to list subfolders — DriveApp.getFolders()
    // does not work reliably on shared drive folders
    const parentId = CONFIG.gutterPicturesFolderId;

    // Standardize the request address
    const requestStandardized = HOALibrary.standardizeHOAAddress(address);
    const requestBuilding = HOALibrary.getBuildingAddress(address);
    const requestUnit = HOALibrary.getUnitFromAddress(address);

    console.log('Request: ' + requestStandardized + ' (building: ' + requestBuilding + ', unit: ' + requestUnit + ')');

    let unitFolderId = null;
    let buildingFolderId = null;
    let unitFolderName = '';
    let buildingFolderName = '';

    // List subfolders using Advanced Drive Service (supports shared drives)
    let pageToken = null;
    let folderCount = 0;
    do {
      const response = Drive.Files.list({
        q: "'" + parentId + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'nextPageToken, files(id, name)',
        pageSize: 100,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageToken: pageToken
      });

      const folders = response.files || [];
      for (let i = 0; i < folders.length; i++) {
        const folderName = folders[i].name;
        const folderId = folders[i].id;
        folderCount++;

        const folderStandardized = HOALibrary.standardizeHOAAddress(folderName);
        const folderBuilding = HOALibrary.getBuildingAddress(folderName);
        const folderUnit = HOALibrary.getUnitFromAddress(folderName);

        // Check for unit folder match
        if (requestUnit && folderStandardized === requestStandardized) {
          unitFolderId = folderId;
          unitFolderName = folderName;
          console.log('  MATCH unit folder: ' + unitFolderName);
        }

        // Check for building folder match (same building, NO unit number)
        if (folderBuilding === requestBuilding && !folderUnit) {
          buildingFolderId = folderId;
          buildingFolderName = folderName;
          console.log('  MATCH building folder: ' + buildingFolderName);
        }
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    console.log('Scanned ' + folderCount + ' subfolders');

    // Get images from matched folders (also using Advanced Drive Service)
    const unitImages = unitFolderId ? getImagesFromDriveFolder(unitFolderId) : [];
    const buildingImages = buildingFolderId ? getImagesFromDriveFolder(buildingFolderId) : [];

    console.log('Results: ' + unitImages.length + ' unit images, ' + buildingImages.length + ' building images');

    return {
      unitImages: unitImages,
      buildingImages: buildingImages,
      unitFolderName: unitFolderName,
      buildingFolderName: buildingFolderName
    };

  } catch (error) {
    console.error('Error getting gutter folder images: ' + error.toString());
    return {unitImages: [], buildingImages: []};
  }
}

/**
 * List image files in a folder using Advanced Drive Service (shared drive compatible)
 */
function getImagesFromDriveFolder(folderId) {
  const images = [];
  try {
    let pageToken = null;
    do {
      const response = Drive.Files.list({
        q: "'" + folderId + "' in parents and mimeType contains 'image/' and trashed = false",
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageSize: 100,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageToken: pageToken
      });

      const files = response.files || [];
      for (let i = 0; i < files.length; i++) {
        // Skip HEIF/HEIC images (not supported in Apps Script doc embedding)
        if (files[i].mimeType.includes('heif') || files[i].mimeType.includes('heic')) {
          console.log('Skipping HEIF image: ' + files[i].name);
          continue;
        }
        images.push({
          name: files[i].name,
          fileId: files[i].id
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken);
  } catch (error) {
    console.error('Error reading folder images: ' + error.toString());
  }
  return images;
}

/**
 * Get wood trim images from Drive folders using HOA standardization.
 * Same approach as getGutterFolderImages — uses Advanced Drive Service for shared drives.
 */
function getWoodTrimFolderImages(address) {
  console.log('Looking for wood trim images for: ' + address);

  try {
    const parentId = CONFIG.woodTrimPhotosFolderId;
    const requestStandardized = HOALibrary.standardizeHOAAddress(address);
    const requestBuilding = HOALibrary.getBuildingAddress(address);
    const requestUnit = HOALibrary.getUnitFromAddress(address);

    console.log('Request: ' + requestStandardized + ' (building: ' + requestBuilding + ', unit: ' + requestUnit + ')');

    let unitFolderId = null;
    let buildingFolderId = null;
    let unitFolderName = '';
    let buildingFolderName = '';

    let pageToken = null;
    let folderCount = 0;
    do {
      const response = Drive.Files.list({
        q: "'" + parentId + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'nextPageToken, files(id, name)',
        pageSize: 100,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageToken: pageToken
      });

      const folders = response.files || [];
      for (let i = 0; i < folders.length; i++) {
        const folderName = folders[i].name;
        const folderId = folders[i].id;
        folderCount++;

        const folderStandardized = HOALibrary.standardizeHOAAddress(folderName);
        const folderBuilding = HOALibrary.getBuildingAddress(folderName);
        const folderUnit = HOALibrary.getUnitFromAddress(folderName);

        if (requestUnit && folderStandardized === requestStandardized) {
          unitFolderId = folderId;
          unitFolderName = folderName;
          console.log('  MATCH wood trim unit folder: ' + unitFolderName);
        }

        if (folderBuilding === requestBuilding && !folderUnit) {
          buildingFolderId = folderId;
          buildingFolderName = folderName;
          console.log('  MATCH wood trim building folder: ' + buildingFolderName);
        }
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    console.log('Scanned ' + folderCount + ' wood trim subfolders');

    const unitImages = unitFolderId ? getImagesFromDriveFolder(unitFolderId) : [];
    const buildingImages = buildingFolderId ? getImagesFromDriveFolder(buildingFolderId) : [];

    console.log('Wood trim results: ' + unitImages.length + ' unit images, ' + buildingImages.length + ' building images');

    return {
      unitImages: unitImages,
      buildingImages: buildingImages,
      unitFolderName: unitFolderName,
      buildingFolderName: buildingFolderName
    };

  } catch (error) {
    console.error('Error getting wood trim folder images: ' + error.toString());
    return {unitImages: [], buildingImages: []};
  }
}

// Keep old function for any non-shared-drive usage
function getImagesFromFolder(folder, maxImages) {
  if (maxImages === undefined) maxImages = 0;
  const images = [];
  try {
    const files = folder.getFiles();
    while (files.hasNext() && (maxImages === 0 || images.length < maxImages)) {
      const file = files.next();
      const mimeType = file.getMimeType();
      if (mimeType.startsWith('image/')) {
        if (mimeType.includes('heif') || mimeType.includes('heic')) continue;
        images.push({ name: file.getName(), fileId: file.getId() });
      }
    }
  } catch (error) {
    console.error('Error reading folder images: ' + error.toString());
  }
  return images;
}

/**
 * Add gutter folder images to the PDF document
 * @param {Body} body - The document body
 * @param {object} gutterImages - Result from getGutterFolderImages
 */


/**
 * Convert Google Drive viewing URL to direct download URL
 * @param {string} url - The Google Drive URL
 * @return {string} - Direct download URL
 */
function convertDriveUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Pattern for drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    const fileId = fileMatch[1];
    const directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    return directUrl;
  }

  // Pattern for drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    const fileId = openMatch[1];
    const directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    return directUrl;
  }

  return url;
}

/**
 * Extract file ID from Drive URL or return null
 */
function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;

  // Pattern for drive.google.com/file/d/FILE_ID/view
  let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Pattern for drive.google.com/open?id=FILE_ID
  match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Pattern for uc?export=view&id=FILE_ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // If it looks like a bare file ID (long alphanumeric string)
  if (url.match(/^[a-zA-Z0-9_-]{25,}$/)) return url;

  return null;
}

/**
 * Convert HEIF images to JPEG
 * @param {Blob} blob - The image blob to check and convert
 * @param {string} filename - Original filename for logging
 * @returns {Blob} - Either the original blob or converted JPEG
 */
function convertHeifToJpeg(blob, filename) {
  try {
    if (!blob) return null;
    
    var contentType = blob.getContentType();
    
    // Check if it's a HEIF image
    var isHeif = false;
    if (contentType && (
      contentType.includes('heif') || 
      contentType.includes('heic') ||
      contentType === 'image/heif' ||
      contentType === 'image/heic' ||
      contentType === 'image/heif-sequence' ||
      contentType === 'image/heic-sequence'
    )) {
      isHeif = true;
    }
    
    // Also check file extension
    if (!isHeif && filename) {
      var ext = filename.toLowerCase().split('.').pop();
      if (ext === 'heif' || ext === 'heic') {
        isHeif = true;
      }
    }
    
    if (!isHeif) {
      return blob;
    }

    // Apps Script doesn't support HEIF conversion - skip these images
    console.log('Skipping HEIF image (not supported): ' + filename);
    return null;
    
  } catch (error) {
    console.error('Error in HEIF conversion: ' + error.toString());
    return blob;
  }
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

            // Extract file ID from Drive URL
            var fileId = extractDriveFileId(cellValue);
            if (!fileId) {
              console.log('Could not extract file ID from: ' + cellValue);
              continue;
            }

            var imageFile = DriveApp.getFileById(fileId);
            var imageBlob = imageFile.getBlob();
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
              var fileId = extractDriveFileId(row[c]);
              if (!fileId) {
                body.appendParagraph(label + ': ' + row[c]).setIndentFirstLine(20);
                continue;
              }

              var imageFile = DriveApp.getFileById(fileId);
              var imageBlob = imageFile.getBlob();
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
        const imageFile = DriveApp.getFileById(image.fileId);
        const imageBlob = imageFile.getBlob();

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
        const imageFile = DriveApp.getFileById(image.fileId);
        const imageBlob = imageFile.getBlob();

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

/**
 * TEST FUNCTION - Run reports for any address manually
 * Edit the TEST_ADDRESS below and run this function
 */
function testPropertyReport() {
  runReportFor(TEST_ADDRESS);
}

/**
 * Generate a property report for any address and email it to admin@.
 * Run from the Apps Script editor. Examples:
 *   runReportFor('13664 Stone Circle Unit 101')
 *   runReportFor('13737 Rock Point Unit 102')
 *   runReportFor('3510 Broadlands Lane')
 */
function runReportFor(address) {
  if (!address) {
    console.log('Usage: runReportFor("13664 Stone Circle Unit 101")');
    return;
  }
  const email = CONFIG.adminEmail;
  console.log('=== GENERATING REPORT ===');
  console.log('Address: ' + address);
  console.log('Sending to: ' + email);

  try {
    const standardized = HOALibrary.standardizeHOAAddress(address);
    const display = HOALibrary.getDisplayAddress(standardized);
    console.log('Standardized: ' + standardized + ' (' + display + ')');

    const reportData = gatherReportData(email, standardized, display, address);

    console.log('Data gathered. Generating sections...');
    const sections = generateAllSections(standardized, display, reportData);

    console.log('\nSections generated:');
    sections.forEach(function(s, i) {
      console.log('  ' + (i+1) + ') ' + s.label + '\n     ' + s.url);
    });

    console.log('\nSending report to: ' + email);
    sendPropertyReportEmail(email, display, sections);

    console.log('\nDone — check ' + email + ' for the report');
  } catch (error) {
    console.error('Failed: ' + error.toString());
    console.error(error.stack);
  }
}

/**
 * Quick test function for address standardization only
 */
function testAddressStandardization() {
  const testAddresses = [
    '13737 Rock Point Unit 102',
    '13737 Rock Pt #102',
    '13725 Plaster Point Dr Unit 101',
    '9102 Boulder Circle',
    '14589 Stone Cr Unit 101',    // Tests the Cr abbreviation
    '8734 Broadlands Lane',
    '12456 Boulder Point'
  ];
  
  console.log('=== ADDRESS STANDARDIZATION TEST ===\n');
  
  testAddresses.forEach(addr => {
    const standardized = HOALibrary.standardizeHOAAddress(addr);
    const building = HOALibrary.getBuildingAddress(addr);
    const unit = HOALibrary.getUnitFromAddress(addr);
    
    console.log('Input: ' + addr);
    console.log('  → Standardized: ' + standardized);
    console.log('  → Building: ' + building);
    console.log('  → Unit: ' + (unit || 'N/A'));
    console.log('');
  });
}
function testLibraryVersion() {                                                                                                                                                                  
    Logger.log('HOALibrary version: ' + HOALibrary.getVersion());                                                                                                                                  
    HOALibrary.logVersionInfo();                                                                                                                                                                   
  }   
function testKeystoneIntegration() {                                                                                                                                                             
    var testAddress = '13737 Rock Point Unit 102';                                                                                                                                                 
    Logger.log('Testing Keystone integration for: ' + testAddress);                                                                                                                                
                                                                                                                                                                                                   
    try {                                                                                                                                                                                          
      var profile = HOALibrary.getKeystoneProfileData(testAddress);                                                                                                                                
      Logger.log('Profile: ' + JSON.stringify(profile));                                                                                                                                           
                                                                                                                                                                                                   
      var violations = HOALibrary.getKeystoneViolations(testAddress);                                                                                                                              
      Logger.log('Violations: ' + violations.length);                                                                                                                                              
                                                                                                                                                                                                   
      var workOrders = HOALibrary.getKeystoneWorkOrders(testAddress, null);                                                                                                                        
      Logger.log('Work Orders: ' + workOrders.length);                                                                                                                                             
                                                                                                                                                                                                   
      var archReviews = HOALibrary.getKeystoneArchReviews(testAddress, null);                                                                                                                      
      Logger.log('Arch Reviews: ' + archReviews.length);                                                                                                                                           
                                                                                                                                                                                                   
      Logger.log('✓ Keystone integration working!');                                                                                                                                               
    } catch (error) {                                                                                                                                                                              
      Logger.log('✗ Error: ' + error.toString());                                                                                                                                                  
    }                                                                                                                                                                                              
  }                                                                                                                                                                                                



