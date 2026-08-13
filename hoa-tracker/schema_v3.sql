-- HOA Issue Tracker Schema v3
-- Villas at the Boulders HOA
-- Supabase / PostgreSQL 15+
--
-- Migration from v2 → v3: Adds email tracking, thread management,
-- issue-email linking, WO status snapshots, and decision tracking.
--
-- Safe to run on top of existing v2 schema (uses IF NOT EXISTS everywhere).

-- ============================================================
-- 1. email_message: store every email processed
-- ============================================================
CREATE TABLE IF NOT EXISTS email_message (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT UNIQUE NOT NULL,
  gmail_thread_id TEXT,
  in_reply_to TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound', 'internal')),
  from_name TEXT,
  from_email TEXT,
  to_recipients TEXT[],
  cc_recipients TEXT[],
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_date TIMESTAMPTZ,
  classification TEXT CHECK (classification IN (
    'noise', 'property_report', 'wo_status_report',
    'arc_form_submission', 'arc_manager_reply', 'arc_process_discussion',
    'arc_form_forward', 'wo_form', 'hppr_form',
    'board_email', 'josh_direct', 'homeowner_direct',
    'governance', 'ops_alert', 'unclassified'
  )),
  classification_confidence REAL DEFAULT 1.0,
  is_noise BOOLEAN DEFAULT FALSE,
  parse_payload JSONB DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  raw_headers JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_msg_gmail_id ON email_message(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_msg_thread ON email_message(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_msg_date ON email_message(received_date);
CREATE INDEX IF NOT EXISTS idx_email_msg_class ON email_message(classification);
CREATE INDEX IF NOT EXISTS idx_email_msg_noise ON email_message(is_noise) WHERE is_noise = TRUE;

-- ============================================================
-- 2. email_thread: aggregate Gmail threads
-- ============================================================
CREATE TABLE IF NOT EXISTS email_thread (
  gmail_thread_id TEXT PRIMARY KEY,
  subject_normalized TEXT,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  primary_classification TEXT,
  primary_parcel_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. issue_email_link: many-to-many between work_items and email_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_email_link (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  email_message_id UUID REFERENCES email_message(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN (
    'origin', 'update', 'decision', 'info_request',
    'forward_copy', 'related'
  )),
  match_method TEXT CHECK (match_method IN (
    'parcel_date', 'wo_number', 'thread', 'manual'
  )),
  match_confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(work_item_id, email_message_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_email_link_work ON issue_email_link(work_item_id);
CREATE INDEX IF NOT EXISTS idx_issue_email_link_email ON issue_email_link(email_message_id);

-- ============================================================
-- 4. wo_status_snapshot: snapshots from WO status report emails
-- ============================================================
CREATE TABLE IF NOT EXISTS wo_status_snapshot (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_email_id UUID REFERENCES email_message(id),
  snapshot_date TIMESTAMPTZ,
  wo_number TEXT,
  parcel_code TEXT,
  homeowner_name TEXT,
  status_raw TEXT,
  description TEXT,
  vendor TEXT,
  created_date_raw TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_snapshot_wo ON wo_status_snapshot(wo_number);
CREATE INDEX IF NOT EXISTS idx_wo_snapshot_date ON wo_status_snapshot(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_wo_snapshot_email ON wo_status_snapshot(source_email_id);
CREATE INDEX IF NOT EXISTS idx_wo_snapshot_parcel ON wo_status_snapshot(parcel_code);

-- ============================================================
-- 5. Add columns to work_items
-- ============================================================
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS decision TEXT
    CHECK (decision IN (
      'approved', 'approved_with_conditions', 'denied',
      'no_approval_needed', 'pending', 'info_requested'
    ));

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS decision_rationale TEXT;

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS decision_by TEXT;

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ;

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS multi_item_parent_id UUID REFERENCES work_items(id);

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS external_ids JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_work_items_decision ON work_items(decision);
CREATE INDEX IF NOT EXISTS idx_work_items_multi_parent ON work_items(multi_item_parent_id);

-- ============================================================
-- 6. Add columns to source_documents
-- ============================================================
ALTER TABLE source_documents
  ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_source_docs_gmail_thread ON source_documents(gmail_thread_id);

-- ============================================================
-- 7. Updated views
-- ============================================================

-- Must drop existing views first because CREATE OR REPLACE VIEW
-- cannot change column names/order of an existing view.
DROP VIEW IF EXISTS v_open_work_items CASCADE;
DROP VIEW IF EXISTS v_aging_work_items CASCADE;
DROP VIEW IF EXISTS v_latest_correspondence CASCADE;
DROP VIEW IF EXISTS v_dashboard_summary CASCADE;
DROP VIEW IF EXISTS v_email_processing_stats CASCADE;

-- v_open_work_items — add decision column
CREATE OR REPLACE VIEW v_open_work_items AS
SELECT
  wi.id, wi.title, wi.category, wi.status, wi.priority,
  wi.assigned_to, wi.vendor, wi.estimated_cost, wi.bid_amount,
  wi.created_date, wi.due_date, wi.scheduled_date,
  wi.decision, wi.decision_rationale, wi.decision_by, wi.decision_at,
  p.parcel_code, p.address, p.owner_name
FROM work_items wi
LEFT JOIN properties p ON wi.property_id = p.id
WHERE wi.status NOT IN ('closed', 'cancelled', 'denied')
ORDER BY wi.priority DESC, wi.updated_date DESC;

-- v_aging_work_items — unchanged
CREATE OR REPLACE VIEW v_aging_work_items AS
SELECT
  wi.id, wi.title, wi.category, wi.status,
  p.parcel_code, p.address, p.owner_name,
  wi.created_date,
  a.max_days,
  EXTRACT(EPOCH FROM (NOW() - wi.created_date))/86400 as days_open,
  wi.assigned_to, wi.vendor
FROM work_items wi
JOIN aging_config a ON a.category = wi.category AND a.status = wi.status
LEFT JOIN properties p ON wi.property_id = p.id
WHERE wi.status NOT IN ('closed', 'cancelled', 'denied')
  AND EXTRACT(EPOCH FROM (NOW() - wi.created_date))/86400 > a.max_days
ORDER BY days_open DESC;

-- v_latest_correspondence — join through issue_email_link to email_message
CREATE OR REPLACE VIEW v_latest_correspondence AS
SELECT DISTINCT ON (wi.id)
  wi.id as work_item_id,
  wi.title,
  wi.status,
  COALESCE(em.received_date, ce.entry_date) as latest_date,
  COALESCE(em.from_name, ce.author_name) as latest_author,
  COALESCE(em.classification, ce.entry_type) as latest_type,
  LEFT(COALESCE(em.body_text, ce.content), 200) as latest_snippet
FROM work_items wi
LEFT JOIN issue_email_link iel ON iel.work_item_id = wi.id
LEFT JOIN email_message em ON em.id = iel.email_message_id
LEFT JOIN correspondence_entries ce ON ce.work_item_id = wi.id
ORDER BY wi.id, COALESCE(em.received_date, ce.entry_date) DESC;

-- v_dashboard_summary — add decision counts
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  COUNT(*) FILTER (WHERE status NOT IN ('closed', 'cancelled', 'denied')) as total_open,
  COUNT(*) FILTER (WHERE status = 'new') as new_count,
  COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_count,
  COUNT(*) FILTER (WHERE status = 'awaiting_quote') as awaiting_quote_count,
  COUNT(*) FILTER (WHERE status = 'service_request') as service_request_count,
  COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_count,
  COUNT(*) FILTER (WHERE status = 'pending_board_review') as pending_board_count,
  COUNT(*) FILTER (WHERE status = 'awaiting_board_approval') as awaiting_board_approval,
  COUNT(*) FILTER (WHERE status = 'under_review_with_architect') as arc_in_review,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE status = 'approved_with_conditions') as approved_with_conditions_count,
  COUNT(*) FILTER (WHERE status = 'denied') as denied_count,
  COUNT(*) FILTER (WHERE decision = 'approved') as decision_approved,
  COUNT(*) FILTER (WHERE decision = 'approved_with_conditions') as decision_approved_conditions,
  COUNT(*) FILTER (WHERE decision = 'denied') as decision_denied,
  COUNT(*) FILTER (WHERE decision = 'no_approval_needed') as decision_no_approval_needed,
  COUNT(*) FILTER (WHERE decision = 'pending') as decision_pending,
  COUNT(*) FILTER (WHERE decision = 'info_requested') as decision_info_requested,
  COUNT(*) as total_all_time
FROM work_items;

-- ============================================================
-- 8. Email stats view (for monitoring processor health)
-- ============================================================
CREATE OR REPLACE VIEW v_email_processing_stats AS
SELECT
  classification,
  COUNT(*) as message_count,
  COUNT(*) FILTER (WHERE is_noise = TRUE) as noise_count,
  MIN(received_date) as earliest_email,
  MAX(received_date) as latest_email
FROM email_message
GROUP BY classification
ORDER BY message_count DESC;
