/** HOA parcel / address helpers (mirrors hoa-tracker/address_standardization.py). */

const STREET_CODES: Record<string, string> = {
  broadlands: 'BL',
  'broadlands lane': 'BL',
  'boulder point': 'BP',
  'rock point': 'RP',
  'stone circle': 'SC',
  'boulder circle': 'BC',
  'plaster point': 'PP',
}

const STREET_ABBREV: Record<string, string> = {
  cir: 'circle',
  circ: 'circle',
  pt: 'point',
  ln: 'lane',
  blvd: 'boulevard',
  dr: 'drive',
  rd: 'road',
  st: 'street',
  ave: 'avenue',
  ct: 'court',
}

export function normalizeStreetName(raw: string): string {
  const words = raw
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/g, ''))
    .filter(Boolean)
    .map((w) => STREET_ABBREV[w] || w)
  return words.join(' ')
}

export function streetCodeFor(street: string): string | null {
  const norm = normalizeStreetName(street)
  if (STREET_CODES[norm]) return STREET_CODES[norm]
  // Fall back: match known multi-word keys by containment
  for (const [name, code] of Object.entries(STREET_CODES)) {
    if (name.includes(' ') && norm === name) return code
  }
  return null
}

/** Unit "101"/"102" → parcel digit "1"/"2"; bare "1"/"2" pass through. */
export function unitDigit(unit: string | null | undefined): string {
  if (!unit) return ''
  const u = String(unit).trim()
  if (u === '101' || u === '1') return '1'
  if (u === '102' || u === '2') return '2'
  const m = u.match(/(10[12])\b/)
  if (m) return m[1].slice(-1)
  return ''
}

/**
 * Build Keystone-style parcel code from directory fields.
 * e.g. Boulder Circle + 13622 + 101 → "13622BC1"
 */
export function parcelCodeFromParts(
  street: string,
  streetNumber: string,
  unit?: string | null
): string | null {
  const num = String(streetNumber || '').trim()
  if (!/^\d{4,5}$/.test(num)) return null
  const code = streetCodeFor(street)
  if (!code) return null
  return `${num}${code}${unitDigit(unit)}`
}
