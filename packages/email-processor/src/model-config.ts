import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

export interface EmailModelChoice {
  model: string
  reasoningEffort: string | null
  maxTokens: number
  source: 'file' | 'env'
}

interface RememberedModel {
  model: string
  reasoningEffort: string | null
  maxTokens: number
}

/** The file wins unless OPENROUTER_MODEL is set for this process. */
export function selectEmailModel(remembered: RememberedModel, envModel: string | undefined): EmailModelChoice {
  const override = envModel?.trim()
  if (override) return { ...remembered, model: override, source: 'env' }
  return { ...remembered, source: 'file' }
}

export function parseModelFile(raw: string): RememberedModel {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('packages/email-processor/model.json is not valid JSON')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('packages/email-processor/model.json must be an object')
  }
  const row = parsed as Record<string, unknown>
  if (typeof row.model !== 'string' || !row.model.trim() || /\s/.test(row.model)) {
    throw new Error('packages/email-processor/model.json needs a model id')
  }
  const effort = row.reasoning_effort
  if (effort != null && (typeof effort !== 'string' || !EFFORTS.has(effort))) {
    throw new Error('reasoning_effort must be low, medium, high, xhigh, max, or null')
  }
  const maxTokens = row.max_tokens
  if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 16000) {
    throw new Error('max_tokens must be an integer from 256 to 16000')
  }
  return {
    model: row.model.trim(),
    reasoningEffort: typeof effort === 'string' ? effort : null,
    maxTokens,
  }
}

export function modelFilePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'model.json')
}

export function loadEmailModel(env: NodeJS.ProcessEnv = process.env): EmailModelChoice {
  const remembered = parseModelFile(readFileSync(modelFilePath(), 'utf8'))
  return selectEmailModel(remembered, env.OPENROUTER_MODEL)
}

export function modelLabel(choice: EmailModelChoice): string {
  const where = choice.source === 'file' ? 'remembered' : 'this run only'
  return `model: ${choice.model} (${where})`
}
