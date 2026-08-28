import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/send-email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { from, to, cc, subject, body: emailBody } = body

    // Validate required fields
    if (!from || !to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: from, to' }, { status: 400 })
    }

    if (!subject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields: subject, body' }, { status: 400 })
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of to) {
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: `Invalid email address: ${email}` }, { status: 400 })
      }
    }

    if (cc && Array.isArray(cc)) {
      for (const email of cc) {
        if (!emailRegex.test(email)) {
          return NextResponse.json({ error: `Invalid CC email address: ${email}` }, { status: 400 })
        }
      }
    }

    // Validate from address
    if (!from.endsWith('@villasboulders.org')) {
      return NextResponse.json(
        { error: 'From address must be a @villasboulders.org address' },
        { status: 400 }
      )
    }

    // Send the email
    const result = await sendEmail({
      from,
      to,
      cc: cc && cc.length > 0 ? cc : undefined,
      subject,
      body: emailBody,
    })

    return NextResponse.json(
      {
        success: true,
        messageId: result.id,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in send-email API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
