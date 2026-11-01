import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coverage, linkParcel, planSync } from './plan.js'
import type { Classified, ParsedPerson } from './parse.js'

function person(over: Partial<ParsedPerson> & { googleResourceName: string; parcelCode: string }): ParsedPerson {
  return {
    googleEtag: null,
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada Lovelace',
    street: 'boulder circle',
    streetNumber: '13622',
    unit: '101',
    rawAddress: null,
    role: 'owner_occupant',
    labels: [],
    contacts: [],
    ...over,
  }
}

function row(personRow: ParsedPerson | null, resourceName: string | null = personRow?.googleResourceName ?? null): Classified {
  return {
    resourceName,
    displayName: personRow?.displayName || '',
    person: personRow,
    skipReason: personRow ? null : 'no_hoa_address',
    unparsedLines: [],
  }
}

test('an absent active contact is marked inactive, and a returning one is reactivated', () => {
  const plan = planSync(
    [
      row(person({ googleResourceName: 'people/back', parcelCode: '13622BC1' })),
      row(null, 'people/vendor'),
    ],
    [
      { googleResourceName: 'people/back', inactive: true },
      { googleResourceName: 'people/gone', inactive: false },
      { googleResourceName: 'people/already', inactive: true },
    ],
  )
  assert.deepEqual(plan.upserts.map((item) => item.googleResourceName), ['people/back'])
  assert.deepEqual(plan.markInactive, ['people/gone'])
  assert.deepEqual(plan.reactivate, ['people/back'])
  assert.equal(plan.skipped, 1)
})

test('coverage reports tracker parcels with nobody, and parcels that are not in the tracker', () => {
  const report = coverage(
    [
      person({ googleResourceName: 'people/a', parcelCode: '13622BC1' }),
      person({ googleResourceName: 'people/b', parcelCode: '13622bc1' }),
      person({ googleResourceName: 'people/c', parcelCode: '99999XX1' }),
    ],
    [
      { id: 'p1', parcelCode: '13622BC1' },
      { id: 'p2', parcelCode: '13622BC2' },
    ],
  )
  assert.equal(report.parcelsWithPerson, 1)
  assert.deepEqual(report.parcelsWithNoPerson, ['13622BC2'])
  assert.deepEqual(report.parcelsNotInTracker, ['99999XX1'])
})

test('13678 Boulder Point unit 101 links to the tracker code that has no digit', () => {
  const properties = [{ id: 'bp', parcelCode: '13678BP' }, { id: 'other', parcelCode: '13622BC1' }]
  assert.deepEqual(linkParcel('13678BP1', properties), { parcelCode: '13678BP', propertyId: 'bp' })
  assert.deepEqual(linkParcel('13622BC1', properties).propertyId, 'other')
  const report = coverage(
    [person({ googleResourceName: 'people/bp', parcelCode: '13678BP1' })],
    properties,
  )
  assert.deepEqual(report.parcelsWithNoPerson, ['13622BC1'])
  assert.deepEqual(report.parcelsNotInTracker, [])
})
