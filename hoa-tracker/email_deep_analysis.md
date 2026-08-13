# HOA Email Deep Analysis — Issue Tracker Project

**Date:** 2026-08-09  
**Scope:** `admin@villasboulders.org` Gmail, ~180 days (Feb 17 – Aug 9, 2026)  
**Sources:**
- `/tmp/admin_emails_180d.json` — 196 messages (includes full 90-day set)
- `/tmp/keystone_cache.json` — Profiles (124), WorkOrders (116), ArchReviews (25), Violations (5)

---

## Executive Summary

Of 196 emails in 180 days:
- **~49** are pure system/noise (Google, Namecheap, GitHub, Supabase, Anthropic, Jotform marketing)
- **~51** are automated Property Report deliveries (website feature)
- **~15** are automated HOA Work Order Status Reports
- **~22–23** are ARC-related (form submissions + replies + admin forwards)
- **~6** are Josh Hall direct messages
- Remaining ~50 are board/governance, form ops, access, insurance, website monitoring, and misc admin

**Key findings for the Issue Tracker:**
1. ARC form email is the richest structured signal for creating/updating architectural issues.
2. Josh Hall decisions often happen *in-thread on ARC emails* and may never create a Keystone ArchReview (e.g. Hoffman “like-for-like”).
3. Homeowners almost never email admin@ directly about work items; they use forms (Jotform ARC, Google Forms WO/HPPR) or Keystone.
4. Work Order Status Reports are excellent for bulk status snapshots, not for correspondence or multi-item homeowner narratives.
5. ThreadId is essential: ARC threads can hold 2–5+ messages spanning original form, Josh reply, and Dee/board commentary.
6. Several ARC email items are missing or only partially reflected in Keystone ArchReviews.

---

## 1. Email Pattern Catalog

### 1.1 Noise / System (ignore for Issue Tracker)

| Pattern | Count (approx) | Detection |
|---|---|---|
| Google security/OAuth/share system | ~10+ | `noreply@google.com`, drive-shares-dm-noreply |
| Namecheap domain | 5 | namecheap.com |
| GitHub / Supabase / Anthropic | few | noreply domains |
| Jotform marketing | 1 | inspire@jotform.com |
| Mailer-daemon DSN | 2 | mailer-daemon@googlemail.com |
| Empty-from link monitor variants | 3 | empty From, body starts “Link monitor report” |

**Action:** hard-filter. Do not create issues or correspondence.

---

### 1.2 Property Report (automated website)

**Count:** ~51  
**From:** `Villas HOA Property Reports <admin@villasboulders.org>`  
**Subject:** `Your Property Report - {street address}` or `Copy: Your Property Report - …`  
**Example addresses:** 13737 Rock Point Unit 102, 13738 Rock Point Unit 101, 13684 Stone Circle Unit 101, 3555 Broadlands Unit 102, etc.  
**Unique properties in period:** 14

**Body pattern:** links to Google Docs sections (HOA Account, Work Orders & Architectural Requests, Gutter Cleaning, Wood Trim Evaluation) with expiry dates.

**Related:** `Board Report Request: {address}` — internal alert when a board member generates someone else’s report (thread with Josh asking “what is this?”).

**Action:**
- Low priority for Issue Tracker.
- Optionally log as an access/event on a property (who requested report, when).
- Do **not** create work items from these.

---

### 1.3 Work Order Status Report (automated AI/scraper digest)

**Count:** 15  
**From:** `admin@villasboulders.org`  
**Subject:** `HOA Work Order Status Report — YYYY-MM-DD (before check-in | before YYYY-MM-DD | on demand)`

**Body structure (canonical):**
```
WORK ORDER STATUS REPORT
Open work orders: N  (Closed excluded)

  PENDING BOARD REVIEW  (k)
  WO#nnnnn  PARCEL  Homeowner Name  [m/d/yyyy]
    Type - Description
    Vendor: ...

  AWAITING QUOTE / OPEN / SERVICE REQUEST / SCHEDULED / ...
```

**Statuses observed in reports:** Pending Board Review, Awaiting Quote, Open, Service Request, Scheduled (and Keystone also has On Hold, Monitored, Closed).

**Anomaly:** 2026-06-16 report body showed `Open work orders: 0` while surrounding reports had 23–24 open — treat as scrape failure, not a real zero state.

