/**
 * Homeowner Lookup Functions
 * Look up homeowner information from email addresses
 */


function getHomeownerFromEmail(email) {
  if (!email) return null;
  
  try {
    // Use People API to search contacts
    const people = People.People.searchContacts({
      query: email,
      readMask: 'names,addresses,emailAddresses,phoneNumbers'
    });
    
    if (!people.results || people.results.length === 0) {
      return null;
    }
    
    // Find matching contact
    for (const result of people.results) {
      const person = result.person;
      
      // Check if this contact has the email we're looking for
      const emails = person.emailAddresses || [];
      const hasEmail = emails.some(function(e) {
        return e.value.toLowerCase() === email.toLowerCase();
      });
      
      if (hasEmail) {
        // Get the name
        let name = '';
        if (person.names && person.names.length > 0) {
          const nameObj = person.names[0];
          name = nameObj.displayName || 
                 [nameObj.givenName, nameObj.familyName].filter(Boolean).join(' ') ||
                 '';
        }
        
        // Get the address
        let address = '';
        if (person.addresses && person.addresses.length > 0) {
          const addr = person.addresses[0];
          address = addr.formattedValue || addr.streetAddress || '';
        }

        // Get the phone
        let phone = '';
        if (person.phoneNumbers && person.phoneNumbers.length > 0) {
          phone = person.phoneNumbers[0].value || '';
        }

        if (name || address) {
          return {
            name: name,
            address: address,
            email: email,
            phone: phone
          };
        }
      }
    }
    
    return null;
  } catch (e) {
    console.error('Error looking up homeowner for ' + email + ':', e);
    return null;
  }
}


/**
 * Check if email is a member of the HOA board group.
 *
 * @param {string} email - Email to check
 * @return {boolean} True if active board member, false otherwise
 */
function isBoardMember(email) {
  if (!email) return false;
  try {
    const member = AdminDirectory.Members.get('board@villasboulders.org', email);
    if (member && member.status === 'ACTIVE') {
      console.log('Found ' + email + ' in board group');
      return true;
    }
  } catch (e) {
    // Not a member
  }
  return false;
}


/**
 * Check if email is in the HOA owners groups
 *
 * @param {string} email - Email to check
 * @return {boolean} - True if owner, false otherwise
 */
function isHOAOwner(email) {
  const groupsToCheck = [
    'owners@villasboulders.org',
    'owneroccupant@villasboulders.org',
    'nonoccupantowner@villasboulders.org'
  ];
  
  for (const group of groupsToCheck) {
    try {
      const member = AdminDirectory.Members.get(group, email);
      if (member && member.status === 'ACTIVE') {
        console.log('Found ' + email + ' in group: ' + group);
        return true;
      }
    } catch (e) {
      // Member not found in this group, continue
    }
  }
  
  return false;
}


/**
 * Get all rows from a spreadsheet that match a building
 * This handles the building vs unit address problem
 * 
 * @param {string} sheetId - The spreadsheet ID
 * @param {string} searchAddress - The address to search for (any format)
 * @param {object} options - {sheetName: string, addressColumn: number}
 * @return {object|null} - {headers: array, rows: array} or null
 */