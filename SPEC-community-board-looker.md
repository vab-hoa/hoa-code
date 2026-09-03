# SPEC: HOA Community Board (preview page)

**Project:** Villas at the Boulders HOA  
**Website:** https://www.villasboulders.org (Google Sites, custom domain)  
**Repo:** `vab-hoa/hoa-code`  
**Requested by:** Dee (HOA President / site owner)  
**Audience for this spec:** Claude Code  
**Date:** 2026-09-02  
**Status:** Phase 0 — hidden preview page only. Do not add to site navigation. Do not announce to homeowners.

---

## 1. Goal

Build a neighbor-to-neighbor bulletin that homeowners will eventually use to post things like:

- vendor recommendations (“plumber we used and liked”)
- short-term neighbor help (“need a ride / temporary help”)
- general neighborhood info that is **not** official Association business

Display those posts on a Google Sites page using **Looker Studio** (not a raw Sheet embed).

This phase is for Dee to visit, debug, and refine. The page must be reachable only by a URL Dee knows. It must **not** appear in the site menu, footer, homepage quick links, or any other published link on the site.

Official HOA business stays off this board (work orders, ARC, LBC, covenants, assessments, meeting notices). Those already have their own forms and pages.

---

## 2. Out of scope for this phase

- Adding the page to navigation or linking it from Home / Community.
- A new all-community Google Group.
- Giving homeowners Editor access on the Site.
- Embedding a Google Group iframe on `villasboulders.org` (custom-domain embeds of Groups are unreliable / unsupported).
- Replacing or changing existing street Groups.
- Public announcement, newsletter blurb, or homeowner instructions beyond what appears on the preview page itself.
- Building this in Supabase / the issue tracker. Stay in Workspace.

---

## 3. Answered design decision: use existing street Groups for discussion

**Yes. Do not create a new community-wide Group in this phase.**

There are already six street Groups, synced from Contacts labels (LabelsToGroups / `keystone-scraper/labels_to_groups.py`):

| Street | Group (confirm exact email in Admin Console / labels_to_groups SYNC_LIST; do not invent) |
|---|---|
| Boulder Circle | existing street group |
| Boulder Point | existing street group |
| Broadlands Lane | existing street group |
| Plaster Point | existing street group |
| Rock Point | existing street group |
| Stone Circle | existing street group |

### How discussion works

- The **Site + Looker report is the lasting list** (searchable months later).
- The **street Group is the conversation** for that post (“I used them too”, “I can help Thursday”).
- The form collects **Street**.
- Each published card in Looker Studio shows a **Discuss on [Street] group** link (Groups web URL, not mailto-only).
- Optional form field: “Email this post to my street Group” (default **off**). If on, Apps Script or Form notification sends a short message to that street Group only. Do not email all six streets.

### Limitation to document on the page (one sentence)

Street Groups only reach that street. A plumber rec posted by someone on Boulder Circle will not be discussed by Stone Circle unless they also look at the website board. That is acceptable for v1. A community-wide Group can be considered later; it is not this task.

### Do not

- Change `whoCanPost` / membership of existing street Groups.
- Use ownership Groups (owner-occupant, non-occupant owner, non-owner occupant) or committee Groups (LBC, ARC, Snow Squad, volunteers) as the discussion venue.

---

## 4. Architecture

```
Homeowner (later) / Dee (now)
        │
        ▼
Google Form  "Community Board — Preview"
        │
        ▼
Form Responses Sheet  (admin@ My Drive, NOT Shared Drive)
        │
        ├─ raw tab: Form Responses 1
        └─ published tab: Published   ← formula/filter, Approved=TRUE only
                │
                ▼
Looker Studio report  (data source = Published tab)
                │
                ▼
Google Sites page  /community-board-preview
        hidden from navigation
        published
        no inbound links from other site pages
```

Forms **cannot** live on Shared Drives (existing HOA constraint). Follow the current pattern:

- Owner: `admin@villasboulders.org`
- Parent folder: `Villas at the Boulders Website Forms and Surveys`
- New subfolder: `Community Board`
- Contents: Form + Responses Sheet + a short README doc with URLs

---

## 5. Google Form

**Title:** Community Board (Preview)  
**Collect email addresses:** On (Workspace), but **do not display** submitter email on the public report unless they opt in.

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| Display name | Short text | Yes | First name + last initial is enough. Placeholder: “Jane S.” |
| Street | Dropdown | Yes | The six streets only. No free text. |
| Unit / address | Short text | Yes | Used for moderation, **not** shown on the public report. |
| Category | Dropdown | Yes | `Vendor recommendation` / `Help needed` / `For sale or giveaway` / `General` |
| Title | Short text | Yes | Max ~80 chars. Example: “Reliable plumber — leak under sink” |
| Details | Paragraph | Yes | No medical specifics. Prompt text must say so. |
| Vendor name | Short text | No | Shown only if category is Vendor recommendation (description text; Form cannot truly conditionally-require easily — keep optional). |
| Contact OK to publish | Multiple choice | Yes | `Yes — publish the contact I enter below` / `No — website only, contact me through the street group` |
| Publishable contact | Short text | No | Phone or email they are willing to show. Ignored if Contact OK = No. |
| Photo | File upload | No | If enabled, restrict to image types, 1 file, reasonable size. If file upload creates permission pain on the Site, skip photos in v1 and note it in the README. |
| Email this post to my street Group | Checkbox | No | Default unchecked. |
| Acknowledgement | Checkbox | Yes | Must check: neighbor-to-neighbor only; not official HOA notice; no medical detail; board may hide a post. |

