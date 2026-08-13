# HOA Issue Tracker Dashboard — Claude Code Build Spec

**Project:** Villas at the Boulders HOA Issue Tracker  
**Target:** Next.js web app deployed on Vercel  
**Domain:** tracker.villasboulders.org  
**Database:** Supabase (obveytoovkzjrpzrhrim.supabase.co)  
**Repo:** GitHub org `vab-hoa`, repo `hoa-tracker-dashboard`  
**Phase:** 1 (display only, no editing, no auth)

---

## 1. Overview

A dashboard for the Villas at the Boulders HOA board to track work items, ARC requests, violations, correspondence, and email activity. The primary value proposition is **aging alerts** — surfacing what's falling through the cracks. The secondary value is **correspondence visibility** — clicking a work item and seeing the full thread of who said what, when.

The app reads from a Supabase database populated by a separate email processor pipeline. The dashboard is read-only in Phase 1.

### Design Principles

1. **Information density** — compact tables, dense lists, no giant cards with one number. Dee wants to see a lot at once.
2. **Aging is the killer feature** — aging alerts must be prominent and actionable on the home page.
3. **Correspondence is key** — the ability to click a work item and see "Josh said X, homeowner said Y, board decided Z" is critical.
4. **Mobile-friendly** — Dee reads email on his phone. Dashboard must work on mobile (responsive Tailwind).
5. **No editing in Phase 1** — display only. Editing comes later.
6. **Board-friendly** — when Dee leaves the board, the next person should understand what's going on. No wmbuck.net dependencies. No jargon. Clear labels.
7. **No authentication in Phase 1** — board-only access via obscure URL. Add auth later.

---

## 2. Tech Stack & Dependencies

### Framework
- **Next.js 14+** with App Router
- **TypeScript** (strict mode)
- **Tailwind CSS** (via `create-next-app` built-in Tailwind support)

### Data
- **@supabase/supabase-js** — Supabase JS client for all queries

### UI Libraries
- **@heroicons/react** — icon set (outline + solid)
- **clsx** — conditional class names
- **date-fns** — date formatting and relative time ("3 days ago")

### No backend needed
All data fetched client-side from Supabase using the publishable/anon key. No server-side rendering required for Phase 1 (can use static rendering with client-side data fetching, or server components with Supabase — either works). Prefer **client-side fetching** for simplicity in Phase 1.

### Full dependency list

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.45.0",
    "@heroicons/react": "^2.1.0",
    "clsx": "^2.1.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

---

## 3. Environment Variables

Create `.env.local` for development and set these in Vercel project settings for production:

```
NEXT_PUBLIC_SUPABASE_URL=https://obveytoovkzjrpzrhrim.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VOkLzqlScMa7yTxZij1xXA_zATBJuyU
```

Both use `NEXT_PUBLIC_` prefix because Phase 1 fetches client-side. When auth is added later, the anon key + RLS policies will protect data.

---

## 4. Project Structure

```
hoa-tracker-dashboard/
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── README.md
├── vercel.json
├── public/
│   └── favicon.ico
└── src/
    ├── app/
    │   ├── layout.tsx              # Root layout: nav + shell
    │   ├── page.tsx                # Dashboard Home
    │   ├── globals.css             # Tailwind directives + custom styles
    │   ├── work-items/
    │   │   └── [id]/
    │   │       └── page.tsx        # Work Item Detail
    │   ├── properties/
    │   │   ├── page.tsx             # Properties list
    │   │   └── [id]/
    │   │       └── page.tsx        # Property Detail
    │   ├── emails/
    │   │   └── page.tsx             # Email Inbox view
    │   └── snapshots/
    │       └── page.tsx             # WO Status Snapshots view
    ├── components/
    │   ├── nav.tsx                  # Top navigation bar
    │   ├── summary-cards.tsx        # Dashboard summary cards
    │   ├── aging-alerts.tsx        # Aging alerts table
    │   ├── recent-activity.tsx     # Recent correspondence feed
    │   ├── work-item-card.tsx      # Compact work item row/card
    │   ├── work-item-list.tsx      # Grouped list of work items
    │   ├── status-badge.tsx        # Colored status badge
    │   ├── category-badge.tsx      # Colored category badge
    │   ├── priority-badge.tsx      # Priority indicator
    │   ├── decision-badge.tsx      # Decision display
    │   ├── correspondence-timeline.tsx  # Chronological correspondence + emails
    │   ├── email-body-modal.tsx    # Modal for viewing full email body
    │   ├── property-link.tsx       # Link to property detail
    │   ├── email-filters.tsx       # Email inbox filter bar
    │   ├── snapshot-table.tsx      # WO snapshot table
    │   ├── snapshot-diff.tsx       # Diff between two snapshots
    │   └── loading.tsx             # Loading spinner/skeleton
    ├── lib/
    │   ├── supabase.ts             # Supabase client singleton
    │   ├── types.ts                # TypeScript types for all DB tables
    │   ├── queries.ts              # Reusable Supabase query functions
    │   ├── format.ts               # Date/currency formatting helpers
    │   └── constants.ts            # Status colors, category labels, etc.
    └── hooks/
        ├── useDashboardSummary.ts  # SWR-like fetch hook for summary
        ├── useWorkItems.ts         # Open work items
        ├── useAgingItems.ts        # Aging work items
        └── useRecentActivity.ts    # Recent correspondence
```

---

## 5. Supabase Client Setup

### `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
})
```

### `src/lib/types.ts`

TypeScript interfaces for all database tables and views:

```typescript
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
  decision_approved: number
  decision_approved_conditions: number
  decision_denied: number
  decision_no_approval_needed: number
  decision_pending: number
  decision_info_requested: number
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

export type Decision =
  | 'approved' | 'approved_with_conditions' | 'denied'
  | 'no_approval_needed' | 'pending' | 'info_requested'
