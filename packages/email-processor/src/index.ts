import { writeFileSync } from 'node:fs'
import { applyOutcome } from './apply.js'
import { getDb, loadCandidates, messageExists } from './db.js'
import { callModel } from './decide.js'
import { buildDigest, buildRunLog } from './digest.js'
import { downloadGmailAttachment, fetchGmail, sendDigest } from './gmail.js'
import { fetchImap } from './imap.js'
import { loadEmailModel, modelLabel } from './model-config.js'
import { decideMessage } from './pipeline.js'
import type { InboundEmail, Outcome } from './types.js'

/**
 * Shadow and dry-run read mail and the tracker, and call the model, but
 * write nothing. --write is the only mode that creates work items.
 *
 *   npm run email-processor -- --dry-run --days 1
 *   npm run email-processor -- --dry-run --reprocess --days 1
 *   npm run email-processor -- --shadow --days 1 --out email-processor-report.json
 *   npm run email-processor -- --write --days 1
 *
 * --reprocess classifies mail the Python processor already stored. It is
 * refused with --write so a review run cannot create a second copy.
 */
async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: email-processor [--dry-run | --shadow | --write] [--reprocess] [--days N] [--mailbox all|admin|imap] [--out file]')
    return
  }
  const write = process.argv.includes('--write')
  const shadow = process.argv.includes('--shadow')
  const reprocess = process.argv.includes('--reprocess')
  if (write && shadow) throw new Error('pass only one of --write and --shadow')
  if (write && reprocess) throw new Error('--reprocess cannot be combined with --write')
  const mode = write ? 'write' : shadow ? 'shadow' : 'dry-run'
  const days = Number(option('--days', '1'))
  const which = option('--mailbox', 'all')
  const out = option('--out', '')
  if (!Number.isFinite(days) || days < 1) throw new Error('--days must be a positive number')

  const choice = loadEmailModel()
  console.error(`email processor ${mode}, last ${days} day(s), mailbox ${which}, ${modelLabel(choice)}`)
  const emails: InboundEmail[] = []
  const errors: string[] = []
  if (which === 'all' || which === 'admin') {
    try {
      emails.push(...await fetchGmail(days))
    } catch (err) {
      errors.push(`admin@: ${messageOf(err)}`)
    }
  }
  if (which === 'all' || which === 'imap') {
    try {
      emails.push(...await fetchImap(days))
    } catch (err) {
      errors.push(`mcdonaldbuckhoa@: ${messageOf(err)}`)
    }
  }

  const db = getDb()
  const outcomes: Outcome[] = []
  for (const email of emails) {
    try {
      const outcome = await decideMessage(email, {
        alreadyProcessed: reprocess ? async () => false : (id) => messageExists(db, id),
        loadCandidates: (item, parcel) => loadCandidates(db, item, parcel),
        model: callModel,
      })
      if (write) await applyOutcome(db, email, outcome, downloadGmailAttachment)
      outcomes.push(outcome)
      console.error(`${outcome.disposition}\t${email.mailbox}\t${email.gmailMessageId}`)
    } catch (err) {
      errors.push(`${email.gmailMessageId}: ${messageOf(err)}`)
    }
  }

  const digest = buildDigest(outcomes, modelLabel(choice))
  console.log(buildRunLog(outcomes, modelLabel(choice)))
  if (errors.length) console.error(errors.join('\n'))
  if (out) {
    writeFileSync(out, JSON.stringify({
      mode,
      model: choice.model,
      modelSource: choice.source,
      generatedAt: new Date().toISOString(),
      errors,
      outcomes: outcomes.map(artifactOutcome),
    }, null, 2))
    console.error(`wrote ${out}`)
  }
  if (write) await sendDigest(digest + (errors.length ? `\nErrors:\n${errors.join('\n')}` : ''))
  if (errors.length) process.exitCode = 1
}

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  if (i === -1 || !process.argv[i + 1]) return fallback
  return process.argv[i + 1]
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Drop message text before the report is uploaded as an Actions artifact. */
function artifactOutcome(outcome: Outcome): Record<string, unknown> {
  const {
    subject: _subject,
    from: _from,
    homeownerName: _homeownerName,
    description: _description,
    title: _title,
    preview: _preview,
    reason: _reason,
    ...rest
  } = outcome
  return rest
}

main().catch((err) => {
  console.error(messageOf(err))
  process.exit(1)
})
