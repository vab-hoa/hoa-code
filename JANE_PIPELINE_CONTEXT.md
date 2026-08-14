# Document Attachment Pipeline Context for Jane

## Cleaner Picture: How Documents Flow from Email to Dashboard

1. **Homeowner submits ARC form on Jotform** → email with attachments arrives
2. **Jane's email processor extracts those attachments**, uploads them to Supabase Storage (`work-item-documents` bucket), creates a row in `work_item_documents` table linked to the ARC work item
3. **Dashboard displays those documents** (with optional user-added titles, editable later in the dashboard)

## Dashboard's Role (Phase 3)

- Store uploaded documents in Supabase Storage
- Display documents with optional titles
- Allow users to edit titles later
- Provide download links (browser opens PDFs/images natively)

## Pipeline's Role (Jane)

- Extract attachments from incoming emails
- Upload files to Supabase Storage bucket `work-item-documents`
- Create `work_item_documents` rows with:
  - `work_item_id` (link to the work item the email created)
  - `file_name` (original filename)
  - `storage_path` (path in Supabase Storage)
  - `content_type` (e.g. application/pdf, image/jpeg)
  - `file_size_bytes` (optional, for reference)
  - `uploaded_by` (can be null or free text like "email_processor")
  - `title` (leave null — users will add titles later in the dashboard if desired)
  - `uploaded_at` (current timestamp)

## Schema (to be applied before Phase 3 implementation)

```sql
CREATE TABLE IF NOT EXISTS work_item_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  title TEXT,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  file_size_bytes BIGINT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_item_documents_work_item
  ON work_item_documents(work_item_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('work-item-documents', 'work-item-documents', true)
ON CONFLICT (id) DO NOTHING;
```

## No Changes Needed to

- Forms themselves (Jotform, Google Forms, email)
- The `source_documents` table (stays for email metadata capture)
- The `issue_email_link` table (stays for general email-to-work-item linking)
- Email classification logic

## Everything Just Works Once

Once Jane's pipeline is populating `work_item_documents` rows, the dashboard will automatically display them. No extra coordination needed.
