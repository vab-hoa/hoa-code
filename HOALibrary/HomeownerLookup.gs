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
 * Look up the homeowner(s) of a unit in HOA Contacts by the unit's address.
 *
 * Use this (not getHomeownerFromEmail) when reporting on a unit: a board member may
 * request a report on someone else's unit, and the report must show that unit's owners,
 * not the person who asked.
 *
 * Every contact whose address standardizes to the unit is included, so a unit with two
 * owners shows both: names joined " & ", emails and phones joined "; ".
 *
 * @param {string} standardizedAddress - Unit parcel code, e.g. "13713BP2"
 * @return {object|null} {name, address, email, phone} or null if no contact has that address
 */
function getHomeownerByAddress(standardizedAddress) {
  if (!standardizedAddress) return null;
  try {
    var names = [], emails = [], phones = [], address = '';
    var pageToken = null;
    do {
      var resp = People.People.Connections.list('people/me', {
        personFields: 'names,addresses,emailAddresses,phoneNumbers',
        pageSize: 1000,
        pageToken: pageToken
      });
      (resp.connections || []).forEach(function(person) {
        var matches = (person.addresses || []).some(function(a) {
          var text = a.formattedValue || a.streetAddress || '';
          return text && standardizeHOAAddress(text) === standardizedAddress;
        });
        if (!matches) return;
        if (person.names && person.names.length > 0) {
          var n = person.names[0];
          var full = n.displayName || [n.givenName, n.familyName].filter(Boolean).join(' ');
          if (full && names.indexOf(full) === -1) names.push(full);
        }
        (person.emailAddresses || []).forEach(function(e) {
          if (e.value && emails.indexOf(e.value) === -1) emails.push(e.value);
        });
        if (person.phoneNumbers && person.phoneNumbers.length > 0) {
          var p = person.phoneNumbers[0].value || '';
          if (p && phones.indexOf(p) === -1) phones.push(p);
        }
        if (!address) {
          var addr = person.addresses[0];
          address = addr.formattedValue || addr.streetAddress || '';
        }
      });
      pageToken = resp.nextPageToken;
    } while (pageToken);

    if (names.length === 0 && !address) return null;
    return {
      name: names.join(' & '),
      address: address,
      email: emails.join('; '),
      phone: phones.join('; ')
    };
  } catch (e) {
    console.error('Error looking up homeowner for ' + standardizedAddress + ': ' + e);
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