import { google, type gmail_v1 } from 'googleapis'
import { extractAddresses, parseAddress, stripHtml } from './text.js'
import type { InboundAttachment, InboundEmail } from './types.js'

export function gmailClient(scopes = ['https://www.googleapis.com/auth/gmail.readonly']): gmail_v1.Gmail {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required')
  const json = raw.trim().startsWith('{')
    ? JSON.parse(raw) as { client_email: string; private_key: string }
    : JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as { client_email: string; private_key: string }
  const auth = new google.auth.JWT({
    email: json.client_email,
    key: String(json.private_key).replace(/\\n/g, '\n'),
    scopes,
    subject: 'admin@villasboulders.org',
  })
  return google.gmail({ version: 'v1', auth })
}

export async function fetchGmail(days: number): Promise<InboundEmail[]> {
  const gmail = gmailClient()
  const since = new Date(Date.now() - days * 86400000)
  const stamp = since.toISOString().slice(0, 10).replace(/-/g, '/')
  const q = `after:${stamp} -subject:"[HOA Tracker]"`
  const refs: gmail_v1.Schema$Message[] = []
  let pageToken: string | undefined
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100, pageToken })
    refs.push(...(res.data.messages || []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken && refs.length < 500)

  const emails: InboundEmail[] = []
  for (const ref of refs) {
    if (!ref.id) continue
    const msg = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' })
    const email = toEmail(msg.data)
    if (email.subject.startsWith('[HOA Tracker]')) continue
    emails.push(email)
  }
  return emails
}

/** Digest from admin@, the mailbox this service account can send as. */
export async function sendDigest(body: string): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error('GOOGLE_SERVICE_ACCOUNT_JSON is not set; digest was not emailed')
    return
  }
  try {
    const gmail = gmailClient(['https://www.googleapis.com/auth/gmail.send'])
    const message = [
      'From: admin@villasboulders.org',
      'To: dee@wmbuck.net',
      'Subject: [HOA Tracker] email processor',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n')
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(message).toString('base64url') },
    })
    console.error('digest emailed to dee@wmbuck.net')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`digest email failed: ${message}`)
  }
}

export async function downloadGmailAttachment(providerId: string, attachmentId: string): Promise<Buffer> {
  const gmail = gmailClient()
  const res = await gmail.users.messages.attachments.get({ userId: 'me', messageId: providerId, id: attachmentId })
  const data = res.data.data || ''
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function toEmail(msg: gmail_v1.Schema$Message): InboundEmail {
  const headers = msg.payload?.headers || []
  const header = (name: string) => headers.find((h) => h.name?.toLowerCase() === name)?.value || ''
  const from = parseAddress(header('from'))
  const bodies = { text: '', html: '' }
  const attachments: InboundAttachment[] = []
  if (msg.payload) walk(msg.payload, bodies, attachments)
  const received = header('date')
  const parsed = received ? new Date(received) : null
  return {
    provider: 'gmail',
    providerId: msg.id || '',
    gmailMessageId: header('message-id') || msg.id || '',
    threadId: msg.threadId || null,
    inReplyTo: header('in-reply-to') || null,
    fromName: from.name,
    fromEmail: from.email,
    to: extractAddresses(header('to')),
    cc: extractAddresses(header('cc')),
    subject: header('subject'),
    bodyText: bodies.text || (bodies.html ? stripHtml(bodies.html, true) : ''),
    bodyHtml: bodies.html,
    receivedDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
    mailbox: 'admin@villasboulders.org',
    attachments,
  }
}

function walk(
  part: gmail_v1.Schema$MessagePart,
  bodies: { text: string; html: string },
  attachments: InboundAttachment[],
): void {
  const mime = part.mimeType || ''
  if (part.filename && part.body?.attachmentId) {
    attachments.push({
      filename: part.filename,
      mimeType: mime || 'application/octet-stream',
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId,
    })
  } else if (part.body?.data && mime.startsWith('text/plain') && !bodies.text) {
    bodies.text = decode(part.body.data)
  } else if (part.body?.data && mime.startsWith('text/html') && !bodies.html) {
    bodies.html = decode(part.body.data)
  }
  for (const child of part.parts || []) walk(child, bodies, attachments)
}

function decode(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}
