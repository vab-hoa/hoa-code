# Website & Drive Organization Review — Three Dimensions

**Date:** 2026-03-23
**Status:** Research and recommendations — no execution until Dee reviews

## Context

The March 23 cleanup is complete: 1,183 duplicates/artifacts trashed, Current/ folders
created for Bylaws, Covenants, ARC Guidelines, and Policy Directory. Dee has manually
fixed ~45 broken links on Google Sites using the cheat sheet. Nightly link monitoring is
deployed (cron at 3:30 AM, first report tonight).

**Data sources:**
- `drive-tools/site_structure.txt` — full crawl of 69 pages with all links
- `drive-tools/drive_listing_current.txt` — 3,881 files in 718 folders (post-cleanup)
- `drive-tools/broken_cheatsheet.txt` — broken links found today

---

## Dimension 1: Website User Experience

### Site Structure Overview

69 pages, 8 main sections: budgets-costs-and-dues (5 sub), committees (6 sub),
community (11 sub), description-of-services (12 sub), forms (7 sub), home (2 sub),
rules (2 sub), volunteering (2 sub), plus standalone pages.

### Issues Found

**A. Duplicate/Redundant Pages**

1. `/` and `/home` — identical content (2,309 chars, same links). Pick one as canonical.
2. `/description-of-services/snow-removal` and `/snow-removal_1` — two Snow Removal
   pages with slightly different content (2,416 vs 2,158 chars). Consolidate.
3. Board info split across `/committees/the-board-of-directors` AND
   `/community/board-and-committees` — confusing which is the "real" board page.

**B. Hard-to-Find Information**

- Board meetings/calendar: `/board-calendar` is a standalone page, not linked from
  Committees or Community. No indication of meeting frequency, minutes availability,
  or remote access.
- Repair requests: Unclear whether to use the embedded form or Keystone portal.
  No decision tree.
- ARC request submission: ARC committee pages don't link to
  `/forms/architectural-review-request`.

**C. Thin/Stub Pages** (under 1,400 chars — may need expansion)

- Volunteer Expense Reimbursement (1,140 chars)
- Community Features (1,198 chars)
- Contacts (1,207 chars)
- Local Contractors (1,298 chars)
- Forms hub (1,307 chars)
- Community Cleanup Day (1,356 chars)

**D. Content Gaps** (common HOA website features that are missing)

1. **New resident onboarding** — no move-in guide, key contacts, "what you need to know"
2. **Meeting minutes/agendas** — not accessible from the site
3. **Enforcement process** — no "what happens if I violate a covenant" explanation
4. **Maintenance responsibility** — no "HOA vs homeowner responsibility" guide
5. **Visual budget breakdown** — no chart showing "where your dues go"
6. **Emergency procedures** — not documented

**E. FAQ Page**

At 10,093 chars, the FAQ page is by far the largest. Consider splitting into
topic-based sub-FAQs or using an accordion/expandable format.

### Recommendations (Priority Order)

1. **Merge duplicate pages** — snow-removal, home/root, board pages
2. **Add cross-links** — ARC pages → request form, volunteer pages → forms,
   repair requests → Keystone guidance
3. **Create a "New Resident" page** — covenants summary, dues info, key contacts,
   how to submit requests
4. **Add Board Calendar link** to committees and community sections
5. **Expand stub pages** or merge them into parent pages if too thin to stand alone
6. **Consider splitting FAQ** into topic-based pages

---

## Dimension 2: Link Architecture & Maintenance Burden

### Current Link Inventory

- **48 Google Drive file links** (highest maintenance burden)
- **4 Google Drive folder links** (low maintenance — already working well for
  Budgets, Financials, Newsletters)
- **9 Google Forms** (zero maintenance — Forms URLs are permanent)
- **~10 other external links** (Keystone, schools, Zillow, etc.)

### The Core Problem

Google Sites (new) has **no API**. Every link edit is manual. The 32-link incident
took a full day. We need to minimize the number of individually-linked files and
maximize the use of approaches that don't break when files move.

### Link Fragility by Category

