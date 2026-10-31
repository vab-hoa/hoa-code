import { TERMINAL_NOTE } from './pipeline.js'
import { direction } from './text.js'
import type { Db } from './db.js'
import type { InboundAttachment, InboundEmail, Outcome } from './types.js'

const BUCKET = 'work-item-documents'
const MAX_BYTES = 10 * 1024 * 1024

export async function applyOutcome(
  db: Db,
  email: InboundEmail,
  outcome: Outcome,
  downloadGmail?: (providerId: string, attachmentId: string) => Promise<Buffer>,
): Promise<void> {
  if (outcome.alreadyProcessed) return

  const emailId = await upsertEmail(db, email, outcome)
  if (outcome.snapshots.length) await insertSnapshots(db, emailId, email.receivedDate, outcome)

  let workItemId = outcome.workItemId
  if (outcome.create) workItemId = await createWorkItem(db, email, outcome)

  if (workItemId && outcome.linkRole) {
    const role = outcome.applyDecision ? 'decision' : outcome.linkRole
    await linkEmail(db, workItemId, emailId, role, outcome)
  }
  if (workItemId && outcome.linkRole === 'update') await addNote(db, workItemId, outcome)
  if (workItemId && outcome.changesStatus && outcome.applyDecision) {
    await setDecision(db, workItemId, outcome.applyDecision)
  }
  if (workItemId && email.attachments.length) {
    await uploadAttachments(db, email, workItemId, downloadGmail)
  }
}

async function upsertEmail(db: Db, email: InboundEmail, outcome: Outcome): Promise<string> {
  const row: Record<string, unknown> = {
    gmail_message_id: email.gmailMessageId,
    gmail_thread_id: email.threadId,
    in_reply_to: email.inReplyTo,
    direction: direction(email.fromEmail, [...email.to, ...email.cc]),
    from_name: email.fromName,
    from_email: email.fromEmail,
    to_recipients: email.to,
    cc_recipients: email.cc,
    subject: email.subject,
    body_text: (email.bodyText || '').slice(0, 50000),
    body_html: email.bodyHtml ? email.bodyHtml.slice(0, 50000) : null,
    received_date: email.receivedDate,
    classification: outcome.classification,
    classification_confidence: outcome.confidence,
    is_noise: outcome.isNoise,
    parse_payload: {
      disposition: outcome.disposition,
      reason: outcome.reason,
      parcel: outcome.parcel,
    },
    processed_at: new Date().toISOString(),
    disposition: outcome.disposition,
    disposition_reason: outcome.reason,
    needs_review: outcome.needsReview,
  }
  let res = await db.from('email_message').upsert(row, { onConflict: 'gmail_message_id' }).select('id').single()
  if (res.error && /disposition|needs_review/.test(res.error.message)) {
    console.error('disposition columns are missing; apply hoa-tracker/schema_email_disposition.sql')
    delete row.disposition
    delete row.disposition_reason
    delete row.needs_review
    res = await db.from('email_message').upsert(row, { onConflict: 'gmail_message_id' }).select('id').single()
  }
  if (res.error || !res.data) throw new Error(res.error?.message || 'email upsert returned no id')
  return res.data.id as string
}

async function createWorkItem(db: Db, email: InboundEmail, outcome: Outcome): Promise<string> {
  let propertyId: string | null = null
  if (outcome.parcel) {
    const { data, error } = await db.from('properties').select('id').eq('parcel_code', outcome.parcel).maybeSingle()
    if (error) throw new Error(error.message)
    propertyId = (data?.id as string) ?? null
  }
  const { data: doc, error: docError } = await db.from('source_documents').insert({
    property_id: propertyId,
    doc_type: 'email',
    source_ref: email.gmailMessageId,
    subject: email.subject,
    body_text: (outcome.description || email.bodyText || '').slice(0, 5000),
    from_name: email.fromName,
    from_email: email.fromEmail,
    received_date: email.receivedDate,
    gmail_thread_id: email.threadId,
  }).select('id').single()
  if (docError) throw new Error(docError.message)

  const { data, error } = await db.from('work_items').insert({
    source_document_id: doc?.id ?? null,
    property_id: propertyId,
    title: outcome.title || email.subject || 'Request',
    description: outcome.description || '',
    category: outcome.category || 'work_order',
    status: 'manager',
    priority: 'normal',
  }).select('id').single()
  if (error || !data) throw new Error(error?.message || 'work item insert returned no id')
  return data.id as string
}

