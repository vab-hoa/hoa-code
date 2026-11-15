import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const BOARD_GROUP = 'board@villasboulders.org'
const SCOPE = 'https://www.googleapis.com/auth/admin.directory.group'
const SUBJECT = 'admin@villasboulders.org'

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required')
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(json)
  return {
    client_email: parsed.client_email,
    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
  }
}

async function listMembers(admin, groupKey) {
  const members = []
  let pageToken
  do {
    const response = await admin.members.list({
      groupKey,
      maxResults: 200,
      pageToken,
    })
    members.push(...(response.data.members || []))
    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)
  return members
}

/** User emails in the group, including one-level nested groups. Same walk as board.ts. */
async function boardEmails(admin) {
  const emails = new Set()
  const seen = new Set()

  async function collect(groupKey) {
    const key = groupKey.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const members = await listMembers(admin, groupKey)
    for (const member of members) {
      const email = (member.email || '').trim().toLowerCase()
      if (!email) continue
      if (member.type === 'GROUP') {
        await collect(email)
        continue
      }
      emails.add(email)
    }
  }

  await collect(BOARD_GROUP)
  return [...emails]
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

  const account = serviceAccount()
  const auth = new google.auth.JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: [SCOPE],
    subject: SUBJECT,
  })
  const admin = google.admin({ version: 'directory_v1', auth })
  const emails = await boardEmails(admin)
  if (emails.length === 0) {
    throw new Error('Google returned no board members; refusing to empty board_members')
  }

  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data: existing, error: readError } = await db.from('board_members').select('email')
  if (readError) throw new Error(readError.message)

  const have = new Set((existing || []).map((row) => String(row.email).toLowerCase()))
  const want = new Set(emails)
  const remove = [...have].filter((email) => !want.has(email))
  const add = emails.filter((email) => !have.has(email))

  if (remove.length > 0) {
    const { error } = await db.from('board_members').delete().in('email', remove)
    if (error) throw new Error(error.message)
  }
  if (add.length > 0) {
    const { error } = await db.from('board_members').insert(add.map((email) => ({ email })))
    if (error) throw new Error(error.message)
  }

  console.log(`board_members sync ok: ${emails.length} members, ${add.length} added, ${remove.length} removed`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
