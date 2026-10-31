import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadEmailModel, modelLabel, parseModelFile, selectEmailModel } from './model-config.js'

const remembered = { model: 'anthropic/claude-sonnet-5.5', reasoningEffort: 'medium', maxTokens: 4000 }

test('the model file is the remembered choice', () => {
  const choice = selectEmailModel(remembered, undefined)
  assert.equal(choice.model, 'anthropic/claude-sonnet-5.5')
  assert.equal(choice.source, 'file')
  assert.equal(choice.reasoningEffort, 'medium')
  assert.equal(modelLabel(choice), 'model: anthropic/claude-sonnet-5.5 (remembered)')
})

test('OPENROUTER_MODEL overrides one run and leaves the other settings', () => {
  const choice = selectEmailModel(remembered, ' anthropic/claude-opus-5.5 ')
  assert.equal(choice.model, 'anthropic/claude-opus-5.5')
  assert.equal(choice.source, 'env')
  assert.equal(choice.reasoningEffort, 'medium')
  assert.equal(choice.maxTokens, 4000)
  assert.match(modelLabel(choice), /this run only/)
})

test('an empty override does not replace the remembered model', () => {
  assert.equal(selectEmailModel(remembered, '  ').source, 'file')
})

test('model.json on disk is what the processor loads', () => {
  const fromFile = parseModelFile(readFileSync(new URL('../model.json', import.meta.url), 'utf8'))
  const loaded = loadEmailModel({} as NodeJS.ProcessEnv)
  assert.equal(loaded.model, fromFile.model)
  assert.equal(loaded.reasoningEffort, fromFile.reasoningEffort)
  assert.equal(loaded.maxTokens, fromFile.maxTokens)
  assert.equal(loaded.source, 'file')
})

test('a model file without an id is rejected', () => {
  assert.throws(() => parseModelFile('{"model":"","reasoning_effort":"low","max_tokens":2000}'), /model id/)
})
