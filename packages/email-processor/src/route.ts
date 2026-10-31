import { hasArcFormFields, hasWoFormFields, isHpprForm, parseArcForm, parseWoForm } from './parse-forms.js'
import { parseWoStatusReport } from './parse-report.js'
import { extractParcel } from './parcel-extract.js'
import type { InboundEmail, WoSnapshotEntry, WorkCategory } from './types.js'

const NOISE_DOMAINS = [
  'noreply@google.com',
  'drive-shares-dm-noreply@google.com',
  'mailer-daemon',
  'namecheap.com',
  'github.com',
  'supabase.co',
  'anthropic.com',
  'jotform.com',
  'accounts.google.com',
  'notifications.google.com',
  'googlecloud@google.com',
  'gemini-notes@google.com',
  'googlephotos.com',
]

export type RouteHit =
  | {
      kind: 'system'
      classification: string
      isNoise: boolean
      reason: string
      snapshots: WoSnapshotEntry[]
    }
  | {
      kind: 'form'
      classification: 'arc_form_submission' | 'wo_form' | 'hppr_form'
      category: WorkCategory
      parcel: string | null
      homeownerName: string | null
      description: string
      reason: string
    }
  | {
      kind: 'approval'
      classification: 'arc_approval'
      decision: 'approved' | 'denied'
      category: WorkCategory
      parcel: string | null
      reason: string
    }
  | { kind: 'decide' }

function recipientsOf(email: InboundEmail): string {
  return [...email.to, ...email.cc].join(', ')
}

/**
 * Known templates only. Free-form mail, including homeowner requests and
 * board discussion, falls through to the model. Keywords are not used to
 * decide whether a message is a new request.
 */
export function routeEmail(email: InboundEmail): RouteHit {
  const subject = email.subject || ''
  const subjectLower = subject.toLowerCase()
  const sender = (email.fromEmail || '').toLowerCase()
  const body = email.bodyText || email.bodyHtml || ''
  const recipients = recipientsOf(email)

  if (subject.startsWith('[HOA Tracker]')) {
    return system('noise', true, 'processor digest')
  }
  if (!sender || NOISE_DOMAINS.some((d) => sender.includes(d))) {
    return system('noise', true, 'automated sender')
  }
  if (sender.includes('strongroomsolutions.com') || sender.includes('payableslockbox')) {
    return system('invoice_pending', false, 'invoice lockbox')
  }
  if (subjectLower.includes('work order status report') && sender.includes('villasboulders.org')) {
    const report = parseWoStatusReport(body)
    const reason = report.scrapeFailureSuspected
      ? 'work order status report (open count is 0)'
      : `work order status report (${report.entries.length} entries)`
    return { kind: 'system', classification: 'wo_status_report', isNoise: false, reason, snapshots: report.entries }
  }
  if (subjectLower.includes('your property report') || subjectLower.startsWith('board report request:')) {
    return system('property_report', false, 'property report')
  }
  if (
    subjectLower.includes('broken link') ||
    subjectLower.includes('new files in keystone portal') ||
    sender.includes('docs.google.com') ||
    sender.includes('comments-noreply')
  ) {
    return system('ops_alert', false, 'operational notice')
  }

  const decision = approvalWord(subject)
  const subjectParcel = extractParcel(subject)
  if (decision && subjectParcel && subject.length <= 120) {
    return {
      kind: 'approval',
      classification: 'arc_approval',
      decision,
      category: approvalCategory(subject, body),
      parcel: subjectParcel,
      reason: `${decision} reply for ${subjectParcel}`,
    }
  }

  const isReply = /^\s*re:/i.test(subject)
  if (hasArcFormFields(body) && !isReply) {
    const parsed = parseArcForm(body)
    return {
      kind: 'form',
      classification: 'arc_form_submission',
      category: 'arc_request',
      parcel: parsed.parcel,
      homeownerName: parsed.homeownerName,
      description: parsed.description || subject || 'ARC request',
      reason: 'ARC form fields',
    }
  }

  if (isHpprForm(subject, body, recipients) && !subjectLower.startsWith('re:')) {
    const parcel = extractParcel(`${subject}\n${body}`)
    return {
      kind: 'form',
      classification: 'hppr_form',
      category: 'work_order',
      parcel,
      homeownerName: null,
      description: subject || 'LBC request',
      reason: 'LBC/HPPR form',
    }
  }

  const woSender = sender.includes('workorders@villasboulders.org')
  const woNotice = subjectLower.includes('form submissions detected') && subjectLower.includes('work order')
  if ((woSender || woNotice || (hasWoFormFields(body) && !isReply)) && !subjectLower.includes('status report')) {
    const parsed = parseWoForm(body)
    return {
      kind: 'form',
      classification: 'wo_form',
      category: 'work_order',
      parcel: parsed.parcel || extractParcel(`${subject}\n${body}`),
      homeownerName: parsed.homeownerName,
      description: parsed.description || subject || 'Work order request',
      reason: woSender || woNotice ? 'work order form notification' : 'work order form fields',
    }
  }

  return { kind: 'decide' }
}

function system(classification: string, isNoise: boolean, reason: string): RouteHit {
  return { kind: 'system', classification, isNoise, reason, snapshots: [] }
}

function approvalWord(subject: string): 'approved' | 'denied' | null {
  if (/\bdenied\b/i.test(subject)) return 'denied'
  if (/\bapproved\b/i.test(subject)) return 'approved'
  return null
}

function approvalCategory(subject: string, body: string): WorkCategory {
  const blob = `${subject}\n${body.slice(0, 500)}`.toLowerCase()
  if (/lbc|hppr|planting/.test(blob) && !/\barc\b/i.test(subject)) return 'work_order'
  return 'arc_request'
}
