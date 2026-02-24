/**
 * Keystone Integration Functions for HOALibrary
 *
 * These functions read cached Keystone data from Google Sheets
 * and provide it to the Property Report system.
 *
 * Cache Spreadsheet ID: 1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ
 *
 * Sheet Structure:
 * - Profiles: Address, AccountNumber, AccountName, LastUpdated, Source
 * - Violations: Address, Date, Description, Status
 * - WorkOrders: Address, WO Number, Date Created, Type/Description, Vendor, Status
 * - ArchReviews: Address, Date, Description, Status
 *
 * Note: WorkOrders are unit-specific (match on exact unit address, not building level)
 */

// Keystone cache spreadsheet ID
var KEYSTONE_CACHE_SHEET_ID = '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ';

/**
 * Get Keystone profile data for a property
 *
 * @param {string} address - Property address (any format, will be standardized)
 * @return {object|null} Profile object {accountNumber, name, phone, email} or null if not found
 *
 * @example
 * var profile = getKeystoneProfileData("13737 Rock Point Unit 102");
 * if (profile) {
 *   console.log("Account: " + profile.accountNumber);
 *   console.log("Name: " + profile.name);
 * }
 */
function getKeystoneProfileData(address) {
  try {
    if (!address) {
      console.log('No address provided to getKeystoneProfileData');
      return null;
    }

    // Standardize the input address
    var searchAddress = standardizeHOAAddress(address);
    if (!searchAddress) {
      console.log('Could not standardize address: ' + address);
      return null;
    }

    // Open the cache spreadsheet
    var ss = SpreadsheetApp.openById(KEYSTONE_CACHE_SHEET_ID);
    var sheet = ss.getSheetByName('Profiles');

    if (!sheet) {
      console.log('Profiles sheet not found in Keystone cache');
      return null;
    }

    // Get all data
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      console.log('No profile data in Keystone cache');
      return null;
    }

    var headers = data[0];

    // Find column indices
    var addressCol = findColumnIndex(headers, ['address', 'property']);
    var nameCol = findColumnIndex(headers, ['name', 'owner']);
    var phoneCol = findColumnIndex(headers, ['phone', 'telephone']);
    var emailCol = findColumnIndex(headers, ['email', 'e-mail']);
    var accountCol = findColumnIndex(headers, ['account', 'account number', 'acct']);

    if (addressCol === -1) {
      console.log('Could not find address column in Profiles sheet');
      return null;
    }

    // Search for matching address
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // Skip empty rows and metadata rows
      if (!row[addressCol] || typeof row[addressCol] !== 'string') {
        continue;
      }

      var rowAddress = standardizeHOAAddress(row[addressCol]);

      // Match on standardized address
      if (rowAddress === searchAddress) {
        return {
          accountNumber: accountCol !== -1 ? String(row[accountCol] || '') : '',
          name: nameCol !== -1 ? String(row[nameCol] || '') : '',
          phone: phoneCol !== -1 ? String(row[phoneCol] || '') : '',
          email: emailCol !== -1 ? String(row[emailCol] || '') : ''
        };
      }
    }

    console.log('No profile found for address: ' + searchAddress);
    return null;

  } catch (error) {
    console.error('Error in getKeystoneProfileData: ' + error.toString());
    return null;
  }
}


/**
 * Get Keystone violations for a property
 *
 * @param {string} address - Property address (any format, will be standardized)
 * @return {Array} Array of violation objects [{date, description, status}] or empty array
 *
 * @example
 * var violations = getKeystoneViolations("13737 Rock Point Unit 102");
 * console.log("Found " + violations.length + " violations");
 */
