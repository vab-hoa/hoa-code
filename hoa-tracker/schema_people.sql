-- People and contacts, synced from Google Contacts (admin@villasboulders.org).
--
-- Decisions (Dee, 2026-11-01):
--   * A contact that disappears is kept and marked inactive. A later dashboard
--     purge deletes the people row; contacts cascade. This file does not purge.
--   * Non-owner occupants are their own people rows (role non_owner_occupant).
--   * Emails and phones are rows in contacts, not columns on people.
--   * properties.owner_name / owner_email / owner_phone are retired in
--     schema_people_drop_owner.sql. Apply that only after the dashboard reading
--     people is the live deployment. Do not run it as part of this file.
--
-- Safe to re-run. Does not modify properties.

CREATE TABLE IF NOT EXISTS people (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_resource_name TEXT UNIQUE,
  google_etag TEXT,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  parcel_code TEXT,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN (
    'owner_occupant',
    'non_occupant_owner',
    'non_owner_occupant',
    'household_member'
  )),
  labels TEXT[] NOT NULL DEFAULT '{}',
  raw_address TEXT,
  street TEXT,
  street_number TEXT,
  unit TEXT,
  inactive BOOLEAN NOT NULL DEFAULT FALSE,
  inactive_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'google_contacts',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE people IS
  'One row per Google contact that parses to an HOA parcel. Inactive rows are retained until a future purge.';
COMMENT ON COLUMN people.inactive IS
  'True when this Google contact is no longer in the HOA sync set. The row stays. Deleting the row is the purge; contacts cascade.';
COMMENT ON COLUMN people.role IS
  'From the Google Contacts label: owner-occupant, non-occupant owner, non-owner occupant, or household_member when the address matches and none of those labels are set.';

CREATE INDEX IF NOT EXISTS people_parcel_code_idx ON people (parcel_code);
CREATE INDEX IF NOT EXISTS people_property_id_idx ON people (property_id);
CREATE INDEX IF NOT EXISTS people_role_idx ON people (role);
CREATE INDEX IF NOT EXISTS people_inactive_idx ON people (inactive);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email', 'phone')),
  value TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, kind, value)
);

COMMENT ON TABLE contacts IS
  'Every email and phone on a person. Replaced on each contacts sync. Cascade-deleted when the person is purged.';

CREATE INDEX IF NOT EXISTS contacts_person_id_idx ON contacts (person_id);
CREATE INDEX IF NOT EXISTS contacts_email_lower_idx ON contacts (lower(value)) WHERE kind = 'email';

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS people_select_anon ON people;
CREATE POLICY people_select_anon ON people FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS people_select_authenticated ON people;
CREATE POLICY people_select_authenticated ON people FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS contacts_select_anon ON contacts;
CREATE POLICY contacts_select_anon ON contacts FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS contacts_select_authenticated ON contacts;
CREATE POLICY contacts_select_authenticated ON contacts FOR SELECT TO authenticated USING (true);

GRANT SELECT ON people TO anon, authenticated;
GRANT SELECT ON contacts TO anon, authenticated;
GRANT ALL ON people TO service_role;
GRANT ALL ON contacts TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON people FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON contacts FROM anon, authenticated;
