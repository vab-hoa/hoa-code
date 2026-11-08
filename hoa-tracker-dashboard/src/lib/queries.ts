import { supabase } from './supabase'
import { isTerminalStatus } from './work-item-helpers'

async function boardGet<T>(q: string, params: Record<string, string> = {}): Promise<T> {
  const search = new URLSearchParams({ q, ...params })
  const res = await fetch(`/api/board?${search.toString()}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Board data request failed (${res.status})`)
  return body as T
}

async function boardPost<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/work-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok && body.success !== false) {
    throw new Error(body.error || `Work item request failed (${res.status})`)
  }
  return body as T
}
import type {
  DashboardSummary, OpenWorkItem, AgingWorkItem,
  WorkItem, Property, CorrespondenceEntry, EmailMessage,
  IssueEmailLink, WoStatusSnapshot, SourceDocument, EmailThread, WorkItemDocument, WorkItemNote,
} from './types'

// === Dashboard Home ===

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  try {
    return await boardGet<DashboardSummary>('summary')
  } catch (error) {
    console.error('getDashboardSummary:', error)
    return null
  }
}

export async function getAgingWorkItems(): Promise<AgingWorkItem[]> {
  let items: AgingWorkItem[] = []
  try {
    items = await boardGet<AgingWorkItem[]>('aging')
  } catch (error) {
    console.error('getAgingWorkItems:', error)
    return []
  }

  console.log('Raw aging items count:', items.length)
  console.log('Raw aging items statuses:', items.map(i => ({ title: i.title, status: i.status })))

  const filtered = items.filter(item =>
    !isTerminalStatus(item) &&
    !item.category?.startsWith('project:')
  )

  console.log('Filtered aging items count:', filtered.length)
  return filtered
}

export async function getOpenWorkItems(): Promise<OpenWorkItem[]> {
  try {
    const items = await boardGet<OpenWorkItem[]>('open')
    return items.filter(item => !isTerminalStatus(item))
  } catch (error) {
    console.error('getOpenWorkItems:', error)
    return []
  }
}

export async function getRecentCorrespondence(limit: number = 10) {
  try {
    return await boardGet<any[]>('recent-correspondence', { limit: String(limit) })
  } catch (error) {
    console.error('getRecentCorrespondence:', error)
    return []
  }
}

// === Work Item Detail ===

export async function getWorkItem(id: string): Promise<WorkItem | null> {
  try {
    return await boardGet<WorkItem>('work-item', { id })
  } catch (error) {
    console.error('getWorkItem:', error)
    return null
  }
}

export async function getWorkItemCorrespondence(workItemId: string): Promise<CorrespondenceEntry[]> {
  try {
    return await boardGet<CorrespondenceEntry[]>('correspondence', { id: workItemId })
  } catch (error) {
    console.error('getWorkItemCorrespondence:', error)
    return []
  }
}

export async function getWorkItemEmails(workItemId: string) {
  try {
    return await boardGet<any[]>('emails', { id: workItemId })
  } catch (error) {
    console.error('getWorkItemEmails:', error)
    return []
  }
}

export async function getWorkItemStatusHistory(workItemId: string) {
  try {
    return await boardGet<CorrespondenceEntry[]>('status-history', { id: workItemId })
  } catch (error) {
    console.error('getWorkItemStatusHistory:', error)
    return []
  }
}

export async function getWorkItemDocuments(workItemId: string): Promise<WorkItemDocument[]> {
  try {
    return await boardGet<WorkItemDocument[]>('documents', { id: workItemId })
  } catch (error) {
    console.error('getWorkItemDocuments:', error)
    return []
  }
}

