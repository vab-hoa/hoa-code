-- HOA Issue Tracker Schema v5
-- Villas at the Boulders HOA
-- Supabase / PostgreSQL 15+
--
-- Migration from v4 → v5: Adds work_item_documents table for file attachments
-- and creates the Supabase Storage bucket for document storage.
--
-- Safe to run on top of existing v4 schema (uses IF NOT EXISTS).

-- ============================================================
-- 1. work_item_documents: Store metadata for uploaded files
-- ============================================================
CREATE TABLE IF NOT EXISTS work_item_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  title TEXT,                          -- optional, user-editable description
  file_name TEXT NOT NULL,             -- original uploaded filename
  storage_path TEXT NOT NULL,          -- path in Supabase Storage bucket
  content_type TEXT,                   -- MIME type (e.g. application/pdf, image/jpeg)
  file_size_bytes BIGINT,              -- file size in bytes, for reference
  uploaded_by TEXT,                    -- free-text name of uploader (no auth yet)
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_item_documents_work_item
  ON work_item_documents(work_item_id);

-- ============================================================
-- 2. Create Supabase Storage bucket for document files
-- ============================================================
-- Note: Bucket is set to PUBLIC, matching the existing "no auth, board-only via
-- obscure URL" trust model of the dashboard. If you later want to restrict access,
-- change 'true' to 'false' and add a storage.objects policy.
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-item-documents', 'work-item-documents', true)
ON CONFLICT (id) DO NOTHING;
