// ARC Request Form - Apps Script Backend
// Serves HTML form and processes submissions

const CONFIG = {
  // Email recipient
  ARC_RECIPIENT: 'arcrecipients@villasboulders.org',

  // Drive folder for archiving (HOA Board Documents > ARC Request Forms)
  // Get from: https://drive.google.com/drive/folders/1-laNaFpH1eWuEs0f6_OtJ5Y0LkWXuUs7
  ARCHIVE_FOLDER_ID: '1-laNaFpH1eWuEs0f6_OtJ5Y0LkWXuUs7',

  // Josh Hall contact
  JOSH_HALL_EMAIL: 'hallj@keystonepacific.com',
  JOSH_HALL_PHONE: '(720) 617-3263',

  // PDF generation
  PDF_MARGIN_TOP: 0.75,
  PDF_MARGIN_BOTTOM: 0.75,
  PDF_MARGIN_LEFT: 0.75,
  PDF_MARGIN_RIGHT: 0.75
};

/**
 * Serves the HTML form as a web app
 */
function doGet(e) {
  const html = HtmlService.getResource('index')
    .getContent();
  return HtmlService.createHtmlOutput(html);
}

/**
 * Main form submission handler
 * @param {Object} formData - Form data including text fields and base64-encoded files
 */
function handleFormSubmission(formData) {
  try {
    // Validate form data
    validateFormData(formData);

    // Decode and process files
    const processedFiles = processFiles(formData.files || []);

    // Generate PDF
    const pdfBlob = generateArcPdf(formData);

    // Send email with all attachments
    sendSubmissionEmail(formData, pdfBlob, processedFiles);

    // Archive PDF to Drive
    archivePdfToDrive(formData, pdfBlob);

    return { success: true };
  } catch (error) {
    Logger.log('Error in handleFormSubmission: ' + error);
    throw new Error(error.message);
  }
}

/**
 * Validate required form fields
 */
function validateFormData(data) {
  const required = ['name', 'unitAddress', 'phone', 'email', 'description', 'completionDate', 'signature'];

  for (const field of required) {
    if (!data[field] || data[field].trim() === '') {
      throw new Error(`Required field missing: ${field}`);
    }
  }

  // Validate email format
  if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new Error('Invalid email format');
  }
}

/**
 * Process file uploads (decode base64 and create Blobs)
 */
function processFiles(encodedFiles) {
  const processedFiles = [];

  for (const file of encodedFiles) {
    const decodedBlob = Utilities.newBlob(
      Utilities.base64Decode(file.base64),
      file.mimeType,
      file.name
    );
    processedFiles.push({
      name: file.name,
      blob: decodedBlob,
      mimeType: file.mimeType
    });
  }

  return processedFiles;
}

/**
 * Generate PDF using Google Docs API
 */
function generateArcPdf(formData) {
  // Create a temporary Google Doc
  const doc = DocumentApp.create('ARC_Request_' + Date.now());
  const docId = doc.getId();

  try {
    const body = doc.getBody();

    // Clear default content
    body.clear();

    // Add header with VaB graphic and title
    addPdfHeader(body, formData.completionDate);

    // Add form fields
    addFormFields(body, formData);

    // Add supporting documentation list
    if (formData.files && formData.files.length > 0) {
      addSupportingDocumentation(body, formData.files);
    }

    // Add completion date
    addCompletionDate(body, formData.completionDate);

    // Add admonition text
    addAdmonitionText(body);

    // Add submission and signature
    addSignatureSection(body, formData);

    // Add Josh Hall contact
    addContactSection(body);

    // Add ARC Committee Action section
    addArcActionSection(body);

    // Save document
    doc.saveAndClose();

    // Export to PDF
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');

    // Delete temporary document
    DriveApp.getFileById(docId).setTrashed(true);

    return pdfBlob;
  } catch (error) {
    // Clean up on error
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (e) {}
    throw new Error('PDF generation failed: ' + error.message);
  }
}

