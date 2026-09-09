import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { getGoogleJwt } from '@/lib/google-sa'
import { parcelCodeFromParts } from '@/lib/parcel'
import type { DirectoryPerson } from '@/lib/directory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SHEET_ID = '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'
const FULL_DIRECTORY_RANGE = "'Full Directory'!A2:J500"

type PropertyRow = {
  id: string
  parcel_code: string | null
  owner_name: string | null
  owner_email: string | null
  owner_phone: string | null
}

function cell(row: string[], i: number): string {
  return (row[i] ?? '').toString().trim()
}

export async function GET() {
  try {
    const jwt = await getGoogleJwt([
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ])
    const sheets = google.sheets({ version: 'v4', auth: jwt })

    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: FULL_DIRECTORY_RANGE,
    })
    const rows = sheetRes.data.values || []

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase env not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    const { data: properties, error: propErr } = await supabase
      .from('properties')
      .select('id, parcel_code, owner_name, owner_email, owner_phone')

    if (propErr) {
      console.error('directory properties:', propErr)
      return NextResponse.json({ error: propErr.message }, { status: 500 })
    }

    const byParcel = new Map<string, PropertyRow>()
    for (const p of (properties || []) as PropertyRow[]) {
      if (p.parcel_code) byParcel.set(p.parcel_code.toUpperCase(), p)
    }

    const people: DirectoryPerson[] = []
    for (const row of rows) {
      if (!row || row.every((c) => !String(c || '').trim())) continue

      const street = cell(row, 0)
      const streetNumber = cell(row, 1)
      const unit = cell(row, 2)
      const fullAddress = cell(row, 3)
      const lastName = cell(row, 4)
      const firstName = cell(row, 5)
      const phone1 = cell(row, 6)
      const phone2 = cell(row, 7)
      const email = cell(row, 8)
      const source = cell(row, 9)

      // Skip header if range ever includes it
      if (street.toLowerCase() === 'street' && lastName.toLowerCase() === 'last name') {
        continue
      }

      // Skip non-homeowner contacts (property manager, vendors, etc.)
      // These are in Google Contacts but don't match any HOA property.
      if (!parcelCode && !prop) {
        // Contacts-only entries with no street address — likely vendor/manager
        const fullLower = (firstName + ' ' + lastName).toLowerCase()
        const emailLower = (email || '').toLowerCase()
        if (emailLower.includes('keystonepacific') ||
            emailLower.includes('keystonepacific.com') ||
            (fullLower.includes('josh') && fullLower.includes('hall'))) {
          continue
        }
      }

      const parcelCode = parcelCodeFromParts(street, streetNumber, unit)
      const prop = parcelCode ? byParcel.get(parcelCode.toUpperCase()) : undefined

      people.push({
        street,
        streetNumber,
        unit,
        fullAddress:
          fullAddress ||
          [streetNumber, street, unit ? `#${unit}` : ''].filter(Boolean).join(' '),
        lastName,
        firstName,
        phone1,
        phone2,
        email,
        source,
        parcelCode,
        propertyId: prop?.id ?? null,
        officialOwner: prop?.owner_name ?? null,
        ownerEmail: prop?.owner_email ?? null,
        ownerPhone: prop?.owner_phone ?? null,
      })
    }

    return NextResponse.json(
      {
        asOf: new Date().toISOString(),
        count: people.length,
        people,
      },
      {
        headers: {
          // Client may cache briefly; sheet rebuilds nightly
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('GET /api/directory:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
