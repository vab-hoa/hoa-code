'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { StatusBadge } from './status-badge'
import { CategoryBadge } from './category-badge'
import { PriorityBadge } from './priority-badge'
import type { OpenWorkItem } from '@/lib/types'

interface WorkItemListProps {
  items: OpenWorkItem[]
}

const STATUS_ORDER = [
  'new',
  'pending_board_review',
  'awaiting_quote',
  'awaiting_board_approval',
  'service_request',
  'assigned',
  'in_progress',
  'scheduled',
  'on_hold',
  'under_review_with_architect',
]

export function WorkItemList({ items }: WorkItemListProps) {
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(
    new Set(['new', 'pending_board_review', 'awaiting_quote'])
  )

  const grouped = new Map<string, OpenWorkItem[]>()
  for (const item of items) {
    if (!grouped.has(item.status)) {
      grouped.set(item.status, [])
    }
    grouped.get(item.status)!.push(item)
  }

  const sortedStatuses = Array.from(grouped.keys()).sort(
    (a, b) => (STATUS_ORDER.indexOf(a) ?? 999) - (STATUS_ORDER.indexOf(b) ?? 999)
  )

  const toggleStatus = (status: string) => {
    const newExpanded = new Set(expandedStatuses)
    if (newExpanded.has(status)) {
      newExpanded.delete(status)
    } else {
      newExpanded.add(status)
    }
    setExpandedStatuses(newExpanded)
  }

  return (
    <div className="mb-6">
      <h2 className="text-base font-bold text-gray-900 mb-3">Open Work Items</h2>
      <div className="space-y-0 border border-gray-200 rounded">
        {sortedStatuses.map((status, idx) => {
          const workItems = grouped.get(status) || []
          const isExpanded = expandedStatuses.has(status)

          return (
            <div key={status} className={idx > 0 ? 'border-t border-gray-200' : ''}>
              <button
                onClick={() => toggleStatus(status)}
                className="w-full px-4 py-2 text-left font-medium text-gray-900 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-sm"
              >
                <span>
                  <StatusBadge status={status} size="sm" /> ({workItems.length})
                </span>
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </button>

              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {workItems.map(item => (
                    <Link
                      key={item.id}
                      href={`/work-items/${item.id}`}
                      className="block px-4 py-2 hover:bg-blue-50 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{item.title}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {item.address || item.parcel_code || '—'}
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <CategoryBadge category={item.category} size="sm" />
                            {item.priority && <PriorityBadge priority={item.priority} />}
                            {item.vendor && <span className="text-xs text-gray-500">{item.vendor}</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
