# HOA Dashboard — Remaining Steps Checklist

*Everything that needs to happen after Claude Code finishes building the dashboard.*

---

## Can Be Done NOW (in parallel with Claude Code building)

These tasks don't depend on the dashboard code being complete. Start them immediately.

### 1. Vercel Account Setup
- [ ] Go to [vercel.com](https://vercel.com) and sign up / log in with GitHub
  - Use your GitHub account that has access to the `vab-hoa` org
  - Vercel will ask for repo permissions — grant access to the `vab-hoa` organization
- [ ] No need to create a project yet — just get the account set up and authenticated

### 2. DNS: Add CNAME Record for tracker.villasboulders.org
- [ ] Log into Namecheap (account: `deebuck`)
- [ ] Domain List → villasboulders.org → Manage → Advanced DNS
- [ ] Add new record:
  - **Type:** CNAME Record
  - **Host:** `tracker`
  - **Value:** `cname.vercel-dns.com`
  - **TTL:** Automatic (or 300 seconds)
- [ ] Save
- [ ] Verify propagation: `dig tracker.villasboulders.org` should show the CNAME pointing to `cname.vercel-dns.com`
- [ ] **Note:** DNS propagation usually takes minutes but can take up to 48 hours. Doing this early means it's ready when you deploy.

### 3. Confirm villasboulders.org DNS Is on Namecheap
- [ ] Verify the domain's nameservers are pointing to Namecheap's default NS
- [ ] If DNS is actually managed elsewhere (Google Domains, Cloudflare, etc.), add the CNAME there instead
- [ ] **Check:** `dig NS villasboulders.org` to see which nameservers are authoritative

### 4. GitHub Repo: Verify Access and Structure
- [ ] Confirm `github.com/vab-hoa/hoa-code` repo exists and you have write access
- [ ] Confirm the repo is an organization repo under `vab-hoa` (not a personal repo)
- [ ] Verify the dashboard will be a subdirectory: `hoa-code/hoa-tracker-dashboard/`
- [ ] Make sure there's a `.gitignore` in the dashboard subdirectory that excludes `.env.local`, `node_modules/`, `.next/`
- [ ] If Claude Code is building directly in the repo, confirm the directory structure matches what Vercel will expect

---

## Must Wait Until Claude Code Is Done Building

These tasks require the dashboard code to be committed and pushed to GitHub.

### 5. Import to Vercel and Deploy
- [ ] Go to Vercel dashboard → "New Project" → Import from GitHub
- [ ] Select `vab-hoa/hoa-code` (the monorepo)
- [ ] **Set Root Directory:** Project Settings → General → Root Directory → `hoa-tracker-dashboard`
  - This tells Vercel to look for `package.json` in `hoa-tracker-dashboard/`, not the repo root
- [ ] **Set Ignored Build Step:** Project Settings → Git → Ignored Build Step → enable
  - Command: `git diff --quiet HEAD^ HEAD -- hoa-tracker-dashboard/`
  - This prevents rebuilds when you push changes to non-dashboard files (email processor, schemas, etc.)
- [ ] **Add Environment Variables:** Project Settings → Environment Variables
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://obveytoovkzjrpzrhrim.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_VOkLzqlScMa7yTxZij1xXA_zATBJuyU`
  - Set for both "Production" and "Preview" environments
- [ ] Click "Deploy"
- [ ] Wait for the build to complete (1-3 minutes)
- [ ] Verify the deployment URL works: `hoa-tracker-dashboard.vercel.app` (or whatever Vercel assigns)

### 6. Add Custom Domain in Vercel
- [ ] Vercel dashboard → Project → Settings → Domains
- [ ] Add domain: `tracker.villasboulders.org`
- [ ] Vercel will verify the CNAME record (you already added it in step 2)
- [ ] Once verified, Vercel provisions SSL automatically (Let's Encrypt)
- [ ] Wait for SSL to be ready (usually a few minutes after DNS resolves)
- [ ] Verify: `https://tracker.villasboulders.org` loads the dashboard

### 7. Verify the Deployment Works
- [ ] Open `https://tracker.villasboulders.org` in a browser
- [ ] Check the dashboard home page loads — summary cards should show real numbers
- [ ] Click into a work item — detail page should load with correspondence timeline
- [ ] Check Properties page — should show 124 properties
- [ ] Check Emails page — should show recent emails
- [ ] Check Snapshots page — should show WO status snapshots
- [ ] Test on mobile (phone browser) — layout should be responsive
- [ ] Open browser dev tools → Console — check for any JavaScript errors
- [ ] Open browser dev tools → Network — check that Supabase API calls are succeeding (200s, not 4xx/5xx)

### 8. Supabase: Verify RLS Status
- [ ] **Phase 1: RLS is NOT needed.** The dashboard uses the publishable/anon key for read-only access.
- [ ] Confirm RLS is currently disabled on the tables the dashboard reads (or that policies allow anon SELECT)
- [ ] If RLS is enabled and blocking reads, either:
  - Disable RLS for Phase 1 (acceptable for a board-only tool with an unlisted URL), OR
  - Add a simple policy: `CREATE POLICY "anon_read" ON work_items FOR SELECT TO anon USING (true);` for each table
- [ ] **Phase 2 (later):** When authentication is added, enable RLS with authenticated-user-only policies. Not now.

---

## Post-Deployment: Email Processor Cron

### 9. Set Up Daily Email Processing on Oregano

The dashboard reads from Supabase. Supabase gets its data from the email processor. The email processor needs to run regularly to process new incoming HOA emails.

- [ ] **Review the processor:** `/home/dee/.openclaw/workspace/hoa-tracker/email_processor.py`
- [ ] **Test it works:** Run manually first:
  ```bash
  ssh dee@oregano.local 'cd /home/dee/.openclaw/workspace/hoa-tracker && python3 email_processor.py --days 1'
  ```
- [ ] **Set up a cron job on oregano** to run it daily (or hourly, depending on how fresh the data needs to be):
  ```bash
  # On oregano, as dee:
  crontab -e
  
  # Daily at 6 AM MT (processes overnight emails)
  0 6 * * * cd /home/dee/hoa-tracker && /usr/bin/python3 email_processor.py --days 1 >> /home/dee/hoa-tracker/processor.log 2>&1
  ```
  (Adjust the path to wherever the processor lives on oregano. Adjust frequency as needed — hourly if you want fresher data.)
- [ ] **Verify the cron runs:** Check the log file the next day to confirm it ran successfully
- [ ] **Verify new emails appear in Supabase:** After the cron runs, check the dashboard's Emails page for new entries

**Note:** The email processor needs its own credentials for Gmail/IMAP access. Verify:
- The Google service account credentials are accessible on oregano
- The IMAP password for jane@wmbuck.net is accessible if needed
- The Supabase connection (URL + service role key for writes) is configured in the processor's environment

---

## Testing Checklist (After Deploy)

### 10. Functional Testing
- [ ] **Dashboard Home:** Summary cards show correct counts (match Supabase data)
- [ ] **Aging Alerts:** Items past their threshold appear with red/orange/yellow highlighting
- [ ] **Recent Activity:** Latest correspondence entries appear, clickable to work items
- [ ] **Open Work Items:** Grouped by status, collapsible, clickable
- [ ] **Work Item Detail:** All fields display, correspondence timeline works, email modal opens
- [ ] **Properties List:** Search works, sortable, click through to property detail
- [ ] **Property Detail:** Work items listed, source documents shown
- [ ] **Email Inbox:** Filters work, noise hidden by default, email body modal works
- [ ] **Snapshots:** Latest snapshot displays, diff between two dates works
- [ ] **Navigation:** All nav links work, active state shows correctly
- [ ] **Mobile:** Test all pages on phone — responsive layout, no horizontal scroll except tables

### 11. Performance Testing
- [ ] Page load time under 3 seconds on first load (Supabase queries aren't slow)
- [ ] Subsequent navigation is fast (client-side routing)
- [ ] No console errors or warnings
- [ ] No failed network requests (all Supabase calls return 200)

### 12. Security Check (Basic)
- [ ] The dashboard URL is not indexed by search engines (add `noindex` meta tag or robots.txt)
- [ ] No sensitive data exposed in the page source (only the anon key, which is fine — it's read-only)
- [ ] Environment variables are not leaked in client-side code (verify in browser dev tools)

---

## Summary: What's Parallel vs. Sequential

```
NOW (parallel with Claude Code):
  ├── Vercel account signup
  ├── DNS: Add CNAME for tracker.villasboulders.org
  └── Verify GitHub repo access

WAIT FOR CLAUDE CODE:
  └── Dashboard code committed and pushed

AFTER CODE IS READY:
  ├── Import repo to Vercel
  ├── Set root directory → hoa-tracker-dashboard
  ├── Set ignored build step
  ├── Add env vars (Supabase URL + anon key)
  ├── Deploy
  ├── Verify custom domain works
  ├── Verify SSL
  ├── Test all pages
  └── Set up email processor cron on oregano
```

---

## Notes

- **villasboulders.org DNS:** Likely managed on Namecheap (account `deebuck`). Verify with `dig NS villasboulders.org` before adding the CNAME.
- **Supabase RLS:** Not needed for Phase 1. The publishable/anon key allows read access. RLS becomes important when you add authentication in Phase 2.
- **The dashboard is read-only.** No write operations in Phase 1. The anon key cannot write data — only the service role key can, and that key is NOT exposed in the dashboard.
- **Vercel free tier** is sufficient for this project. 100 GB bandwidth, unlimited deployments, custom domains. A board dashboard for a 124-unit HOA will never approach those limits.
- **The email processor on oregano is the pipeline.** The dashboard just displays what the processor has already structured. If data looks stale, check the cron, not the dashboard.
