import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyPerson,
  contactValues,
  looksLikeHoaAddress,
  otherLabels,
  parseContactAddress,
  roleFromLabels,
  type GooglePerson,
} from './parse.js'

test('parses the address forms the Full Directory builder accepted', () => {
  assert.equal(parseContactAddress({ formattedValue: '13684 Stone Circle #101' })?.parcelCode, '13684SC1')
  assert.equal(parseContactAddress({ formattedValue: '13673 Plaster Pt Unit 102' })?.parcelCode, '13673PP2')
  assert.equal(parseContactAddress({ formattedValue: '13739 Rock Pt. #101' })?.parcelCode, '13739RP1')
  assert.equal(parseContactAddress({ formattedValue: '13635 Boulder Cir Unit 101' })?.parcelCode, '13635BC1')
})

test('ignores a city suffix and still matches the street', () => {
  const parsed = parseContactAddress({
    formattedValue: '13622 Boulder Circle #101\nBroomfield, CO 80023',
  })
  assert.equal(parsed?.parcelCode, '13622BC1')
  assert.equal(parsed?.street, 'boulder circle')
  assert.equal(parsed?.unit, '101')
})

test('uses streetAddress plus extendedAddress', () => {
  const parsed = parseContactAddress({
    streetAddress: '13626 Boulder Circle',
    extendedAddress: 'Unit 2',
    formattedValue: 'somewhere else',
  })
  assert.equal(parsed?.parcelCode, '13626BC2')
})

test('skips a vendor address', () => {
  assert.equal(parseContactAddress({ formattedValue: '123 Main Street, Denver, CO' }), null)
  assert.equal(parseContactAddress({ formattedValue: 'PO Box 100' }), null)
})

test('role priority prefers owner-occupant when several occupancy labels are set', () => {
  assert.equal(roleFromLabels(['non-owner occupant', 'Owner-Occupant']), 'owner_occupant')
  assert.equal(roleFromLabels(['ARC', 'Snow Squad']), 'household_member')
  assert.equal(roleFromLabels(['non-occupant owner']), 'non_occupant_owner')
})

test('occupancy labels are not copied into the labels array', () => {
  assert.deepEqual(otherLabels(['owner-occupant', 'ARC', 'Boulder Circle', 'arc']), ['ARC', 'Boulder Circle'])
})

test('stores every email and phone, lowercases email, and defaults one primary', () => {
  const emails = contactValues('email', [
    { value: 'Ada@Example.com', formattedType: 'Home' },
    { value: 'ada@example.com' },
    { value: 'ada.other@example.com', metadata: { primary: true }, type: 'work' },
  ])
  assert.deepEqual(emails.map((item) => item.value), ['ada@example.com', 'ada.other@example.com'])
  assert.equal(emails[1].isPrimary, true)
  assert.equal(emails[0].isPrimary, false)

  const phones = contactValues('phone', [
    { value: '(303) 555-0100', canonicalForm: '+13035550100', type: 'mobile' },
    { value: '303-555-0101', formattedType: 'Home' },
  ])
  assert.equal(phones[0].value, '+13035550100')
  assert.equal(phones[0].isPrimary, true)
  assert.equal(phones[1].value, '303-555-0101')
})

test('classifies an HOA contact and skips a contact with no parcel', () => {
  const groups = new Map([
    ['contactGroups/owners', 'owner-occupant'],
    ['contactGroups/arc', 'ARC'],
    ['contactGroups/myContacts', 'myContacts'],
  ])
  const owner: GooglePerson = {
    resourceName: 'people/c1',
    etag: 'etag-1',
    names: [{ givenName: 'Ada', familyName: 'Lovelace', displayName: 'Ada Lovelace', metadata: { primary: true } }],
    emailAddresses: [{ value: 'ada@example.com', metadata: { primary: true } }],
    phoneNumbers: [{ canonicalForm: '+13035550100', metadata: { primary: true } }],
    addresses: [{ formattedValue: '13622 Boulder Circle #101\nBroomfield, CO 80023' }],
    memberships: [
      { contactGroupMembership: { contactGroupResourceName: 'contactGroups/owners' } },
      { contactGroupMembership: { contactGroupResourceName: 'contactGroups/arc' } },
      { contactGroupMembership: { contactGroupResourceName: 'contactGroups/myContacts' } },
    ],
  }
  const classified = classifyPerson(owner, groups)
  assert.equal(classified.person?.parcelCode, '13622BC1')
  assert.equal(classified.person?.role, 'owner_occupant')
  assert.deepEqual(classified.person?.labels, ['ARC'])
  assert.equal(classified.person?.contacts.length, 2)

  const vendor = classifyPerson({
    resourceName: 'people/vendor',
    names: [{ displayName: 'Josh Hall' }],
    addresses: [{ formattedValue: 'Keystone Pacific, Denver' }],
    emailAddresses: [{ value: 'josh@keystonepacific.com' }],
  }, groups)
  assert.equal(vendor.person, null)
  assert.equal(vendor.skipReason, 'no_hoa_address')
})

test('a non-owner occupant with an HOA address gets their own row', () => {
  const groups = new Map([['contactGroups/rent', 'non-owner occupant']])
  const classified = classifyPerson({
    resourceName: 'people/renter',
    names: [{ givenName: 'Grace', familyName: 'Hopper' }],
    addresses: [{ streetAddress: '13721 Plaster Point', extendedAddress: '#102' }],
    memberships: [{ contactGroupMembership: { contactGroupId: 'rent' } }],
  }, groups)
  assert.equal(classified.person?.role, 'non_owner_occupant')
  assert.equal(classified.person?.parcelCode, '13721PP2')
})

test('hoa-looking leftover addresses are distinguishable from vendor mail', () => {
  assert.equal(looksLikeHoaAddress('13622 Boulder Cir'), true)
  assert.equal(looksLikeHoaAddress('Keystone Pacific Denver'), false)
})