**Action:**
- Ingest as **status snapshot events**, keyed by WO#.
- Diff consecutive snapshots to detect status transitions, new WOs, disappearances (likely closed).
- Do not treat as correspondence from a person.

**Board intro thread:** Dee forwarded an early version as “Work Order Status” (2026-04-27); Deborah replied “This is great!” — process as board meta, not a new WO.

---

### 1.4 ARC Form Original (Jotform → arcformrecipients)

**Count:** ~10 distinct original submissions in period (some resubmits)  
**From pattern:** `'{Homeowner Name}' via arcformrecipients <arcformrecipients@villasboulders.org>`  
  or `'Jotform' via arcformrecipients` / test names (Jared Polis)  
**Reply-To:** homeowner email  
**Subject:** `Re: Architectural Review Request - {Name}` (Jotform often uses “Re:” even for originals)

**Structured fields in body (parse these):**
- Name
- Unit Address in the Villas
- Phone Number
- Email
- Description of Improvements
- Supporting Documentation (filenames / Jotform upload URLs)
- Planned (approximate) Completion Date
- Homeowner Signature
- Submission Date (sometimes)
- Boilerplate “I understand…” COI/permit language

**Examples:**

| Date | Name | Address | Work | Parcel match |
|---|---|---|---|---|
| 2026-03-28 / May | William Buck (tests) | 13737 Rock Pt 102 | form tests / door hardware | 13737RP2 |
| 2026-04-07 | Lauri Gravelin | 13676 Rock Point #101 | back patio railing + COI note | 13676RP1 |
| 2026-04-13 | Robert & Kathryn Wathen | 13688 #101 | Replace windows | 13688RP1 |
| 2026-04-14 | William McDonald Buck | 13737 Rock Point 102 | renew umbrella approval | 13737RP2 |
| 2026-05-28 | George Benoit | 13684 Stone Circle Unit 101 | glass on window + slider | 13684SC1 |
| 2026-05-29 | William Buck | 13737 Rock Pt Unit 102 | smart lock + Schlage lever (matte black) | 13737RP2 |
| 2026-06-28 | Deborah Lavender | 13738 Rock Pt #101 | patio step (concrete blocks + pavers) | 13738RP1 |
| 2026-07-08 | Deborah Lavender | 13738 Rock Pt #101 | patio railing (like Reineke’s) | 13738RP1 |
| 2026-07-24 | Richard Hoffman | 13662 Boulder Point unit 102 | replace 27 IGUs | 13662BP2 |
| 2026-07-29 | Richard Hoffman | same | damaged glass units only (COI attached) | 13662BP2 |
| 2026-07-30 | Richard Hoffman | same | outdoor AC condenser replacement | 13662BP2 |
| 2026-08-06 | Luann Brittenham | 13731 Stone Circle Unit 101 | black metal fence + railings/gate | 13731SC1 |

**Multi-item emails:**
- **Hoffman thread:** same Gmail thread holds *window glass* submissions and a separate *AC condenser* submission — **two distinct work items**, one threadId.
- **Brittenham:** fence on back porch + railing/gate at steps + front step railing — **multiple scopes in one form**.
- **Buck door hardware:** lock + lever as one ARC item (OK as single issue with components).

**Action:** primary creator of `arch_review` issues. Always store `gmail_message_id`, `gmail_thread_id`, parsed fields, attachments list.

---

### 1.5 ARC Reply / Manager Decision (Josh Hall in-thread)

**Examples:**
1. **Wathen windows** (thread `19d87d7dc13ea050`): Josh — “Entering this into the system now. But I can't open any of the supporting documents… Is there information on the company installing these?”
2. **Hoffman** (thread `19f94d1ea2b54d9c`): Josh — “You do not need approval for this. You are just replacing the parts for like for like.”
3. Dee reply on Hoffman: surprised / flags that ARC may disagree with Josh’s unilateral like-for-like ruling.

**Action:** correspondence + status/decision events on the linked ARC issue(s). “No approval needed” is a first-class decision type.

---

### 1.6 ARC Admin Forward / Process Design (Dee → board/ARC)

**Examples:**
- Fwd test ARC for William Buck / Jared Polis explaining new Jotform, COI language, PDF print layout.
- Thread with Patty Hasslacher + Tom Mitchell discussing form wording (COI, “Sections II–V”, City of Broomfield typo).