function getKeystoneViolations(address) {
  try {
    if (!address) {
      console.log('No address provided to getKeystoneViolations');
      return [];
    }

    // Standardize the input address
    var searchAddress = standardizeHOAAddress(address);
    if (!searchAddress) {
      console.log('Could not standardize address: ' + address);
      return [];
    }

    // For violations, match at building level (violations apply to entire building)
    var searchBuilding = getBuildingAddress(searchAddress);

    // Open the cache spreadsheet
    var ss = SpreadsheetApp.openById(KEYSTONE_CACHE_SHEET_ID);
    var sheet = ss.getSheetByName('Violations');

    if (!sheet) {
      console.log('Violations sheet not found in Keystone cache');
      return [];
    }

    // Get all data
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      console.log('No violation data in Keystone cache');
      return [];
    }

    var headers = data[0];

    // Find column indices
    var addressCol = findColumnIndex(headers, ['address', 'property']);
    var dateCol = findColumnIndex(headers, ['date', 'violation date']);
    var descCol = findColumnIndex(headers, ['description', 'violation', 'details']);
    var statusCol = findColumnIndex(headers, ['status', 'state']);

    if (addressCol === -1) {
      console.log('Could not find address column in Violations sheet');
      return [];
    }

    var violations = [];

    // Search for matching violations
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // Skip empty rows and metadata rows
      if (!row[addressCol] || typeof row[addressCol] !== 'string') {
        continue;
      }

      var rowBuilding = getBuildingAddress(row[addressCol]);

      // Match on building address
      if (rowBuilding === searchBuilding) {
        violations.push({
          date: dateCol !== -1 ? String(row[dateCol] || '') : '',
          description: descCol !== -1 ? String(row[descCol] || '') : '',
          status: statusCol !== -1 ? String(row[statusCol] || '') : ''
        });
      }
    }

    console.log('Found ' + violations.length + ' violations for ' + searchBuilding);
    return violations;

  } catch (error) {
    console.error('Error in getKeystoneViolations: ' + error.toString());
    return [];
  }
}


/**
 * Get Keystone work orders for a property
 *
 * Work orders are unit-specific. Matches on exact standardized unit address.
 *
 * Sheet columns: Address | WO Number | Date Created | Type/Description | Vendor | Status
 *
 * @param {string} address - Property address (any format, will be standardized)
 * @param {string|null} status - Optional status filter ("Open", "Closed", etc.) or null for all
 * @return {Array} Array of work order objects [{woNumber, date, description, vendor, status}]
 *                 or empty array
 *
 * @example
 * // Get all work orders for a unit
 * var allOrders = getKeystoneWorkOrders("13738 Rock Point Unit 101", null);
 *
 * // Get only open work orders
 * var openOrders = getKeystoneWorkOrders("3555 Broadlands Lane Unit 102", "Open");
 */
function getKeystoneWorkOrders(address, status) {
  try {
    if (!address) {
      console.log('No address provided to getKeystoneWorkOrders');
      return [];
    }

    // Standardize the input address (unit-specific, e.g. "13738RP1")
    var searchAddress = standardizeHOAAddress(address);
    if (!searchAddress) {
      console.log('Could not standardize address: ' + address);
      return [];
    }

    // Open the cache spreadsheet
    var ss = SpreadsheetApp.openById(KEYSTONE_CACHE_SHEET_ID);
    var sheet = ss.getSheetByName('WorkOrders');

    if (!sheet) {
      console.log('WorkOrders sheet not found in Keystone cache');
      return [];
    }

    // Get all data
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      console.log('No work order data in Keystone cache');
      return [];
    }

    var headers = data[0];

    // Find column indices (matches new sheet structure)
    var addressCol = findColumnIndex(headers, ['address', 'property']);
    var woNumberCol = findColumnIndex(headers, ['wo number', 'work order number', 'wo#']);
    var dateCol = findColumnIndex(headers, ['date created', 'date', 'created', 'opened']);
    var descCol = findColumnIndex(headers, ['type/description', 'description', 'details', 'type']);
    var vendorCol = findColumnIndex(headers, ['vendor', 'assigned', 'contractor']);
    var statusCol = findColumnIndex(headers, ['status', 'state']);

    if (addressCol === -1) {
      console.log('Could not find address column in WorkOrders sheet');
      return [];
    }

    var workOrders = [];
    var statusFilter = status ? status.toString().toLowerCase() : null;

    // Search for matching work orders - unit-specific match
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // Skip empty rows
      if (!row[addressCol] || typeof row[addressCol] !== 'string') {
        continue;
      }

      // Work orders are unit-specific: match exact standardized address
      var rowAddress = row[addressCol].toString().trim();
      if (rowAddress !== searchAddress) {
        continue;
      }

      var orderStatus = statusCol !== -1 ? String(row[statusCol] || '') : '';

      // Apply status filter if provided
      if (statusFilter && orderStatus.toLowerCase().indexOf(statusFilter) === -1) {
        continue;
      }

      workOrders.push({
        woNumber: woNumberCol !== -1 ? String(row[woNumberCol] || '') : '',
        date: dateCol !== -1 ? String(row[dateCol] || '') : '',
        description: descCol !== -1 ? String(row[descCol] || '') : '',
        vendor: vendorCol !== -1 ? String(row[vendorCol] || '') : '',
        status: orderStatus
      });
    }

    var filterMsg = statusFilter ? ' (filtered by status: ' + status + ')' : '';
    console.log('Found ' + workOrders.length + ' work orders for ' + searchAddress + filterMsg);
    return workOrders;

  } catch (error) {
    console.error('Error in getKeystoneWorkOrders: ' + error.toString());
    return [];
  }
}


