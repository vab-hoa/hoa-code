import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPrompt, parseModelJson } from './decide.js'
import { buildDigest } from './digest.js'
import { applyGates } from './gates.js'
import { extractParcel } from './parcel-extract.js'
import { parseWoStatusReport } from './parse-report.js'
import { decideMessage, type PipelineDeps } from './pipeline.js'
import { routeEmail } from './route.js'
import type { Candidate, InboundEmail, ModelDecision } from './types.js'

const KATE_ITEM = '713bf4ea-0000-4000-8000-000000000001'

function email(over: Partial<InboundEmail>): InboundEmail {
  return {
    provider: 'gmail',
    providerId: 'p1',
    gmailMessageId: over.gmailMessageId || 'msg-1',
    threadId: 'thread-1',
    inReplyTo: null,
    fromName: 'Robin Tempas',
    fromEmail: 'robin@example.com',
    to: ['admin@villasboulders.org'],
    cc: [],
    subject: '',
    bodyText: '',
    bodyHtml: '',
    receivedDate: '2026-10-06T15:00:00.000Z',
    mailbox: 'admin@villasboulders.org',
    attachments: [],
    ...over,
  }
}

function model(decision: ModelDecision): PipelineDeps['model'] {
  return async () => decision
}

function deps(over: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    alreadyProcessed: async () => false,
    loadCandidates: async () => [],
    model: async () => null,
    ...over,
  }
}

function decision(over: Partial<ModelDecision>): ModelDecision {
  return {
    disposition: 'new_request',
    workItemId: null,
    category: 'work_order',
    parcel: null,
    title: 'Leaking sprinkler heads',
    summary: 'Sprinkler heads are leaking.',
    confidence: 0.92,
    reason: 'Homeowner is reporting a maintenance problem at the unit.',
    statusSuggestion: null,
    ...over,
  }
}

test('parcel codes cover unit-before-street and 4-digit Broadlands', () => {
  assert.equal(extractParcel('13723 #102 Plaster Point'), '13723PP2')
  assert.equal(extractParcel('3510 Broadlands Lane, Unit 102'), '3510BL2')
  assert.equal(extractParcel('13705 Stone Circle 101 APPROVED'), '13705SC1')
  assert.equal(extractParcel('already 13668BP1 in the sheet'), '13668BP1')
})

test('free-form maintenance mail is not keyword-routed', () => {
  const hit = routeEmail(email({
    subject: 'Leaking sprinkler heads',
    bodyText: 'The heads at 13723 #102 Plaster Point will not shut off.',
  }))
  assert.equal(hit.kind, 'decide')
})

test('ARC form fields are a new arc request and do not call the model', async () => {
  const body = [
    'Name',
    'Ada Hoellerbauer',
    'Unit Address in the Villas',
    '13705 Stone Circle #101',
    'Phone Number',
    '303-555-0100',
    'Email',
    'ada@example.com',
    'Description of Improvements',
    'Replace the front windows',
    'Supporting Documentation',
    'none',
  ].join('\n')
  const item = email({ subject: 'VaB ARC Request', bodyText: body, fromName: 'ARC Form', fromEmail: 'admin@villasboulders.org' })
  assert.equal(routeEmail(item).kind, 'form')
  let called = false
  const outcome = await decideMessage(item, deps({
    model: async () => { called = true; return null },
  }))
  assert.equal(called, false)
  assert.equal(outcome.disposition, 'new_request')
  assert.equal(outcome.category, 'arc_request')
  assert.equal(outcome.classification, 'arc_form_submission')
  assert.equal(outcome.parcel, '13705SC1')
  assert.equal(outcome.create, true)
  assert.match(outcome.title || '', /Hoellerbauer - 13705SC1/)
})

test('approval reply updates the one open ARC item and sets the decision', async () => {
  const item = email({
    subject: '13705 Stone Circle 101 APPROVED',
    fromName: 'Nancy Benoit',
    fromEmail: 'nancyabenoit@yahoo.com',
    bodyText: 'Approved as submitted.',
  })
  const candidate: Candidate = {
    id: 'arc-1',
    title: 'Hoellerbauer - 13705SC1 - windows',
    category: 'arc_request',
    status: 'arc',
    keystoneWoNumber: null,
    description: 'Replace the front windows',
    matchVia: 'parcel',
  }
  const outcome = await decideMessage(item, deps({
    loadCandidates: async () => [candidate],
    model: async () => { throw new Error('model should not run') },
  }))
  assert.equal(outcome.disposition, 'update')
  assert.equal(outcome.workItemId, 'arc-1')
  assert.equal(outcome.applyDecision, 'approved')
  assert.equal(outcome.changesStatus, true)
  assert.equal(outcome.create, false)
})

