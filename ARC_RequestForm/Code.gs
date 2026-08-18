// ARC Request Form - Apps Script Backend
// Serves HTML form and processes submissions

const CONFIG = {
  // Email recipient
  ARC_RECIPIENT: 'arcformrecipients@villasboulders.org',

  // Drive folder for archiving (HOA Board Documents > ARC Request Forms)
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
    <title>VaB Architectural Review Request</title>
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
        input[type="date"],
        textarea {
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
        input[type="date"]:focus,
        textarea:focus {
            outline: none;
            border-color: #2d5f3f;
            box-shadow: 0 0 0 3px rgba(45,95,63,0.1);
        }

        textarea {
            resize: vertical;
            min-height: 100px;
            font-size: 13px;
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

        .admonition {
            background: #f5f5f5;
            border-left: 4px solid #2d5f3f;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            line-height: 1.6;
            font-size: 13px;
            font-style: italic;
            color: #333;
        }

        .signature-section {
            margin: 20px 0;
        }

        .signature-section label {
            margin-bottom: 8px;
        }

        .signature-line {
            border-bottom: 2px solid #333;
            margin-top: 5px;
            min-height: 20px;
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
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: none;
        }

        .alert.show {
            display: block;
        }

        .alert.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
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
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VaB Architectural Review Request</h1>
            <p>Submit improvements for committee review</p>
        </div>

        <div class="form-content">
            <div id="alert" class="alert"></div>

            <form id="arcForm">
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
                    <label for="description" class="required">Description of Improvements</label>
                    <textarea id="description" name="description" placeholder="Describe your improvements in detail..." required></textarea>
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
                    <label for="completionDate" class="required">Planned (approximate) Completion Date</label>
                    <input type="date" id="completionDate" name="completionDate" required>
                </div>

                <div class="admonition">
                    I understand that I must receive approval of the ARC in order to proceed. I understand that ARC approval does not constitute approval of the City and County of Broomfield and that I may be required to obtain a building permit. I understand that my improvements must be completed per specifications or approval, if granted, will be withdrawn. I understand and agree to the provisions of the ARC Design Guidelines of the Villas at the Boulders, including my responsibilities defined in Section II through V. If I am unable to complete my project within 3 months after approval, I understand that I must request an extension from the ARC.
                </div>

                <div class="signature-section">
                    <label for="signature" class="required">Homeowner Signature</label>
                    <input type="text" id="signature" name="signature" placeholder="Type your full name" required>
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
        const arcForm = document.getElementById('arcForm');
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

        arcForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!arcForm.checkValidity()) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }

            const formData = {
                name: document.getElementById('name').value,
                unitAddress: document.getElementById('unitAddress').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                description: document.getElementById('description').value,
                completionDate: document.getElementById('completionDate').value,
                signature: document.getElementById('signature').value,
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
                        console.log('Response:', response);
                        if (response.success) {
                            showAlert('✓ Request submitted successfully! Check your email for confirmation.', 'success');
                            arcForm.reset();
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
      pdfBlob = generateArcPdf(formData);
      log.push('PDF generated at ' + new Date().toISOString());
    } catch (e) {
      log.push('PDF GENERATION FAILED: ' + e.message);
      throw e;
    }

    try {
      log.push('Attempting email to: ' + CONFIG.ARC_RECIPIENT);
      sendSubmissionEmail(formData, pdfBlob, processedFiles);
      log.push('Email sent OK at ' + new Date().toISOString());
    } catch (e) {
      log.push('EMAIL FAILED: ' + e.message);
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
  const required = ['name', 'unitAddress', 'phone', 'email', 'description', 'completionDate', 'signature'];

  for (const field of required) {
    if (!data[field] || data[field].trim() === '') {
      throw new Error(`Required field missing: ${field}`);
    }
  }

  if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new Error('Invalid email format');
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

function generateArcPdf(formData) {
  const doc = DocumentApp.create('ARC_Request_' + Date.now());
  const docId = doc.getId();

  try {
    const body = doc.getBody();
    body.clear();

    addPdfHeader(body, formData.completionDate);
    addFormFields(body, formData);

    if (formData.files && formData.files.length > 0) {
      addSupportingDocumentation(body, formData.files);
    }

    addCompletionDate(body, formData.completionDate);
    addAdmonitionText(body);
    addSignatureSection(body, formData);
    addContactSection(body);
    addArcActionSection(body);

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

function addPdfHeader(body, completionDate) {
  const dateTable = body.appendTable([[formatDateString(new Date())]]);
  const dateCell = dateTable.getCell(0, 0);
  dateCell.setText('');
  const dateP = dateCell.appendParagraph(formatDateString(new Date()));
  dateP.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  dateP.setFontSize(11);

  body.appendParagraph('');

  const titleParagraph = body.appendParagraph('VaB Architectural Review Request');
  titleParagraph.setFontSize(18);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setSpacingAfter(12);

  body.appendParagraph('');
}

function addFormFields(body, formData) {
  const fields = [
    { label: 'Name', value: formData.name },
    { label: 'Unit Address in the Villas', value: formData.unitAddress },
    { label: 'Phone Number', value: formData.phone },
    { label: 'Email', value: formData.email },
    { label: 'Description of Improvements', value: formData.description }
  ];

  fields.forEach(field => {
    const labelParagraph = body.appendParagraph(field.label);
    labelParagraph.setBold(true);
    labelParagraph.setFontSize(11);
    labelParagraph.setSpacingAfter(2);

    const valueParagraph = body.appendParagraph(field.value);
    valueParagraph.setFontSize(11);
    valueParagraph.setSpacingAfter(10);
  });
}

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

  body.appendParagraph('');
}

function addCompletionDate(body, completionDate) {
  const label = body.appendParagraph('Planned (approximate) Completion Date');
  label.setBold(true);
  label.setFontSize(11);
  label.setSpacingAfter(2);

  const valueParagraph = body.appendParagraph(formatDateString(new Date(completionDate)));
  valueParagraph.setFontSize(11);
  valueParagraph.setSpacingAfter(15);
}

function addAdmonitionText(body) {
  const admonitionText = 'I understand that I must receive approval of the ARC in order to proceed. I understand that ARC approval does not constitute approval of the City and County of Broomfield and that I may be required to obtain a building permit. I understand that my improvements must be completed per specifications or approval, if granted, will be withdrawn. I understand and agree to the provisions of the ARC Design Guidelines of the Villas at the Boulders, including my responsibilities defined in Section II through V. If I am unable to complete my project within 3 months after approval, I understand that I must request an extension from the ARC.';

  const admonitionParagraph = body.appendParagraph(admonitionText);
  admonitionParagraph.setItalic(true);
  admonitionParagraph.setFontSize(10);
  admonitionParagraph.setLineSpacing(1.4);
  admonitionParagraph.setSpacingAfter(15);
}

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

function addContactSection(body) {
  const contactParagraph = body.appendParagraph(`Direct questions to the HOA manager: ${CONFIG.MANAGER_EMAIL} or ${CONFIG.MANAGER_PHONE}`);
  contactParagraph.setFontSize(10);
  contactParagraph.setSpacingAfter(15);
}

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

  const reasonsPlaceholder = body.appendParagraph('\n\n\n');
  reasonsPlaceholder.setFontSize(10);
  reasonsPlaceholder.setSpacingAfter(15);

  const signatureLabel = body.appendParagraph('ARC Committee Signature');
  signatureLabel.setBold(true);
  signatureLabel.setFontSize(11);
  signatureLabel.setSpacingAfter(2);

  const signatureLine = body.appendParagraph('_________________________________________     Date: _______________');
  signatureLine.setFontSize(11);
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

  const emailFileName = `ARC_Request_${formatFilenameFriendly(formData.unitAddress)}_${getTodayDate()}.pdf`;
  const attachments = [pdfBlob.setName(emailFileName)];
  attachments.push(...processedFiles.map(f => f.blob));

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

function archivePdfToDrive(formData, pdfBlob) {
  try {
    const folder = DriveApp.getFolderById(CONFIG.ARCHIVE_FOLDER_ID);
    const fileName = `${formatFilenameFriendly(formData.name)}_${formatFilenameFriendly(formData.unitAddress)}_${getTodayDate()}.pdf`;
    const file = folder.createFile(pdfBlob, fileName);

    Logger.log('Archived PDF to Drive: ' + file.getUrl());
  } catch (error) {
    Logger.log('Warning: Failed to archive to Drive: ' + error.message);
  }
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