**Action:** usually governance/process, not a homeowner work item. Link to ARC process notes; if it contains a real homeowner form payload (Benoit forward), extract that payload as ARC original.

---

### 1.7 Work Order Form (Google Forms)

**Subjects:**
- `Work Order Request: Form submissions detected` (Form Notifications)
- `Work Order Received` (auto-ack from Work Order Request)

**Count:** 2 submission pairs observed (2026-03-17, 2026-03-25).

**Limitation:** Form Notifications email is a *count alert*, not field payload. Actual fields live in Google Form/Sheet. Processor cannot fully create a rich WO from the notification alone without Sheet/API follow-up.

**Action:** create stub WO event “form submitted” + deep-link to responses sheet; prefer Keystone scrape as source of truth once Josh enters it.

---

### 1.8 Homeowner Paid Planting / Removal (HPPR / LBC)

**Subjects:**
- `Homeowner Paid Planting and Removal: Form submissions detected`
- `Thank you for filling out our form!`
- Spreadsheet share: `Homeowner Paid Planting or Removal Request`
- Long coordination thread with Kate Couture, Josh, Nancy Benoit, Patty Hasslacher

**Content themes:** permissions on Google Form/Sheet, Josh can’t open linked responses, LBC wants single intake path, Dee explains workflow.

**First real user:** Tom (Mitchell) as guinea pig submission.

**Action:** treat as `landscape_request` / LBC issue type, separate from ARC and Keystone WO. Correspondence-heavy setup phase.

---

### 1.9 Josh Hall Direct (non-ARC)

| Thread | Topic | Pattern |
|---|---|---|
| Board Report Request | Confused by board property-report alert | Short; wants to know if action required |
| HPPR form | Permission denied on Google Form links | Ops friction |
| Spreadsheet share | Can see sheet, asks for form | Ops |
| Domain renewal | “Can I call you with banking info and you pay?” | Admin/finance, not work item |
| ARC threads | Enter system / request docs / like-for-like | **Issue-critical** |

**Communication pattern:**
- Very short replies
- Signature block heavy (CMCA/AMS, Keystone Denver)
- Action-oriented: enter into system, ask for missing docs, give yes/no
- Rarely multi-paragraph narrative
- Expects clarity on whether *he* must do something

---

### 1.10 Board / Governance Email

| Type | Examples |
|---|---|
| Insurance advisory draft | Dee → Joe Newhouse, Deborah; Joe “I like it” |
| Meeting notes (Gemini) | Auto notes Feb 25 / May 27; Tom & Deborah debate accuracy |
| Design guidelines | Broadlands vs VaB comparison + correction (permanent lighting gap, etc.) |
| Domain renewal fwd | Dee → board + Josh |
| Internal misc | “Eat Some Bugs”, mailbox keyfob website note |

**May 27 Gemini notes (high value if trusted carefully):** reserves shortfall, site grading approval, contracting tiers, bylaws, insurance advice to homeowners, asphalt/trim RFP next steps.

**Action:**
- Decisions → `board_decision` records (with low confidence if Gemini-only).
- Guideline emails → governance documents, not property issues.
- Do not invent WOs from meeting notes without explicit property+action extraction and human confirmation preference.

---

### 1.11 Homeowner Direct Email (non-form)

**Rare in admin@ inbox.** Observed:
- **Marja Walter** — access/login for property report (email not in Keystone owners list).
- **ROBERT WATHEN** — reply to Jotform “we received your response” (confirmation chain, not new request).
- Board members (Deborah, Tom, Joe, Kate, Patty, Nancy) — committee ops, not homeowner service requests.

**Implication:** Issue Tracker should not assume homeowner free-form email is the main intake. Forms + Keystone dominate.

---

### 1.12 Operational Alerts (admin automation)

| Type | Subject/body | Action |
|---|---|---|
| Keystone docs unmapped | `New files in Keystone portal Documents — review needed` | Ops task for scraper mappings, not HOA issue |
| Broken links | `villasboulders.org: N NEW broken link(s)` | Website ops |
| Session transcript | Concrete repair photo workflow planning | Dev/ops archive |
| Drive share requests | IMG_3689, Newsletters, Working_in_Google_Drive | Access ops |

---

## 2. Thread Tracking Analysis

