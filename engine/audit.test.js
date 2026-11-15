import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addTranscript, emptyTotals, receipt } from './audit.js'
import { guessed, price, rates } from './prices.js'

let n = 0
const ask = (id, input, cacheRead, cacheWrite, output, at, extra = {}) => JSON.stringify({
  type: 'assistant', timestamp: new Date(at).toISOString(), ...extra,
  message: { id, model: 'claude-opus-5-5', usage: { input_tokens: input, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite, output_tokens: output }, content: extra.content ?? [] },
})
const read = (file) => ({ type: 'tool_use', id: `t${++n}`, name: 'Read', input: { file_path: file } })
const result = (id, text) => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } })

test('prices each kind of token once per request, at the model list price', async () => {
  const T = await addTranscript([
    ask('a', 100, 0, 10_000, 50, 0),
    ask('a', 100, 0, 10_000, 200, 1000), // the same request streamed again: only its last output counts
    ask('b', 0, 10_000, 1_000, 100, 2000),
  ], emptyTotals())
  assert.equal(T.requests, 2)
  assert.equal(T.fresh, 100 * 4)
  assert.equal(T.write, 11_000 * 1.25 * 4)
  assert.equal(T.read, 10_000 * 0.05 * 4) // Opus 5.5 reads the cache at 0.05x
  assert.equal(T.output, 300 * 5 * 4)
  assert.match(receipt(T), /TOTAL at list prices\s+\$0\.06/)
})

test('a re-read is paid when written and again by every later request, until a compaction', async () => {
  const first = read('/a.js'), again = read('/a.js'), body = 'x'.repeat(4000) // 1000 tokens
  const T = await addTranscript([
    ask('a', 0, 0, 5000, 1, 0, { content: [first] }), result(first.id, body),
    ask('b', 0, 5000, 1000, 1, 1000, { content: [again] }), result(again.id, body),
    ask('c', 0, 6000, 1000, 1, 2000),
    ask('d', 0, 7000, 10, 1, 3000),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary' }),
    ask('e', 0, 0, 2000, 1, 4000),
  ], emptyTotals())
  assert.equal(T.rereadN, 1)
  assert.equal(T.rereads, 1000 * (1.25 * 4 + 0.05 * 4)) // written at c, read at d, gone after the compaction
})

test('a cache rebuilt after a long pause is counted as a pause, and a subagent is its own chain', async () => {
  const T = await addTranscript([
    ask('a', 0, 0, 50_000, 1, 0),
    ask('s', 0, 0, 9_000, 1, 500, { isSidechain: true, agentId: 'x' }), // not a break of the main thread
    ask('b', 0, 50_000, 100, 1, 1000),
    ask('c', 0, 0, 50_200, 1, 1000 + 2 * 3600_000),
  ], emptyTotals())
  assert.deepEqual([T.pauseLongN, T.pauseShortN, T.breakOtherN], [1, 0, 0])
  assert.equal(T.pauseLong, 50_100 * 1.2 * 4)
})

test('the receipt names no context budget: that lever is gone', async () => {
  const T = await addTranscript([ask('a', 0, 0, 40_000, 1, 0), ask('big', 0, 40_000, 160_000, 1, 1000)], emptyTotals())
  assert.doesNotMatch(receipt(T), /budget/i)
})

test('a 1-hour cache write costs 2x, and Haiku 5.5 costs five times as much over 100k tokens of prompt', async () => {
  const haiku = (id, read, write, out) => JSON.stringify({ type: 'assistant', timestamp: new Date(0).toISOString(), message: { id, model: 'claude-haiku-5-5', usage: { input_tokens: 0, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: out, cache_creation: { ephemeral_1h_input_tokens: write } }, content: [] } })
  const T = await addTranscript([haiku('a', 42_161, 31_729, 923), haiku('b', 209_467, 644, 1415)], emptyTotals())
  // the two requests as the CLI billed them in the A/B: $0.00723 and $0.01466
  assert.ok(Math.abs((T.read + T.write + T.output) / 1e6 - 0.02189) < 0.0001)
})

test('a price not read from the list is the family guess, and the receipt says so', async () => {
  assert.deepEqual(['claude-fable-5-2', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-haiku-4-5-20251001'].map(price), [8, 4, 5, 2, 0.1, 1])
  assert.deepEqual(['claude-opus-5-5', 'claude-haiku-4-5-20251001', 'claude-fable-5-3', 'claude-opus-4-1', 'claude-3-5-haiku-20241022', 'gpt-9'].map(guessed), [false, false, true, true, true, false])
  assert.equal(rates('claude-sonnet-5-5', 0)?.read, 0.1) // $0.10 per MTok, half of what Sonnet 5 reads at
  assert.equal(rates('claude-fable-5-2', 0)?.read, 0.2)
  const T = await addTranscript([ask('a', 100, 0, 0, 1, 0).replace('claude-opus-5-5', 'claude-opus-4-1')], emptyTotals())
  assert.match(receipt(T), /Priced like their family, price not verified: claude-opus-4-1/)
})