/**
 * Add PDF header with date and title
 */
function addPdfHeader(body, completionDate) {
  // Submission date at top right
  const dateTable = body.appendTable([[formatDateString(new Date())]]);
  const dateCell = dateTable.getCell(0, 0);
  dateCell.getParagraph(0).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  dateCell.getParagraph(0).setFontSize(11);

  body.appendParagraph(''); // Space

  // Title (navy, bold, large)
  const titleParagraph = body.appendParagraph('VaB Architectural Review Request');
  titleParagraph.setFontSize(18);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setSpacingAfter(12);

  body.appendParagraph(''); // Space after header
}

/**
 * Add main form fields
 */
function addFormFields(body, formData) {
  const fields = [
    { label: 'Name', value: formData.name },
    { label: 'Unit Address in the Villas', value: formData.unitAddress },
    { label: 'Phone Number', value: formData.phone },
    { label: 'Email', value: formData.email },
    { label: 'Description of Improvements', value: formData.description }
  ];

  fields.forEach(field => {
    // Label (bold)
    const labelParagraph = body.appendParagraph(field.label);
    labelParagraph.setBold(true);
    labelParagraph.setFontSize(11);
    labelParagraph.setSpacingAfter(2);

    // Value
    const valueParagraph = body.appendParagraph(field.value);
    valueParagraph.setFontSize(11);
    valueParagraph.setSpacingAfter(10);
  });
}

/**
 * Add supporting documentation section
 */
function addSupportingDocumentation(body, files) {
  const label = body.appendParagraph('Supporting Documentation');
  label.setBold(true);
  label.setFontSize(11);
  label.setSpacingAfter(5);

  files.forEach(file => {
    const fileParagraph = body.appendParagraph('• ' + file.name);
    fileParagraph.setFontSize(10);
    fileParagraph.setSpacingAfter(3);
  });

  body.appendParagraph(''); // Space
}

/**
 * Add completion date
 */
function addCompletionDate(body, completionDate) {
  const label = body.appendParagraph('Planned (approximate) Completion Date');
  label.setBold(true);
  label.setFontSize(11);
  label.setSpacingAfter(2);

  const valueParagraph = body.appendParagraph(formatDateString(new Date(completionDate)));
  valueParagraph.setFontSize(11);
  valueParagraph.setSpacingAfter(15);
}

/**
 * Add admonition paragraph (italic)
 */
function addAdmonitionText(body) {
  const admonitionText = 'I understand that I must receive approval of the ARC in order to proceed. I understand that ARC approval does not constitute approval of the City and County of Broomfield and that I may be required to obtain a building permit. I understand that my improvements must be completed per specifications or approval, if granted, will be withdrawn. I understand and agree to the provisions of the ARC Design Guidelines of the Villas at the Boulders, including my responsibilities defined in Section II through V. If I am unable to complete my project within 3 months after approval, I understand that I must request an extension from the ARC.';

  const admonitionParagraph = body.appendParagraph(admonitionText);
  admonitionParagraph.setItalic(true);
  admonitionParagraph.setFontSize(10);
  admonitionParagraph.setLineSpacing(1.4);
  admonitionParagraph.setSpacingAfter(15);
}

/**
 * Add signature section
 */
function addSignatureSection(body, formData) {
  const submissionDateLabel = body.appendParagraph('Submission Date');
  submissionDateLabel.setBold(true);
  submissionDateLabel.setFontSize(11);
  submissionDateLabel.setSpacingAfter(2);

  const submissionDateValue = body.appendParagraph(formatDateString(new Date()));
  submissionDateValue.setFontSize(11);
  submissionDateValue.setSpacingAfter(10);

  const signatureLabel = body.appendParagraph('Homeowner Signature');
  signatureLabel.setBold(true);
  signatureLabel.setFontSize(11);
  signatureLabel.setSpacingAfter(2);

  const signatureValue = body.appendParagraph(formData.signature);
  signatureValue.setFontSize(11);
  signatureValue.setSpacingAfter(15);
}

