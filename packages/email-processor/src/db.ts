import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { extractWoNumbers } from './parcel-extract.js'
import type { Candidate, InboundEmail } from './types.js'

export type Db = SupabaseClient

const TERMINAL = new Set([
  'closed', 'denied', 'withdrawn', 'resolved', 'approved', 'approved_with_conditions',
])

const ITEM_COLUMNS = 'id, title, category, status, keystone_wo_number, description'

interface ItemRow {
  id: string
  title: string | null
  category: string | null
  status: string | null
  keystone_wo_number: string | null
  description: string | null
}

export function getDb(): Db {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function messageExists(db: Db, gmailMessageId: string): Promise<boolean> {
  const { data, error } = await db
    .from('email_message')
    .select('id')
    .eq('gmail_message_id', gmailMessageId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function loadCandidates(db: Db, email: InboundEmail, parcel: string | null): Promise<Candidate[]> {
  const byId = new Map<string, Candidate>()
  const rank = { thread: 3, wo_number: 2, parcel: 1 } as const

  function add(row: ItemRow, via: Candidate['matchVia']) {
    const existing = byId.get(row.id)
    if (existing && rank[existing.matchVia] >= rank[via]) return
    byId.set(row.id, {
      id: row.id,
      title: row.title || '',
      category: row.category || 'other',
      status: row.status || '',
      keystoneWoNumber: row.keystone_wo_number,
      description: row.description ? row.description.slice(0, 160) : null,
      matchVia: via,
    })
  }

  if (email.threadId) {
    const { data: msgs, error } = await db
      .from('email_message')
      .select('id')
      .eq('gmail_thread_id', email.threadId)
      .limit(50)
    if (error) throw new Error(error.message)
    const ids = (msgs || []).map((m) => m.id as string)
    if (ids.length) {
      const { data: links, error: linkError } = await db
        .from('issue_email_link')
        .select('work_item_id')
        .in('email_message_id', ids)
      if (linkError) throw new Error(linkError.message)
      const workIds = [...new Set((links || []).map((l) => l.work_item_id as string).filter(Boolean))]
      for (const row of await fetchItems(db, workIds)) add(row, 'thread')
    }
  }

  const woNums = extractWoNumbers(`${email.subject}\n${email.bodyText}`)
  if (woNums.length) {
    const { data, error } = await db
      .from('work_items')
      .select(ITEM_COLUMNS)
      .in('keystone_wo_number', woNums)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as ItemRow[]) add(row, 'wo_number')
  }

  if (parcel) {
    const { data: prop, error } = await db
      .from('properties')
      .select('id')
      .eq('parcel_code', parcel)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (prop?.id) {
      const { data, error: itemError } = await db
        .from('work_items')
        .select(ITEM_COLUMNS)
        .eq('property_id', prop.id)
        .order('created_date', { ascending: false })
        .limit(30)
      if (itemError) throw new Error(itemError.message)
      for (const row of (data || []) as ItemRow[]) {
        if (row.status && TERMINAL.has(row.status)) continue
        add(row, 'parcel')
      }
    }
  }

  return [...byId.values()].slice(0, 15)
}

async function fetchItems(db: Db, ids: string[]): Promise<ItemRow[]> {
  if (!ids.length) return []
  const { data, error } = await db.from('work_items').select(ITEM_COLUMNS).in('id', ids)
  if (error) throw new Error(error.message)
  return (data || []) as ItemRow[]
}