```

---

## 6. Constants & Styling

### `src/lib/constants.ts`

```typescript
export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  awaiting_quote: 'bg-orange-100 text-orange-800 border-orange-200',
  awaiting_board_approval: 'bg-purple-100 text-purple-800 border-purple-200',
  service_request: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  scheduled: 'bg-green-100 text-green-800 border-green-200',
  on_hold: 'bg-gray-100 text-gray-800 border-gray-200',
  pending_board_review: 'bg-red-100 text-red-800 border-red-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  approved_with_conditions: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review_with_architect: 'bg-violet-100 text-violet-800 border-violet-200',
  denied: 'bg-rose-100 text-rose-800 border-rose-200',
  completed: 'bg-stone-100 text-stone-800 border-stone-200',
  closed: 'bg-stone-50 text-stone-600 border-stone-200',
  monitored: 'bg-teal-100 text-teal-800 border-teal-200',
  cancelled: 'bg-stone-50 text-stone-500 border-stone-200',
}

export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  awaiting_quote: 'Awaiting Quote',
  awaiting_board_approval: 'Awaiting Board Approval',
  service_request: 'Service Request',
  scheduled: 'Scheduled',
  on_hold: 'On Hold',
  pending_board_review: 'Pending Board Review',
  approved: 'Approved',
  approved_with_conditions: 'Approved w/ Conditions',
  under_review_with_architect: 'Under Review w/ Architect',
  denied: 'Denied',
  completed: 'Completed',
  closed: 'Closed',
  monitored: 'Monitored',
  cancelled: 'Cancelled',
}

export const CATEGORY_COLORS: Record<string, string> = {
  arc_request: 'bg-violet-100 text-violet-800',
  work_order: 'bg-blue-100 text-blue-800',
  violation: 'bg-red-100 text-red-800',
  landscaping: 'bg-green-100 text-green-800',
  gutter: 'bg-cyan-100 text-cyan-800',
  roofing: 'bg-amber-100 text-amber-800',
  siding: 'bg-orange-100 text-orange-800',
  irrigation: 'bg-teal-100 text-teal-800',
  drainage: 'bg-indigo-100 text-indigo-800',
  painting: 'bg-pink-100 text-pink-800',
  general_repair: 'bg-stone-100 text-stone-800',
  governance: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
}

export const CATEGORY_LABELS: Record<string, string> = {
  arc_request: 'ARC Request',
  work_order: 'Work Order',
  violation: 'Violation',
  landscaping: 'Landscaping',
  gutter: 'Gutter',
  roofing: 'Roofing',
  siding: 'Siding',
  irrigation: 'Irrigation',
  drainage: 'Drainage',
  painting: 'Painting',
  general_repair: 'General Repair',
  governance: 'Governance',
  other: 'Other',
}

export const DECISION_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  approved_with_conditions: 'bg-amber-100 text-amber-800 border-amber-200',
  denied: 'bg-rose-100 text-rose-800 border-rose-200',
  no_approval_needed: 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info_requested: 'bg-orange-100 text-orange-800 border-orange-200',
}

export const DECISION_LABELS: Record<string, string> = {
  approved: 'Approved',
  approved_with_conditions: 'Approved with Conditions',
  denied: 'Denied',
  no_approval_needed: 'No Approval Needed',
  pending: 'Pending',
  info_requested: 'Info Requested',
}

export const EMAIL_CLASSIFICATION_LABELS: Record<string, string> = {
  noise: 'Noise',
  property_report: 'Property Report',
  wo_status_report: 'WO Status Report',
  arc_form_submission: 'ARC Form Submission',
  arc_manager_reply: 'ARC Manager Reply',
  arc_process_discussion: 'ARC Process Discussion',
  arc_form_forward: 'ARC Form Forward',
  wo_form: 'WO Form',
  hppr_form: 'HPPR Form',
  board_email: 'Board Email',
  josh_direct: 'Josh Direct',
  homeowner_direct: 'Homeowner Direct',
  governance: 'Governance',
  ops_alert: 'Ops Alert',
  unclassified: 'Unclassified',
}

// Priority ordering for sorting
export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}
```

### `src/lib/format.ts`

```typescript
import { format, formatDistanceToNow } from 'date-fns'

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—'
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function formatRelative(date: string | null): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDays(days: number): string {
  if (days < 1) return '<1 day'
  if (days === 1) return '1 day'
  return `${Math.round(days)} days`
}

export function truncate(text: string | null, maxLen: number = 200): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trim() + '…'
}
```

---

## 7. Reusable Query Functions

### `src/lib/queries.ts`

```typescript
import { supabase } from './supabase'
import type {
  DashboardSummary, OpenWorkItem, AgingWorkItem,
  WorkItem, Property, CorrespondenceEntry, EmailMessage,
  IssueEmailLink, WoStatusSnapshot, SourceDocument, EmailThread,
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
  return data || []
}

export async function getOpenWorkItems(): Promise<OpenWorkItem[]> {
  const { data, error } = await supabase
    .from('v_open_work_items')
    .select('*')
    .order('priority', { ascending: false })
  if (error) { console.error('getOpenWorkItems:', error); return [] }
  return data || []
}

