import { NextRequest, NextResponse } from 'next/server'
import { requireBoard } from '@/lib/require-board'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireBoard()
  if (!access.ok) return access.response
  const supabase = access.supabase
  const params = request.nextUrl.searchParams
  const q = params.get('q')

  try {
    if (q === 'summary') {
      const { data, error } = await supabase.from('v_dashboard_summary').select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
    if (q === 'aging') {
      const { data, error } = await supabase.from('v_aging_work_items').select('*').order('days_open', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'open') {
      const { data, error } = await supabase.from('v_open_work_items').select('*').order('priority', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'recent-correspondence') {
      const limit = Number(params.get('limit') || 10)
      const { data, error } = await supabase
        .from('correspondence_entries')
        .select('*, work_items (title, category, status)')
        .order('entry_date', { ascending: false })
        .limit(limit)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'work-item') {
      const { data, error } = await supabase.from('work_items').select('*, properties(*)').eq('id', params.get('id') || '').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json(data)
    }
    if (q === 'correspondence') {
      const { data, error } = await supabase
        .from('correspondence_entries')
        .select('*')
        .eq('work_item_id', params.get('id') || '')
        .order('entry_date', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'status-history') {
      const { data, error } = await supabase
        .from('correspondence_entries')
        .select('*')
        .eq('work_item_id', params.get('id') || '')
        .not('old_status', 'is', null)
        .order('entry_date', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'emails') {
      const { data, error } = await supabase
        .from('issue_email_link')
        .select('*, email_message(*)')
        .eq('work_item_id', params.get('id') || '')
        .order('email_message(received_date)', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'documents') {
      const { data, error } = await supabase
        .from('work_item_documents')
        .select('*')
        .eq('work_item_id', params.get('id') || '')
        .order('uploaded_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'notes') {
      const { data, error } = await supabase
        .from('work_item_notes')
        .select('*')
        .eq('work_item_id', params.get('id') || '')
        .order('note_date', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'property-work-items') {
      const { data, error } = await supabase
        .from('work_items')
        .select('*')
        .eq('property_id', params.get('id') || '')
        .is('excluded_at', null)
        .order('created_date', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'source-documents') {
      const { data, error } = await supabase
        .from('source_documents')
        .select('*')
        .eq('property_id', params.get('id') || '')
        .order('received_date', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'inbox') {
      let query = supabase.from('email_message').select('*').order('received_date', { ascending: false })
      const classification = params.get('classification')
      if (classification) query = query.eq('classification', classification)
      if (params.get('isNoise') === 'true') query = query.eq('is_noise', true)
      if (params.get('isNoise') === 'false') query = query.eq('is_noise', false)
      const limit = Number(params.get('limit') || 50)
      const offset = Number(params.get('offset') || 0)
      const { data, error } = await query.range(offset, offset + limit - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'email-by-gmail-id') {
      const { data, error } = await supabase.from('email_message').select('*').eq('gmail_message_id', params.get('id') || '').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json(data)
    }
    if (q === 'email-links') {
      const { data, error } = await supabase
        .from('issue_email_link')
        .select('*, work_items(title, category, status)')
        .eq('email_message_id', params.get('id') || '')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'thread') {
      const { data, error } = await supabase
        .from('email_message')
        .select('*')
        .eq('gmail_thread_id', params.get('id') || '')
        .order('received_date', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    if (q === 'email-stats') {
      const { data, error } = await supabase.from('v_email_processing_stats').select('*').order('message_count', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || [])
    }
    return NextResponse.json({ error: 'Unknown query' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
