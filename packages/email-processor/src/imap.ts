import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { extractAddresses, imapThreadId, parseAddress } from './text.js'
import type { InboundEmail } from './types.js'

export async function fetchImap(days: number): Promise<InboundEmail[]> {
  const pass = process.env.GMAIL_IMAP_PASSWORD_MCDONALDBUCKHOA
  if (!pass) throw new Error('GMAIL_IMAP_PASSWORD_MCDONALDBUCKHOA is required')
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: 'mcdonaldbuckhoa@gmail.com', pass },
    logger: false,
  })
  await client.connect()
  const lock = await client.getMailboxLock('[Gmail]/All Mail')
  const emails: InboundEmail[] = []
  try {
    const since = new Date(Date.now() - days * 86400000)
    const uids = await client.search({ since })
    const list = Array.isArray(uids) ? uids.slice(-500) : []
    if (!list.length) return emails
    for await (const msg of client.fetch(list, { source: true, uid: true }, { uid: true })) {
      if (!msg.source) continue
      const parsed = await simpleParser(msg.source)
      const subject = parsed.subject || ''
      if (subject.startsWith('[HOA Tracker]')) continue
      const from = parseAddress(parsed.from?.text || '')
      const messageId = parsed.messageId || `imap-uid:${msg.uid}`
      emails.push({
        provider: 'imap',
        providerId: String(msg.uid),
        gmailMessageId: messageId,
        threadId: imapThreadId(subject),
        inReplyTo: parsed.inReplyTo || null,
        fromName: from.name,
        fromEmail: from.email,
        to: extractAddresses(parsed.to ? addressText(parsed.to) : ''),
        cc: extractAddresses(parsed.cc ? addressText(parsed.cc) : ''),
        subject,
        bodyText: parsed.text || '',
        bodyHtml: typeof parsed.html === 'string' ? parsed.html : '',
        receivedDate: parsed.date ? parsed.date.toISOString() : null,
        mailbox: 'mcdonaldbuckhoa@gmail.com',
        attachments: (parsed.attachments || []).map((att) => ({
          filename: att.filename || 'attachment',
          mimeType: att.contentType || 'application/octet-stream',
          size: att.size || att.content?.length || 0,
          content: att.content,
        })),
      })
    }
  } finally {
    lock.release()
    await client.logout()
  }
  return emails
}

function addressText(value: { text?: string } | { text?: string }[]): string {
  if (Array.isArray(value)) return value.map((v) => v.text || '').join(', ')
  return value.text || ''
}
