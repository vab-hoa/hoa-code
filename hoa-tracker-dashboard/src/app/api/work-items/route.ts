import { NextRequest, NextResponse } from 'next/server'
import { requireBoard } from '@/lib/require-board'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const access = await requireBoard()
  if (!access.ok) return access.response

  let body: {
    action?: string
    id?: string
    status?: string
    closedDate?: string
    excludedBy?: string
    excludedReason?: string
    noteDate?: string
    content?: string
    source?: string | null
    documentId?: string
    title?: string | null
    sourceDocumentId?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const id = body.id || ''

  try {
    if (body.action === 'status') {
      const { error } = await admin.from('work_items').update({
        status: body.status,
        status_changed_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'reset-clock') {
      const { error } = await admin.from('work_items').update({
        status_changed_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'complete') {
      const { data: existing, error: fetchError } = await admin.from('work_items').select('id, status').eq('id', id).single()
      if (fetchError || !existing) {
        return NextResponse.json({ success: false, error: fetchError?.message || 'Item not found' }, { status: 404 })
      }
      const { error } = await admin.from('work_items').update({
        status: body.status,
        closed_date: body.closedDate || new Date().toISOString().split('T')[0],
      }).eq('id', id)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'exclude') {
      if (!body.excludedBy?.trim() || !body.excludedReason?.trim()) {
        return NextResponse.json({ error: 'Name and reason are required' }, { status: 400 })
      }
      const { error } = await admin.from('work_items').update({
        excluded_at: new Date().toISOString(),
        excluded_by: body.excludedBy,
        excluded_reason: body.excludedReason,
      }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'note') {
      if (!body.noteDate || !body.content) {
        return NextResponse.json({ error: 'Date and content are required' }, { status: 400 })
      }
      const { data, error } = await admin.from('work_item_notes').insert({
        work_item_id: id,
        note_date: body.noteDate,
        content: body.content,
        source: body.source || null,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    if (body.action === 'document-title') {
      const { error } = await admin.from('work_item_documents').update({ title: body.title ?? null }).eq('id', body.documentId || '')
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete') {
      await admin.from('wo_status_snapshot').delete().eq('work_item_id', id)
      if (body.sourceDocumentId) {
        await admin.from('work_items').update({ source_document_id: null }).eq('id', id)
        await admin.from('source_documents').delete().eq('id', body.sourceDocumentId)
      }
      const { error } = await admin.from('work_items').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
