'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loading } from '@/components/loading'
import { SortableTh } from '@/components/sortable-th'
import { useSortableData } from '@/hooks/useSortableData'
import { contactsOf, ROLE_LABEL, type DirectoryPerson, type PersonRole } from '@/lib/directory'

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
    ...p.contacts.map((contact) => contact.value),
    p.officialOwner,
    p.parcelCode,
    p.source,
    ROLE_LABEL[p.role],
    p.inactive ? 'inactive' : '',
    ...p.labels,
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
  const [street, setStreet] = useState('')
  const [role, setRole] = useState<PersonRole | ''>('')
  const [label, setLabel] = useState('')
  const [active, setActive] = useState<'' | 'active' | 'inactive'>('')
  const [asOf, setAsOf] = useState<string | null>(null)

  const streets = useMemo(
    () => [...new Set(people.map((person) => person.street).filter(Boolean))].sort(),
    [people],
  )
  const labels = useMemo(
    () => [...new Set(people.flatMap((person) => person.labels))].sort((a, b) => a.localeCompare(b)),
    [people],
  )

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
    () => people.filter((p) => {
      if (street && p.street !== street) return false
      if (role && p.role !== role) return false
      if (label && !p.labels.some((item) => item.toLowerCase() === label.toLowerCase())) return false
      if (active === 'active' && p.inactive) return false
      if (active === 'inactive' && !p.inactive) return false
      return matchesSearch(p, search.trim())
    }),
    [people, search, street, role, label, active],
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
              Read-only directory from Google Contacts. Filter by street, role, or committee label. To change a contact, edit it in Google Contacts.
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
            placeholder="Search email, address, street, name, phone, role, owner…"
            className="w-full sm:max-w-xl px-3 py-2 border border-edge bg-surface text-ink rounded-lg text-sm placeholder:text-mute focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          <select
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="px-3 py-2 border border-edge bg-surface text-ink rounded-lg text-sm"
            aria-label="Street"
          >
            <option value="">All streets</option>
            {streets.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as PersonRole | '')}
            className="px-3 py-2 border border-edge bg-surface text-ink rounded-lg text-sm"
            aria-label="Role"
          >
            <option value="">All roles</option>
            {(Object.keys(ROLE_LABEL) as PersonRole[]).map((item) => (
              <option key={item} value={item}>{ROLE_LABEL[item]}</option>
            ))}
          </select>
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="px-3 py-2 border border-edge bg-surface text-ink rounded-lg text-sm"
            aria-label="Committee or label"
          >
            <option value="">All labels</option>
            {labels.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as '' | 'active' | 'inactive')}
            className="px-3 py-2 border border-edge bg-surface text-ink rounded-lg text-sm"
            aria-label="Active status"
          >
            <option value="">Active and inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
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
          <table className="w-full min-w-[1280px]">
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
                  label="Role"
                  sortKey="role"
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
                  label="Owners"
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
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-mute">
                    No matches for “{search}”.
                  </td>
                </tr>
              ) : (
                sortedItems.map((p) => {
                  const phones = contactsOf(p, 'phone')
                  const emails = contactsOf(p, 'email')
                  return (
                    <tr key={p.id} className={p.inactive ? 'opacity-60 hover:bg-edge/25' : 'hover:bg-edge/25 transition-colors'}>
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
                      <td className="px-4 py-2 text-sm text-ink">
                        {p.lastName || '—'}
                        {p.inactive && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-mute">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-ink">{p.firstName || '—'}</td>
                      <td className="px-4 py-2 text-sm text-mute whitespace-nowrap">{ROLE_LABEL[p.role]}</td>
                      <td className="px-4 py-2 text-sm">
                        {emails.length === 0 ? (
                          <span className="text-mute">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {emails.map((contact) => (
                              <a
                                key={contact.value}
                                href={`mailto:${contact.value}`}
                                className="text-blue-300 hover:underline break-all"
                              >
                                {contact.value}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-mute whitespace-nowrap">
                        {phones.length === 0 ? '—' : phones.map((contact) => contact.value).join(' · ')}
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
          {search.trim() || street || role || label || active ? ' matching the current filters' : ''}
          {' · '}
          {people.filter((person) => person.inactive).length} inactive
          {' · '}
          one row per person, from Google Contacts. Inactive rows stay until purged.
        </p>
      </div>
    </div>
  )
}