test('approval with two open items waits for a person', async () => {
  const item = email({ subject: '13705 Stone Circle 101 APPROVED', bodyText: 'Approved.' })
  const one = (id: string): Candidate => ({
    id, title: id, category: 'arc_request', status: 'arc', keystoneWoNumber: null, description: null, matchVia: 'parcel',
  })
  const outcome = await decideMessage(item, deps({ loadCandidates: async () => [one('a'), one('b')] }))
  assert.equal(outcome.disposition, 'needs_review')
  assert.equal(outcome.create, false)
  assert.equal(outcome.changesStatus, false)
})

test('work order status report stores snapshots and creates nothing', async () => {
  const body = [
    'Open work orders: 1',
    'OPEN (1)',
    'WO#99326  13668BP1  Kim Gilbert  [7/20/2026]',
    'Leaking sprinkler',
  ].join('\n')
  const parsed = parseWoStatusReport(body)
  assert.equal(parsed.entries.length, 1)
  assert.equal(parsed.entries[0].woNumber, '99326')
  const item = email({
    subject: 'Work Order Status Report',
    fromEmail: 'admin@villasboulders.org',
    bodyText: body,
  })
  const outcome = await decideMessage(item, deps({
    model: async () => { throw new Error('model should not run') },
  }))
  assert.equal(outcome.disposition, 'system')
  assert.equal(outcome.classification, 'wo_status_report')
  assert.equal(outcome.snapshots.length, 1)
  assert.equal(outcome.create, false)
})

test('Tempas sprinkler mail becomes one new request when nothing is open', async () => {
  const item = email({
    gmailMessageId: 'tempas-1',
    subject: 'Leaking sprinkler heads',
    bodyText: 'Please fix the leaking sprinkler heads at 13723 #102 Plaster Point.',
  })
  const outcome = await decideMessage(item, deps({
    model: model(decision({ parcel: '13723 Plaster Pt. Unit 102' })),
  }))
  assert.equal(outcome.disposition, 'new_request')
  assert.equal(outcome.create, true)
  assert.equal(outcome.parcel, '13723PP2')
  assert.match(outcome.title || '', /13723PP2/)
  assert.equal(outcome.category, 'work_order')
  assert.equal(outcome.changesStatus, false)
})

test('Hoellerbauer roof leak from a homeowner is a new request', async () => {
  const item = email({
    fromName: 'Ada Hoellerbauer',
    fromEmail: 'ada@example.com',
    subject: 'Roof leak',
    bodyText: 'Water is coming in at 13705 Stone Circle Unit 101 after the storm.',
  })
  const outcome = await decideMessage(item, deps({
    model: model(decision({ title: 'Roof leak', summary: 'Roof is leaking.', category: 'work_order' })),
  }))
  assert.equal(outcome.disposition, 'new_request')
  assert.match(outcome.title || '', /Hoellerbauer - 13705SC1 - Roof leak/)
})

test('Kate irrigation reply links the open item and does not resolve it', async () => {
  const item = email({
    fromName: 'Kate Couture',
    fromEmail: 'kateandrewscouture@gmail.com',
    subject: 'Re: Front yard irrigation, 3510 Broadlands Lane Unit 102',
    bodyText: 'We will monitor the situation and verify that it is running.',
  })
  const candidate: Candidate = {
    id: KATE_ITEM,
    title: 'Marcantonio - 3510BL2 - Front sprinklers',
    category: 'work_order',
    status: 'lbc',
    keystoneWoNumber: null,
    description: 'Front sprinklers inoperative',
    matchVia: 'parcel',
  }
  const outcome = await decideMessage(item, deps({
    loadCandidates: async () => [candidate],
    model: model(decision({
      disposition: 'update',
      workItemId: KATE_ITEM,
      confidence: 0.88,
      reason: 'Board follow-up on the open sprinkler item.',
      statusSuggestion: { status: 'resolved', note: 'monitor language' },
    })),
  }))
  assert.equal(outcome.disposition, 'update')
  assert.equal(outcome.workItemId, KATE_ITEM)
  assert.equal(outcome.create, false)
  assert.equal(outcome.changesStatus, false)
  assert.equal(outcome.statusSuggestion?.status, 'resolved')
})

