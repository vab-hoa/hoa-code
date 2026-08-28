'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/format'

interface SendLog {
  id: string
  from: string
  to: string[]
  subject: string
  timestamp: string
}

export default function SendPage() {
  const [from, setFrom] = useState('board@villasboulders.org')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<SendLog | null>(null)
  const [sendLog, setSendLog] = useState<SendLog[]>([])

  const validateEmails = (emailString: string): string[] | null => {
    if (!emailString.trim()) return null
    const emails = emailString.split(',').map(e => e.trim())
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        return null
      }
    }
    return emails
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const toEmails = validateEmails(to)
    if (!toEmails || toEmails.length === 0) {
      setError('Please enter at least one valid recipient email address')
      return
    }

    const ccEmails = cc ? validateEmails(cc) : []
    if (cc && !ccEmails) {
      setError('Please enter valid CC email addresses')
      return
    }

    if (!subject.trim()) {
      setError('Subject is required')
      return
    }

    if (!body.trim()) {
      setError('Body is required')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: toEmails,
          cc: ccEmails && ccEmails.length > 0 ? ccEmails : undefined,
          subject,
          body,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send email')
        return
      }

      const logEntry: SendLog = {
        id: Date.now().toString(),
        from,
        to: toEmails,
        subject,
        timestamp: new Date().toISOString(),
      }

      setSendLog([logEntry, ...sendLog])
      setSuccessMessage(logEntry)

      setTo('')
      setCc('')
      setSubject('')
      setBody('')
    } catch (e: any) {
      setError(e.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-ink mb-6">Send Email</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSend} className="bg-surface rounded-lg shadow-sm border border-edge p-6 space-y-4">
            {/* From */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">From</label>
              <select
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-edge rounded-md text-ink focus:outline-none focus:border-blue-500"
              >
                <option value="board@villasboulders.org">board@villasboulders.org</option>
                <option value="arc@villasboulders.org">arc@villasboulders.org</option>
                <option value="lbc@villasboulders.org">lbc@villasboulders.org</option>
                <option value="snowsquad@villasboulders.org">snowsquad@villasboulders.org</option>
              </select>
            </div>

            {/* To */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">To</label>
              <input
                type="text"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="recipient@example.com or multiple comma-separated"
                className="w-full px-3 py-2 bg-app-bg border border-edge rounded-md text-ink placeholder-mute focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-mute mt-1">Multiple recipients: use comma-separated addresses</p>
            </div>

            {/* CC */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">CC (optional)</label>
              <input
                type="text"
                value={cc}
                onChange={e => setCc(e.target.value)}
                placeholder="optional@example.com"
                className="w-full px-3 py-2 bg-app-bg border border-edge rounded-md text-ink placeholder-mute focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject"
                className="w-full px-3 py-2 bg-app-bg border border-edge rounded-md text-ink placeholder-mute focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Body</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Email body (plain text)"
                rows={10}
                className="w-full px-3 py-2 bg-app-bg border border-edge rounded-md text-ink placeholder-mute focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>

            {/* Error */}
            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-300 text-sm">{error}</div>}

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
            >
              {loading ? 'Sending...' : 'Send Email'}
            </button>
          </form>
        </div>

        {/* Log */}
        <div className="lg:col-span-1">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="text-green-300 font-medium mb-2">Email sent!</div>
              <div className="text-xs text-mute space-y-1">
                <div>
                  <strong>From:</strong> {successMessage.from}
                </div>
                <div>
                  <strong>To:</strong> {successMessage.to.join(', ')}
                </div>
                <div>
                  <strong>Subject:</strong> {successMessage.subject}
                </div>
                <div>
                  <strong>Time:</strong> {formatDateTime(successMessage.timestamp)}
                </div>
              </div>
            </div>
          )}

          {/* Recent Sends */}
          {sendLog.length > 0 && (
            <div className="bg-surface rounded-lg shadow-sm border border-edge p-4">
              <h3 className="text-sm font-medium text-ink mb-3">Recent Sends</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sendLog.map(log => (
                  <div key={log.id} className="p-2 bg-app-bg rounded border border-edge/50 text-xs">
                    <div className="text-mute">{formatDateTime(log.timestamp)}</div>
                    <div className="text-ink truncate mt-1">{log.subject}</div>
                    <div className="text-mute text-xs truncate">{log.to.join(', ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
