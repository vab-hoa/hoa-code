export function stripHtml(text: string, preserveNewlines = false): string {
  if (!text) return ''
  let out = text
  if (preserveNewlines) {
    out = out.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
  }
  out = out.replace(/<[^>]+>/g, preserveNewlines ? '' : ' ')
  out = out
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
  if (!preserveNewlines) out = out.replace(/\s+/g, ' ')
  return out.trim()
}

export function parseAddress(raw: string): { name: string; email: string } {
  if (!raw) return { name: '', email: '' }
  const m = raw.match(/^(.*?)\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim().replace(/^["']|["']$/g, ''), email: m[2].trim().toLowerCase() }
  if (raw.includes('@')) return { name: '', email: raw.trim().toLowerCase() }
  return { name: raw.trim(), email: '' }
}

export function extractAddresses(header: string): string[] {
  if (!header) return []
  const angled = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim().toLowerCase())
  if (angled.length) return angled
  return header
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.includes('@'))
}

/** Drop quoted replies and a trailing signature. Used as a work-item description. */
export function cleanBody(body: string): string {
  if (!body) return ''
  let text = body.replace(/\r\n/g, '\n')
  const cutters = [
    /\nOn .+ wrote:\n/i,
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\nFrom:\s.+\nSent:\s/i,
  ]
  for (const re of cutters) {
    const m = re.exec(text)
    if (m && m.index > 40) {
      text = text.slice(0, m.index)
      break
    }
  }
  const lines = text.split('\n').filter((line) => !line.trim().startsWith('>'))
  return lines.join('\n').trim().slice(0, 4000)
}

export function normalizeSubject(subject: string): string {
  let s = (subject || '').trim()
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/^(re|fwd|fw):\s*/i, '').trim()
  }
  return s
}

/** Same thread key the Python processor stored for the IMAP mailbox. */
export function imapThreadId(subject: string): string {
  return `imap:${normalizeSubject(subject).slice(0, 50)}`
}

export function preview(body: string, n = 240): string {
  return cleanBody(body).replace(/\s+/g, ' ').slice(0, n)
}

export function buildTitle(name: string, parcel: string | null, description: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const last = parts.length ? parts[parts.length - 1] : 'Homeowner'
  let short = description.replace(/\s+/g, ' ').trim() || 'Request'
  if (short.length > 50) short = short.slice(0, 47) + '...'
  return [last, parcel, short].filter(Boolean).join(' - ')
}

export function direction(fromEmail: string, recipients: string[]): string {
  const fromUs = fromEmail.toLowerCase().includes('villasboulders.org')
  const toUs = recipients.some((r) => r.toLowerCase().includes('villasboulders.org'))
  if (fromUs && toUs) return 'internal'
  if (fromUs) return 'outbound'
  return 'inbound'
}

const BOARD = new Set([
  'lavenderdjbhoa@gmail.com',
  'olearyhoa@gmail.com',
  'brookeom@aol.com',
  'tlmitchell482332@gmail.com',
  'bigtlmusa@yahoo.com',
  'phasslacher@msn.com',
  'kateandrewscouture@gmail.com',
  'nancyabenoit@yahoo.com',
])

/** Legacy classification string so the existing CHECK constraint still accepts the row. */
export function legacyClassification(args: {
  disposition: string
  category: string | null
  fromEmail: string
  routed: string | null
}): string {
  if (args.routed) return args.routed
  if (args.disposition === 'needs_review') return 'unclassified'
  if (args.disposition === 'update') return 'wo_followup'
  if (args.disposition === 'new_request') {
    if (args.category === 'arc_request') return 'arc_form_submission'
    return 'wo_homeowner'
  }
  const from = args.fromEmail.toLowerCase()
  if (from === 'hallj@keystonepacific.com') return 'josh_direct'
  if (BOARD.has(from)) return 'board_email'
  return 'homeowner_direct'
}