export async function getRecentCorrespondence(limit: number = 10) {
  // Get recent correspondence entries joined with work item titles
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
  return data
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
  // Get correspondence entries that have status changes
  const { data, error } = await supabase
    .from('correspondence_entries')
    .select('*')
    .eq('work_item_id', workItemId)
    .not('old_status', 'is', null)
    .or('old_status.not.is.null,new_status.not.is.null')
    .order('entry_date', { ascending: true })
  if (error) { console.error('getWorkItemStatusHistory:', error); return [] }
  return data || []
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
    .order('created_date', { ascending: false })
  if (error) { console.error('getPropertyWorkItems:', error); return [] }
  return data || []
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
  // Get the most recent snapshot date
  const { data: latest } = await supabase
    .from('wo_status_snapshot')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (!latest?.snapshot_date) return []

  // Get all rows for that snapshot date
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
  return [...new Set(dates)] // unique dates
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
```

---

## 8. Pages & Layouts

### 8.1 Root Layout (`src/app/layout.tsx`)

- HTML shell with `<html lang="en">` and `<body>`
- Import `globals.css` for Tailwind
- Render `<Nav />` component at top
- Main content area below nav
- Metadata: title "Villas at the Boulders — HOA Issue Tracker", description, viewport

### 8.2 Navigation (`src/components/nav.tsx`)

Horizontal nav bar, sticky top, compact:

```
[🏠 HOA Tracker]  [Dashboard]  [Work Items]  [Properties]  [Emails]  [Snapshots]
```

- Logo/title left-aligned, links to `/`
- Nav items right-aligned
- Active link highlighted with `bg-blue-50` or underline
- Mobile: hamburger menu or horizontal scroll
- Background: white with bottom border shadow
- Height: ~48px (compact, not huge)

### 8.3 Dashboard Home (`src/app/page.tsx`)

This is the main page. It should load fast and show the most important info immediately.

**Layout (top to bottom):**

#### A. Summary Cards Row

A horizontal row of **compact** summary cards. NOT big cards with one number. Each card is a small box (~120px wide) with:
- Label (small text, gray)
- Number (medium font, bold)
- Subtle colored left border based on the metric

Cards to show (left to right):
1. **Total Open** (blue border) — `total_open`
2. **New** (blue border) — `new_count`
3. **Aging** (red border) — count of aging items (from `v_aging_work_items` length)
4. **Pending Board Review** (red border) — `pending_board_count`
5. **Awaiting Quote** (orange border) — `awaiting_quote_count`
6. **On Hold** (gray border) — `on_hold_count`
7. **Scheduled** (green border) — `scheduled_count`
8. **ARC In Review** (violet border) — `arc_in_review`

On mobile: 2-column grid, wrapping.

**Data:** `getDashboardSummary()` + `getAgingWorkItems().length`

#### B. Aging Alerts Section (THE KILLER FEATURE)

This is the most prominent section. Title: "⚠️ Aging Alerts" in red.

If no aging items: show a green "All caught up — no items past their aging threshold" message.

If aging items exist: a **compact table** with columns:

| Title | Property | Category | Status | Days Open | Limit | Over By | Vendor |
|-------|----------|----------|--------|-----------|-------|---------|--------|

- Rows sorted by "Over By" descending (worst first)
- **Row highlighting:**
  - Over by >60 days: `bg-red-50` (light red background)
  - Over by >30 days: `bg-orange-50`
  - Over by >14 days: `bg-yellow-50`
- "Over By" column shows red number (e.g., "+47 days")
- Category and Status use badge components
- Click row → navigate to work item detail page
- On mobile: collapse to cards with key info (title, property, over by)

**Data:** `getAgingWorkItems()` — the `v_aging_work_items` view returns `days_open` and `max_days`. Compute `over_by = days_open - max_days`.

#### C. Recent Activity Feed

Title: "Recent Activity" with a compact icon.

Show latest 10 correspondence entries as a **vertical feed**:

```
[Date] [Author Name] ([role]) → [Work Item Title]
  [Content snippet, 1-2 lines, truncated]
  [Status change indicator if applicable: old_status → new_status]
```

- Each entry is a row with left border colored by entry_type
- `decision` entries: green left border
- `status_change` entries: blue left border
- `comment` entries: gray left border
- `email` entries: indigo left border
- Click work item title → navigate to work item detail
- Compact spacing — 8px padding per row
- On mobile: same layout but narrower

**Data:** `getRecentCorrespondence(10)`

#### D. Open Work Items by Status

Title: "Open Work Items"

Group work items by status. For each status group:
- Status header with count badge (e.g., "Awaiting Quote (5)")
- Compact list of work items under that status
- Each row: title, property address, category badge, priority indicator, vendor
- Click row → work item detail page
- Collapsible sections (collapse by default for statuses with many items, expand top 3 most important)

**Layout option:** Can be a **Kanban-style grid** (horizontal scroll on desktop, stacked on mobile) OR a **grouped vertical list**. Prefer grouped vertical list for information density.

Status groups to show (in this order):
1. New
2. Pending Board Review
3. Awaiting Quote
4. Awaiting Board Approval
5. Service Request
6. Assigned
7. In Progress
8. Scheduled
9. On Hold
10. Under Review with Architect

Skip empty groups (show nothing if count = 0).

**Data:** `getOpenWorkItems()` — group client-side by status.

### 8.4 Work Item Detail (`src/app/work-items/[id]/page.tsx`)

This page shows everything about a single work item. It's where you go when you click an item from the dashboard.

**Layout:**

#### A. Header Section

- **Title** (large, bold)
- **Status badge** + **Category badge** + **Priority badge** (inline)
- **Property address** (link to property detail page)
- **Owner name**
- One-line description

#### B. Decision Block (if decision exists)

A highlighted callout box:

```
┌─────────────────────────────────────────────┐
│ DECISION: No Approval Needed               │
│ By: Josh Hall                                │
│ Date: Jul 30, 2026                          │
│ Rationale: "You are just replacing the      │
│ parts for like for like."                   │
└─────────────────────────────────────────────┘
```

- Green border/background for approved / no_approval_needed
- Amber for approved_with_conditions / info_requested
- Red for denied
- Yellow for pending
- Show `decision_by`, `decision_at`, `decision_rationale`

#### C. Details Grid (2-column on desktop, 1-column on mobile)

Left column:
- **Category:** [badge]
- **Status:** [badge]
- **Priority:** [badge or text]
- **Assigned To:** text
- **Vendor:** text
- **Keystone WO #:** text (if `keystone_wo_number` or `external_ids.keystone_wo`)
- **Created Date:** formatted date
- **Due Date:** formatted date (or "—")
- **Closed Date:** formatted date (or "—")

Right column:
- **Estimated Cost:** formatted currency (or "—")
- **Bid Amount:** formatted currency (or "—")
- **Decision:** (if not shown in decision block)
- **External IDs:** list from JSONB (Keystone WO#, ARC key, Jotform submission ID)

#### D. Description Section

Full description text. If empty, show "No description recorded."

#### E. Correspondence & Email Timeline

**This is the second killer feature.** A merged chronological timeline of:
1. Correspondence entries (from `correspondence_entries` table)
2. Linked emails (from `issue_email_link` → `email_message`)

Merge both into a single timeline sorted by date (ascending — oldest first, newest at bottom, OR newest first — choose newest first for "what's new" orientation).

Each timeline entry:

```
[Date]                    [Author Name] — [Role]
[Entry Type badge]        [Subject (for emails)]
  [Content snippet or email body snippet, 2-3 lines, truncated]
  [Status change: old_status → new_status (if applicable)]
  [Click "Read full email" → opens email body modal]
```

For emails:
- Show `from_name`, `from_email`, subject, classification badge
- Show first 200 chars of `body_text`
- "Read full email" button opens a **modal** (`email-body-modal.tsx`) with the full `body_text` in a scrollable pre-formatted block
- Show all emails in the same thread (via `gmail_thread_id`) even if not directly linked

For correspondence entries:
- Show `author_name`, `author_role`, `entry_type`
- Show `content` (may be long — show first 200 chars, expand on click)
- If `old_status` → `new_status`, show status transition with arrows and colored badges

Timeline styling:
- Left border line connecting entries (vertical timeline)
- Alternating left-border colors: emails = indigo, correspondence = gray, decisions = green
- Compact spacing
- On mobile: same layout, narrower

#### F. Status History

A compact sub-section showing only status changes (correspondence entries where `old_status` or `new_status` is not null):

```
[Date] — [old_status] → [new_status] — by [author_name]
```

If no status changes recorded, show "No status changes recorded."

#### G. Linked Emails Section

Separate from the timeline, a list of all emails linked to this work item via `issue_email_link`. Show:
- Date, from, subject, classification, role (origin/update/decision/etc.)
- Click to open email body modal

Also show emails from the same Gmail thread even if not directly linked (via `gmail_thread_id` from any linked email).

**Data:**
- `getWorkItem(id)` — main item with property
- `getWorkItemCorrespondence(id)` — correspondence entries
- `getWorkItemEmails(id)` — linked emails with email_message join
- `getWorkItemStatusHistory(id)` — status changes

### 8.5 Properties List (`src/app/properties/page.tsx`)

A searchable, sortable table of all properties.

**Features:**
- Search box (filter by address, parcel_code, owner_name)
- Sortable columns: address, parcel_code, owner_name
- Click row → property detail page
- Show count of open work items per property (requires a sub-query or join)
- Compact rows, 36px height
- Pagination or virtual scroll if needed (124 rows should be fine without pagination)

**Data:** `getAllProperties()` + work item counts

### 8.6 Property Detail (`src/app/properties/[id]/page.tsx`)

**Layout:**

#### A. Header
- Address (large)
- Parcel code (monospace)
- Owner name, email, phone
- Unit number

#### B. Work Items for This Property

A table of all work items for this property (historical and current):

| Title | Category | Status | Created | Closed | Vendor | Decision |
|-------|----------|--------|---------|--------|--------|----------|

- Sort by created_date descending
- Status and category as badges
- Click row → work item detail page
- Open items highlighted (bold or colored row)
- Closed items grayed out

**Data:** `getProperty(id)` + `getPropertyWorkItems(id)`

#### C. Source Documents

A table of source documents for this property:

| Date | Type | From | Subject |
|------|------|------|---------|

- Sort by received_date descending
- Click to expand body text (inline, not modal)

**Data:** `getPropertySourceDocuments(id)`

#### D. Timeline View

A merged timeline of everything that's happened at this property:
- Work item creation
- Work item status changes
- Source documents received
- Emails received (linked via issue_email_link or parcel_code match)

Use the same timeline component as the work item detail page, but scoped to the property.

This can be a simple chronological list for Phase 1 — no need for a fancy visual timeline. Just a dated list of events.

### 8.7 Email Inbox (`src/app/emails/page.tsx`)

**Layout:**

#### A. Filter Bar

- **Classification filter:** dropdown (All, ARC Form, WO Status Report, Board Email, etc.)
- **Noise toggle:** "Show noise emails" checkbox (default off)
- **Date range:** optional — start/end date pickers (can defer to Phase 2 if complex)
- **Search:** text search in subject/from/body (client-side filter on loaded results)

#### B. Email List

A compact table:

| Date | From | Subject | Classification | Linked Items |
|------|------|---------|----------------|--------------|

- Sorted by received_date descending (newest first)
- 50 emails per page, "Load more" button at bottom
- Noise emails: hidden by default, shown when toggle is on. Noise rows have `opacity-50` styling
- Classification as a small badge
- "Linked Items" shows count of linked work items (click to expand or link to work item)
- Click row → expand inline to show email body snippet (200 chars) + "Read full email" button
- Full email opens in modal (`email-body-modal.tsx`)

**Data:** `getEmails({ classification, isNoise, limit: 50, offset })` + `getEmailLinkedWorkItems(emailId)`

#### C. Email Detail Modal

When "Read full email" is clicked, show a modal overlay:

```
┌──────────────────────────────────────────┐
│ [Subject]                          [✕]   │
│ From: [name] <[email]>                    │
│ Date: [formatted date]                    │
│ Classification: [badge]                    │
│ Thread ID: [thread_id]                    │
│ ──────────────────────────────────────── │
│ [Full body_text in scrollable <pre>]      │
│                                           │
│ ──────────────────────────────────────── │
│ Linked Work Items:                        │
│   • [Work Item Title] → [link]            │
│   • [Work Item Title] → [link]            │
│ Thread Messages:                          │
│   • [Date] [From] [Subject] (clickable)   │
└──────────────────────────────────────────┘
```

- Scrollable body text in `<pre>` or `whitespace-pre-wrap` div
- Max width 800px, max height 80vh
- Click outside or ✕ to close
- Esc to close

### 8.8 WO Status Snapshots (`src/app/snapshots/page.tsx`)

**Layout:**

#### A. Snapshot Date Selector

- Dropdown of available snapshot dates (most recent first)
- "Compare with" dropdown to select a previous date for diff

#### B. Latest Snapshot Table

The most recent valid snapshot as a compact table:

| WO# | Parcel | Homeowner | Status | Description | Vendor | Created |
|-----|--------|-----------|--------|-------------|--------|---------|

- Group by `status_raw` (section headers with counts)
- Sort within each group by WO#
- Compact rows

#### C. Diff View (when two dates selected)

Show what changed between the two selected snapshots:

**New items** (appeared in newer, not in older):
```
+ WO#99326  13684SC1  Gilbert  Pending Board Review  Dead lawn...
```

**Removed items** (in older, not in newer — likely closed):
```
- WO#65121  136XXRP1  Spiegel  Pending Board Review  Drainage...
```

**Status changes:**
```
~ WO#96085  136XXBP1  Couture  Awaiting Quote → Scheduled
```

Color coding:
- New: green background
- Removed: red/strikethrough
- Status change: yellow/orange background with arrow

**Data:**
- `getLatestSnapshots()` for default view
- `getSnapshotDates()` for the dropdowns
- `getSnapshotDiff(date1, date2)` for diff view

---

## 9. Component Specifications

### 9.1 `status-badge.tsx`

```tsx
// Props: { status: string; size?: 'sm' | 'md' }
// Renders: <span className={clsx('inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium', STATUS_COLORS[status])}>
//   {STATUS_LABELS[status] || status}
// </span>
```

### 9.2 `category-badge.tsx`

```tsx
// Props: { category: string; size?: 'sm' | 'md' }
// Renders: <span className={clsx('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', CATEGORY_COLORS[category])}>
//   {CATEGORY_LABELS[category] || category}
// </span>
```

### 9.3 `priority-badge.tsx`

```tsx
// Props: { priority: string | null }
// Renders: small colored dot + text
// urgent: red, high: orange, medium: yellow, low: gray
// If null: render nothing
```

### 9.4 `decision-badge.tsx`

```tsx
// Props: { decision: string; rationale?: string; decisionBy?: string; decisionAt?: string }
// Renders: colored badge using DECISION_COLORS + optional tooltip/expandable with rationale
```

### 9.5 `summary-cards.tsx`

```tsx
// Props: { summary: DashboardSummary | null; agingCount: number }
// Renders: horizontal flex of compact cards
// Each card: <div className="border-l-4 border-{color} bg-white p-2 shadow-sm rounded">
//   <div className="text-xs text-gray-500">{label}</div>
//   <div className="text-lg font-bold">{count}</div>
// </div>
```

### 9.6 `aging-alerts.tsx`

```tsx
// Props: { items: AgingWorkItem[] }
// Renders: table with row highlighting based on over_by days
// Columns: title, property, category badge, status badge, days_open, over_by (red), vendor
// Row click → /work-items/{id}
// Mobile: card layout
```

### 9.7 `recent-activity.tsx`

```tsx
// Props: { entries: any[] }
// Renders: vertical feed of correspondence entries
// Each entry: date, author, role, content snippet (truncated), status change indicator
// Entry click → /work-items/{work_item_id}
```

### 9.8 `work-item-list.tsx`

```tsx
// Props: { items: OpenWorkItem[] }
// Groups items by status, renders collapsible sections
// Each section: header with status label + count, then compact rows
// Row: title, address, category badge, priority dot, vendor
// Row click → /work-items/{id}
```

### 9.9 `correspondence-timeline.tsx`

```tsx
// Props: { correspondence: CorrespondenceEntry[]; emails: any[] }
// Merges both arrays by date, renders vertical timeline
// Left border line, entry type colored
// Email entries: show subject, from, snippet, "Read full email" button
// Correspondence entries: show author, role, content snippet, status change
```

### 9.10 `email-body-modal.tsx`

```tsx
// Props: { email: EmailMessage | null; onClose: () => void; linkedWorkItems: any[]; threadMessages: EmailMessage[] }
// Renders: fixed overlay modal with email details + scrollable body
// Esc/click-outside to close
// Uses <pre className="whitespace-pre-wrap text-sm"> for body
```

### 9.11 `email-filters.tsx`

```tsx
// Props: { classification: string; showNoise: boolean; onClassificationChange: (v) => void; onNoiseToggle: (v) => void }
// Renders: filter bar with dropdown + checkbox
```

### 9.12 `snapshot-table.tsx`

```tsx
// Props: { snapshots: WoStatusSnapshot[] }
// Groups by status_raw, renders grouped tables
// Compact rows
```

### 9.13 `snapshot-diff.tsx`

```tsx
// Props: { diffs: any[] }
// Renders: list of changes with color coding
// New (green +), Removed (red -), Status Changed (yellow ~ with arrow)
```

### 9.14 `nav.tsx`

```tsx
// Renders: sticky top nav bar
// Links: Dashboard (/), Properties (/properties), Emails (/emails), Snapshots (/snapshots)
// Active state via usePathname()
// Mobile: horizontal scroll or hamburger
```

### 9.15 `loading.tsx`

```tsx
// Renders: centered spinner with "Loading..." text
// Used by pages while data is fetching
```

---

## 10. Global Styles (`src/app/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Compact, information-dense defaults */
body {
  @apply text-sm text-gray-900 bg-gray-50;
}

/* Tighter table spacing */
table {
  @apply text-xs;
}

th {
  @apply text-left font-medium text-gray-500 uppercase tracking-wide pb-1;
}

td {
  @apply py-1.5 px-2;
}

/* Hover state for clickable rows */
tr.clickable:hover {
  @apply bg-blue-50 cursor-pointer;
}

/* Scrollbar styling for modals */
.scrollable {
  @apply overflow-y-auto;
  scrollbar-width: thin;
}

/* Email body preservation */
.email-body {
  @apply whitespace-pre-wrap font-mono text-xs leading-relaxed;
}

/* Timeline connector line */
.timeline-line {
  @apply absolute left-2 top-0 bottom-0 w-px bg-gray-200;
}
```

---

## 11. Tailwind Config

Standard `create-next-app` Tailwind setup. No custom config needed beyond the defaults. The app uses standard Tailwind color classes throughout.

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

---

## 12. Data Fetching Pattern

Use a simple custom hook pattern for client-side fetching. No need for SWR or React Query in Phase 1 — keep dependencies minimal.

```typescript
// src/hooks/useDashboardSummary.ts
import { useState, useEffect } from 'react'
import { getDashboardSummary } from '@/lib/queries'
import type { DashboardSummary } from '@/lib/types'

export function useDashboardSummary() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getDashboardSummary()
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
```

Apply the same pattern for each query. Create hooks for:
- `useWorkItems()` — open work items
- `useAgingItems()` — aging work items
- `useRecentActivity(limit)` — recent correspondence
- `useWorkItem(id)` — single work item with property
- `useWorkItemCorrespondence(id)` — correspondence for a work item
- `useWorkItemEmails(id)` — linked emails for a work item
- `useProperty(id)` — single property
- `usePropertyWorkItems(id)` — work items for a property
- `useEmails(filters)` — email list with filters
- `useSnapshots()` — latest snapshots
- `useSnapshotDates()` — available dates
- `useSnapshotDiff(date1, date2)` — diff between two dates

All hooks return `{ data, loading, error }`.

---

## 13. Responsive Design Notes

- **Desktop (>1024px):** Full width, multi-column grids, dense tables
- **Tablet (768-1024px):** 2-column summary cards, slightly wider table cells
- **Mobile (<768px):**
  - Summary cards: 2-column grid
  - Aging alerts: card layout instead of table (title, property, over_by prominent)
  - Work item lists: single column, each item as a compact card
  - Work item detail: single column, stacked sections
  - Email list: single column, subject + from + date only
  - Nav: horizontal scroll (no hamburger — keep it simple)
  - Tables: horizontal scroll with `overflow-x-auto`

---

## 14. Performance Considerations

1. **Client-side fetching** — simple for Phase 1. Each page loads its own data. No SSR needed.
2. **Loading states** — every page shows a loading skeleton/spinner while data loads.
3. **Error states** — every page shows a friendly error message if Supabase query fails.
4. **No pagination needed yet** — 146 work items, 705 emails, 124 properties all fit in memory.
5. **Email body lazy loading** — don't load full email bodies in lists. Load on modal open.
6. **Image optimization** — no images in Phase 1.

---

## 14.5 Phase 2: Work Item Type Separation, Soft-Delete, and Terminal-Status Fixes

### 14.5.1 Work Item Types

The dashboard now separates work items by **type** rather than treating them as one undifferentiated pool. Four distinct types exist, each with its own status lifecycle and terminal-status vocabulary:

#### Types and Terminal Statuses

1. **ARC Requests** (`arc_request`)
   - Terminal statuses: `closed`, `approved`, `approved_with_conditions`, `denied`
   - Lifecycle: new → under_review_with_architect → (approved/approved_with_conditions/denied/closed)
   - Source: Jotform ARC submissions from homeowners, reviewed by Josh Hall

2. **Work Orders** (umbrella category with sub-types: `work_order`, `gutter`, `roofing`, `siding`, `irrigation`, `drainage`, `painting`, `general_repair`, `governance`, `other`)
   - Terminal statuses: `closed`, `cancelled`, `denied`
   - Lifecycle: new → assigned → in_progress → awaiting_quote → scheduled → closed
   - Source: Keystone Pacific work order system, WO status emails

3. **Violations** (`violation`)
   - Terminal statuses: `closed`, `resolved`, `dismissed`
   - Lifecycle: new → monitored → (closed/resolved/dismissed)
   - Source: HOA enforcement notices for code violations (e.g., outdoor storage, landscaping violations)

4. **Landscaping Requests** (`landscaping`)
   - Terminal statuses: `closed`, `cancelled`, `denied`
   - Lifecycle: new → assigned → in_progress → closed
   - Source: Homeowner planting/removal requests (currently miscategorized as ARC in legacy data)

#### Function: `isTerminalStatus(item)`

Located in `src/lib/work-item-helpers.ts`:

```typescript
export function isTerminalStatus(item: { category: string; status: string }): boolean {
  const terminal = TERMINAL_STATUSES_BY_CATEGORY[item.category] ?? DEFAULT_TERMINAL
  return terminal.includes(item.status)
}
```

This function is used in `getAgingWorkItems()` and `getOpenWorkItems()` to filter out terminal items, ensuring that approved/approved_with_conditions ARC requests no longer incorrectly appear as "aging" even after decisions are made.

### 14.5.2 Type-Grouped Dashboard Views

**Aging Alerts** (`src/components/aging-alerts.tsx`) and **Open Work Items** (`src/components/work-item-list.tsx`) now display type-grouping with show/hide toggles:

- A row of toggle chips at the top: `ARC Requests | Landscape | Work Orders | Violations`
- Each chip shows the count of items for that type
- Clicking a chip toggles visibility of that type's section
- Multiple sections render below the chips, one per visible type
- Within each type section, items are still grouped by status (for Aging Alerts) or status collapsibility (for Open Work Items)

This prevents the previous mixing of incompatible workflows (e.g., ARC approvals mixed with work order assignments).

### 14.5.3 Soft-Delete / Exclusion Mechanism

A new reversible data exclusion feature allows marking stale or incorrect work items without permanent deletion (to preserve data history).

#### Database Schema (schema_v4.sql)

Three new columns on `work_items` table:
- `excluded_at TIMESTAMPTZ` — timestamp when the item was excluded (NULL = not excluded)
- `excluded_by TEXT` — name of the person who excluded it (no auth, free-text field)
- `excluded_reason TEXT` — human-readable reason for exclusion

All Supabase views (`v_open_work_items`, `v_aging_work_items`, etc.) have been updated to filter `WHERE excluded_at IS NULL`, so excluded items automatically disappear from the dashboard.

#### UI: "Mark as Excluded" Button

Work Item Detail page (`src/app/work-items/[id]/page.tsx`) has a red "Mark as excluded" button at top-right that opens a dialog:

```
Dialog:
  Your name: [text input]
  Reason: [textarea]
  [Cancel] [Exclude] buttons
```

Clicking Exclude updates the work item with the current timestamp and reason, then redirects to dashboard home.

#### Recovery

Excluded items are soft-deleted, not hard-deleted. If a reason turns out to be wrong, a simple Supabase query can un-exclude:

```sql
UPDATE work_items SET excluded_at = NULL WHERE id = '...';
```

No "un-exclude" UI exists in Phase 2; it's a manual operation if needed.

### 14.5.4 Known Data-Quality Issue: Landscape Miscategorization

**Situation:** The Keystone property manager currently files landscape requests through the ARC Jotform because Keystone's system doesn't have a native landscaping request category. As a result, 6 landscape requests exist in the database as `category = 'arc_request'` with `title` containing "Landscape" or similar.

**Expected behavior:** Going forward, the email processor pipeline (`email_processor.py`, Jane's responsibility) should categorize new landscape requests correctly as `category = 'landscaping'` rather than funneling them through the ARC form.

**Dashboard impact:** The Landscape section in Aging Alerts and Open Work Items will remain empty until real landscape data arrives (i.e., until the pipeline categorizes them correctly). This is expected and not a dashboard bug.

**Cleanup:** The 6 misclassified landscape ARC items should be marked as excluded (using the new "Mark as excluded" feature) to keep the dashboard clean while the pipeline fix is being implemented.

### 14.5.5 Removed: Decision-Based Logic

**What changed:** Phase 1.5 added broken logic that tried to filter ARC requests using a `decision` column. Investigation revealed:
- The `decision` column exists in the database but is NULL on all 146 work items
- ARC request outcomes are recorded directly in the `status` field (approved, approved_with_conditions, closed, denied), not in a separate decision column
- The Phase 1.5 filter checking `decision === 'approved'` never matched anything

**What was removed:**
- `isTerminalArcDecision()` helper (was consulting a NULL column)
- `getEffectiveBadge()` helper (was trying to show decision vs. status as alternative badges)
- Special-case badge logic in `work-item-list.tsx` (was rendering decision badges)
- Decision-based counts from `DashboardSummary` type (decision_approved, decision_approved_conditions, etc.)

**Why:** These were built on a false premise. The correct approach is per-type terminal-status mappings (`isTerminalStatus()`), which consult the actual data structure (status field, by category).

### 14.5.6 Views Updated (schema_v4.sql)

All Supabase views now filter `excluded_at IS NULL`:

- `v_open_work_items` — filters terminal items by type, excludes soft-deleted items
- `v_aging_work_items` — same filters
- `v_latest_correspondence` — excludes soft-deleted items
- `v_dashboard_summary` — counts exclude soft-deleted items

### 14.5.7 Queries Updated (src/lib/queries.ts)

- `getAgingWorkItems()` — simplified to use `isTerminalStatus()` filter (removed broken follow-up decision lookup)
- `getOpenWorkItems()` — uses `isTerminalStatus()` instead of broken `isTerminalArcDecision()`
- `getPropertyWorkItems()` — added `.is('excluded_at', null)` filter

---

## 15. Deployment

### 15.1 GitHub Repo Setup

1. Create a new repo under the `vab-hoa` GitHub organization: `hoa-tracker-dashboard`
2. Initialize with `create-next-app`:
   ```bash
   npx create-next-app@latest hoa-tracker-dashboard --typescript --tailwind --app --src-dir --eslint
   ```
3. Add dependencies:
   ```bash
   cd hoa-tracker-dashboard
   npm install @supabase/supabase-js @heroicons/react clsx date-fns
   ```
4. Build the app per this spec.
5. Push to GitHub:
   ```bash
   git remote add origin git@github.com:vab-hoa/hoa-tracker-dashboard.git
   git push -u origin main
   ```

### 15.2 Vercel Deployment

1. Go to [vercel.com](https://vercel.com) and sign in (use GitHub OAuth)
2. Click "New Project" → Import `vab-hoa/hoa-tracker-dashboard`
3. Framework preset: Next.js (auto-detected)
4. Environment variables — add in Vercel project settings:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://obveytoovkzjrpzrhrim.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VOkLzqlScMa7yTxZij1xXA_zATBJuyU
   ```
5. Click "Deploy"
6. Vercel will auto-build and deploy. You'll get a URL like `hoa-tracker-dashboard.vercel.app`

### 15.3 Custom Domain Setup

1. In Vercel project settings → "Domains"
2. Add domain: `tracker.villasboulders.org`
3. Vercel will show a CNAME record to add:
   ```
   CNAME  tracker  cname.vercel-dns.com  (or the specific value Vercel shows)
   ```
4. Add the CNAME record in the DNS provider for `villasboulders.org`:
   - If using Google Domains: go to DNS settings, add CNAME record
   - If using Namecheap: go to Advanced DNS, add CNAME record
   - Record: `tracker` → `cname.vercel-dns.com`
5. Wait for DNS propagation (usually minutes, can take up to 48 hours)
6. Vercel will auto-provision SSL certificate once DNS resolves

### 15.4 `.gitignore`

Standard Next.js `.gitignore` plus:
```
.env.local
.env*.local
```

### 15.5 `vercel.json`

```json
{
  "framework": "nextjs"
}
```

No special configuration needed — Vercel auto-detects Next.js.

### 15.6 `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // No special config needed for Phase 1
}
module.exports = nextConfig
```

---

## 16. Database Notes

### Supabase Connection

- **URL:** `https://obveytoovkzjrpzrhrim.supabase.co`
- **Anon Key:** `sb_publishable_VOkLzqlScMa7yTxZij1xXA_zATBJuyU`
- **API Base:** `https://obveytoovkzjrpzrhrim.supabase.co/rest/v1`
- **The database already has data** — 146 work items, 705 emails, 124 properties, 259 WO snapshots

