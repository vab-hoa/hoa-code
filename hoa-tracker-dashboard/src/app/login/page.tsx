import { LoginButton } from './login-button'
import { safeNext } from '@/lib/board-cookie'

const messages: Record<string, string> = {
  'not-board': 'That Google account is not in board@villasboulders.org.',
  'sign-in-failed': 'Google sign-in did not finish. Try again.',
  'missing-code': 'Google sign-in did not return a code. Try again.',
  'board-check-failed': 'The board membership check failed. Try again in a minute.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const message = params.error ? messages[params.error] : null
  const next = safeNext(params.next)

  return (
    <div className="bg-app-bg min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-ink">Board sign-in</h1>
        <p className="text-sm text-mute mt-2">
          This tracker website is for members of the Villas at the Boulders board. Sign in with the Google account that is on board@villasboulders.org.
        </p>
        {message && (
          <p className="mt-4 text-sm text-red-300 bg-surface border border-edge rounded-lg p-3">{message}</p>
        )}
        <div className="mt-6">
          <LoginButton next={next} />
        </div>
      </div>
    </div>
  )
}
