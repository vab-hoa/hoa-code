import { useState, useEffect } from 'react'
import { getRecentCorrespondence } from '@/lib/queries'

export function useRecentActivity(limit: number = 10) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getRecentCorrespondence(limit)
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [limit])

  return { data, loading, error }
}
