-- HOA Issue Tracker Schema v6
-- Villas at the Boulders HOA
-- Supabase / PostgreSQL 15+
--
-- Migration from v5 → v6: lets the nightly Keystone import (keystone-scraper) add
-- Keystone work-order/ARC notes and attachments without ever duplicating them.
--
-- Each imported row carries a source_key naming exactly where it came from, e.g.
--   keystone:wo-note:110259:<hash of date+text>
--   keystone:wo-attachment:80145
-- and a unique index on source_key makes a repeat import a no-op. Rows created by the
-- dashboard or the email processor leave source_key NULL (NULLs never collide).
--
-- Safe to run more than once (IF NOT EXISTS). Adds columns and indexes only; changes and
-- deletes no existing data.

-- ============================================================
-- 1. work_item_notes: where each note came from
-- ============================================================
ALTER TABLE work_item_notes ADD COLUMN IF NOT EXISTS source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_item_notes_source_key
    ON work_item_notes (source_key);

-- ============================================================
-- 2. work_item_documents: where each document came from
-- ============================================================
ALTER TABLE work_item_documents ADD COLUMN IF NOT EXISTS source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_item_documents_source_key
    ON work_item_documents (source_key);
