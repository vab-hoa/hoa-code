#!/usr/bin/env node
/**
 * Generate arc_request_serial for all ARC requests
 * Serial format: {parcel_code}-{YYYY-MM-DD}-{A|B|C...}
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function generateArcSerials() {
  console.log('Fetching all ARC requests...')

  // Get all ARC requests
  const { data: arcRequests, error: fetchError } = await supabase
    .from('work_items')
    .select('id, category, created_date, properties(parcel_code)')
    .eq('category', 'arc_request')
    .order('created_date', { ascending: true })

  if (fetchError) {
    console.error('Error fetching ARC requests:', fetchError.message)
    process.exit(1)
  }

  console.log(`Found ${arcRequests.length} ARC requests`)

  // Group by (parcel_code, created_date)
  const groups = {}
  const skipped = []

  arcRequests.forEach(item => {
    if (!item.created_date) {
      skipped.push(item.id)
      return
    }

    const parcelCode = item.properties?.parcel_code || 'UNKNOWN'
    const date = item.created_date.split('T')[0] // YYYY-MM-DD
    const key = `${parcelCode}|${date}`

    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
  })

  if (skipped.length > 0) {
    console.log(`⚠ Skipped ${skipped.length} ARC requests with null created_date`)
  }

  console.log(`Grouped into ${Object.keys(groups).length} unique date/property combinations`)

  // Generate serials for each group
  const updates = []
  for (const [key, items] of Object.entries(groups)) {
    const [parcelCode, date] = key.split('|')

    items.forEach((item, index) => {
      const suffix = String.fromCharCode(65 + index) // A, B, C, ...
      const serial = `${parcelCode}-${date}-${suffix}`

      updates.push({
        id: item.id,
        serial,
        old_serial: item.arc_request_serial
      })
    })
  }

  console.log(`Generated ${updates.length} serials`)

  // Apply updates
  console.log('Applying updates...')
  let updated = 0
  let errors = 0

  for (const update of updates) {
    const { error } = await supabase
      .from('work_items')
      .update({ arc_request_serial: update.serial })
      .eq('id', update.id)

    if (error) {
      console.error(`Error updating ${update.id}: ${error.message}`)
      errors++
    } else {
      updated++
      if (updated % 10 === 0) {
        console.log(`  ${updated}/${updates.length}...`)
      }
    }
  }

  console.log(`\n✓ Updated ${updated} ARC requests`)
  if (errors > 0) {
    console.log(`⚠ ${errors} errors`)
  }

  // Show sample
  console.log('\nSample serials generated:')
  updates.slice(0, 5).forEach(u => {
    console.log(`  ${u.id}: ${u.serial}`)
  })
}

generateArcSerials()
