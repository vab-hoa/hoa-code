import { useState, useEffect } from 'react'
import { getAgingWorkItems } from '@/lib/queries'
import type { AgingWorkItem } from '@/lib/types'

export function useAgingItems() {
  const [data, setData] = useState<AgingWorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const d = await getAgingWorkItems()
      setData(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Refetch when page becomes visible (user returns to tab/app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return { data, loading, error }
}
