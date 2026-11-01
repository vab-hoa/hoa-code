# HOA email processor

Decides what to do with each HOA email. The scheduled writer is this
package: the GitHub Actions workflow "Email processor" runs with `--write`.
The oregano cron for `hoa-tracker/email_processor.py` was removed on
2026-11-01. A local run writes only when invoked with `--write`.

## Disposition

| Value | Meaning | Write |
|---|---|---|
| `new_request` | A homeowner, or someone acting for a homeowner, is asking for work that is not already tracked. | Create one work item. Link the email as `origin`. |
| `update` | The message is about a work item already in the database. | Link the email. Add a note. Do not create an item. |
| `unrelated` | Not about one existing or new piece of work. | Store the email. No link. |
| `needs_review` | Unsure, or a new item was proposed while open work already matches. | Store the email and flag it. No link. |
| `system` | A template we do not ask the model about. | Store it. Status reports also write snapshot rows. |

Sender role is context. It does not decide the disposition.

## What never reaches the model

- Automated noise, our own `[HOA Tracker]` digests, invoice lockbox mail.
- Work-order status reports. Parsed into `wo_status_snapshot`. Not requests.
- Property reports, broken-link alerts, Keystone "new files" notices.
- ARC, work-order, and LBC/HPPR messages whose bodies contain the form fields.
  Replies that merely quote a form go to the model. A thread that already has
  a work item is an update, not a second item.
- A short subject that is a parcel plus APPROVED or DENIED. If exactly one
  open item of that category matches, set `decision` and `status`. That is
  the only status change this processor applies. Any other status wording is
  stored as a note.

## Model

Free-form mail uses the model named in `packages/email-processor/model.json`.
That file is the remembered choice for this processor only. Jane's models and
`hoa-tracker/email_processor.py` do not read it. To switch, edit `model` and
push. The next scheduled run uses the new value.

`OPENROUTER_MODEL`, when set in the environment, overrides that one run and
does not change the file. The workflow leaves it unset. The report and the
digest name the model and say whether it came from the file or from the
environment.

`reasoning_effort` and `max_tokens` in the same file travel with the model.
GLM 5.3 Flash needs `reasoning_effort` of `low`. A null effort omits the
field. The current choice is `anthropic/claude-sonnet-5.5` at medium effort.

The prompt includes the message and at most 15 candidates: the work item already
on this thread, an item whose WO number is in the text, and open items on the
extracted parcel. It does not include the rest of the database.

After the model:

- Confidence under 0.75, or an update that does not name a candidate, becomes
  `needs_review`.
- `new_request` while any candidate is open becomes `needs_review`, unless
  confidence is at least 0.9 and the reason quotes every candidate id.
- Free-form mail does not change `work_items.status`.

New items use category `work_order`, `arc_request`, `violation`, or `other`,
status `manager`, and `keystone_wo_number` null. Title shape is
`LastName - ParcelCode - short description`. The morning Keystone reconcile
attaches a WO number when the portal row shows up. This package does not
read the Keystone sheet.

`classification` stays filled with a legacy value so the existing check
constraint holds. `disposition` is the value that matters.

## Mailboxes

- `admin@villasboulders.org` via the service account (`GOOGLE_SERVICE_ACCOUNT_JSON`), Gmail readonly, subject `admin@`.
- `mcdonaldbuckhoa@gmail.com` via IMAP (`GMAIL_IMAP_PASSWORD_MCDONALDBUCKHOA`).

Message ids are the RFC Message-ID, matching the Python processor.
IMAP thread ids use the same `imap:` plus normalized-subject prefix.

## Run

```bash
npm run email-processor -- --dry-run --days 1
npm run email-processor -- --shadow --days 1 --out email-processor-report.json
npm test -w @vab-hoa/email-processor
```

`--reprocess` classifies messages already stored by the Python processor.
It is rejected together with `--write`.

`--shadow` and `--dry-run` read Supabase and call the model, then write a
report. They do not insert work items and they do not send mail. `--write`
persists, uploads attachments onto the linked work item, and emails the
digest from admin@villasboulders.org to dee@wmbuck.net. The scheduled workflow runs `--write`.

Apply `hoa-tracker/schema_email_disposition.sql` before the first `--write`.
If those columns are missing, the writer retries without them and says so.

`jane_inbound_handler.py` is unchanged.
