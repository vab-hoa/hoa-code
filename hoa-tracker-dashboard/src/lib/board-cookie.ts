export const BOARD_COOKIE = 'hoa_board'
const HOUR = 60 * 60

function decodeBase64(value: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('utf8')
  return atob(value)
}

export function boardCookieSecret(): string {
  if (process.env.BOARD_COOKIE_SECRET) return process.env.BOARD_COOKIE_SECRET
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64
  if (b64) {
    const parsed = JSON.parse(decodeBase64(b64)) as { private_key?: string }
    if (parsed.private_key) return parsed.private_key
  }
  throw new Error('Board cookie secret is not configured')
}

async function sign(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const raw = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  const bytes = new Uint8Array(raw)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function issueBoardCookie(email: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + HOUR
  const body = `${email.toLowerCase()}|${exp}`
  const sig = await sign(boardCookieSecret(), body)
  return `${body}|${sig}`
}

export async function boardCookieMatches(raw: string | undefined, email: string): Promise<boolean> {
  if (!raw) return false
  const parts = raw.split('|')
  if (parts.length !== 3) return false
  const [cookieEmail, expText, sig] = parts
  if (cookieEmail !== email.toLowerCase()) return false
  const exp = Number(expText)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const expected = await sign(boardCookieSecret(), `${cookieEmail}|${expText}`)
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/properties'
  }
  return value
}
