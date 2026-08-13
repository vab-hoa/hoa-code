import clsx from 'clsx'
import { DECISION_COLORS, DECISION_LABELS } from '@/lib/constants'

export function DecisionBadge({
  decision,
}: {
  decision: string
}) {
  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-1 text-xs font-medium', DECISION_COLORS[decision])}>
      {DECISION_LABELS[decision] || decision}
    </span>
  )
}
