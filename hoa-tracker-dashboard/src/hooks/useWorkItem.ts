import { useState, useEffect } from 'react'
import { getWorkItem, getWorkItemCorrespondence, getWorkItemEmails, getWorkItemStatusHistory, getWorkItemDocuments } from '@/lib/queries'
import type { WorkItem, CorrespondenceEntry, WorkItemDocument } from '@/lib/types'

export function useWorkItem(id: string) {
  const [item, setItem] = useState<WorkItem | null>(null)
  const [correspondence, setCorrespondence] = useState<CorrespondenceEntry[]>([])
  const [emails, setEmails] = useState<any[]>([])
  const [statusHistory, setStatusHistory] = useState<CorrespondenceEntry[]>([])
  const [documents, setDocuments] = useState<WorkItemDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [wi, corr, em, hist, docs] = await Promise.all([
        getWorkItem(id),
        getWorkItemCorrespondence(id),
        getWorkItemEmails(id),
        getWorkItemStatusHistory(id),
        getWorkItemDocuments(id),
      ])
      setItem(wi)
      setCorrespondence(corr)
      setEmails(em)
      setStatusHistory(hist)
      setDocuments(docs)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount or when id changes
  useEffect(() => {
    fetchData()
  }, [id])

  // Refetch when page becomes visible (user returns to this page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [id])

  return { item, correspondence, emails, statusHistory, documents, loading, error }
}
