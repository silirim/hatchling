// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RULES, dayOf } from './engine.js'
import { whole, opened, turned, said, left, report, yesterday } from './work.js'
import { LANGS } from './lang/index.js'

const NOW = new Date(2026, 10, 16, 12).getTime(), H = 3_600_000, DAY = 24 * H
const EMPTY = whole(undefined)
/** Yesterday: three chats in two folders, fourteen turns, nine files. */
const worked = () => {
  let w = EMPTY
  for (const f of ['vodmax', 'vodmax', 'cachito']) w = opened(w, { now: NOW - DAY, folder: f })
  for (let i = 0; i < 14; i++) w = turned(w, { now: NOW - DAY + i, files: i < 9 ? 1 : 0 })
  return w
}

test('work: a day counts its chats, folders, turns and files, and keeps counts and folder names only', () => {
  const w = worked()
  assert.deepEqual(w.days[String(dayOf(NOW - DAY))], { chats: 3, turns: 14, files: 9, folders: { vodmax: 2, cachito: 1 } })
  assert.deepEqual(Object.keys(w), ['days', 'told'])
  // a folder's name is cleaned like any text from outside, and a name that is a field of every object is only a name
  const odd = opened(opened(EMPTY, { now: NOW, folder: 'a\x1b[31mb\nc' }), { now: NOW, folder: 'constructor' })
  assert.deepEqual(odd.days[String(dayOf(NOW))]?.folders, { 'ab c': 1, constructor: 1 })
  assert.equal(turned(EMPTY, { now: NOW, files: -3 }).days[String(dayOf(NOW))]?.files, 0)
})

test('work: only the last RULES.workDays days are kept, and a store that holds anything else comes out whole', () => {
  let w = EMPTY
  for (let i = 0; i < RULES.workDays + 5; i++) w = opened(w, { now: NOW - i * DAY, folder: 'x' })
  assert.equal(Object.keys(w.days).length, RULES.workDays)
  assert.ok(w.days[String(dayOf(NOW))] && !w.days[String(dayOf(NOW - RULES.workDays * DAY))])
  for (const raw of [null, 7, 'x', [], { days: 4 }, { days: { nope: {}, '-1': {}, 20000: 'x', 20001: { chats: 'many', folders: { 'a\nb': 2, ok: -1, fine: 2 } } }, told: 'x' }]) {
    const made = whole(raw)
    assert.ok(Object.values(made.days).every(d => [d.chats, d.turns, d.files].every(Number.isInteger)))
    assert.equal(made.told, 0)
  }
  assert.deepEqual(whole({ days: { 20001: { chats: 2, folders: { 'a\nb': 2, ok: -1, fine: 2 } } } }).days, { 20001: { chats: 2, turns: 0, files: 0, folders: { fine: 2 } } })
  const many = Array.from({ length: 30 }, (_, i) => `f${i}`).reduce((x, f) => opened(x, { now: NOW, folder: f }), EMPTY)
  assert.equal(Object.keys(many.days[String(dayOf(NOW))]?.folders ?? {}).length, 12) // a day keeps twelve folder names; the chats are all counted
  assert.equal(many.days[String(dayOf(NOW))]?.chats, 30)
})

const MARKS = {
  me: { cwd: '/w/here', at: NOW - DAY, done: false },
  cut: { cwd: '/w/vodmax', at: NOW - DAY + H, done: true, closed: /** @type {const} */ (true), left: NOW - DAY, mid: /** @type {const} */ (true) },
  dead: { cwd: '/w/gin', at: NOW - DAY, done: false, beat: NOW - DAY },
  ended: { cwd: '/w/fine', at: NOW - DAY + H, done: true, closed: /** @type {const} */ (true), left: NOW - DAY },
  waits: { cwd: '/w/cachito', at: NOW - H, done: true, beat: NOW },
  busy: { cwd: '/w/busy', at: NOW - H, done: false, beat: NOW },
}

