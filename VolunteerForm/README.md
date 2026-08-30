# VaB Volunteer Interest Form

Web app form for collecting volunteer interest from HOA members.

## Deployment Instructions

### 1. Create the Apps Script project

```bash
cd VolunteerForm
clasp create --type webapp --title "VaB Volunteer Interest Form"
```

This will generate a Script ID and update `.clasp.json`.

### 2. Push code to Google Apps Script

```bash
clasp push
```

### 3. Deploy as a web app

```bash
clasp deploy --description "VaB Volunteer Interest Form"
```

This will output a Deployment ID. Copy it and update `DEPLOYMENT_INFO.txt`.

### 4. Create DEPLOYMENT_INFO.txt

Document the deployment URL:

```
VaB Volunteer Interest Form - Deployment Info
==============================================

Deployment ID:
[DEPLOYMENT_ID_HERE]

Public URL (click or paste in browser):
https://script.google.com/macros/s/[DEPLOYMENT_ID_HERE]/exec

Website Embed (iframe for https://www.villasboulders.org/forms/volunteer-interest):
<iframe
  src="https://script.google.com/macros/s/[DEPLOYMENT_ID_HERE]/exec"
  width="100%"
  height="1400"
  frameborder="0"
  style="border: none; padding: 0; margin: 0;">
</iframe>
```

## Form Fields

- **Name** (First & Last, required)
- **Email** (required)
- **Phone** (required)
- **Preferred Committees/Groups** (checkboxes, required)
  - Architectural Review Committee
  - Landscape Beautification Committee
  - LBC Weekend Workgroup
  - Snow Squad
  - Information Contact for my street with the board
  - Board of Directors
  - Website content editing/improvement
  - Helping with the Newsletter
  - Helping to greet new neighbors
  - Helping to find group discount opportunities
  - Anywhere I can be useful
- **Availability Preference** (radio buttons, required)
  - Weekdays (Daytime)
  - Weekdays (Evening)
  - Weekends
  - Flexible
- **Special Skills** (checkboxes, optional)
- **How do you envision contributing?** (text area, optional)

## Form Submission Flow

1. User fills out form in iframe on website
2. Form validates and sends data to Apps Script backend
3. Backend generates a PDF document with all submitted information
4. PDF is saved to Google Drive folder: `1MTV9Rbl79Kp1E0-oNEQbFZ6Kz5EC6pub`
5. Email is sent to `board@villasboulders.org` with PDF link
6. User sees success message

## Configuration

Edit `CODE.gs` Config object to change:
- `parentFolderId` - Google Drive folder ID where PDFs are stored
- `recipientEmail` - Email address for form submissions
