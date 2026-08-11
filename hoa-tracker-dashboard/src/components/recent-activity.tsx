'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { formatRelative, truncate } from '@/lib/format'

interface RecentActivityProps {
  entries: any[]
}

export function RecentActivity({ entries }: RecentActivityProps) {
  const getBorderColor = (entryType: string) => {
    switch (entryType) {
      case 'decision': return 'border-l-green-500'
      case 'status_change': return 'border-l-blue-500'
      case 'email': return 'border-l-indigo-500'
      default: return 'border-l-gray-300'
    }
  }

  return (
    <div className="mb-6">
      <h2 className="text-base font-bold text-gray-900 mb-3">Recent Activity</h2>
      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet</p>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              className={clsx(
                'border-l-4 pl-3 py-2 text-xs bg-white border-b border-gray-100',
                getBorderColor(entry.entry_type)
              )}
            >
              <div className="font-medium text-gray-900">
                {entry.author_name} ({entry.author_role}) →{' '}
                {entry.work_items ? (
                  <Link
                    href={`/work-items/${entry.work_item_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {entry.work_items.title}
                  </Link>
                ) : (
                  <span>Work Item {entry.work_item_id}</span>
                )}
              </div>
              <div className="text-gray-600 mt-1">{truncate(entry.content, 150)}</div>
              <div className="text-gray-400 mt-1">
                {formatRelative(entry.entry_date)}
                {entry.old_status && entry.new_status && (
                  <span className="ml-2">
                    {entry.old_status} → {entry.new_status}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
