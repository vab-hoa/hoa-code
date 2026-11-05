import { NextResponse } from 'next/server'
import { BOARD_COOKIE } from '@/lib/board-cookie'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 })
  response.cookies.set(BOARD_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}
