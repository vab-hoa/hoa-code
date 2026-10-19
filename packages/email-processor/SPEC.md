# HOA Email Processor — TypeScript Rebuild Spec

## Purpose

This document specifies a TypeScript email processor that replaces the Python
`hoa-tracker/email_processor.py` running on oregano. The new processor runs as
a GitHub Actions scheduled workflow in the `vab-hoa/hoa-code` repo. It reads
HOA emails from Gmail (service account) and IMAP, classifies them using an LLM
via OpenRouter, and writes work items, email messages, and links to Supabase.

The Python processor is 3,065 lines across 46 functions. This spec captures
every behavior the TypeScript version must replicate. The coding harness
should NOT read the Python — work from this spec and the shared TypeScript
types in `packages/shared/src/`.

## Repository location

```
vab-hoa/hoa-code/
├── packages/
│   ├── shared/src/          ← types, constants, parcel helpers (already exists)
│   └── email-processor/src/ ← THIS IS WHAT YOU'RE BUILDING
├── hoa-tracker-dashboard/   ← Next.js dashboard (don't touch)
├── hoa-tracker/             ← OLD Python code (reference only, don't modify)
└── .github/workflows/       ← GitHub Actions (add email-processor.yml here)
```

## Environment (GitHub Actions secrets)

All secrets are already configured in GitHub Actions repo secrets:

| Secret name | What it is |
|-------------|-----------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google service account JSON (for admin@villasboulders.org Gmail) |
| `SUPABASE_URL` | `https://obveytoovkzjrpzrhrim.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for DB writes) |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM classification |
| `SMTP_PASS_JANE` | SMTP password for jane@wmbuck.net alert emails |
| `KEYSTONE_USERNAME` | Keystone portal username (not needed yet) |
| `KEYSTONE_PASSWORD` | Keystone portal password (not needed yet) |

Also need (add as GitHub secret or hardcode — it's not secret):
- `GMAIL_IMAP_PASSWORD_MCDONDBUCKHOA` — IMAP app password for mcdonaldbuckhoa@gmail.com
  (currently stored in `hoa-tracker/secrets/.gmail_pw_mcdonaldbuckhoa` on oregano)

## Supabase schema

Database: `db.obveytoovkzjrpzrhrim.supabase.co:5432`, database `postgres`, user `postgres`.
Password comes from `SUPABASE_SERVICE_ROLE_KEY` or direct DB password.

Use `@supabase/supabase-js` with the service role key for all writes.
Use `pg` (node-postgres) for direct SQL where upserts and CHECK constraints matter.

### Tables

```
properties(id UUID PK, parcel_code TEXT UNIQUE, address TEXT, unit TEXT,
           owner_name TEXT, owner_email TEXT, owner_phone TEXT)

work_items(id UUID PK, source_document_id UUID, property_id UUID FK,
           title TEXT, description TEXT, category TEXT, status TEXT,
           priority TEXT, assigned_to TEXT, vendor TEXT,
           decision TEXT, decision_rationale TEXT, decision_by TEXT,
           decision_at TIMESTAMPTZ, estimated_cost NUMERIC, bid_amount NUMERIC,
           keystone_wo_number TEXT, created_date TIMESTAMPTZ DEFAULT NOW(),
           due_date TIMESTAMPTZ, closed_date TIMESTAMPTZ,
           multi_item_parent_id UUID, external_ids JSONB,
           updated_date TIMESTAMPTZ DEFAULT NOW(),
           status_changed_at TIMESTAMPTZ,
           keystone_status TEXT, arc_request_serial TEXT)

email_message(id UUID PK, gmail_message_id TEXT UNIQUE,
              gmail_thread_id TEXT, in_reply_to TEXT, direction TEXT,
              from_name TEXT, from_email TEXT, to_recipients TEXT[],
              cc_recipients TEXT[], subject TEXT, body_text TEXT,
              body_html TEXT, received_date TIMESTAMPTZ,
              classification TEXT, classification_confidence NUMERIC,
              is_noise BOOLEAN, parse_payload JSONB,
              raw_headers JSONB, processed_at TIMESTAMPTZ)

email_thread(gmail_thread_id TEXT PK, subject_normalized TEXT,
             first_message_at TIMESTAMPTZ, last_message_at TIMESTAMPTZ,
             message_count INT, primary_classification TEXT,
             primary_parcel_code TEXT)

