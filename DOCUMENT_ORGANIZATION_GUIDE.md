# Villas at the Boulders — Document Organization Guide

*For current and future board members*

---

## The Big Picture

The HOA uses three places to store and share documents: **Board Documents**, **Homeowner
Documents**, and the **Website**. Each has a distinct purpose, and understanding the
relationship among them is essential for keeping things organized as the board changes
over time.

```
Board Documents          Homeowner Documents          Website
(board-private)    ──→   (homeowner-visible)   ──→   (public links)
source files             final published PDFs          points here
working drafts           browseable by owners
historic versions
```

The flow is one-directional: board members work in Board Documents, publish final versions
to Homeowner Documents, and the website links to Homeowner Documents. Homeowners never
need to touch Board Documents, and board members rarely need to touch the website — the
website links are stable because they point to folders, not individual files.

---

## Board Documents

**Who can see it:** Board members only (by invitation to the shared drive)

**What it contains:**

- **Working files** — drafts, revisions, and source documents for everything the board
  produces: bylaws in progress, policy revisions, budget spreadsheets, contractor bids,
  correspondence
- **Board-private content** — insurance files, owner issues, legal correspondence,
  meeting prep materials, financial working documents
- **Historic versions** — full revision history of governing documents (ARC Design
  Guidelines going back to 2019, every bylaws draft, etc.)
- **Board operations** — check-in notes, worksession materials, board-internal
  communications

**What it does NOT contain (by design):**

Board Documents does not hold the authoritative published copy of anything homeowners
are meant to see. If a final newsletter PDF exists in both places, the one in Homeowner
Documents is the real one; the Board Documents copy is a leftover.

**Navigation shortcuts (→):**

Several folders in Board Documents contain a shortcut (marked with →) pointing into the
corresponding folder in Homeowner Documents. For example, inside `Budget/` you will find
`→ Published Budgets (Homeowner Docs)`. These shortcuts exist so board members can
navigate to the published version without leaving Board Documents or switching drives.
They are navigational conveniences only — the documents themselves live in Homeowner
Documents.

The one top-level shortcut at the Board Documents root is `→ Newsletters`, which points
to Homeowner Documents/Newsletters. It sits at the root because newsletters are created
inside `Communications/Newsletters/` in Board Documents, and the shortcut bridges the gap
to the published location without requiring board members to switch drives.

---

## Homeowner Documents

**Who can see it:** Any homeowner — it appears in their Google Drive when shared, and
the website links here

**What it contains:** Final, published documents in their authoritative form. Mostly PDFs.

### The two ways homeowners use Homeowner Documents

**1. Direct browsing from Google Drive**

Homeowners who have been given access to the shared drive can open it from their own
Google Drive and browse the folder structure directly — just like browsing a filing
cabinet. The folder layout is meant to be self-explanatory:

```
Homeowner Documents/
  Budgets/                    (annual budget documents by year)
  Financials/                 (monthly financial reports)
  Forms/                      (current ARC application, planting application)
  Governing Documents/        (bylaws, covenants, ARC guidelines, articles)
  Maps/                       (plat documents, model map)
  Meetings/                   (published board meeting minutes)
  Newsletters/                (newsletters by year)
  Policies/                   (all current HOA policies)
  Reserve Studies/            (reserve study reports)
  History/                    (oral history and background materials)
  Directors and Officers.pdf  (current board — the first thing to update each year)
  Policy Directory            (shortcut to the current policy directory document)
```

The two items at the root level — Directors and Officers, and Policy Directory — are
intentionally prominent. They answer the two most fundamental questions a homeowner has:
*Who runs this place?* and *What rules apply to me?*

**2. Website links**

The HOA website links to documents and folders in Homeowner Documents. When a homeowner
clicks "View Bylaws" or "Download ARC Application" on the website, they are being taken
to a file or folder in Homeowner Documents.