### 2.1 Scale
- HOA-relevant messages: ~148 after system filter
- Unique threads among those: ~99
- Multi-message threads: **23**

### 2.2 Important multi-message threads

| ThreadId | # msgs | Topic | Issue Tracker relevance |
|---|---|---|---|
| `19f94d1ea2b54d9c` | 5 | Hoffman ARC (glass x2 + AC) + Josh like-for-like + Dee reaction | **Critical** — multi-item ARC + decision |
| `19d0cc01e48ab942` | 8 | HPPR spreadsheet share / LBC workflow | Process correspondence |
| `19d6f9ee98ac53fe` | 4 | Board Report Request 13738 RP 101 | Ops clarification with Josh |
| `19d0bf966b83b3cd` | 4 | HPPR form submission + Josh permissions | LBC intake |
| `19e75ce4ce00b2cb` | 3 | Buck door hardware ARC + Dee fwds | ARC |
| `19d34d20dc7659e4` | 3 | New ARC form language (Patty, Tom) | Governance |
| `19d87d7dc13ea050` | 2 | Wathen windows + Josh enter/system/docs | ARC |
| `19dd078789286d0a` | 2 | WO Status intro to board | Meta |
| `19c72611e5cf1018` | 3 | Marja Walter access | Account access |
| `19c6d547d8b3cd96` | 3 | Insurance document draft | Board governance |
| Property report threads | 2–5 | Duplicate/retry sends of same address report | Ignore / dedupe |

### 2.3 Thread vs work-item cardinality

**Rule of thumb:**
- 1 thread ≠ 1 work item  
- Especially ARC: resubmissions and related-but-distinct projects share subject “Architectural Review Request - {Name}”
- Processor must **split by description/date/submission**, then link siblings via `thread_id` + `property_id`

### 2.4 Reply relationship patterns
1. **Form original → Josh reply** (same threadId) — primary ARC lifecycle
2. **Form original → Dee forward to board** (may start new thread when Fwd:) — lose Gmail thread continuity unless In-Reply-To preserved
3. **Admin Fwd creates new thread** — Benoit, Polis test, Buck form — body still contains original form; parse nested forwarded content
4. **Google “Re: Spreadsheet shared”** — many participants; not property work items

**Recommendation:** store both `gmail_thread_id` and `in_reply_to` / `references` headers when available; for Forwards, extract nested original Message-Id if present.

---

## 3. Work Item Matching Results

### 3.1 ARC email → Keystone ArchReviews

| Email homeowner | Parcel | Email work | Keystone ArchReview match | Notes |
|---|---|---|---|---|
| Lauri Gravelin | 13676RP1 | Patio railing | `Other / Not Listed` Under Review (date blank) | Weak type match; likely same item |
| Wathen | 13688RP1 | Window | `Window` 04/13/2026 Under Review with Architect | **Strong match** |
| William Buck | 13737RP2 | Door hardware | `Door` 05/29/2026 Under Review; also Awning Open 04/14 | Door matches email; awning separate |
| George Benoit | 13684SC1 | Window glass | `Window` 05/28/2026 Approved with Conditions | **Strong match** |
| Deborah Lavender | 13738RP1 | Patio step (concrete) | `Concrete` 06/28/2026 Under Review | **Strong match** |
| Deborah Lavender | 13738RP1 | Patio railing | `Deck` 07/10/2026 Approved | **Strong match** |
| Richard Hoffman | 13662BP2 | Glass IGUs + AC | **No ArchReview on 13662BP2** | Gap — Josh said no approval needed for at least one submission |
| Luann Brittenham | 13731SC1 | Fence/railings | **No ArchReview** | Very recent (Aug 6); may lag Keystone entry |
| Buck umbrella renewal | 13737RP2 | Awning renewal | Possibly the Open `Awning` 04/14/2026 | Plausible match |

**Parcel note:** Hoffman is **13662BP2** (Richard & Holly Hoffman). Keystone has ArchReviews only on **13662BP1** (Couture) for Door/Landscape — do not merge units.

Lavender is **13738RP1**; **13738RP2** is Dancey (AC/Landscape history) — unit digit is critical.

### 3.2 ARC email homeowners → WorkOrders

Most ARC homeowners also have historical WOs (gutters, stone, etc.) that are **unrelated** to the ARC request. Matching must be by **description similarity + date proximity**, not parcel alone.

