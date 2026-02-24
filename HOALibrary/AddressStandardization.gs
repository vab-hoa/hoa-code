/**
 * Address Standardization Functions for HOA
 * Convert addresses to compact HOA format
 */


function standardizeHOAAddress(address) {
  if (!address) return '';

  // Check if already in standardized format (e.g., "3555BL1", "13737RP")
  // Format: 4-5 digits + 2 uppercase letters + optional unit digit (1 or 2)
  const alreadyStandardized = address.toString().match(/^(\d{4,5})([A-Z]{2})([12]?)$/);
  if (alreadyStandardized) {
    return address.toString().toUpperCase();
  }

  // Street code mappings
  const STREET_CODES = {
    'broadlands': 'BL',
    'boulder point': 'BP',
    'rock point': 'RP',
    'stone circle': 'SC',
    'boulder circle': 'BC',
    'plaster point': 'PP'
  };
  
  // Common abbreviations for street types
  const ABBREVIATIONS = {
    'circle': ['circle', 'cir', 'cr', 'c'],
    'point': ['point', 'pt', 'p'],
    'lane': ['lane', 'ln', 'l']
  };
  
  // Normalize for processing
  let normalized = address.toString().toLowerCase().trim();
  
  // Extract street number (4-5 digits at start)
  const streetNumMatch = normalized.match(/^(\d{4,5})\b/);
  if (!streetNumMatch) {
    console.log('No valid street number found in: ' + address);
    return '';
  }
  const streetNumber = streetNumMatch[1];
  
  // Extract unit number if present (101 or 102)
  // Handle both formats: "#101" and "Unit 101"
  // Also handles addresses with full US formatting (city, state, zip after unit)
  let unitDigit = '';
  const unitMatch = normalized.match(/\b(?:#|unit|apt|apartment)\s*(\d{3})/i);
  if (unitMatch && (unitMatch[1] === '101' || unitMatch[1] === '102')) {
    unitDigit = unitMatch[1].slice(-1); // Get last digit (1 or 2)
  } else {
    // Check for standalone unit number (not at end due to zip codes)
    // Look for 101 or 102 that's NOT part of a 5-digit zip code
    const standaloneMatch = normalized.match(/\b(10[12])(?!\d)/);
    if (standaloneMatch) {
      unitDigit = standaloneMatch[1].slice(-1);
    }
  }
  
  // Find the street code
  let streetCode = '';
  
  // Remove unit info for cleaner street matching
  let streetSearch = normalized.replace(/(?:#|unit|apt|apartment)\s*\d+/gi, '');
  // Remove standalone unit numbers (101, 102) but not zip codes
  streetSearch = streetSearch.replace(/\b(10[12])(?!\d)/g, '');
  
  for (const [streetName, code] of Object.entries(STREET_CODES)) {
    // Split the street name into parts
    const streetParts = streetName.split(' ');
    let allPartsFound = true;
    
    for (let i = 0; i < streetParts.length; i++) {
      const part = streetParts[i];
      let partFound = false;
      
      // Check if this part has abbreviations
      const abbreviationList = ABBREVIATIONS[part];
      if (abbreviationList) {
        // Check all possible abbreviations
        for (const abbrev of abbreviationList) {
          // Create a regex that matches the abbreviation as a whole word
          const regex = new RegExp('\\b' + abbrev + '\\b', 'i');
          if (regex.test(streetSearch)) {
            partFound = true;
            break;
          }
        }
      } else {
        // No abbreviation list, check for exact word
        const regex = new RegExp('\\b' + part + '\\b', 'i');
        partFound = regex.test(streetSearch);
      }
      
      if (!partFound) {
        allPartsFound = false;
        break;
      }
    }
    
    if (allPartsFound) {
      streetCode = code;
      break;
    }
  }
  
  if (!streetCode) {
    console.log('Could not match street name in: ' + address);
    return streetNumber; // Return at least the street number
  }
  
  // Build the standardized address
  const standardized = streetNumber + streetCode + unitDigit;
  // Standardization debug removed
  return standardized;
}


/**
 * Extract building address from any address format
 * Examples:
 * - "13737RP2" -> "13737RP"
 * - "13737RP" -> "13737RP"
 * - "13737 Rock Point Unit 102" -> "13737RP"
 * 
 * @param {string} address - The address (any format)
 * @return {string} - Building address in standard format
 */
function getBuildingAddress(address) {
  const standardized = standardizeHOAAddress(address);
  // Remove unit digit if present
  return standardized.replace(/[12]$/, '');
}


/**
 * Get unit number from address (1, 2, or null)
 * 
 * @param {string} address - The address (any format)
 * @return {string|null} - Unit number ('1', '2') or null if building address
 */
function getUnitFromAddress(address) {
  const standardized = standardizeHOAAddress(address);
  const match = standardized.match(/([12])$/);
  return match ? match[1] : null;
}


/**
 * Convert standardized address back to display format
 * Examples:
 * - "13737RP2" -> "13737 Rock Point Unit 102"
 * - "13664SC1" -> "13664 Stone Circle Unit 101"
 * - "13650BC" -> "13650 Boulder Circle"
 * 
 * @param {string} standardized - The standardized address
 * @return {string} - Human-readable display address
 */
function getDisplayAddress(standardized) {
  if (!standardized) return '';
  
  // Extract components
  const streetNumMatch = standardized.match(/^(\d{4,5})/);
  if (!streetNumMatch) return standardized; // Can't parse, return as-is
  
  const streetNumber = streetNumMatch[1];
  const remainder = standardized.substring(streetNumber.length);
  
  // Street code to full name mapping
  const STREET_NAMES = {
    'BL': 'Broadlands',
    'BP': 'Boulder Point',
    'RP': 'Rock Point',
    'SC': 'Stone Circle',
    'BC': 'Boulder Circle',
    'PP': 'Plaster Point'
  };
  
  // Extract street code (2 letters) and optional unit digit
  const codeMatch = remainder.match(/^([A-Z]{2})([12]?)$/);
  if (!codeMatch) return standardized; // Can't parse
  
  const streetCode = codeMatch[1];
  const unitDigit = codeMatch[2];
  
  const streetName = STREET_NAMES[streetCode];
  if (!streetName) return standardized; // Unknown street code
  
  // Build display address
  let display = streetNumber + ' ' + streetName;
  
  if (unitDigit) {
    display += ' Unit 10' + unitDigit;
  }
  
  return display;
}