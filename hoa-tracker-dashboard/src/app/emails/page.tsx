'use client'

import { useState, useEffect } from 'react'
import { getEmails, getEmailLinkedWorkItems } from '@/lib/queries'
import { Loading } from '@/components/loading'
import { formatDateTime, truncate } from '@/lib/format'
import Link from 'next/link'

export default function EmailsPage() {
  const [emails, setEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNoise, setShowNoise] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [linkedItems, setLinkedItems] = useState<any[]>([])
  const [offset, setOffset] = useState(0)

  const loadEmails = async (off: number) => {
    setLoading(true)
    try {
      const data = await getEmails({ isNoise: showNoise ? undefined : false, limit: 50, offset: off })
      setEmails(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmails(0)
  }, [showNoise])

  const handleSelectEmail = async (email: any) => {
    setSelectedEmail(email)
    const items = await getEmailLinkedWorkItems(email.id)
    setLinkedItems(items)
  }

  if (loading && emails.length === 0) return <Loading />

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Emails</h1>

      <div className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showNoise}
            onChange={e => setShowNoise(e.target.checked)}
            className="rounded"
          />
          Show noise emails
        </label>
      </div>

      {error && <div className="text-red-600 mb-4">Error: {error}</div>}

      <div className="bg-white rounded-lg shadow overflow-x-auto mb-6">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">From</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Subject</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Classification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {emails.map(email => (
              <tr
                key={email.id}
                onClick={() => handleSelectEmail(email)}
                className="hover:bg-blue-50 cursor-pointer"
              >
                <td className="px-4 py-2 text-xs text-gray-600">{formatDateTime(email.received_date)}</td>
                <td className="px-4 py-2 text-sm text-gray-900">{email.from_name || email.from_email}</td>
                <td className="px-4 py-2 text-sm text-gray-700 truncate">{email.subject || '(no subject)'}</td>
                <td className="px-4 py-2 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded w-fit">
                  {email.classification || 'unclassified'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex-1">{selectedEmail.subject || '(no subject)'}</h3>
              <button onClick={() => setSelectedEmail(null)} className="text-gray-500 hover:text-gray-700 text-xl">
                ✕
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 text-xs text-gray-600">
              <div>From: {selectedEmail.from_name} &lt;{selectedEmail.from_email}&gt;</div>
              <div>Date: {formatDateTime(selectedEmail.received_date)}</div>
              {selectedEmail.classification && <div>Classification: {selectedEmail.classification}</div>}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs text-gray-800 font-mono whitespace-pre-wrap break-words">
                {selectedEmail.body_text || '(no body)'}
              </pre>
            </div>

            {linkedItems.length > 0 && (
              <div className="p-4 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-900 mb-2">Linked Work Items:</div>
                <ul className="space-y-1 text-sm">
                  {linkedItems.map(link => (
                    <li key={link.work_item_id}>
                      <Link
                        href={`/work-items/${link.work_item_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {link.work_items?.title || `Item ${link.work_item_id}`}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-4 border-t border-gray-200 text-right">
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
