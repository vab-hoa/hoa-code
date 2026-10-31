import { stripHtml } from './text.js'
import type { WoSnapshotEntry } from './types.js'

const SECTIONS = [
  'PENDING BOARD REVIEW',
  'AWAITING QUOTE',
  'OPEN',
  'SERVICE REQUEST',
  'SCHEDULED',
  'ON HOLD',
  'MONITORED',
]

export interface WoStatusReport {
  openCount: number | null
  scrapeFailureSuspected: boolean
  entries: WoSnapshotEntry[]
}

/** Parse the Keystone work-order status report body. These rows are not requests. */
export function parseWoStatusReport(body: string): WoStatusReport {
  const text = stripHtml(body, true)
  const lines = text.split('\n')
  let openCount: number | null = null
  for (const line of lines) {
    const m = line.trim().match(/^Open work orders:\s*(\d+)/i)
    if (m) {
      openCount = Number(m[1])
      break
    }
  }
  const entries: WoSnapshotEntry[] = []
  let section: string | null = null
  for (const line of lines) {
    const stripped = line.trim()
    let header = false
    for (const sec of SECTIONS) {
      const m = stripped.match(new RegExp(`^${sec.replace(/ /g, '\\s+')}\\s*\\((\\d+)\\)`, 'i'))
      if (m) {
        section = sec
        header = true
        break
      }
    }
    if (header) continue
    const wo = stripped.match(/^WO#(\d+)\s+(\S+)\s+(.+?)\s+\[(\d+\/\d+\/\d+)\]/)
    if (wo && section) {
      entries.push({
        woNumber: wo[1],
        parcelCode: wo[2],
        homeownerName: wo[3].trim(),
        date: wo[4],
        description: null,
        vendor: null,
        status: section,
      })
      continue
    }
    if (stripped && section && entries.length && !stripped.startsWith('=')) {
      const vendor = stripped.match(/^Vendor:\s*(.+)/i)
      const last = entries[entries.length - 1]
      if (vendor) last.vendor = vendor[1].trim()
      else if (!last.description) last.description = stripped
      else last.description += ' ' + stripped
    }
  }
  return {
    openCount,
    scrapeFailureSuspected: openCount === 0,
    entries,
  }
}
