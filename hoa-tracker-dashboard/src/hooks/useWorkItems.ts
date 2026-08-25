import { useState, useEffect } from 'react'
import { getOpenWorkItems } from '@/lib/queries'
import type { OpenWorkItem } from '@/lib/types'

export function useWorkItems() {
  const [data, setData] = useState<OpenWorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const d = await getOpenWorkItems()
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
