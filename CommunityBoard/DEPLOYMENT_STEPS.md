# Community Board — Deployment Steps

This is a **multi-page Apps Script web app** (the first of its kind in this repo). It replaces the Google Form + Looker Studio approach from the spec with a hand-styled web app in the vab-hoa professional palette.

## What You Get

Two pages in one deployment:
- **Browse page** (default): public, read-only list of approved neighbor posts with filters
- **Post page** (`?page=post`): the submission form

Data lives in a Google Sheet (not a database). You moderate by opening the Sheet and toggling an `Approved` column on/off.

## Step 0: Pre-requisites

Make sure you have the clasp CLI tool:
```bash
npm list -g @google/clasp
```

If not installed:
```bash
npm install -g @google/clasp
```

## Step 1: Create the Apps Script Project

In the terminal:
```bash
cd /home/dee/hoa-code/CommunityBoard
clasp login  # First time only — grants permission to manage Apps Script projects
clasp create --type webapp --title "Community Board"
```

This will create a new Apps Script project and output something like:
```
Created new file: /home/dee/hoa-code/CommunityBoard/.clasp.json
WARNING: Did you remember to enable the Apps Script API? https://script.google.com/home/usersettings
Script created: 1234567890abcdefghijklmnopqrstuvwxyz
```

The `.clasp.json` file will be updated with the `scriptId` automatically.

## Step 2: Set Up the Google Sheet