### RLS (Row Level Security)

Phase 1: RLS is not yet enabled on the tables. The anon key can read all data. This is acceptable for a board-only tool with an unlisted URL.

**When auth is added (Phase 2):**
1. Enable RLS on all tables
2. Create policies allowing authenticated users to SELECT
3. Add Supabase Auth (email/password or magic link)
4. Create a `users` table mapping auth users to board members

### Views Used by Dashboard

The dashboard relies on these pre-built views in the database:
- `v_dashboard_summary` — single row with all counts
- `v_open_work_items` — open items with property details joined
- `v_aging_work_items` — items past aging threshold with days_open and max_days
- `v_latest_correspondence` — latest correspondence per work item
- `v_email_processing_stats` — email classification counts

### Table Row Counts (as of Aug 2026)

| Table | Rows |
|-------|------|
| properties | 124 |
| source_documents | 146 |
| work_items | 146 |
| correspondence_entries | varies |
| email_message | 705 |
| email_thread | varies |
| issue_email_link | varies |
| wo_status_snapshot | 259 |
| aging_config | 24 |

---

## 17. Build Checklist

Claude Code should follow this checklist in order:

### Step 1: Project Setup
- [ ] Run `create-next-app` with TypeScript, Tailwind, App Router, src directory
- [ ] Install dependencies: `@supabase/supabase-js`, `@heroicons/react`, `clsx`, `date-fns`
- [ ] Create `.env.local` with Supabase URL and anon key
- [ ] Create `src/lib/supabase.ts` — Supabase client singleton
- [ ] Create `src/lib/types.ts` — all TypeScript interfaces
- [ ] Create `src/lib/constants.ts` — status colors, category labels, etc.
- [ ] Create `src/lib/format.ts` — date/currency formatters
- [ ] Create `src/lib/queries.ts` — all Supabase query functions

