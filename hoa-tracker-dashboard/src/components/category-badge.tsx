import clsx from 'clsx'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/constants'

export function CategoryBadge({ category, size = 'sm' }: { category: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'px-2 py-1 text-sm' : 'px-1.5 py-0.5 text-xs'
  return (
    <span className={clsx('inline-flex items-center rounded font-medium', sizeClass, CATEGORY_COLORS[category])}>
      {CATEGORY_LABELS[category] || category}
    </span>
  )
}