test('board coordination is unrelated and creates nothing', async () => {
  const item = email({
    fromName: 'Deborah Lavender',
    fromEmail: 'lavenderdjbhoa@gmail.com',
    subject: 'Mudjacking logistics',
    bodyText: 'Can the volunteers meet Thursday to walk the courts? Not a request for one unit.',
  })
  const outcome = await decideMessage(item, deps({
    model: model(decision({
      disposition: 'unrelated',
      category: null,
      title: null,
      confidence: 0.9,
      summary: '',
      reason: 'Board members are coordinating a community project.',
    })),
  }))
  assert.equal(outcome.disposition, 'unrelated')
  assert.equal(outcome.create, false)
  assert.equal(outcome.workItemId, null)
  assert.equal(outcome.classification, 'board_email')
})

test('a new request is held when an open item already sits on that parcel', () => {
  const candidate: Candidate = {
    id: KATE_ITEM,
    title: 'Open sprinkler',
    category: 'work_order',
    status: 'manager',
    keystoneWoNumber: null,
    description: null,
    matchVia: 'parcel',
  }
  const held = applyGates(decision({ confidence: 0.8, reason: 'Looks new.' }), [candidate])
  assert.equal(held.disposition, 'needs_review')
  assert.equal(held.needsReview, true)

  const allowed = applyGates(decision({
    confidence: 0.95,
    reason: `Not the same job as ${KATE_ITEM}; this is a roof leak.`,
  }), [candidate])
  assert.equal(allowed.disposition, 'new_request')
})

test('an update that names an unknown id is held', () => {
  const held = applyGates(decision({
    disposition: 'update',
    workItemId: 'not-a-candidate',
    confidence: 0.99,
    reason: 'follow up',
  }), [])
  assert.equal(held.disposition, 'needs_review')
})

test('the same message id is not decided twice', async () => {
  let called = false
  const outcome = await decideMessage(email({ gmailMessageId: 'dup-1' }), deps({
    alreadyProcessed: async () => true,
    model: async () => { called = true; return null },
  }))
  assert.equal(outcome.alreadyProcessed, true)
  assert.equal(outcome.create, false)
  assert.equal(called, false)
})

test('model JSON may be wrapped in a fence', () => {
  const parsed = parseModelJson('```json\n{"disposition":"unrelated","confidence":0.8,"reason":"newsletter"}\n```')
  assert.equal(parsed?.disposition, 'unrelated')
  assert.equal(parseModelJson('not json'), null)
})

test('the prompt shows candidate ids and the three dispositions', () => {
  const prompt = buildPrompt(email({ subject: 'Hello', bodyText: 'Body' }), [{
    id: KATE_ITEM,
    title: 'Sprinklers',
    category: 'work_order',
    status: 'manager',
    keystoneWoNumber: '1001',
    description: 'dead lawn',
    matchVia: 'parcel',
  }])
  assert.match(prompt, /new_request/)
  assert.match(prompt, /unrelated/)
  assert.match(prompt, new RegExp(KATE_ITEM))
  assert.match(prompt, /do not treat "we will monitor" as resolved/i)
})

test('digest lists needs-review subjects', () => {
  const text = buildDigest([
    {
      ...emptyOutcome(),
      disposition: 'needs_review',
      needsReview: true,
      subject: 'Mystery leak',
      from: 'Ada <ada@example.com>',
      reason: 'two possible items',
    },
  ])
  assert.match(text, /needs review: 1/)
  assert.match(text, /Mystery leak/)
})

function emptyOutcome() {
  return {
    gmailMessageId: 'x',
    subject: '',
    from: '',
    disposition: 'unrelated' as const,
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
    matchMethod: 'manual' as const,
    applyDecision: null,
    statusSuggestion: null,
    changesStatus: false,
    snapshots: [],
    alreadyProcessed: false,
    preview: '',
  }
}
