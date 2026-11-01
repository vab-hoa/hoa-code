import { normalizeStreetName, parcelCodeFromParts, streetCodeFor } from '@vab-hoa/shared'

/** Google Contacts label → people.role. First match in ROLE_PRIORITY wins. */
export const ROLE_LABELS: Record<string, Role> = {
  'owner-occupant': 'owner_occupant',
  'non-occupant owner': 'non_occupant_owner',
  'non-owner occupant': 'non_owner_occupant',
}

export const ROLE_PRIORITY: Role[] = [
  'owner_occupant',
  'non_occupant_owner',
  'non_owner_occupant',
]

export type Role =
  | 'owner_occupant'
  | 'non_occupant_owner'
  | 'non_owner_occupant'
  | 'household_member'

export interface AddressInput {
  formattedValue?: string | null
  streetAddress?: string | null
  extendedAddress?: string | null
}

export interface ParsedAddress {
  streetNumber: string
  /** Normalized street, e.g. "boulder circle". */
  street: string
  /** Unit as written ("101", "1"), not the parcel digit. */
  unit: string
  parcelCode: string
  raw: string
}

export interface ContactField {
  value?: string | null
  canonicalForm?: string | null
  type?: string | null
  formattedType?: string | null
  metadata?: { primary?: boolean | null } | null
}

export interface ContactValue {
  kind: 'email' | 'phone'
  value: string
  label: string | null
  isPrimary: boolean
}

export interface GooglePerson {
  resourceName?: string | null
  etag?: string | null
  names?: Array<{
    givenName?: string | null
    familyName?: string | null
    displayName?: string | null
    metadata?: { primary?: boolean | null } | null
  }> | null
  emailAddresses?: ContactField[] | null
  phoneNumbers?: ContactField[] | null
  addresses?: AddressInput[] | null
  memberships?: Array<{
    contactGroupMembership?: {
      contactGroupId?: string | null
      contactGroupResourceName?: string | null
    } | null
  }> | null
}

export interface ParsedPerson {
  googleResourceName: string
  googleEtag: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  parcelCode: string
  street: string
  streetNumber: string
  unit: string
  rawAddress: string | null
  role: Role
  labels: string[]
  contacts: ContactValue[]
}

export interface Classified {
  resourceName: string | null
  displayName: string
  person: ParsedPerson | null
  skipReason: 'no_resource' | 'no_hoa_address' | null
  /** Address lines that were present and did not parse to a parcel. */
  unparsedLines: string[]
}

