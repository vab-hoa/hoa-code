/**
 * Direct test of Keystone functions - paste this into Apps Script editor and run
 */
function testKeystoneDirectly() {
  console.log('=== Testing Keystone Integration Directly ===\n');

  var testAddress = '13738 Rock Point Unit 101';
  console.log('Test address: ' + testAddress);

  // Test profile lookup
  console.log('\n--- Testing Profile Lookup ---');
  try {
    var profile = getKeystoneProfileData(testAddress);
    if (profile) {
      console.log('✅ Profile FOUND!');
      console.log('  Name: ' + profile.name);
      console.log('  Email: ' + profile.email);
      console.log('  Phone: ' + profile.phone);
    } else {
      console.log('❌ Profile not found');
    }
  } catch (e) {
    console.log('❌ Error: ' + e.toString());
  }

  // Test violations
  console.log('\n--- Testing Violations ---');
  try {
    var violations = getKeystoneViolations(testAddress);
    console.log('Found ' + violations.length + ' violations');
  } catch (e) {
    console.log('❌ Error: ' + e.toString());
  }

  // Test work orders
  console.log('\n--- Testing Work Orders ---');
  try {
    var workOrders = getKeystoneWorkOrders(testAddress, null);
    console.log('Found ' + workOrders.length + ' work orders');
  } catch (e) {
    console.log('❌ Error: ' + e.toString());
  }

  // Test arch reviews
  console.log('\n--- Testing Arch Reviews ---');
  try {
    var archReviews = getKeystoneArchReviews(testAddress, null);
    console.log('Found ' + archReviews.length + ' arch reviews');
  } catch (e) {
    console.log('❌ Error: ' + e.toString());
  }

  console.log('\n=== Test Complete ===');
}
