const CONFIG = {
  sheetId: '1VH1UQdEQYDY3cSXVEjIhWxq7r6x3wmvm', // Will be set once Sheet is created
  adminEmail: 'admin@villasboulders.org',
  timeZone: 'America/Denver',
};

const STREET_GROUPS = {
  'Boulder Circle': { email: 'bouldercircle@villasboulders.org', url: 'https://groups.google.com/a/villasboulders.org/g/bouldercircle' },
  'Boulder Point': { email: 'boulderpoint@villasboulders.org', url: 'https://groups.google.com/a/villasboulders.org/g/boulderpoint' },
  'Broadlands Lane': { email: 'broadlandslane@villasboulders.org', url: 'https://groups.google.com/a/villasboulders.org/g/broadlandslane' },
  'Plaster Point': { email: 'plasterpoint@villasboulders.org', url: 'https://groups.google.com/a/villasboulders.org/g/plasterpoint' },
  'Rock Point': { email: 'rockpoint@villasboulders.org', url: 'https://groups.google.com/a/villasboulders.org/g/rockpoint' },
  'Stone Circle': { email: 'stonecircle@villasboulders.org', url: 'https://groups.google.com/a/villasboulders.org/g/stonecircle' },
};

const CATEGORIES = [
  'Vendor recommendation',
  'Help needed',
  'For sale or giveaway',
  'General',
];

function doGet(e) {
  const page = e.parameter && e.parameter.page ? e.parameter.page : 'board';

  if (page === 'post') {
    return HtmlService.createHtmlOutput(generatePostPageHTML())
      .setWidth(800)
      .setHeight(1400);
  }

  // Default: browse page (full-screen for linking from Sites)
  return HtmlService.createHtmlOutput(generateBrowsePageHTML())
    .setWidth(1200)
    .setHeight(1600);
}

function generatePostPageHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post to Community Board</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #f0f2f5 0%, #e8eaed 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .form-container {
      max-width: 700px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a3a52 0%, #2d5f3f 100%);
      color: white;
      padding: 20px;
      text-align: center;
      border-bottom: 4px solid #2d7d3a;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      font-weight: bold;
    }
    .subtitle {
      font-size: 13px;
      opacity: 0.95;
    }
    .form-content {
      padding: 25px;
    }
    .form-section {
      margin-bottom: 18px;
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
    textarea,
    select {
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
    textarea:focus,
    select:focus {
      outline: none;
      border-color: #2d5f3f;
      box-shadow: 0 0 0 3px rgba(45,95,63,0.1);
    }
    textarea {
      resize: vertical;
      min-height: 100px;
      font-family: Arial, sans-serif;
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
      align-items: flex-start;
      gap: 8px;
    }
    input[type="radio"],
    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .radio-item label,
    .checkbox-item label {
      margin: 0;
      font-weight: normal;
      font-size: 13px;
      cursor: pointer;
      color: #333;
    }
    .hint {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
      font-style: italic;
    }
    .button-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 25px;
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
      padding: 12px 15px;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: bold;
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
    .back-link {
      text-align: center;
      margin-top: 15px;
    }
    .back-link a {
      color: #1a3a52;
      text-decoration: none;
      font-size: 13px;
      font-weight: bold;
    }
    .back-link a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="header">
      <h1>Post to Community Board</h1>
      <div class="subtitle">Share with your neighbors — not official HOA business</div>
    </div>
    <div class="form-content">
      <div id="message" class="message"></div>

      <div class="form-section">
        <label class="required">Display name</label>
        <input type="text" id="displayName" placeholder="e.g., Jane S." required>
        <div class="hint">First name + last initial is fine</div>
      </div>

      <div class="form-section">
        <label class="required">Street</label>
        <select id="street" required>
          <option value="">Select your street...</option>
          <option>Boulder Circle</option>
          <option>Boulder Point</option>
          <option>Broadlands Lane</option>
          <option>Plaster Point</option>
          <option>Rock Point</option>
          <option>Stone Circle</option>
        </select>
      </div>

      <div class="form-section">
        <label class="required">Unit / address</label>
        <input type="text" id="address" placeholder="e.g., 123 Boulder Circle" required>
        <div class="hint">For moderation only — not published on the board</div>
      </div>

      <div class="form-section">
        <label class="required">Category</label>
        <select id="category" required>
          <option value="">Select a category...</option>
          <option>Vendor recommendation</option>
          <option>Help needed</option>
          <option>For sale or giveaway</option>
          <option>General</option>
        </select>
      </div>

      <div class="form-section">
        <label class="required">Title</label>
        <input type="text" id="title" placeholder="Max ~80 chars" required>
        <div class="hint">Example: "Reliable plumber — leak under sink"</div>
      </div>

      <div class="form-section">
        <label class="required">Details</label>
        <textarea id="details" required></textarea>
        <div class="hint">No medical details, please. Neighbor-to-neighbor only.</div>
      </div>

      <div class="form-section">
        <label>Vendor name (if recommending)</label>
        <input type="text" id="vendorName" placeholder="e.g., ABC Plumbing">
        <div class="hint">Only if Category is "Vendor recommendation"</div>
      </div>

      <div class="form-section">
        <label class="required">May we publish your contact info?</label>
        <div class="radio-group">
          <div class="radio-item">
            <input type="radio" id="contactYes" name="contactOK" value="Yes" required>
            <label for="contactYes">Yes — publish the contact I enter below</label>
          </div>
          <div class="radio-item">
            <input type="radio" id="contactNo" name="contactOK" value="No" required>
            <label for="contactNo">No — website only, contact me through the street group</label>
          </div>
        </div>
      </div>

      <div class="form-section">
        <label>Your contact (if publishing)</label>
        <input type="text" id="publishableContact" placeholder="Phone or email (only if Yes above)">
        <div class="hint">Leave blank if you chose "No" above</div>
      </div>

      <div class="form-section">
        <label class="checkbox-group">
          <input type="checkbox" id="emailStreetGroup">
          <span>Email this post to my street Group</span>
        </label>
        <div class="hint">Checked = we'll send a copy to your street Group once approved</div>
      </div>

      <div class="form-section">
        <label class="required">
          <input type="checkbox" id="acknowledgement" required>
          <span>I understand: this is neighbor-to-neighbor, not official HOA; no medical details; board may hide posts</span>
        </label>
      </div>

      <div class="button-group">
        <button type="button" id="resetBtn" onclick="document.querySelectorAll('#displayName, #street, #address, #category, #title, #details, #vendorName, #publishableContact').forEach(el => el.value = ''); document.getElementById('contactYes').checked = false; document.getElementById('contactNo').checked = false; document.getElementById('emailStreetGroup').checked = false; document.getElementById('acknowledgement').checked = false;">Clear</button>
        <button type="button" id="submitBtn" onclick="submitPost()">Post to Board</button>
      </div>

      <div class="back-link">
        <a href="javascript:void(0);" onclick="window.location.href=window.location.href.split('?')[0];">← Back to Community Board</a>
      </div>
    </div>
  </div>

  <script>
    function submitPost() {
      const displayName = document.getElementById('displayName').value.trim();
      const street = document.getElementById('street').value.trim();
      const address = document.getElementById('address').value.trim();
      const category = document.getElementById('category').value.trim();
      const title = document.getElementById('title').value.trim();
      const details = document.getElementById('details').value.trim();
      const vendorName = document.getElementById('vendorName').value.trim();
      const contactOK = document.querySelector('input[name="contactOK"]:checked')?.value || '';
      const publishableContact = document.getElementById('publishableContact').value.trim();
      const emailStreetGroup = document.getElementById('emailStreetGroup').checked;
      const acknowledgement = document.getElementById('acknowledgement').checked;

      // Validate required fields
      if (!displayName || !street || !address || !category || !title || !details || !contactOK || !acknowledgement) {
        showMessage('Please fill in all required fields.', 'error');
        return;
      }

      // Validate contact pairing
      if (contactOK === 'Yes' && !publishableContact) {
        showMessage('If you said Yes, please enter a phone or email.', 'error');
        return;
      }

      const formData = {
        displayName,
        street,
        address,
        category,
        title,
        details,
        vendorName,
        contactOK,
        publishableContact: contactOK === 'Yes' ? publishableContact : '',
        emailStreetGroup,
        timestamp: new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }),
      };

      document.getElementById('submitBtn').disabled = true;
      document.getElementById('submitBtn').textContent = 'Posting...';

      google.script.run
        .withSuccessHandler(function() {
          showMessage('Thank you! Your post is pending approval. Check back soon.', 'success');
          document.getElementById('submitBtn').disabled = false;
          document.getElementById('submitBtn').textContent = 'Post to Board';
          setTimeout(() => {
            window.location.href = window.location.href.split('?')[0];
          }, 2000);
        })
        .withFailureHandler(function(err) {
          showMessage('Error: ' + (err || 'Failed to post. Try again.'), 'error');
          document.getElementById('submitBtn').disabled = false;
          document.getElementById('submitBtn').textContent = 'Post to Board';
        })
        .submitPost(formData);
    }

    function showMessage(text, type) {
      const msgEl = document.getElementById('message');
      msgEl.textContent = text;
      msgEl.className = 'message ' + type;
    }
  </script>