Examples:
- Lavender 13738RP1: WO window well On Hold, closed gutters — separate from patio step/rail ARC
- Brittenham 13731SC1: closed stone/bush WOs from 2025 — not the new fence ARC

### 3.3 WO Status Report → Keystone WorkOrders

- All WO#s appearing in email reports **exist in Keystone cache** (0 orphans)
- Keystone has many more WOs (mostly Closed) that never appear in “open only” reports — expected
- Report is a filtered view of Keystone open set, not an independent system of record

### 3.4 Matching heuristics that work

1. **Parcel code** from address: street number + street type suffix + unit  
   - Stone Circle → SC, Rock Point → RP, Boulder Point → BP, Plaster Point → PP, Broadlands → BL, Boulder Creek → BC  
   - Unit 101 → `1`, Unit 102 → `2` (as used in Keystone Address field)
2. **Homeowner last name** against Profiles.AccountName
3. **ARC type keywords:** window/glass, door, railing/deck, fence, AC/condenser, concrete/step, landscape
4. **Date window:** ±14 days of ArchReview.Date or WO Date Created
5. **WO#** exact when present in body (reports)

### 3.5 Matching failures to expect

- Abbreviated addresses: `13688 #101`, `Rock Pt` vs Rock Point
- Test submissions (Jared Polis, William Buck test emails)
- Like-for-like Josh dismissals never entered as ArchReview
- Form Notifications without payload
- Forwarded emails where address is only in nested content

---

## 4. Gap Analysis

### 4.1 In email, missing or incomplete in Keystone

| Item | Evidence | Risk |
|---|---|---|
| Hoffman glass replacement (13662BP2) | Multiple ARC form emails Jul 2026 | May be “no approval” but still a real homeowner project; no ArchReview row |
| Hoffman AC condenser (13662BP2) | ARC form Jul 30 with COI | Same thread; may need separate disposition |
| Brittenham fence/rail (13731SC1) | ARC Aug 6 | Not yet in ArchReviews cache |
| Josh “like-for-like” policy application | Email decision | Not captured as structured decision in Keystone |
| HPPR Tom Mitchell planting request | Form + LBC thread Mar 20 | Landscape committee track; may appear only as landscape ArchReview elsewhere or not at all |
| Board decisions from meetings (grading, bids, RFP) | Gemini notes / Tom notes | Not email-structured; easy to lose |

### 4.2 In Keystone, little/no admin@ email trail

- Vast majority of 116 WOs never appear in free-form email — they live only in Keystone + WO status digest
- Violations (driveway storage 13685SC1, garage paint 13729SC2) — **no corresponding admin@ threads** in this corpus
- Many ArchReviews (satellite dish, landscape opens, etc.) without matching admin@ ARC form email (submitted via Keystone portal or older channel)

### 4.3 Email noise that looks like work but isn’t

- Property report blasts
- Duplicate WO status reports same day
- Domain renewal
- Broken link monitors
- Drive share requests for photos/docs

### 4.4 Multi-property emails

Almost none of homeowner origin. Board/governance emails may mention many properties (meeting notes: Stratton trim/steps, Myhra crack, etc.). Those need careful NLP extraction if ingested.

### 4.5 Status change tracking via reports

Parser extracted **33 unique WO#s** across reports. Status **transitions between report emails were not cleanly detected** in automated pass (section-header parsing fragility + multi-line descriptions). Qualitatively from manual read:
- Long-stale **Awaiting Quote**: WO#91591 Banks patio fill; WO#89622 Spicer front step/handrail — persist across months
- **Pending Board Review**: WO#65121 Spiegel drainage (later Closed in Keystone); WO#99326 Gilbert dead lawn appears later
- Couture WO#96085 siding rock moves toward Closed; WO#96084 window well stays On Hold
- Open count drifts ~22 → 28 from May–Aug 2026

**June 16 zero-open report** = data quality gap in pipeline, not reality.

---

## 5. Correspondence Patterns

### 5.1 Who talks to whom