issue_email_link(id UUID PK, work_item_id UUID FK, email_message_id UUID FK,
                 role TEXT, match_method TEXT, match_confidence NUMERIC,
                 created_at TIMESTAMPTZ DEFAULT NOW())

source_documents(id UUID PK, property_id UUID FK, doc_type TEXT,
                 source_ref TEXT, subject TEXT, body_text TEXT,
                 from_name TEXT, from_email TEXT, received_date TIMESTAMPTZ,
                 gmail_thread_id TEXT)

work_item_notes(id UUID PK, work_item_id UUID FK, note_date TIMESTAMPTZ,
                 content TEXT, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW())

wo_status_snapshot(id UUID PK, source_email_id UUID, snapshot_date TIMESTAMPTZ,
                    wo_number TEXT, parcel_code TEXT, homeowner_name TEXT,
                    status_raw TEXT, description TEXT, vendor TEXT,
                    created_date_raw TEXT, created_at TIMESTAMPTZ DEFAULT NOW())

work_item_documents(id UUID PK, work_item_id UUID FK, title TEXT,
                    file_name TEXT, storage_path TEXT, content_type TEXT,
                    file_size_bytes BIGINT, uploaded_by TEXT,
                    uploaded_at TIMESTAMPTZ DEFAULT NOW())

aging_config(id UUID PK, category TEXT, status TEXT, max_days INT,
              alert_action TEXT)
```

### CHECK constraints

- `work_items.status` must be one of: `manager`, `board`, `arc`, `lbc`,
  `contractor`, `project: window_wells`, `project: concrete`,
  `project: lawns`, `project: wood_trim`, `project: asphalt`,
  `project: tree_trimming`, `project: gutter_cleaning`, `closed`,
  `approved`, `approved_with_conditions`, `denied`, `withdrawn`,
  `notified`, `fined`, `resolved`
- `work_items.category` must be one of: `work_order`, `arc_request`,
  `violation`, `other`
- `email_message.classification` must be one of: `noise`, `property_report`,
  `wo_status_report`, `arc_form_submission`, `arc_manager_reply`,
  `arc_process_discussion`, `arc_form_forward`, `wo_form`, `hppr_form`,
  `board_email`, `josh_direct`, `homeowner_direct`, `governance`,
  `ops_alert`, `unclassified`, `wo_homeowner`, `wo_followup`,
  `arc_approval`, `arc_manager_reply`, `invoice_pending`
- `issue_email_link.role` must be one of: `origin`, `update`, `decision`,
  `related`, `manual`
- `issue_email_link.match_method` must be one of: `parcel_date`,
  `wo_number`, `thread`, `manual`

## Mailboxes

Two mailboxes to read from:

1. **admin@villasboulders.org** — Google Workspace, accessed via service account
   impersonation. Use `googleapis` npm package.
   - Scopes: `['https://www.googleapis.com/auth/gmail.readonly']`
   - Service account JSON comes from `GOOGLE_SERVICE_ACCOUNT_JSON` env var (base64-encoded)
   - Subject: `admin@villasboulders.org`
   - Query: `after:YYYY/MM/DD -subject:"[HOA Tracker]"` (exclude our own alerts)

2. **mcdonaldbuckhoa@gmail.com** — Gmail, accessed via IMAP.
   - Host: `imap.gmail.com`, port 993, SSL
   - Use `imapflow` npm package
   - Password from `GMAIL_IMAP_PASSWORD_MCDONDBUCKHOA` env var
   - Select `"[Gmail]/All Mail"`
   - Search: `SINCE DD-Mon-YYYY`

## Email fetching

### Gmail API (admin@)

```typescript
// Pseudocode
import { google } from 'googleapis'

function getGmailClient(): gmail_v1.Gmail {
  const saJson = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!, 'utf-8').toString())
  // If base64, decode first; if raw JSON, use directly
  const jwt = new google.auth.JWT({
    email: saJson.client_email,
    key: saJson.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    subject: 'admin@villasboulders.org',
  })
  return google.gmail({ version: 'v1', auth: jwt })
}

