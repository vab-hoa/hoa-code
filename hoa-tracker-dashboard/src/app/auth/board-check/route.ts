import { NextResponse } from 'next/server'
import { BOARD_COOKIE, boardCookieMatches, issueBoardCookie, safeNext } from '@/lib/board-cookie'
import { isBoardMember } from '@/lib/board'
import { createSupabaseServer } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin))
  }

  const jar = await cookies()
  if (await boardCookieMatches(jar.get(BOARD_COOKIE)?.value, user.email)) {
    return NextResponse.redirect(new URL(next, url.origin))
  }

  let member = false
  try {
    member = await isBoardMember(user.email)
  } catch (error) {
    console.error('board membership check:', error)
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=board-check-failed', url.origin))
  }

  if (!member) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=not-board', url.origin))
  }

  const response = NextResponse.redirect(new URL(next, url.origin))
  response.cookies.set(BOARD_COOKIE, await issueBoardCookie(user.email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  })
  return response
}
