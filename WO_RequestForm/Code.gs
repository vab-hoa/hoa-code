// Generic Form Backend - Works for ARC, LBC, or WO forms
// Just change the FORM_CONFIG to adapt to different forms

const FORM_CONFIG = {
  formName: 'Work Order',
  formTitle: 'VaB Work Order Request',
  formSubtitle: 'Submit maintenance or repair requests',
  recipient: 'woformrecipients@villasboulders.org',
  archiveFolderId: '1el4DDZDw6iVGkFDFKOI_x_AGLoUVA2jE',
  managerEmail: 'manager@villasboulders.org',
  fields: [
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'unitAddress', label: 'Unit Address in the Villas', type: 'text', required: true },
    { id: 'phone', label: 'Phone Number', type: 'tel', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'description', label: 'Briefly Describe Work to be Done', type: 'textarea', required: true },
    { id: 'otherInfo', label: 'Any Other Information Which Might be Needed?', type: 'textarea', required: false },
    { id: 'priority', label: 'Priority (1-10, 10 is High)', type: 'select', required: true, options: [
      {value: '1', label: '1 - Very Low'},
      {value: '2', label: '2'},
      {value: '3', label: '3'},
      {value: '4', label: '4'},
      {value: '5', label: '5 - Medium'},
      {value: '6', label: '6'},
      {value: '7', label: '7'},
      {value: '8', label: '8'},
      {value: '9', label: '9'},
      {value: '10', label: '10 - High/Urgent'}
    ]}
  ],
  pdfTitle: 'VaB Work Order Request',
  pdfSections: [
    { type: 'header', title: 'Work Order Request', subtitle: 'Maintenance and Repair Request' },
    { type: 'fields', fields: ['name', 'unitAddress', 'phone', 'email', 'description', 'otherInfo', 'priority'] },
    { type: 'management', title: 'Work Order Management' }
  ]
};

