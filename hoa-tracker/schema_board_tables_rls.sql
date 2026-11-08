-- PDS-004 / PDS-005 / PDS-007
-- Phase 2a pattern: signed-in users may SELECT. Board membership stays in the app.
-- Writes are not granted to anon or authenticated. Server routes use the service role.
-- Does not change people or contacts.

ALTER TABLE email_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE correspondence_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_email_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'email_message', 'work_items', 'work_item_notes', 'work_item_documents',
        'correspondence_entries', 'issue_email_link', 'source_documents'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY email_message_select_authenticated ON email_message
  FOR SELECT TO authenticated USING (true);
CREATE POLICY work_items_select_authenticated ON work_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY work_item_notes_select_authenticated ON work_item_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY work_item_documents_select_authenticated ON work_item_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY correspondence_entries_select_authenticated ON correspondence_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY issue_email_link_select_authenticated ON issue_email_link
  FOR SELECT TO authenticated USING (true);
CREATE POLICY source_documents_select_authenticated ON source_documents
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON email_message, work_items, work_item_notes, work_item_documents,
  correspondence_entries, issue_email_link, source_documents
  FROM anon, authenticated;
GRANT SELECT ON email_message, work_items, work_item_notes, work_item_documents,
  correspondence_entries, issue_email_link, source_documents
  TO authenticated;

-- Views over those tables were granted to anon and run as the owner, which bypasses RLS.
REVOKE ALL ON v_aging_work_items, v_dashboard_summary, v_email_processing_stats,
  v_latest_correspondence, v_open_work_items FROM anon, authenticated;
GRANT SELECT ON v_aging_work_items, v_dashboard_summary, v_email_processing_stats,
  v_latest_correspondence, v_open_work_items TO authenticated;
ALTER VIEW v_aging_work_items SET (security_invoker = true);
ALTER VIEW v_dashboard_summary SET (security_invoker = true);
ALTER VIEW v_email_processing_stats SET (security_invoker = true);
ALTER VIEW v_latest_correspondence SET (security_invoker = true);
ALTER VIEW v_open_work_items SET (security_invoker = true);

-- PDS-007: private bucket. Objects are served with short-lived signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'work-item-documents';

DROP POLICY IF EXISTS anon_delete_storage ON storage.objects;
DROP POLICY IF EXISTS anon_read_storage ON storage.objects;
DROP POLICY IF EXISTS anon_update_storage ON storage.objects;
DROP POLICY IF EXISTS anon_upload_storage ON storage.objects;
