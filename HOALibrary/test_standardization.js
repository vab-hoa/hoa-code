/**
 * Test address standardization with full US addresses
 * Run this in Apps Script to test the fix
 */

function testAddressStandardizationWithZip() {
  console.log('=== Testing Address Standardization with Full US Addresses ===\n');

  const testCases = [
    // Keystone format (full US address with zip)
    '13738 Rock Point #101, Broomfield, CO 80023',
    '13747 Rock Point #102, Broomfield, CO 80023',
    '3522 Broadlands Lane #102, Broomfield, CO 80023',

    // Original formats (should still work)
    '13737 Rock Point Unit 102',
    '13737 Rock Pt #102',
    '13725 Plaster Point Dr Unit 101',
    '9102 Boulder Circle',

    // Edge cases
    '13737 Rock Point 101',  // No keyword
    '13737 Rock Point',  // No unit
  ];

  testCases.forEach(addr => {
    const standardized = standardizeHOAAddress(addr);
    const building = getBuildingAddress(addr);
    const unit = getUnitFromAddress(addr);

    console.log('Input: ' + addr);
    console.log('  → Standardized: ' + standardized);
    console.log('  → Building: ' + building);
    console.log('  → Unit: ' + (unit || 'N/A'));
    console.log('');
  });
}
