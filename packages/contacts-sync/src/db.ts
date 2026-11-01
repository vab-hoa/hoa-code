import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ContactValue } from './parse.js'
import { linkParcel, type ExistingPerson, type PropertyRef, type SyncPlan } from './plan.js'

export type Db = SupabaseClient

function loadLocalEnv(): void {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return
  const candidates = [
    resolve(process.cwd(), 'hoa-tracker-dashboard/.env.local'),
    resolve(process.cwd(), '../../hoa-tracker-dashboard/.env.local'),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const idx = line.indexOf('=')
      const key = line.slice(0, idx).trim()
      let value = line.slice(idx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key === 'NEXT_PUBLIC_SUPABASE_URL' && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = value
      if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = value
      }
    }
    return
  }
}

export function getDb(): Db {
  loadLocalEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function loadProperties(db: Db): Promise<PropertyRef[]> {
  const { data, error } = await db.from('properties').select('id, parcel_code')
  if (error) throw new Error(error.message)
  return (data || [])
    .filter((row) => row.parcel_code)
    .map((row) => ({ id: row.id as string, parcelCode: String(row.parcel_code) }))
}

export async function loadExistingPeople(db: Db): Promise<{ rows: ExistingPerson[]; missing: boolean }> {
  const { data, error } = await db.from('people').select('google_resource_name, inactive')
  if (error) {
    if (/people/i.test(error.message) && /schema cache|does not exist|could not find/i.test(error.message)) {
      return { rows: [], missing: true }
    }
    throw new Error(error.message)
  }
  return {
    missing: false,
    rows: (data || [])
      .filter((row) => row.google_resource_name)
      .map((row) => ({
        googleResourceName: String(row.google_resource_name),
        inactive: Boolean(row.inactive),
      })),
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function applySync(db: Db, plan: SyncPlan, properties: PropertyRef[]): Promise<void> {
  const now = new Date().toISOString()
  const rows = plan.upserts.map((person) => {
    const link = linkParcel(person.parcelCode, properties)
    return {
    google_resource_name: person.googleResourceName,
    google_etag: person.googleEtag,
    first_name: person.firstName,
    last_name: person.lastName,
    display_name: person.displayName,
    parcel_code: link.parcelCode,
    property_id: link.propertyId,
    role: person.role,
    labels: person.labels,
    raw_address: person.rawAddress,
    street: person.street,
    street_number: person.streetNumber,
    unit: person.unit || null,
    inactive: false,
    inactive_at: null,
    last_synced_at: now,
    updated_at: now,
    source: 'google_contacts',
  }})

  const saved: Array<{ id: string; google_resource_name: string }> = []
  for (const chunk of chunks(rows, 100)) {
    const { data, error } = await db
      .from('people')
      .upsert(chunk, { onConflict: 'google_resource_name' })
      .select('id, google_resource_name')
    if (error) throw new Error(`upsert people: ${error.message}`)
    saved.push(...((data || []) as Array<{ id: string; google_resource_name: string }>))
  }

  const idByResource = new Map(saved.map((row) => [row.google_resource_name, row.id]))
  const ids = [...idByResource.values()]
  for (const chunk of chunks(ids, 100)) {
    const { error } = await db.from('contacts').delete().in('person_id', chunk)
    if (error) throw new Error(`replace contacts: ${error.message}`)
  }

  const contactRows: Array<{
    person_id: string
    kind: ContactValue['kind']
    value: string
    label: string | null
    is_primary: boolean
  }> = []
  for (const person of plan.upserts) {
    const personId = idByResource.get(person.googleResourceName)
    if (!personId) continue
    for (const contact of person.contacts) {
      contactRows.push({
        person_id: personId,
        kind: contact.kind,
        value: contact.value,
        label: contact.label,
        is_primary: contact.isPrimary,
      })
    }
  }
  for (const chunk of chunks(contactRows, 200)) {
    const { error } = await db.from('contacts').insert(chunk)
    if (error) throw new Error(`insert contacts: ${error.message}`)
  }

  for (const chunk of chunks(plan.markInactive, 100)) {
    const { error } = await db
      .from('people')
      .update({ inactive: true, inactive_at: now, updated_at: now })
      .in('google_resource_name', chunk)
      .eq('inactive', false)
    if (error) throw new Error(`mark inactive: ${error.message}`)
  }
}
