export type Disposition = 'new_request' | 'update' | 'unrelated' | 'needs_review' | 'system'

export type WorkCategory = 'work_order' | 'arc_request' | 'violation' | 'other'

export type MatchMethod = 'parcel_date' | 'wo_number' | 'thread' | 'manual'

export interface InboundAttachment {
  filename: string
  mimeType: string
  size: number
  /** Gmail API attachment id. Absent for IMAP. */
  attachmentId?: string
  /** Present for IMAP. Omitted from reports. */
  content?: Buffer
}

export interface InboundEmail {
  provider: 'gmail' | 'imap'
  /** Provider id. For Gmail this is the API message id, used to download attachments. */
  providerId: string
  gmailMessageId: string
  threadId: string | null
  inReplyTo: string | null
  fromName: string
  fromEmail: string
  to: string[]
  cc: string[]
  subject: string
  bodyText: string
  bodyHtml: string
  receivedDate: string | null
  mailbox: string
  attachments: InboundAttachment[]
}

export interface WoSnapshotEntry {
  woNumber: string
  parcelCode: string
  homeownerName: string
  date: string
  description: string | null
  vendor: string | null
  status: string
}

export interface Candidate {
  id: string
  title: string
  category: string
  status: string
  keystoneWoNumber: string | null
  description: string | null
  matchVia: 'thread' | 'wo_number' | 'parcel'
}

export interface ModelDecision {
  disposition: 'new_request' | 'update' | 'unrelated' | 'needs_review'
  workItemId: string | null
  category: WorkCategory | null
  parcel: string | null
  title: string | null
  summary: string
  confidence: number
  reason: string
  statusSuggestion: { status: string; note: string } | null
}

export interface Outcome {
  gmailMessageId: string
  subject: string
  from: string
  disposition: Disposition
  classification: string
  confidence: number
  reason: string
  isNoise: boolean
  needsReview: boolean
  parcel: string | null
  category: WorkCategory | null
  title: string | null
  description: string | null
  homeownerName: string | null
  workItemId: string | null
  create: boolean
  linkRole: 'origin' | 'update' | null
  matchMethod: MatchMethod
  applyDecision: 'approved' | 'denied' | null
  statusSuggestion: { status: string; note: string } | null
  /** True only for a deterministic ARC/LBC approval matched to one open item. */
  changesStatus: boolean
  snapshots: WoSnapshotEntry[]
  alreadyProcessed: boolean
  preview: string
}
