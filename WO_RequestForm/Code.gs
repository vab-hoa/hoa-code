// Work Order Request Form - Apps Script Backend
// Serves HTML form and processes submissions

const CONFIG = {
  // Email recipient
  WO_RECIPIENT: 'workorders@villasboulders.org',

  // Drive folder for archiving (HOA Board Documents > Work Order Request Forms)
  ARCHIVE_FOLDER_ID: '1-laNaFpH1eWuEs0f6_OtJ5Y0LkWXuUs7',

  // Manager contact
  MANAGER_EMAIL: 'manager@villasboulders.org',
  MANAGER_PHONE: '(TBD)'
};

const HTML_FORM = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VaB Work Order Request</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #f0f2f5 0%, #e8eaed 100%);
            padding: 20px;
            min-height: 100vh;
        }

        .container {
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
            padding: 30px 20px;
            text-align: center;
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .header p {
            font-size: 14px;
            opacity: 0.9;
        }

        .form-content {
            padding: 30px 20px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            font-weight: bold;
            color: #1a3a52;
            margin-bottom: 8px;
            font-size: 14px;
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        textarea,
        select {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            transition: border-color 0.3s;
        }

        input[type="text"]:focus,
        input[type="email"]:focus,
        input[type="tel"]:focus,
        textarea:focus,
        select:focus {
            outline: none;
            border-color: #2d5f3f;
            box-shadow: 0 0 0 3px rgba(45,95,63,0.1);
        }

        textarea {
            resize: vertical;
            min-height: 100px;
            font-size: 13px;
        }

        .priority-container {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .priority-container select {
            width: 150px;
        }

        .priority-label {
            font-size: 12px;
            color: #666;
            font-style: italic;
        }

        .file-upload-wrapper {
            position: relative;
        }

        .file-upload-label {
            display: block;
            padding: 20px;
            border: 2px dashed #2d5f3f;
            border-radius: 4px;
            text-align: center;
            cursor: pointer;
            background: #f8f9fa;
            transition: background 0.3s;
        }

        .file-upload-label:hover {
            background: #f0f2f5;
        }

        .file-upload-label.drag-over {
            background: #e8f5e9;
            border-color: #2d7d3a;
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
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 13px;
        }

        .file-item button {
            background: #ff4444;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        .file-item button:hover {
            background: #cc0000;
        }

        .file-size {
            color: #666;
            font-size: 12px;
        }

        .form-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 30px;
        }

        button {
            padding: 12px 20px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-submit {
            background: #2d7d3a;
            color: white;
            grid-column: 1 / -1;
        }

        .btn-submit:hover:not(:disabled) {
            background: #1a4d22;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(45,125,58,0.3);
        }

        .btn-submit:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .btn-reset {
            background: #999;
            color: white;
        }

        .btn-reset:hover {
            background: #666;
        }

        .alert {
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            margin-top: 0;
            visibility: hidden;
            opacity: 0;
            transition: opacity 0.3s ease, visibility 0.3s ease;
            font-weight: bold;
            z-index: 1000;
            position: relative;
            height: auto;
            overflow: visible;
        }

        .alert.show {
            visibility: visible;
            opacity: 1;
        }

        .alert.success {
            background: #d4edda;
            color: #155724;
            border: 2px solid #28a745;
        }

        .alert.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .alert.loading {
            background: #e7f3ff;
            color: #004085;
            border: 1px solid #b8daff;
        }

        .required::after {
            content: " *";
            color: #ff4444;
        }

        @media (max-width: 600px) {
            .container {
                border-radius: 0;
            }

            .form-content {
                padding: 20px 15px;
            }

            .header {
                padding: 20px 15px;
            }

            .header h1 {
                font-size: 22px;
            }

            .form-actions {
                grid-template-columns: 1fr;
            }

            .priority-container {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VaB Work Order Request</h1>
            <p>Submit maintenance or repair requests</p>
        </div>

        <div class="form-content">
            <div id="alert" class="alert"></div>

            <form id="woForm">
                <div class="form-group">
                    <label for="name" class="required">Name</label>
                    <input type="text" id="name" name="name" placeholder="Full name" required>
                </div>

                <div class="form-group">
                    <label for="unitAddress" class="required">Unit Address in the Villas</label>
                    <input type="text" id="unitAddress" name="unitAddress" placeholder="e.g., 13737 Rock Pt, Unit 102" required>
                </div>

                <div class="form-group">
                    <label for="phone" class="required">Phone Number</label>
                    <input type="tel" id="phone" name="phone" placeholder="(XXX) XXX-XXXX" required>
                </div>

                <div class="form-group">
                    <label for="email" class="required">Email</label>
                    <input type="email" id="email" name="email" placeholder="your@email.com" required>
                </div>

                <div class="form-group">
                    <label for="description" class="required">Briefly Describe Work to be Done</label>
                    <textarea id="description" name="description" placeholder="Describe the work needed..." required></textarea>
                </div>

                <div class="form-group">
                    <label for="otherInfo">Any Other Information Which Might be Needed?</label>
                    <textarea id="otherInfo" name="otherInfo" placeholder="Additional details, access instructions, etc."></textarea>
                </div>

                <div class="form-group">
                    <label class="required">Supporting Documentation</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
                        Upload up to 5 files (images will be auto-compressed). Accepted: JPG, PNG, PDF
                    </p>
                    <div class="file-upload-wrapper">
                        <label for="fileInput" class="file-upload-label" id="dropZone">
                            <div>📁 Click to upload or drag files here</div>
                            <div style="font-size: 12px; color: #999; margin-top: 5px;">Max 5 files, images auto-compressed</div>
                        </label>
                        <input type="file" id="fileInput" name="files" multiple accept=".jpg,.jpeg,.png,.pdf">
                    </div>
                    <div id="fileList" class="file-list"></div>
                </div>

                <div class="form-group">
                    <label for="priority" class="required">Priority (1-10, 10 is High)</label>
                    <div class="priority-container">
                        <select id="priority" name="priority" required>
                            <option value="">Select priority level</option>
                            <option value="1">1 - Very Low</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5 - Medium</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10">10 - High/Urgent</option>
                        </select>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="reset" class="btn-reset">Clear Form</button>
                    <button type="submit" class="btn-submit">Submit Request</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        const MAX_FILES = 5;
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const MAX_IMAGE_WIDTH = 800;
        const MAX_IMAGE_HEIGHT = 600;
        const JPEG_QUALITY = 0.8;

        let uploadedFiles = [];

        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileList = document.getElementById('fileList');
        const woForm = document.getElementById('woForm');
        const alertDiv = document.getElementById('alert');

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            handleFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            handleFiles(Array.from(e.target.files));
        });

        function handleFiles(newFiles) {
            if (uploadedFiles.length + newFiles.length > MAX_FILES) {
                showAlert(\`Maximum \${MAX_FILES} files allowed\`, 'error');
                return;
            }

            newFiles.forEach(file => {
                if (file.size > MAX_FILE_SIZE) {
                    showAlert(\`File "\${file.name}" is too large (max 10 MB)\`, 'error');
                    return;
                }

                if (file.type.startsWith('image/')) {
                    compressImage(file).then(compressedBlob => {
                        uploadedFiles.push({
                            name: file.name,
                            originalName: file.name,
                            blob: compressedBlob,
                            isImage: true,
                            originalSize: file.size,
                            compressedSize: compressedBlob.size
                        });
                        renderFileList();
                    }).catch(err => {
                        console.error('Compression error:', err);
                        showAlert(\`Failed to compress "\${file.name}"\`, 'error');
                    });
                } else if (file.type === 'application/pdf' || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    uploadedFiles.push({
                        name: file.name,
                        originalName: file.name,
                        blob: file,
                        isImage: false,
                        originalSize: file.size,
                        compressedSize: file.size
                    });
                    renderFileList();
                } else {
                    showAlert(\`File type not supported: "\${file.name}"\`, 'error');
                }
            });
        }

        function compressImage(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;

                        if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
                            const aspectRatio = width / height;
                            if (width > height) {
                                width = MAX_IMAGE_WIDTH;
                                height = Math.round(width / aspectRatio);
                            } else {
                                height = MAX_IMAGE_HEIGHT;
                                width = Math.round(height * aspectRatio);
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob(
                            (blob) => resolve(blob),
                            'image/jpeg',
                            JPEG_QUALITY
                        );
                    };
                    img.onerror = () => reject(new Error('Failed to load image'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });
        }

        function renderFileList() {
            fileList.innerHTML = '';
            uploadedFiles.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'file-item';
                const sizeKb = Math.round(file.compressedSize / 1024);
                const compressed = file.isImage ? \` (\${Math.round((1 - file.compressedSize / file.originalSize) * 100)}% compressed)\` : '';
                item.innerHTML = \`
                    <span>📄 \${file.name} <span class="file-size">\${sizeKb} KB\${compressed}</span></span>
                    <button type="button" onclick="removeFile(\${index})">Remove</button>
                \`;
                fileList.appendChild(item);
            });
        }

        function removeFile(index) {
            uploadedFiles.splice(index, 1);
            fileInput.value = '';
            renderFileList();
        }

        function showAlert(message, type) {
            alertDiv.textContent = message;
            alertDiv.className = \`alert show \${type}\`;
            if (type !== 'loading') {
                setTimeout(() => alertDiv.classList.remove('show'), 5000);
            }
        }

        woForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!woForm.checkValidity()) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }

            const formData = {
                name: document.getElementById('name').value,
                unitAddress: document.getElementById('unitAddress').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                description: document.getElementById('description').value,
                otherInfo: document.getElementById('otherInfo').value,
                priority: document.getElementById('priority').value,
                files: []
            };

            const filesToProcess = uploadedFiles.length > 0 ? uploadedFiles : [];

            showAlert(\`\${filesToProcess.length > 0 ? 'Processing ' + filesToProcess.length + ' file(s) and ' : ''}submitting form...\`, 'loading');

            try {
                const filePromises = filesToProcess.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            resolve({
                                name: file.originalName,
                                base64: reader.result.split(',')[1],
                                mimeType: file.blob.type || 'application/octet-stream'
                            });
                        };
                        reader.onerror = () => reject(new Error('Failed to read file'));
                        reader.readAsDataURL(file.blob);
                    });
                });

                formData.files = await Promise.all(filePromises);

                google.script.run
                    .withSuccessHandler((response) => {
                        if (response.success) {
                            showAlert('✓ Request submitted successfully! Check your email for confirmation.', 'success');
                            window.scrollTo(0, 0);
                            woForm.reset();
                            uploadedFiles = [];
                            renderFileList();
                            setTimeout(() => alertDiv.classList.remove('show'), 5000);
                        } else {
                            console.error('Backend error:', response);
                            showAlert(\`Error: \${response.message}\\n\\nDebug: \${response.debug}\`, 'error');
                        }
                    })
                    .withFailureHandler((error) => {
                        console.error('Submission error:', error);
                        showAlert(\`Error: \${error || 'Failed to submit form'}\`, 'error');
                    })
                    .handleFormSubmission(formData);
            } catch (error) {
                console.error('Processing error:', error);
                showAlert('Error processing files', 'error');
            }
        });
    </script>
</body>
</html>`;

function doGet(e) {
  return HtmlService.createHtmlOutput(HTML_FORM)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleFormSubmission(formData) {
  const startTime = new Date();
  const log = [];
  let processedFiles;
  let pdfBlob;

  try {
    log.push('START at ' + startTime.toISOString());

    try {
      validateFormData(formData);
      log.push('Validation OK');
    } catch (e) {
      log.push('VALIDATION FAILED: ' + e.message);
      throw e;
    }

    try {
      processedFiles = processFiles(formData.files || []);
      log.push('Files processed: ' + processedFiles.length);
    } catch (e) {
      log.push('FILE PROCESSING FAILED: ' + e.message);
      throw e;
    }

    try {
      pdfBlob = generateWoPdf(formData);
      log.push('PDF generated at ' + new Date().toISOString());
    } catch (e) {
      log.push('PDF GENERATION FAILED: ' + e.message);
      throw e;
    }

    try {
      log.push('Attempting email to: ' + CONFIG.WO_RECIPIENT);
      sendSubmissionEmail(formData, pdfBlob, processedFiles);
      log.push('Email sent OK at ' + new Date().toISOString());
    } catch (e) {
      log.push('EMAIL FAILED: ' + e.message);
      throw e;
    }

    try {
      log.push('Attempting confirmation email to homeowner: ' + formData.email);
      sendHomeownerConfirmation(formData, processedFiles);
      log.push('Confirmation email sent OK at ' + new Date().toISOString());
    } catch (e) {
      log.push('CONFIRMATION EMAIL FAILED: ' + e.message);
      throw e;
    }

    try {
      log.push('Attempting Drive archive');
      archivePdfToDrive(formData, pdfBlob);
      log.push('Drive archive OK at ' + new Date().toISOString());
    } catch (e) {
      log.push('DRIVE FAILED: ' + e.message);
      throw e;
    }

    log.push('SUCCESS at ' + new Date().toISOString());
    return { success: true, message: 'Form submitted successfully', debug: log.join(' | ') };

  } catch (error) {
    const errorMsg = error.message || String(error);
    log.push('EXCEPTION: ' + errorMsg);
    return { success: false, message: 'SUBMISSION ERROR: ' + errorMsg, debug: log.join(' | ') };
  }
}

function validateFormData(data) {
  const required = ['name', 'unitAddress', 'phone', 'email', 'description', 'priority'];

  for (const field of required) {
    if (!data[field] || data[field].trim() === '') {
      throw new Error(`Required field missing: ${field}`);
    }
  }

  if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new Error('Invalid email format');
  }

  const priority = parseInt(data.priority);
  if (isNaN(priority) || priority < 1 || priority > 10) {
    throw new Error('Priority must be between 1 and 10');
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

function generateWoPdf(formData) {
  const doc = DocumentApp.create('WO_Request_' + Date.now());
  const docId = doc.getId();

  try {
    const body = doc.getBody();
    body.clear();

    addPdfHeader(body);
    addFormFields(body, formData);
    addSupportingDocumentation(body, formData.files);
    addWorkOrderActionSection(body);

    doc.saveAndClose();

    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');

    DriveApp.getFileById(docId).setTrashed(true);

    return pdfBlob;
  } catch (error) {
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (e) {}
    throw new Error('PDF generation failed: ' + error.message);
  }
}

function addPdfHeader(body) {
  try {
    const logoFile = DriveApp.getFileById('1SKxbUvO7YMl0cpYXFYMrdzvtw6sKhotQ');
    const logoBlob = logoFile.getBlob();
    const logoImage = body.appendImage(logoBlob);
    const FORM_TABLE_WIDTH = 450;
    logoImage.setWidth(FORM_TABLE_WIDTH);
    const logoPara = logoImage.getParent();
    logoPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    logoPara.setSpacingBefore(0);
    logoPara.setSpacingAfter(0);
    logoPara.setLineSpacing(0.5);
  } catch (e) {
    // Logo file not found or not accessible, continue without it
  }

  const decorativeLine = body.appendParagraph('');
  decorativeLine.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  decorativeLine.setSpacingBefore(0);
  decorativeLine.setSpacingAfter(2);
  decorativeLine.setLineSpacing(0.5);
  const decoration = decorativeLine.editAsText();
  decoration.setText('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  decoration.setForegroundColor('#2d7d3a');
  decoration.setFontSize(9);

  const titleParagraph = body.appendParagraph('VaB Work Order Request');
  titleParagraph.setFontSize(16);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setForegroundColor('#1a3a52');
  titleParagraph.setSpacingBefore(0);
  titleParagraph.setSpacingAfter(0);

  const subtitleParagraph = body.appendParagraph('Maintenance and Repair Request');
  subtitleParagraph.setFontSize(10);
  subtitleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  subtitleParagraph.setForegroundColor('#2d7d3a');
  subtitleParagraph.setSpacingBefore(0);
  subtitleParagraph.setSpacingAfter(0);
}

function addFormFields(body, formData) {
  const fields = [
    { label: 'Name', value: formData.name },
    { label: 'Unit Address in the Villas', value: formData.unitAddress },
    { label: 'Phone Number', value: formData.phone },
    { label: 'Email', value: formData.email },
    { label: 'Work Description', value: formData.description },
    { label: 'Additional Information', value: formData.otherInfo || '(None)' },
    { label: 'Priority Level', value: formData.priority + ' / 10' },
    { label: 'Submission Date', value: formatDateString(new Date()) }
  ];

  const rows = fields.map(f => [f.label, f.value]);
  const fieldTable = body.appendTable(rows);

  fieldTable.setColumnWidth(0, 140);
  fieldTable.setColumnWidth(1, 310);
  fieldTable.setBorderColor('#dddddd');

  for (let i = 0; i < fields.length; i++) {
    const labelCell = fieldTable.getCell(i, 0);
    labelCell.clear();
    labelCell.setPaddingTop(1);
    labelCell.setPaddingBottom(1);
    labelCell.setPaddingLeft(4);
    labelCell.setPaddingRight(4);
    const labelPara = labelCell.appendParagraph(fields[i].label);
    labelPara.setBold(true);
    labelPara.setFontSize(9);
    labelPara.setForegroundColor('#1a3a52');
    labelPara.setSpacingBefore(0);
    labelPara.setSpacingAfter(0);
    labelPara.setLineSpacing(1.0);

    const valueCell = fieldTable.getCell(i, 1);
    valueCell.clear();
    valueCell.setPaddingTop(1);
    valueCell.setPaddingBottom(1);
    valueCell.setPaddingLeft(4);
    valueCell.setPaddingRight(4);
    const valuePara = valueCell.appendParagraph(fields[i].value);
    valuePara.setFontSize(9);
    valuePara.setLineSpacing(1.0);
    valuePara.setSpacingBefore(0);
    valuePara.setSpacingAfter(0);
  }

  body.appendParagraph('').setSpacingAfter(4);
}

function addSupportingDocumentation(body, files) {
  const label = body.appendParagraph('Supporting Documentation');
  label.setBold(true);
  label.setFontSize(9);
  label.setForegroundColor('#1a3a52');
  label.setSpacingBefore(0);
  label.setSpacingAfter(2);

  if (files && files.length > 0) {
    files.forEach(file => {
      const fileParagraph = body.appendParagraph('📎 ' + file.name);
      fileParagraph.setFontSize(9);
      fileParagraph.setForegroundColor('#333333');
      fileParagraph.setSpacingBefore(0);
      fileParagraph.setSpacingAfter(0);
    });
  } else {
    const noParagraph = body.appendParagraph('(None provided)');
    noParagraph.setFontSize(9);
    noParagraph.setForegroundColor('#999999');
    noParagraph.setSpacingBefore(0);
    noParagraph.setSpacingAfter(0);
  }

  body.appendParagraph('').setSpacingAfter(4);
}

function addWorkOrderActionSection(body) {
  const divider = body.appendParagraph('');
  divider.setSpacingBefore(4);
  divider.setSpacingAfter(2);
  const dividerText = divider.editAsText();
  dividerText.setText('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  dividerText.setForegroundColor('#dddddd');
  dividerText.setFontSize(9);

  const actionTitle = body.appendParagraph('Work Order Management');
  actionTitle.setBold(true);
  actionTitle.setFontSize(9);
  actionTitle.setForegroundColor('#1a3a52');
  actionTitle.setSpacingBefore(0);
  actionTitle.setSpacingAfter(2);

  const statusText = 'Status: ☐ Pending     ☐ In Progress     ☐ Completed';
  const statusParagraph = body.appendParagraph(statusText);
  statusParagraph.setFontSize(9);
  statusParagraph.setSpacingBefore(0);
  statusParagraph.setSpacingAfter(2);

  const notesLabel = body.appendParagraph('Work Notes:');
  notesLabel.setFontSize(9);
  notesLabel.setBold(true);
  notesLabel.setForegroundColor('#1a3a52');
  notesLabel.setSpacingBefore(0);
  notesLabel.setSpacingAfter(2);

  const notesTable = body.appendTable([[''], ['']]);
  const notesCell0 = notesTable.getCell(0, 0);
  const notesCell1 = notesTable.getCell(1, 0);
  notesCell0.clear();
  notesCell1.clear();

  notesCell0.setBackgroundColor('#f8f9fa');
  notesCell1.setBackgroundColor('#f8f9fa');

  notesTable.setColumnWidth(0, 450);
  notesTable.setBorderColor('#cccccc');

  const completionLabel = body.appendParagraph('Completion Date:');
  completionLabel.setBold(true);
  completionLabel.setFontSize(9);
  completionLabel.setForegroundColor('#1a3a52');
  completionLabel.setSpacingBefore(2);
  completionLabel.setSpacingAfter(0);

  const completionLine = body.appendParagraph('_________________________________________');
  completionLine.setFontSize(9);
  completionLine.setSpacingBefore(0);
  completionLine.setSpacingAfter(0);
}

function formatDateString(dateObj) {
  const options = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };

  return dateObj.toLocaleDateString('en-US', options);
}

function sendSubmissionEmail(formData, pdfBlob, processedFiles) {
  const subject = `VaB Work Order — ${formData.name} — ${formData.unitAddress} — Priority ${formData.priority}/10`;

  const body = `Work Order Request Submission

Homeowner: ${formData.name}
Unit: ${formData.unitAddress}
Phone: ${formData.phone}
Email: ${formData.email}
Submission Date: ${formatDateString(new Date())}

Work Description:
${formData.description}

Additional Information:
${formData.otherInfo || '(None)'}

Priority: ${formData.priority}/10

Supporting Documents:
${processedFiles.length > 0 ? processedFiles.map(f => '• ' + f.name).join('\n') : '(None)'}

---
PDF form attached. All supporting documents and photos included as attachments.`;

  const emailFileName = `WO_Request_${formatFilenameFriendly(formData.unitAddress)}_${getTodayDate()}.pdf`;
  const attachments = [pdfBlob.setName(emailFileName)];
  attachments.push(...processedFiles.map(f => f.blob));

  try {
    GmailApp.sendEmail(
      CONFIG.WO_RECIPIENT,
      subject,
      body,
      {
        attachments: attachments,
        replyTo: formData.email
      }
    );
    Logger.log('Email sent successfully to: ' + CONFIG.WO_RECIPIENT);
  } catch (e) {
    Logger.log('Email sending error: ' + e.message);
    throw new Error('Failed to send email: ' + e.message);
  }
}

function sendHomeownerConfirmation(formData, processedFiles) {
  const subject = `Confirmation: Your Work Order Request`;

  const body = `Thank you for submitting your work order request.

Work Order Request Submission

Homeowner: ${formData.name}
Unit: ${formData.unitAddress}
Phone: ${formData.phone}
Email: ${formData.email}
Submission Date: ${formatDateString(new Date())}

Work Description:
${formData.description}

Additional Information:
${formData.otherInfo || '(None)'}

Priority: ${formData.priority}/10

Supporting Documents:
${processedFiles.length > 0 ? processedFiles.map(f => '• ' + f.name).join('\n') : '(None)'}

---
Your request has been received and will be reviewed. You will be contacted if additional information is needed.`;

  try {
    GmailApp.sendEmail(
      formData.email,
      subject,
      body
    );
    Logger.log('Confirmation email sent to: ' + formData.email);
  } catch (e) {
    Logger.log('Confirmation email sending error: ' + e.message);
    throw new Error('Failed to send confirmation email: ' + e.message);
  }
}

function archivePdfToDrive(formData, pdfBlob) {
  const folder = DriveApp.getFolderById(CONFIG.ARCHIVE_FOLDER_ID);
  const fileName = `${formatFilenameFriendly(formData.name)}_${formatFilenameFriendly(formData.unitAddress)}_${getTodayDate()}.pdf`;
  const file = folder.createFile(pdfBlob);
  file.setName(fileName);
  Logger.log('Archived PDF to Drive: ' + file.getUrl());
}

function formatFilenameFriendly(text) {
  return text
    .replace(/[^a-zA-Z0-9\s\-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
