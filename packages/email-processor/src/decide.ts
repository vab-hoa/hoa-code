import { loadEmailModel } from './model-config.js'
import type { Candidate, InboundEmail, ModelDecision, WorkCategory } from './types.js'
import { cleanBody } from './text.js'

const CATEGORIES = new Set<WorkCategory>(['work_order', 'arc_request', 'violation', 'other'])

export function buildPrompt(email: InboundEmail, candidates: Candidate[]): string {
  const candidateText = candidates.length
    ? candidates.map((c) =>
      `- id ${c.id} | ${c.category} | ${c.status} | WO ${c.keystoneWoNumber ?? 'none'} | via ${c.matchVia} | ${c.title} | ${(c.description || '').slice(0, 160)}`,
    ).join('\n')
    : '(none)'

  return `You triage email for the Villas at the Boulders HOA tracker.

Decide exactly one disposition:
- new_request: a homeowner, or a staff member or board member acting for a homeowner, is asking for work that is not already one of the candidate items. ARC, landscape (LBC), and ordinary maintenance all count.
- update: this message is about one of the candidate work items. Name that item's id.
- unrelated: board, vendor, or community mail that is not a request for one property and is not about a candidate item. Coordination among board members about a community project is unrelated even if a parcel is mentioned in passing.
- needs_review: you cannot tell.

A homeowner can send unrelated mail. Josh, a board member, or admin@ can file a new request on a homeowner's behalf. Do not invent a work item id. If you choose new_request while candidates are listed, your reason must quote every candidate id you are rejecting.

Status changes are advisory only. Put one in status_suggestion when the email clearly approves, denies, or closes the item. Use null otherwise. Do not treat "we will monitor" as resolved.

From: ${email.fromName} <${email.fromEmail}>
To: ${email.to.join(', ') || '(none)'}
Cc: ${email.cc.join(', ') || '(none)'}
Subject: ${email.subject || '(none)'}
Date: ${email.receivedDate || '(unknown)'}

Open candidates already in the tracker:
${candidateText}

Body:
${cleanBody(email.bodyText || email.bodyHtml || '').slice(0, 3500)}

Reply with JSON only:
{"disposition":"new_request|update|unrelated|needs_review","work_item_id":null,"category":"work_order|arc_request|violation|other|null","parcel":null,"title":null,"summary":"one sentence","confidence":0.0,"reason":"one sentence","status_suggestion":null}`
}

export function parseModelJson(content: string): ModelDecision | null {
  let text = content.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const disposition = o.disposition
  if (
    disposition !== 'new_request' &&
    disposition !== 'update' &&
    disposition !== 'unrelated' &&
    disposition !== 'needs_review'
  ) return null
  const confidence = typeof o.confidence === 'number' ? o.confidence : Number(o.confidence)
  if (!Number.isFinite(confidence)) return null
  const categoryRaw = o.category
  const category = typeof categoryRaw === 'string' && CATEGORIES.has(categoryRaw as WorkCategory)
    ? categoryRaw as WorkCategory
    : null
  let statusSuggestion: ModelDecision['statusSuggestion'] = null
  if (o.status_suggestion && typeof o.status_suggestion === 'object') {
    const s = o.status_suggestion as Record<string, unknown>
    if (typeof s.status === 'string' && s.status.trim()) {
      statusSuggestion = {
        status: s.status.trim(),
        note: typeof s.note === 'string' ? s.note : '',
      }
    }
  }
  return {
    disposition,
    workItemId: typeof o.work_item_id === 'string' && o.work_item_id ? o.work_item_id : null,
    category,
    parcel: typeof o.parcel === 'string' && o.parcel ? o.parcel : null,
    title: typeof o.title === 'string' && o.title ? o.title : null,
    summary: typeof o.summary === 'string' ? o.summary : '',
    confidence,
    reason: typeof o.reason === 'string' ? o.reason : '',
    statusSuggestion,
  }
}

export async function callModel(email: InboundEmail, candidates: Candidate[]): Promise<ModelDecision | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is required')
  const choice = loadEmailModel()
  const body: Record<string, unknown> = {
    model: choice.model,
    temperature: 0.1,
    max_tokens: choice.maxTokens,
    messages: [{ role: 'user', content: buildPrompt(email, candidates) }],
  }
  // Some models spend a mandatory reasoning budget before the JSON.
  // The effort lives in model.json so a switch does not inherit GLM Flash's setting.
  if (choice.reasoningEffort) body.reasoning = { effort: choice.reasoningEffort }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json() as {
    choices?: { finish_reason?: string; message?: { content?: unknown; reasoning?: string } }[]
  }
  const reply = json.choices?.[0]
  const message = reply?.message
  const content = textOf(message?.content) || textOf(message?.reasoning)
  const parsed = parseModelJson(content)
  if (!parsed) {
    const why = reply?.finish_reason === 'length' ? 'truncated' : 'unparsed'
    throw new Error(`model reply ${why}`)
  }
  return parsed
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (typeof part === 'string') return part
    if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
    return ''
  }).join('')
}
