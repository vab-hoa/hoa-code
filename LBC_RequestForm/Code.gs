// LBC Request Form - Apps Script Backend
// Serves HTML form and processes submissions

const CONFIG = {
  // Email recipient for LBC form submissions
  LBC_RECIPIENT: 'lbcformrecipients@villasboulders.org',

  // Drive folder for archiving (HOA Board Documents > Homeowner Forms > LBC Request Forms)
  // TODO: Update with actual folder ID after folder is created
  ARCHIVE_FOLDER_ID: 'TBD_LBC_REQUEST_FORMS_FOLDER_ID',

  // Manager contact
  MANAGER_EMAIL: 'manager@villasboulders.org',
  MANAGER_PHONE: '(TBD)'
};

const HTML_FORM = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VaB LBC Planting and Removal Request</title>
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

        .checkbox-group {
            margin: 10px 0;
        }

        .checkbox-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }

        input[type="checkbox"] {
            margin-right: 10px;
            cursor: pointer;
            width: 18px;
            height: 18px;
        }

        .checkbox-item label {
            margin: 0;
            font-weight: normal;
            cursor: pointer;
        }

        .hint-text {
            font-size: 12px;
            color: #666;
            margin: 5px 0 10px 0;
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
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VaB Landscape & Building Committee</h1>
            <p>Homeowner Paid Planting and Removal Request</p>
        </div>

        <div class="form-content">
            <div id="alert" class="alert"></div>

            <form id="lbcForm">
                <!-- Name Section -->
                <div class="form-group">
                    <label class="required">Name</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <input type="text" id="firstName" name="firstName" placeholder="First Name" required>
                        <input type="text" id="lastName" name="lastName" placeholder="Last Name" required>
                    </div>
                </div>

                <!-- Unit Address -->
                <div class="form-group">
                    <label for="unitAddress" class="required">Unit Address in the Villas</label>
                    <input type="text" id="unitAddress" name="unitAddress" placeholder="e.g., 13737 Rock Pt, Unit 102" required>
                </div>

                <!-- Phone -->
                <div class="form-group">
                    <label for="phone" class="required">Phone Number</label>
                    <input type="tel" id="phone" name="phone" placeholder="(XXX) XXX-XXXX" required>
                </div>

                <!-- Email -->
                <div class="form-group">
                    <label for="email" class="required">Email</label>
                    <input type="email" id="email" name="email" placeholder="your@email.com" required>
                </div>

                <!-- Planting or Removal -->
                <div class="form-group">
                    <label class="required">Are you requesting new planting or removal?</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="newPlanting" name="plantingType" value="New Planting">
                            <label for="newPlanting">New Planting</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="removal" name="plantingType" value="Removal">
                            <label for="removal">Removal</label>
                        </div>
                    </div>
                </div>

                <!-- Location -->
                <div class="form-group">
                    <label for="location" class="required">Location of Proposed Planting or Removal</label>
                    <p class="hint-text">Be as specific as you can (e.g., Front yard rock area just right of sidewalk)</p>
                    <textarea id="location" name="location" placeholder="Describe the location in detail..." required></textarea>
                </div>

                <!-- Plant Type -->
                <div class="form-group">
                    <label class="required">What type of plant to be added or removed?</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="flowers" name="plantType" value="Flowers (Annuals/Perennials)">
                            <label for="flowers">Flowers (Annuals/Perennials)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="shrubs" name="plantType" value="Shrubs/Bushes">
                            <label for="shrubs">Shrubs/Bushes</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="tree" name="plantType" value="Small Tree (Specify species in next question)">
                            <label for="tree">Small Tree (Specify species in next question)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="other" name="plantType" value="Other (Specify in next question)">
                            <label for="other">Other (Specify in next question)</label>
                        </div>
                    </div>
                </div>

                <!-- Plant Species -->
                <div class="form-group">
                    <label for="species" class="required">List the specific plant species you wish removed or wish to have planted</label>
                    <p class="hint-text">Be as specific as you can. Include common or scientific names if you know them. The LBC reserves the right to reject specific requests and/or to suggest substitutes more suitable to our locale.</p>
                    <textarea id="species" name="species" placeholder="List plant species..." required></textarea>
                </div>

                <!-- Supporting Documentation -->
                <div class="form-group">
                    <label class="required">Supporting Documentation</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
                        Upload up to 5 files (images will be auto-compressed). You may optionally attach a sketch or photo showing the proposed planting location and the approximate layout/size of the proposed planting area.
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

                <!-- Completion Date -->
                <div class="form-group">
                    <label for="completionDate" class="required">Planned (approximate) Completion Date</label>
                    <input type="date" id="completionDate" name="completionDate" required>
                </div>

                <!-- Admonition Text -->
                <div class="admonition">
                    I understand that I must receive approval of the LBC in order to proceed. I agree to be responsible for the initial care of all plantings, including watering and maintenance during the establishment period (typically the first growing season). For trees, I agree to provide appropriate care to promote tree health and viability for the first three years after planting, and to replace the tree at my own expense if it does not survive this period. I understand and accept that the LBC reserves the right to reject specific planting requests or to suggest substitutes more suitable to the Villas at the Boulders landscape.
                </div>

                <!-- Signature -->
                <div class="signature-section">
                    <label for="signature" class="required">Your Signature</label>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Typing your name signifies your acceptance and has the same legal force as a signed signature.</p>
                    <input type="text" id="signature" name="signature" placeholder="Type your full name" required>
                </div>

                <!-- Submission Date (auto-filled) -->
                <input type="hidden" id="submissionDate" name="submissionDate">

                <!-- Form Actions -->
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

        // Set submission date to today
        document.getElementById('submissionDate').value = new Date().toISOString().split('T')[0];

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
                } else if (file.type === 'application/pdf') {
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

            const formData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                unitAddress: document.getElementById('unitAddress').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                plantingType: Array.from(document.querySelectorAll('input[name="plantingType"]:checked')).map(cb => cb.value),
                location: document.getElementById('location').value,
                plantType: Array.from(document.querySelectorAll('input[name="plantType"]:checked')).map(cb => cb.value),
                species: document.getElementById('species').value,
                completionDate: document.getElementById('completionDate').value,
                signature: document.getElementById('signature').value,
                submissionDate: document.getElementById('submissionDate').value,
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
                            document.getElementById('submissionDate').value = new Date().toISOString().split('T')[0];
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
  const required = ['firstName', 'lastName', 'unitAddress', 'phone', 'email', 'plantingType', 'location', 'plantType', 'species', 'completionDate', 'signature'];

  for (const field of required) {
    if (!data[field] || (Array.isArray(data[field]) ? data[field].length === 0 : data[field].trim && data[field].trim() === '')) {
      throw new Error(\`Required field missing: \${field}\`);
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

    addPdfHeader(body, formData.completionDate);
    addFormFields(body, formData);

    if (formData.files && formData.files.length > 0) {
      addSupportingDocumentation(body, formData.files);
    }

    addCompletionDate(body, formData.completionDate);
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

function addPdfHeader(body, completionDate) {
  // Add date in top right
  const dateTable = body.appendTable([[formatDateString(new Date())]]);
  const dateCell = dateTable.getCell(0, 0);
  dateCell.setText('');
  const dateP = dateCell.appendParagraph(formatDateString(new Date()));
  dateP.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  dateP.setFontSize(11);

  // Set table properties for borderless look
  dateTable.setBorderColor('#ffffff');
  dateTable.setColumnWidth(0, 400);

  // Add decorative header line (green accent)
  const decorativeLine = body.appendParagraph('');
  decorativeLine.setSpacingAfter(0);
  const decoration = decorativeLine.editAsText();
  decoration.setText('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  decoration.setForegroundColor('#2d7d3a');
  decoration.setFontSize(8);

  // Add title
  const titleParagraph = body.appendParagraph('VaB Landscape & Building Committee');
  titleParagraph.setFontSize(20);
  titleParagraph.setBold(true);
  titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleParagraph.setSpacingAfter(5);
  titleParagraph.setForegroundColor('#1a3a52');

  // Add subtitle
  const subtitleParagraph = body.appendParagraph('Homeowner Paid Planting and Removal Request');
  subtitleParagraph.setFontSize(14);
  subtitleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  subtitleParagraph.setSpacingAfter(12);

  // Add spacing
  body.appendParagraph('').setSpacingAfter(8);
}

function addFormFields(body, formData) {
  const fields = [
    { label: 'Name', value: formData.firstName + ' ' + formData.lastName },
    { label: 'Unit Address in the Villas', value: formData.unitAddress },
    { label: 'Phone Number', value: formData.phone },
    { label: 'Email', value: formData.email },
    { label: 'Are you requesting new planting or removal?', value: formData.plantingType.join(', ') },
    { label: 'Location of Proposed Planting or Removal', value: formData.location },
    { label: 'What type of plant to be added or removed?', value: formData.plantType.join(', ') },
    { label: 'List the specific plant species', value: formData.species }
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
  const admonitionText = 'I understand that I must receive approval of the LBC in order to proceed. I agree to be responsible for the initial care of all plantings, including watering and maintenance during the establishment period (typically the first growing season). For trees, I agree to provide appropriate care to promote tree health and viability for the first three years after planting, and to replace the tree at my own expense if it does not survive this period. I understand and accept that the LBC reserves the right to reject specific planting requests or to suggest substitutes more suitable to the Villas at the Boulders landscape.';

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

  const submissionDateValue = body.appendParagraph(formatDateString(new Date(formData.submissionDate)));
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
  const contactParagraph = body.appendParagraph(\`Direct questions to the HOA manager: \${CONFIG.MANAGER_EMAIL} or \${CONFIG.MANAGER_PHONE}\`);
  contactParagraph.setFontSize(10);
  contactParagraph.setSpacingAfter(15);
}

function addLbcActionSection(body) {
  const actionTitle = body.appendParagraph('LBC Committee Action:');
  actionTitle.setBold(true);
  actionTitle.setFontSize(12);
  actionTitle.setSpacingAfter(5);

  const checkboxesParagraph = body.appendParagraph('Approved as Submitted: ___     Approved with Conditions: ___     Disapproved: ___');
  checkboxesParagraph.setFontSize(11);
  checkboxesParagraph.setSpacingAfter(8);

  const conditionsLabel = body.appendParagraph('Conditions or disapproval reasons:');
  conditionsLabel.setFontSize(11);
  conditionsLabel.setSpacingAfter(10);

  const conditionsPlaceholder = body.appendParagraph('\n\n\n');
  conditionsPlaceholder.setFontSize(10);
  conditionsPlaceholder.setSpacingAfter(15);

  const signatureLabel = body.appendParagraph('LBC Committee Signature');
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
  const homeownerName = formData.firstName + ' ' + formData.lastName;
  const subject = \`VaB LBC Request — \${homeownerName} — \${formData.unitAddress}\`;

  const body = \`LBC Planting/Removal Request Submission

Homeowner: \${homeownerName}
Unit: \${formData.unitAddress}
Phone: \${formData.phone}
Email: \${formData.email}
Submission Date: \${formatDateString(new Date(formData.submissionDate))}

Request Type: \${formData.plantingType.join(', ')}
Plant Type: \${formData.plantType.join(', ')}

Location:
\${formData.location}

Plant Species:
\${formData.species}

Planned Completion: \${formatDateString(new Date(formData.completionDate))}

Supporting Documents:
\${processedFiles.map(f => '• ' + f.name).join('\n')}

---
PDF form attached. All supporting documents and photos included as attachments.\`;

  const emailFileName = \`LBC_Request_\${formatFilenameFriendly(homeownerName)}_\${getTodayDate()}.pdf\`;
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
  const homeownerName = formData.firstName + ' ' + formData.lastName;
  const folder = DriveApp.getFolderById(CONFIG.ARCHIVE_FOLDER_ID);
  const fileName = \`\${formatFilenameFriendly(homeownerName)}_\${formatFilenameFriendly(formData.unitAddress)}_\${getTodayDate()}.pdf\`;
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
  return \`\${year}-\${month}-\${day}\`;
}