```
Homeowner
  → Jotform ARC → arcformrecipients@ (Josh + ARC + often admin)
  → Google Form WO/HPPR → Form Notifications → admin / lbc / Josh
  → rarely direct to admin@ (access issues)

Josh Hall
  → short replies on ARC threads (system entry, docs, decisions)
  → ops friction on Google permissions
  → board-facing only when pinged

Dee / admin@
  → hub: forwards forms, explains systems, drafts governance
  → WO status reports to board
  → website/property report automation

Board (Deborah, Tom O, Joe, John T, …)
  → approve language, insurance drafts, process feedback
  → rarely create structured work items via email

LBC (Kate Couture et al.)
  → HPPR workflow, visibility of submissions
```

### 5.2 Decision types made by email

| Decision | Example | Should store as |
|---|---|---|
| ARC not required (like-for-like) | Hoffman | `decision=no_approval_needed` + rationale |
| Enter into Keystone | Wathen | `status=accepted_into_system` |
| Need more info | Wathen supporting docs / contractor | `status=info_requested` |
| Form/process change | COI language, PDF layout | governance note |
| Board comfort with WO digest | Deborah “This is great!” | meta |
| Insurance newsletter OK | Joe / Deborah | governance |
| Spending/bid authorize | Mostly **not** in this admin@ sample as explicit “approve quote $X” | expect these in board meetings / Keystone more than admin@ |

### 5.3 Correspondence-worthy content checklist

Flag email as correspondence if it contains any of:
- Approve / deny / conditional / no approval needed
- Bid, quote, dollar amount, vendor name
- “Entering into the system”
- Request for COI, contractor info, supporting docs
- Status language: scheduled, on hold, closed, pending board
- Explicit assignment (“Josh will…”, “Kate will…”)
- Homeowner complaint or escalation tone

### 5.4 What is *not* correspondence for issues
- Pure form boilerplate
- Property report link mail
- Broken link reports
- Marketing
- Duplicate auto-acks

---

## 6. Schema Recommendations

Beyond basic Issue + Property + Person, the email analysis implies:

### 6.1 `email_message`
| Field | Purpose |
|---|---|
| gmail_message_id | Idempotent upsert |
| gmail_thread_id | Thread grouping |
| in_reply_to, references | Reply graph |
| direction | inbound/outbound/internal |
| from_raw, from_email, to[], cc[] | Parties |
| subject | |
| body_text, body_html | |
| received_at | |
| classification | enum (see §7) |
| classification_confidence | |
| is_noise | bool |
| parse_payload jsonb | Structured extract (ARC fields, WO lines, etc.) |
| raw_headers jsonb | optional |

### 6.2 `email_thread`
| Field | Purpose |
|---|---|
| gmail_thread_id PK | |
| subject_normalized | |
| participants[] | |
| first_message_at, last_message_at | |
| message_count | |
| primary_classification | |

### 6.3 `issue` (work item)
| Field | Purpose |
|---|---|
| id | |
| type | work_order, arch_review, landscape_hppr, violation, access, governance, ops |
| property_id / parcel_code | |
| source | keystone, jotform_arc, google_form, email, manual, meeting_notes |
| external_ids jsonb | `{keystone_wo, keystone_arc_key, jotform_submission_id}` |
| title, description | |
| status | normalized enum + raw_status |
| vendor | |
| opened_at, closed_at, due_at | |
| decision | approved, approved_with_conditions, denied, no_approval_needed, pending, info_requested |
| decision_rationale | |
| decision_by, decision_at | |
| multi_item_parent_id | if split from multi-scope form |

### 6.4 `issue_email_link`
| Field | Purpose |
|---|---|
| issue_id, email_message_id | M2M |
| role | origin, update, decision, info_request, forward_copy, related |
| match_method | parcel+date, wo_number, manual, thread |
| match_confidence | |

### 6.5 `issue_status_snapshot` (from WO reports)
| Field | Purpose |
|---|---|
| source_email_id | |
| snapshot_at | |
| wo_number | |
| parcel_code | |
| homeowner_name_raw | |
| status_raw | |
| description_raw | |
| vendor_raw | |
| created_date_raw | |

Diff engine produces `issue_event` rows: status_changed, appeared, disappeared.

### 6.6 `issue_event` / correspondence entry
| Field | Purpose |
|---|---|
| issue_id | nullable for pure board threads |
| event_type | email_received, status_change, decision, comment, snapshot_diff |
| actor_person_id | |
| summary | short human text |
| body_ref email_message_id | |
| metadata jsonb | amounts, vendors, etc. |

