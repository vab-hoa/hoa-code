import { applyGates } from './gates.js'
import { extractParcel } from './parcel-extract.js'
import { routeEmail } from './route.js'
import { buildTitle, cleanBody, legacyClassification, preview } from './text.js'
import type { Candidate, InboundEmail, ModelDecision, Outcome, WorkCategory } from './types.js'

export interface PipelineDeps {
  alreadyProcessed(gmailMessageId: string): Promise<boolean>
  loadCandidates(email: InboundEmail, parcel: string | null): Promise<Candidate[]>
  /** Null means the model call failed or returned nothing usable. */
  model(email: InboundEmail, candidates: Candidate[]): Promise<ModelDecision | null>
}

const TERMINAL_NOTE = 'Status was not changed. Suggestion recorded on the note only.'

export async function decideMessage(email: InboundEmail, deps: PipelineDeps): Promise<Outcome> {
  if (await deps.alreadyProcessed(email.gmailMessageId)) {
    return blank(email, {
      disposition: 'system',
      classification: 'unclassified',
      confidence: 1,
      reason: 'already processed',
      alreadyProcessed: true,
    })
  }

  const routed = routeEmail(email)
  const text = `${email.subject}\n${email.bodyText || ''}`
  const parcel = extractParcel(text)

  if (routed.kind === 'system') {
    return blank(email, {
      disposition: 'system',
      classification: routed.classification,
      confidence: 1,
      reason: routed.reason,
      isNoise: routed.isNoise,
      snapshots: routed.snapshots,
      parcel,
    })
  }

  const candidates = await deps.loadCandidates(email, routed.kind === 'decide' ? parcel : (routed.parcel || parcel))

  if (routed.kind === 'form') {
    const threadHit = candidates.find((c) => c.matchVia === 'thread')
    if (threadHit) {
      return blank(email, {
        disposition: 'update',
        classification: routed.classification,
        confidence: 0.95,
        reason: 'form reply on a thread that already has a work item',
        parcel: routed.parcel,
        category: routed.category,
        workItemId: threadHit.id,
        create: false,
        linkRole: 'update',
        matchMethod: 'thread',
        description: routed.description,
        homeownerName: routed.homeownerName,
      })
    }
    const name = routed.homeownerName || email.fromName
    return blank(email, {
      disposition: 'new_request',
      classification: routed.classification,
      confidence: 0.98,
      reason: routed.reason,
      parcel: routed.parcel,
      category: routed.category,
      title: buildTitle(name, routed.parcel, routed.description),
      description: cleanBody(routed.description),
      homeownerName: routed.homeownerName,
      create: true,
      linkRole: 'origin',
      matchMethod: routed.parcel ? 'parcel_date' : 'manual',
    })
  }

  if (routed.kind === 'approval') {
    const pool = candidates.filter((c) => c.category === routed.category || c.matchVia === 'thread')
    if (pool.length === 1) {
      return blank(email, {
        disposition: 'update',
        classification: 'arc_approval',
        confidence: 0.9,
        reason: routed.reason,
        parcel: routed.parcel,
        category: routed.category,
        workItemId: pool[0].id,
        create: false,
        linkRole: 'update',
        matchMethod: pool[0].matchVia === 'thread' ? 'thread' : 'parcel_date',
        applyDecision: routed.decision,
        changesStatus: true,
      })
    }
    return blank(email, {
      disposition: 'needs_review',
      classification: 'unclassified',
      confidence: 0.5,
      reason: pool.length === 0
        ? `approval for ${routed.parcel ?? 'unknown parcel'} matched no open item`
        : `approval for ${routed.parcel} matched ${pool.length} open items`,
      needsReview: true,
      parcel: routed.parcel,
      category: routed.category,
    })
  }

  let raw: ModelDecision | null = null
  try {
    raw = await deps.model(email, candidates)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return blank(email, {
      disposition: 'needs_review',
      classification: 'unclassified',
      confidence: 0,
      reason: `model unavailable: ${message}`,
      needsReview: true,
      parcel,
    })
  }
  if (!raw) {
    return blank(email, {
      disposition: 'needs_review',
      classification: 'unclassified',
      confidence: 0,
      reason: 'model returned nothing usable',
      needsReview: true,
      parcel,
    })
  }

  const gated = applyGates(raw, candidates)
  const category = (gated.category || 'work_order') as WorkCategory
  // The address extractor owns the parcel code. A prose parcel from the
  // model must not replace 13721PP1 with "13721 Plaster Pt. Unit 101".
  const usedParcel = parcel || asParcelCode(gated.parcel)
  const description = gated.summary || cleanBody(email.bodyText || email.subject)
  const creating = gated.disposition === 'new_request'
  const updating = gated.disposition === 'update'
  const via = candidates.find((c) => c.id === gated.workItemId)?.matchVia
  return blank(email, {
    disposition: gated.disposition,
    classification: legacyClassification({
      disposition: gated.disposition,
      category,
      fromEmail: email.fromEmail,
      routed: null,
    }),
    confidence: gated.confidence,
    reason: gated.reason,
    needsReview: gated.needsReview,
    parcel: usedParcel,
    category: creating || updating ? category : null,
    title: creating ? buildTitle(email.fromName, usedParcel, gated.title || email.subject || description) : null,
    description: creating || updating ? description : null,
    workItemId: updating ? gated.workItemId : null,
    create: creating,
    linkRole: creating ? 'origin' : updating ? 'update' : null,
    matchMethod: via === 'wo_number' ? 'wo_number' : via === 'thread' ? 'thread' : usedParcel ? 'parcel_date' : 'manual',
    statusSuggestion: gated.statusSuggestion,
    changesStatus: false,
  })
}

function asParcelCode(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4,5}[A-Z]{2}[12]?$/i.test(trimmed)) return trimmed.toUpperCase()
  return extractParcel(trimmed)
}

function blank(email: InboundEmail, over: Partial<Outcome>): Outcome {
  return {
    gmailMessageId: email.gmailMessageId,
    subject: email.subject,
    from: email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail,
    disposition: 'unrelated',
    classification: 'unclassified',
    confidence: 0,
    reason: '',
    isNoise: false,
    needsReview: false,
    parcel: null,
    category: null,
    title: null,
    description: null,
    homeownerName: null,
    workItemId: null,
    create: false,
    linkRole: null,
    matchMethod: 'manual',
    applyDecision: null,
    statusSuggestion: null,
    changesStatus: false,
    snapshots: [],
    alreadyProcessed: false,
    preview: preview(email.bodyText || email.bodyHtml || ''),
    ...over,
  }
}

export { TERMINAL_NOTE }
