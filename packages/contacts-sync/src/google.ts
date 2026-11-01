import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { google } from 'googleapis'
import { IGNORED_GROUPS, type GooglePerson } from './parse.js'

const SUBJECT = 'admin@villasboulders.org'
const SCOPE = ['https://www.googleapis.com/auth/contacts.readonly']
const SA_FILE = `${homedir()}/.config/openclaw/google-service-account.json`

interface ServiceAccount {
  client_email: string
  private_key: string
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const json = raw
    ? (raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'))
    : readFileSync(SA_FILE, 'utf8')
  const parsed = JSON.parse(json) as ServiceAccount
  return {
    client_email: parsed.client_email,
    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
  }
}

export async function loadGoogleContacts(): Promise<{ people: GooglePerson[]; groups: Map<string, string> }> {
  const account = serviceAccount()
  const auth = new google.auth.JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: SCOPE,
    subject: SUBJECT,
  })
  const peopleApi = google.people({ version: 'v1', auth })

  const groups = new Map<string, string>()
  let groupToken: string | undefined
  do {
    const res = await peopleApi.contactGroups.list({ pageSize: 200, pageToken: groupToken })
    for (const group of res.data.contactGroups || []) {
      if (group.groupType === 'SYSTEM') continue
      if (!group.resourceName || !group.name) continue
      if (IGNORED_GROUPS.has(group.name.trim().toLowerCase())) continue
      groups.set(group.resourceName, group.name)
    }
    groupToken = res.data.nextPageToken || undefined
  } while (groupToken)

  const people: GooglePerson[] = []
  let pageToken: string | undefined
  do {
    const res = await peopleApi.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,addresses,memberships',
      pageToken,
    })
    people.push(...((res.data.connections || []) as GooglePerson[]))
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return { people, groups }
}