test('work: the chats left mid-turn and the ones that wait come from the marks, by folder name, never this chat', () => {
  assert.deepEqual(left(MARKS, 'me', dayOf(NOW - DAY), NOW), { mid: ['vodmax', 'gin'], wait: [] })
  assert.deepEqual(left(MARKS, 'me', dayOf(NOW), NOW), { mid: [], wait: ['cachito'] })
  assert.deepEqual(left(MARKS, 'cut', dayOf(NOW - DAY), NOW).mid, ['here', 'gin'])
})

test('/pet diary: today and yesterday by default, one day or the week when asked, with counts, folder names and no path', () => {
  const w = turned(opened(worked(), { now: NOW, folder: 'cachito' }), { now: NOW, files: 2 })
  const both = report(w, MARKS, { id: 'me', now: NOW }, 'en').split('\n')
  assert.deepEqual(both.slice(0, -1), [
    'WORK DIARY',
    'today: 1 chat, 1 folder, 1 turn, 2 files changed',
    '  folders: cachito 1',
    '  waiting for you: cachito',
    'yesterday: 3 chats, 2 folders, 14 turns, 9 files changed',
    '  folders: vodmax 2, cachito 1',
    '  left mid-turn: vodmax, gin',
  ])
  assert.match(String(both.at(-1)), /^Counts and folder names only/)
  assert.doesNotMatch(both.join('\n'), /\/w\//)
  assert.equal(report(w, MARKS, { id: 'me', now: NOW, span: 'today' }, 'en').split('\n').length, 5)
  assert.match(report(w, MARKS, { id: 'me', now: NOW, span: 'yesterday' }, 'en'), /^WORK DIARY\nyesterday: 3 chats/)
  const week = report(w, MARKS, { id: 'me', now: NOW, span: 'week' }, 'en')
  assert.match(week, /\nlast 7 days: 4 chats, 2 folders, 15 turns, 11 files changed\n/)
  assert.doesNotMatch(week, /nothing kept/) // an empty day of the week is left out
  assert.match(report(EMPTY, {}, { id: 'me', now: NOW }, 'en'), /^WORK DIARY\ntoday: nothing kept\nyesterday: nothing kept\n/)
  assert.match(report(EMPTY, {}, { id: 'me', now: NOW, span: 'week' }, 'en'), /\nlast 7 days: nothing kept\n/)
  for (const lang of Object.keys(LANGS)) assert.doesNotMatch(report(w, MARKS, { id: 'me', now: NOW, span: 'week' }, lang), /\{\w+\}|work\./, lang)
})

test('the line about yesterday: once a day, with the one chat left mid-turn or how many, and nothing when nothing is kept', () => {
  const w = worked()
  assert.equal(yesterday(w, MARKS, { id: 'me', now: NOW }, 'en'), 'yesterday: 3 chats, 2 folders; 2 left mid-turn')
  const { dead, ...one } = MARKS
  assert.equal(yesterday(w, one, { id: 'me', now: NOW }, 'en'), 'yesterday: 3 chats, 2 folders; one left mid-turn in vodmax')
  assert.equal(yesterday(w, {}, { id: 'me', now: NOW }, 'en'), 'yesterday: 3 chats, 2 folders')
  assert.equal(yesterday(w, {}, { id: 'me', now: NOW }, 'es'), 'ayer: 3 chats, 2 carpetas')
  assert.equal(yesterday(said(w, NOW), MARKS, { id: 'me', now: NOW }, 'en'), '') // said today already, in this chat or another
  assert.notEqual(yesterday(said(w, NOW - DAY), MARKS, { id: 'me', now: NOW }, 'en'), '') // said yesterday: today is a new day
  assert.equal(yesterday(EMPTY, MARKS, { id: 'me', now: NOW }, 'en'), '')
  assert.equal(yesterday(w, MARKS, { id: 'me', now: NOW + DAY }, 'en'), '') // two days ago is not yesterday
})
