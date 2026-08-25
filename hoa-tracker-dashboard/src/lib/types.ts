// === Tables ===

export interface Property {
  id: string
  parcel_code: string
  address: string
  unit: string | null
  owner_name: string | null
  owner_email: string | null
  owner_phone: string | null
}

export interface WorkItem {
  id: string
  property_id: string | null
  title: string
  description: string | null
  category: WorkItemCategory
  status: WorkItemStatus
  priority: string | null
  assigned_to: string | null
  vendor: string | null
  decision: Decision | null
  decision_rationale: string | null
  decision_by: string | null
  decision_at: string | null
  estimated_cost: number | null
  bid_amount: number | null
  keystone_wo_number: string | null
  created_date: string
  due_date: string | null
  closed_date: string | null
  multi_item_parent_id: string | null
  external_ids: Record<string, string> | null
  updated_date: string
  keystone_status: string | null
  arc_request_serial: string | null
}

export interface CorrespondenceEntry {
  id: string
  work_item_id: string
  entry_type: string
  author_name: string
  author_role: string
  content: string
  old_status: string | null
  new_status: string | null
  entry_date: string
}

export interface EmailMessage {
  id: string
  gmail_message_id: string
  gmail_thread_id: string | null
  in_reply_to: string | null
  direction: string | null
  from_name: string | null
  from_email: string | null
  to_recipients: string[] | null
  cc_recipients: string[] | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  received_date: string | null
  classification: string | null
  classification_confidence: number | null
  is_noise: boolean
  parse_payload: Record<string, unknown> | null
  processed_at: string | null
}

export interface EmailThread {
  gmail_thread_id: string
  subject_normalized: string | null
  first_message_at: string | null
  last_message_at: string | null
  message_count: number
  primary_classification: string | null
  primary_parcel_code: string | null
}

export interface IssueEmailLink {
  id: string
  work_item_id: string
  email_message_id: string
  role: string
  match_method: string
  match_confidence: number
  created_at: string
}

export interface WoStatusSnapshot {
  id: string
  source_email_id: string | null
  snapshot_date: string | null
  wo_number: string
  parcel_code: string | null
  homeowner_name: string | null
  status_raw: string | null
  description: string | null
  vendor: string | null
  created_date_raw: string | null
  created_at: string
}

export interface SourceDocument {
  id: string
  property_id: string | null
  doc_type: string
  source_ref: string | null
  from_name: string | null
  from_email: string | null
  subject: string | null
  body_text: string | null
  received_date: string | null
  gmail_thread_id: string | null
}

export interface AgingConfig {
  id: string
  category: string
  status: string
  max_days: number
  alert_action: string | null
}

export interface WorkItemDocument {
  id: string
  work_item_id: string
  title: string | null
  file_name: string
  storage_path: string
  content_type: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  uploaded_at: string
}

// === Views ===

export interface DashboardSummary {
  total_open: number
  new_count: number
  on_hold_count: number
  awaiting_quote_count: number
  service_request_count: number
  scheduled_count: number
  pending_board_count: number
  awaiting_board_approval: number
  arc_in_review: number
  approved_count: number
  approved_with_conditions_count: number
  denied_count: number
  total_all_time: number
}

export interface OpenWorkItem extends WorkItem {
  parcel_code: string | null
  address: string | null
  owner_name: string | null
}

export interface AgingWorkItem {
  id: string
  title: string
  category: string
  status: string
  parcel_code: string | null
  address: string | null
  owner_name: string | null
  created_date: string
  max_days: number
  days_open: number
  assigned_to: string | null
  vendor: string | null
}

// === Enums ===

export type WorkItemCategory =
  | 'arc_request' | 'work_order' | 'violation' | 'landscaping'
  | 'gutter' | 'roofing' | 'siding' | 'irrigation' | 'drainage'
  | 'painting' | 'general_repair' | 'governance' | 'other'

export type WorkItemStatus =
  | 'new' | 'assigned' | 'in_progress' | 'awaiting_quote'
  | 'awaiting_board_approval' | 'service_request' | 'scheduled'
  | 'on_hold' | 'pending_board_review' | 'approved'
  | 'approved_with_conditions' | 'under_review_with_architect'
  | 'denied' | 'completed' | 'closed' | 'monitored' | 'cancelled'
  | 'notified' | 'fined'

export type Decision =
  | 'approved' | 'approved_with_conditions' | 'denied'
  | 'no_approval_needed' | 'pending' | 'info_requested'
