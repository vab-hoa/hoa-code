import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { BOARD_COOKIE, boardCookieMatches, safeNext } from '@/lib/board-cookie'

function isPeoplePath(pathname: string): boolean {
  return pathname === '/properties' || pathname.startsWith('/properties/') || pathname === '/api/directory'
}

function isBoardApi(pathname: string): boolean {
  return pathname === '/api/send-email'
    || pathname === '/api/board'
    || pathname === '/api/work-items'
    || pathname === '/api/work-item-documents'
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  if (!isPeoplePath(pathname) && !isBoardApi(pathname)) return response

  const carry = (target: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => {
      target.cookies.set(cookie)
    })
    return target
  }

  if (!user?.email) {
    if (pathname.startsWith('/api/')) {
      return carry(NextResponse.json({ error: 'Sign in required' }, { status: 401 }))
    }
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.searchParams.set('next', pathname)
    return carry(NextResponse.redirect(login))
  }

  const allowed = await boardCookieMatches(request.cookies.get(BOARD_COOKIE)?.value, user.email)
  if (allowed) return response

  if (pathname.startsWith('/api/')) return response
  const check = request.nextUrl.clone()
  check.pathname = '/auth/board-check'
  check.searchParams.set('next', safeNext(pathname))
  return carry(NextResponse.redirect(check))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
