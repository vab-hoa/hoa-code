import type { Outcome } from './types.js'

/** Counts only. Safe for a GitHub Actions log. */
export function buildRunLog(rows: Outcome[], modelLine = ''): string {
  return summaryLines(rows, modelLine).join('\n')
}

export function buildDigest(rows: Outcome[], modelLine = ''): string {
  const lines = [...summaryLines(rows, modelLine), '']
  const review = rows.filter((r) => r.needsReview)
  if (review.length) {
    lines.push('Needs review:')
    for (const row of review) {
      lines.push(`- ${row.from}: ${row.subject}`)
      lines.push(`  ${row.reason}`)
    }
    lines.push('')
  }
  const created = rows.filter((r) => r.create)
  if (created.length) {
    lines.push('New items:')
    for (const row of created) lines.push(`- ${row.title} (${row.parcel ?? 'no parcel'})`)
    lines.push('')
  }
  return lines.join('\n')
}

function summaryLines(rows: Outcome[], modelLine: string): string[] {
  const count = (d: string) => rows.filter((r) => r.disposition === d && !r.alreadyProcessed).length
  return [
    'HOA email processor',
    ...(modelLine ? [modelLine] : []),
    `new requests: ${count('new_request')}`,
    `updates: ${count('update')}`,
    `not a work item: ${count('unrelated')}`,
    `needs review: ${count('needs_review')}`,
    `system: ${count('system')}`,
    `already processed: ${rows.filter((r) => r.alreadyProcessed).length}`,
  ]
}
