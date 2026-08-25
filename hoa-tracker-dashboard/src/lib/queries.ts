import { supabase } from './supabase'
import { isTerminalStatus } from './work-item-helpers'
import type {
  DashboardSummary, OpenWorkItem, AgingWorkItem,
  WorkItem, Property, CorrespondenceEntry, EmailMessage,
  IssueEmailLink, WoStatusSnapshot, SourceDocument, EmailThread, WorkItemDocument,
} from './types'

// === Dashboard Home ===

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const { data, error } = await supabase
    .from('v_dashboard_summary')
    .select('*')
    .single()
  if (error) { console.error('getDashboardSummary:', error); return null }
  return data
}

export async function getAgingWorkItems(): Promise<AgingWorkItem[]> {
  const { data, error } = await supabase
    .from('v_aging_work_items')
    .select('*')
    .order('days_open', { ascending: false })
  if (error) { console.error('getAgingWorkItems:', error); return [] }

  const items = data || []
  console.log('Raw aging items count:', items.length)
  console.log('Raw aging items statuses:', items.map(i => ({ title: i.title, status: i.status })))

  // Exclude terminal statuses and items that are intentionally paused/waiting
  const filtered = items.filter(item =>
    !isTerminalStatus(item) &&
    item.status !== 'on_hold' &&
    item.status !== 'monitored'
  )

  console.log('Filtered aging items count:', filtered.length)
  return filtered
}

export async function getOpenWorkItems(): Promise<OpenWorkItem[]> {
  const { data, error } = await supabase
    .from('v_open_work_items')
    .select('*')
    .order('priority', { ascending: false })
  if (error) { console.error('getOpenWorkItems:', error); return [] }
  const items = data || []
  return items.filter(item => !isTerminalStatus(item))
}

export async function getRecentCorrespondence(limit: number = 10) {
  const { data, error } = await supabase
    .from('correspondence_entries')
    .select(`
      *,
      work_items (
        title,
        category,
        status
      )
    `)
    .order('entry_date', { ascending: false })
    .limit(limit)
  if (error) { console.error('getRecentCorrespondence:', error); return [] }
  return data || []
}

// === Work Item Detail ===

export async function getWorkItem(id: string): Promise<WorkItem | null> {
  const { data, error } = await supabase
    .from('work_items')
    .select('*, properties(*)')
    .eq('id', id)
    .single()
  if (error) { console.error('getWorkItem:', error); return null }
  return data as any
}

export async function getWorkItemCorrespondence(workItemId: string): Promise<CorrespondenceEntry[]> {
  const { data, error } = await supabase
    .from('correspondence_entries')
    .select('*')
    .eq('work_item_id', workItemId)
    .order('entry_date', { ascending: true })
  if (error) { console.error('getWorkItemCorrespondence:', error); return [] }
  return data || []
}

export async function getWorkItemEmails(workItemId: string) {
  const { data, error } = await supabase
    .from('issue_email_link')
    .select('*, email_message(*)')
    .eq('work_item_id', workItemId)
    .order('email_message(received_date)', { ascending: true })
  if (error) { console.error('getWorkItemEmails:', error); return [] }
  return data || []
}

export async function getWorkItemStatusHistory(workItemId: string) {
  const { data, error } = await supabase
    .from('correspondence_entries')
    .select('*')
    .eq('work_item_id', workItemId)
    .not('old_status', 'is', null)
    .order('entry_date', { ascending: true })
  if (error) { console.error('getWorkItemStatusHistory:', error); return [] }
  return data || []
}

export async function getWorkItemDocuments(workItemId: string): Promise<WorkItemDocument[]> {
  const { data, error } = await supabase
    .from('work_item_documents')
    .select('*')
    .eq('work_item_id', workItemId)
    .order('uploaded_at', { ascending: false })
  if (error) { console.error('getWorkItemDocuments:', error); return [] }
  return data || []
}

