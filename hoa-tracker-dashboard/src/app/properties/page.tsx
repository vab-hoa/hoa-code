'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loading } from '@/components/loading'
import { SortableTh } from '@/components/sortable-th'
import { useSortableData } from '@/hooks/useSortableData'
import type { DirectoryPerson } from '@/lib/directory'

type SortablePerson = DirectoryPerson & {
  /** Combined resident display name for default sort/search */
  residentName: string
  /** Sort key: "Last, First" */
  sortLastFirst: string
  /** Sort key: "First Last" */
  sortFirstLast: string
  /** Sort key: street + number + unit */
  sortAddress: string
}

function enrich(p: DirectoryPerson): SortablePerson {
  const first = p.firstName || ''
  const last = p.lastName || ''
  const residentName = [first, last].filter(Boolean).join(' ').trim() || '—'
  const sortLastFirst = [last, first].filter(Boolean).join(', ').toLowerCase()
  const sortFirstLast = [first, last].filter(Boolean).join(' ').toLowerCase()
  const sortAddress = [
    p.street || '',
    (p.streetNumber || '').padStart(6, '0'),
    (p.unit || '').padStart(4, '0'),
    p.fullAddress || '',
  ]
    .join(' ')
    .toLowerCase()

  return {
    ...p,
    residentName,
    sortLastFirst,
    sortFirstLast,
    sortAddress,
  }
}

function matchesSearch(p: SortablePerson, q: string): boolean {
  if (!q) return true
  const hay = [
    p.fullAddress,
    p.street,
    p.streetNumber,
    p.unit,
    p.firstName,
    p.lastName,
    p.residentName,
    p.email,
    p.phone1,
    p.phone2,
    p.officialOwner,
    p.ownerEmail,
    p.ownerPhone,
    p.parcelCode,
    p.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token))
}

export default function PropertiesPage() {
  const [people, setPeople] = useState<SortablePerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [asOf, setAsOf] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/directory')
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
        return body
      })
      .then((body) => {
        if (cancelled) return
        setPeople((body.people || []).map(enrich))
        setAsOf(body.asOf || null)
        setError(null)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(
    () => people.filter((p) => matchesSearch(p, search.trim())),
    [people, search]
  )

  const { sortedItems, sortKey, sortDir, requestSort } = useSortableData<SortablePerson>(
    filtered,
    { initialKey: 'sortAddress', initialDir: 'asc' }
  )

  if (loading) return <Loading />
  if (error) {
    return (
      <div className="bg-app-bg min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="p-6 text-red-400 bg-surface border border-edge rounded-lg">
            Error loading directory: {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-app-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Properties</h1>
            <p className="text-sm text-mute mt-1">
              Homeowner directory (names, addresses, phones, emails). Official Keystone
              owner is kept on each property but shown second — resident name is primary.
            </p>
          </div>
          {asOf && (
            <p className="text-xs text-mute shrink-0">
              Loaded {new Date(asOf).toLocaleString()}
            </p>
          )}
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, address, street, name, phone, official owner…"
            className="w-full sm:max-w-xl px-3 py-2 border border-edge bg-surface text-ink rounded-lg text-sm placeholder:text-mute focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-mute self-center">Quick sort:</span>
            {(
              [
                ['sortAddress', 'Address'],
                ['sortLastFirst', 'Last name'],
                ['sortFirstLast', 'First name'],
                ['email', 'Email'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => requestSort(key)}
                className={
                  sortKey === key
                    ? 'px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'px-2.5 py-1 rounded-full bg-edge/40 text-mute border border-edge hover:text-ink'
                }
              >
                {label}
                {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-edge overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-edge/50 border-b border-edge">
              <tr>
                <SortableTh
                  label="Address"
                  sortKey="sortAddress"
                  className="min-w-[16rem]"
                  currentSortKey={sortKey as string | null}
                  currentSortDir={sortDir}
                  onSort={(k) => requestSort(k as keyof SortablePerson)}
                />
                <SortableTh
                  label="Last"
                  sortKey="sortLastFirst"
                  currentSortKey={sortKey as string | null}
                  currentSortDir={sortDir}
                  onSort={(k) => requestSort(k as keyof SortablePerson)}
                />
                <SortableTh
                  label="First"
                  sortKey="sortFirstLast"
                  currentSortKey={sortKey as string | null}
                  currentSortDir={sortDir}
                  onSort={(k) => requestSort(k as keyof SortablePerson)}
                />
                <SortableTh
                  label="Email"
                  sortKey="email"
                  currentSortKey={sortKey as string | null}
                  currentSortDir={sortDir}
                  onSort={(k) => requestSort(k as keyof SortablePerson)}
                />
                <th className="px-4 py-2 text-left text-xs font-semibold text-ink">Phone</th>
                <SortableTh
                  label="Official owner"
                  sortKey="officialOwner"
                  currentSortKey={sortKey as string | null}
                  currentSortDir={sortDir}
                  onSort={(k) => requestSort(k as keyof SortablePerson)}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-mute">
                    No matches for “{search}”.
                  </td>
                </tr>
              ) : (
                sortedItems.map((p, idx) => {
                  const phone = [p.phone1, p.phone2].filter(Boolean).join(' · ')
                  const key = `${p.parcelCode || p.fullAddress}-${p.email}-${p.firstName}-${p.lastName}-${idx}`
                  return (
                    <tr key={key} className="hover:bg-edge/25 transition-colors">
                      <td className="px-4 py-2 text-sm text-ink whitespace-nowrap">
                        {p.propertyId ? (
                          <Link
                            href={`/properties/${p.propertyId}`}
                            className="text-blue-300 hover:underline"
                          >
                            {p.fullAddress || '—'}
                          </Link>
                        ) : (
                          <span>{p.fullAddress || '—'}</span>
                        )}
                        {p.parcelCode && (
                          <div className="text-[11px] text-mute mt-0.5">{p.parcelCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-ink">{p.lastName || '—'}</td>
                      <td className="px-4 py-2 text-sm text-ink">{p.firstName || '—'}</td>
                      <td className="px-4 py-2 text-sm">
                        {p.email ? (
                          <a
                            href={`mailto:${p.email}`}
                            className="text-blue-300 hover:underline break-all"
                          >
                            {p.email}
                          </a>
                        ) : (
                          <span className="text-mute">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-mute whitespace-nowrap">
                        {phone || '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-mute max-w-[14rem]">
                        <span className="line-clamp-2" title={p.officialOwner || undefined}>
                          {p.officialOwner || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-mute mt-4">
          {sortedItems.length} of {people.length} people
          {search.trim() ? ` matching “${search.trim()}”` : ''}
          {' · '}
          one row per person (couples appear separately), from Keystone Full Directory
        </p>
      </div>
    </div>
  )
}
