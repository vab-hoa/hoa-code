'use client'

import { createSupabaseBrowser } from '@/lib/supabase-browser'

export function LoginButton({ next }: { next: string }) {
  async function signIn() {
    const supabase = createSupabaseBrowser()
    const redirectTo = new URL('/auth/callback', window.location.origin)
    redirectTo.searchParams.set('next', next)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) console.error(error)
  }

  return (
    <button
      type="button"
      onClick={signIn}
      className="px-4 py-2 rounded-lg bg-[#0e8c0e] text-white text-sm font-medium hover:opacity-90"
    >
      Sign in with Google
    </button>
  )
}
