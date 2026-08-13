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
    <div className="bg-app-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-ink mb-6">Properties</h1>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by address, parcel code, or owner name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-edge bg-surface text-ink rounded-lg text-sm"
          />
        </div>

        <div className="bg-surface rounded-lg border border-edge overflow-x-auto">
          <table className="w-full">
            <thead className="bg-edge/50 border-b border-edge">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-ink">Address</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-ink">Owner</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-ink">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-edge/25 cursor-pointer transition-colors">
                  <td className="px-4 py-2">
                    <Link href={`/properties/${p.id}`} className="text-blue-300 hover:underline text-sm">
                      {p.parcel_code}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-sm text-mute">{p.owner_name || '—'}</td>
                  <td className="px-4 py-2 text-sm text-mute">{p.owner_email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-mute mt-4">{filtered.length} of {properties.length} properties</p>
      </div>
    </div>
  )
}