async function fetchGmailEmails(days: number): Promise<EmailData[]> {
  const gmail = getGmailClient()
  const afterDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10).replace(/-/g, '/')
  const query = `after:${afterDate} -subject:"[HOA Tracker]"`
  // Paginate list, fetch full messages, extract headers + body + attachments
}
```

For each message, extract:
- `gmail_message_id`: from `Message-ID` header (or the Gmail ID as fallback)
- `thread_id`: from `gmailThread.threadId` field
- `in_reply_to`: from `In-Reply-To` header
- `subject`, `from` (parse into `from_name` + `from_email`), `to`, `cc`
- `received_date`: from `Date` header (use `email.utils` equivalent in Node)
- `body_text` + `body_html`: walk multipart parts, decode base64 bodies
- `attachments`: filename + attachmentId (for Gmail API download)

### IMAP (mcdonaldbuckhoa@)

```typescript
import { ImapFlow } from 'imapflow'

async function fetchImapEmails(days: number): Promise<EmailData[]> {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: 'mcdonaldbuckhoa@gmail.com', pass: process.env.GMAIL_IMAP_PASSWORD_MCDONDBUCKHOA! },
  })
  await client.connect()
  await client.mailboxOpen('[Gmail]/All Mail')
  const since = new Date(Date.now() - days * 86400000)
  // Search SINCE, fetch BODY[], parse with simple parser
}
```

For IMAP, thread_id is synthetic: `imap:normalizeSubject()[:50]` (no real thread IDs).

### EmailData interface

```typescript
interface EmailData {
  gmail_id: string
  gmail_message_id: string
  thread_id: string
  in_reply_to: string | null
  subject: string
  from_name: string
  from_email: string
  to_recipients: string[]
  cc_recipients: string[]
  received_date: Date | null
  body_text: string
  body_html: string
  raw_headers: Record<string, string>
  attachments: AttachmentInfo[]
}

