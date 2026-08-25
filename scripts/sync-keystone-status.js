#!/usr/bin/env node
/**
 * Sync keystone_status from Keystone Cache spreadsheet
 * Work orders: match by keystone_wo_number
 * ARC requests: match by (address, date, fuzzy description)
 */

const { createClient } = require('@supabase/supabase-js')
const { google } = require('googleapis')
const stringSimilarity = require('string-similarity')

const FUZZY_MATCH_THRESHOLD = 0.8 // Configurable tolerance
const KEYSTONE_CACHE_SHEET_ID = '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getSheetData(sheetName) {
  const sheets = google.sheets({
    version: 'v4',
    auth: new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    })
  })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: KEYSTONE_CACHE_SHEET_ID,
    range: `'${sheetName}'!A:Z`
  })

  return response.data.values || []
}

function parseWorkOrdersTab(rows) {
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h?.toLowerCase?.() || '')
  const woNumIdx = headers.indexOf('wo #') || headers.indexOf('wo#')
  const statusIdx = headers.indexOf('status')

  if (woNumIdx === -1 || statusIdx === -1) {
    console.warn('⚠ Could not find WO# or Status column in Work Orders tab')
    return []
  }

  return rows.slice(1)
    .filter(row => row[woNumIdx])
    .map(row => ({
      wo_number: String(row[woNumIdx]).trim(),
      keystone_status: String(row[statusIdx] || '').trim()
    }))
}

function parseArcTab(rows) {
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h?.toLowerCase?.() || '')
  const addressIdx = headers.findIndex(h => h.includes('address') || h.includes('property'))
  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('submitted'))
  const statusIdx = headers.indexOf('status')
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('desc'))

  if (addressIdx === -1 || dateIdx === -1 || statusIdx === -1) {
    console.warn('⚠ Could not find required columns in ARC Review tab')
    return []
  }

  return rows.slice(1)
    .filter(row => row[addressIdx])
    .map(row => ({
      address: String(row[addressIdx] || '').trim(),
      submission_date: String(row[dateIdx] || '').trim(),
      keystone_status: String(row[statusIdx] || '').trim(),
      description: String(row[descIdx] || '').trim()
    }))
}

async function syncWorkOrders(keystoneWOs) {
  console.log(`\nSyncing ${keystoneWOs.length} Work Orders...`)

  let matched = 0
  let updated = 0

  for (const ksWo of keystoneWOs) {
    // Find our work item by keystone_wo_number
    const { data: items, error } = await supabase
      .from('work_items')
      .select('id, keystone_status')
      .eq('keystone_wo_number', ksWo.wo_number)

    if (error) {
      console.error(`Error querying WO ${ksWo.wo_number}: ${error.message}`)
      continue
    }

    if (items.length === 0) {
      continue // No match
    }

    matched++
    const item = items[0]

    // Update if status changed
    if (item.keystone_status !== ksWo.keystone_status) {
      const { error: updateError } = await supabase
        .from('work_items')
        .update({ keystone_status: ksWo.keystone_status })
        .eq('id', item.id)

      if (updateError) {
        console.error(`Error updating WO ${ksWo.wo_number}: ${updateError.message}`)
      } else {
        updated++
      }
    }
  }

  console.log(`  Matched: ${matched}, Updated: ${updated}`)
  return { matched, updated }
}

async function syncArcRequests(keystoneArcs) {
  console.log(`\nSyncing ${keystoneArcs.length} ARC Requests...`)

  let matched = 0
  let updated = 0

  for (const ksArc of keystoneArcs) {
    // Parse submission date to YYYY-MM-DD format
    const ksDate = parseDate(ksArc.submission_date)
    if (!ksDate) continue

    // Find our ARC requests by property address and created_date
    const { data: ourArcs, error } = await supabase
      .from('work_items')
      .select('id, title, description, keystone_status, properties(address)')
      .eq('category', 'arc_request')
      .eq('properties.address', ksArc.address)
      // Filter by date range (same day)
      .gte('created_date', `${ksDate}T00:00:00`)
      .lte('created_date', `${ksDate}T23:59:59`)

    if (error) {
      console.warn(`Error finding ARC for ${ksArc.address}: ${error.message}`)
      continue
    }

    if (ourArcs.length === 0) continue

    matched++
    let item = ourArcs[0]

    // If multiple on same day, use fuzzy description match
    if (ourArcs.length > 1) {
      let bestMatch = ourArcs[0]
      let bestScore = 0

      for (const arc of ourArcs) {
        const score = stringSimilarity.compareTwoStrings(
          (arc.description || '').toLowerCase(),
          ksArc.description.toLowerCase()
        )
        if (score > bestScore) {
          bestScore = score
          bestMatch = arc
        }
      }

      if (bestScore < FUZZY_MATCH_THRESHOLD) {
        console.warn(
          `⚠ Low confidence match for ${ksArc.address} on ${ksDate} (score: ${bestScore.toFixed(2)})`
        )
      }
      item = bestMatch
    }

    // Update if status changed
    if (item.keystone_status !== ksArc.keystone_status) {
      const { error: updateError } = await supabase
        .from('work_items')
        .update({ keystone_status: ksArc.keystone_status })
        .eq('id', item.id)

      if (updateError) {
        console.error(`Error updating ARC ${item.id}: ${updateError.message}`)
      } else {
        updated++
      }
    }
  }

  console.log(`  Matched: ${matched}, Updated: ${updated}`)
  return { matched, updated }
}

function parseDate(dateStr) {
  if (!dateStr) return null

  // Try various date formats
  let date
  if (dateStr.includes('/')) {
    // MM/DD/YYYY
    const [m, d, y] = dateStr.split('/')
    date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  } else if (dateStr.includes('-')) {
    // YYYY-MM-DD or DD-MM-YYYY
    const parts = dateStr.split('-')
    if (parts[0].length === 4) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    } else {
      date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
    }
  } else {
    return null
  }

  if (isNaN(date.getTime())) return null

  return date.toISOString().split('T')[0]
}

async function main() {
  try {
    console.log('Starting Keystone status sync...')

    // Fetch from Keystone Cache
    const woRows = await getSheetData('Work Orders')
    const arcRows = await getSheetData('ARC Review')

    const keystoneWOs = parseWorkOrdersTab(woRows)
    const keystoneArcs = parseArcTab(arcRows)

    console.log(`Fetched ${keystoneWOs.length} WOs and ${keystoneArcs.length} ARCs from Keystone Cache`)

    // Sync both
    const woStats = await syncWorkOrders(keystoneWOs)
    const arcStats = await syncArcRequests(keystoneArcs)

    console.log(`\n✓ Sync complete`)
    console.log(`  Work Orders: ${woStats.matched} matched, ${woStats.updated} updated`)
    console.log(`  ARC Requests: ${arcStats.matched} matched, ${arcStats.updated} updated`)

  } catch (error) {
    console.error('Fatal error:', error.message)
    process.exit(1)
  }
}

main()
