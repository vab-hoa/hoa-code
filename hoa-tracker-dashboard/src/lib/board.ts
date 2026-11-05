import { google } from 'googleapis'
import { getGoogleJwt } from './google-sa'

const BOARD_GROUP = 'board@villasboulders.org'
const SCOPE = 'https://www.googleapis.com/auth/admin.directory.group'
const SUBJECT = 'admin@villasboulders.org'

type Member = { email?: string | null; type?: string | null }

async function listMembers(groupKey: string): Promise<Member[]> {
  const auth = await getGoogleJwt([SCOPE], SUBJECT)
  const admin = google.admin({ version: 'directory_v1', auth })
  const members: Member[] = []
  let pageToken: string | undefined
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

/** Direct and one-level nested members. hasMember rejects external Gmail addresses. */
export async function isBoardMember(email: string): Promise<boolean> {
  const want = email.trim().toLowerCase()
  if (!want) return false
  const seen = new Set<string>()

  async function collect(groupKey: string): Promise<boolean> {
    const key = groupKey.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    const members = await listMembers(groupKey)
    for (const member of members) {
      const memberEmail = (member.email || '').toLowerCase()
      if (!memberEmail) continue
      if (member.type === 'GROUP') {
        if (await collect(memberEmail)) return true
        continue
      }
      if (memberEmail === want) return true
    }
    return false
  }

  return collect(BOARD_GROUP)
}