1. Open the Apps Script editor in your browser:
   - Go to [script.google.com/home](https://script.google.com/home)
   - Click on **Community Board** (the project you just created)

2. In the Apps Script editor, click on **SETUP.gs** in the left sidebar

3. Click the **▶ play button** (next to "setupSheet()" in the toolbar)

4. When prompted, **authorize the app** (grant Drive and Sheets access)

5. Look at the **Execution log** at the bottom. You should see:
   ```
   ✓ Setup complete!
   
   Sheet ID: 1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9Y0
   Sheet URL: https://docs.google.com/spreadsheets/d/1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9Y0/edit
   
   NEXT STEPS:
   1. Copy the Sheet ID above
   2. Edit CommunityBoard/Code.gs
   3. Set CONFIG.sheetId = "1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9Y0"
   4. Run: clasp push
   5. Deploy: clasp deploy --deploymentId <deploymentId> --description "Initial deployment"
   6. Delete SETUP.gs from the project
   ```

6. **Copy the Sheet ID** (the long ID in the URL).

## Step 3: Update Code.gs with Sheet ID

In your terminal or editor:

```bash
cd /home/dee/hoa-code/CommunityBoard
# Edit Code.gs
```

Find the line:
```javascript
const CONFIG = {
  sheetId: '1VH1UQdEQYDY3cSXVEjIhWxq7r6x3wmvm', // Will be set once Sheet is created
  ...
}
```

Replace the placeholder with your actual Sheet ID from Step 2:
```javascript
const CONFIG = {
  sheetId: '1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9Y0', // From SETUP.gs output
  ...
}
```

Save the file.

## Step 4: Push and Deploy

In the terminal:

```bash
cd /home/dee/hoa-code/CommunityBoard
clasp push
```

This uploads your Code.gs changes to the Apps Script project.

Next, deploy:

```bash
clasp deploy --description "Initial deployment"
```

This will output something like:
```
Created version 1.
Deployment created: AKfycbzXxYxYxYxYxYxYxYxYxYxYxYxYxYxYxYxY
URL: https://script.google.com/macros/s/AKfycbzXxYxYxYxYxYxYxYxYxYxYxYxYxYxYxYxY/exec
```

**Copy the deployment URL** (the `.../exec` link). This is the public web app.

## Step 5: Update DEPLOYMENT_INFO.txt

Edit `CommunityBoard/DEPLOYMENT_INFO.txt` and fill in:

```
Deployment ID: AKfycbzXxYxYxYxYxYxYxYxYxYxYxYxYxYxYxYxY
Public URL (Browse page by default): https://script.google.com/macros/s/AKfycbzXxYxYxYxYxYxYxYxYxYxYxYxYxYxYxYxY/exec
Sheet ID: 1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9Y0
```

## Step 6: Add to Google Sites (Hidden Preview Page)

1. Go to [villasboulders.org](https://www.villasboulders.org) in Sites editor
2. Create a **new page**:
   - Name: `Community Board Preview`
   - Path: `community-board-preview`
3. In the **pages panel** (left sidebar), right-click the new page → **Hide from navigation**
4. Add content to the page:
   - **Title**: Community Board
   - **Link/Button**: "Browse the Community Board" → paste the deployment URL from Step 4
   - Add the policy text from the Browse page (about neighbor-to-neighbor, street groups, etc.)
5. Publish the site

The page will be at `https://www.villasboulders.org/community-board-preview` but won't appear in the menu.

## Step 7: Test

1. Open the deployment URL in your browser (Browse page loads by default)
2. You should see 2 sample posts (clearly labeled "SAMPLE — delete before go-live")
3. Try the filters (category, street, search)
4. Click **"Post Something"** to test the Post page
5. Fill out the form and submit
6. Check your email (admin@villasboulders.org) — you should get a notification
7. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9Y0/edit) and find your test post in the `Form Responses` tab
8. Set **Approved = TRUE** on your test post
9. Refresh the Browse page — your post should appear

## Step 8: Clean Up

1. Delete the sample posts from the Sheet (2 rows marked "SAMPLE")
2. In the Apps Script editor, delete the **SETUP.gs** file (you won't need it again)
3. Commit the changes:
   ```bash
   cd /home/dee/hoa-code
   git add -A
   git commit -m "chore: add Community Board deployment info and remove SETUP.gs"
   ```

## Verification Checklist

- [ ] Sheet created with `Form Responses` and `Config` tabs
- [ ] Submit page works, writes a row with `Approved` blank
- [ ] Browse page does NOT show rows with blank/FALSE `Approved`
- [ ] Set one test row to `Approved=TRUE`; it appears on Browse, newest-first
- [ ] Unit/address never appears in Browse page
- [ ] Contact info only shows when Contact OK = Yes
- [ ] Street Group links are correct (compare against `community-board/STREET_GROUPS.md`)
- [ ] "Post Something" button goes to `?page=post`
- [ ] "Back to Board" link returns to Browse page
- [ ] Sample posts are clearly labeled and deleted before going live
- [ ] Sites page `/community-board-preview` exists, hidden from nav, not linked elsewhere
- [ ] DEPLOYMENT_INFO.txt is filled in with all IDs and URLs

## Moderation Workflow

Going forward:

1. User submits a post via the Post page
2. You get an email notification to admin@villasboulders.org
3. Open the Google Sheet: [CommunityBoard → Form Responses tab]
4. Find the pending post (Approved = blank)
5. In the **Approved** column, enter `TRUE` to publish or `FALSE` to hide
6. Next time someone loads the Browse page, they'll see the approved post (or not see the hidden one)

No code changes needed — the web app reads the Sheet each time.

## Troubleshooting

**"Error: Failed to submit post: Form Responses tab not found"**
- Make sure SETUP.gs ran successfully and the Sheet has a tab named `Form Responses` (case-sensitive)

**Browse page is blank or shows an error**
- Check that CONFIG.sheetId in Code.gs is set correctly
- Make sure the Sheet has both tabs: `Form Responses` and `Config`

**Deployment URL gives a permission error**
- Make sure the webapp access is set to `ANYONE_ANONYMOUS` in appsscript.json
- After changing appsscript.json, run `clasp push` again and redeploy

**Street Group links are broken**
- Verify the group names and emails in the Sheet's `Config` tab match `community-board/STREET_GROUPS.md`
- Compare against `keystone-scraper/labels_to_groups.py` if updating

## Questions?

See README.md for more context.