| Category | Links | Risk | Strategy |
|----------|-------|------|----------|
| 14 Policies | 14 | HIGH | Switch to folder link |
| Governing Docs | 5 | MODERATE | Stable; use /view not /preview |
| Reserve Studies | 4 | LOW | Archive docs, rarely move |
| ARC Guidelines | 1 file, 4 pages | MODERATE | Single canonical ID |
| Board/Officers | 1 file, 3 pages | MODERATE | Single canonical ID |
| Budgets | 3 folder links | LOW | Already optimal |
| Roofing docs | 3 | LOW | Archive, won't change |
| Plat/Map | 2 | LOW | Consider embedding images directly |
| Forms | 9 | NONE | Permanent URLs |

### Key Recommendations

**A. Switch from individual file links to folder links where possible.**

This is the single highest-impact change. Folder links survive file renames,
replacements, and additions. Already working for Budgets/Financials/Newsletters.

Candidates for folder links:
- **Policies page**: Instead of 14 individual links, link to the Policies/ folder
  (or a curated "Current Policies" folder). Homeowners see all policies in one click.
- **Reserve Studies**: Link to the Reserve Studies/ folder instead of 3 individual files.
- **Board docs**: Create a "Board" folder with directors list and related docs;
  link to folder.

Trade-off: Folder links show Drive's folder UI, not a nice page. But they're
dramatically more maintainable.

**B. Use /view?usp=drive_link format for remaining individual links.**

Preview links (used for embeds) broke in the recent incident. View links are
more resilient. Only use /preview where you specifically need an inline embed.

**C. Create a Link Registry.**

A structured file listing every website-linked Drive file with its canonical ID,
the pages it appears on, and the link text. When a file moves, check the registry.
This is what `link_fix_report.py` already does — formalize it.

**Script:** `drive-tools/link_registry.py` — generates the registry from site crawl data.

**D. Embed map/plat images directly on the page.**

The villas map (JPG) and plat (PDF) could be uploaded directly to Google Sites
rather than linked from Drive. Eliminates 2 fragile links.

**E. Consider the Policies page redesign.**

The Policies page has 14 individual links — by far the highest-maintenance page.
Options:
1. **Folder link** to a "Current Policies" folder (1 link instead of 14)
2. **Google Sites file embed** of the Policies folder (shows files inline)
3. **Keep individual links** but document all IDs in the registry

Option 1 is the lowest-maintenance. Downside: homeowner sees a Drive folder,
not a curated page. But the policies already have descriptive names.

---

## Dimension 3: Google Drive Organization

### Current State (Post-Cleanup)

3,881 files in 718 folders. 27 top-level folders. Current/ pattern implemented
in 4 locations (Bylaws, Covenants, ARC Guidelines, Policy Directory).

### Where the Current/ Pattern Is Still Needed

