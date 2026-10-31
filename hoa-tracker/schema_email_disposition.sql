-- Additive columns for the email-processor rewrite.
-- Safe to re-run. Does not change existing classification values.
-- Apply against the HOA Tracker Supabase database before --write runs.

ALTER TABLE email_message
  ADD COLUMN IF NOT EXISTS disposition text,
  ADD COLUMN IF NOT EXISTS disposition_reason text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

ALTER TABLE email_message DROP CONSTRAINT IF EXISTS email_message_disposition_check;

ALTER TABLE email_message
  ADD CONSTRAINT email_message_disposition_check
  CHECK (
    disposition IS NULL
    OR disposition IN ('new_request', 'update', 'unrelated', 'needs_review', 'system')
  );