### Step 2: Core Components
- [ ] Create `src/components/nav.tsx` — navigation bar
- [ ] Create `src/components/status-badge.tsx`
- [ ] Create `src/components/category-badge.tsx`
- [ ] Create `src/components/priority-badge.tsx`
- [ ] Create `src/components/decision-badge.tsx`
- [ ] Create `src/components/loading.tsx`
- [ ] Update `src/app/layout.tsx` — add nav, metadata
- [ ] Update `src/app/globals.css` — add custom styles

### Step 3: Dashboard Home
- [ ] Create `src/components/summary-cards.tsx`
- [ ] Create `src/components/aging-alerts.tsx`
- [ ] Create `src/components/recent-activity.tsx`
- [ ] Create `src/components/work-item-list.tsx`
- [ ] Create data fetch hooks
- [ ] Build `src/app/page.tsx` — assemble all components

### Step 4: Work Item Detail
- [ ] Create `src/components/correspondence-timeline.tsx`
- [ ] Create `src/components/email-body-modal.tsx`
- [ ] Build `src/app/work-items/[id]/page.tsx`

### Step 5: Properties
- [ ] Build `src/app/properties/page.tsx` — properties list
- [ ] Build `src/app/properties/[id]/page.tsx` — property detail

### Step 6: Email Inbox
- [ ] Create `src/components/email-filters.tsx`
- [ ] Build `src/app/emails/page.tsx`

