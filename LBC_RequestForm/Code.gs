// LBC Request Form - Apps Script Backend
// Serves HTML form and processes submissions

const CONFIG = {
  // Email recipient
  LBC_RECIPIENT: 'lbcformrecipients@villasboulders.org',

  // Drive folder for archiving (HOA Board Documents > LBC Request Forms)
  ARCHIVE_FOLDER_ID: '12LnOEsFn4I032iFWp6Wwm5que68Hmn0A',

  // Manager contact
  MANAGER_EMAIL: 'manager@villasboulders.org',
  MANAGER_PHONE: '(TBD)'
};

const HTML_FORM = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VaB Landscape Request</title>
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
            padding: 15px 20px;
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
            padding: 15px 20px;
        }

        .form-group {
            margin-bottom: 10px;
        }

        label {
            display: block;
            font-weight: bold;
            color: #1a3a52;
            margin-bottom: 5px;
            font-size: 14px;
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="date"],
        textarea {
            width: 100%;
            padding: 8px;
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
            margin-top: 15px;
        }

        button {
            padding: 10px 15px;
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
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Homeowner Paid Planting or Removal</h1>
            <p>Submit a request to the Landscape & Beautification Committee</p>
        </div>

        <div class="form-content">
            <div id="alert" class="alert"></div>

            <form id="lbcForm">
                <div class="form-group">
                    <label class="required">Name</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <input type="text" id="firstName" name="firstName" placeholder="First Name" required>
                        <input type="text" id="lastName" name="lastName" placeholder="Last Name" required>
                    </div>
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
                    <label class="required">Are you requesting new planting or removal?</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <label style="display: flex; align-items: center; font-weight: normal; margin-bottom: 0;">
                            <input type="checkbox" id="plantingNew" name="plantingRequest" value="New Planting" style="margin-right: 8px;">
                            New Planting
                        </label>
                        <label style="display: flex; align-items: center; font-weight: normal; margin-bottom: 0;">
                            <input type="checkbox" id="plantingRemoval" name="plantingRequest" value="Removal" style="margin-right: 8px;">
                            Removal
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label for="location" class="required">Location of Proposed Planting or Removal</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px; font-weight: normal;">
                        Be as specific as you can (e.g., Front yard rock area just right of sidewalk)
                    </p>
                    <textarea id="location" name="location" placeholder="Describe the location..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="required">What type of plant to be added or removed?</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <label style="display: flex; align-items: flex-start; font-weight: normal; margin-bottom: 0;">
                            <input type="checkbox" id="plantType1" name="plantType" value="Flowers (Annuals/Perennials)" style="margin-right: 8px; margin-top: 2px;">
                            <span>Flowers (Annuals/Perennials)</span>
                        </label>
                        <label style="display: flex; align-items: flex-start; font-weight: normal; margin-bottom: 0;">
                            <input type="checkbox" id="plantType2" name="plantType" value="Shrubs/Bushes" style="margin-right: 8px; margin-top: 2px;">
                            <span>Shrubs/Bushes</span>
                        </label>
                        <label style="display: flex; align-items: flex-start; font-weight: normal; margin-bottom: 0;">
                            <input type="checkbox" id="plantType3" name="plantType" value="Small Tree (Specify species in next question)" style="margin-right: 8px; margin-top: 2px;">
                            <span>Small Tree (Specify species in next question)</span>
                        </label>
                        <label style="display: flex; align-items: flex-start; font-weight: normal; margin-bottom: 0;">
                            <input type="checkbox" id="plantType4" name="plantType" value="Other (Specify in next question)" style="margin-right: 8px; margin-top: 2px;">
                            <span>Other (Specify in next question)</span>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label for="plantSpecies" class="required">List the specific plant species</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px; font-weight: normal;">
                        Be as specific as you can. Include common or scientific names if you know them. The LBC reserves the right to reject specific requests and/or to suggest substitutes more suitable to our locale.
                    </p>
                    <textarea id="plantSpecies" name="plantSpecies" placeholder="Species details..." required></textarea>
                </div>

                <div class="form-group">
                    <label>Supporting Documentation</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
                        Optional: You may optionally attach a sketch or photo showing the proposed planting location and the approximate layout/size of the proposed planting area. Upload up to 5 files (images will be auto-compressed). Accepted: JPG, PNG, PDF
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
                    I have read the Homeowner Paid Removal and Planting Policy and will provide initial care and watering for new plants as recommended by the landscaping company. For trees, I understand that I accept this responsibility for a period of not less than 3 years until the tree is deemed viable by the LBC. I understand and agree that I am responsible for removal of this plant if it fails to survive.
                </div>

                <div class="signature-section">
                    <label for="signature" class="required">Your Signature</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px; font-weight: normal;">
                        Typing your name signifies your acceptance and has the same legal force as a signed signature.
                    </p>
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
        const lbcForm = document.getElementById('lbcForm');
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

        lbcForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!lbcForm.checkValidity()) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }

            // Check that at least one planting request type is selected
            const plantingRequest = Array.from(document.querySelectorAll('input[name="plantingRequest"]:checked')).map(el => el.value);
            if (plantingRequest.length === 0) {
                showAlert('Please select at least one option for planting or removal', 'error');
                return;
            }

            // Check that at least one plant type is selected
            const plantType = Array.from(document.querySelectorAll('input[name="plantType"]:checked')).map(el => el.value);
            if (plantType.length === 0) {
                showAlert('Please select at least one plant type', 'error');
                return;
            }

            const formData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                name: document.getElementById('firstName').value + ' ' + document.getElementById('lastName').value,
                unitAddress: document.getElementById('unitAddress').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                plantingRequest: plantingRequest.join(', '),
                location: document.getElementById('location').value,
                plantType: plantType.join(', '),
                plantSpecies: document.getElementById('plantSpecies').value,
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
                        if (response.success) {
                            showAlert('✓ Request submitted successfully! Check your email for confirmation.', 'success');
                            window.scrollTo(0, 0);
                            lbcForm.reset();
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
      pdfBlob = generateLbcPdf(formData);
      log.push('PDF generated at ' + new Date().toISOString());
    } catch (e) {
      log.push('PDF GENERATION FAILED: ' + e.message);
      throw e;
    }

    try {
      log.push('Attempting email to: ' + CONFIG.LBC_RECIPIENT);
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
  const required = ['firstName', 'lastName', 'unitAddress', 'phone', 'email', 'location', 'plantSpecies', 'completionDate', 'signature', 'plantingRequest', 'plantType'];

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

function generateLbcPdf(formData) {
  const doc = DocumentApp.create('LBC_Request_' + Date.now());
  const docId = doc.getId();

  try {
    const body = doc.getBody();
    body.clear();

    addPdfHeader(body);
    addFormFields(body, formData);

    if (formData.files && formData.files.length > 0) {
      addSupportingDocumentation(body, formData.files);
    }

    addAdmonitionText(body);
    addSignatureSection(body, formData);
    addContactSection(body);
    addLbcActionSection(body);

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
  // Add logo if available
  try {
    const logoFile = DriveApp.getFileById('1SKxbUvO7YMl0cpYXFYMrdzvtw6sKhotQ');
    const logoBlob = logoFile.getBlob();
    const logoImage = body.appendImage(logoBlob);
    const FORM_TABLE_WIDTH = 450; // Same as form field table width (150 + 300)
    logoImage.setWidth(FORM_TABLE_WIDTH);
    const logoPara = logoImage.getParent();
    logoPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    logoPara.setSpacingBefore(0);
    logoPara.setSpacingAfter(0);
  } catch (e) {
    Logger.log('Logo loading error: ' + e.toString());
    // Logo file not found or not accessible, continue without it
  }

  const decorativeLine = body.appendParagraph('');
  decorativeLine.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  decorativeLine.setSpacingBefore(0);
  decorativeLine.setSpacingAfter(0);
  const decoration = decorativeLine.editAsText();
  decoration.setText('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  decoration.setForegroundColor('#2d7d3a');
  decoration.setFontSize(9);

  const titleParagraph = body.appendParagraph('Homeowner Paid Planting or Removal Request');
  titleParagraph.setFontSize(16);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setForegroundColor('#1a3a52');
  titleParagraph.setSpacingBefore(0);
  titleParagraph.setSpacingAfter(0);

  const subtitleParagraph = body.appendParagraph('Landscape Beautification Committee');
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
    { label: 'Planting or Removal Request', value: formData.plantingRequest },
    { label: 'Location of Proposed Planting or Removal', value: formData.location },
    { label: 'Plant Type', value: formData.plantType },
    { label: 'Specific Plant Species', value: formData.plantSpecies },
    { label: 'Planned Completion Date', value: formatDateString(new Date(formData.completionDate)) }
  ];

  // Create single table with all fields as rows (eliminates inter-table spacing)
  const rows = fields.map(f => [f.label, f.value]);
  const fieldTable = body.appendTable(rows);

  fieldTable.setColumnWidth(0, 140);
  fieldTable.setColumnWidth(1, 310);
  fieldTable.setBorderColor('#dddddd');

  // Format all cells
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
}

function addSupportingDocumentation(body, files) {
  const label = body.appendParagraph('Supporting Documentation');
  label.setBold(true);
  label.setFontSize(9);
  label.setForegroundColor('#1a3a52');
  label.setSpacingBefore(0);
  label.setSpacingAfter(2);

  files.forEach(file => {
    const fileParagraph = body.appendParagraph('📎 ' + file.name);
    fileParagraph.setFontSize(9);
    fileParagraph.setForegroundColor('#333333');
    fileParagraph.setSpacingBefore(0);
    fileParagraph.setSpacingAfter(0);
  });
}

function addAdmonitionText(body) {
  const admonitionLabel = body.appendParagraph('Important Agreement and Acknowledgment');
  admonitionLabel.setBold(true);
  admonitionLabel.setFontSize(9);
  admonitionLabel.setForegroundColor('#1a3a52');
  admonitionLabel.setSpacingBefore(0);
  admonitionLabel.setSpacingAfter(2);

  const admonitionText = 'I have read the Homeowner Paid Removal and Planting Policy and will provide initial care and watering for new plants as recommended by the landscaping company. For trees, I understand that I accept this responsibility for a period of not less than 3 years until the tree is deemed viable by the LBC. I understand and agree that I am responsible for removal of this plant if it fails to survive.';

  const admonitionParagraph = body.appendParagraph(admonitionText);
  admonitionParagraph.setItalic(true);
  admonitionParagraph.setFontSize(8);
  admonitionParagraph.setLineSpacing(1.0);
  admonitionParagraph.setForegroundColor('#333333');
  admonitionParagraph.setSpacingBefore(0);
  admonitionParagraph.setSpacingAfter(0);
}

function addSignatureSection(body, formData) {

  const sectionTitle = body.appendParagraph('Homeowner Signature and Submission');
  sectionTitle.setBold(true);
  sectionTitle.setFontSize(10);
  sectionTitle.setForegroundColor('#1a3a52');
  sectionTitle.setSpacingBefore(0);
  sectionTitle.setSpacingAfter(2);

  const submissionTable = body.appendTable([['Submission Date', formatDateString(new Date())]]);
  const subLabelCell = submissionTable.getCell(0, 0);
  subLabelCell.clear();
  subLabelCell.setPaddingTop(2);
  subLabelCell.setPaddingBottom(2);
  subLabelCell.setPaddingLeft(4);
  subLabelCell.setPaddingRight(4);
  const subLabelPara = subLabelCell.appendParagraph('Submission Date');
  subLabelPara.setBold(true);
  subLabelPara.setFontSize(9);
  subLabelPara.setForegroundColor('#1a3a52');
  subLabelPara.setSpacingBefore(0);
  subLabelPara.setSpacingAfter(0);
  subLabelPara.setLineSpacing(1.0);

  const subValueCell = submissionTable.getCell(0, 1);
  subValueCell.clear();
  subValueCell.setPaddingTop(2);
  subValueCell.setPaddingBottom(2);
  subValueCell.setPaddingLeft(4);
  subValueCell.setPaddingRight(4);
  const subValuePara = subValueCell.appendParagraph(formatDateString(new Date()));
  subValuePara.setFontSize(9);
  subValuePara.setSpacingBefore(0);
  subValuePara.setSpacingAfter(0);
  subValuePara.setLineSpacing(1.0);

  submissionTable.setColumnWidth(0, 140);
  submissionTable.setColumnWidth(1, 310);
  submissionTable.setBorderColor('#dddddd');

  const signatureTable = body.appendTable([['Your Signature', formData.signature]]);
  const sigLabelCell = signatureTable.getCell(0, 0);
  sigLabelCell.clear();
  sigLabelCell.setPaddingTop(2);
  sigLabelCell.setPaddingBottom(2);
  sigLabelCell.setPaddingLeft(4);
  sigLabelCell.setPaddingRight(4);
  const sigLabelPara = sigLabelCell.appendParagraph('Your Signature');
  sigLabelPara.setBold(true);
  sigLabelPara.setFontSize(9);
  sigLabelPara.setForegroundColor('#1a3a52');
  sigLabelPara.setSpacingBefore(0);
  sigLabelPara.setSpacingAfter(0);
  sigLabelPara.setLineSpacing(1.0);

  const sigValueCell = signatureTable.getCell(0, 1);
  sigValueCell.clear();
  sigValueCell.setPaddingTop(2);
  sigValueCell.setPaddingBottom(2);
  sigValueCell.setPaddingLeft(4);
  sigValueCell.setPaddingRight(4);
  const sigValuePara = sigValueCell.appendParagraph(formData.signature);
  sigValuePara.setFontSize(9);
  sigValuePara.setSpacingBefore(0);
  sigValuePara.setSpacingAfter(0);
  sigValuePara.setLineSpacing(1.0);

  signatureTable.setColumnWidth(0, 140);
  signatureTable.setColumnWidth(1, 310);
  signatureTable.setBorderColor('#dddddd');
}

function addContactSection(body) {
  const contactLabel = body.appendParagraph('Questions or Support');
  contactLabel.setBold(true);
  contactLabel.setFontSize(11);
  contactLabel.setForegroundColor('#1a3a52');
  contactLabel.setSpacingBefore(4);
  contactLabel.setSpacingAfter(2);

  const contactParagraph = body.appendParagraph(`Direct questions to the LBC (Landscape & Beautification Committee) or HOA manager: ${CONFIG.MANAGER_EMAIL} or ${CONFIG.MANAGER_PHONE}`);
  contactParagraph.setFontSize(10);
  contactParagraph.setForegroundColor('#666666');
  contactParagraph.setLineSpacing(1.2);
  contactParagraph.setSpacingBefore(0);
  contactParagraph.setSpacingAfter(0);

}

function addLbcActionSection(body) {

  const divider = body.appendParagraph('');
  divider.setSpacingBefore(4);
  divider.setSpacingAfter(2);
  const dividerText = divider.editAsText();
  dividerText.setText('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  dividerText.setForegroundColor('#dddddd');
  dividerText.setFontSize(9);

  const actionTitle = body.appendParagraph('LBC Committee Action & Review');
  actionTitle.setBold(true);
  actionTitle.setFontSize(10);
  actionTitle.setForegroundColor('#1a3a52');
  actionTitle.setSpacingBefore(0);
  actionTitle.setSpacingAfter(2);

  const checkboxesText = '☐ Approved     ☐ Needs Modification     ☐ Not Approved';
  const checkboxesParagraph = body.appendParagraph(checkboxesText);
  checkboxesParagraph.setFontSize(11);
  checkboxesParagraph.setSpacingBefore(0);
  checkboxesParagraph.setSpacingAfter(2);

  const reasonsLabel = body.appendParagraph('Comments or requirements:');
  reasonsLabel.setFontSize(11);
  reasonsLabel.setBold(true);
  reasonsLabel.setForegroundColor('#1a3a52');
  reasonsLabel.setSpacingBefore(0);
  reasonsLabel.setSpacingAfter(2);

  const reasonsTable = body.appendTable([[''], ['']]);
  const reasonsCell0 = reasonsTable.getCell(0, 0);
  const reasonsCell1 = reasonsTable.getCell(1, 0);
  reasonsCell0.clear();
  reasonsCell1.clear();

  reasonsCell0.setBackgroundColor('#f8f9fa');
  reasonsCell1.setBackgroundColor('#f8f9fa');

  reasonsTable.setColumnWidth(0, 450);
  reasonsTable.setBorderColor('#cccccc');

  const signatureLabel = body.appendParagraph('LBC Committee Signature');
  signatureLabel.setBold(true);
  signatureLabel.setFontSize(11);
  signatureLabel.setForegroundColor('#1a3a52');
  signatureLabel.setSpacingBefore(2);
  signatureLabel.setSpacingAfter(2);

  const signatureLine = body.appendParagraph('_________________________________________     Date: _______________');
  signatureLine.setFontSize(10);
  signatureLine.setSpacingBefore(0);
  signatureLine.setSpacingAfter(0);
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
  const subject = `VaB LBC Request — ${formData.name} — ${formData.unitAddress}`;

  const body = `Landscape & Beautification Committee Request Submission

Homeowner: ${formData.name}
Unit: ${formData.unitAddress}
Phone: ${formData.phone}
Email: ${formData.email}
Submission Date: ${formatDateString(new Date())}

Request Type: ${formData.plantingRequest}
Location: ${formData.location}
Plant Type: ${formData.plantType}
Specific Species: ${formData.plantSpecies}

Planned Completion: ${formatDateString(new Date(formData.completionDate))}

Supporting Documents:
${processedFiles.length > 0 ? processedFiles.map(f => '• ' + f.name).join('\n') : '(None provided)'}

---
PDF form attached. All supporting documents and photos included as attachments.`;

  const emailFileName = `LBC_Request_${formatFilenameFriendly(formData.unitAddress)}_${getTodayDate()}.pdf`;
  const attachments = [pdfBlob.setName(emailFileName)];
  attachments.push(...processedFiles.map(f => f.blob));

  GmailApp.sendEmail(
    CONFIG.LBC_RECIPIENT,
    subject,
    body,
    {
      attachments: attachments,
      replyTo: formData.email
    }
  );
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
