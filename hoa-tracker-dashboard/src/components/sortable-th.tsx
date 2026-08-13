import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid'

interface SortableThProps {
  label: string
  sortKey: string
  currentSortKey: string | null
  currentSortDir: 'asc' | 'desc'
  onSort: (key: string) => void
}

export function SortableTh({
  label,
  sortKey,
  currentSortKey,
  currentSortDir,
  onSort,
}: SortableThProps) {
  const isActive = currentSortKey === sortKey
  const isAsc = currentSortDir === 'asc'

  return (
    <th
      onClick={() => onSort(sortKey)}
      className="cursor-pointer select-none px-4 py-2 text-left text-xs font-semibold text-ink hover:bg-edge/50 transition-colors"
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive && (
          <span className="flex-shrink-0">
            {isAsc ? (
              <ArrowUpIcon className="w-3 h-3" />
            ) : (
              <ArrowDownIcon className="w-3 h-3" />
            )}
          </span>
        )}
      </div>
    </th>
  )
}