/**
 * Get Keystone architectural reviews for a property
 *
 * @param {string} address - Property address (any format, will be standardized)
 * @param {string|null} status - Optional status filter ("open", "closed", "all") or null for all
 * @return {Array} Array of arch review objects [{date, description, status}] or empty array
 *
 * @example
 * // Get all architectural reviews
 * var allReviews = getKeystoneArchReviews("13737 Rock Point Unit 102", null);
 *
 * // Get only open reviews
 * var openReviews = getKeystoneArchReviews("13737 Rock Point Unit 102", "open");
 */
function getKeystoneArchReviews(address, status) {
  try {
    if (!address) {
      console.log('No address provided to getKeystoneArchReviews');
      return [];
    }

    // Standardize the input address
    var searchAddress = standardizeHOAAddress(address);
    if (!searchAddress) {
      console.log('Could not standardize address: ' + address);
      return [];
    }

    // For arch reviews, match at building level
    var searchBuilding = getBuildingAddress(searchAddress);

    // Open the cache spreadsheet
    var ss = SpreadsheetApp.openById(KEYSTONE_CACHE_SHEET_ID);
    var sheet = ss.getSheetByName('ArchReviews');

    if (!sheet) {
      console.log('ArchReviews sheet not found in Keystone cache');
      return [];
    }

    // Get all data
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      console.log('No architectural review data in Keystone cache');
      return [];
    }

    var headers = data[0];

    // Find column indices
    var addressCol = findColumnIndex(headers, ['address', 'property']);
    var dateCol = findColumnIndex(headers, ['date', 'submitted', 'requested']);
    var descCol = findColumnIndex(headers, ['description', 'details', 'request']);
    var statusCol = findColumnIndex(headers, ['status', 'state']);

    if (addressCol === -1) {
      console.log('Could not find address column in ArchReviews sheet');
      return [];
    }

    var archReviews = [];
    var statusFilter = status ? status.toString().toLowerCase() : null;

    // Search for matching arch reviews
    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // Skip empty rows and metadata rows
      if (!row[addressCol] || typeof row[addressCol] !== 'string') {
        continue;
      }

      var rowBuilding = getBuildingAddress(row[addressCol]);

      // Match on building address
      if (rowBuilding === searchBuilding) {
        var reviewStatus = statusCol !== -1 ? String(row[statusCol] || '') : '';

        // Apply status filter if provided
        if (statusFilter && statusFilter !== 'all') {
          if (reviewStatus.toLowerCase().indexOf(statusFilter) === -1) {
            continue;
          }
        }

        archReviews.push({
          date: dateCol !== -1 ? String(row[dateCol] || '') : '',
          description: descCol !== -1 ? String(row[descCol] || '') : '',
          status: reviewStatus
        });
      }
    }

    var filterMsg = statusFilter ? ' (filtered by status: ' + status + ')' : '';
    console.log('Found ' + archReviews.length + ' architectural reviews for ' + searchBuilding + filterMsg);
    return archReviews;

  } catch (error) {
    console.error('Error in getKeystoneArchReviews: ' + error.toString());
    return [];
  }
}


/**
 * Helper function to find column index by multiple possible names
 *
 * @param {Array} headers - Array of header names
 * @param {Array} possibleNames - Array of possible column names to match
 * @return {number} Column index or -1 if not found
 */
function findColumnIndex(headers, possibleNames) {
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i].toString().toLowerCase().trim();
    for (var j = 0; j < possibleNames.length; j++) {
      if (header === possibleNames[j].toLowerCase() ||
          header.indexOf(possibleNames[j].toLowerCase()) !== -1) {
        return i;
      }
    }
  }
  return -1;
}
