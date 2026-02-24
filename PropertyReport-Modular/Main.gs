/**
 * Main Module
 *
 * Contains the primary entry points for the Property Report system:
 * - onFormSubmit(): Triggered when a property report request is submitted
 * - testPropertyReport(): Manual testing function for development
 *
 * This module orchestrates the overall workflow:
 * 1. Validate the requester is a verified HOA owner
 * 2. Look up their property address
 * 3. Gather all report data from various sources
 * 4. Generate a PDF report
 * 5. Email the report to the owner
 */

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
    const reportData = gatherReportData(email, standardizedAddress, originalAddress, originalAddress);

    // Generate PDF report
    const pdf = generatePdfReport(standardizedAddress, reportData);

    if (!pdf) {
      console.error('Failed to generate PDF');
      notifyAdmin('Failed to generate PDF for ' + email + ' at ' + originalAddress);
      return;
    }

    // Send email with PDF
    const recipient = CONFIG.debugMode ? CONFIG.adminEmail : email;
    console.log('Sending report to: ' + recipient + (CONFIG.debugMode ? ' (debug mode)' : ''));

    sendReportEmail(recipient, originalAddress, pdf);

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
 * TEST FUNCTION - Run reports for any address manually
 * Edit the TEST_ADDRESS below and run this function
 */
function testPropertyReport() {
  // ===== CHANGE THIS ADDRESS TO TEST DIFFERENT PROPERTIES =====
  const TEST_ADDRESS = '3555 Broadlands Lane Unit 101';  // <-- Edit this!
  const TEST_EMAIL = 'admin@villasboulders.org';     // <-- Who gets the test report
  // ===========================================================

  console.log('=== MANUAL TEST RUN ===');
  console.log('Testing address: ' + TEST_ADDRESS);
  console.log('Sending report to: ' + TEST_EMAIL);

  // Create a fake homeowner object
  const testHomeowner = {
    name: 'Test Run',
    address: TEST_ADDRESS,
    email: TEST_EMAIL
  };

  try {
    // Gather report data
    console.log('Gathering report data...');
    // Standardize the test address
    const testStandardized = HOALibrary.standardizeHOAAddress(TEST_ADDRESS);
    const testDisplay = HOALibrary.getDisplayAddress(testStandardized);
    const reportData = gatherReportData(TEST_EMAIL, testStandardized, testDisplay, TEST_ADDRESS);

    console.log('\nData gathering results:');
    console.log('  Standardized: ' + reportData.standardizedAddress);
    console.log('  Building: ' + reportData.buildingAddress);
    console.log('  Unit: ' + (reportData.unitNumber || 'N/A'));
    console.log('  Gutters: ' + (reportData.gutters ? reportData.gutters.rows.length + ' rows' : 'none'));
    console.log('  Wood Trim: ' + (reportData.woodTrim ? reportData.woodTrim.rows.length + ' rows' : 'none'));
    console.log('  Keystone: ' + (reportData.keystone ? 'found' : 'none'));

    // Generate PDF
    console.log('\nGenerating PDF...');
    const pdf = generatePdfReport(TEST_ADDRESS, reportData);

    if (pdf) {
      console.log('PDF generated successfully!');

      // Send email
      console.log('Sending test report...');
      sendReportEmail(TEST_EMAIL, TEST_ADDRESS, pdf);

      console.log('\n✅ TEST COMPLETE - Check ' + TEST_EMAIL + ' for the report');
    } else {
      console.error('❌ PDF generation failed');
    }

  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error.toString());
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