export async function uploadWorkItemDocument(
  workItemId: string,
  file: File,
  title: string | null,
  uploadedBy: string
): Promise<WorkItemDocument | null> {
  try {
    const form = new FormData()
    form.set('file', file)
    form.set('workItemId', workItemId)
    form.set('title', title || '')
    form.set('uploadedBy', uploadedBy)
    const res = await fetch('/api/work-item-documents', { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('uploadWorkItemDocument:', body.error)
      return null
    }
    return body
  } catch (e) {
    console.error('uploadWorkItemDocument error:', e)
    return null
  }
}

export async function updateWorkItemDocumentTitle(documentId: string, title: string | null): Promise<boolean> {
  try {
    const body = await boardPost<{ success?: boolean; error?: string }>({
      action: 'document-title',
      documentId,
      title,
    })
    if (body.success === false) {
      console.error('updateWorkItemDocumentTitle:', body.error)
      return false
    }
    return true
  } catch (error) {
    console.error('updateWorkItemDocumentTitle:', error)
    return false
  }
}

export async function openWorkItemDocument(storagePath: string): Promise<void> {
  const search = new URLSearchParams({ path: storagePath })
  const res = await fetch(`/api/work-item-documents?${search.toString()}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.url) throw new Error(body.error || 'Could not open document')
  window.open(body.url, '_blank', 'noopener')
}

export async function updateWorkItemStatus(
  workItemId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await boardPost({ action: 'status', id: workItemId, status: newStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function resetWorkItemClock(
  workItemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await boardPost({ action: 'reset-clock', id: workItemId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function markWorkItemCompleted(
  workItemId: string,
  newStatus: string,
  closedDate?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await boardPost({ action: 'complete', id: workItemId, status: newStatus, closedDate })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function excludeWorkItem(
  workItemId: string,
  excludedBy: string,
  excludedReason: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/work-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'exclude', id: workItemId, excludedBy, excludedReason }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, error: body.error || 'Could not exclude item' }
  return { success: true }
}

export async function deleteWorkItem(
  workItemId: string,
  sourceDocumentId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/work-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id: workItemId, sourceDocumentId: sourceDocumentId || null }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, error: body.error || 'Could not delete item' }
  return { success: true }
}

// === Property Detail ===

export async function getPropertyOwners(propertyId: string): Promise<string[]> {
  const res = await fetch('/api/directory')
  if (!res.ok) return []
  const body = await res.json()
  const people = (body.people || []) as Array<{
    propertyId: string | null
    role: string
    firstName: string
    lastName: string
    inactive: boolean
  }>
  return people
    .filter((person) => person.propertyId === propertyId && (person.role === 'owner_occupant' || person.role === 'non_occupant_owner'))
    .map((person) => {
      const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Owner'
      return person.inactive ? `${name} (inactive)` : name
    })
}

export async function getProperty(id: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error('getProperty:', error); return null }
  return data
}

export async function getPropertyByParcelCode(parcelCode: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('parcel_code', parcelCode)
    .single()
  if (error) { console.error('getPropertyByParcelCode:', error); return null }
  return data
}

export async function getPropertyWorkItems(propertyId: string): Promise<WorkItem[]> {
  try {
    return await boardGet<WorkItem[]>('property-work-items', { id: propertyId })
  } catch (error) {
    console.error('getPropertyWorkItems:', error)
    return []
  }
}

export async function getPropertySourceDocuments(propertyId: string): Promise<SourceDocument[]> {
  try {
    return await boardGet<SourceDocument[]>('source-documents', { id: propertyId })
  } catch (error) {
    console.error('getPropertySourceDocuments:', error)
    return []
  }
}

export async function getAllProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('address', { ascending: true })
  if (error) { console.error('getAllProperties:', error); return [] }
  return data || []
}

// === Email Inbox ===

export async function getEmails(options: {
  classification?: string
  isNoise?: boolean
  limit?: number
  offset?: number
} = {}) {
  const params: Record<string, string> = {
    limit: String(options.limit || 50),
    offset: String(options.offset || 0),
  }
  if (options.classification) params.classification = options.classification
  if (options.isNoise !== undefined) params.isNoise = String(options.isNoise)
  try {
    return await boardGet<any[]>('inbox', params)
  } catch (error) {
    console.error('getEmails:', error)
    return []
  }
}

export async function getEmailByMessageId(messageId: string): Promise<EmailMessage | null> {
  try {
    return await boardGet<EmailMessage>('email-by-gmail-id', { id: messageId })
  } catch (error) {
    console.error('getEmailByMessageId:', error)
    return null
  }
}

export async function getEmailLinkedWorkItems(emailId: string) {
  try {
    return await boardGet<any[]>('email-links', { id: emailId })
  } catch (error) {
    console.error('getEmailLinkedWorkItems:', error)
    return []
  }
}

export async function getThreadMessages(threadId: string): Promise<EmailMessage[]> {
  try {
    return await boardGet<EmailMessage[]>('thread', { id: threadId })
  } catch (error) {
    console.error('getThreadMessages:', error)
    return []
  }
}

// === WO Status Snapshots ===

export async function getLatestSnapshots() {
  const { data: latest } = await supabase
    .from('wo_status_snapshot')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (!latest?.snapshot_date) return []

  const { data, error } = await supabase
    .from('wo_status_snapshot')
    .select('*')
    .eq('snapshot_date', latest.snapshot_date)
    .order('status_raw', { ascending: true })
  if (error) { console.error('getLatestSnapshots:', error); return [] }
  return data || []
}

export async function getSnapshotDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('wo_status_snapshot')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
  if (error) { console.error('getSnapshotDates:', error); return [] }
  const dates = (data || []).map(d => d.snapshot_date)
  return [...new Set(dates)] as string[]
}

export async function getSnapshotsByDate(date: string): Promise<WoStatusSnapshot[]> {
  const { data, error } = await supabase
    .from('wo_status_snapshot')
    .select('*')
    .eq('snapshot_date', date)
    .order('status_raw', { ascending: true })
  if (error) { console.error('getSnapshotsByDate:', error); return [] }
  return data || []
}

export async function getSnapshotDiff(date1: string, date2: string) {
  const [snap1, snap2] = await Promise.all([
    getSnapshotsByDate(date1),
    getSnapshotsByDate(date2),
  ])

  const map1 = new Map(snap1.map(s => [s.wo_number, s]))
  const map2 = new Map(snap2.map(s => [s.wo_number, s]))

  const allWoNumbers = new Set([...map1.keys(), ...map2.keys()])
  const diffs: Array<{
    wo_number: string
    type: 'new' | 'removed' | 'status_changed' | 'unchanged'
    old?: WoStatusSnapshot
    new?: WoStatusSnapshot
  }> = []

  for (const wo of allWoNumbers) {
    const old = map1.get(wo)
    const next = map2.get(wo)
    if (!old && next) diffs.push({ wo_number: wo, type: 'new', new: next })
    else if (old && !next) diffs.push({ wo_number: wo, type: 'removed', old })
    else if (old && next && old.status_raw !== next.status_raw)
      diffs.push({ wo_number: wo, type: 'status_changed', old, new: next })
    else diffs.push({ wo_number: wo, type: 'unchanged', old, new: next })
  }

  return diffs.filter(d => d.type !== 'unchanged')
}

// === Email Stats ===

export async function getEmailStats() {
  try {
    return await boardGet<any[]>('email-stats')
  } catch (error) {
    console.error('getEmailStats:', error)
    return []
  }
}

// === Work Item Notes ===

export async function getWorkItemNotes(workItemId: string): Promise<WorkItemNote[]> {
  try {
    return await boardGet<WorkItemNote[]>('notes', { id: workItemId })
  } catch (error) {
    console.error('getWorkItemNotes:', error)
    return []
  }
}

export async function addWorkItemNote(
  workItemId: string,
  noteDate: string,
  content: string,
  source?: string | null
): Promise<WorkItemNote | null> {
  try {
    return await boardPost<WorkItemNote>({
      action: 'note',
      id: workItemId,
      noteDate,
      content,
      source: source || null,
    })
  } catch (error) {
    console.error('addWorkItemNote:', error)
    return null
  }
}