This is why Homeowner Documents matters: it is simultaneously the browseable filing
cabinet and the document repository behind the website. Keeping it organized and
up-to-date keeps both experiences working correctly.

### What goes in Homeowner Documents

**Final PDFs only** — with deliberate exceptions:

- Published meeting minutes (PDFs)
- Final approved governing documents (bylaws, covenants, ARC guidelines, articles) — PDFs
- Published newsletters — PDFs
- Monthly financial reports — PDFs
- Annual budgets — PDFs
- Reserve studies — PDFs
- Current forms (ARC application, planting/removal application) — PDFs
- Maps and plat documents — PDFs, plus supporting image files where needed

**Intentional exceptions to PDF-only:**
- `History/` — contains video recordings and interview transcripts (oral history project;
  PDFs don't apply here)
- `Maps/` — contains image files and spreadsheets where appropriate for reference

**What does NOT belong here:**
- Drafts, working versions, or revision-tracked documents
- Board-private documents (insurance files, owner issues, legal correspondence)
- Source files (.docx, .xlsx) for documents that have a final PDF version
- Historic/superseded versions of governing documents (keep those in Board Documents)

### Sharing settings — important

Documents in Homeowner Documents should generally be set to **"Anyone with the link can
view"**. This matters for two reasons:

1. When a homeowner clicks a link on the website, they are not required to be logged in
   to a Google account — the link should just open. If sharing is set to "Restricted,"
   they will hit a permission wall.
2. Homeowners who browse the drive directly may share specific links with household
   members or contractors who are not themselves named on the drive.

**When you upload a new document to Homeowner Documents, check its sharing setting.**
Files copied or moved within Drive do not always inherit the expected sharing. The safe
practice is: after uploading, right-click the file, choose "Share," and confirm it is
set to "Anyone with the link" (viewer).

The shared drive itself has a setting that controls defaults, but individual file sharing
can override it — so verify on anything important.

---

## The Website

**Who can see it:** Anyone — it is publicly accessible

The website is not a document store. It is a navigation layer that points homeowners to
the right documents in Homeowner Documents. When you need to update a document that the
website links to, you usually do not need to touch the website at all — you just replace
or update the file in Homeowner Documents, and the link continues to work.

**When you DO need to edit the website:** Only if you are adding a new link, removing a
link, or changing what a link points to. Website edits require access to Google Sites
(villasboulders.org) and are done manually — there is no programmatic access to Google
Sites.

**Important:** Website links point to specific file or folder IDs in Google Drive. If
you delete a file and re-upload it (rather than updating the existing file in place),
the new file gets a new ID and any website link to the old file will break. To avoid
this: upload new versions by updating the existing file ("Manage versions" or replacing
content), not by deleting and re-uploading.

---

## Practical Guide: What to Do When

**Publishing a new newsletter:**
1. Write and finalize the newsletter as a .docx in Board Documents / Communications / Newsletters / [year]/
2. Export as PDF
3. Upload the PDF to Homeowner Documents / Newsletters / [year]/
4. Confirm sharing: "Anyone with the link — viewer"
5. The website's "Newsletters" link points to the Newsletters folder — new newsletters
   appear automatically, no website edit needed

**Updating a policy:**
1. Find the current .docx source in Board Documents / Policies and Procedures /
2. Make edits, track changes, get board approval at a meeting
3. Record the adoption date in the document
4. Export to PDF, sign the PDF, save as `PolicyName(signed).pdf` in Board Documents
5. Upload the signed PDF to Homeowner Documents / Policies / (replacing the previous version in place)
6. Update the Policy Directory to reflect the new version date, then re-sign and re-publish it
7. Confirm sharing on the updated file: "Anyone with the link — viewer"

**Updating the ARC Design Guidelines:**
1. Working .docx files live in Board Documents / Governing Documents / ARC Design Guidelines / [year]/
2. Current and upcoming approved versions (PDF) go in Homeowner Documents / Governing Documents /
3. Historic versions stay in Board Documents / Governing Documents / ARC Design Guidelines / (do not put in Homeowner Documents)

**Updating Directors and Officers:**
This file sits at the Homeowner Documents root. Update it in place each year after the
annual meeting — edit the existing file so the link remains stable.

**Adding a new policy:**
Same as updating — draft in Board Documents, publish final PDF to Homeowner Documents / Policies /, and add an entry to the Policy Directory.

---

## Signing Documents

### Why we sign

Until the mid-2020s the HOA had a document problem: policies, guidelines, and rules
existed in many versions across many people's computers, often undated, unsigned, and
with no record of whether any board had ever formally voted to adopt them. Homeowners
and board members disagreed about what the rules actually were.

The practice of signing and dating final documents was adopted to solve this. A signed,
dated PDF answers a question that an unsigned document cannot: *was this formally adopted
by a board, and when?* The signature is not primarily about legal formality — it is about
institutional memory and accountability. Future boards, future homeowners, and future
disputes all benefit from a clear record.

### What gets signed

- **Individual policies** — each policy document, when formally adopted or revised by
  a board vote
- **The Policy Directory** — the master list of all current policies, signed and dated
  to certify "this board attests that these are our currently adopted policies as of this
  date." This is the board's formal answer to the question *what rules govern this HOA?*
  Without a signed directory, a homeowner browsing the Policies folder has no way to know
  whether any given document was ever formally voted on.
- **Directors and Officers** — signed and dated after each election or change, since it
  has legal and financial uses beyond internal governance (banks, insurance, vendors)
- **Bylaws** — signed at each revision/adoption
- **ARC Design Guidelines** — signed when a new version is formally adopted

### Who signs

The President or Secretary may sign. In practice the President signs most documents.
A future board should ensure that the Secretary (or another officer) knows how to sign
documents in the current tooling — the ability to sign should not depend on one person.

### The workflow

1. Approve and finalize the source document (.docx) at a board meeting
2. Record the adoption date in the document itself
3. Export to PDF
4. Sign the PDF using Google's document signing tools (or Adobe Acrobat if available)
5. Save the signed version as `[DocumentName](signed).pdf` in Board Documents alongside
   the source .docx
6. Publish the signed PDF to Homeowner Documents (see below)

### Signed copies and the two drives

The **signed PDF is the authoritative version** — it is the one homeowners should see.

- **Board Documents** holds both the source .docx and the signed PDF, with `(signed)` in
  the filename to distinguish them when both exist in the same folder
- **Homeowner Documents** holds only the signed PDF — the `(signed)` suffix is
  unnecessary here since Homeowner Documents only contains final versions

When updating an existing policy in Homeowner Documents, replace the file in place
(use "Manage versions" or upload to the same file) rather than deleting and re-uploading.
This keeps any website links intact.

### The Policy Directory in the website era

The Policy Directory was originally distributed as a PDF email attachment to all
homeowners because there was no website. That distribution channel has changed, but
the document's purpose has not.

Today, the Policy Directory lives at the Homeowner Documents root (as a shortcut to the
working document) and is linked from the website. Homeowners who browse Homeowner
Documents see it prominently. It remains the board's formal certification of which
policies are currently in effect — a role the website and the Policies folder alone
cannot fill.

### A note on tooling

Signing PDFs in the Google ecosystem is currently less straightforward than it was with
Adobe Acrobat. As of 2025–2026, the IT Officer is the primary person who knows the
current workflow. This is a known succession risk. Before the IT Officer rotates off the
board, the signing process should be documented in enough detail that any board member
can follow it — or a simpler tool should be adopted.

---

## Summary: The One Rule

> **Board Documents** is the workshop. **Homeowner Documents** is the window.
>
> Work happens in Board Documents. What homeowners see — via their Drive or via the
> website — comes from Homeowner Documents. Keep those two things separate and the
> system stays clean.
