'use client'

import Link from 'next/link'
import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { StatusBadge } from './status-badge'
import { CategoryBadge } from './category-badge'
import { PriorityBadge } from './priority-badge'
import { WORK_ITEM_TYPES, getWorkItemType } from '@/lib/work-item-helpers'
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
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['arc_request', 'work_order', 'violation', 'landscaping'])
  )
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(
    new Set(['new', 'pending_board_review', 'awaiting_quote'])
  )

  const toggleType = (typeKey: string) => {
    const newVisibleTypes = new Set(visibleTypes)
    if (newVisibleTypes.has(typeKey)) {
      newVisibleTypes.delete(typeKey)
    } else {
      newVisibleTypes.add(typeKey)
    }
    setVisibleTypes(newVisibleTypes)
  }

  const toggleStatus = (status: string) => {
    const newExpanded = new Set(expandedStatuses)
    if (newExpanded.has(status)) {
      newExpanded.delete(status)
    } else {
      newExpanded.add(status)
    }
    setExpandedStatuses(newExpanded)
  }

  // Group items by type then by status
  const itemsByTypeAndStatus = new Map<string, Map<string, OpenWorkItem[]>>()
  for (const item of items) {
    const type = getWorkItemType(item.category)
    if (!itemsByTypeAndStatus.has(type)) {
      itemsByTypeAndStatus.set(type, new Map<string, OpenWorkItem[]>())
    }
    const typeMap = itemsByTypeAndStatus.get(type)!
    if (!typeMap.has(item.status)) {
      typeMap.set(item.status, [])
    }
    typeMap.get(item.status)!.push(item)
  }

  return (
    <div className="mb-6">
      <h2 className="text-base font-bold text-ink mb-3">Open Work Items</h2>

      {/* Type toggle chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {WORK_ITEM_TYPES.map(type => {
          const typeMap = itemsByTypeAndStatus.get(type.key)
          const typeCount = typeMap ? Array.from(typeMap.values()).reduce((sum, items) => sum + items.length, 0) : 0
          if (typeCount === 0) return null

          const isVisible = visibleTypes.has(type.key)
          return (
            <button
              key={type.key}
              onClick={() => toggleType(type.key)}
              className={clsx(
                'px-3 py-1 rounded text-sm font-medium transition-colors',
                isVisible
                  ? 'bg-blue-500/30 border border-blue-500 text-blue-200'
                  : 'bg-edge/50 border border-edge text-mute hover:bg-edge/70'
              )}
            >
              {type.label} ({typeCount})
            </button>
          )
        })}
      </div>

      {/* Render sections per type */}
      <div className="space-y-6">
        {WORK_ITEM_TYPES.map(type => {
          const typeMap = itemsByTypeAndStatus.get(type.key)
          if (!typeMap || typeMap.size === 0 || !visibleTypes.has(type.key)) return null

          return (
            <WorkItemTypeSection
              key={type.key}
              typeLabel={type.label}
              statusMap={typeMap}
              expandedStatuses={expandedStatuses}
              onToggleStatus={toggleStatus}
            />
          )
        })}
      </div>
    </div>
  )
}

function WorkItemTypeSection({
  typeLabel,
  statusMap,
  expandedStatuses,
  onToggleStatus,
}: {
  typeLabel: string
  statusMap: Map<string, OpenWorkItem[]>
  expandedStatuses: Set<string>
  onToggleStatus: (status: string) => void
}) {
  const sortedStatuses = Array.from(statusMap.keys()).sort(
    (a, b) => (STATUS_ORDER.indexOf(a) ?? 999) - (STATUS_ORDER.indexOf(b) ?? 999)
  )

  return (
    <div className="border border-edge rounded">
      <div className="px-4 py-2 bg-edge/25 border-b border-edge">
        <p className="text-sm font-semibold text-ink">{typeLabel}</p>
      </div>

      <div className="space-y-0">
        {sortedStatuses.map((status, idx) => {
          const workItems = statusMap.get(status) || []
          const isExpanded = expandedStatuses.has(status)

          return (
            <div key={status} className={idx > 0 ? 'border-t border-edge' : ''}>
              <button
                onClick={() => onToggleStatus(status)}
                className="w-full px-4 py-2 text-left font-medium text-ink bg-edge/25 hover:bg-edge/50 flex items-center justify-between text-sm transition-colors"
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
                <div className="divide-y divide-edge">
                  {workItems.map(item => (
                    <Link
                      key={item.id}
                      href={`/work-items/${item.id}`}
                      className="block px-4 py-2 hover:bg-edge/50 text-sm transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-ink truncate">{item.title}</div>
                          <div className="text-xs text-mute mt-1">
                            {item.parcel_code || '—'}
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <CategoryBadge category={item.category} size="sm" />
                            <StatusBadge status={item.status} size="sm" />
                            {item.priority && <PriorityBadge priority={item.priority} />}
                            {item.vendor && <span className="text-xs text-mute">{item.vendor}</span>}
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
