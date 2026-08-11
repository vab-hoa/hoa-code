'use client'

import Link from 'next/link'
import { useWorkItem } from '@/hooks/useWorkItem'
import { Loading } from '@/components/loading'
import { StatusBadge } from '@/components/status-badge'
import { CategoryBadge } from '@/components/category-badge'
import { DecisionBadge } from '@/components/decision-badge'
import { CorrespondenceTimeline } from '@/components/correspondence-timeline'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format'

export default function WorkItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const { item, correspondence, emails, statusHistory, loading, error } = useWorkItem(id)

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>
  if (!item) return <div className="p-6 text-gray-600">Work item not found</div>

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← Back to dashboard
      </Link>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h1>
        <div className="flex gap-2 flex-wrap mb-4">
          <StatusBadge status={item.status} size="md" />
          <CategoryBadge category={item.category} size="md" />
        </div>

        {item.property_id && (
          <p className="text-sm text-gray-600 mb-4">
            Property:{' '}
            <Link
              href={`/properties/${item.property_id}`}
              className="text-blue-600 hover:underline"
            >
              {(item as any).properties?.address || 'View property'}
            </Link>
          </p>
        )}

        {item.description && (
          <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-700">
            {item.description}
          </div>
        )}
      </div>

      {item.decision && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">Decision: {item.decision_by || 'TBD'}</h3>
          <div className="space-y-1 text-sm text-blue-800">
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
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-900 mb-3">Details</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium text-gray-900">
                <StatusBadge status={item.status} />
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Category</dt>
              <dd>
                <CategoryBadge category={item.category} />
              </dd>
            </div>
            {item.assigned_to && (
              <div>
                <dt className="text-gray-500">Assigned To</dt>
                <dd className="text-gray-900">{item.assigned_to}</dd>
              </div>
            )}
            {item.vendor && (
              <div>
                <dt className="text-gray-500">Vendor</dt>
                <dd className="text-gray-900">{item.vendor}</dd>
              </div>
            )}
            {item.keystone_wo_number && (
              <div>
                <dt className="text-gray-500">Keystone WO #</dt>
                <dd className="font-mono text-gray-900">{item.keystone_wo_number}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Created</dt>
              <dd>{formatDate(item.created_date)}</dd>
            </div>
            {item.due_date && (
              <div>
                <dt className="text-gray-500">Due Date</dt>
                <dd>{formatDate(item.due_date)}</dd>
              </div>
            )}
            {item.closed_date && (
              <div>
                <dt className="text-gray-500">Closed</dt>
                <dd>{formatDate(item.closed_date)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-900 mb-3">Financials</h3>
          <dl className="space-y-2 text-sm">
            {item.estimated_cost && (
              <div>
                <dt className="text-gray-500">Estimated Cost</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(item.estimated_cost)}
                </dd>
              </div>
            )}
            {item.bid_amount && (
              <div>
                <dt className="text-gray-500">Bid Amount</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(item.bid_amount)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Correspondence & Emails</h2>
        <CorrespondenceTimeline correspondence={correspondence} emails={emails} />
      </div>

      {statusHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Status History</h2>
          <div className="space-y-2 text-sm">
            {statusHistory.map(entry => (
              <div key={entry.id} className="flex items-center gap-2">
                <span className="text-gray-500">{formatDate(entry.entry_date)}</span>
                <StatusBadge status={entry.old_status!} /> →{' '}
                <StatusBadge status={entry.new_status!} />
                <span className="text-gray-600">by {entry.author_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import React from 'react'