const UNIT_RE = /(?:#|[Uu]nit\s*#?|[Aa]pt\.?\s*#?)\s*(\d+)/

/** Google system groups. groupType is not always SYSTEM, and they are not HOA labels. */
export const IGNORED_GROUPS = new Set([
  'all', 'blocked', 'chatbuddies', 'coworkers', 'family', 'friends', 'mycontacts', 'starred',
])

export function parseContactAddress(input: AddressInput): ParsedAddress | null {
  const candidates: string[] = []
  const street = (input.streetAddress || '').trim()
  const extra = (input.extendedAddress || '').trim()
  if (street) candidates.push(extra ? `${street} ${extra}` : street)
  const formatted = (input.formattedValue || '').trim()
  if (formatted) {
    const first = formatted.split(/\n/).map((line) => line.trim()).find(Boolean)
    if (first) candidates.push(first)
    candidates.push(formatted.replace(/\s*\n\s*/g, ' '))
  }
  for (const raw of candidates) {
    const parsed = parseAddressLine(raw)
    if (parsed) return parsed
  }
  return null
}

function parseAddressLine(raw: string): ParsedAddress | null {
  const line = raw.split('\n')[0].trim()
  const match = line.match(/^(\d{4,5})\s+(.*)$/)
  if (!match) return null
  const streetNumber = match[1]
  let rest = match[2]
  let unit = ''
  const unitMatch = rest.match(UNIT_RE)
  if (unitMatch && unitMatch.index !== undefined) {
    unit = unitMatch[1]
    rest = rest.slice(0, unitMatch.index)
  }
  rest = rest.split(',')[0].trim()
  const street = matchStreet(rest)
  if (!street) return null
  const parcelCode = parcelCodeFromParts(street, streetNumber, unit)
  if (!parcelCode) return null
  return { streetNumber, street, unit, parcelCode, raw: line }
}

function matchStreet(rest: string): string | null {
  const norm = normalizeStreetName(rest)
  if (!norm) return null
  if (streetCodeFor(norm)) return norm
  const words = norm.split(' ').filter(Boolean)
  for (let n = words.length; n >= 1; n--) {
    const candidate = words.slice(0, n).join(' ')
    if (streetCodeFor(candidate)) return candidate
  }
  return null
}

export function roleFromLabels(labels: string[]): Role {
  const found = new Set<Role>()
  for (const label of labels) {
    const role = ROLE_LABELS[label.trim().toLowerCase()]
    if (role) found.add(role)
  }
  for (const role of ROLE_PRIORITY) {
    if (found.has(role)) return role
  }
  return 'household_member'
}

/** Labels other than the three occupancy roles, de-duplicated, sorted. */
export function otherLabels(labels: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const label of labels) {
    const trimmed = label.trim()
    if (!trimmed) continue
    if (ROLE_LABELS[trimmed.toLowerCase()]) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return out
}

export function contactValues(kind: 'email' | 'phone', fields: ContactField[] | null | undefined): ContactValue[] {
  const out: ContactValue[] = []
  const seen = new Set<string>()
  for (const field of fields || []) {
    const raw = kind === 'phone' ? (field.canonicalForm || field.value || '') : (field.value || '')
    const value = kind === 'email' ? raw.trim().toLowerCase() : raw.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push({
      kind,
      value,
      label: (field.formattedType || field.type || '').trim() || null,
      isPrimary: Boolean(field.metadata?.primary),
    })
  }
  if (out.length && !out.some((item) => item.isPrimary)) out[0].isPrimary = true
  return out
}

function primaryName(person: GooglePerson) {
  const names = person.names || []
  return names.find((name) => name.metadata?.primary) || names[0]
}

export function addressLines(addresses: AddressInput[] | null | undefined): string[] {
  const lines: string[] = []
  for (const address of addresses || []) {
    const formatted = (address.formattedValue || '').trim()
    const street = (address.streetAddress || '').trim()
    const line = formatted.split('\n').map((part) => part.trim()).find(Boolean) || street
    if (line) lines.push(line)
  }
  return lines
}

/**
 * A contact with no HOA parcel is skipped (vendor, property manager, or a
 * non-HOA address). That is not an error. Occupancy labels with no parcel
 * are still skipped: the parcel is what ties a person to the tracker.
 */
export function classifyPerson(person: GooglePerson, groupNames: Map<string, string>): Classified {
  const name = primaryName(person)
  const displayName = (name?.displayName || [name?.givenName, name?.familyName].filter(Boolean).join(' ')).trim()
  const resourceName = person.resourceName?.trim() || null
  const lines = addressLines(person.addresses)
  if (!resourceName) {
    return { resourceName: null, displayName, person: null, skipReason: 'no_resource', unparsedLines: lines }
  }

  const labels: string[] = []
  for (const membership of person.memberships || []) {
    const group = membership.contactGroupMembership
    const resource = group?.contactGroupResourceName
      || (group?.contactGroupId ? `contactGroups/${group.contactGroupId}` : '')
    const label = resource ? groupNames.get(resource) : undefined
    if (label && !IGNORED_GROUPS.has(label.trim().toLowerCase())) labels.push(label)
  }

  let parsed: ParsedAddress | null = null
  let rawAddress: string | null = null
  const unparsed: string[] = []
  for (const address of person.addresses || []) {
    const match = parseContactAddress(address)
    const line = addressLines([address])[0]
    if (match && !parsed) {
      parsed = match
      rawAddress = (address.formattedValue || '').trim() || match.raw
    } else if (line) {
      unparsed.push(line)
    }
  }

  if (!parsed) {
    return { resourceName, displayName, person: null, skipReason: 'no_hoa_address', unparsedLines: unparsed.length ? unparsed : lines }
  }

  const contacts = [
    ...contactValues('email', person.emailAddresses),
    ...contactValues('phone', person.phoneNumbers),
  ]
  return {
    resourceName,
    displayName,
    skipReason: null,
    unparsedLines: unparsed,
    person: {
      googleResourceName: resourceName,
      googleEtag: person.etag?.trim() || null,
      firstName: name?.givenName?.trim() || null,
      lastName: name?.familyName?.trim() || null,
      displayName: displayName || null,
      parcelCode: parsed.parcelCode,
      street: parsed.street,
      streetNumber: parsed.streetNumber,
      unit: parsed.unit,
      rawAddress,
      role: roleFromLabels(labels),
      labels: otherLabels(labels),
      contacts,
    },
  }
}

/** An address line that looks like this neighborhood but did not parse. */
export function looksLikeHoaAddress(line: string): boolean {
  const norm = normalizeStreetName(line)
  if (/boulder|broadland|plaster|stone circle|rock point/.test(norm)) return true
  return /\b13[67]\d{3}\b/.test(line)
}
