'use client'

import { useMemo } from 'react'
import { Loading } from '@/components/loading'
import { SummaryCards } from '@/components/summary-cards'
import { AgingAlerts } from '@/components/aging-alerts'
import { WorkItemList } from '@/components/work-item-list'
import { useAgingItems } from '@/hooks/useAgingItems'
import { useWorkItems } from '@/hooks/useWorkItems'
import { useRecentActivity } from '@/hooks/useRecentActivity'
import { computeSummaryCounts } from '@/lib/work-item-helpers'

export default function Dashboard() {
  const { data: agingItems, loading: agingLoading, error: agingError } = useAgingItems()
  const { data: workItems, loading: workItemsLoading, error: workItemsError } = useWorkItems()
  
  // Compute summary from the filtered open work items
  const summary = useMemo(() => {
    if (workItems.length === 0) return null
    return computeSummaryCounts(workItems)
  }, [workItems])

  const loading = agingLoading || workItemsLoading
  const error = agingError || workItemsError

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-300">Error loading dashboard: {error}</div>

  return (
    <div className="bg-app-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-ink mb-6">HOA Issue Tracker Dashboard</h1>

        <SummaryCards summary={summary} agingCount={agingItems.length} />

        <AgingAlerts items={agingItems} />
<WorkItemList items={workItems} />
      </div>
    </div>
  )
}
