/**
 * Email Service Module
 *
 * Handles all email communication for the Property Report system:
 * - Sending property reports to homeowners
 * - Sending access denied notifications to non-owners
 * - Sending error notifications when address cannot be found
 * - Sending admin notifications for system issues
 *
 * All emails respect the CONFIG.debugMode setting for testing.
 */

/**
 * Send the property report email
 */
function sendReportEmail(recipientEmail, address, pdfBlob) {
  const subject = 'Your Property Report - ' + address;

  const body = `Dear Homeowner,

Attached is your property report for ${address}.

This report includes:
- Account information from Keystone Property Management
- Violations, work orders, and architectural reviews
- Gutter maintenance records and photos
- Wood trim assessment data and photos

If you have questions about this report, please contact the HOA office.

Best regards,
Villas at the Boulders HOA`;

  const options = {
    attachments: pdfBlob ? [pdfBlob] : [],
    name: 'Villas HOA Property Reports'
  };

  if (CONFIG.debugMode) {
    console.log('DEBUG MODE: Would send to ' + recipientEmail);
    console.log('Sending to admin instead: ' + CONFIG.adminEmail);
    MailApp.sendEmail(CONFIG.adminEmail, '[TEST] ' + subject, body + '\n\n[TEST MODE - Would send to: ' + recipientEmail + ']', options);
  } else {
    MailApp.sendEmail(recipientEmail, subject, body, options);

    // CC to admin
    MailApp.sendEmail(CONFIG.adminEmail, 'Copy: ' + subject, 'Report sent to: ' + recipientEmail + '\n\n' + body, options);
  }

  console.log('Report emailed successfully');
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
