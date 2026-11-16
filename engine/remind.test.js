// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIMITS, clean, whole, asked, add, done, ready, due } from './remind.js'
import { pack } from './move.js'
import { initialState } from './engine.js'
import { shareLines } from './share.js'

const NOW = Date.UTC(2026, 10, 16, 12), MIN = 60_000

test('remind: what is typed is a plain text, a timed one, or done <n|all>', () => {
  assert.deepEqual(asked('call Ana back', NOW), { verb: 'add', text: 'call Ana back' })
  assert.deepEqual(asked('in 20m check the build', NOW), { verb: 'add', text: 'check the build', at: NOW + 20 * MIN })
  assert.deepEqual(asked('IN 2H  push', NOW), { verb: 'add', text: 'push', at: NOW + 120 * MIN })
  assert.deepEqual(asked('in 1d renew', NOW), { verb: 'add', text: 'renew', at: NOW + 1440 * MIN })
  assert.deepEqual(asked('in 90 m stretch', NOW), { verb: 'add', text: 'stretch', at: NOW + 90 * MIN })
  // `in` before anything but a length is the start of a plain text; a unit there is not is one too
  assert.deepEqual(asked('in the morning, call', NOW), { verb: 'add', text: 'in the morning, call' })
  assert.deepEqual(asked('in 2w holidays', NOW), { verb: 'add', text: 'in 2w holidays' })
  assert.deepEqual(asked('in 20min tea', NOW), { verb: 'add', text: 'in 20min tea' })
  // a length with no text, of zero, or over a year: nothing is kept
  for (const bad of ['in 20m', 'in 0m now', 'in 366d far', 'in 99999h far', '', '   ', '\x1b[2J']) assert.deepEqual(asked(bad, NOW), { verb: 'usage' }, bad)
  assert.deepEqual(asked('in 365d renew', NOW).verb, 'add')
  assert.deepEqual([asked('done 2', NOW), asked('done ALL', NOW), asked('Done 20', NOW)], [{ verb: 'done', n: 2 }, { verb: 'done', n: 'all' }, { verb: 'done', n: 20 }])
  for (const bad of ['done', 'done 0', 'done x', 'done -1', 'done 1.5']) assert.deepEqual(asked(bad, NOW), { verb: 'usage' }, bad)
  assert.deepEqual(asked('done with the report by friday', NOW), { verb: 'add', text: 'done with the report by friday' })
})

test('remind: a text is cleaned like any text from outside and cut to 200 characters', () => {
  assert.equal(clean('a\x1b[31mred\x1b[0m\tb\nc\u0007‮ d'), 'ared b c d')
  assert.equal(clean('\x1b]0;title\x07x'), 'x')
  assert.equal([...clean('é'.repeat(500))].length, LIMITS.chars)
  assert.equal([...clean('好'.repeat(500))].length <= LIMITS.chars, true)
  assert.equal(clean('😀'.repeat(300)).isWellFormed(), true)
  assert.equal(clean(7), '')
  assert.equal(asked(`in 5m ${'x'.repeat(900)}`, NOW).verb === 'add' && /** @type {any} */ (asked(`in 5m ${'x'.repeat(900)}`, NOW)).text.length, LIMITS.chars)
})

test('remind: at most 20 are kept; the list is numbered from 1 and done takes one out, or all', () => {
  /** @type {import('./remind.js').Reminder[]} */ let list = []
  for (let i = 1; i <= LIMITS.max; i++) { const r = add(list, { text: `r${i}` }, NOW + i); assert.equal(r.n, i); list = r.list }
  const over = add(list, { text: 'one more' }, NOW)
  assert.deepEqual([over.full, over.n, over.list.length], [true, 0, LIMITS.max])
  const one = done(list, 2)
  assert.deepEqual([one.gone.map(r => r.text), one.list.length, one.list[1]?.text], [['r2'], 19, 'r3'])
  assert.deepEqual([done(list, 21).gone, done(list, 21).list.length], [[], LIMITS.max])
  assert.deepEqual([done(list, 'all').list, done(list, 'all').gone.length], [[], LIMITS.max])
  assert.equal(add([], { text: '\x07' }, NOW).list.length, 0)
})

test('remind: a store that holds anything else comes out whole', () => {
  for (const raw of [null, 7, 'x', {}, [null, 3, 'x', {}, { text: 'no time' }, { text: '', made: 1 }, { text: 5, made: 1 }]]) assert.deepEqual(whole(raw), [])
  assert.deepEqual(whole([{ text: 'a\x1b[1mb', made: 5, at: 'soon', told: 'yes', more: 1, __proto__: { x: 1 } }]), [{ text: 'ab', made: 5 }])
  assert.equal(whole(Array.from({ length: 50 }, () => ({ text: 'x', made: 1 }))).length, LIMITS.max)
})

test('remind: a plain one is always to show, a timed one from when it falls due; it is said once then and stays in the list', () => {
  const list = add(add(add([], { text: 'plain' }, NOW).list, { text: 'soon', at: NOW + 20 * MIN }, NOW).list, { text: 'later', at: NOW + 60 * MIN }, NOW).list
  assert.deepEqual(ready(list, NOW).map(r => [r.n, r.text]), [[1, 'plain']])
  assert.equal(due(list, NOW + 19 * MIN).hit, null)
  const fell = due(list, NOW + 20 * MIN)
  assert.deepEqual([fell.hit?.text, fell.hit?.n], ['soon', 2])
  assert.equal(due(fell.list, NOW + 21 * MIN).hit, null) // said once
  assert.equal(fell.list.length, 3) // and kept until done
  assert.deepEqual(ready(fell.list, NOW + 21 * MIN).map(r => r.n), [1, 2])
  assert.equal(due(fell.list, NOW + 61 * MIN).hit?.text, 'later')
})

test('remind: nothing of a reminder is in the file of /pet export or in the words of /pet share', () => {
  const prefs = { species: 'fox', born: 'fox', seed: 5, name: 'Tobo', stats: [1, 2, 3, 4, 5], lang: 'en' }
  const file = JSON.stringify(pack({ pet: initialState(1), prefs, diary: undefined, now: NOW }))
  assert.doesNotMatch(file, /remind/i)
  assert.deepEqual(Object.keys(JSON.parse(file)), ['hatchling', 'format', 'exported', 'pet', 'prefs', 'diary'])
  assert.doesNotMatch(JSON.stringify(shareLines({ name: 'Tobo', animal: 'fox', stage: 'adult', peak: 'wit', stars: 3, golden: false, rare: false, founder: false })), /remind/i)
})
