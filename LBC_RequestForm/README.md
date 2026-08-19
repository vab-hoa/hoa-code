# VaB LBC Request Form

Standalone Apps Script web app that replaces JotForm for Landscape & Building Committee (LBC) planting and removal requests. Handles form submission, PDF generation, email delivery, and Drive archiving.

## Features

- **Mobile-friendly HTML form** with client-side image compression
- **Automatic PDF generation** matching form design (navy/green theme)
- **Email delivery** to `lbcformrecipients@villasboulders.org` with all attachments
- **Google Drive archiving** to `HOA Board Documents > Homeowner Forms > LBC Request Forms`
- **Image compression** on client (Canvas API): max 800×600, 80% JPEG quality
- **File upload support** (5 files max, accepts JPG, PNG, PDF)
- **Checkbox groups** for plant type and request type selection

## Setup

### 1. Create New Apps Script Project

The script ID has already been created: `1pEs0whIdD9roq4Xnir1jIKfh2bmKmGp9iMrA_PdDQdPFOaird8rpa2rt`

The `.clasp.json` file already contains this ID.

### 2. Push Code to Apps Script

```bash
cd LBC_RequestForm
clasp push
```

This uploads `Code.gs` to the Apps Script project.

### 3. Deploy as Web App

In the Apps Script editor:

1. **Project Settings** (gear icon)
   - Note the Script ID and Project number

2. **Deployments** (rocket icon) → **New deployment**
   - Type: **Web app**
   - Execute as: **Your account** (or service account if available)
   - Who has access: **Anyone**

3. Copy the deployment URL:
   ```
   https://script.google.com/macros/d/{deploymentId}/userweb
   ```

### 4. Configure Drive Folder ID

The form archives PDFs to this folder:  
`HOA Board Documents > Homeowner Forms > LBC Request Forms`

**IMPORTANT:** You need to find/create this folder and update the folder ID in `Code.gs`:

```javascript
const CONFIG = {
  // ... other config ...
  ARCHIVE_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',  // Replace with actual folder ID
  // ...
};
```

To find the folder ID:
1. Open Google Drive
2. Navigate to `HOA Board Documents > Homeowner Forms > LBC Request Forms`
3. In the URL bar, the folder ID is the long string after `/folders/`

**Current Status:** The folder ID is set to `TBD_LBC_REQUEST_FORMS_FOLDER_ID` as a placeholder. This must be updated before the form will work in production.

### 5. Verify Email Recipient

Email is sent to: `lbcformrecipients@villasboulders.org`

Verify this group exists in Google Workspace. If different, update `CONFIG.LBC_RECIPIENT` in Code.gs.

### 6. Embed on Website

The form is designed to be embedded on the VaB website at:  
`https://www.villasboulders.org/forms/lbc-request`

**Option A: Embed via iframe** (preferred for website integration)
```html
<iframe 
  src="https://script.google.com/macros/d/{deploymentId}/userweb" 
  width="100%" 
  height="1200" 
  frameborder="0">
</iframe>
```

**Option B: Link directly**
```html
<a href="https://script.google.com/macros/d/{deploymentId}/userweb">
  Submit LBC Request
</a>
```

Replace `{deploymentId}` with the deployment ID from step 3.

## File Structure

```
LBC_RequestForm/
├── Code.gs           # Apps Script backend with inlined HTML/CSS/JS
├── .clasp.json       # Clasp configuration
├── appsscript.json   # Apps Script manifest
├── deploy.sh         # Deployment automation script
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

## Form Fields

**Homeowner Input Section (13 fields):**
1. Name (First Name / Last Name)
2. Unit Address in the Villas
3. Phone Number (formatted)
4. Email
5. Are you requesting new planting or removal? (checkboxes)
6. Location of Proposed Planting or Removal (multiline)
7. What type of plant? (checkboxes: Flowers, Shrubs, Small Tree, Other)
8. List the specific plant species (multiline)
9. Supporting Documentation (file upload, 5 max)
10. Planned Completion Date (date)
11. Admonition text (LBC-specific legal disclaimer)
12. Your Signature (text input)
13. Submission Date (auto-filled to today)

**PDF Committee Review Section:**
- Committee Action (Approved/Approved with Conditions/Disapproved)
- Conditions or disapproval reasons
- LBC Committee Signature and Date

## Testing

1. Open the deployed web app
2. Fill in form fields:
   - Name: "Test Homeowner"
   - Unit: "13737 Rock Pt, Unit 102"
   - Phone: "(303) 775-1709"
   - Email: Your email
   - Planting Type: Check "New Planting"
   - Location: "Front yard, right side"
   - Plant Type: Check "Flowers (Annuals/Perennials)"
   - Species: "Petunias, marigolds"
   - Files: Upload 1-2 test images (optional)
   - Completion Date: Pick a date
   - Signature: Type your name
3. Click **Submit Request**
4. Check:
   - Email arrives at `lbcformrecipients@villasboulders.org` with PDF + attachments
   - PDF is archived to Drive folder
   - Image files are compressed (check file sizes)

## Troubleshooting

### Email not arriving
- Check `lbcformrecipients@villasboulders.org` exists as a Google Group
- Verify Apps Script deployment has "Execute as" set to an account with send permission
- Check Gmail spam folder

### Drive upload fails
- Verify the folder ID is correct in `CONFIG.ARCHIVE_FOLDER_ID`
- Ensure the executing account has write access to the Drive folder
- Check that the folder path is correct: `HOA Board Documents > Homeowner Forms > LBC Request Forms`

### Image compression not working
- Check browser console for JavaScript errors
- Test with a fresh image file
- Verify browser supports Canvas API (modern browsers only)

### PDF formatting issues
- The PDF is generated from a Google Doc formatted with DocumentApp
- Adjust spacing/fonts in the `addPdf*` functions in Code.gs
- Review the generated PDFs to match desired layout

### Form won't load
- Check Apps Script deployment is public ("Anyone")
- Verify Script ID in `.clasp.json` matches the actual project
- Check browser console for JavaScript errors

## Deployment Automation

Use the `deploy.sh` script to automate pushing and deploying:

```bash
./deploy.sh "Initial deployment"
./deploy.sh "Fixed email template"
```

The script will:
1. Push code to Apps Script (`clasp push --force`)
2. Create a new deployment (`clasp deploy`)
3. Output the new public URL

## Architecture Notes

- **Client-side compression:** Images are resized and compressed in the browser using Canvas API before sending to Apps Script
- **PDF generation:** Uses Google Docs API (DocumentApp) to create a formatted document, then exports to PDF
- **Email:** GmailApp sends via the Workspace account (must have send permission)
- **Drive:** Files archived with inherited permissions from folder (automatically visible to lbcformrecipients@ group)
- **Checkbox groups:** Multiple selections allowed for plant type and request type; all selections included in PDF and email

## Future Enhancements

- SMS confirmation to homeowner phone number
- Status tracking dashboard for pending requests
- Integration with property database for address validation
- Automated LBC meeting agendas based on form submissions

## Known Issues

- **Folder ID placeholder:** The `ARCHIVE_FOLDER_ID` is currently set to a placeholder. Update with the actual folder ID before going live.
- **Email delivery:** Must verify the executing account has permission to send to Google Groups

## Author

Claude Code  
Created: August 19, 2026  
For: Dee Buck, Villas at the Boulders HOA President

---

**Script ID:** `1pEs0whIdD9roq4Xnir1jIKfh2bmKmGp9iMrA_PdDQdPFOaird8rpa2rt`

**Live Form URL:** To be filled in after deployment

**Website Embed Location:** https://www.villasboulders.org/forms/lbc-request
