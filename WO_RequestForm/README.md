# VaB ARC Request Form

Standalone Apps Script web app that replaces JotForm for Architectural Review Committee (ARC) requests. Handles form submission, PDF generation, email delivery, and Drive archiving.

## Features

- **Mobile-friendly HTML form** with client-side image compression
- **Automatic PDF generation** matching jotform design (navy/green theme)
- **Email delivery** to `arcrecipients@villasboulders.org` with all attachments
- **Google Drive archiving** to `HOA Board Documents > ARC Request Forms`
- **Image compression** on client (Canvas API): max 800×600, 80% JPEG quality
- **File upload support** (5 files max, accepts JPG, PNG, PDF)

## Setup

### 1. Create New Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Create a new project (name it "VaB ARC Request Form")
3. Copy the **Script ID** from:
   - Project Settings (gear icon) → Script ID
4. Paste the Script ID into `.clasp.json`:
   ```json
   {
     "scriptId": "YOUR_SCRIPT_ID_HERE",
     "rootDir": "."
   }
   ```

### 2. Push Code to Apps Script

```bash
cd ARC_RequestForm
clasp push
```

This uploads `Code.gs` and `index.html` to the Apps Script project.

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
`HOA Board Documents > ARC Request Forms`

**Folder ID:** `1-laNaFpH1eWuEs0f6_OtJ5Y0LkWXuUs7`

This is already set in `Code.gs` under `CONFIG.ARCHIVE_FOLDER_ID`. If the folder changes, update this value.

### 5. Verify Email Recipient

Email is sent to: `arcrecipients@villasboulders.org`

Verify this group exists in Google Workspace. If different, update `CODE.ARC_RECIPIENT`.

### 6. Embed on Website

The form is designed to be embedded on the VaB website at:  
`https://www.villasboulders.org/forms/architectural-review-request`

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
  Submit ARC Request
</a>
```

Replace `{deploymentId}` with the deployment ID from step 3.

## File Structure

```
ARC_RequestForm/
├── Code.gs           # Apps Script backend
├── index.html        # HTML form with client-side compression
├── .clasp.json       # Clasp configuration
└── README.md         # This file
```

## Testing

1. Open the deployed web app
2. Fill in form fields:
   - Name: "Test Homeowner"
   - Unit: "13737 Rock Pt, Unit 102"
   - Phone: "(303) 775-1709"
   - Email: Your email
   - Description: "Test improvement"
   - Files: Upload 1-2 test images
   - Completion Date: Pick a date
   - Signature: Type your name
3. Click **Submit Request**
4. Check:
   - Email arrives at `arcrecipients@villasboulders.org` with PDF + attachments
   - PDF is archived to Drive folder
   - Image files are compressed (check file sizes)

## Troubleshooting

### Email not arriving
- Check `arcrecipients@villasboulders.org` exists as a Google Group
- Verify Apps Script deployment has "Execute as" set to an account with send permission

### Drive upload fails
- Verify the folder ID is correct
- Ensure the executing account has write access to the Drive folder

### Image compression not working
- Check browser console for JavaScript errors
- Test with a fresh image file
- Fall back to server-side compression if needed (see Code.gs)

### PDF formatting issues
- The PDF is generated from a Google Doc formatted with DocumentApp
- Adjust spacing/fonts in the `addPdf*` functions in Code.gs
- Review jotform samples to match desired layout

## Architecture Notes

- **Client-side compression:** Images are resized and compressed in the browser using Canvas API before sending to Apps Script
- **PDF generation:** Uses Google Docs API (DocumentApp) to create a formatted document, then exports to PDF
- **Email:** GmailApp sends via the Workspace account (must have send permission)
- **Drive:** Files archived with inherited permissions from folder (automatically visible to arcrecipients@ group)

## Future Enhancements

- LBC (Landscape/Beautification Committee) request form (similar structure)
- Volunteer interest intake form
- Work request submission form

## Deployment Info

**Deployment ID:** `AKfycbwRHiLqZYDS9WqIFLK-bLd-75VBOUBzB-AdJLLyuuUdlUIcyRAZvthqFcxwLr7jG3jfsA`

**Public URL:** https://script.google.com/macros/s/AKfycbwRHiLqZYDS9WqIFLK-bLd-75VBOUBzB-AdJLLyuuUdlUIcyRAZvthqFcxwLr7jG3jfsA/exec

**Test it:** Open the public URL in a browser to verify the form loads and works on mobile.

## Author

Claude Code  
Created: August 17, 2026  
For: Dee Buck, Villas at the Boulders HOA President

---

**Live Form URL:** https://script.google.com/macros/s/AKfycbwRHiLqZYDS9WqIFLK-bLd-75VBOUBzB-AdJLLyuuUdlUIcyRAZvthqFcxwLr7jG3jfsA/exec

**Website Embed Location:** https://www.villasboulders.org/forms/architectural-review-request
