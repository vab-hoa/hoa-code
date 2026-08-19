# LBC Request Form Project Context

## What We're Building

A replacement for the JotForm "Homeowner Paid Planting or Removal" form using Google Apps Script. This is a web app that homeowners use to request landscape work (planting or removal of plants/trees).

**Deployed to:** Villas at the Boulders HOA (villasboulders.org)
**Recipients:** lbcformrecipients@villasboulders.org
**Archive Location:** HOA Board Documents > Homeowner Forms > LBC Request Forms (folder ID: 12LnOEsFn4I032iFWp6Wwm5que68Hmn0A)

## The Form (13 Required Fields)

1. **Name** — First Name / Last Name (two fields)
2. **Unit Address in the Villas** — text field
3. **Phone Number** — formatted tel input
4. **Email** — email input
5. **Are you requesting new planting or removal?** — Checkboxes (New Planting, Removal) - at least one required
6. **Location of Proposed Planting or Removal** — Textarea with hint about specificity
7. **What type of plant to be added or removed?** — Multi-select checkboxes:
   - Flowers (Annuals/Perennials)
   - Shrubs/Bushes
   - Small Tree (Specify species in next question)
   - Other (Specify in next question)
   - At least one required
8. **List the specific plant species** — Textarea with LBC guidance
9. **Supporting Documentation** — File upload (optional, max 5 files)
10. **Planned Completion Date** — Date field
11. **Admonition Text** — Legal disclaimer about 3-year tree care responsibility (italicized)
12. **Your Signature** — Text input (typing counts as legal signature)
13. **Submission Date** — Auto-filled to today's date

## Current Issue

**Problem:** Form deployed but returns "file not found" error when accessed via deployment URL. When doGet() is run manually in the Apps Script editor, it completes with no output and no logs.

**What we know:**
- Code.gs is in the editor
- HTML_FORM appears to be defined with proper backticks
- doGet() function syntax looks correct: `return HtmlService.createHtmlOutput(HTML_FORM).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);`
- No syntax errors shown in editor
- Manual execution: "started... completed" with zero output

**Likely causes:**
- HTML_FORM is undefined or empty despite appearing complete
- Template string syntax error in the middle of HTML_FORM
- doGet() not actually returning anything (returns undefined)

## Apps Script Project Details

- **Script ID:** 1pEs0whIdD9roq4Xnir1jIKfh2bmKmGp9iMrA_PdDQdPFOaird8rpa2rt
- **Project Name:** VAB LBC Request Form
- **Sharing:** Anyone with the link
- **Current Deployment ID:** AKfycbxGGI7V3aH8BsMLl0Rerx7G11PBpawXLzF5nnPbfK9x9II59WN8iFSRubjJT9b6Nu66
- **Last 6 chars verification:** b6Nu66

## File Structure

```
/home/dee/hoa-code/LBC_RequestForm/
├── Code.gs                 # Apps Script backend + inlined HTML form
├── appsscript.json         # Apps Script manifest
├── .clasp.json             # Clasp config with Script ID
├── DEPLOYMENT_URL.txt      # Current deployment URL
├── ss/                      # JotForm screenshots for reference
└── PROJECT_CONTEXT.md      # This file
```

## What's Been Done

1. ✅ Created Apps Script project in Google Workspace
2. ✅ Built form with all 13 fields (agent-built, then VSCode rebuild)
3. ✅ Implemented validation for checkboxes
4. ✅ Implemented PDF generation with all fields
5. ✅ Implemented email sending to lbcformrecipients@
6. ✅ Implemented Drive archiving to correct folder
7. ✅ Created deploy.sh script for automated deployment
8. ✅ Fixed clasp authentication issues
9. ✅ Pushed code to Apps Script
10. ✅ Created deployments
11. ❌ **BLOCKED:** Deployment not working - doGet() not returning HTML

## What Needs to Happen Next

1. **Debug doGet()** — Determine why it's not returning HTML_FORM
2. **Fix Code.gs** — Resolve the issue
3. **Push changes** — `clasp push --force`
4. **Deploy** — `clasp deploy --description "..."`
5. **Test in browser** — Verify form loads
6. **Test submission workflow** — Fill form, verify email, verify PDF in Drive

## Related Project: ARC Request Form

There's a working ARC (Architectural Review) form in `/home/dee/hoa-code/ARC_RequestForm/` that we based the LBC form on. It uses the same pattern and is fully functional. The LBC form is a customized version with different fields and LBC-specific text.

**ARC Form Deployment URL:** https://script.google.com/macros/s/AKfycbxXissSSgEY26N3dRU_1jJAqsmxOjfF5ynzpVoq_UDIU9-uY7zSYf9jY0c4SsMUZNkh/exec

**Key difference:** ARC form works; LBC form has the doGet() issue described above.

## Important Notes

- The form must work in both regular and incognito browser mode
- When deployed, the form will be embedded in an iframe at: https://www.villasboulders.org/forms/landscape-request (or similar URL on the website)
- The PDF generated should match the professional style of the ARC form (green header, 2-column layout, professional typography)
- All 13 homeowner fields must be captured and included in the PDF and email
- The LBC Committee review section appears in the PDF only (not in the homeowner form)

## Testing Checklist

- [ ] Form loads in browser (regular and incognito)
- [ ] All 13 fields render correctly
- [ ] Validation works (checkboxes require selection)
- [ ] File upload works (client-side compression, up to 5 files)
- [ ] Form submission succeeds
- [ ] Success message displays and form resets
- [ ] Email arrives at lbcformrecipients@ with PDF + attachments
- [ ] PDF appears in Drive with correct naming and formatting
- [ ] Contact info points to manager@villasboulders.org
- [ ] LBC Committee section in PDF has proper format

## Clasp Commands

```bash
# Push code changes to Apps Script
clasp push --force

# Create a new deployment (returns new URL)
clasp deploy --description "description here"

# List all deployments
clasp deployments
```

## Questions for VSCode Claude

If you're reading this:
1. Read Code.gs completely
2. Check if HTML_FORM is properly defined
3. Verify doGet() will return it
4. Fix any issues found
5. Tell the user what you fixed
6. User will then run: `clasp push --force && clasp deploy --description "Fix doGet return issue"`
