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

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getWorkItem(id),
      getWorkItemCorrespondence(id),
      getWorkItemEmails(id),
      getWorkItemStatusHistory(id),
      getWorkItemDocuments(id),
    ])
      .then(([wi, corr, em, hist, docs]) => {
        setItem(wi)
        setCorrespondence(corr)
        setEmails(em)
        setStatusHistory(hist)
        setDocuments(docs)
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return { item, correspondence, emails, statusHistory, documents, loading, error }
}