/**
 * Add Josh Hall contact section
 */
function addContactSection(body) {
  const contactParagraph = body.appendParagraph(`Direct questions to Josh Hall (${CONFIG.JOSH_HALL_EMAIL}) or ${CONFIG.JOSH_HALL_PHONE}`);
  contactParagraph.setFontSize(10);
  contactParagraph.setSpacingAfter(15);

  // Add separator line
  body.appendParagraph('').setBorder(DocumentApp.BorderStyle.SOLID, DocumentApp.BorderColor.BLACK, 1);
}

/**
 * Add ARC Committee Action section
 */
function addArcActionSection(body) {
  const actionTitle = body.appendParagraph('ARC Committee Action:');
  actionTitle.setBold(true);
  actionTitle.setFontSize(12);
  actionTitle.setSpacingAfter(5);

  const checkboxesParagraph = body.appendParagraph('Approved: ___     Disapproved: ___     Final Inspection Required: ___');
  checkboxesParagraph.setFontSize(11);
  checkboxesParagraph.setSpacingAfter(8);

  const reasonsLabel = body.appendParagraph('Additional requirements or disapproval reasons:');
  reasonsLabel.setFontSize(11);
  reasonsLabel.setSpacingAfter(10);

  // Add space for handwritten notes
  const reasonsPlaceholder = body.appendParagraph('\n\n\n');
  reasonsPlaceholder.setFontSize(10);
}

/**
 * Format date as "Monday, August 31, 2026"
 */
function formatDateString(dateObj) {
  const options = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };

  return dateObj.toLocaleDateString('en-US', options);
}

/**
 * Send email with PDF and all attachments
 */
function sendSubmissionEmail(formData, pdfBlob, processedFiles) {
  const subject = `VaB ARC Request — ${formData.name} — ${formData.unitAddress}`;

  const body = `ARC Request Submission

Homeowner: ${formData.name}
Unit: ${formData.unitAddress}
Phone: ${formData.phone}
Email: ${formData.email}
Submission Date: ${formatDateString(new Date())}

Description of Improvements:
${formData.description}

Planned Completion: ${formatDateString(new Date(formData.completionDate))}

Supporting Documents:
${processedFiles.map(f => '• ' + f.name).join('\n')}

---
PDF form attached. All supporting documents and photos included as attachments.`;

  // Prepare attachments
  const attachments = [pdfBlob.setName(`ARC_Request_${formatFilenameFriendly(formData.unitAddress)}_${getTodayDate()}.pdf`)];
  attachments.push(...processedFiles.map(f => f.blob));

  // Send email
  GmailApp.sendEmail(
    CONFIG.ARC_RECIPIENT,
    subject,
    body,
    {
      attachments: attachments,
      replyTo: formData.email
    }
  );
}

/**
 * Archive PDF to Google Drive
 */
function archivePdfToDrive(formData, pdfBlob) {
  try {
    const folderIdOrUrl = CONFIG.ARCHIVE_FOLDER_ID;
    const folder = DriveApp.getFolderById(folderIdOrUrl);

    const fileName = `${formatFilenameFriendly(formData.name)}_${formatFilenameFriendly(formData.unitAddress)}_${getTodayDate()}.pdf`;
    const file = folder.createFile(pdfBlob.setName(fileName));

    // Optionally, set file permissions (already inherited from folder)
    Logger.log('Archived PDF to Drive: ' + file.getUrl());
  } catch (error) {
    Logger.log('Warning: Failed to archive to Drive: ' + error.message);
    // Don't throw - email already sent
  }
}

/**
 * Format filename: remove special chars, replace spaces with underscores
 */
function formatFilenameFriendly(text) {
  return text
    .replace(/[^a-zA-Z0-9\s\-]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .slice(0, 50); // Limit length
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
