import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc'

interface UseSortableDataOptions<T> {
  initialKey?: keyof T
  initialDir?: SortDirection
}

export function useSortableData<T extends Record<string, any>>(
  items: T[],
  options: UseSortableDataOptions<T> = {}
) {
  const [sortKey, setSortKey] = useState<keyof T | null>(options.initialKey || null)
  const [sortDir, setSortDir] = useState<SortDirection>(options.initialDir || 'asc')

  const sortedItems = useMemo(() => {
    if (!sortKey) return items

    const sorted = [...items].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]

      // Nulls sort last
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }

      // String comparison
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (sortDir === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    })

    return sorted
  }, [items, sortKey, sortDir])

  const requestSort = (key: keyof T) => {
    if (key === sortKey) {
      // Toggle direction
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, start with asc
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return { sortedItems, sortKey, sortDir, requestSort }
}
