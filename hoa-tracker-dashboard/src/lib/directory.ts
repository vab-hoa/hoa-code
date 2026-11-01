/** Directory rows from people + contacts. */

export type PersonRole =
  | 'owner_occupant'
  | 'non_occupant_owner'
  | 'non_owner_occupant'
  | 'household_member'

export type DirectoryContact = {
  kind: 'email' | 'phone'
  value: string
  label: string | null
  isPrimary: boolean
}

export type DirectoryPerson = {
  id: string
  street: string
  streetNumber: string
  unit: string
  fullAddress: string
  lastName: string
  firstName: string
  role: PersonRole
  inactive: boolean
  inactiveAt: string | null
  labels: string[]
  contacts: DirectoryContact[]
  /** Primary email, used for sorting. */
  email: string
  phone1: string
  phone2: string
  source: string
  parcelCode: string | null
  propertyId: string | null
  /** Names of the owner-role people on this parcel. */
  officialOwner: string | null
}

export type DirectoryResponse = {
  asOf: string
  count: number
  people: DirectoryPerson[]
  error?: string
}

export const ROLE_LABEL: Record<PersonRole, string> = {
  owner_occupant: 'Owner-occupant',
  non_occupant_owner: 'Non-occupant owner',
  non_owner_occupant: 'Non-owner occupant',
  household_member: 'Household',
}

export const OWNER_ROLES: PersonRole[] = ['owner_occupant', 'non_occupant_owner']

export function contactsOf(person: DirectoryPerson, kind: DirectoryContact['kind']): DirectoryContact[] {
  return [...person.contacts.filter((contact) => contact.kind === kind)].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    return a.value.localeCompare(b.value)
  })
}

export function personName(person: Pick<DirectoryPerson, 'firstName' | 'lastName'>): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ')
}
