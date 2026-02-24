/**
 * Email Assembly and Section Orchestration
 * Generates all active sections and sends the property report email with links
 */

/**
 * Generate all active report sections for a property.
 * Returns array of {label, url} objects for inclusion in the email.
 */
function generateAllSections(address, displayAddress, data) {
  console.log('Generating all sections for ' + address);
  const sections = [];

  REPORT_CONFIG.sections.forEach(function(sectionConfig) {
    if (!sectionConfig.active) return;

    try {
      var result = null;
      if (sectionConfig.type === 'hoaAccount') {
        result = generateSectionHOAAccount(address, displayAddress, data);
      } else if (sectionConfig.type === 'propertyActivity') {
        result = generateSectionPropertyActivity(address, displayAddress, data);
      } else if (sectionConfig.type === 'gutters') {
        result = generateSectionGutters(address, displayAddress, data);
      } else if (sectionConfig.type === 'woodTrim') {
        result = generateSectionWoodTrim(address, displayAddress, data);
      } else {
        console.warn('Unknown section type: ' + sectionConfig.type);
        return;
      }

      if (result && result.url) {
        sections.push({ label: sectionConfig.label, url: result.url });
        console.log('Section ready: ' + sectionConfig.label + ' -> ' + result.url);
      }
    } catch (e) {
      console.error('Error generating section "' + sectionConfig.type + '": ' + e.toString());
      // Continue generating other sections even if one fails
    }
  });

  console.log('Generated ' + sections.length + ' sections');
  return sections;
}

/**
 * Send the property report email with section links.
 * No attachments — links only.
 */
function sendPropertyReportEmail(recipientEmail, displayAddress, sections) {
  const subject = 'Your Property Report - ' + displayAddress;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + REPORT_CONFIG.expiryDays);
  const expiryStr = expiryDate.toLocaleDateString('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // Build section list for plain text
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let plainTextSections = '';
  let htmlSections = '';

  sections.forEach(function(section, i) {
    const letter = alphabet[i] || (i + 1).toString();
    plainTextSections += '  ' + letter + ') ' + section.label + '\n     ' + section.url + '\n\n';
    htmlSections +=
      '<tr>' +
      '<td style="padding:10px 16px; vertical-align:top; font-weight:bold; white-space:nowrap; color:#555;">' +
        letter + ')' +
      '</td>' +
      '<td style="padding:10px 8px;">' +
        '<div style="font-size:15px; font-weight:600; color:#222;">' + section.label + '</div>' +
        '<div style="margin-top:6px;">' +
          '<a href="' + section.url + '" style="display:inline-block; padding:6px 14px; background:#1a73e8; color:#fff; text-decoration:none; border-radius:4px; font-size:13px;">View Section &rarr;</a>' +
        '</div>' +
      '</td>' +
      '</tr>';
  });

  const plainText =
    'Dear Homeowner,\n\n' +
    'Your property report for ' + displayAddress + ' is ready.\n\n' +
    'It contains the following sections:\n\n' +
    plainTextSections +
    'These links will expire on ' + expiryStr + '.\n\n' +
    'If you have questions about this report, please contact the HOA office at manager@villasboulders.org.\n\n' +
    'Villas at the Boulders HOA';

  const htmlBody =
    '<div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto;">' +
    '<h2 style="color:#1a3c5e; border-bottom:2px solid #1a73e8; padding-bottom:8px;">Property Report</h2>' +
    '<p style="font-size:16px; color:#333;">Your property report for <strong>' + displayAddress + '</strong> is ready.</p>' +
    '<table style="width:100%; border-collapse:collapse; margin:20px 0;">' +
    htmlSections +
    '</table>' +
    '<p style="color:#888; font-size:12px; border-top:1px solid #eee; padding-top:12px; margin-top:20px;">' +
      'These links will expire on <strong>' + expiryStr + '</strong>. ' +
      'Questions? Contact <a href="mailto:manager@villasboulders.org">manager@villasboulders.org</a>.' +
    '</p>' +
    '<p style="color:#666; font-size:12px;">Villas at the Boulders HOA</p>' +
    '</div>';

  const options = { htmlBody: htmlBody, name: 'Villas HOA Property Reports' };

  if (CONFIG.debugMode) {
    console.log('DEBUG MODE: Would send to ' + recipientEmail);
    MailApp.sendEmail(
      CONFIG.adminEmail,
      '[TEST] ' + subject,
      plainText + '\n\n[TEST MODE — would send to: ' + recipientEmail + ']',
      options
    );
  } else {
    MailApp.sendEmail(recipientEmail, subject, plainText, options);
    MailApp.sendEmail(
      CONFIG.adminEmail,
      'Copy: ' + subject,
      'Report sent to: ' + recipientEmail + '\n\n' + plainText,
      options
    );
  }

  console.log('Property report email sent to ' + recipientEmail);
}
