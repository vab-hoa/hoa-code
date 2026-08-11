import clsx from 'clsx'
import type { DashboardSummary } from '@/lib/types'

interface SummaryCardsProps {
  summary: DashboardSummary | null
  agingCount: number
}

export function SummaryCards({ summary, agingCount }: SummaryCardsProps) {
  if (!summary) return null

  const cards = [
    { label: 'Total Open', value: summary.total_open, color: 'border-blue-400' },
    { label: 'New', value: summary.new_count, color: 'border-blue-400' },
    { label: 'Aging', value: agingCount, color: 'border-red-400' },
    { label: 'Pending Review', value: summary.pending_board_count, color: 'border-red-400' },
    { label: 'Awaiting Quote', value: summary.awaiting_quote_count, color: 'border-orange-400' },
    { label: 'On Hold', value: summary.on_hold_count, color: 'border-gray-400' },
    { label: 'Scheduled', value: summary.scheduled_count, color: 'border-green-400' },
    { label: 'ARC In Review', value: summary.arc_in_review, color: 'border-violet-400' },
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {cards.map(card => (
        <div
          key={card.label}
          className={clsx(
            'border-l-4 bg-white p-2 shadow-sm rounded flex-shrink-0 w-[120px]',
            card.color
          )}
        >
          <div className="text-xs text-gray-500 font-medium">{card.label}</div>
          <div className="text-lg font-bold text-gray-900">{card.value}</div>
        </div>
      ))}
    </div>
  )
}
