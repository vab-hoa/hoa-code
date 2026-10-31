import type { Candidate, ModelDecision } from './types.js'

export interface GatedDecision extends ModelDecision {
  needsReview: boolean
}

/**
 * The model proposes. These rules decide what is allowed to be written.
 * Free-form mail never changes work_items.status; a status suggestion is
 * kept on the decision and stored as a note by the writer.
 */
export function applyGates(decision: ModelDecision, candidates: Candidate[]): GatedDecision {
  if (decision.disposition === 'needs_review' || decision.confidence < 0.75) {
    return hold(decision, decision.confidence < 0.75
      ? `confidence ${decision.confidence} is below 0.75`
      : decision.reason || 'model asked for review')
  }

  if (decision.disposition === 'update') {
    const known = decision.workItemId && candidates.some((c) => c.id === decision.workItemId)
    if (!known) return hold(decision, 'update did not name one of the candidate work items')
    return { ...decision, needsReview: false }
  }

  if (decision.disposition === 'new_request' && candidates.length > 0) {
    const namesAll = candidates.every((c) => decision.reason.includes(c.id))
    if (decision.confidence >= 0.9 && namesAll) {
      return { ...decision, workItemId: null, needsReview: false }
    }
    return hold(decision, 'open work already exists for this message; not creating another item')
  }

  if (decision.disposition === 'new_request' || decision.disposition === 'unrelated') {
    return { ...decision, workItemId: null, needsReview: false }
  }

  return hold(decision, 'unrecognized disposition')
}

function hold(decision: ModelDecision, reason: string): GatedDecision {
  return {
    ...decision,
    disposition: 'needs_review',
    workItemId: null,
    needsReview: true,
    reason,
  }
}
