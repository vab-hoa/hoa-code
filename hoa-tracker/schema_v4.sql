-- HOA Issue Tracker Schema v4
-- Villas at the Boulders HOA
-- Supabase / PostgreSQL 15+
--
-- Migration from v3 → v4: Adds soft-delete/exclusion mechanism for bad/stale data.
-- Adds excluded_at, excluded_by, excluded_reason columns to work_items.
-- Updated views filter out excluded items (excluded_at IS NULL).
--
-- Safe to run on top of existing v3 schema (uses IF NOT EXISTS and CREATE OR REPLACE VIEW).

-- ============================================================
-- 1. Add soft-delete columns to work_items
-- ============================================================
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ;

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS excluded_by TEXT;

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS excluded_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_work_items_excluded ON work_items(excluded_at);

-- ============================================================
-- 2. Updated views (add excluded_at IS NULL filter)
-- ============================================================

-- Must drop existing views first because we're modifying underlying table
DROP VIEW IF EXISTS v_open_work_items CASCADE;
DROP VIEW IF EXISTS v_aging_work_items CASCADE;
DROP VIEW IF EXISTS v_latest_correspondence CASCADE;
DROP VIEW IF EXISTS v_dashboard_summary CASCADE;

-- v_open_work_items — exclude soft-deleted items
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
  AND wi.excluded_at IS NULL
ORDER BY wi.priority DESC, wi.updated_date DESC;

-- v_aging_work_items — exclude soft-deleted items
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
  AND wi.excluded_at IS NULL
  AND EXTRACT(EPOCH FROM (NOW() - wi.created_date))/86400 > a.max_days
ORDER BY days_open DESC;

-- v_latest_correspondence — exclude soft-deleted items
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
WHERE wi.excluded_at IS NULL
ORDER BY wi.id, COALESCE(em.received_date, ce.entry_date) DESC;

-- v_dashboard_summary — exclude soft-deleted items
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  COUNT(*) FILTER (WHERE status NOT IN ('closed', 'cancelled', 'denied') AND excluded_at IS NULL) as total_open,
  COUNT(*) FILTER (WHERE status = 'new' AND excluded_at IS NULL) as new_count,
  COUNT(*) FILTER (WHERE status = 'on_hold' AND excluded_at IS NULL) as on_hold_count,
  COUNT(*) FILTER (WHERE status = 'awaiting_quote' AND excluded_at IS NULL) as awaiting_quote_count,
  COUNT(*) FILTER (WHERE status = 'service_request' AND excluded_at IS NULL) as service_request_count,
  COUNT(*) FILTER (WHERE status = 'scheduled' AND excluded_at IS NULL) as scheduled_count,
  COUNT(*) FILTER (WHERE status = 'pending_board_review' AND excluded_at IS NULL) as pending_board_count,
  COUNT(*) FILTER (WHERE status = 'awaiting_board_approval' AND excluded_at IS NULL) as awaiting_board_approval,
  COUNT(*) FILTER (WHERE status = 'under_review_with_architect' AND excluded_at IS NULL) as arc_in_review,
  COUNT(*) FILTER (WHERE status = 'approved' AND excluded_at IS NULL) as approved_count,
  COUNT(*) FILTER (WHERE status = 'approved_with_conditions' AND excluded_at IS NULL) as approved_with_conditions_count,
  COUNT(*) FILTER (WHERE status = 'denied' AND excluded_at IS NULL) as denied_count,
  COUNT(*) FILTER (WHERE excluded_at IS NULL) as total_all_time
FROM work_items;

-- ============================================================
-- 3. Recreate v_email_processing_stats (unchanged but must recreate after DROP CASCADE)
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
