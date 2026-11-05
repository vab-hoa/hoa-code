import { NextResponse } from 'next/server'
import type { DirectoryContact, DirectoryPerson, PersonRole } from '@/lib/directory'
import { OWNER_ROLES, personName } from '@/lib/directory'
import { requireBoard } from '@/lib/require-board'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ContactRow = {
  kind: 'email' | 'phone'
  value: string | null
  label: string | null
  is_primary: boolean | null
}

type PersonRow = {
  id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  parcel_code: string | null
  property_id: string | null
  role: PersonRole
  labels: string[] | null
  raw_address: string | null
  street: string | null
  street_number: string | null
  unit: string | null
  inactive: boolean
  inactive_at: string | null
  source: string | null
  contacts: ContactRow[] | null
}

type PropertyRow = {
  id: string
  parcel_code: string | null
}

const ROLES = new Set<PersonRole>([
  'owner_occupant',
  'non_occupant_owner',
  'non_owner_occupant',
  'household_member',
])

function titleStreet(street: string): string {
  return street
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function fullAddress(row: PersonRow): string {
  const firstLine = (row.raw_address || '').split('\n').map((line) => line.trim()).find(Boolean)
  if (firstLine) return firstLine
  const street = row.street ? titleStreet(row.street) : ''
  const unit = row.unit ? ` #${row.unit}` : ''
  return [row.street_number, street].filter(Boolean).join(' ') + unit
}

function ordered(contacts: ContactRow[], kind: ContactRow['kind']): DirectoryContact[] {
  return contacts
    .filter((contact) => contact.kind === kind && contact.value)
    .map((contact) => ({
      kind,
      value: contact.value as string,
      label: contact.label,
      isPrimary: Boolean(contact.is_primary),
    }))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return a.value.localeCompare(b.value)
    })
}

export async function GET() {
  try {
    const access = await requireBoard()
    if (!access.ok) return access.response
    const supabase = access.supabase

    const [{ data: peopleRows, error: peopleErr }, { data: properties, error: propErr }] = await Promise.all([
      supabase
        .from('people')
        .select(`
          id, first_name, last_name, display_name, parcel_code, property_id,
          role, labels, raw_address, street, street_number, unit,
          inactive, inactive_at, source,
          contacts (kind, value, label, is_primary)
        `),
      supabase.from('properties').select('id, parcel_code'),
    ])

    if (peopleErr) {
      console.error('directory people:', peopleErr)
      return NextResponse.json({ error: peopleErr.message }, { status: 500 })
    }
    if (propErr) {
      console.error('directory properties:', propErr)
      return NextResponse.json({ error: propErr.message }, { status: 500 })
    }

    const byParcel = new Map<string, string>()
    for (const property of (properties || []) as PropertyRow[]) {
      if (property.parcel_code) byParcel.set(property.parcel_code.toUpperCase(), property.id)
    }

    const rows = (peopleRows || []) as PersonRow[]
    const ownersByParcel = new Map<string, string>()
    for (const [code, names] of ownerNames(rows)) ownersByParcel.set(code, names)

    const people: DirectoryPerson[] = rows
      .filter((row) => ROLES.has(row.role))
      .map((row) => {
        const contacts = row.contacts || []
        const emails = ordered(contacts, 'email')
        const phones = ordered(contacts, 'phone')
        const parcelCode = row.parcel_code
        const propertyId = row.property_id
          || (parcelCode ? byParcel.get(parcelCode.toUpperCase()) || null : null)
        return {
          id: row.id,
          street: row.street || '',
          streetNumber: row.street_number || '',
          unit: row.unit || '',
          fullAddress: fullAddress(row),
          lastName: row.last_name || '',
          firstName: row.first_name || '',
          role: row.role,
          inactive: Boolean(row.inactive),
          inactiveAt: row.inactive_at,
          labels: row.labels || [],
          contacts: [...emails, ...phones],
          email: emails[0]?.value || '',
          phone1: phones[0]?.value || '',
          phone2: phones[1]?.value || '',
          source: row.source || 'google_contacts',
          parcelCode,
          propertyId,
          officialOwner: parcelCode ? ownersByParcel.get(parcelCode.toUpperCase()) || null : null,
        }
      })
      .sort((a, b) => {
        const street = a.street.localeCompare(b.street)
        if (street) return street
        const number = a.streetNumber.padStart(6, '0').localeCompare(b.streetNumber.padStart(6, '0'))
        if (number) return number
        const unit = a.unit.padStart(4, '0').localeCompare(b.unit.padStart(4, '0'))
        if (unit) return unit
        if (a.inactive !== b.inactive) return a.inactive ? 1 : -1
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      })

    return NextResponse.json(
      { asOf: new Date().toISOString(), count: people.length, people },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('GET /api/directory:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function ownerNames(rows: PersonRow[]): Map<string, string> {
  const byParcel = new Map<string, PersonRow[]>()
  for (const row of rows) {
    if (!row.parcel_code || !OWNER_ROLES.includes(row.role)) continue
    const code = row.parcel_code.toUpperCase()
    const list = byParcel.get(code) || []
    list.push(row)
    byParcel.set(code, list)
  }
  const names = new Map<string, string>()
  for (const [code, owners] of byParcel) {
    const active = owners.filter((owner) => !owner.inactive)
    const shown = active.length ? active : owners
    names.set(code, shown.map((owner) => {
      const name = personName({
        firstName: owner.first_name || '',
        lastName: owner.last_name || '',
      }) || owner.display_name || 'Owner'
      return owner.inactive ? `${name} (inactive)` : name
    }).join(', '))
  }
  return names
}
