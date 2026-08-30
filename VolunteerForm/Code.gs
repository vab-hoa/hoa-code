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
  <title>Volunteer Interest Form</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .form-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #333;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
      margin-bottom: 25px;
    }
    .form-section {
      margin-bottom: 25px;
    }
    label {
      display: block;
      font-weight: bold;
      margin-bottom: 8px;
      color: #333;
      font-size: 14px;
    }
    .required::after {
      content: " *";
      color: red;
    }
    input[type="text"],
    input[type="email"],
    input[type="tel"],
    textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 14px;
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
      border-color: #4CAF50;
      box-shadow: 0 0 5px rgba(76,175,80,0.3);
    }
    .checkbox-group,
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .checkbox-item,
    .radio-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    input[type="checkbox"],
    input[type="radio"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .checkbox-item label,
    .radio-item label {
      margin: 0;
      font-weight: normal;
      cursor: pointer;
      flex: 1;
    }
    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 30px;
    }
    button {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    #submitBtn {
      background-color: #4CAF50;
      color: white;
    }
    #submitBtn:hover {
      background-color: #45a049;
    }
    #resetBtn {
      background-color: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
    }
    #resetBtn:hover {
      background-color: #e0e0e0;
    }
    .message {
      display: none;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .message.success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
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
      margin: 20px 0;
    }
    .loading.active {
      display: block;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div id="message" class="message"></div>

    <h1>VaB Volunteer Interest Form</h1>
    <p class="subtitle">Help us serve the community better</p>

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
      <p>Processing your submission...</p>
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
  const style = {};

  // Title
  style.fontSize = 16;
  style.bold = true;
  body.appendParagraph('VaB Volunteer Interest Form')
    .setAttributes(style);
  body.appendParagraph('');

  // Submission date
  body.appendParagraph('Submission Date: ' + formData.timestamp);
  body.appendParagraph('');

  // Personal Information
  style.fontSize = 12;
  style.bold = true;
  body.appendParagraph('Personal Information')
    .setAttributes(style);

  style.bold = false;
  body.appendParagraph('Name: ' + formData.firstName + ' ' + formData.lastName)
    .setAttributes(style);
  body.appendParagraph('Email: ' + formData.email)
    .setAttributes(style);
  body.appendParagraph('Phone: ' + formData.phone)
    .setAttributes(style);
  body.appendParagraph('');

  // Committees
  style.bold = true;
  body.appendParagraph('Preferred Committees/Groups')
    .setAttributes(style);
  style.bold = false;
  formData.committees.forEach(c => {
    body.appendParagraph('• ' + c)
      .setAttributes(style);
  });
  body.appendParagraph('');

  // Availability
  style.bold = true;
  body.appendParagraph('Availability Preference')
    .setAttributes(style);
  style.bold = false;
  body.appendParagraph(formData.availability)
    .setAttributes(style);
  body.appendParagraph('');

  // Skills
  if (formData.skills.length > 0) {
    style.bold = true;
    body.appendParagraph('Special Skills')
      .setAttributes(style);
    style.bold = false;
    formData.skills.forEach(s => {
      body.appendParagraph('• ' + s)
        .setAttributes(style);
    });
    body.appendParagraph('');
  }

  // Contribution
  if (formData.contribution.trim()) {
    style.bold = true;
    body.appendParagraph('How They Envision Contributing')
      .setAttributes(style);
    style.bold = false;
    body.appendParagraph(formData.contribution)
      .setAttributes(style);
  }

  const docId = doc.getId();
  const targetFolder = DriveApp.getFolderById(CONFIG.parentFolderId);
  const file = DriveApp.getFileById(docId);
  targetFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // Convert to PDF
  const pdfBlob = file.getAs('application/pdf');
  const pdfFile = targetFolder.createFile(pdfBlob)
    .setName('VaB Volunteer Form - ' + formData.firstName + ' ' + formData.lastName + ' - ' + formData.timestamp + '.pdf');

  // Delete the Google Doc
  doc.deleteBody(doc.getBody());
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