### 6.7 `property` enhancements
- parcel_code (Keystone Address)
- street aliases (“Rock Pt”, “Rock Point”)
- unit_number
- owner names + email aliases (Marja vs husband email problem)

### 6.8 Fields often missing today (capture explicitly)
- **thread_id**
- **decision with rationale** (especially no_approval_needed)
- **attachment / supporting doc inventory** (and whether Josh could open them)
- **form channel** (Jotform vs Google Form vs Keystone portal)
- **committee** (ARC vs LBC vs Board vs Manager)
- **multi-issue split** from one email
- **forward nesting** (original submitter vs forwarder)
- **scrape health** flag when WO report open-count collapses to 0 spuriously

---

## 7. Processing Logic Recommendations

### 7.1 Classification pipeline (ordered)

1. **Noise filter**  
   Domains/subjects: noreply google, namecheap, github, supabase, anthropic, jotform marketing, mailer-daemon, empty-from link monitor.

2. **Exact automation match**
   - Subject `HOA Work Order Status Report` → `wo_status_report`
   - Subject `Your Property Report` / `Copy: Your Property Report` → `property_report`
   - Subject `Board Report Request:` → `board_report_alert`
   - Subject `New files in Keystone portal Documents` → `ops_keystone_docs`
   - Subject contains `broken link` → `ops_website`
   - Form Notifications without field payload → `form_notification_stub`

3. **ARC family**
   - From contains `arcformrecipients` OR subject `Architectural Review Request`  
     - If body has `Unit Address in the Villas` + `Description of Improvements` → `arc_form_submission`  
     - Else if from Josh → `arc_manager_reply`  
     - Else if board members discussing form language → `arc_process_discussion`  
     - Else if Dee Fwd with nested form → `arc_form_forward` (parse nested)

4. **HPPR / LBC**
   - Subject planting/removal or spreadsheet name → `hppr_form` / `hppr_coordination`

5. **WO form**
   - `Work Order Request` / `Work Order Received` → `wo_form`

6. **Josh Hall residual** → classify by subject/thread linkage

7. **Board governance** — insurance, guidelines, meeting notes

8. **Homeowner access** — Access threads

9. **Default** → `unclassified_human` for manual review queue

### 7.2 Per-type handlers

#### A. `arc_form_submission`
1. Parse fields (regex/HTML table; tolerate concatenated plain text from Jotform).
2. Normalize address → parcel via Profiles + alias table.
3. Detect **multiple projects** in description (AC vs glass; fence vs front railing).  
   - Heuristic: separate sentences with distinct asset types → candidate split; prefer one issue with checklist if single contractor visit.
4. Upsert issue(s) type=arch_review, source=jotform_arc.
5. Match Keystone ArchReviews (parcel + type keyword + ±14d).
6. Link email; set role=origin.
7. Attach supporting doc names/URLs to issue file list.
8. If same thread already has issues, add as new issue or update if near-duplicate resubmit (compare description similarity).

#### B. `arc_manager_reply` (Josh)
1. Find thread issues via gmail_thread_id.
2. NLP/rules for decision:
   - `do not need approval` / `like for like` → decision=no_approval_needed
   - `entering this into the system` → status note accepted
   - `can't open` / `need` / `is there information` → info_requested
3. Create correspondence event; notify board queue if decision bypasses ARC.

#### C. `wo_status_report`
1. Parse sections → rows of WO#.
2. Write snapshots.
3. Diff vs previous successful snapshot (ignore open_count==0 if previous >10 — **scrape failure guard**).
4. Upsert issues type=work_order from Keystone ids; update status.
5. No new correspondence unless status enters Pending Board Review (optional alert).

#### D. `form_notification_stub` (WO/HPPR)
1. Create lightweight event “submission detected”.
2. Enqueue fetch from Google Sheet/API for full fields (out of band).
3. Do not trust as complete issue description.

#### E. `property_report` / `board_report_alert`
1. Extract address → property.
2. Optional audit log only.

#### F. Meeting notes / governance
1. Extract candidate action items only into review queue.
2. Require confirmation before creating issues (false positives high — Gemini inaccuracy called out by Deborah).

### 7.3 Property resolution algorithm

