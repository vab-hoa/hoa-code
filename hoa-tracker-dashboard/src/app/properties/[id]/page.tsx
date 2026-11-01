'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { getProperty, getPropertyWorkItems, getPropertySourceDocuments } from '@/lib/queries'
import { Loading } from '@/components/loading'
import { StatusBadge } from '@/components/status-badge'
import { CategoryBadge } from '@/components/category-badge'
import { formatDate } from '@/lib/format'
import { contactsOf, OWNER_ROLES, personName, ROLE_LABEL, type DirectoryPerson } from '@/lib/directory'

export default function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [property, setProperty] = useState<any>(null)
  const [workItems, setWorkItems] = useState<any[]>([])
  const [sourceDocuments, setSourceDocuments] = useState<any[]>([])
  const [residents, setResidents] = useState<DirectoryPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getProperty(id),
      getPropertyWorkItems(id),
      getPropertySourceDocuments(id),
      fetch('/api/directory')
        .then(async (res) => {
          const body = await res.json()
          if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
          return (body.people || []) as DirectoryPerson[]
        })
        .catch(() => [] as DirectoryPerson[]),
    ])
      .then(([p, wi, sd, people]) => {
        setProperty(p)
        setWorkItems(wi)
        setSourceDocuments(sd)
        setResidents(
          people.filter(
            (person) =>
              person.propertyId === id ||
              (p?.parcel_code &&
                person.parcelCode &&
                person.parcelCode.toUpperCase() === String(p.parcel_code).toUpperCase())
          )
        )
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const displayAddress = useMemo(() => {
    if (residents[0]?.fullAddress) return residents[0].fullAddress
    if (property?.address && !String(property.address).startsWith('P9060')) {
      return property.address
    }
    return property?.parcel_code || 'Property'
  }, [property, residents])

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>
  if (!property) return <div className="p-6 text-gray-600">Property not found</div>

  return (
    <div className="bg-app-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/properties"
          className="text-blue-300 hover:underline text-sm mb-4 inline-block"
        >
          ← Back to properties
        </Link>

        <div className="bg-surface border border-edge rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-ink mb-1">{displayAddress}</h1>
          <p className="text-sm text-mute mb-4">
            Parcel {property.parcel_code}
            {property.unit ? ` · Unit ${property.unit}` : ''}
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-ink mb-2">Residents / contacts</h2>
              {residents.length === 0 ? (
                <p className="text-sm text-mute">No contacts synced for this parcel.</p>
              ) : (
                <div className="space-y-3">
                  {residents.map((resident) => (
                    <PersonCard key={resident.id} person={resident} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink mb-2">Owners</h2>
              <OwnerList people={residents.filter((resident) => OWNER_ROLES.includes(resident.role))} />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-ink mb-4">Work Items ({workItems.length})</h2>
          {workItems.length === 0 ? (
            <p className="text-mute text-sm">No work items for this property</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-edge/50 border-b border-edge">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink">Title</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {workItems.map((wi) => (
                    <tr key={wi.id} className="hover:bg-edge/25 transition-colors">
                      <td className="px-3 py-2">
                        <Link
                          href={`/work-items/${wi.id}`}
                          className="text-blue-300 hover:underline text-sm"
                        >
                          {wi.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <CategoryBadge category={wi.category} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={wi.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-mute">
                        {formatDate(wi.created_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {sourceDocuments.length > 0 && (
          <div className="bg-surface border border-edge rounded-lg p-6">
            <h2 className="text-lg font-bold text-ink mb-4">Source Documents</h2>
            <div className="space-y-3 text-sm">
              {sourceDocuments.map((doc) => (
                <div key={doc.id} className="border-l-4 border-edge pl-3 py-2">
                  <div className="font-medium text-ink">{doc.subject || doc.doc_type}</div>
                  <div className="text-xs text-mute mt-1">
                    {doc.from_name} — {formatDate(doc.received_date)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PersonCard({ person }: { person: DirectoryPerson }) {
  const emails = contactsOf(person, 'email')
  const phones = contactsOf(person, 'phone')
  const name = personName(person) || '—'
  return (
    <div className={`text-sm border border-edge rounded-md p-3 ${person.inactive ? 'opacity-60' : ''}`}>
      <div className="font-medium text-ink">
        {name}
        {person.inactive && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-mute">Inactive</span>
        )}
      </div>
      <div className="text-[11px] text-mute">{ROLE_LABEL[person.role]}</div>
      {emails.map((contact) => (
        <div key={contact.value} className="text-mute">
          <a href={`mailto:${contact.value}`} className="text-blue-300 hover:underline">
            {contact.value}
          </a>
        </div>
      ))}
      {phones.length > 0 && (
        <div className="text-mute">{phones.map((contact) => contact.value).join(' · ')}</div>
      )}
    </div>
  )
}

function OwnerList({ people }: { people: DirectoryPerson[] }) {
  if (people.length === 0) {
    return (
      <div className="text-sm text-mute border border-edge rounded-md p-3">
        <p>No owner-role contact for this parcel.</p>
        <p className="text-[11px] mt-2">
          Owners are Google Contacts labeled owner-occupant or non-occupant owner. Inactive people stay listed until purged.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {people.map((person) => (
        <PersonCard key={person.id} person={person} />
      ))}
      <p className="text-[11px] text-mute">
        Owners are Google Contacts labeled owner-occupant or non-occupant owner. Inactive people stay listed until purged.
      </p>
    </div>
  )
}