### Step 7: WO Snapshots
- [ ] Create `src/components/snapshot-table.tsx`
- [ ] Create `src/components/snapshot-diff.tsx`
- [ ] Build `src/app/snapshots/page.tsx`

### Step 8: Polish
- [ ] Test all pages with real data
- [ ] Verify mobile responsiveness
- [ ] Add loading states to all pages
- [ ] Add error states to all pages
- [ ] Verify all navigation links work
- [ ] Check for console errors

### Step 9: Deploy
- [ ] Push to GitHub `vab-hoa/hoa-tracker-dashboard`
- [ ] Import to Vercel
- [ ] Add environment variables in Vercel
- [ ] Deploy
- [ ] Add custom domain `tracker.villasboulders.org`
- [ ] Add CNAME in DNS
- [ ] Verify SSL provisioning
- [ ] Test production deployment

---

## 18. Context for Claude Code

### What is this HOA?

The Villas at the Boulders is a 124-unit condo HOA in Broomfield, Colorado. The board manages architectural review (ARC), work orders (WO), violations, and landscaping through a property management company (Keystone Pacific, formerly AdvanceHOA). The board communicates via email, Google Forms, and Jotform.

### Who uses the dashboard?

- **Dee Buck** — current board president and IT officer. Built the email processing pipeline. Wants to see what's falling through the cracks.
- **Other board members** — need to see status of items coming to board review, pending decisions, and aging items.
- **Future board members** — when Dee leaves the board, the next person needs to understand what's going on without Dee explaining it.

