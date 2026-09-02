const CONFIG = {
  managerEmail: 'manager@villasboulders.org',
  boardEmail: 'board@villasboulders.org',
  parentFolderId: '1MTV9Rbl79Kp1E0-oNEQbFZ6Kz5EC6pub',
};

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Volunteer Expense Reimbursement Request</title>
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
    input[type="date"],
    input[type="number"],
    textarea {
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
    input[type="date"]:focus,
    input[type="number"]:focus,
    textarea:focus {
      outline: none;
      border-color: #2d5f3f;
      box-shadow: 0 0 0 3px rgba(45,95,63,0.1);
    }
    textarea {
      resize: vertical;
      min-height: 80px;
    }
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .radio-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    input[type="radio"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .radio-item label {
      margin: 0;
      font-weight: normal;
      font-size: 13px;
      cursor: pointer;
      flex: 1;
      color: #333;
    }
    .rating-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 5px;
      margin-top: 10px;
    }
    .rating-label {
      font-size: 12px;
      color: #666;
    }
    .rating-options {
      display: flex;
      gap: 10px;
      flex: 1;
      justify-content: center;
    }
    .rating-options label {
      margin: 0;
      font-weight: normal;
      font-size: 12px;
    }
    .file-upload-wrapper {
      position: relative;
    }
    .file-upload-label {
      display: inline-block;
      padding: 10px 15px;
      background: #2d7d3a;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      transition: background 0.3s;
    }
    .file-upload-label:hover {
      background: #1a4d22;
    }
    #fileInput {
      display: none;
    }
    .file-list {
      margin-top: 10px;
      display: grid;
      gap: 8px;
    }
    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 4px;
      font-size: 12px;
    }
    .file-item button {
      background: #ff4444;
      color: white;
      border: none;
      padding: 3px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }
    .file-item button:hover {
      background: #cc0000;
    }
    .help-text {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
      font-weight: normal;
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
      <h1>Volunteer Expense Reimbursement Request</h1>
      <p class="subtitle">Request reimbursement for volunteer expenses</p>
    </div>

    <div class="form-content">
      <div id="message" class="message"></div>

      <form id="expenseForm">
        <!-- Volunteer Name -->
        <div class="form-section">
          <label for="volunteerName" class="required">Volunteer Name (First and Last)</label>
          <input type="text" id="volunteerName" name="volunteerName" required>
        </div>

        <!-- Date -->
        <div class="form-section">
          <label for="date" class="required">Date</label>
          <input type="date" id="date" name="date" required>
        </div>

        <!-- Volunteer Activity -->
        <div class="form-section">
          <label for="activity" class="required">Volunteer Activity</label>
          <input type="text" id="activity" name="activity" placeholder="What volunteer activity were you doing?" required>
        </div>

        <!-- Description of Expense -->
        <div class="form-section">
          <label for="description" class="required">Description of Expense</label>
          <textarea id="description" name="description" placeholder="Describe what you spent money on..." required></textarea>
        </div>

        <!-- Amount -->
        <div class="form-section">
          <label for="amount" class="required">Amount you want reimbursed</label>
          <input type="number" id="amount" name="amount" step="0.01" min="0" placeholder="0.00" required>
        </div>

        <!-- File Upload -->
        <div class="form-section">
          <label class="required">Upload Receipt(s)</label>
          <p class="help-text">Upload up to 5 files. Max 10 MB per file. Supported: JPG, PNG, PDF</p>
          <div class="file-upload-wrapper">
            <label for="fileInput" class="file-upload-label">Add file</label>
            <input type="file" id="fileInput" name="files" multiple accept="image/jpeg,image/png,application/pdf">
          </div>
          <div id="fileList" class="file-list"></div>
        </div>

        <!-- Reimbursement Method -->
        <div class="form-section">
          <label class="required">Preferred Reimbursement Method</label>
          <div class="radio-group">
            <div class="radio-item">
              <input type="radio" id="hoa" name="reimbursement" value="Credit my HOA Account" required>
              <label for="hoa">Credit my HOA Account</label>
            </div>
            <div class="radio-item">
              <input type="radio" id="check" name="reimbursement" value="Check by Mail" required>
              <label for="check">Check by Mail</label>
            </div>
          </div>
        </div>

        <!-- Rating -->
        <div class="form-section">
          <label>Please rate the ease of submitting this reimbursement request</label>
          <div class="rating-group">
            <span class="rating-label">Very Difficult</span>
            <div class="rating-options">
              <label><input type="radio" name="rating" value="1"> 1</label>
              <label><input type="radio" name="rating" value="2"> 2</label>
              <label><input type="radio" name="rating" value="3"> 3</label>
              <label><input type="radio" name="rating" value="4"> 4</label>
              <label><input type="radio" name="rating" value="5"> 5</label>
            </div>
            <span class="rating-label">Very Easy</span>
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
    const MAX_FILES = 5;
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    let uploadedFiles = [];

    function showMessage(text, type) {
      const msgDiv = document.getElementById('message');
      msgDiv.textContent = text;
      msgDiv.className = 'message ' + type;
    }

    function renderFileList() {
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';
      uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        const sizeKb = Math.round(file.size / 1024);
        item.innerHTML = \`
          <span>📄 \${file.name} (\${sizeKb} KB)</span>
          <button type="button" onclick="removeFile(\${index})">Remove</button>
        \`;
        fileList.appendChild(item);
      });
    }

    function removeFile(index) {
      uploadedFiles.splice(index, 1);
      document.getElementById('fileInput').value = '';
      renderFileList();
    }

    document.getElementById('fileInput').addEventListener('change', function(e) {
      const newFiles = Array.from(e.target.files);

      if (uploadedFiles.length + newFiles.length > MAX_FILES) {
        showMessage('Maximum 5 files allowed', 'error');
        return;
      }

      newFiles.forEach(file => {
        if (file.size > MAX_FILE_SIZE) {
          showMessage('File "' + file.name + '" exceeds 10 MB limit', 'error');
          return;
        }
        uploadedFiles.push(file);
      });

      renderFileList();
    });

    document.getElementById('expenseForm').addEventListener('submit', function(e) {
      e.preventDefault();

      if (!document.getElementById('expenseForm').checkValidity()) {
        showMessage('Please fill in all required fields', 'error');
        return;
      }

      if (uploadedFiles.length === 0) {
        showMessage('Please upload at least one receipt', 'error');
        return;
      }

      document.getElementById('loading').classList.add('active');

      const filePromises = uploadedFiles.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              base64: reader.result.split(',')[1],
              mimeType: file.type || 'application/octet-stream'
            });
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      });

      Promise.all(filePromises).then(files => {
        const formData = {
          volunteerName: document.getElementById('volunteerName').value,
          date: document.getElementById('date').value,
          activity: document.getElementById('activity').value,
          description: document.getElementById('description').value,
          amount: document.getElementById('amount').value,
          reimbursement: document.querySelector('input[name="reimbursement"]:checked').value,
          rating: document.querySelector('input[name="rating"]:checked')?.value || '',
          files: files,
          timestamp: new Date().toLocaleString(),
        };

        google.script.run
          .withSuccessHandler(function(result) {
            document.getElementById('loading').classList.remove('active');
            showMessage('Thank you! Your expense reimbursement request has been submitted.', 'success');
            document.getElementById('expenseForm').reset();
            uploadedFiles = [];
            renderFileList();
          })
          .withFailureHandler(function(error) {
            document.getElementById('loading').classList.remove('active');
            showMessage('Error submitting form: ' + error, 'error');
            console.error('Submission error:', error);
          })
          .submitExpenseForm(formData);
      }).catch(error => {
        document.getElementById('loading').classList.remove('active');
        showMessage('Error processing files: ' + error, 'error');
      });
    });
  </script>
</body>
</html>
  `;
}

function submitExpenseForm(formData) {
  try {
    // Process uploaded files
    const processedFiles = processFiles(formData.files || []);

    const pdfFileName = createExpensePDF(formData);
    sendExpenseEmails(formData, pdfFileName, processedFiles);
    return { success: true, fileName: pdfFileName };
  } catch (error) {
    console.error('Error in submitExpenseForm:', error);
    throw new Error('Form submission failed: ' + error.message);
  }
}

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

function createExpensePDF(formData) {
  const doc = DocumentApp.create('Expense Reimbursement - ' + formData.volunteerName + ' - ' + formData.timestamp);
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
  const titleParagraph = body.appendParagraph('Volunteer Expense Reimbursement Request');
  titleParagraph.setFontSize(16);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setForegroundColor('#1a3a52');
  titleParagraph.setSpacingBefore(0);
  titleParagraph.setSpacingAfter(0);

  body.appendParagraph('').setSpacingAfter(4);

  // Request Details
  const detailsTitle = body.appendParagraph('Request Details');
  detailsTitle.setBold(true);
  detailsTitle.setFontSize(9);
  detailsTitle.setForegroundColor('#1a3a52');
  detailsTitle.setSpacingBefore(0);
  detailsTitle.setSpacingAfter(2);

  const nameP = body.appendParagraph('Volunteer: ' + formData.volunteerName);
  nameP.setFontSize(9);
  nameP.setSpacingBefore(0);
  nameP.setSpacingAfter(0);

  const dateP = body.appendParagraph('Date: ' + formData.date);
  dateP.setFontSize(9);
  dateP.setSpacingBefore(0);
  dateP.setSpacingAfter(0);

  const activityP = body.appendParagraph('Activity: ' + formData.activity);
  activityP.setFontSize(9);
  activityP.setSpacingBefore(0);
  activityP.setSpacingAfter(0);

  body.appendParagraph('').setSpacingAfter(2);

  // Expense Details
  const expenseTitle = body.appendParagraph('Expense Details');
  expenseTitle.setBold(true);
  expenseTitle.setFontSize(9);
  expenseTitle.setForegroundColor('#1a3a52');
  expenseTitle.setSpacingBefore(0);
  expenseTitle.setSpacingAfter(2);

  const descP = body.appendParagraph(formData.description);
  descP.setFontSize(9);
  descP.setLineSpacing(1.0);
  descP.setSpacingBefore(0);
  descP.setSpacingAfter(0);

  body.appendParagraph('').setSpacingAfter(2);

  // Amount
  const amountTitle = body.appendParagraph('Reimbursement Amount');
  amountTitle.setBold(true);
  amountTitle.setFontSize(9);
  amountTitle.setForegroundColor('#1a3a52');
  amountTitle.setSpacingBefore(0);
  amountTitle.setSpacingAfter(2);

  const amountP = body.appendParagraph('$' + parseFloat(formData.amount).toFixed(2));
  amountP.setFontSize(9);
  amountP.setSpacingBefore(0);
  amountP.setSpacingAfter(0);

  body.appendParagraph('').setSpacingAfter(2);

  // Method
  const methodTitle = body.appendParagraph('Preferred Reimbursement Method');
  methodTitle.setBold(true);
  methodTitle.setFontSize(9);
  methodTitle.setForegroundColor('#1a3a52');
  methodTitle.setSpacingBefore(0);
  methodTitle.setSpacingAfter(2);

  const methodP = body.appendParagraph(formData.reimbursement);
  methodP.setFontSize(9);
  methodP.setSpacingBefore(0);
  methodP.setSpacingAfter(0);

  if (formData.rating) {
    body.appendParagraph('').setSpacingAfter(2);
    const ratingTitle = body.appendParagraph('Form Ease Rating');
    ratingTitle.setBold(true);
    ratingTitle.setFontSize(9);
    ratingTitle.setForegroundColor('#1a3a52');
    ratingTitle.setSpacingBefore(0);
    ratingTitle.setSpacingAfter(2);

    const ratingP = body.appendParagraph(formData.rating + ' out of 5');
    ratingP.setFontSize(9);
    ratingP.setSpacingBefore(0);
    ratingP.setSpacingAfter(0);
  }

  const docId = doc.getId();
  doc.saveAndClose();

  const targetFolder = DriveApp.getFolderById(CONFIG.parentFolderId);
  const file = DriveApp.getFileById(docId);

  const pdfBlob = file.getAs('application/pdf');
  const pdfFile = targetFolder.createFile(pdfBlob)
    .setName('Expense Reimbursement - ' + formData.volunteerName + ' - ' + formData.timestamp + '.pdf');

  DriveApp.getFileById(docId).setTrashed(true);

  return pdfFile.getName();
}

function sendExpenseEmails(formData, fileName, processedFiles) {
  const pdfFile = DriveApp.getFolderById(CONFIG.parentFolderId).getFilesByName(fileName).next();
  const pdfUrl = pdfFile.getUrl();

  const subject = 'Expense Reimbursement Request - ' + formData.volunteerName;

  const body = `
A new expense reimbursement request has been submitted.

Volunteer: ${formData.volunteerName}
Date: ${formData.date}
Activity: ${formData.activity}

Expense Description:
${formData.description}

Amount Requested: $${parseFloat(formData.amount).toFixed(2)}
Reimbursement Method: ${formData.reimbursement}

${formData.rating ? 'Form Ease Rating: ' + formData.rating + ' out of 5\n' : ''}

Receipts: ${processedFiles.length} file(s) attached

View PDF: ${pdfUrl}
  `;

  const pdfFileName = `Expense_Request_${formData.volunteerName.replace(/\s+/g, '_')}_${formData.date}.pdf`;
  const attachments = [pdfFile.getBlob().setName(pdfFileName)];
  attachments.push(...processedFiles.map(f => f.blob));

  GmailApp.sendEmail(CONFIG.managerEmail, subject, body, { attachments: attachments });
  GmailApp.sendEmail(CONFIG.boardEmail, subject, body, { attachments: attachments });
}
