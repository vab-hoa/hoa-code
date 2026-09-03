# Community Board

A neighbor-to-neighbor bulletin web app built with Google Apps Script. Homeowners can post vendor recommendations, help requests, items for sale, and general neighborhood info. Posts are manually approved by the HOA admin before appearing publicly.

## Features

- **Two-page web app** (single Apps Script deployment):
  - **Browse page**: Read-only, public list of approved posts with filters (category, street, search)
  - **Post page**: Submit form for new posts with required fields and validation
- **Sheet-based moderation**: Posts are stored in a Google Sheet; Dee moderates by toggling an `Approved` column (no special admin interface needed)
- **Street Group links**: Each post includes a link to the street's Google Group for discussion
- **No personal info leaked**: Unit addresses and email addresses are never shown on the public board
- **Notification**: Admin receives email notification when a new post is submitted (pending approval)

## Storage

- **Google Sheet**: `Villas at the Boulders Website Forms and Surveys / Community Board`
  - **Tabs**:
    - `Form Responses` — raw submissions (written by the web app)
    - `Config` — street → Google Group email and URL mapping

## Tabs in the Sheet

### Form Responses
Raw data, written by the web app. Columns:
- Timestamp
- Display name
- Street
- Unit / address (for moderation only, not published)
- Category
- Title
- Details
- Vendor name (optional)
- Contact OK (Yes/No)
- Publishable contact
- Email-to-street-group (Yes/No)
- **Approved** (blank / TRUE / FALSE) — **Dee edits this column to moderate**
- Hidden reason (optional moderator note)

### Config
Lookup table. Columns: `Street | Group email | Groups web URL`.

| Street | Group email | Groups web URL |
|---|---|---|
| Boulder Circle | bouldercircle@villasboulders.org | https://groups.google.com/a/villasboulders.org/g/bouldercircle |
| Boulder Point | boulderpoint@villasboulders.org | https://groups.google.com/a/villasboulders.org/g/boulderpoint |
| Broadlands Lane | broadlandslane@villasboulders.org | https://groups.google.com/a/villasboulders.org/g/broadlandslane |
| Plaster Point | plasterpoint@villasboulders.org | https://groups.google.com/a/villasboulders.org/g/plasterpoint |
| Rock Point | rockpoint@villasboulders.org | https://groups.google.com/a/villasboulders.org/g/rockpoint |
| Stone Circle | stonecircle@villasboulders.org | https://groups.google.com/a/villasboulders.org/g/stonecircle |

(These come from `keystone-scraper/labels_to_groups.py` SYNC_LIST.)

## Deployment

### Create the Sheet
1. Go to Google Drive → New → Google Sheet
2. Name it "Community Board Responses"
3. Place it in `My Drive → Villas at the Boulders Website Forms and Surveys → Community Board`
4. Create two tabs: `Form Responses` and `Config`
5. Set up headers and seed data (see tabs section above)
6. Note the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

### Create the Apps Script
```bash
cd /home/dee/hoa-code/CommunityBoard/
clasp login
clasp create --type webapp --title "Community Board"
# Copy the scriptId into .clasp.json
```

### Update Code.gs
Set `CONFIG.sheetId` to your new Sheet ID.

### Push and Deploy
```bash
clasp push
clasp deploy --deploymentId <ID> --description "Initial deployment"
```

Or use the Google Apps Script editor UI:
1. Open the Apps Script project
2. Click **Deploy** → **New deployment**
3. Type: **Web app**
4. Execute as: the user deploying
5. Who has access: **Anyone**
6. Deploy
7. Copy the deployment URL (the `.../exec` link)

## Website Integration

Add a new hidden page to the Google Sites:
1. Go to villasboulders.org in Sites editor
2. New page → name it `Community Board Preview` → path `/community-board-preview`
3. Hide from navigation (pages panel → ⋮ → **Hide from navigation**)
4. Add a **button** or **link** pointing to the deployment URL: `{DEPLOYMENT_URL}`
5. Add explanatory text (use the header policy text from the Browse page as a guide)
6. Publish the site

The deployment URL lands on the Browse page by default. Clicking "Post Something" takes users to the Post page.

## Moderation Workflow

1. User submits a post via the web app
2. Admin receives email notification
3. Dee opens the Google Sheet → `Form Responses` tab
4. Finds the pending post (Approved column is blank)
5. Sets `Approved` to `TRUE` to publish, or `FALSE` to hide
6. Post appears (or disappears) on the public Browse page on next refresh

No code changes needed — the web app reads the Sheet each time someone loads the Browse page.

## IDs and URLs

**To be filled in after deployment:**

- Sheet ID: `{SHEET_ID}`
- Sheet URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
- Apps Script Project ID: `{SCRIPT_ID}`
- Deployment ID: `{DEPLOYMENT_ID}`
- Deployment URL (Public): `{DEPLOYMENT_URL}`
- Sites page: `https://www.villasboulders.org/community-board-preview`

## Styling

Consistent with other HOA forms:
- Header: navy-to-green gradient (`#1a3a52` → `#2d5f3f`)
- Accent green: `#2d7d3a`
- Compact 13px form labels, 12-13px body text
- Professional card layout on Browse page

## Limitations (v1)

- No photo upload (can add later)
- No automated email to street Groups after approval (manual feature; can add via `onEdit` trigger if needed)
- Moderation is manual in the Sheet (no admin web UI)
- Posts can be deleted by the IT Officer by removing rows, or hidden by setting Approved = FALSE

## Testing

**Verification checklist:**

- [ ] Sheet created with both tabs
- [ ] Submit page form works, writes a row with `Approved` blank
- [ ] Browse page does NOT show rows with `Approved` blank or FALSE
- [ ] Set one test row to `Approved` = TRUE; it appears on Browse page newest-first
- [ ] Unit/address and collected email do NOT appear in the Browse page JSON (check browser DevTools → Network)
- [ ] Contact info only shows when `Contact OK` = Yes
- [ ] Street Group links point to the correct Groups
- [ ] "Post Something" button goes to `?page=post`
- [ ] "← Back to Community Board" link returns to Browse page
- [ ] Sample/test posts are clearly labeled "SAMPLE — delete before go-live"
- [ ] Site page exists, hidden from nav, linked from `/community-board-preview`

## Contact

Questions about the Community Board? Email admin@villasboulders.org or contact your IT Officer.