### Confirmation message

Thank them. State this is a **preview**. Posts may not appear until approved. Point them at their street Group for discussion (generic wording; they already know their street).

### Form settings

- Limit to Association audience as much as Workspace allows. Prefer signed-in users with `@villasboulders.org` **or** anyone-with-link if many homeowners do not have Workspace accounts (most will not). **Default for preview:** anyone with the link can respond, so Dee can test with personal Gmail. Document the choice in the README.
- Notify `admin@villasboulders.org` on new responses.
- Destination: new Sheet in the Community Board folder.

---

## 6. Responses Sheet

### Tab `Form Responses 1`

Leave as Form-owned raw data. Do not rename columns Form depends on.

### Add columns on the raw tab (to the right of Form columns)

| Column | Purpose |
|---|---|
| Approved | `TRUE` / `FALSE` / blank. Blank = not yet reviewed. |
| Hidden reason | Optional moderator note, not published. |
| Published contact | Formula: contact value only if “Contact OK” = Yes, else blank. |
| Street group URL | Formula or Apps Script lookup from Street. |
| Street group email | Same lookup. |

### Tab `Published`

This is what Looker Studio reads. Newest first.

Include only rows where `Approved = TRUE`.

Published columns (exact names for Looker):

- Timestamp
- Display name
- Street
- Category
- Title
- Details
- Vendor name
- Published contact
- Street group URL
- Street group email

**Never publish:** unit/address, submitter email from “Collect email”, Hidden reason, raw contact when they said No.

Seed **2–3 fake approved rows** so Looker has something to show while Dee tests (clearly marked “SAMPLE — delete before go-live”).

### Street → Group lookup

Confirm addresses from the live Groups / `labels_to_groups.py` SYNC_LIST. Put the canonical map in the README and in a `Config` tab on the Sheet:

```
Street | Group email | Groups web URL
```

Do not hard-code guessed slugs.

---

## 7. Looker Studio report

**Name:** VaB Community Board (Preview)

### Data source

- Google Sheets → Community Board responses → tab `Published`
- Refresh: default (owner can set to more frequent if available)

### Sharing (preview)

- Owner: `admin@villasboulders.org`
- Dee’s accounts can edit (`dee@wmbuck.net` and/or `mcdonaldbuckhoa@gmail.com` as already used for HOA work).
- Published report link: **anyone with the link can view** so the Sites embed works for Dee without extra login friction during preview. Tighten later if the board should be members-only.

### Layout

One page, clean, readable on phone (most homeowners).

Top:

- Report title: “Community Board”
- Short subtitle: “Neighbor-to-neighbor. Not official HOA business.”
- Controls:
  - Category (dropdown / filter chip)
  - Street (dropdown)
  - Date range (default last 12 months)
  - Search box on Title + Details if available

Body:

- Scorecard or small count: number of visible posts
- Table or card-like table, **Timestamp descending**
  - Category
  - Title
  - Display name
  - Street
  - Details (wrap text)
  - Vendor name
  - Published contact
  - Street group URL as a hyperlink labeled “Discuss on [Street] group”

No pie charts, no maps, no “insights” panels. This is a bulletin, not a dashboard.

### Style

Stay close to the live site: dark sidebar + strong green is the public site palette; the report itself should be simple light background, dark text, one accent green. Do not reproduce the neon green full-bleed homepage.

### Embed

Looker Studio → File / Share → embed URL (or “embed report”).  
Sites → Insert → Embed → that URL.  
Size the embed tall enough that several posts show without feeling like a postage stamp. Full-width.

If embed is blank on the custom domain, document the fallback: open the Looker URL in a new tab from a button on the page, and also test the `sites.google.com/...` URL of the same page.

---

## 8. Google Sites page (hidden preview)

### Create

- New page on the existing VaB Google Site (do not create a second Site).
- Page name: `Community Board Preview`
- Custom path: `community-board-preview`  
  Published URL should be: `https://www.villasboulders.org/community-board-preview`
- Pages panel → ⋮ → **Hide from navigation**
- Publish the site after adding the page (Sites publishes the whole site; hiding from nav is what keeps it off the menu).

### Must not

- Add it under Community in the sidebar.
- Add it to Home quick links, footer, announcement banner, or “Help with our website”.
- Link to it from any other page.
- Put the URL in a newsletter or group email.

### Known limits (tell Dee in the README)

