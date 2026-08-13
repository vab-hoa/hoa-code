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
    { label: 'New', value: summary.new_count, color: 'border-t-blue-500' },
    { label: 'Aging', value: agingCount, color: 'border-t-red-500' },
    { label: 'Pending Review', value: summary.pending_board_count, color: 'border-t-red-500' },
    { label: 'Awaiting Quote', value: summary.awaiting_quote_count, color: 'border-t-orange-500' },
    { label: 'On Hold', value: summary.on_hold_count, color: 'border-t-gray-500' },
    { label: 'Scheduled', value: summary.scheduled_count, color: 'border-t-green-500' },
    { label: 'ARC In Review', value: summary.arc_in_review, color: 'border-t-violet-500' },
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