1. **Budget/** — Year folders 2019-2026, no current pointer.
   Create `Budget/Current/` → move latest budget files there.

2. **Rules and Regulations Document/** — Versions from 2019-2026.
   Create `Rules and Regulations Document/Current/`.

3. **Policies and Procedures/Final/[each policy]/[date]/** — Each policy has
   dated subfolders. The signed policies in `Policies/` folder are already canonical.
   Lower priority since the website links to those copies.

4. **Communications/Monthly Updates/** — Could benefit from a Current/ or
   Latest/ pointer for quick access.

5. **Meetings/** — Year folders with individual meeting subfolders. No
   "Latest Meeting" or "Next Meeting" pointer. Inconsistent date formats
   (2023 uses "DD Mon" instead of YYYY.MM.DD).

### Structural Issues

**A. The "Final/" folder is confusing.**

`Policies and Procedures/Final/` contains per-policy folders with dated subfolders,
"Working Documents/" and "Older Version/" mixed in. It parallels but doesn't replace
the canonical signed copies. This dual structure is confusing.

**Recommendation:** Rename `Final/` → `Policy Source Documents/` to clarify its role.
Keep the canonical signed copies where they are (linked from website).

**B. Projects/ is a catch-all (142+ subfolders).**

Mixes completed projects (2020) with current (2025-2026). No separation.

**Recommendation:** Create `Projects/Active/` and `Projects/Archive/`. Move
completed years (2020-2022) to Archive. Keep 2025-2026 in Active.

**C. Contracts/ has inconsistent naming.**

Date ranges like "2020-2021", "2019-20", "2014-2021", "2024-2026". Many
single-file folders.

**Recommendation:** Standardize to "YYYY-YYYY" format.

**D. Homeowner Documents shared drive.**

Contains 3 files in Governing Documents/ (Articles, ByLaws.Current,
Covenants.Current — all PROTECTED). Also has newsletters, maps, and meeting notes.
This is a second shared drive with partial overlap.

**Question for Dee:** What's the intended role of Homeowner Documents vs Board
Documents? Should we maintain both, or consolidate with folder-level sharing?

**E. Z_Archive/ contains stale content.**

`Z_Archive/Z_Downloaded Stuff to Remove/` was flagged for deletion years ago but
never removed. Contains 2013-2019 files (audits, budgets, contracts, insurance).

**Recommendation:** Review contents, then either permanently delete or rename to
indicate it's been reviewed.

### Current/ Pattern Alternatives

**Option A: Current/ folders (what we have)**
- Pros: Explicit, clear, folder link works for website
- Cons: Requires moving files when versions change

**Option B: Naming convention** — `(current)` or `★` prefix
- Pros: No folder moves needed, visible at a glance
- Cons: Requires renaming on update, no folder link support

**Option C: Google Drive shortcuts**
- Pros: Files stay in place, shortcuts can be updated
- Cons: Shortcuts have own IDs (can't use for website links)

**Option D: Hybrid — Current/ for website-linked docs only** (RECOMMENDED)
- Only create Current/ for categories the website links to
- Everything else uses dated folders with newest-first naming
- Pros: Minimal overhead, focused on the actual maintenance problem

---

## Implementation Stages

### Stage 1: Verify Tonight's Fixes (Tomorrow Morning)
- Check email from tonight's link monitor run
- Verify remaining broken links (if any) after Dee's manual fixes
- Add any unfixable links to `known_broken.json`

### Stage 2: Drive Quick Wins (30 min)
**Script:** `drive-tools/drive_quick_wins.py` (dry-run by default)
- Create `Budget/Current/` — move 2026 budget files
- Create `Policies and Procedures/Rules and Regulations Document/Current/`
  — move 2026 Rules and Regulations files
- Rename `Policies and Procedures/Final/` → `Policy Source Documents/`
- Rename `Z_Archive/Z_Downloaded Stuff to Remove/` → `Z_Archive/Reviewed - Legacy Downloads (2013-2019)/`

### Stage 3: Website Link Architecture (1-2 hours, requires Dee in Sites)
**Checklist:** `drive-tools/website_changes_checklist.md`
- Replace 14 individual policy links with 1 folder link (if Dee agrees)
- Replace 3 individual reserve study links with 1 folder link
- Embed map/plat images directly on the geography page
- Add cross-links: ARC → form, Board → calendar, etc.
- Merge duplicate pages (snow-removal, home/root)

### Stage 4: Drive Structural Cleanup (1 hour)
**Script:** `drive-tools/drive_cleanup.py` (dry-run by default)
- Create `Projects/Active/` and `Projects/Archive/`
- Move Projects/2020, 2021, 2022 to Archive
- Move Projects/2025, 2026 to Active
- Standardize Contracts/ naming to YYYY-YYYY format

### Stage 5: Content Improvements (Ongoing, as energy permits)
- New resident onboarding page
- Board meeting minutes/agenda accessibility
- Expand thin pages or merge into parents
- Add visual budget breakdown

---

## Key Files

- `drive-tools/site_structure.txt` — full website crawl data
- `drive-tools/drive_listing_current.txt` — current drive inventory
- `drive-tools/link_fix_report.py` — canonical file ID mappings
- `drive-tools/link_registry.py` — website link registry generator
- `drive-tools/monitor_links.py` — nightly link checker (cron deployed)
- `drive-tools/drive_quick_wins.py` — Stage 2 automation
- `drive-tools/drive_cleanup.py` — Stage 4 automation
- `drive-tools/website_changes_checklist.md` — Stage 3 manual steps

## Verification

- After Stage 1: nightly monitor email shows 0 new broken links
- After Stage 3: re-run `crawl_broken_cheatsheet.py` to confirm 0 broken links
- After Stage 4: re-run drive listing to confirm clean structure
