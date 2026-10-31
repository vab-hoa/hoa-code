import { extractParcel } from './parcel-extract.js'
import { stripHtml } from './text.js'

const ARC_LABELS = [
  'Name',
  'Unit Address in the Villas',
  'Phone Number',
  'Email',
  'Description of Improvements',
  'Supporting Documentation',
  'Planned (approximate) Completion Date',
  'Homeowner Signature',
  'Submission Date',
] as const

export interface ArcForm {
  homeownerName: string | null
  address: string | null
  parcel: string | null
  email: string | null
  description: string | null
}

export function hasArcFormFields(body: string): boolean {
  const text = stripHtml(body).toLowerCase()
  return text.includes('unit address in the villas') && text.includes('description of improvements')
}

export function parseArcForm(body: string): ArcForm {
  const text = stripHtml(body)
  const positions: { label: string; pos: number }[] = []
  for (const label of ARC_LABELS) {
    const start = positions.length ? positions[positions.length - 1].pos + positions[positions.length - 1].label.length : 0
    let idx = text.indexOf(label, start)
    if (idx === -1) idx = text.toLowerCase().indexOf(label.toLowerCase(), start)
    if (idx !== -1) positions.push({ label, pos: idx })
  }
  const result: ArcForm = { homeownerName: null, address: null, parcel: null, email: null, description: null }
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length
    const value = text.slice(p.pos + p.label.length, end).replace(/^(>\s*)+/, '').trim()
    if (p.label === 'Name') result.homeownerName = value
    else if (p.label === 'Unit Address in the Villas') {
      result.address = value
      result.parcel = extractParcel(value)
    } else if (p.label === 'Email') result.email = value
    else if (p.label === 'Description of Improvements') result.description = value
  }
  return result
}

const WO_LABELS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'address', label: 'Unit Address' },
  { key: 'email', label: 'Your' },
  { key: 'description', label: 'Briefly describe the work' },
  { key: 'attachments', label: 'Upload photos or files' },
  { key: 'work_type', label: 'Type of work' },
  { key: 'priority', label: 'Priority you would assign' },
]

export interface WoForm {
  homeownerName: string | null
  address: string | null
  parcel: string | null
  description: string | null
}

export function hasWoFormFields(body: string): boolean {
  return stripHtml(body).toLowerCase().includes('briefly describe the work')
}

export function parseWoForm(body: string): WoForm {
  const text = stripHtml(body)
  const result: WoForm = { homeownerName: null, address: null, parcel: null, description: null }
  for (const field of WO_LABELS) {
    let idx = text.indexOf(field.label)
    if (idx === -1) idx = text.toLowerCase().indexOf(field.label.toLowerCase())
    if (idx === -1) continue
    const valueStart = idx + field.label.length
    let valueEnd = text.length
    for (const other of WO_LABELS) {
      if (other.label === field.label) continue
      const next = text.indexOf(other.label, valueStart)
      if (next !== -1 && next < valueEnd) valueEnd = next
    }
    let value = text.slice(valueStart, valueEnd).replace(/^(>\s*)+/, '').trim()
    value = value.replace(/\s+/g, ' ')
    if (field.key === 'name') result.homeownerName = value
    else if (field.key === 'address') {
      result.address = value
      result.parcel = extractParcel(value)
    } else if (field.key === 'description') result.description = value
  }
  return result
}

export function isHpprForm(subject: string, body: string, recipients: string): boolean {
  const s = subject.toLowerCase()
  const b = body.toLowerCase()
  const r = recipients.toLowerCase()
  if (r.includes('lbcformrecipients@')) return true
  if (b.includes('homeowner paid planting') || b.includes('planting and removal')) return true
  if (s.includes('homeowner paid planting') || s.includes('planting and removal')) return true
  return false
}
