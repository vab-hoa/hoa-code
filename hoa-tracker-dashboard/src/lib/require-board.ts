import { NextResponse } from 'next/server'
import { BOARD_COOKIE, boardCookieMatches, issueBoardCookie } from './board-cookie'
import { isBoardMember } from './board'
import { createSupabaseServer } from './supabase-server'

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60,
}

export async function requireBoard() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { ok: false as const, supabase, response: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) }
  }

  const cookieStore = await import('next/headers').then((mod) => mod.cookies())
  const current = cookieStore.get(BOARD_COOKIE)?.value
  if (await boardCookieMatches(current, user.email)) {
    return { ok: true as const, supabase, email: user.email }
  }

  let member = false
  try {
    member = await isBoardMember(user.email)
  } catch (error) {
    console.error('board membership check:', error)
    await supabase.auth.signOut()
    return {
      ok: false as const,
      supabase,
      response: NextResponse.json({ error: 'Could not verify board membership' }, { status: 503 }),
    }
  }

  if (!member) {
    await supabase.auth.signOut()
    return {
      ok: false as const,
      supabase,
      response: NextResponse.json({ error: 'Not a board member' }, { status: 403 }),
    }
  }

  cookieStore.set(BOARD_COOKIE, await issueBoardCookie(user.email), cookieOptions)
  return { ok: true as const, supabase, email: user.email }
}
