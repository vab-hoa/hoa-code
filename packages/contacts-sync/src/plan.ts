import type { Classified, ParsedPerson, Role } from './parse.js'

export interface ExistingPerson {
  googleResourceName: string
  inactive: boolean
}

export interface PropertyRef {
  id: string
  parcelCode: string
}

export interface SyncPlan {
  upserts: ParsedPerson[]
  /** Resource names that were active and are absent from this fetch. */
  markInactive: string[]
  /** Resource names in upserts that are currently inactive. */
  reactivate: string[]
  skipped: number
}

export interface Coverage {
  parcelsInTracker: number
  parcelsWithPerson: number
  parcelsWithNoPerson: string[]
  parcelsNotInTracker: string[]
}

export function planSync(classified: Classified[], existing: ExistingPerson[]): SyncPlan {
  const byResource = new Map<string, ParsedPerson>()
  for (const item of classified) {
    if (item.person) byResource.set(item.person.googleResourceName, item.person)
  }
  const upserts = [...byResource.values()]
  const seen = new Set(upserts.map((person) => person.googleResourceName))
  const inactiveNow = new Set(
    existing.filter((row) => row.inactive).map((row) => row.googleResourceName),
  )
  const markInactive = existing
    .filter((row) => row.googleResourceName && !seen.has(row.googleResourceName) && !row.inactive)
    .map((row) => row.googleResourceName)
    .sort()
  const reactivate = upserts
    .map((person) => person.googleResourceName)
    .filter((name) => inactiveNow.has(name))
    .sort()
  return {
    upserts,
    markInactive,
    reactivate,
    skipped: classified.length - upserts.length,
  }
}

/**
 * Keystone stored 13678 Boulder Point unit 101 as 13678BP, with no trailing 1.
 * Every other parcel ends in 1 or 2. When the parsed code is missing and the
 * same code without a trailing 1 exists, use that property.
 */
export function linkParcel(
  parsed: string,
  properties: PropertyRef[],
): { parcelCode: string; propertyId: string | null } {
  const known = new Map(properties.map((property) => [property.parcelCode.toUpperCase(), property]))
  const exact = known.get(parsed.toUpperCase())
  if (exact) return { parcelCode: exact.parcelCode, propertyId: exact.id }
  if (parsed.toUpperCase().endsWith('1')) {
    const bare = known.get(parsed.toUpperCase().slice(0, -1))
    if (bare) return { parcelCode: bare.parcelCode, propertyId: bare.id }
  }
  return { parcelCode: parsed, propertyId: null }
}

export function coverage(upserts: ParsedPerson[], properties: PropertyRef[]): Coverage {
  const covered = new Set<string>()
  const unknown = new Set<string>()
  for (const person of upserts) {
    const link = linkParcel(person.parcelCode, properties)
    if (link.propertyId) covered.add(link.parcelCode)
    else unknown.add(person.parcelCode)
  }
  const parcelsWithNoPerson = properties
    .map((property) => property.parcelCode)
    .filter((code) => !covered.has(code))
    .sort()
  return {
    parcelsInTracker: properties.length,
    parcelsWithPerson: covered.size,
    parcelsWithNoPerson,
    parcelsNotInTracker: [...unknown].sort(),
  }
}

export function countByRole(upserts: ParsedPerson[]): Record<Role, number> {
  const counts: Record<Role, number> = {
    owner_occupant: 0,
    non_occupant_owner: 0,
    non_owner_occupant: 0,
    household_member: 0,
  }
  for (const person of upserts) counts[person.role] += 1
  return counts
}
