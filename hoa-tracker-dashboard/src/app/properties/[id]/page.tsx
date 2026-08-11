'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { getProperty, getPropertyWorkItems, getPropertySourceDocuments } from '@/lib/queries'
import { Loading } from '@/components/loading'
import { StatusBadge } from '@/components/status-badge'
import { CategoryBadge } from '@/components/category-badge'
import { formatDate } from '@/lib/format'

export default function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [property, setProperty] = useState<any>(null)
  const [workItems, setWorkItems] = useState<any[]>([])
  const [sourceDocuments, setSourceDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getProperty(id),
      getPropertyWorkItems(id),
      getPropertySourceDocuments(id),
    ])
      .then(([p, wi, sd]) => {
        setProperty(p)
        setWorkItems(wi)
        setSourceDocuments(sd)
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>
  if (!property) return <div className="p-6 text-gray-600">Property not found</div>

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link href="/properties" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← Back to properties
      </Link>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{property.address}</h1>
        <p className="text-gray-600 font-mono text-sm">{property.parcel_code}</p>
        <div className="mt-4 space-y-2 text-sm">
          {property.owner_name && <p>Owner: {property.owner_name}</p>}
          {property.owner_email && <p>Email: {property.owner_email}</p>}
          {property.owner_phone && <p>Phone: {property.owner_phone}</p>}
          {property.unit && <p>Unit: {property.unit}</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Work Items ({workItems.length})</h2>
        {workItems.length === 0 ? (
          <p className="text-gray-500 text-sm">No work items for this property</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workItems.map(wi => (
                  <tr key={wi.id} className="hover:bg-blue-50">
                    <td className="px-3 py-2">
                      <Link href={`/work-items/${wi.id}`} className="text-blue-600 hover:underline text-sm">
                        {wi.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <CategoryBadge category={wi.category} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={wi.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{formatDate(wi.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sourceDocuments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Source Documents</h2>
          <div className="space-y-3 text-sm">
            {sourceDocuments.map(doc => (
              <div key={doc.id} className="border-l-4 border-gray-300 pl-3 py-2">
                <div className="font-medium text-gray-900">{doc.subject || doc.doc_type}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {doc.from_name} — {formatDate(doc.received_date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