interface AttachmentInfo {
  filename: string
  mimeType: string
  size: number
  // Gmail: has attachmentId for download
  // IMAP: has content already decoded
}
```

## Classification pipeline

The classification is a two-stage pipeline:
1. **Rule-based pre-filter** — fast pattern matching for known senders/subjects
2. **LLM classification** — for emails that pass the pre-filter, send to OpenRouter

### Stage 1: Rule-based pre-filter

Order matters — first match wins.

```typescript
function classifyEmail(subject: string, senderFull: string, recipients: string, body: string): RuleResult | null {
  const subjectL = (subject || '').toLowerCase()
  const senderL = (senderFull || '').toLowerCase()
  const recipientsL = (recipients || '').toLowerCase()
  const bodyL = (body || '').toLowerCase().slice(0, 2000)

  // 1. Noise filter
  const NOISE_DOMAINS = [
    'noreply@google.com', 'drive-shares-dm-noreply@google.com',
    'mailer-daemon@googlemail.com',
  ]
  const NOISE_PATTERNS = [
    'namecheap.com', 'github.com', 'supabase.co', 'anthropic.com',
    'jotform.com', 'accounts.google.com', 'notifications.google.com',
    'googlecloud@google.com', 'gemini-notes@google.com',
    'googlephotos.com', 'strongroomsolutions.com',
  ]
  if (NOISE_DOMAINS.some(d => senderL.includes(d))) return { classification: 'noise', confidence: 1.0, isNoise: true }
  if (NOISE_PATTERNS.some(p => senderL.includes(p))) return { classification: 'noise', confidence: 0.95, isNoise: true }
  if (!sender || sender.trim() === '' || bodyL.includes('link monitor report')) return { classification: 'noise', confidence: 0.90, isNoise: true }
  if (senderL.includes('mailer-daemon')) return { classification: 'noise', confidence: 1.0, isNoise: true }

  // 2. Invoice lockbox
  if (senderL.includes('strongroomsolutions.com') || senderL.includes('payableslockbox'))
    return { classification: 'invoice_pending', confidence: 0.95, isNoise: false }

  // 3. Exact automation matches
  if (subjectL.includes('work order status report') && senderL.includes('villasboulders.org'))
    return { classification: 'wo_status_report', confidence: 1.0, isNoise: false }
  if (subjectL.includes('your property report') || subjectL.startsWith('copy: your property report'))
    return { classification: 'property_report', confidence: 1.0, isNoise: false }
  if (subjectL.startsWith('board report request:'))
    return { classification: 'property_report', confidence: 0.90, isNoise: false }
  if ((senderL.includes('docs.google.com') || senderL.includes('comments-noreply')) &&
      (subjectL.includes('was edited recently') || subjectL.includes('shared')))
    return { classification: 'ops_alert', confidence: 0.80, isNoise: false }
  if (subjectL.includes('new files in keystone portal'))
    return { classification: 'ops_alert', confidence: 0.95, isNoise: false }
  if (subjectL.includes('broken link'))
    return { classification: 'ops_alert', confidence: 0.95, isNoise: false }

  // Form notification stubs
  if (subjectL.includes('form submissions detected')) {
    if (subjectL.includes('work order')) return { classification: 'wo_form', confidence: 0.95, isNoise: false }
    if (subjectL.includes('planting') || subjectL.includes('removal')) return { classification: 'hppr_form', confidence: 0.95, isNoise: false }
    return { classification: 'wo_form', confidence: 0.80, isNoise: false }
  }
  if (subjectL.includes('work order received') || subjectL.includes('work order request'))
    return { classification: 'wo_form', confidence: 0.90, isNoise: false }

  // 4. ARC family
  const ARCFORM_RECIPIENT = 'arcformrecipients@villasboulders.org'
  const JOSH_EMAIL = 'hallj@keystonepacific.com'
  const BOARD_EMAILS = [
    'lavenderdjbhoa@gmail.com', 'olearyhoa@gmail.com', 'brookeom@aol.com',
    'tlmitchell482332@gmail.com', 'bigtlmusa@yahoo.com',
    'phasslacher@msn.com', 'kateandrewscouture@gmail.com', 'nancyabenoit@yahoo.com',
  ]
  const isArc = recipientsL.includes(ARCFORM_RECIPIENT) ||
                subjectL.includes('architectural review request') ||
                subjectL.includes('vab arc request') ||
                /\barc request\b/.test(subjectL)
  const isFromJosh = senderL.includes(JOSH_EMAIL)
  const isFromDee = senderL.includes('admin@villasboulders.org') || senderL.includes('wmbuck')
  const isBoardMember = BOARD_EMAILS.some(be => senderL.includes(be))

  if (isArc) {
    if (isFromJosh) return { classification: 'arc_manager_reply', confidence: 0.90, isNoise: false }
    if (subjectL.includes('vab arc request') && (subjectL.includes('fwd') || subjectL.includes('forward')))
      return { classification: 'arc_form_forward', confidence: 0.85, isNoise: false }
    if ((senderL.includes('arcformrecipients') || senderL.includes('jotform')) &&
        bodyL.includes('unit address in the villas') && bodyL.includes('description of improvements'))
      return { classification: 'arc_form_submission', confidence: 0.98, isNoise: false }
    if (bodyL.includes('unit address in the villas') && bodyL.includes('description of improvements')) {
      if (isFromDee && (subjectL.includes('fwd') || subjectL.includes('forward')))
        return { classification: 'arc_form_forward', confidence: 0.85, isNoise: false }
      if (senderL.includes('arcformrecipients') || senderL.includes('via arcformrecipients'))
        return { classification: 'arc_form_submission', confidence: 0.95, isNoise: false }
      return { classification: 'arc_process_discussion', confidence: 0.75, isNoise: false }
    }
    if (isFromDee && (subjectL.includes('fwd') || subjectL.includes('forward'))) {
      if (bodyL.includes('unit address') || bodyL.includes('description of improvements'))
        return { classification: 'arc_form_forward', confidence: 0.85, isNoise: false }
      return { classification: 'arc_process_discussion', confidence: 0.75, isNoise: false }
    }
    if (isBoardMember) return { classification: 'arc_process_discussion', confidence: 0.75, isNoise: false }
    if (bodyL.includes('unit address in the villas') && bodyL.includes('description of improvements'))
      return { classification: 'arc_form_submission', confidence: 0.60, isNoise: false }
    return { classification: 'arc_process_discussion', confidence: 0.60, isNoise: false }
  }

  // 5. HPPR/LBC forms
  if (subjectL.includes('homeowner paid planting') || subjectL.includes('planting and removal') ||
      recipientsL.includes('lbcformrecipients') ||
      (subjectL.includes('landscape') && subjectL.includes('form'))) {
    if (subjectL.startsWith('re:') && (subjectL.includes('approv') || bodyL.slice(0, 1500).includes('approv')))
      return { classification: 'hppr_form', confidence: 0.85, isNoise: false }
    return { classification: 'hppr_form', confidence: 0.90, isNoise: false }
  }
  if (subjectL.includes('thank you for filling out our form') && senderL.includes('villasboulders.org'))
    return { classification: 'hppr_form', confidence: 0.80, isNoise: false }

  // 6. WO form (individual)
  if (senderL.includes('workorders@villasboulders.org'))
    return { classification: 'wo_form', confidence: 0.90, isNoise: false }

  // 7. Josh Hall residual
  if (isFromJosh) return { classification: 'josh_direct', confidence: 0.85, isNoise: false }

  // 8. WO followup (board member replies on existing threads)
  if ((subjectL.includes('re:') || subjectL.includes('re ') ||
       bodyL.includes('will monitor') || bodyL.includes('monitor the situation') ||
       bodyL.includes('verify that it is running')) &&
      (isBoardMember || isFromDee || recipientsL.includes('lbc@villasboulders.org'))) {
    const addrRe = /\b(\d{4,5}\s+(?:Rock Point|Stone Circle|Boulder Point|Plaster Point|Broadlands|Boulder Circle)[^,\n]*(?:#|Unit|unit)?\s*\d*)\b/i
    if (addrRe.test(subject + '\n' + body.slice(0, 2000))) {
      const workTopicWords = ['irrigation', 'sprinkler', 'watering', 'water', 'leak',
        'downspout', 'gutter', 'soffit', 'window well', 'concrete', 'crack', 'cracked',
        'stucco', 'fence', 'tree', 'branch', 'paint', 'peeling', 'siding',
        'driveway', 'patio', 'step', 'steps', 'deck', 'snow', 'ice']
      if (workTopicWords.some(w => bodyL.includes(w)))
        return { classification: 'wo_followup', confidence: 0.85, isNoise: false }
    }
  }

  // 9. Board governance
  if (isBoardMember || recipientsL.includes('board@villasboulders.org'))
    return { classification: 'board_email', confidence: 0.70, isNoise: false }

  // 10. ARC approval replies (subject contains APPROVED)
  if (subjectL.includes('approved') && (isBoardMember || isFromDee) &&
      !subjectL.includes('arc request')) {
    const addrRe = /\b(\d{4,5}\s+(?:Rock Point|Stone Circle|Boulder Point|Plaster Point|Broadlands|Boulder Circle)[^,\n]*(?:#|Unit|unit)?\s*\d*)\b/i
    if (addrRe.test(subject + '\n' + body.slice(0, 2000)))
      return { classification: 'arc_approval', confidence: 0.85, isNoise: false }
  }

  // --- End of rule-based ---
  // If not matched by rules, fall through to LLM
  return null
}
```

### Stage 2: LLM classification (for non-system emails)

When the rule-based filter returns `null`, call the LLM:

```typescript
async function llmClassifyEmail(subject: string, sender: string, recipients: string, body: string): Promise<ClassificationResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const bodyTruncated = (body || '').slice(0, 1000)

  const prompt = `You are an assistant for a homeowners association (HOA) board. Classify this email.

Subject: ${subject || '(none)'}
From: ${sender || '(unknown)'}
To: ${recipients || '(unknown)'}

Body (first 1000 chars):
${bodyTruncated}

Classify this email as exactly one of:
- wo_homeowner: A homeowner reporting a maintenance issue or work order request about their property (e.g., sprinkler leak, broken step, drainage problem)
- homeowner_direct: General correspondence from a homeowner that is NOT a maintenance request (e.g., newsletter edits, social emails, questions about meetings)
- josh_direct: A reply from a property manager or vendor/contractor about work being done
- noise: Automated notifications, marketing, or irrelevant emails

Reply with JSON only: {"classification": "wo_homeowner", "reason": "brief explanation"}`

  // POST to https://openrouter.ai/api/v1/chat/completions
  // model: openrouter/z-ai/glm-5.3-flash
  // temperature: 0.1, max_tokens: 200
  // Parse JSON from response, extract classification + reason
  // Validate classification is one of the 4 allowed values (default to homeowner_direct)
  // Return { classification, confidence: 0.85, isNoise: classification === 'noise', reason }
  // On API failure: return null
}
```

### Retry queue

If LLM returns null (API down), store the email in a Supabase retry queue table:

```sql
CREATE TABLE IF NOT EXISTS llm_retry_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT,
  thread_id TEXT,
  subject TEXT,
  sender TEXT,
  received_date TIMESTAMPTZ,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);
```

Next run processes queued items first. If any are older than 3 days, send alert email.

### Alert emails

If the LLM API is down, send an alert to `jane@wmbuck.net` via SMTP:

```typescript
// SMTP: wmbuck.net:587, user jane@wmbuck.net, password from SMTP_PASS_JANE env var
// Use nodemailer npm package
import nodemailer from 'nodemailer'

async function sendAlert(subject: string, body: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: 'wmbuck.net',
    port: 587,
    secure: false,
    auth: { user: 'jane@wmbuck.net', pass: process.env.SMTP_PASS_JANE! },
  })
  await transporter.sendMail({
    from: 'jane@wmbuck.net',
    to: 'dee@wmbuck.net',
    subject: `[HOA Tracker Alert] ${subject}`,
    text: body,
  })
}
```

## Handler logic

Each classification has a handler. Here's what each one does:

### noise
- Upsert email_message with classification=noise, is_noise=true
- No work item created
- Return result

### wo_status_report
- Parse body for WO status report sections (table-like structure)
- Upsert email_message
- Insert wo_status_snapshot rows (dedup by source_email_id + wo_number)
- Upsert email_thread

### property_report
- Upsert email_message with classification=property_report
- Upsert email_thread
- No work item (just tracked)

### ops_alert
- Same as property_report — log + thread only

### arc_form_submission
1. Parse body for ARC form fields:
   - `homeowner_name`, `address`, `description`, `planned_completion_date`
   - `arc_request_serial` (if present)
2. Standardize address → parcel_code
3. Upsert email_message
4. Upsert email_thread
5. Look up property_id by parcel_code
6. Create source_document (type=email, with thread_id, body_text, from info)
7. **Idempotency check**: `checkThreadHasWorkItem(thread_id)` — if work item exists for this thread, skip
8. Create work_item:
   - title: `"Name - ParcelCode"` + ` (serial)` if available
   - description: parsed description + planned completion date
   - category: `arc_request`
   - status: `manager`
   - priority: `normal`
9. Create issue_email_link (role=origin, method=parcel_date, confidence=0.95)
10. Process attachments (if any)

### arc_form_forward
Same as arc_form_submission but classification=arc_form_forward.
The form fields may be nested inside a forwarded email body — parse past the forward headers.

### arc_manager_reply
1. Parse body for decision (approved/denied/info_requested)
2. Upsert email_message
3. Upsert email_thread
4. No work item created (just recorded)

### arc_process_discussion
1. Upsert email_message
2. Upsert email_thread
3. No work item created

### arc_approval
1. Extract address from subject/body → parcel_code
2. Upsert email_message
3. Upsert email_thread
4. Look up property_id by parcel_code
5. Find newest open ARC work item for this property:
   ```sql
   SELECT id FROM work_items
   WHERE property_id = $1 AND category = 'arc_request'
     AND status NOT IN ('closed', 'cancelled', 'denied', 'approved', 'approved_with_conditions')
   ORDER BY created_date DESC NULLS LAST LIMIT 1
   ```
6. Update work_item: status=approved, decision=approved, decision_at=NOW(), status_changed_at=NOW()
7. Insert work_item_note: "ARC approval from email: {subject}"
8. Create issue_email_link (role=decision, method=parcel_date, confidence=0.8)

### wo_form
1. Parse body for WO form fields:
   - `homeowner_name`, `address`, `description`
   - `keystone_wo_number` (if present)
   - `priority` (if present, 8-10 = high)
2. Standardize address → parcel_code
3. Upsert email_message
4. Upsert email_thread
5. Look up property_id
6. Create source_document
7. **Idempotency check**: `checkThreadHasWorkItem(thread_id)`
8. Create work_item:
   - title: `"Name - ParcelCode"` + ` (WO#number)` if available
   - category: `work_order`, status: `manager`
   - priority: high if priority in 8-10, else normal
9. Create issue_email_link (role=origin, method=parcel_date, confidence=0.95)

### wo_homeowner
1. Extract address from body → parcel_code
2. Build title: `LastName - ParcelCode - ShortDescription` (short desc = subject, max 50 chars)
3. Clean body text (strip quoted text, signatures, Keystone boilerplate)
4. Upsert email_message
5. Upsert email_thread
6. Look up property_id
7. Create source_document
8. **Idempotency check**: `checkThreadHasWorkItem(thread_id)`
9. Create work_item:
   - category: `work_order`, status: `manager`, priority: `normal`
10. Create issue_email_link (role=origin, method=parcel_date, confidence=0.85)

### hppr_form
1. Extract address from subject/body → parcel_code
2. Check if approval reply (Re: + "approv" in subject or body)
3. Upsert email_message
4. Upsert email_thread
5. Look up property_id
6. Create source_document
7. **Idempotency check**: `checkThreadHasWorkItem(thread_id)`
8. Create work_item:
   - title: `"Name - ParcelCode"` + ` (LBC)` if available
   - category: `work_order`, status: `manager` (or `approved` if approval reply)
   - If approval: set decision=approved, decision_at=NOW(), status=approved
9. Create issue_email_link (role=origin, method=parcel_date, confidence=0.95)
10. If approval: insert work_item_note about the approval

### wo_followup
1. Extract address from subject/body → parcel_code
2. Classify disposition from body:
   - `monitor` if body contains: "will monitor", "monitor the situation", "we will monitor", "verify that it is running", "doublecheck", "double check", "keep an eye", "watch it", "understood"
   - `resolved` if body contains: "resolved", "fixed", "is fixed", "has been fixed", "completed", "is complete", "done", "repaired", "taken care of", "working now", "is running now", "now working"
3. disposition = 'resolved' if (monitor OR resolved language found) else null
4. Upsert email_message
5. Upsert email_thread
6. Look up property_id
7. Find newest open work_order for property:
   ```sql
   SELECT id, title FROM work_items
   WHERE property_id = $1 AND category = 'work_order'
     AND status NOT IN ('closed', 'cancelled', 'denied', 'withdrawn', 'resolved')
   ORDER BY created_date DESC NULLS LAST LIMIT 1
   ```
8. If found and disposition:
   - UPDATE work_items SET status='resolved', updated_date=NOW(), status_changed_at=NOW()
   - If monitor language: note "LBC is monitoring the situation (monitor language mapped to resolved)"
   - Insert work_item_note
   - Create issue_email_link (role=update, method=parcel_date, confidence=0.8)
9. If found and no disposition:
   - Still link email (role=update, method=parcel_date, confidence=0.8)
   - Insert work_item_note with email subject

### josh_direct
1. Extract address from subject/body → parcel_code
2. Upsert email_message
3. Upsert email_thread
4. If parcel found, look up property_id
5. Find newest open work_order for property
6. Create issue_email_link (role=update, method=parcel_date, confidence=0.75)

### board_email / governance
1. Upsert email_message
2. Upsert email_thread
3. No work item created

### homeowner_direct
1. Try to find address in body → parcel_code
2. Upsert email_message
3. Upsert email_thread
4. Try to link to existing work item (by thread_id, WO number in body, or parcel code)
5. If linked, create issue_email_link (role=related, method varies)
6. NO work item created (log + link only)

### invoice_pending
1. Upsert email_message
2. Upsert email_thread
3. No work item created

## Helper functions

### standardizeAddress(addr: string): string | null
Use the `parcelCodeFromParts` and `normalizeStreetName` functions from `@vab-hoa/shared`.

Street codes: Broadlands=BL, Boulder Point=BP, Rock Point=RP, Stone Circle=SC, Boulder Circle=BC, Plaster Point=PP.

Parse address like "13723 #102 Plaster Point" or "13723 Plaster Point #102":
1. Extract street number (4-5 digits)
2. Extract unit (#101, Unit 2, etc.) → last digit
3. Match street name → code
4. Return `streetNumber + streetCode + unitDigit` (e.g. "13723PP2")

### cleanEmailBody(body: string, subject: string, senderName: string): string
- Strip quoted reply text (lines starting with `>`)
- Strip common signature markers (`--`, `___`, `Sent from my iPhone`, etc.)
- Strip Keystone boilerplate (email signature blocks from Keystone system)
- Strip "On [date], [name] wrote:" forward headers
- Return cleaned text, max 5000 chars

### checkThreadHasWorkItem(conn, threadId: string): boolean
```sql
SELECT wi.id FROM work_items wi
JOIN issue_email_link iel ON iel.work_item_id = wi.id
JOIN email_message em ON em.id = iel.email_message_id
WHERE em.gmail_thread_id = $1 LIMIT 1
```

### determineDirection(emailData: EmailData): string
- If from villasboulders.org AND to villasboulders.org → 'internal'
- If from villasboulders.org → 'outbound'
- Else → 'inbound'

### normalizeSubject(subject: string): string
- Strip `Re:`, `Fwd:`, `Fw:`, `RE:`, `FWD:` prefixes (case-insensitive, repeated)
- Trim whitespace

## Entry point (index.ts)

```typescript
async function main(): Promise<void> {
  const days = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '1', 10)
  const dryRun = process.argv.includes('--dry-run')
  const debug = process.argv.includes('--debug')

  // 1. Process retry queue first (if any)
  const queueItems = await getRetryQueue()
  if (queueItems.length > 0) {
    const stale = queueItems.filter(q => Date.now() - new Date(q.queued_at).getTime() > 3 * 86400000)
    if (stale.length > 0) {
      await sendAlert(`${stale.length} emails stuck in LLM retry queue`, `Stale items:\n${stale.map(s => `  ${s.subject} (queued ${s.queued_at})`).join('\n')}`)
    }
    console.log(`[INFO] Processing ${queueItems.length} queued emails from retry queue`)
  }

  // 2. Fetch emails from both mailboxes
  const [gmailEmails, imapEmails] = await Promise.all([
    fetchGmailEmails(days),
    fetchImapEmails(days),
  ])

  // 3. Process each email
  const allEmails = [...gmailEmails, ...imapEmails]
  const results = []
  for (const email of allEmails) {
    try {
      const result = await processEmail(email, { dryRun, debug })
      results.push(result)
    } catch (e) {
      console.error(`Error processing ${email.gmail_message_id}:`, e)
      results.push({ gmail_message_id: email.gmail_message_id, error: String(e) })
    }
  }

  // 4. Output JSON summary to stdout
  console.log(JSON.stringify({
    status: 'success',
    dry_run: dryRun,
    processed_count: results.length,
    run_at: new Date().toISOString(),
    results,
  }, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
```

## GitHub Actions workflow

```yaml
# .github/workflows/email-processor.yml
name: HOA Email Processor

on:
  schedule:
    # 5:55 AM MDT (11:55 UTC) daily
    - cron: '55 11 * * *'
  workflow_dispatch:

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - name: Run email processor
        env:
          GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          SMTP_PASS_JANE: ${{ secrets.SMTP_PASS_JANE }}
          GMAIL_IMAP_PASSWORD_MCDONDBUCKHOA: ${{ secrets.GMAIL_IMAP_PASSWORD_MCDONDBUCKHOA }}
        run: npx tsx packages/email-processor/src/index.ts --days=1
```

## Testing

- Run with `--dry-run` to process without DB writes
- Run with `--debug` for verbose stderr logging
- Compare output against oregano Python processor for same email batch
- The Python processor remains running on oregano until cutover is confirmed

## Dependencies (npm packages)

- `googleapis` — Gmail API
- `imapflow` — IMAP client
- `@supabase/supabase-js` — Supabase client
- `pg` — direct PostgreSQL for raw SQL (upserts, CHECK constraints)
- `nodemailer` — SMTP alert emails
- `tsx` — TypeScript execution (devDependency)
- `typescript` — type checking (devDependency)
- `@types/node` — Node types (devDependency)

## What NOT to do

- Don't read the Python `email_processor.py` — work from this spec
- Don't modify `hoa-tracker-dashboard/` — the dashboard is separate
- Don't modify `hoa-tracker/` — the Python code is reference only
- Don't add authentication or RLS — the dashboard is board-only via obscure URL
- Don't add new database tables (except `llm_retry_queue` if needed)
- Don't change the Supabase schema
- Don't commit secrets to the repo