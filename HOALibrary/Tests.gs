/**
 * Test Functions
 * Run these to verify the library is working correctly
 */


function testHOAAddressStandardization() {
  console.log('=== HOA ADDRESS STANDARDIZATION TEST ===');
  
  const testCases = [
    // Building addresses
    ['13737 Rock Point Dr', '13737RP'],
    ['13737 Rock Pt', '13737RP'],
    ['13737 Rock Point', '13737RP'],
    
    // Unit addresses
    ['13737 Rock Point Dr Unit 102', '13737RP2'],
    ['13737 Rock Point Dr #102', '13737RP2'],
    ['13737 Rock Point 102', '13737RP2'],
    ['13737 Rock Pt. #102', '13737RP2'],
    ['13737 Rock Point Unit 101', '13737RP1'],
    
    // Other streets
    ['13725 Plaster Point Dr Unit 101', '13725PP1'],
    ['9102 Boulder Circle', '9102BC'],
    ['9102 Boulder Cir #102', '9102BC2'],
    ['14589 Stone Circle Unit 101', '14589SC1'],
    ['14589 Stone Cir 102', '14589SC2'],
    ['13664 Stone Cr #101', '13664SC1'],
    ['14589 Stone Cr 101', '14589SC1'],
    ['8734 Broadlands Lane', '8734BL'],
    ['8734 Broadlands Ln #101', '8734BL1'],
    ['12456 Boulder Point', '12456BP'],
    ['12456 Boulder Pt Unit 102', '12456BP2']
  ];
  
  for (const [input, expected] of testCases) {
    const result = standardizeHOAAddress(input);
    const status = result === expected ? '✓' : '✗';
    console.log(`${status} "${input}" -> "${result}" (expected: "${expected}")`);
  }
  
  console.log('\n=== BUILDING ADDRESS EXTRACTION TEST ===');
  
  const buildingTests = [
    ['13737RP2', '13737RP'],
    ['13737RP', '13737RP'],
    ['13737 Rock Point Unit 102', '13737RP']
  ];
  
  for (const [input, expected] of buildingTests) {
    const result = getBuildingAddress(input);
    const status = result === expected ? '✓' : '✗';
    console.log(`${status} "${input}" -> "${result}" (expected: "${expected}")`);
  }
}