function doGet(e) {
  return HtmlService.createHtmlOutput(generateHTML()).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function generateHTML() {
  const fieldHtml = FORM_CONFIG.fields.map(field => {
    if (field.type === 'textarea') {
      return `<div class="form-group">
        <label for="${field.id}" ${field.required ? 'class="required"' : ''}>${field.label}</label>
        <textarea id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}></textarea>
      </div>`;
    } else if (field.type === 'select') {
      const options = field.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('\n');
      return `<div class="form-group">
        <label for="${field.id}" ${field.required ? 'class="required"' : ''}>${field.label}</label>
        <select id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}>
          <option value="">Select priority level</option>
          ${options}
        </select>
      </div>`;
    } else {
      return `<div class="form-group">
        <label for="${field.id}" ${field.required ? 'class="required"' : ''}>${field.label}</label>
        <input type="${field.type}" id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}>
      </div>`;
    }
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${FORM_CONFIG.formTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #f0f2f5 0%, #e8eaed 100%); padding: 20px; min-height: 100vh; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1a3a52 0%, #2d5f3f 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { font-size: 28px; margin-bottom: 5px; font-weight: bold; }
        .header p { font-size: 14px; opacity: 0.9; }
        .form-content { padding: 30px 20px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-weight: bold; color: #1a3a52; margin-bottom: 8px; font-size: 14px; }
        input[type="text"], input[type="email"], input[type="tel"], textarea, select { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-family: Arial, sans-serif; font-size: 14px; }
        textarea { resize: vertical; min-height: 100px; }
        .file-upload-label { display: block; padding: 20px; border: 2px dashed #2d5f3f; border-radius: 4px; text-align: center; cursor: pointer; background: #f8f9fa; }
        #fileInput { display: none; }
        .file-list { margin-top: 10px; display: grid; gap: 8px; }
        .file-item { display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 13px; }
        .file-item button { background: #ff4444; color: white; border: none; padding: 4px 8px; cursor: pointer; }
        .form-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 30px; }
        button { padding: 12px 20px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; }
        .btn-submit { background: #2d7d3a; color: white; grid-column: 1 / -1; }
        .btn-reset { background: #999; color: white; }
        .alert { padding: 15px; border-radius: 4px; margin-bottom: 15px; visibility: hidden; opacity: 0; transition: opacity 0.3s; }
        .alert.show { visibility: visible; opacity: 1; }
        .alert.success { background: #d4edda; color: #155724; border: 2px solid #28a745; }
        .alert.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .required::after { content: " *"; color: #ff4444; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${FORM_CONFIG.formTitle}</h1>
            <p>${FORM_CONFIG.formSubtitle}</p>
        </div>
        <div class="form-content">
            <div id="alert" class="alert"></div>
            <form id="mainForm">
                ${fieldHtml}
                <div class="form-group">
                    <label class="required">Supporting Documentation</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Upload up to 5 files (images will be auto-compressed)</p>
                    <div class="file-upload-wrapper">
                        <label for="fileInput" class="file-upload-label" id="dropZone">
                            <div>📁 Click to upload or drag files here</div>
                        </label>
                        <input type="file" id="fileInput" name="files" multiple accept=".jpg,.jpeg,.png,.pdf">
                    </div>
                    <div id="fileList" class="file-list"></div>
                </div>
                <div class="form-actions">
                    <button type="reset" class="btn-reset">Clear Form</button>
                    <button type="submit" class="btn-submit">Submit Request</button>
                </div>
            </form>
        </div>
    </div>
    <script>
        const MAX_FILES = 5, MAX_FILE_SIZE = 10 * 1024 * 1024, MAX_IMAGE_WIDTH = 800, MAX_IMAGE_HEIGHT = 600, JPEG_QUALITY = 0.8;
        let uploadedFiles = [];
        const dropZone = document.getElementById('dropZone'), fileInput = document.getElementById('fileInput'), fileList = document.getElementById('fileList'), mainForm = document.getElementById('mainForm'), alertDiv = document.getElementById('alert');

        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFiles(Array.from(e.dataTransfer.files)); });
        fileInput.addEventListener('change', (e) => { handleFiles(Array.from(e.target.files)); });

        function handleFiles(newFiles) {
            if (uploadedFiles.length + newFiles.length > MAX_FILES) { showAlert(\`Maximum \${MAX_FILES} files allowed\`, 'error'); return; }
            newFiles.forEach(file => {
                if (file.size > MAX_FILE_SIZE) { showAlert(\`File is too large\`, 'error'); return; }
                if (file.type.startsWith('image/')) {
                    compressImage(file).then(compressedBlob => {
                        uploadedFiles.push({ name: file.name, blob: compressedBlob, isImage: true });
                        renderFileList();
                    }).catch(() => { showAlert(\`Failed to compress file\`, 'error'); });
                } else if (file.type === 'application/pdf') {
                    uploadedFiles.push({ name: file.name, blob: file, isImage: false });
                    renderFileList();
                } else { showAlert(\`File type not supported\`, 'error'); }
            });
        }

        function compressImage(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width, height = img.height;
                        if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
                            const aspectRatio = width / height;
                            width = Math.min(width, MAX_IMAGE_WIDTH);
                            height = Math.round(width / aspectRatio);
                        }
                        canvas.width = width; canvas.height = height;
                        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        function renderFileList() {
            fileList.innerHTML = uploadedFiles.map((f, i) => \`<div class="file-item"><span>📄 \${f.name}</span><button type="button" onclick="removeFile(\${i})">Remove</button></div>\`).join('');
        }

        function removeFile(index) { uploadedFiles.splice(index, 1); fileInput.value = ''; renderFileList(); }
        function showAlert(message, type) { alertDiv.textContent = message; alertDiv.className = \`alert show \${type}\`; if (type !== 'loading') setTimeout(() => alertDiv.classList.remove('show'), 5000); }

        mainForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {};
            FORM_CONFIG.fields.forEach(f => { formData[f.id] = document.getElementById(f.id).value; });
            formData.files = [];

            showAlert('Submitting form...', 'loading');
            try {
                const filePromises = uploadedFiles.map(file => new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => { resolve({ name: file.name, base64: reader.result.split(',')[1], mimeType: file.blob.type }); };
                    reader.readAsDataURL(file.blob);
                }));
                formData.files = await Promise.all(filePromises);

                google.script.run
                    .withSuccessHandler((response) => {
                        if (response.success) {
                            showAlert('✓ Request submitted successfully!', 'success');
                            mainForm.reset();
                            uploadedFiles = [];
                            renderFileList();
                        } else { showAlert(\`Error: \${response.message}\`, 'error'); }
                    })
                    .withFailureHandler((error) => { showAlert(\`Error: \${error}\`, 'error'); })
                    .handleFormSubmission(formData);
            } catch (error) { showAlert('Error processing files', 'error'); }
        });
    </script>
</body>
</html>`;
}

function handleFormSubmission(formData) {
  const log = [];
  try {
    log.push('START');
    const requiredFields = FORM_CONFIG.fields.filter(f => f.required).map(f => f.id);
    for (const field of requiredFields) {
      if (!formData[field] || formData[field].trim() === '') throw new Error(`Required field missing: ${field}`);
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error('Invalid email format');

    const processedFiles = processFiles(formData.files || []);
    log.push('Files processed: ' + processedFiles.length);

    const pdfBlob = generatePdf(formData);
    log.push('PDF generated');

    sendSubmissionEmail(formData, pdfBlob, processedFiles);
    log.push('Email sent');

    sendHomeownerConfirmation(formData);
    log.push('Confirmation sent');

    archivePdfToDrive(formData, pdfBlob);
    log.push('Archived');

    return { success: true, message: 'Form submitted successfully', debug: log.join(' | ') };
  } catch (error) {
    log.push('ERROR: ' + error.message);
    return { success: false, message: error.message, debug: log.join(' | ') };
  }
}

function processFiles(encodedFiles) {
  return encodedFiles.map(file => ({
    name: file.name,
    blob: Utilities.newBlob(Utilities.base64Decode(file.base64), file.mimeType, file.name),
    mimeType: file.mimeType
  }));
}

function generatePdf(formData) {
  const doc = DocumentApp.create(`${FORM_CONFIG.formName}_Request_` + Date.now());
  const docId = doc.getId();
  try {
    const body = doc.getBody();
    body.clear();

    addLogo(body);
    addTitle(body);
    addFields(body, formData);
    addManagementSection(body);

    doc.saveAndClose();
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    DriveApp.getFileById(docId).setTrashed(true);
    return pdfBlob;
  } catch (error) {
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) {}
    throw new Error('PDF generation failed: ' + error.message);
  }
}

function addLogo(body) {
  try {
    const logoFile = DriveApp.getFileById('1SKxbUvO7YMl0cpYXFYMrdzvtw6sKhotQ');
    const logoImage = body.appendImage(logoFile.getBlob());
    logoImage.setWidth(450);
    logoImage.getParent().setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(0).setSpacingAfter(0);
  } catch (e) {}
}

function addTitle(body) {
  const title = body.appendParagraph(FORM_CONFIG.pdfTitle);
  title.setFontSize(16).setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setForegroundColor('#1a3a52').setSpacingBefore(0).setSpacingAfter(0);
}

function addFields(body, formData) {
  const fieldIds = FORM_CONFIG.fields.map(f => f.id);
  const rows = fieldIds.map(id => {
    const field = FORM_CONFIG.fields.find(f => f.id === id);
    return [field.label, formData[id] || '(None)'];
  });
  rows.push(['Submission Date', formatDateString(new Date())]);

  const table = body.appendTable(rows);
  table.setColumnWidth(0, 140).setColumnWidth(1, 310).setBorderColor('#dddddd');

  for (let i = 0; i < rows.length; i++) {
    const labelCell = table.getCell(i, 0);
    labelCell.clear().setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(4).setPaddingRight(4);
    labelCell.appendParagraph(rows[i][0]).setBold(true).setFontSize(9).setForegroundColor('#1a3a52').setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1.0);

    const valueCell = table.getCell(i, 1);
    valueCell.clear().setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(4).setPaddingRight(4);
    valueCell.appendParagraph(rows[i][1]).setFontSize(9).setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1.0);
  }
  body.appendParagraph('').setSpacingAfter(4);
}

function addManagementSection(body) {
  const title = body.appendParagraph(`${FORM_CONFIG.formName} Management`);
  title.setBold(true).setFontSize(9).setForegroundColor('#1a3a52').setSpacingBefore(0).setSpacingAfter(2);

  const status = body.appendParagraph('Status: ☐ Pending     ☐ In Progress     ☐ Completed');
  status.setFontSize(9).setSpacingBefore(0).setSpacingAfter(2);
}

function sendSubmissionEmail(formData, pdfBlob, processedFiles) {
  const subject = `VaB ${FORM_CONFIG.formName} Request — ${formData.name} — ${formData.unitAddress}`;
  const body = `${FORM_CONFIG.formName} Request Submission\n\nHomeowner: ${formData.name}\nSubmission Date: ${formatDateString(new Date())}`;

  const emailFileName = `${FORM_CONFIG.formName}_Request_${formatDateString(new Date()).replace(/\s+/g, '_')}.pdf`;
  const attachments = [pdfBlob.setName(emailFileName)];
  attachments.push(...processedFiles.map(f => f.blob));

  GmailApp.sendEmail(FORM_CONFIG.recipient, subject, body, { attachments: attachments, replyTo: formData.email });
}

function sendHomeownerConfirmation(formData) {
  const subject = `Confirmation: Your ${FORM_CONFIG.formName} Request`;
  const body = `Thank you for submitting your ${FORM_CONFIG.formName.toLowerCase()} request.\n\nYour request has been received and will be reviewed.`;
  GmailApp.sendEmail(formData.email, subject, body);
}

function archivePdfToDrive(formData, pdfBlob) {
  const folder = DriveApp.getFolderById(FORM_CONFIG.archiveFolderId);
  const fileName = `${formData.name}_${formData.unitAddress}_${getTodayDate()}.pdf`;
  const file = folder.createFile(pdfBlob);
  file.setName(fileName);
}

function formatDateString(dateObj) {
  return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getTodayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