</body>
</html>
  `;
}

function generateBrowsePageHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Community Board</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #1a3a52 0%, #2d5f3f 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
      border-bottom: 4px solid #2d7d3a;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 14px;
      opacity: 0.95;
      margin-bottom: 15px;
    }
    .policy {
      font-size: 12px;
      opacity: 0.9;
      line-height: 1.5;
      max-width: 700px;
      margin: 15px auto 0;
      text-align: left;
    }
    .policy p {
      margin: 5px 0;
    }
    .policy strong {
      font-weight: bold;
    }
    .controls-container {
      background: white;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .control-group {
      display: flex;
      flex-direction: column;
    }
    .control-group label {
      font-weight: bold;
      font-size: 12px;
      color: #1a3a52;
      margin-bottom: 4px;
    }
    .control-group select,
    .control-group input {
      padding: 6px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      font-family: Arial, sans-serif;
    }
    .control-group select:focus,
    .control-group input:focus {
      outline: none;
      border-color: #2d5f3f;
      box-shadow: 0 0 0 2px rgba(45,95,63,0.1);
    }
    .action-buttons {
      display: flex;
      gap: 8px;
    }
    .action-buttons button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
    }
    #postBtn {
      background-color: #2d7d3a;
      color: white;
      flex: 1;
    }
    #postBtn:hover {
      background-color: #1a4d22;
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(45,125,58,0.3);
    }
    .reset-btn {
      background-color: #ddd;
      color: #333;
    }
    .reset-btn:hover {
      background-color: #bbb;
    }
    .posts-grid {
      display: grid;
      gap: 15px;
    }
    .post-card {
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      padding: 18px;
      border-left: 4px solid #2d7d3a;
    }
    .post-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .post-title {
      font-weight: bold;
      font-size: 15px;
      color: #1a3a52;
      max-width: 70%;
    }
    .post-meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .post-badge {
      display: inline-block;
      background-color: #e8f4f8;
      color: #0c5460;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
    }
    .post-details {
      font-size: 13px;
      color: #333;
      line-height: 1.5;
      margin-bottom: 10px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .post-vendor {
      background-color: #fff8e1;
      padding: 6px;
      border-radius: 3px;
      font-size: 12px;
      margin-bottom: 8px;
      border-left: 2px solid #ffc107;
    }
    .post-vendor-label {
      font-weight: bold;
      color: #856404;
    }
    .post-contact {
      font-size: 12px;
      color: #1a3a52;
      background-color: #f0f2f5;
      padding: 6px;
      border-radius: 3px;
      margin-bottom: 8px;
    }
    .post-contact-label {
      font-weight: bold;
    }
    .post-street {
      font-size: 12px;
      color: #1a3a52;
      margin-bottom: 8px;
    }
    .post-street-label {
      font-weight: bold;
    }
    .post-author {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    }
    .post-author-label {
      font-weight: bold;
    }
    .post-timestamp {
      font-size: 11px;
      color: #999;
    }
    .post-action {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }
    .post-action a {
      color: #2d7d3a;
      text-decoration: none;
      font-weight: bold;
      font-size: 12px;
    }
    .post-action a:hover {
      text-decoration: underline;
    }
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }
    .empty-state p {
      font-size: 14px;
      margin: 10px 0;
    }
    .loading {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
    .post-count {
      padding: 12px 20px;
      background: #f0f2f5;
      border-radius: 4px;
      font-size: 12px;
      color: #1a3a52;
      font-weight: bold;
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Community Board</h1>
      <div class="subtitle">Neighbor-to-neighbor. Not official HOA business.</div>
      <div class="policy">
        <p><strong>What's this?</strong> A place for vendors you like, help requests, items for sale/giveaway, and neighborhood tips.</p>
        <p><strong>How it works:</strong> Posts are approved before they show up. Use your <strong>street Google Group</strong> to discuss a post with neighbors.</p>
        <p><strong>Important:</strong> Board may hide posts that don't fit. No medical details, please.</p>
      </div>
    </div>

    <div class="controls-container">
      <div class="control-group">
        <label>Category</label>
        <select id="categoryFilter" onchange="filterPosts()">
          <option value="">All categories</option>
          <option value="Vendor recommendation">Vendor recommendation</option>
          <option value="Help needed">Help needed</option>
          <option value="For sale or giveaway">For sale or giveaway</option>
          <option value="General">General</option>
        </select>
      </div>
      <div class="control-group">
        <label>Street</label>
        <select id="streetFilter" onchange="filterPosts()">
          <option value="">All streets</option>
          <option>Boulder Circle</option>
          <option>Boulder Point</option>
          <option>Broadlands Lane</option>
          <option>Plaster Point</option>
          <option>Rock Point</option>
          <option>Stone Circle</option>
        </select>
      </div>
      <div class="control-group">
        <label>Search</label>
        <input type="text" id="searchBox" placeholder="Search posts..." onkeyup="filterPosts()">
      </div>
      <div class="control-group action-buttons">
        <button type="button" id="postBtn" onclick="goToPostPage()">Post Something</button>
        <button type="button" class="reset-btn" onclick="resetFilters()">Reset</button>
      </div>
    </div>

    <div id="postsContainer">
      <div class="loading">Loading posts...</div>
    </div>
  </div>

  <script>
    let allPosts = [];

    function loadPosts() {
      google.script.run
        .withSuccessHandler(function(posts) {
          allPosts = posts || [];
          displayPosts(allPosts);
        })
        .withFailureHandler(function(err) {
          document.getElementById('postsContainer').innerHTML = '<div class="empty-state"><p>Error loading posts.</p></div>';
        })
        .getPublishedPosts();
    }

    function displayPosts(posts) {
      const container = document.getElementById('postsContainer');

      if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No posts yet. Be the first!</p></div>';
        return;
      }

      let html = '<div class="post-count">Showing ' + posts.length + ' post' + (posts.length === 1 ? '' : 's') + '</div>';
      html += '<div class="posts-grid">';

      posts.forEach(post => {
        const timestamp = post.timestamp ? new Date(post.timestamp).toLocaleDateString() : 'Unknown date';

        html += '<div class="post-card">';
        html += '<div class="post-header">';
        html += '<div class="post-title">' + escapeHtml(post.title) + '</div>';
        html += '</div>';

        html += '<div class="post-meta">';
        html += '<span class="post-badge">' + escapeHtml(post.category) + '</span>';
        html += '</div>';

        html += '<div class="post-author"><span class="post-author-label">Posted by:</span> ' + escapeHtml(post.displayName) + '</div>';

        html += '<div class="post-street"><span class="post-street-label">Street:</span> ' + escapeHtml(post.street) + '</div>';

        if (post.vendorName) {
          html += '<div class="post-vendor"><span class="post-vendor-label">Vendor:</span> ' + escapeHtml(post.vendorName) + '</div>';
        }

        html += '<div class="post-details">' + escapeHtml(post.details) + '</div>';

        if (post.publishableContact) {
          html += '<div class="post-contact"><span class="post-contact-label">Contact:</span> ' + escapeHtml(post.publishableContact) + '</div>';
        }

        html += '<div class="post-timestamp">Posted ' + timestamp + '</div>';

        if (post.streetGroupUrl) {
          html += '<div class="post-action"><a href="' + post.streetGroupUrl + '" target="_blank">Discuss on ' + escapeHtml(post.street) + ' group →</a></div>';
        }

        html += '</div>';
      });

      html += '</div>';
      container.innerHTML = html;
    }

    function filterPosts() {
      const category = document.getElementById('categoryFilter').value.toLowerCase();
      const street = document.getElementById('streetFilter').value.toLowerCase();
      const search = document.getElementById('searchBox').value.toLowerCase();

      const filtered = allPosts.filter(post => {
        const matchCategory = !category || post.category.toLowerCase().includes(category);
        const matchStreet = !street || post.street.toLowerCase().includes(street);
        const matchSearch = !search ||
          post.title.toLowerCase().includes(search) ||
          post.details.toLowerCase().includes(search) ||
          (post.vendorName && post.vendorName.toLowerCase().includes(search));

        return matchCategory && matchStreet && matchSearch;
      });

      displayPosts(filtered);
    }

    function resetFilters() {
      document.getElementById('categoryFilter').value = '';
      document.getElementById('streetFilter').value = '';
      document.getElementById('searchBox').value = '';
      displayPosts(allPosts);
    }

    function goToPostPage() {
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('?')[0];
      window.location.href = baseUrl + '?page=post';
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Load posts on page load
    loadPosts();
  </script>
</body>
</html>
  `;
}

