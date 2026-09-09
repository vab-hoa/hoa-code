import { google } from 'googleapis'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

type ServiceAccount = {
  client_email: string
  private_key: string
  [key: string]: unknown
}

function loadServiceAccount(): ServiceAccount {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64
  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf-8')
    const sa = JSON.parse(json) as ServiceAccount
    if (sa.private_key && typeof sa.private_key === 'string') {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n')
    }
    return sa
  }

  // Local fallback (jane / oregano style path)
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    join(homedir(), '.config/openclaw/google-service-account.json'),
  ].filter(Boolean) as string[]

  for (const path of candidates) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8')) as ServiceAccount
    }
  }

  throw new Error(
    'Google service account not configured (set GOOGLE_SERVICE_ACCOUNT_B64)'
  )
}

/** JWT client for the given scopes. Sheets works without subject impersonation. */
export async function getGoogleJwt(scopes: string[], subject?: string) {
  const sa = loadServiceAccount()
  const jwtClient = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes,
    subject,
  })
  await jwtClient.authorize()
  return jwtClient
}
