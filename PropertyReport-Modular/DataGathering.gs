/**
 * Data Gathering Module
 *
 * Responsible for collecting all property data from various sources:
 * - Keystone Property Management data (profile, violations, work orders, arch reviews)
 * - Gutter maintenance records and photos from spreadsheets and Drive
 * - Wood trim assessment data from spreadsheets
 *
 * Functions in this module:
 * - gatherReportData(): Main orchestrator that collects all data
 * - getKeystoneData(): Fetches Keystone data using HOALibrary
 * - getKeystoneSheetData(): Legacy function for reading Keystone sheets directly
 * - getGutterFolderImages(): Finds and retrieves gutter photos from Drive
 * - getImagesFromFolder(): Helper to extract image files from a folder
 */

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
    generatedAt: new Date().toLocaleString(),
    gutters: null,
    woodTrim: null,
    keystone: null,
    gutterFolderImages: null
  };

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
 * Get gutter images from Drive folders using HOA standardization
 * @param {string} address - The property address (standardized)
 * @return {object} - {unitImages: [], buildingImages: [], unitFolderName: string, buildingFolderName: string}
 */
function getGutterFolderImages(address) {
  console.log('Looking for gutter images for: ' + address);

  try {
    // Find the Gutter Pictures folder (handles both folders and shortcuts)
    let gutterPicturesFolder = null;

    // Method 1: Direct search
    gutterPicturesFolder = findFolderOrShortcut('Gutter Pictures', null);

    if (!gutterPicturesFolder) {
      // Method 2: Search in HOA Board Documents/Gutters
      console.log('Searching in HOA Board Documents/Gutters...');
      const hoaFolder = findFolderOrShortcut('HOA Board Documents', null);
      if (hoaFolder) {
        const guttersFolder = findFolderOrShortcut('Gutters', hoaFolder);
        if (guttersFolder) {
          gutterPicturesFolder = findFolderOrShortcut('Gutter Pictures', guttersFolder);
        }
      }
    }

    if (!gutterPicturesFolder) {
      console.log('Could not find Gutter Pictures folder or shortcut');
      return {unitImages: [], buildingImages: []};
    }

    console.log('Successfully found Gutter Pictures folder');

    // Standardize the request address
    const requestStandardized = HOALibrary.standardizeHOAAddress(address);
    const requestBuilding = HOALibrary.getBuildingAddress(address);
    const requestUnit = HOALibrary.getUnitFromAddress(address);

    console.log('Request standardized: ' + requestStandardized + ' (building: ' + requestBuilding + ', unit: ' + requestUnit + ')');

    let unitFolder = null;
    let buildingFolder = null;
    let unitFolderName = '';
    let buildingFolderName = '';

    // Iterate through all folders and standardize their names for comparison
    const folders = gutterPicturesFolder.getFolders();

    while (folders.hasNext()) {
      const folder = folders.next();
      const folderName = folder.getName();

      // Standardize the folder name using the same HOA logic
      const folderStandardized = HOALibrary.standardizeHOAAddress(folderName);
      const folderBuilding = HOALibrary.getBuildingAddress(folderName);
      const folderUnit = HOALibrary.getUnitFromAddress(folderName);

      // Log only essential info
      // console.log('Checking folder: "' + folderName + '" -> "' + folderStandardized + '"');

      // Check for unit folder match
      if (requestUnit && folderStandardized === requestStandardized) {
        unitFolder = folder;
        unitFolderName = folderName;
        console.log('Found unit folder: ' + unitFolderName);
      }

      // Check for building folder match
      // Building folder = same building but NO unit number
      if (folderBuilding === requestBuilding && !folderUnit) {
        buildingFolder = folder;
        buildingFolderName = folderName;
        console.log('Found building folder: ' + buildingFolderName);
      }
    }

    // Get images from matched folders
    const unitImages = unitFolder ? getImagesFromFolder(unitFolder) : [];
    const buildingImages = buildingFolder ? getImagesFromFolder(buildingFolder) : [];

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

function getImagesFromFolder(folder) {
  const images = [];

  try {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();

      // Check if it's an image
      if (mimeType.startsWith('image/')) {
        const imageUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
        images.push({
          name: file.getName(),
          url: imageUrl
        });
      }
    }
  } catch (error) {
    console.error('Error reading folder images: ' + error.toString());
  }

  return images;
}
