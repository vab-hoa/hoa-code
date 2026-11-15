-- PDS-008: authenticated is not enough. SELECT requires a row in board_members
-- whose email matches the JWT. The sync workflow fills that table from
-- board@villasboulders.org. Service role writes are unchanged.
--
-- board_members itself is not readable by anon or authenticated. The policy
-- predicate therefore calls is_board_member(), which is SECURITY DEFINER so
-- the check can see the lookup table. An inline EXISTS would fail with
-- permission denied or always return false.
--
-- Idempotent. Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS public.board_members (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.board_members FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.board_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_board_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

REVOKE ALL ON FUNCTION public.is_board_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_board_member() TO authenticated;

DROP POLICY IF EXISTS people_select_anon ON public.people;
DROP POLICY IF EXISTS "anon read people" ON public.people;
DROP POLICY IF EXISTS people_select_authenticated ON public.people;
DROP POLICY IF EXISTS "board members read people" ON public.people;
CREATE POLICY people_select_authenticated ON public.people
  FOR SELECT TO authenticated
  USING (public.is_board_member());

DROP POLICY IF EXISTS contacts_select_anon ON public.contacts;
DROP POLICY IF EXISTS "anon read contact_methods" ON public.contacts;
DROP POLICY IF EXISTS contacts_select_authenticated ON public.contacts;
DROP POLICY IF EXISTS "board members read contacts" ON public.contacts;
CREATE POLICY contacts_select_authenticated ON public.contacts
  FOR SELECT TO authenticated
  USING (public.is_board_member());

REVOKE ALL ON TABLE public.people FROM anon;
REVOKE ALL ON TABLE public.contacts FROM anon;
GRANT SELECT ON TABLE public.people TO authenticated;
GRANT SELECT ON TABLE public.contacts TO authenticated;

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
      AND (
        roles && ARRAY['anon']::name[]
        OR (cmd = 'SELECT' AND roles && ARRAY['authenticated']::name[])
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY email_message_select_authenticated ON public.email_message
  FOR SELECT TO authenticated USING (public.is_board_member());
CREATE POLICY work_items_select_authenticated ON public.work_items
  FOR SELECT TO authenticated USING (public.is_board_member());
CREATE POLICY work_item_notes_select_authenticated ON public.work_item_notes
  FOR SELECT TO authenticated USING (public.is_board_member());
CREATE POLICY work_item_documents_select_authenticated ON public.work_item_documents
  FOR SELECT TO authenticated USING (public.is_board_member());
CREATE POLICY correspondence_entries_select_authenticated ON public.correspondence_entries
  FOR SELECT TO authenticated USING (public.is_board_member());
CREATE POLICY issue_email_link_select_authenticated ON public.issue_email_link
  FOR SELECT TO authenticated USING (public.is_board_member());
CREATE POLICY source_documents_select_authenticated ON public.source_documents
  FOR SELECT TO authenticated USING (public.is_board_member());

REVOKE ALL ON TABLE public.email_message, public.work_items, public.work_item_notes,
  public.work_item_documents, public.correspondence_entries, public.issue_email_link,
  public.source_documents
  FROM anon;
GRANT SELECT ON TABLE public.email_message, public.work_items, public.work_item_notes,
  public.work_item_documents, public.correspondence_entries, public.issue_email_link,
  public.source_documents
  TO authenticated;

-- Views stay security_invoker so base-table RLS applies. Authenticated may
-- still SELECT them; anon may not. service_role grants are left alone.
REVOKE ALL ON public.v_aging_work_items, public.v_dashboard_summary,
  public.v_email_processing_stats, public.v_latest_correspondence,
  public.v_open_work_items
  FROM anon, authenticated;
GRANT SELECT ON public.v_aging_work_items, public.v_dashboard_summary,
  public.v_email_processing_stats, public.v_latest_correspondence,
  public.v_open_work_items
  TO authenticated;

ALTER VIEW public.v_aging_work_items SET (security_invoker = true);
ALTER VIEW public.v_dashboard_summary SET (security_invoker = true);
ALTER VIEW public.v_email_processing_stats SET (security_invoker = true);
ALTER VIEW public.v_latest_correspondence SET (security_invoker = true);
ALTER VIEW public.v_open_work_items SET (security_invoker = true);

COMMIT;
