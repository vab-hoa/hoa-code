import { useState, useEffect } from 'react'
import { getAgingWorkItems } from '@/lib/queries'
import type { AgingWorkItem } from '@/lib/types'

export function useAgingItems() {
  const [data, setData] = useState<AgingWorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAgingWorkItems()
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
