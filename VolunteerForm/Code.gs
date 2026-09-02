const CONFIG = {
  folderName: 'VaB Volunteer Forms',
  parentFolderId: '1MTV9Rbl79Kp1E0-oNEQbFZ6Kz5EC6pub',
  recipientEmail: 'board@villasboulders.org',
};

const COMMITTEES = [
  'Architectural Review Committee',
  'Landscape Beautification Committee',
  'LBC Weekend Workgroup',
  'Snow Squad',
  'Information Contact for my street with the board',
  'Board of Directors',
  'Website content editing/improvement',
  'Helping with the Newsletter',
  'Helping to greet new neighbors',
  'Helping to find group discount opportunities',
  'Anywhere I can be useful',
];

const AVAILABILITY_OPTIONS = [
  'Weekdays (Daytime)',
  'Weekdays (Evening)',
  'Weekends',
  'Flexible',
];

const SKILLS = [
  'Accounting/Finance/Cost Analysis',
  'Construction/Maintenance/Trade Skills',
  'Graphic Design/Photo Editing',
  'Writing/Editing',
  'Event Planning',
  'IT Skills',
  'Spreadsheet Skills',
  'Web Content Management',
  'Legal Skills/Contract Review',
  'Landscaping/Horticulture',
  'Project Management',
  'Other Skills',
  'No Special Skills',
];

function doGet() {
  const html = generateFormHTML();
  return HtmlService.createHtmlOutput(html)
    .setWidth(800)
    .setHeight(1400);
}

function generateFormHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>VaB Volunteer Interest Form</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #f0f2f5 0%, #e8eaed 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .form-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a3a52 0%, #2d5f3f 100%);
      color: white;
      padding: 15px 20px;
      text-align: center;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .subtitle {
      font-size: 13px;
      opacity: 0.9;
      margin-bottom: 0;
    }
    .form-content {
      padding: 20px;
    }
    .form-section {
      margin-bottom: 15px;
    }
    label {
      display: block;
      font-weight: bold;
      margin-bottom: 6px;
      color: #1a3a52;
      font-size: 13px;
    }
    .required::after {
      content: " *";
      color: #ff4444;
    }
    input[type="text"],
    input[type="email"],
    input[type="tel"],
    textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 13px;
      transition: border-color 0.3s;
    }
    textarea {
      resize: vertical;
      min-height: 80px;
    }
    input[type="text"]:focus,
    input[type="email"]:focus,
    input[type="tel"]:focus,
    textarea:focus {
      outline: none;
      border-color: #2d5f3f;
      box-shadow: 0 0 0 3px rgba(45,95,63,0.1);
    }
    .checkbox-group,
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .checkbox-item,
    .radio-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    input[type="checkbox"],
    input[type="radio"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .checkbox-item label,
    .radio-item label {
      margin: 0;
      font-weight: normal;
      font-size: 13px;
      cursor: pointer;
      flex: 1;
      color: #333;
    }
    .button-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 20px;
    }
    button {
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
    }
    #submitBtn {
      background-color: #2d7d3a;
      color: white;
      grid-column: 1 / -1;
    }
    #submitBtn:hover {
      background-color: #1a4d22;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(45,125,58,0.3);
    }
    #resetBtn {
      background-color: #999;
      color: white;
    }
    #resetBtn:hover {
      background-color: #666;
    }
    .message {
      display: none;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
      font-size: 13px;
      font-weight: bold;
    }
    .message.success {
      background-color: #d4edda;
      color: #155724;
      border: 2px solid #28a745;
      display: block;
    }
    .message.error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      display: block;
    }
    .loading {
      display: none;
      text-align: center;
      margin: 15px 0;
      color: #1a3a52;
      font-size: 13px;
    }
    .loading.active {
      display: block;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="header">
      <h1>VaB Volunteer Interest Form</h1>
      <p class="subtitle">Help us serve the community better</p>
    </div>

    <div class="form-content">
      <div id="message" class="message"></div>

      <form id="volunteerForm">
      <!-- Name Section -->
      <div class="form-section">
        <div style="display: flex; gap: 15px;">
          <div style="flex: 1;">
            <label for="firstName" class="required">First Name</label>
            <input type="text" id="firstName" name="firstName" required>
          </div>
          <div style="flex: 1;">
            <label for="lastName" class="required">Last Name</label>
            <input type="text" id="lastName" name="lastName" required>
          </div>
        </div>
      </div>

      <!-- Contact Section -->
      <div class="form-section">
        <label for="email" class="required">Email</label>
        <input type="email" id="email" name="email" required>
      </div>

      <div class="form-section">
        <label for="phone" class="required">Phone Number</label>
        <input type="tel" id="phone" name="phone" placeholder="(000) 000-0000" required>
      </div>

      <!-- Committees -->
      <div class="form-section">
        <label class="required">Preferred Committees/Groups for Volunteering</label>
        <div class="checkbox-group" id="committeesGroup">
          ${COMMITTEES.map(c => `
            <div class="checkbox-item">
              <input type="checkbox" id="committee_${sanitizeId(c)}" name="committees" value="${c}">
              <label for="committee_${sanitizeId(c)}">${c}</label>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Availability -->
      <div class="form-section">
        <label class="required">Availability Preference</label>
        <div class="radio-group" id="availabilityGroup">
          ${AVAILABILITY_OPTIONS.map(a => `
            <div class="radio-item">
              <input type="radio" id="availability_${sanitizeId(a)}" name="availability" value="${a}" required>
              <label for="availability_${sanitizeId(a)}">${a}</label>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Special Skills -->
      <div class="form-section">
        <label>Special Skills (optional)</label>
        <div class="checkbox-group" id="skillsGroup">
          ${SKILLS.map(s => `
            <div class="checkbox-item">
              <input type="checkbox" id="skill_${sanitizeId(s)}" name="skills" value="${s}">
              <label for="skill_${sanitizeId(s)}">${s}</label>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Additional Info -->
      <div class="form-section">
        <label for="contribution">How do you envision contributing, if you have some ideas?</label>
        <textarea id="contribution" name="contribution" placeholder="Share any ideas or thoughts..."></textarea>
      </div>

      <!-- Buttons -->
      <div class="button-group">
        <button type="submit" id="submitBtn">Submit</button>
        <button type="reset" id="resetBtn">Clear</button>
      </div>
    </form>

      <div id="loading" class="loading">
        Processing your submission...
      </div>
    </form>
    </div>
  </div>

  <script>
    function sanitizeId(str) {
      return str.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    }

    function showMessage(text, type) {
      const msgDiv = document.getElementById('message');
      msgDiv.textContent = text;
      msgDiv.className = 'message ' + type;
    }

    document.getElementById('volunteerForm').addEventListener('submit', function(e) {
      e.preventDefault();

      // Validate at least one committee is selected
      const committees = document.querySelectorAll('input[name="committees"]:checked');
      if (committees.length === 0) {
        showMessage('Please select at least one committee or group.', 'error');
        return;
      }

      document.getElementById('loading').classList.add('active');

      const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        committees: Array.from(committees).map(c => c.value),
        availability: document.querySelector('input[name="availability"]:checked').value,
        skills: Array.from(document.querySelectorAll('input[name="skills"]:checked')).map(s => s.value),
        contribution: document.getElementById('contribution').value,
        timestamp: new Date().toLocaleString(),
      };

      google.script.run
        .withSuccessHandler(function(result) {
          document.getElementById('loading').classList.remove('active');
          showMessage('Thank you! Your volunteer interest has been received. We will be in touch soon.', 'success');
          document.getElementById('volunteerForm').reset();
        })
        .withFailureHandler(function(error) {
          document.getElementById('loading').classList.remove('active');
          showMessage('Error submitting form: ' + error, 'error');
          console.error('Submission error:', error);
        })
        .submitVolunteerForm(formData);
    });
  </script>
</body>
</html>
  `;
}

function sanitizeId(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function submitVolunteerForm(formData) {
  try {
    // Create PDF
    const pdfFileName = createVolunteerPDF(formData);

    // Send email
    sendVolunteerEmail(formData, pdfFileName);

    return { success: true, fileName: pdfFileName };
  } catch (error) {
    console.error('Error in submitVolunteerForm:', error);
    throw new Error('Form submission failed: ' + error.message);
  }
}

function createVolunteerPDF(formData) {
  const doc = DocumentApp.create('VaB Volunteer Form - ' + formData.firstName + ' ' + formData.lastName + ' - ' + formData.timestamp);
  const body = doc.getBody();
  body.clear();

  // Header with decorative line
  const decorativeLine = body.appendParagraph('');
  decorativeLine.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  decorativeLine.setSpacingBefore(0);
  decorativeLine.setSpacingAfter(2);
  decorativeLine.setLineSpacing(0.5);
  const decoration = decorativeLine.editAsText();
  decoration.setText('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  decoration.setForegroundColor('#2d7d3a');
  decoration.setFontSize(9);

  // Title
  const titleParagraph = body.appendParagraph('VaB Volunteer Interest Form');
  titleParagraph.setFontSize(16);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setForegroundColor('#1a3a52');
  titleParagraph.setSpacingBefore(0);
  titleParagraph.setSpacingAfter(0);

  // Personal Information
  const nameP = body.appendParagraph(formData.firstName + ' ' + formData.lastName);
  nameP.setFontSize(9);
  nameP.setSpacingBefore(0);
  nameP.setSpacingAfter(0);

  const emailP = body.appendParagraph(formData.email);
  emailP.setFontSize(9);
  emailP.setSpacingBefore(0);
  emailP.setSpacingAfter(0);

  const phoneP = body.appendParagraph(formData.phone);
  phoneP.setFontSize(9);
  phoneP.setSpacingBefore(0);
  phoneP.setSpacingAfter(4);

  // Committees Section
  const committeesTitle = body.appendParagraph('Preferred Committees/Groups');
  committeesTitle.setBold(true);
  committeesTitle.setFontSize(9);
  committeesTitle.setForegroundColor('#1a3a52');
  committeesTitle.setSpacingBefore(0);
  committeesTitle.setSpacingAfter(2);

  formData.committees.forEach(c => {
    const p = body.appendParagraph('• ' + c);
    p.setFontSize(9);
    p.setForegroundColor('#333333');
    p.setSpacingBefore(0);
    p.setSpacingAfter(0);
  });

  body.appendParagraph('').setSpacingAfter(2);

  // Availability
  const availTitle = body.appendParagraph('Availability Preference');
  availTitle.setBold(true);
  availTitle.setFontSize(9);
  availTitle.setForegroundColor('#1a3a52');
  availTitle.setSpacingBefore(0);
  availTitle.setSpacingAfter(2);

  const availP = body.appendParagraph(formData.availability);
  availP.setFontSize(9);
  availP.setSpacingBefore(0);
  availP.setSpacingAfter(0);

  body.appendParagraph('').setSpacingAfter(2);

  // Skills
  if (formData.skills.length > 0) {
    const skillsTitle = body.appendParagraph('Special Skills');
    skillsTitle.setBold(true);
    skillsTitle.setFontSize(9);
    skillsTitle.setForegroundColor('#1a3a52');
    skillsTitle.setSpacingBefore(0);
    skillsTitle.setSpacingAfter(2);

    formData.skills.forEach(s => {
      const p = body.appendParagraph('• ' + s);
      p.setFontSize(9);
      p.setForegroundColor('#333333');
      p.setSpacingBefore(0);
      p.setSpacingAfter(0);
    });
    body.appendParagraph('').setSpacingAfter(2);
  }

  // Contribution
  if (formData.contribution.trim()) {
    const contribTitle = body.appendParagraph('How They Envision Contributing');
    contribTitle.setBold(true);
    contribTitle.setFontSize(9);
    contribTitle.setForegroundColor('#1a3a52');
    contribTitle.setSpacingBefore(0);
    contribTitle.setSpacingAfter(2);

    const contribP = body.appendParagraph(formData.contribution);
    contribP.setFontSize(9);
    contribP.setLineSpacing(1.0);
    contribP.setSpacingBefore(0);
    contribP.setSpacingAfter(0);
  }

  const docId = doc.getId();
  doc.saveAndClose();

  const targetFolder = DriveApp.getFolderById(CONFIG.parentFolderId);
  const file = DriveApp.getFileById(docId);

  // Convert to PDF
  const pdfBlob = file.getAs('application/pdf');
  const pdfFile = targetFolder.createFile(pdfBlob)
    .setName('VaB Volunteer Form - ' + formData.firstName + ' ' + formData.lastName + ' - ' + formData.timestamp + '.pdf');

  // Delete the Google Doc
  DriveApp.getFileById(docId).setTrashed(true);

  return pdfFile.getName();
}

function sendVolunteerEmail(formData, fileName) {
  const pdfFile = DriveApp.getFolderById(CONFIG.parentFolderId).getFilesByName(fileName).next();
  const pdfUrl = pdfFile.getUrl();

  const subject = 'New Volunteer Interest Form: ' + formData.firstName + ' ' + formData.lastName;

  const body = `
A new volunteer interest form has been submitted.

Name: ${formData.firstName} ${formData.lastName}
Email: ${formData.email}
Phone: ${formData.phone}
Submitted: ${formData.timestamp}

Preferred Committees/Groups:
${formData.committees.map(c => '• ' + c).join('\n')}

Availability: ${formData.availability}

${formData.skills.length > 0 ? 'Special Skills:\n' + formData.skills.map(s => '• ' + s).join('\n') + '\n\n' : ''}

${formData.contribution ? 'How They Envision Contributing:\n' + formData.contribution + '\n\n' : ''}

View PDF: ${pdfUrl}
  `;

  GmailApp.sendEmail(CONFIG.recipientEmail, subject, body);
}
