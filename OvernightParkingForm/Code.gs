const CONFIG = {
  boardEmail: 'board@villasboulders.org',
  managerEmail: 'manager@villasboulders.org',
  parentFolderId: '1MTV9Rbl79Kp1E0-oNEQbFZ6Kz5EC6pub',
};

function doGet() {
  const html = generateFormHTML();
  return HtmlService.createHtmlOutput(html)
    .setWidth(800)
    .setHeight(1200);
}

function generateFormHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Overnight Parking Request</title>
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
    input[type="date"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 13px;
      transition: border-color 0.3s;
    }
    input[type="text"]:focus,
    input[type="email"]:focus,
    input[type="tel"]:focus,
    input[type="date"]:focus {
      outline: none;
      border-color: #2d5f3f;
      box-shadow: 0 0 0 3px rgba(45,95,63,0.1);
    }
    .radio-group,
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .radio-item,
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    input[type="radio"],
    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .radio-item label,
    .checkbox-item label {
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
    .help-text {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
      font-weight: normal;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="header">
      <h1>Overnight Parking Request</h1>
      <p class="subtitle">Request a street parking permit</p>
    </div>

    <div class="form-content">
      <div id="message" class="message"></div>

      <form id="parkingForm">
        <!-- Contact Information -->
        <div class="form-section">
          <label for="email" class="required">Email</label>
          <input type="email" id="email" name="email" required>
        </div>

        <div class="form-section">
          <label for="contactName">Contact Name</label>
          <input type="text" id="contactName" name="contactName">
        </div>

        <div class="form-section">
          <label for="contactPhone">Contact Phone Number</label>
          <input type="tel" id="contactPhone" name="contactPhone">
        </div>

        <div class="form-section">
          <label for="streetAddress">Homeowner's Street Address</label>
          <input type="text" id="streetAddress" name="streetAddress" placeholder="e.g., 13737 Rock Pt, Unit 102">
        </div>

        <!-- Parking Dates -->
        <div class="form-section">
          <label for="firstNight">First Night of Requested Parking</label>
          <input type="date" id="firstNight" name="firstNight">
        </div>

        <div class="form-section">
          <label>Number of Nights Requested</label>
          <div class="radio-group">
            <div class="radio-item">
              <input type="radio" id="nights1" name="nights" value="1 Night">
              <label for="nights1">1 Night</label>
            </div>
            <div class="radio-item">
              <input type="radio" id="nights2" name="nights" value="2 Nights max">
              <label for="nights2">2 Nights max</label>
            </div>
          </div>
        </div>

        <!-- Vehicle Information -->
        <div class="form-section">
          <label>Vehicle Type</label>
          <div class="radio-group">
            <div class="radio-item">
              <input type="radio" id="vehicleCar" name="vehicleType" value="Passenger Car/Truck/Van">
              <label for="vehicleCar">Passenger Car/Truck/Van</label>
            </div>
            <div class="radio-item">
              <input type="radio" id="vehicleTrailer" name="vehicleType" value="Trailer/Camper/RV">
              <label for="vehicleTrailer">Trailer/Camper/RV</label>
            </div>
          </div>
        </div>

        <div class="form-section">
          <label for="vehicleMake">Vehicle Make</label>
          <input type="text" id="vehicleMake" name="vehicleMake">
        </div>

        <div class="form-section">
          <label for="vehicleModel">Vehicle Model</label>
          <input type="text" id="vehicleModel" name="vehicleModel">
        </div>

        <div class="form-section">
          <label for="licensePlate">Vehicle License Plate Number</label>
          <input type="text" id="licensePlate" name="licensePlate">
        </div>

        <div class="form-section">
          <label for="licenseState">Vehicle License Plate State</label>
          <input type="text" id="licenseState" name="licenseState" placeholder="e.g., CO" maxlength="2">
        </div>

        <!-- Acknowledgement -->
        <div class="form-section">
          <div class="checkbox-item">
            <input type="checkbox" id="acknowledgement" name="acknowledgement" required>
            <label for="acknowledgement">Vehicle or trailer MUST be parked directly in front of my own property</label>
          </div>
        </div>

        <!-- Buttons -->
        <div class="button-group">
          <button type="submit" id="submitBtn">Submit</button>
          <button type="reset" id="resetBtn">Clear</button>
        </div>
      </form>

      <div id="loading" class="loading">
        Processing your request...
      </div>
    </div>
  </div>

  <script>
    function showMessage(text, type) {
      const msgDiv = document.getElementById('message');
      msgDiv.textContent = text;
      msgDiv.className = 'message ' + type;
    }

    document.getElementById('parkingForm').addEventListener('submit', function(e) {
      e.preventDefault();

      if (!document.getElementById('parkingForm').checkValidity()) {
        showMessage('Please fill in all required fields', 'error');
        return;
      }

      document.getElementById('loading').classList.add('active');

      const formData = {
        email: document.getElementById('email').value,
        contactName: document.getElementById('contactName').value,
        contactPhone: document.getElementById('contactPhone').value,
        streetAddress: document.getElementById('streetAddress').value,
        firstNight: document.getElementById('firstNight').value,
        nights: document.querySelector('input[name="nights"]:checked')?.value || '',
        vehicleType: document.querySelector('input[name="vehicleType"]:checked')?.value || '',
        vehicleMake: document.getElementById('vehicleMake').value,
        vehicleModel: document.getElementById('vehicleModel').value,
        licensePlate: document.getElementById('licensePlate').value,
        licenseState: document.getElementById('licenseState').value,
        acknowledgement: document.getElementById('acknowledgement').checked,
        timestamp: new Date().toLocaleString(),
      };

      google.script.run
        .withSuccessHandler(function(result) {
          document.getElementById('loading').classList.remove('active');
          showMessage('Thank you! Your overnight parking request has been submitted.', 'success');
          document.getElementById('parkingForm').reset();
        })
        .withFailureHandler(function(error) {
          document.getElementById('loading').classList.remove('active');
          showMessage('Error submitting form: ' + error, 'error');
          console.error('Submission error:', error);
        })
        .submitParkingForm(formData);
    });
  </script>
</body>
</html>
  `;
}

function submitParkingForm(formData) {
  try {
    // Create PDF
    const pdfFileName = createParkingPDF(formData);

    // Send emails
    sendParkingEmails(formData, pdfFileName);

    return { success: true, fileName: pdfFileName };
  } catch (error) {
    console.error('Error in submitParkingForm:', error);
    throw new Error('Form submission failed: ' + error.message);
  }
}

function createParkingPDF(formData) {
  const doc = DocumentApp.create('Overnight Parking Request - ' + formData.email + ' - ' + formData.timestamp);
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
  const titleParagraph = body.appendParagraph('Overnight Parking Request');
  titleParagraph.setFontSize(16);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setForegroundColor('#1a3a52');
  titleParagraph.setSpacingBefore(0);
  titleParagraph.setSpacingAfter(0);

  body.appendParagraph('').setSpacingAfter(4);

  // Contact Information
  const contactTitle = body.appendParagraph('Contact Information');
  contactTitle.setBold(true);
  contactTitle.setFontSize(9);
  contactTitle.setForegroundColor('#1a3a52');
  contactTitle.setSpacingBefore(0);
  contactTitle.setSpacingAfter(2);

  if (formData.contactName) {
    const p = body.appendParagraph('Name: ' + formData.contactName);
    p.setFontSize(9);
    p.setSpacingBefore(0);
    p.setSpacingAfter(0);
  }

  const emailP = body.appendParagraph('Email: ' + formData.email);
  emailP.setFontSize(9);
  emailP.setSpacingBefore(0);
  emailP.setSpacingAfter(0);

  if (formData.contactPhone) {
    const phoneP = body.appendParagraph('Phone: ' + formData.contactPhone);
    phoneP.setFontSize(9);
    phoneP.setSpacingBefore(0);
    phoneP.setSpacingAfter(0);
  }

  if (formData.streetAddress) {
    const addrP = body.appendParagraph('Address: ' + formData.streetAddress);
    addrP.setFontSize(9);
    addrP.setSpacingBefore(0);
    addrP.setSpacingAfter(0);
  }

  body.appendParagraph('').setSpacingAfter(2);

  // Parking Details
  const parkingTitle = body.appendParagraph('Parking Details');
  parkingTitle.setBold(true);
  parkingTitle.setFontSize(9);
  parkingTitle.setForegroundColor('#1a3a52');
  parkingTitle.setSpacingBefore(0);
  parkingTitle.setSpacingAfter(2);

  if (formData.firstNight) {
    const dateP = body.appendParagraph('First Night: ' + formData.firstNight);
    dateP.setFontSize(9);
    dateP.setSpacingBefore(0);
    dateP.setSpacingAfter(0);
  }

  if (formData.nights) {
    const nightsP = body.appendParagraph('Duration: ' + formData.nights);
    nightsP.setFontSize(9);
    nightsP.setSpacingBefore(0);
    nightsP.setSpacingAfter(0);
  }

  body.appendParagraph('').setSpacingAfter(2);

  // Vehicle Information
  const vehicleTitle = body.appendParagraph('Vehicle Information');
  vehicleTitle.setBold(true);
  vehicleTitle.setFontSize(9);
  vehicleTitle.setForegroundColor('#1a3a52');
  vehicleTitle.setSpacingBefore(0);
  vehicleTitle.setSpacingAfter(2);

  if (formData.vehicleType) {
    const typeP = body.appendParagraph('Type: ' + formData.vehicleType);
    typeP.setFontSize(9);
    typeP.setSpacingBefore(0);
    typeP.setSpacingAfter(0);
  }

  if (formData.vehicleMake) {
    const makeP = body.appendParagraph('Make: ' + formData.vehicleMake);
    makeP.setFontSize(9);
    makeP.setSpacingBefore(0);
    makeP.setSpacingAfter(0);
  }

  if (formData.vehicleModel) {
    const modelP = body.appendParagraph('Model: ' + formData.vehicleModel);
    modelP.setFontSize(9);
    modelP.setSpacingBefore(0);
    modelP.setSpacingAfter(0);
  }

  if (formData.licensePlate || formData.licenseState) {
    const plateP = body.appendParagraph('License Plate: ' + (formData.licensePlate || '') + (formData.licenseState ? ' ' + formData.licenseState : ''));
    plateP.setFontSize(9);
    plateP.setSpacingBefore(0);
    plateP.setSpacingAfter(0);
  }

  const docId = doc.getId();
  doc.saveAndClose();

  const targetFolder = DriveApp.getFolderById(CONFIG.parentFolderId);
  const file = DriveApp.getFileById(docId);

  // Convert to PDF
  const pdfBlob = file.getAs('application/pdf');
  const pdfFile = targetFolder.createFile(pdfBlob)
    .setName('Parking Request - ' + formData.email + ' - ' + formData.timestamp + '.pdf');

  // Delete the Google Doc
  DriveApp.getFileById(docId).setTrashed(true);

  return pdfFile.getName();
}

function sendParkingEmails(formData, fileName) {
  const pdfFile = DriveApp.getFolderById(CONFIG.parentFolderId).getFilesByName(fileName).next();
  const pdfUrl = pdfFile.getUrl();

  const subject = 'Overnight Parking Request - ' + formData.email;

  const body = `
A new overnight parking request has been submitted.

Submitter: ${formData.contactName || formData.email}
Email: ${formData.email}
Phone: ${formData.contactPhone || 'Not provided'}
Address: ${formData.streetAddress || 'Not provided'}

Parking Request:
First Night: ${formData.firstNight || 'Not specified'}
Duration: ${formData.nights || 'Not specified'}

Vehicle:
Type: ${formData.vehicleType || 'Not specified'}
Make: ${formData.vehicleMake || 'Not specified'}
Model: ${formData.vehicleModel || 'Not specified'}
License Plate: ${formData.licensePlate || 'Not specified'} ${formData.licenseState || ''}

View PDF: ${pdfUrl}
  `;

  // Send to board
  GmailApp.sendEmail(CONFIG.boardEmail, subject, body);

  // Send to manager
  GmailApp.sendEmail(CONFIG.managerEmail, subject, body);
}
