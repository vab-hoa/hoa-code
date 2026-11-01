import { writeFileSync } from 'node:fs'
import { applySync, getDb, loadExistingPeople, loadProperties } from './db.js'
import { loadGoogleContacts } from './google.js'
import { classifyPerson, looksLikeHoaAddress, type Role } from './parse.js'
import { countByRole, coverage, planSync } from './plan.js'

/**
 * Sync Google Contacts into people + contacts.
 *
 *   npm run contacts-sync -- --dry-run
 *   npm run contacts-sync -- --write --out contacts-sync-report.json
 *
 * The default is a dry run. --write upserts people, replaces their contact
 * rows, and marks people missing from this fetch inactive. It does not delete.
 */
async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: contacts-sync [--dry-run | --write] [--out file]')
    return
  }
  const write = process.argv.includes('--write')
  const dry = process.argv.includes('--dry-run')
  if (write && dry) throw new Error('pass only one of --write and --dry-run')
  const mode = write ? 'write' : 'dry-run'
  const out = option('--out')

  const db = getDb()
  const [properties, existing, google] = await Promise.all([
    loadProperties(db),
    loadExistingPeople(db),
    loadGoogleContacts(),
  ])
  if (write && existing.missing) {
    throw new Error('people table is not in the database. Apply hoa-tracker/schema_people.sql before --write.')
  }
  const classified = google.people.map((person) => classifyPerson(person, google.groups))
  const plan = planSync(classified, existing.rows)
  if (write && google.people.length === 0) {
    throw new Error('refusing to write: People API returned no contacts')
  }
  if (write && plan.upserts.length === 0) {
    throw new Error('refusing to write: no contact parsed to an HOA parcel')
  }
  const activeExisting = existing.rows.filter((row) => !row.inactive).length
  if (write && activeExisting > 10 && plan.markInactive.length > activeExisting / 2) {
    throw new Error(`refusing to mark ${plan.markInactive.length} of ${activeExisting} active people inactive`)
  }

  const covered = coverage(plan.upserts, properties)
  const byRole = countByRole(plan.upserts)
  const labelCounts: Record<string, number> = {}
  let emails = 0
  let phones = 0
  for (const person of plan.upserts) {
    for (const label of person.labels) labelCounts[label] = (labelCounts[label] || 0) + 1
    for (const contact of person.contacts) {
      if (contact.kind === 'email') emails += 1
      else phones += 1
    }
  }
  const unparsedHoaAddresses = [...new Set(
    classified.flatMap((item) => item.unparsedLines.filter(looksLikeHoaAddress)),
  )].sort().slice(0, 40)

  const report = {
    mode,
    fetched: google.people.length,
    contactGroups: [...google.groups.values()].sort(),
    peopleTable: existing.missing ? 'missing' : 'ok',
    hoaPeople: plan.upserts.length,
    skipped: plan.skipped,
    byRole,
    labelCounts,
    emails,
    phones,
    parcelsInTracker: covered.parcelsInTracker,
    parcelsWithPerson: covered.parcelsWithPerson,
    parcelsWithNoPerson: covered.parcelsWithNoPerson,
    parcelsNotInTracker: covered.parcelsNotInTracker,
    wouldMarkInactive: plan.markInactive.length,
    wouldReactivate: plan.reactivate.length,
    unparsedHoaAddresses,
  }

  console.log(summary(report))
  if (out) writeFileSync(out, JSON.stringify(report, null, 2))
  if (!write) return

  await applySync(db, plan, properties)
  console.log(`wrote ${plan.upserts.length} people, replaced their contacts, marked ${plan.markInactive.length} inactive`)
}

function option(flag: string): string {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || '' : ''
}

function summary(report: {
  mode: string
  fetched: number
  contactGroups: string[]
  peopleTable: string
  hoaPeople: number
  skipped: number
  byRole: Record<Role, number>
  emails: number
  phones: number
  parcelsInTracker: number
  parcelsWithPerson: number
  parcelsWithNoPerson: string[]
  parcelsNotInTracker: string[]
  wouldMarkInactive: number
  wouldReactivate: number
  unparsedHoaAddresses: string[]
}): string {
  const lines = [
    `contacts sync ${report.mode}`,
    `fetched ${report.fetched} contacts, ${report.hoaPeople} on an HOA parcel, ${report.skipped} skipped`,
    `roles: owner-occupant ${report.byRole.owner_occupant}, non-occupant owner ${report.byRole.non_occupant_owner}, non-owner occupant ${report.byRole.non_owner_occupant}, household ${report.byRole.household_member}`,
    `contacts: ${report.emails} emails, ${report.phones} phones`,
    `parcels: ${report.parcelsWithPerson} of ${report.parcelsInTracker} have a person`,
    `people table: ${report.peopleTable}`,
    `inactive: mark ${report.wouldMarkInactive}, reactivate ${report.wouldReactivate}`,
    `contact groups: ${report.contactGroups.join(', ') || '(none)'}`,
  ]
  if (report.parcelsWithNoPerson.length) {
    lines.push(`parcels with nobody: ${report.parcelsWithNoPerson.join(', ')}`)
  }
  if (report.parcelsNotInTracker.length) {
    lines.push(`parsed parcels not in the tracker: ${report.parcelsNotInTracker.join(', ')}`)
  }
  if (report.unparsedHoaAddresses.length) {
    lines.push('unparsed lines that look like this neighborhood:')
    for (const line of report.unparsedHoaAddresses) lines.push(`  ${line}`)
  }
  return lines.join('\n')
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})
