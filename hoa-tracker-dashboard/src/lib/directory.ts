/** Shared Full Directory types (Keystone cache + contacts merge). */

export type DirectoryPerson = {
  street: string
  streetNumber: string
  unit: string
  fullAddress: string
  lastName: string
  firstName: string
  phone1: string
  phone2: string
  email: string
  source: string
  parcelCode: string | null
  propertyId: string | null
  /** Keystone official owner string from properties table — kept, secondary to resident name */
  officialOwner: string | null
  ownerEmail: string | null
  ownerPhone: string | null
}

export type DirectoryResponse = {
  asOf: string
  count: number
  people: DirectoryPerson[]
  error?: string
}