async function linkEmail(
  db: Db,
  workItemId: string,
  emailId: string,
  role: string,
  outcome: Outcome,
): Promise<void> {
  const { data: existing, error: findError } = await db
    .from('issue_email_link')
    .select('id')
    .eq('work_item_id', workItemId)
    .eq('email_message_id', emailId)
    .maybeSingle()
  if (findError) throw new Error(findError.message)
  if (existing) return
  const { error } = await db.from('issue_email_link').insert({
    work_item_id: workItemId,
    email_message_id: emailId,
    role,
    match_method: outcome.matchMethod,
    match_confidence: outcome.confidence,
  })
  if (error) throw new Error(error.message)
}

async function addNote(db: Db, workItemId: string, outcome: Outcome): Promise<void> {
  const parts = [`Email: ${outcome.subject}`, outcome.reason]
  if (outcome.statusSuggestion) {
    parts.push(`Suggested status: ${outcome.statusSuggestion.status}. ${outcome.statusSuggestion.note}`.trim())
    parts.push(TERMINAL_NOTE)
  }
  const { error } = await db.from('work_item_notes').insert({
    work_item_id: workItemId,
    note_date: new Date().toISOString(),
    content: parts.filter(Boolean).join('\n'),
    source: 'email_processor',
  })
  if (error) throw new Error(error.message)
}

async function setDecision(db: Db, workItemId: string, decision: 'approved' | 'denied'): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await db.from('work_items').update({
    decision,
    decision_at: now,
    status: decision,
    status_changed_at: now,
    updated_date: now,
  }).eq('id', workItemId)
  if (error) throw new Error(error.message)
}

async function insertSnapshots(db: Db, emailId: string, received: string | null, outcome: Outcome): Promise<void> {
  for (const snap of outcome.snapshots) {
    const { data: dup, error: findError } = await db
      .from('wo_status_snapshot')
      .select('id')
      .eq('source_email_id', emailId)
      .eq('wo_number', snap.woNumber)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (dup) continue
    const { error } = await db.from('wo_status_snapshot').insert({
      source_email_id: emailId,
      snapshot_date: received,
      wo_number: snap.woNumber,
      parcel_code: snap.parcelCode,
      homeowner_name: snap.homeownerName,
      status_raw: snap.status,
      description: snap.description,
      vendor: snap.vendor,
      created_date_raw: snap.date,
    })
    if (error) throw new Error(error.message)
  }
}

async function uploadAttachments(
  db: Db,
  email: InboundEmail,
  workItemId: string,
  downloadGmail?: (providerId: string, attachmentId: string) => Promise<Buffer>,
): Promise<void> {
  for (const att of email.attachments) {
    try {
      const bytes = await attachmentBytes(email, att, downloadGmail)
      if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES) continue
      const safe = att.filename.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'attachment'
      const path = `${workItemId}/${safe}`
      const { error: upError } = await db.storage.from(BUCKET).upload(path, bytes, {
        contentType: att.mimeType || 'application/octet-stream',
        upsert: true,
      })
      if (upError) throw new Error(upError.message)
      const { error } = await db.from('work_item_documents').insert({
        work_item_id: workItemId,
        title: null,
        file_name: att.filename,
        storage_path: path,
        content_type: att.mimeType,
        file_size_bytes: bytes.length,
        uploaded_by: 'email_processor',
      })
      if (error) throw new Error(error.message)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`attachment ${att.filename} failed: ${message}`)
    }
  }
}

async function attachmentBytes(
  email: InboundEmail,
  att: InboundAttachment,
  downloadGmail?: (providerId: string, attachmentId: string) => Promise<Buffer>,
): Promise<Buffer | null> {
  if (att.content) return att.content
  if (att.attachmentId && downloadGmail) return downloadGmail(email.providerId, att.attachmentId)
  return null
}
