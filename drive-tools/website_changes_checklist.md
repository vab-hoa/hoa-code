# Stage 3: Website Changes Checklist

**These changes require manual editing in Google Sites.**
Open Sites editor: https://sites.google.com/villasboulders.org

---

## URGENT: 2 Still-Broken Links Found by Registry

The link registry comparison found 2 links still using old/broken file IDs:

### Fix 1: Snow Removal Policy on /snow-removal_1
- [ ] Open /description-of-services/snow-removal_1 in Sites editor
- [ ] Find the "Snow Removal Policy" link pointing to:
  `https://drive.google.com/file/d/1TdeqabI_X6DYlrSi-Hitug9N2PCtQdqh/view`
- [ ] Replace with:
  `https://drive.google.com/file/d/10y4X34OyiWWRIIHkbW-OACCPEZECyHKR/view?usp=drive_link`

### Fix 2: Villas Map on /villas-geography
- [ ] Open /community/villas-geography in Sites editor
- [ ] Find the "Map of the Villas at the Boulders" link pointing to:
  `https://drive.google.com/file/d/1zVfswsEQHqcCcgtNUAE902qTXZTwtCIm/view`
- [ ] Replace with:
  `https://drive.google.com/file/d/12R_K-MBX11dtOAoRhCvT9jhiGv9bVyUd/view?usp=drive_link`

---

## Note: Policy Links Use Different IDs Than Expected

When Dee manually fixed the 45 broken links, the 14 policy links were pointed to
*different* file IDs than what `link_fix_report.py` suggested. The suggested IDs
were from the `Policies/` folder (signed copies), but the live site uses IDs from
`Policies and Procedures/Final/` (source documents). Both sets appear to be valid
— the key thing is that the current IDs work. The link registry now tracks what's
actually live.

---

## High Priority: Reduce Link Maintenance Burden

### 1. Policies Page — Replace 14 individual links with 1 folder link
- [ ] Open the Policies page in Sites editor
- [ ] Remove all 14 individual policy embed/links
- [ ] Add a single link to the Policies folder (or embed the folder)
- [ ] Add descriptive text: "Click to view all current signed policies"
- [ ] Test: click the link, verify all 14 policies are visible in the folder

### 2. Reserve Studies Page — Replace 3 file links with 1 folder link
- [ ] Open /budgets-costs-and-dues/reserve-studies
- [ ] Replace 3 individual reserve study links with a link to the Reserve Studies/ folder
- [ ] Keep the Reserve Requirements policy as a separate link (it's a policy, not a study)
- [ ] Test: verify folder shows 2006, 2015, and 2022 studies

### 3. Geography Page — Embed images directly
- [ ] Download the Villas map (JPG) from Drive
- [ ] Download the plat (PDF) from Drive
- [ ] Upload directly to the geography page as embedded images
- [ ] Remove the Drive file links (eliminates 2 fragile links)

---

## Medium Priority: Improve Navigation

### 4. Add cross-links
- [ ] ARC committee page → link to /forms/architectural-review-request
- [ ] /committees/the-board-of-directors → link to /board-calendar
- [ ] /community/board-and-committees → link to /board-calendar
- [ ] Repair request pages → clarify: use embedded form OR Keystone portal?

### 5. Merge duplicate pages
- [ ] Snow Removal: consolidate /description-of-services/snow-removal and /snow-removal_1
  - Keep the one with more content (2,416 chars version)
  - Redirect or delete the other
- [ ] Board pages: decide canonical page between /committees/the-board-of-directors
  and /community/board-and-committees
  - One should be the "real" page, the other should link to it

### 6. Home/root page
- [ ] `/` and `/home` are identical — this is likely automatic behavior
  - No action needed unless `/home` is a separate page in the editor

---

## Low Priority: Content Improvements

### 7. Expand thin pages (or merge into parents)
- [ ] Volunteer Expense Reimbursement (1,140 chars)
- [ ] Community Features (1,198 chars)
- [ ] Contacts (1,207 chars)
- [ ] Local Contractors (1,298 chars)
- [ ] Forms hub (1,307 chars)
- [ ] Community Cleanup Day (1,356 chars)

### 8. New content pages (when energy permits)
- [ ] "New Resident" onboarding page
- [ ] Meeting minutes/agendas access
- [ ] Enforcement process explanation
- [ ] HOA vs homeowner maintenance responsibility guide

---

## After Changes: Verify

1. Run `python drive-tools/crawl_broken_cheatsheet.py` to check for broken links
2. Check `drive-tools/link_registry.py --verify` to confirm all IDs are accessible
3. Wait for nightly monitor email to confirm 0 broken links
