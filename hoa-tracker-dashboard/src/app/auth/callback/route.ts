import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { BOARD_COOKIE, issueBoardCookie, safeNext } from '@/lib/board-cookie'
import { isBoardMember } from '@/lib/board'

export const runtime = 'nodejs'

const boardCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60,
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const cookieStore = await cookies()
  let response = NextResponse.redirect(new URL(next, url.origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const fail = (error: string) => {
    const target = NextResponse.redirect(new URL(`/login?error=${error}`, url.origin))
    response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
    return target
  }

  if (!code) return fail('missing-code')

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('auth callback:', error)
    return fail('sign-in-failed')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    await supabase.auth.signOut()
    return fail('sign-in-failed')
  }

  let member = false
  try {
    member = await isBoardMember(user.email)
  } catch (checkError) {
    console.error('board membership check:', checkError)
    await supabase.auth.signOut()
    return fail('board-check-failed')
  }

  if (!member) {
    await supabase.auth.signOut()
    return fail('not-board')
  }

  response.cookies.set(BOARD_COOKIE, await issueBoardCookie(user.email), boardCookie)
  return response
}