Hide from navigation is **not access control**. Anyone with the URL can open it. Site search and Google Search may still find it. For preview that is acceptable. Do not treat the path as a secret.

### Page content (top to bottom)

1. **Preview banner** (remove at go-live): “Preview — not linked from the site. Posts are moderated.”
2. H1: Community Board
3. 4–6 line policy:
   - Neighbor-to-neighbor only
   - Not an official Association notice
   - No medical detail
   - Use your **street Google Group** to discuss a post
   - Board may hide posts
4. Button/link: **Post to the board** → Form URL
5. Looker Studio embed
6. “Discussion” note: click the street Group link on a post, or open your street Group directly. Do not embed Groups on this page.
7. Footer line: questions about this preview → `admin@villasboulders.org` or Dee’s HOA board mail, matching existing site contact practice.

### How Dee opens it for debug

1. Sites editor → Pages → Community Board Preview
2. Publish ▼ → View published site  
   or visit `https://www.villasboulders.org/community-board-preview`

Record both the custom-domain URL and the `sites.google.com/.../community-board-preview` URL in the README.

---

## 9. Moderation (v1)

- Default: new rows are **not** visible until `Approved = TRUE`.
- Dee (or later a volunteer) sets Approved in the Sheet.
- No public “delete my post” UI in v1. Dee can set Approved back to FALSE.
- SAMPLE rows must be un-approved or deleted before go-live.

Keep this manual. Do not build an approval web app.

---

## 10. Implementation notes for Claude Code

### What you can automate

- Folder + Form + Sheet structure under `admin@` My Drive (Apps Script or Drive API, same style as other website forms).
- `Published` tab formulas / QUERY.
- `Config` tab for street → group map after you **read the live map** from `labels_to_groups.py` or Admin Directory.
- Optional Apps Script bound to the Sheet:
  - onFormSubmit: fill Street group URL/email
  - if “Email this post to my street Group” is checked **and** Approved is TRUE (or a second notify-after-approve path — prefer notify only after approve so SAMPLE/spam never hits a street)
  - do **not** email the street on raw unapproved submit
- Looker Studio: create if API/access allows; otherwise produce an exact click-path for Dee and stop. Looker creation is often UI-only. Do not fake a report ID.
- Sites page: New Sites has no good “create hidden page and embed X” automation in this repo today. Produce an exact click-path. Do not claim the page exists until Dee (or you in a browser Dee is logged into) has created it.

### What you must not do

- Commit secrets.
- Change LabelsToGroups membership or group settings.
- Touch ARC / LBC / Work Order forms.
- Add navigation links.
- Deploy anything to Vercel / Supabase for this feature.
- Email homeowners or street Groups during development except a single test message to a Group Dee designates, and only after asking.

### Repo / docs

Add a folder such as:

```
community-board/
  README.md          # URLs, folder IDs, Form ID, Sheet ID, Looker URL, Sites URLs
  SPEC.md            # this spec or a copy
  STREET_GROUPS.md   # confirmed email + web URL per street
```

Follow existing `CLAUDE.md` conventions. Tag memory writes `source=claude-code-session` if you write to memory.wmbuck.net.

### Verification checklist (do these, then stop)

- [ ] Folder exists under `Villas at the Boulders Website Forms and Surveys` / `Community Board`
- [ ] Form submits to the Sheet
- [ ] Unapproved row does **not** appear in `Published`
- [ ] Approved row does appear, newest first
- [ ] Unit/address and collected email are absent from `Published`
- [ ] Contact column empty when they said No
- [ ] Street group URL correct for each of the six streets
- [ ] Looker report reads `Published` and filters work
- [ ] Sites page exists at `/community-board-preview`
- [ ] Page is hidden from navigation
- [ ] No other published page links to it (spot-check Home, Community, Help)
- [ ] Custom-domain URL loads for Dee
- [ ] Embed visible on custom domain **or** fallback documented
- [ ] README lists every ID and URL
- [ ] SAMPLE posts labeled as sample

---

## 11. Later phases (do not implement now)

- Show in Community nav.
- Tighten Form to members-only if Workspace identity is good enough.
- Looker share = logged-in residents only (may break anonymous viewing).
- Photo display.
- Poster can request removal.
- Optional community-wide Group if street-only discussion is too narrow for vendor recs.
- Volunteer co-moderator.

---

## 12. Copy Dee can paste to Claude Code

> Implement SPEC-community-board-looker.md in vab-hoa/hoa-code.
> Phase 0 only: Form + Sheet (Approved / Published tab) + Looker Studio report + hidden Google Sites page at /community-board-preview (hide from navigation, no links from other pages).
> Use existing six street Google Groups for discussion links. Do not create a new Group. Do not email street Groups on unapproved submissions.
> Confirm street group emails/URLs from labels_to_groups.py or Admin Directory; do not guess.
> Forms live in admin@ My Drive under “Villas at the Boulders Website Forms and Surveys / Community Board” — not Shared Drive.
> Stop after the verification checklist and write community-board/README.md with all URLs and IDs.
> Do not add the page to the site menu.
