'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { StatusBadge } from './status-badge'
import { CategoryBadge } from './category-badge'
import { formatDate, formatDays } from '@/lib/format'
import type { AgingWorkItem } from '@/lib/types'

interface AgingAlertsProps {
  items: AgingWorkItem[]
}

export function AgingAlerts({ items }: AgingAlertsProps) {
  if (items.length === 0) {
    return (
      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
        <p className="text-sm text-green-800">✓ All caught up — no items past their aging threshold</p>
      </div>
    )
  }

  const sorted = [...items].sort((a, b) => (b.days_open - b.max_days) - (a.days_open - a.max_days))

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
        ⚠️ Aging Alerts
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left">Title</th>
              <th className="text-left">Property</th>
              <th className="text-left">Category</th>
              <th className="text-left">Status</th>
              <th className="text-right">Days Open</th>
              <th className="text-right">Limit</th>
              <th className="text-right">Over By</th>
              <th className="text-left">Vendor</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => {
              const overBy = item.days_open - item.max_days
              const bgClass =
                overBy > 60 ? 'bg-red-50' :
                overBy > 30 ? 'bg-orange-50' :
                'bg-yellow-50'

              return (
                <tr
                  key={item.id}
                  className={clsx('border-b border-gray-100 clickable hover:bg-opacity-75', bgClass)}
                >
                  <td className="font-medium">
                    <Link href={`/work-items/${item.id}`} className="text-blue-600 hover:underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="text-xs text-gray-600">
                    {item.address || item.parcel_code || '—'}
                  </td>
                  <td><CategoryBadge category={item.category} /></td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="text-right">{formatDays(item.days_open)}</td>
                  <td className="text-right">{item.max_days}d</td>
                  <td className="text-right font-semibold text-red-600">+{Math.round(overBy)}d</td>
                  <td className="text-xs text-gray-600">{item.vendor || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
