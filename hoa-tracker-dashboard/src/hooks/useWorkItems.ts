import { useState, useEffect } from 'react'
import { getOpenWorkItems } from '@/lib/queries'
import type { OpenWorkItem } from '@/lib/types'

export function useWorkItems() {
  const [data, setData] = useState<OpenWorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getOpenWorkItems()
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