function submitPost(formData) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.sheetId);
    const formResponsesTab = sheet.getSheetByName('Form Responses');

    if (!formResponsesTab) {
      throw new Error('Form Responses tab not found');
    }

    // Append row: Timestamp, Display name, Street, Unit/address, Category, Title, Details,
    // Vendor name, Contact OK, Publishable contact, Email-to-street-group, Approved, Hidden reason
    formResponsesTab.appendRow([
      formData.timestamp,
      formData.displayName,
      formData.street,
      formData.address,
      formData.category,
      formData.title,
      formData.details,
      formData.vendorName || '',
      formData.contactOK,
      formData.publishableContact || '',
      formData.emailStreetGroup ? 'Yes' : 'No',
      '', // Approved (blank = pending)
      '', // Hidden reason
    ]);

    // Send notification to admin
    const subject = '[Community Board] New post pending approval: ' + formData.title;
    const body = 'Display name: ' + formData.displayName + '\n' +
                'Street: ' + formData.street + '\n' +
                'Address: ' + formData.address + '\n' +
                'Category: ' + formData.category + '\n' +
                'Title: ' + formData.title + '\n' +
                'Details: ' + formData.details + '\n' +
                (formData.vendorName ? 'Vendor: ' + formData.vendorName + '\n' : '') +
                'Contact OK: ' + formData.contactOK + '\n' +
                (formData.publishableContact ? 'Published contact: ' + formData.publishableContact + '\n' : '') +
                (formData.emailStreetGroup ? 'Request to email street group: Yes\n' : '') +
                '\nView and moderate at: https://docs.google.com/spreadsheets/d/' + CONFIG.sheetId;

    GmailApp.sendEmail(CONFIG.adminEmail, subject, body);

  } catch (err) {
    throw new Error('Failed to submit post: ' + err.toString());
  }
}

