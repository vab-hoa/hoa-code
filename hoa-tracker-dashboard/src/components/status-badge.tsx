import clsx from 'clsx'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'px-2 py-1 text-sm' : 'px-1.5 py-0.5 text-xs'
  return (
    <span className={clsx('inline-flex items-center rounded font-medium', sizeClass, STATUS_COLORS[status])}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
