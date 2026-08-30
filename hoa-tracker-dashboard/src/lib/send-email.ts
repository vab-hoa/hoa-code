import { google } from 'googleapis'

interface SendEmailParams {
  from: string
  to: string[]
  cc?: string[]
  subject: string
  body: string
}

async function getGmailService() {
  const serviceAccountB64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64
  if (!serviceAccountB64) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 environment variable is not set')
  }

  let serviceAccount: any
  try {
    const serviceAccountJson = Buffer.from(serviceAccountB64, 'base64').toString('utf-8')
    serviceAccount = JSON.parse(serviceAccountJson)

    // Fix escaped newlines in private key (convert \\n to actual newlines)
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
    }
  } catch (e) {
    throw new Error(`Failed to decode or parse GOOGLE_SERVICE_ACCOUNT_B64: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Use JWT auth directly instead of GoogleAuth wrapper to avoid OpenSSL decoder issues
  const jwtClient = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: 'admin@villasboulders.org',
  })

  // Authorize the JWT client
  await jwtClient.authorize()

  return google.gmail({ version: 'v1', auth: jwtClient })
}

function createMimeMessage(params: SendEmailParams): string {
  const { from, to, cc, subject, body } = params

  const headers: string[] = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
  ]

  if (cc && cc.length > 0) {
    headers.push(`Cc: ${cc.join(', ')}`)
  }

  headers.push(
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
  )

  const message = headers.join('\r\n') + '\r\n\r\n' + body

  return Buffer.from(message).toString('base64')
}

export async function sendEmail(params: SendEmailParams): Promise<any> {
  const gmail = await getGmailService()

  const mimeMessage = createMimeMessage(params)

  try {
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: mimeMessage,
      },
    })

    return result.data
  } catch (error: any) {
    console.error('Gmail API error:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}