function getPublishedPosts() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.sheetId);
    const formResponsesTab = sheet.getSheetByName('Form Responses');

    if (!formResponsesTab) {
      return [];
    }

    const data = formResponsesTab.getDataRange().getValues();
    const headers = data[0];
    const posts = [];

    // Find column indices
    const colIndex = {};
    headers.forEach((header, idx) => {
      colIndex[header.trim().toLowerCase()] = idx;
    });

    // Process rows (skip header, start at row 2)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const approved = row[colIndex['approved']] === true || row[colIndex['approved']] === 'TRUE';

      if (!approved) continue; // Only include Approved = TRUE

      const street = row[colIndex['street']] || '';
      const streetGroup = STREET_GROUPS[street];

      const post = {
        timestamp: row[colIndex['timestamp']] || '',
        displayName: row[colIndex['display name']] || 'Anonymous',
        street: street,
        category: row[colIndex['category']] || '',
        title: row[colIndex['title']] || '',
        details: row[colIndex['details']] || '',
        vendorName: row[colIndex['vendor name']] || '',
        contactOK: row[colIndex['contact ok']] || '',
        publishableContact: (row[colIndex['contact ok']] === 'Yes' || row[colIndex['contact ok']] === true)
          ? (row[colIndex['publishable contact']] || '')
          : '',
        streetGroupUrl: streetGroup ? streetGroup.url : '',
      };

      posts.push(post);
    }

    // Sort by timestamp, newest first
    posts.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA;
    });

    return posts;

  } catch (err) {
    Logger.log('Error in getPublishedPosts: ' + err.toString());
    return [];
  }
}
