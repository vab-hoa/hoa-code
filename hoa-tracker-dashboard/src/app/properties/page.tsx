'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getAllProperties } from '@/lib/queries'
import { Loading } from '@/components/loading'
import { useEffect } from 'react'

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    getAllProperties()
      .then(p => { setProperties(p); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () => properties.filter(p =>
      p.address?.toLowerCase().includes(search.toLowerCase()) ||
      p.parcel_code?.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_name?.toLowerCase().includes(search.toLowerCase())
    ),
    [properties, search]
  )

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Properties</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by address, parcel code, or owner name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Address</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Parcel</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Owner</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-blue-50 cursor-pointer">
                <td className="px-4 py-2">
                  <Link href={`/properties/${p.id}`} className="text-blue-600 hover:underline text-sm">
                    {p.address}
                  </Link>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{p.parcel_code}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{p.owner_name || '—'}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{p.owner_email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-4">{filtered.length} of {properties.length} properties</p>
    </div>
  )
}
