import { parcelCodeFromParts } from '@vab-hoa/shared'

const STREET =
  'rock\\s+p(?:oin)?t|stone\\s+cir(?:cle)?|boulder\\s+p(?:oin)?t|plaster\\s+p(?:oin)?t|broadlands(?:\\s+lane)?|boulder\\s+cir(?:cle)?'

/**
 * Pull one HOA parcel code out of free text.
 * Handles "13723 #102 Plaster Point" and "3510 Broadlands Lane, Unit 102".
 */
export function extractParcel(text: string): string | null {
  if (!text) return null
  const already = text.match(/\b(\d{4,5}(?:RP|SC|BP|PP|BL|BC)[12]?)\b/i)
  if (already) return already[1].toUpperCase()

  const unitFirst = new RegExp(
    `\\b(\\d{4,5})\\s+#\\s*(10[12])\\s+(${STREET})\\b`,
    'i',
  )
  const leading = text.match(unitFirst)
  if (leading) {
    const code = parcelCodeFromParts(leading[3], leading[1], leading[2])
    if (code) return code
  }

  const street = new RegExp(`\\b(\\d{4,5})\\s+(${STREET})\\b`, 'i')
  const found = text.match(street)
  if (!found || found.index === undefined) return null
  const after = text.slice(found.index + found[0].length, found.index + found[0].length + 40)
  const unit = after.match(/(?:#|unit|apt)\s*(10[12])\b/i)?.[1]
    || after.match(/^\s*(10[12])\b/)?.[1]
    || ''
  return parcelCodeFromParts(found[2], found[1], unit)
}

export function extractWoNumbers(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/\bWO\s*#?\s*(\d{3,6})\b/gi)) out.add(m[1])
  for (const m of text.matchAll(/\bwork\s*order\s*#?\s*(\d{3,6})\b/gi)) out.add(m[1])
  return [...out]
}