### What is the data?

The Supabase database is populated by a Python email processor that reads HOA emails (ARC forms, WO status reports, board correspondence) and structures them into work items, correspondence entries, and email records. The processor runs on a separate server (oregano) and writes to Supabase. The dashboard only reads.

### Key domain concepts

- **ARC** = Architectural Review Committee. Homeowners submit forms for exterior changes (windows, doors, fences, etc.). Josh Hall (property manager) reviews and decides. Board may need to approve larger items.
- **Work Order (WO)** = A maintenance/repair task tracked in Keystone. Has a WO number (e.g., WO#99326). Status flows: New → Assigned → Awaiting Quote → Scheduled → Completed.
- **Aging** = Each category/status combination has a max allowed time. If a work item sits in a status longer than the threshold, it's "aging" and needs attention. This is the killer feature.
- **Keystone** = Keystone Pacific, the property management company. Josh Hall is the community manager. Keystone maintains the official WO system.
- **Josh Hall** = The property manager. His emails are critical — he makes decisions ("no approval needed"), enters items into Keystone, and coordinates with vendors.
- **Parcel Code** = Standardized property identifier. Format: `{street_number}{street_suffix}{unit_number}`. Examples: 13737RP2 (13737 Rock Point Unit 102), 13684SC1 (13684 Stone Circle Unit 101).
- **Street suffixes:** SC=Stone Circle, RP=Rock Point, BP=Boulder Point, PP=Plaster Point, BL=Broadlands, BC=Boulder Creek.

### Email classification types

The email processor classifies emails into these types:
- `arc_form_submission` — Jotform ARC form from a homeowner
- `arc_manager_reply` — Josh Hall replying to an ARC request
- `arc_form_forward` — Forwarded ARC form
- `arc_process_discussion` — Board discussing ARC process
- `wo_status_report` — Automated WO status digest
- `wo_form` — Google Forms work order notification
- `hppr_form` — Homeowner Paid Planting/Removal form
- `board_email` — Board governance email
- `josh_direct` — Josh Hall direct communication
- `homeowner_direct` — Homeowner emailing directly
- `governance` — Policy/governance discussion
- `property_report` — Automated property report (noise)
- `ops_alert` — Operational alert
- `noise` — System noise (Google, GitHub, etc.)

---

## 19. Non-Goals (Phase 1)

- **No editing** — all data is read-only
- **No authentication** — open URL (board-only access via obscurity)
- **No real-time updates** — no WebSocket subscriptions, just fetch on load
- **No email composition** — can't reply from dashboard
- **No file uploads** — can't add documents
- **No user management** — no login, no roles, no preferences
- **No notifications** — no push, email, or SMS alerts
- **No offline support** — requires internet
- **No analytics** — no usage tracking
- **No search across all data** — search is per-page only

These are all Phase 2+ features.

---

## 20. Future Phases (for context, not for this build)

- **Phase 2:** Authentication (Supabase Auth), RLS policies, editing work items
- **Phase 3:** Real-time updates (Supabase Realtime), notifications
- **Phase 4:** Email composition, file uploads, document management
- **Phase 5:** Board meeting prep reports, vendor performance tracking, budget views

---

*End of spec. Claude Code should be able to build this entirely from this document.*