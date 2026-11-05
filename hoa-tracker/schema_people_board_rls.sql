-- Phase 2a: people and contacts are readable by signed-in users only.
-- Board membership is checked in the app (board@villasboulders.org). A session
-- is kept only after that check passes, so "authenticated" here means a board member.
-- Work items stay on their existing anon policies.
--
-- The live table is contacts. Jane's spec name contact_methods is not a table.

DROP POLICY IF EXISTS people_select_anon ON people;
DROP POLICY IF EXISTS "anon read people" ON people;
DROP POLICY IF EXISTS people_select_authenticated ON people;
DROP POLICY IF EXISTS "board members read people" ON people;
CREATE POLICY people_select_authenticated ON people
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS contacts_select_anon ON contacts;
DROP POLICY IF EXISTS "anon read contact_methods" ON contacts;
DROP POLICY IF EXISTS contacts_select_authenticated ON contacts;
DROP POLICY IF EXISTS "board members read contacts" ON contacts;
CREATE POLICY contacts_select_authenticated ON contacts
  FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT ON people FROM anon;
REVOKE SELECT ON contacts FROM anon;
GRANT SELECT ON people TO authenticated;
GRANT SELECT ON contacts TO authenticated;
