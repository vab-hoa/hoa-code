'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { formatDateTime, truncate } from '@/lib/format'
import { StatusBadge } from './status-badge'
import type { CorrespondenceEntry, EmailMessage } from '@/lib/types'

interface TimelineEntry {
  id: string
  date: string
  type: 'correspondence' | 'email'
  author: string
  subject?: string
  classification?: string
  content: string
  oldStatus?: string | null
  newStatus?: string | null
  email?: EmailMessage
}

interface CorrespondenceTimelineProps {
  correspondence: CorrespondenceEntry[]
  emails: any[]
}

export function CorrespondenceTimeline({ correspondence, emails }: CorrespondenceTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null)

  const entries: TimelineEntry[] = [
    ...correspondence.map(c => ({
      id: c.id,
      date: c.entry_date,
      type: 'correspondence' as const,
      author: `${c.author_name} (${c.author_role})`,
      content: c.content,
      oldStatus: c.old_status,
      newStatus: c.new_status,
    })),
    ...emails.map(link => {
      const em = link.email_message
      return {
        id: em.id,
        date: em.received_date,
        type: 'email' as const,
        author: em.from_name || em.from_email || 'Unknown',
        subject: em.subject,
        classification: em.classification,
        content: em.body_text || '',
        email: em,
      }
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">No correspondence or emails recorded.</p>
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="relative">
          {idx > 0 && <div className="h-2 border-l-2 border-gray-200 ml-6" />}
          <div className="flex gap-4">
            <div className="flex-shrink-0 mt-1">
              <div className={clsx('w-3 h-3 rounded-full border-2', entry.type === 'email' ? 'bg-indigo-500 border-indigo-300' : 'bg-gray-400 border-gray-300')} />
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-gray-900">{entry.author}</div>
                <div className="text-xs text-gray-500">{formatDateTime(entry.date)}</div>
              </div>

              {entry.subject && (
                <div className="text-sm font-medium text-gray-700 mt-1">{entry.subject}</div>
              )}

              {entry.classification && (
                <div className="text-xs text-gray-500 mt-1">Classification: {entry.classification}</div>
              )}

              <div className="mt-2 text-sm text-gray-700 bg-white border border-gray-200 p-2 rounded max-h-20 overflow-hidden">
                {truncate(entry.content, 300)}
              </div>

              {entry.oldStatus && entry.newStatus && (
                <div className="mt-2 text-xs">
                  Status: <StatusBadge status={entry.oldStatus} size="sm" /> →{' '}
                  <StatusBadge status={entry.newStatus} size="sm" />
                </div>
              )}

              {entry.type === 'email' && entry.email && (
                <button
                  onClick={() => setSelectedEmail(entry.email!)}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  Read full email
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {selectedEmail && (
        <EmailBodyModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
      )}
    </div>
  )
}

function EmailBodyModal({ email, onClose }: { email: EmailMessage; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 flex-1">{email.subject || '(no subject)'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            ✕
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 text-xs text-gray-600">
          <div>From: {email.from_name} &lt;{email.from_email}&gt;</div>
          <div>Date: {formatDateTime(email.received_date)}</div>
          {email.classification && <div>Classification: {email.classification}</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-xs text-gray-800 font-mono whitespace-pre-wrap break-words">
            {email.body_text || '(no body)'}
          </pre>
        </div>

        <div className="p-4 border-t border-gray-200 text-right">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
