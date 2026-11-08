import { NextRequest, NextResponse } from 'next/server'
import { requireBoard } from '@/lib/require-board'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'work-item-documents'
const SIGNED_URL_SECONDS = 300

function safePath(path: string): boolean {
  return Boolean(path) && !path.startsWith('/') && !path.split('/').includes('..')
}

export async function GET(request: NextRequest) {
  const access = await requireBoard()
  if (!access.ok) return access.response
  const path = request.nextUrl.searchParams.get('path') || ''
  if (!safePath(path)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'Could not sign URL' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS })
}

export async function POST(request: NextRequest) {
  const access = await requireBoard()
  if (!access.ok) return access.response

  const form = await request.formData()
  const file = form.get('file')
  const workItemId = String(form.get('workItemId') || '')
  const title = String(form.get('title') || '')
  const uploadedBy = String(form.get('uploadedBy') || 'Unknown')
  if (!(file instanceof File) || !workItemId) {
    return NextResponse.json({ error: 'File and work item are required' }, { status: 400 })
  }

  const storagePath = `${workItemId}/${crypto.randomUUID()}-${file.name}`
  const admin = createSupabaseAdmin()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: file.type || undefined,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data, error } = await admin.from('work_item_documents').insert({
    work_item_id: workItemId,
    title: title || null,
    file_name: file.name,
    storage_path: storagePath,
    content_type: file.type || null,
    file_size_bytes: file.size,
    uploaded_by: uploadedBy,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
