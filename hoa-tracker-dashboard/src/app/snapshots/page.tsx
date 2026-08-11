'use client'

import { useEffect, useState } from 'react'
import { getLatestSnapshots, getSnapshotDates, getSnapshotDiff } from '@/lib/queries'
import { Loading } from '@/components/loading'
import { formatDateTime } from '@/lib/format'

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate1, setSelectedDate1] = useState<string>('')
  const [selectedDate2, setSelectedDate2] = useState<string>('')
  const [diffs, setDiffs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getLatestSnapshots(), getSnapshotDates()])
      .then(([snap, dt]) => {
        setSnapshots(snap)
        setDates(dt)
        if (dt.length >= 2) {
          setSelectedDate1(dt[0])
          setSelectedDate2(dt[1])
        }
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleCompareDates = async () => {
    if (selectedDate1 && selectedDate2) {
      const diffData = await getSnapshotDiff(selectedDate1, selectedDate2)
      setDiffs(diffData)
    }
  }

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>

  const grouped = new Map<string, any[]>()
  for (const snap of snapshots) {
    const status = snap.status_raw || 'Unknown'
    if (!grouped.has(status)) grouped.set(status, [])
    grouped.get(status)!.push(snap)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">WO Status Snapshots</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">Compare Snapshots</h2>
        <div className="flex gap-4 flex-wrap">
          <select
            value={selectedDate1}
            onChange={e => setSelectedDate1(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            {dates.map(d => (
              <option key={d} value={d}>
                {formatDateTime(d)}
              </option>
            ))}
          </select>
          <select
            value={selectedDate2}
            onChange={e => setSelectedDate2(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            {dates.map(d => (
              <option key={d} value={d}>
                {formatDateTime(d)}
              </option>
            ))}
          </select>
          <button
            onClick={handleCompareDates}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Compare
          </button>
        </div>
      </div>

      {diffs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Changes</h2>
          <div className="space-y-2 text-sm">
            {diffs.map((diff, idx) => (
              <div
                key={idx}
                className={`p-2 rounded ${
                  diff.type === 'new'
                    ? 'bg-green-50 text-green-800'
                    : diff.type === 'removed'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-yellow-50 text-yellow-800'
                }`}
              >
                {diff.type === 'new' && `+ ${diff.wo_number}`}
                {diff.type === 'removed' && `- ${diff.wo_number}`}
                {diff.type === 'status_changed' &&
                  `~ ${diff.wo_number}: ${diff.old?.status_raw} → ${diff.new?.status_raw}`}
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-gray-900 mb-4">Latest Snapshot</h2>
      {Array.from(grouped.entries()).map(([status, items]) => (
        <div key={status} className="mb-6">
          <h3 className="font-semibold text-gray-800 bg-gray-100 px-4 py-2 rounded mb-2">
            {status} ({items.length})
          </h3>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">WO #</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Parcel</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Homeowner</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(snap => (
                  <tr key={snap.id} className="hover:bg-blue-50">
                    <td className="px-4 py-2 text-sm font-mono text-gray-900">{snap.wo_number}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{snap.parcel_code || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{snap.homeowner_name || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                      {snap.description || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{snap.vendor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
