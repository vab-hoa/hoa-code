'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWorkItem } from '@/hooks/useWorkItem'
import { supabase } from '@/lib/supabase'
import { Loading } from '@/components/loading'
import { StatusBadge } from '@/components/status-badge'
import { CategoryBadge } from '@/components/category-badge'
import { DecisionBadge } from '@/components/decision-badge'
import { CorrespondenceTimeline } from '@/components/correspondence-timeline'
import { formatDate, formatCurrency } from '@/lib/format'

export default function WorkItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const router = useRouter()
  const { item, correspondence, emails, statusHistory, loading, error } = useWorkItem(id)
  const [showExclusionDialog, setShowExclusionDialog] = useState(false)
  const [exclusionReason, setExclusionReason] = useState('')
  const [excludingName, setExcludingName] = useState('')
  const [isExcluding, setIsExcluding] = useState(false)

  const handleExclude = async () => {
    if (!exclusionReason.trim() || !excludingName.trim()) {
      alert('Please provide both a name and reason')
      return
    }

    setIsExcluding(true)
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        excluded_at: new Date().toISOString(),
        excluded_by: excludingName,
        excluded_reason: exclusionReason,
      })
      .eq('id', id)

    setIsExcluding(false)

    if (updateError) {
      alert('Error excluding item: ' + updateError.message)
      return
    }

    setShowExclusionDialog(false)
    router.push('/')
  }

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!item) return <div className="p-6 text-mute">Work item not found</div>

  return (
    <div className="bg-app-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/" className="text-blue-300 hover:underline text-sm mb-4 inline-block">
          ← Back to dashboard
        </Link>

        <div className="bg-surface border border-edge rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-ink mb-3">{item.title}</h1>
              <div className="flex gap-2 flex-wrap mb-4">
                <StatusBadge status={item.status} size="md" />
                <CategoryBadge category={item.category} size="md" />
              </div>

              {item.property_id && (
                <p className="text-sm text-mute mb-4">
                  Property:{' '}
                  <Link
                    href={`/properties/${item.property_id}`}
                    className="text-blue-300 hover:underline"
                  >
                    {(item as any).properties?.parcel_code || 'View property'}
                  </Link>
                </p>
              )}

              {item.description && (
                <div className="mt-4 p-3 bg-edge/25 rounded text-sm text-ink">
                  {item.description}
                </div>
              )}
            </div>

            {/* Exclude button */}
            <button
              onClick={() => setShowExclusionDialog(true)}
              className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-300 text-sm rounded hover:bg-red-500/30 transition-colors whitespace-nowrap"
            >
              Mark as excluded
            </button>
          </div>
        </div>

        {item.decision && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-blue-300 mb-2">Decision: {item.decision_by || 'TBD'}</h3>
            <div className="space-y-1 text-sm text-blue-200">
              <div>
                <DecisionBadge decision={item.decision} />
              </div>
              {item.decision_at && <div>Date: {formatDate(item.decision_at)}</div>}
              {item.decision_rationale && (
                <div className="mt-2 italic">&quot;{item.decision_rationale}&quot;</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-surface border border-edge rounded-lg p-4">
            <h3 className="font-bold text-ink mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-mute">Status</dt>
                <dd className="font-medium text-ink">
                  <StatusBadge status={item.status} />
                </dd>
              </div>
              <div>
                <dt className="text-mute">Category</dt>
                <dd>
                  <CategoryBadge category={item.category} />
                </dd>
              </div>
              {item.assigned_to && (
                <div>
                  <dt className="text-mute">Assigned To</dt>
                  <dd className="text-ink">{item.assigned_to}</dd>
                </div>
              )}
              {item.vendor && (
                <div>
                  <dt className="text-mute">Vendor</dt>
                  <dd className="text-ink">{item.vendor}</dd>
                </div>
              )}
              {item.keystone_wo_number && (
                <div>
                  <dt className="text-mute">Keystone WO #</dt>
                  <dd className="font-mono text-ink">{item.keystone_wo_number}</dd>
                </div>
              )}
              <div>
                <dt className="text-mute">Created</dt>
                <dd className="text-ink">{formatDate(item.created_date)}</dd>
              </div>
              {item.due_date && (
                <div>
                  <dt className="text-mute">Due Date</dt>
                  <dd className="text-ink">{formatDate(item.due_date)}</dd>
                </div>
              )}
              {item.closed_date && (
                <div>
                  <dt className="text-mute">Closed</dt>
                  <dd className="text-ink">{formatDate(item.closed_date)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-surface border border-edge rounded-lg p-4">
            <h3 className="font-bold text-ink mb-3">Financials</h3>
            <dl className="space-y-2 text-sm">
              {item.estimated_cost && (
                <div>
                  <dt className="text-mute">Estimated Cost</dt>
                  <dd className="font-medium text-ink">
                    {formatCurrency(item.estimated_cost)}
                  </dd>
                </div>
              )}
              {item.bid_amount && (
                <div>
                  <dt className="text-mute">Bid Amount</dt>
                  <dd className="font-medium text-ink">{formatCurrency(item.bid_amount)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-ink mb-4">Correspondence & Emails</h2>
          <CorrespondenceTimeline correspondence={correspondence} emails={emails} />
        </div>

        {statusHistory.length > 0 && (
          <div className="bg-surface border border-edge rounded-lg p-6">
            <h2 className="text-lg font-bold text-ink mb-4">Status History</h2>
            <div className="space-y-2 text-sm">
              {statusHistory.map(entry => (
                <div key={entry.id} className="flex items-center gap-2">
                  <span className="text-mute">{formatDate(entry.entry_date)}</span>
                  <StatusBadge status={entry.old_status!} /> →{' '}
                  <StatusBadge status={entry.new_status!} />
                  <span className="text-mute">by {entry.author_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exclusion dialog */}
        {showExclusionDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-edge rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-ink mb-4">Mark as excluded</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={excludingName}
                    onChange={e => setExcludingName(e.target.value)}
                    placeholder="e.g., Dee Buck"
                    className="w-full px-3 py-2 bg-edge border border-edge text-ink rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Reason for exclusion
                  </label>
                  <textarea
                    value={exclusionReason}
                    onChange={e => setExclusionReason(e.target.value)}
                    placeholder="e.g., Stale landscape request, already handled by xyz"
                    className="w-full px-3 py-2 bg-edge border border-edge text-ink rounded text-sm h-24 resize-none"
                  />
                </div>

                <p className="text-xs text-mute">
                  This item will be removed from all dashboards but will be soft-deleted in the database (recoverable).
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowExclusionDialog(false)}
                    disabled={isExcluding}
                    className="px-3 py-2 bg-edge border border-edge text-ink rounded text-sm hover:bg-edge/70 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExclude}
                    disabled={isExcluding || !exclusionReason.trim() || !excludingName.trim()}
                    className="px-3 py-2 bg-red-500/20 border border-red-500 text-red-300 rounded text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    {isExcluding ? 'Excluding...' : 'Exclude'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
