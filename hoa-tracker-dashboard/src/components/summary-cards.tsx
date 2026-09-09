import clsx from 'clsx'
import type { DashboardSummary } from '@/lib/types'

interface SummaryCardsProps {
  summary: DashboardSummary | null
  agingCount: number
}

export function SummaryCards({ summary, agingCount }: SummaryCardsProps) {
  if (!summary) return null

  const cards = [
    { label: 'Total Open', value: summary.total_open, color: 'border-t-blue-500' },
    { label: 'Manager', value: summary.manager_count, color: 'border-t-blue-500' },
    { label: 'Board', value: summary.board_count, color: 'border-t-red-500' },
    { label: 'ARC', value: summary.arc_count, color: 'border-t-violet-500' },
    { label: 'Contractor', value: summary.contractor_count, color: 'border-t-yellow-500' },
    { label: 'Project', value: summary.project_count, color: 'border-t-teal-500' },
    { label: 'Closed', value: summary.closed_count, color: 'border-t-gray-500' },
    { label: 'Aging', value: agingCount, color: 'border-t-red-500' },
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {cards.map(card => (
        <div
          key={card.label}
          className={clsx(
            'border-t-4 bg-surface border border-edge p-2 rounded flex-shrink-0 w-[120px]',
            card.color
          )}
        >
          <div className="text-xs text-mute font-medium">{card.label}</div>
          <div className="text-lg font-bold text-ink">{card.value}</div>
        </div>
      ))}
    </div>
  )
}