```
input: free text address or name
1. Extract street number
2. Map street tokens → suffix (SC/RP/BP/PP/BL/BC)
3. Extract unit 101/102/#101 → 1/2
4. Candidate = f"{num}{suffix}{unit}"
5. Validate against Profiles
6. Fallback: number+suffix unique match
7. Fallback: homeowner name token match (warn on multi-match)
8. Never attach to wrong unit (BP1 vs BP2)
```

### 7.4 Thread handling rules
- Always index by thread_id.
- On Fwd with new thread_id, fuzzy-match nested subject + homeowner + date to existing ARC issue.
- Display timeline = all emails linked to issue ∪ thread messages for origin thread.

### 7.5 Multi-item email rules
1. If description lists distinct asset classes (windows AND AC) → **two issues**, shared thread_id.
2. If description is one project with components (lock + matching lever) → **one issue**, components array.
3. Brittenham-style fence + front railing: prefer **one issue** with scope list unless board/Josh treats separately.

### 7.6 What not to auto-create
- Issues from property reports
- Issues from broken-link or docs-mapping alerts
- Issues from insurance drafts
- Issues from domain renewal
- Closed historical Keystone WOs unless user views history

### 7.7 Human-in-the-loop queue (recommended)
- Unmatched ARC forms (no parcel)
- Josh decisions without matching open ARC
- Meeting-note extractions
- Any email mentioning $ amounts / bid approval
- Multi-property board emails

---

## 8. Answers to Key Pattern Questions

| Question | Answer |
|---|---|
| ARC threads vs standalone? | Real ARC work is **threaded** (form + Josh ± Dee). Admin test forwards often **new threads**. ~5-message Hoffman thread is the archetype. |
| Direct homeowner email vs forms? | **Forms dominate.** Direct homeowner mail to admin@ is rare (access, confirmations). |
| Josh pattern? | Short, operational, signature-heavy; enters Keystone; asks for docs; occasionally issues policy-like “no approval needed.” |
| Multi-property emails? | Rare for homeowners. Meeting notes are the multi-property risk. |
| Work items in email not in Keystone? | **Yes:** Hoffman 13662BP2 ARC work; Brittenham fence (lag); email-only decisions; HPPR coordination. |
| WO reports show status changes? | Yes in aggregate over months; long stuck Awaiting Quote items; need robust parser + scrape-failure guard. Snapshot diff is the right design. |
| Board decision emails approve/deny quotes? | **Sparse in this mailbox.** More common: process, insurance, guidelines. Financial approvals appear in meeting notes more than admin@ threads. Do not rely on admin@ alone for bid authorization history. |

---

## 9. Suggested MVP Ingestion Priority

1. **ARC form submissions + Josh replies** (highest issue value per email)
2. **WO status report snapshot diff** (bulk status truth aligned to Keystone)
3. **Keystone cache sync** as system of record for WO/ARC/Violations/Profiles
4. **HPPR/LBC forms** as second form type
5. Correspondence UI on top of linked emails
6. Defer property reports, website ops, pure governance unless tagged manually

---

## 10. Appendix — Useful Constants

### Street → parcel suffix
| Street | Suffix |
|---|---|
| Stone Circle | SC |
| Rock Point | RP |
| Boulder Point | BP |
| Plaster Point | PP |
| Broadlands | BL |
| Boulder Creek | BC |

### Key actors
| Person | Email | Role |
|---|---|---|
| Dee / William Buck | admin@villasboulders.org | Board IT / hub |
| Joshua Hall | hallj@keystonepacific.com | Manager (Keystone) |
| Deborah Lavender | lavenderdjbhoa@gmail.com | Board |
| Tom O'Leary | olearyhoa@gmail.com | Board |
| Tom Mitchell | tlmitchell482332@gmail.com / bigtlmusa@yahoo.com | ARC-related |
| Patty Hasslacher | phasslacher@msn.com | ARC |
| Kate Couture | kateandrewscouture@gmail.com | LBC |
| Joe Newhouse | brookeom@aol.com | Board/insurance |
| Nancy Benoit | nancyabenoit@yahoo.com | Homeowner/committee |

### ARC distribution list
`arcformrecipients@villasboulders.org` — form fanout to Josh + ARC (+ admin as configured)

### Data files used
- `/tmp/admin_emails_180d.json` (196)
- `/tmp/admin_emails_90d.json` (92; subset)
- `/tmp/keystone_cache.json`

---

*End of analysis. This document is intended as design input for the HOA Issue Tracker email processor and schema.*
