import net from 'node:net'
import tls from 'node:tls'

/** Send the daily digest as jane@wmbuck.net. Failures are logged, not thrown. */
export async function sendDigest(body: string): Promise<void> {
  const pass = process.env.SMTP_PASS_JANE
  if (!pass) {
    console.error('SMTP_PASS_JANE is not set; digest was not emailed')
    return
  }
  try {
    await deliver(body, pass)
    console.error('digest emailed to dee@wmbuck.net')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`digest email failed: ${message}`)
  }
}

async function deliver(body: string, pass: string): Promise<void> {
  const plain = net.connect(587, 'wmbuck.net')
  await once(plain, 'connect')
  await readOk(plain)
  await send(plain, 'EHLO hoa-code')
  await send(plain, 'STARTTLS')
  const secure = tls.connect({ socket: plain, servername: 'wmbuck.net' })
  await once(secure, 'secureConnect')
  await send(secure, 'EHLO hoa-code')
  await send(secure, 'AUTH LOGIN')
  await send(secure, Buffer.from('jane@wmbuck.net').toString('base64'))
  await send(secure, Buffer.from(pass).toString('base64'))
  await send(secure, 'MAIL FROM:<jane@wmbuck.net>')
  await send(secure, 'RCPT TO:<dee@wmbuck.net>')
  await send(secure, 'DATA')
  const payload = mime(body).replace(/^\./gm, '..')
  const accepted = readOk(secure)
  secure.write(payload + '\r\n.\r\n')
  await accepted
  await send(secure, 'QUIT')
  secure.end()
}

function mime(body: string): string {
  const b64 = Buffer.from(body, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n')
  return [
    'From: jane@wmbuck.net',
    'To: dee@wmbuck.net',
    'Subject: [HOA Tracker] email processor',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64.trimEnd(),
  ].join('\r\n')
}

function once(socket: net.Socket, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once(event, () => resolve())
    socket.once('error', reject)
  })
}

/** Accept any 2xx or 3xx SMTP reply, including AUTH 334 and DATA 354. */
function readOk(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8')
      const lines = buf.split('\r\n').filter(Boolean)
      const last = lines[lines.length - 1]
      if (!last || !/^\d{3} /.test(last)) return
      socket.off('data', onData)
      const code = Number(last.slice(0, 3))
      if (code >= 400) reject(new Error(lines.join(' | ')))
      else resolve(buf)
    }
    socket.on('data', onData)
    socket.once('error', reject)
  })
}

async function send(socket: net.Socket, line: string): Promise<string> {
  const pending = readOk(socket)
  socket.write(line + '\r\n')
  return pending
}
