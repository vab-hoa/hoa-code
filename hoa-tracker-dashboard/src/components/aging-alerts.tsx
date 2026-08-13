'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { StatusBadge } from './status-badge'
import { CategoryBadge } from './category-badge'
import { SortableTh } from './sortable-th'
import { formatDate, formatDays } from '@/lib/format'
import { useSortableData } from '@/hooks/useSortableData'
import { WORK_ITEM_TYPES, getWorkItemType } from '@/lib/work-item-helpers'
import type { AgingWorkItem } from '@/lib/types'

interface AgingAlertsProps {
  items: AgingWorkItem[]
}

interface SortableAgingItem extends AgingWorkItem {
  overBy: number
}

export function AgingAlerts({ items }: AgingAlertsProps) {
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['arc_request', 'work_order', 'violation', 'landscaping'])
  )

  if (items.length === 0) {
    return (
      <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded">
        <p className="text-sm text-green-300">✓ All caught up — no items past their aging threshold</p>
      </div>
    )
  }

  // Group items by type
  const itemsByType = new Map<string, AgingWorkItem[]>()
  for (const item of items) {
    const type = getWorkItemType(item.category)
    if (!itemsByType.has(type)) {
      itemsByType.set(type, [])
    }
    itemsByType.get(type)!.push(item)
  }

  const toggleType = (typeKey: string) => {
    const newVisibleTypes = new Set(visibleTypes)
    if (newVisibleTypes.has(typeKey)) {
      newVisibleTypes.delete(typeKey)
    } else {
      newVisibleTypes.add(typeKey)
    }
    setVisibleTypes(newVisibleTypes)
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-red-300 mb-3 flex items-center gap-2">
        ⚠️ Aging Alerts
      </h2>

      {/* Type toggle chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {WORK_ITEM_TYPES.map(type => {
          const typeItems = itemsByType.get(type.key) || []
          if (typeItems.length === 0) return null

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
              {type.label} ({typeItems.length})
            </button>
          )
        })}
      </div>

      {/* Tables per type */}
      <div className="space-y-6">
        {WORK_ITEM_TYPES.map(type => {
          const typeItems = itemsByType.get(type.key) || []
          if (typeItems.length === 0 || !visibleTypes.has(type.key)) return null

          return (
            <AgingAlertsTypeSection
              key={type.key}
              typeLabel={type.label}
              items={typeItems}
            />
          )
        })}
      </div>
    </div>
  )
}

function AgingAlertsTypeSection({
  typeLabel,
  items,
}: {
  typeLabel: string
  items: AgingWorkItem[]
}) {
  const itemsWithOverBy: SortableAgingItem[] = items.map(item => ({
    ...item,
    overBy: item.days_open - item.max_days,
  }))

  const { sortedItems, sortKey, sortDir, requestSort } = useSortableData<SortableAgingItem>(
    itemsWithOverBy,
    { initialKey: 'overBy', initialDir: 'desc' }
  )

  return (
    <div className="bg-surface rounded border border-edge">
      <div className="px-4 py-2 bg-edge/25 border-b border-edge">
        <p className="text-sm font-semibold text-ink">{typeLabel} ({items.length})</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-edge">
              <SortableTh
                label="Title"
                sortKey="title"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('title')}
              />
              <SortableTh
                label="Address"
                sortKey="parcel_code"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('parcel_code')}
              />
              <SortableTh
                label="Category"
                sortKey="category"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('category')}
              />
              <SortableTh
                label="Status"
                sortKey="status"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('status')}
              />
              <SortableTh
                label="Days Open"
                sortKey="days_open"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('days_open')}
              />
              <SortableTh
                label="Limit"
                sortKey="max_days"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('max_days')}
              />
              <SortableTh
                label="Over By"
                sortKey="overBy"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('overBy')}
              />
              <SortableTh
                label="Vendor"
                sortKey="vendor"
                currentSortKey={sortKey as string}
                currentSortDir={sortDir}
                onSort={() => requestSort('vendor')}
              />
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(item => {
              const bgClass =
                item.overBy > 60 ? 'bg-red-500/5 border-l-4 border-l-red-500' :
                item.overBy > 30 ? 'bg-orange-500/5 border-l-4 border-l-orange-500' :
                'bg-yellow-500/5 border-l-4 border-l-yellow-500'

              return (
                <tr
                  key={item.id}
                  className={clsx('border-b border-edge hover:bg-edge/25 cursor-pointer', bgClass)}
                >
                  <td className="px-4 py-2 font-medium text-ink">
                    <Link href={`/work-items/${item.id}`} className="text-blue-300 hover:underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-mute">
                    {item.parcel_code || '—'}
                  </td>
                  <td className="px-4 py-2"><CategoryBadge category={item.category} /></td>
                  <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-2 text-right text-sm text-mute">{formatDays(item.days_open)}</td>
                  <td className="px-4 py-2 text-right text-sm text-mute">{item.max_days}d</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-300">+{Math.round(item.overBy)}d</td>
                  <td className="px-4 py-2 text-xs text-mute">{item.vendor || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
