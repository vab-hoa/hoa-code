-- Phase 2a: people and contacts are readable by signed-in users only.
-- PDS-008: membership is board_members via is_board_member() (see
-- schema_board_members_rls.sql). Apply that file first. Rerunning this file
-- keeps the board predicate; it does not restore USING (true).
--
-- The live table is contacts. Jane's spec name contact_methods is not a table.

DROP POLICY IF EXISTS people_select_anon ON people;
DROP POLICY IF EXISTS "anon read people" ON people;
DROP POLICY IF EXISTS people_select_authenticated ON people;
DROP POLICY IF EXISTS "board members read people" ON people;
CREATE POLICY people_select_authenticated ON people
  FOR SELECT TO authenticated
  USING (public.is_board_member());

DROP POLICY IF EXISTS contacts_select_anon ON contacts;
DROP POLICY IF EXISTS "anon read contact_methods" ON contacts;
DROP POLICY IF EXISTS contacts_select_authenticated ON contacts;
DROP POLICY IF EXISTS "board members read contacts" ON contacts;
CREATE POLICY contacts_select_authenticated ON contacts
  FOR SELECT TO authenticated
  USING (public.is_board_member());

REVOKE SELECT ON people FROM anon;
REVOKE SELECT ON contacts FROM anon;
GRANT SELECT ON people TO authenticated;
GRANT SELECT ON contacts TO authenticated;