export async function uploadWorkItemDocument(
  workItemId: string,
  file: File,
  title: string | null,
  uploadedBy: string
): Promise<WorkItemDocument | null> {
  try {
    const fileName = file.name
    const storagePath = `${workItemId}/${crypto.randomUUID()}-${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('work-item-documents')
      .upload(storagePath, file)

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return null
    }

    const { data, error: insertError } = await supabase
      .from('work_item_documents')
      .insert({
        work_item_id: workItemId,
        title: title || null,
        file_name: fileName,
        storage_path: storagePath,
        content_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_by: uploadedBy,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return null
    }

    return data
  } catch (e) {
    console.error('uploadWorkItemDocument error:', e)
    return null
  }
}

export async function updateWorkItemDocumentTitle(documentId: string, title: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('work_item_documents')
    .update({ title })
    .eq('id', documentId)

  if (error) {
    console.error('updateWorkItemDocumentTitle:', error)
    return false
  }
  return true
}

export function getWorkItemDocumentUrl(storagePath: string): string {
  const { data } = supabase.storage.from('work-item-documents').getPublicUrl(storagePath)
  return data.publicUrl
}

export async function updateWorkItemStatus(
  workItemId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  console.log('updateWorkItemStatus called', { workItemId, newStatus })

  const { error } = await supabase
    .from('work_items')
    .update({ status: newStatus })
    .eq('id', workItemId)

  if (error) {
    console.error('updateWorkItemStatus error:', error)
    return { success: false, error: error.message }
  }

  console.log('Status update succeeded')
  return { success: true }
}

export async function markWorkItemCompleted(
  workItemId: string,
  newStatus: string,
  closedDate?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('markWorkItemCompleted called', { workItemId, newStatus, closedDate })

  const updateData = {
    status: newStatus,
    closed_date: closedDate || new Date().toISOString().split('T')[0],
  }
  console.log('updateData:', updateData)

  // First, verify the work item exists
  const { data: existingItem, error: fetchError } = await supabase
    .from('work_items')
    .select('id, status')
    .eq('id', workItemId)
    .single()

  if (fetchError) {
    console.error('Error fetching work item:', fetchError)
    return { success: false, error: `Item not found: ${fetchError.message}` }
  }

  console.log('Found existing item:', existingItem)

  // Now update it
  const { error } = await supabase
    .from('work_items')
    .update(updateData)
    .eq('id', workItemId)

  console.log('Supabase response error:', error)

  if (error) {
    console.error('markWorkItemCompleted error:', error)
    return { success: false, error: error.message }
  }

  console.log('Update succeeded')
  return { success: true }
}

// === Property Detail ===

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
  const { data, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('property_id', propertyId)
    .is('excluded_at', null)
    .order('created_date', { ascending: false })
  if (error) { console.error('getPropertyWorkItems:', error); return [] }
  return data as any || []
}

export async function getPropertySourceDocuments(propertyId: string): Promise<SourceDocument[]> {
  const { data, error } = await supabase
    .from('source_documents')
    .select('*')
    .eq('property_id', propertyId)
    .order('received_date', { ascending: false })
  if (error) { console.error('getPropertySourceDocuments:', error); return [] }
  return data || []
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
  let query = supabase
    .from('email_message')
    .select('*')
    .order('received_date', { ascending: false })

  if (options.classification) {
    query = query.eq('classification', options.classification)
  }
  if (options.isNoise !== undefined) {
    query = query.eq('is_noise', options.isNoise)
  }

  const limit = options.limit || 50
  const offset = options.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) { console.error('getEmails:', error); return [] }
  return data || []
}

export async function getEmailByMessageId(messageId: string): Promise<EmailMessage | null> {
  const { data, error } = await supabase
    .from('email_message')
    .select('*')
    .eq('gmail_message_id', messageId)
    .single()
  if (error) { console.error('getEmailByMessageId:', error); return null }
  return data
}

export async function getEmailLinkedWorkItems(emailId: string) {
  const { data, error } = await supabase
    .from('issue_email_link')
    .select('*, work_items(title, category, status)')
    .eq('email_message_id', emailId)
  if (error) { console.error('getEmailLinkedWorkItems:', error); return [] }
  return data || []
}

export async function getThreadMessages(threadId: string): Promise<EmailMessage[]> {
  const { data, error } = await supabase
    .from('email_message')
    .select('*')
    .eq('gmail_thread_id', threadId)
    .order('received_date', { ascending: true })
  if (error) { console.error('getThreadMessages:', error); return [] }
  return data || []
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
  const { data, error } = await supabase
    .from('v_email_processing_stats')
    .select('*')
    .order('message_count', { ascending: false })
  if (error) { console.error('getEmailStats:', error); return [] }
  return data || []
}
