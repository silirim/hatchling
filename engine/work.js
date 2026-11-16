// @ts-check
// The work diary: what /pet diary reports and the first greeting of a day says of yesterday. Zero tokens: no model writes it.
// Kept for RULES.workDays days, by day: how many chats opened, in which folders (names), how many turns ended and how many files
// they changed. Counts and folder names, never a text. Which chats were left mid-turn or wait comes from the chat marks
// (engine/company.js), read at the moment of the report. Pure: the adapter gives the time and keeps the result.

import { RULES, dayOf } from './engine.js'
import { tidy } from './width.js'
import { text } from './lang/index.js'
import { stateOf, leftOf, folder } from './company.js'
import { dated } from './diary.js'

/** A day's counters. @typedef {{ chats: number, turns: number, files: number, folders: Record<string, number> }} Day */
/** `days` by day number (engine.js `dayOf`), `told` the day the line about yesterday was last said. @typedef {{ days: Record<string, Day>, told: number }} Work */

const FOLDERS = 12 // folder names kept for a day
const count = (/** @type {unknown} */ x) => typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.min(Math.floor(x), 1e6) : 0
const named = (/** @type {unknown} */ x) => tidy(x, 24)

/** What the store holds, made whole: a day that is no day, a count that is no count and a name the cleaning would change are dropped. @param {any} raw @returns {Work} */
export function whole(raw) {
  const days = Object.entries(raw?.days && typeof raw.days === 'object' ? raw.days : {}).filter(([k]) => /^\d{1,6}$/.test(k)).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, RULES.workDays)
    .map(([k, d]) => [k, { chats: count(d?.chats), turns: count(d?.turns), files: count(d?.files), folders: Object.fromEntries(Object.entries(d?.folders && typeof d.folders === 'object' ? d.folders : {}).filter(([f, n]) => f && named(f) === f && count(n)).slice(0, FOLDERS).map(([f, n]) => [f, count(n)])) }])
  return { days: Object.fromEntries(days), told: count(raw?.told) }
}

/** The work with the day of `now` changed by `change`; the oldest days go. @param {Work} was @param {number} now @param {(d: Day) => Day} change @returns {Work} */
function on(was, now, change) {
  const w = whole(was), k = String(dayOf(now))
  return whole({ ...w, days: { ...w.days, [k]: change(Object.hasOwn(w.days, k) ? /** @type {Day} */ (w.days[k]) : { chats: 0, turns: 0, files: 0, folders: {} }) } })
}
/** A chat opened in `folder` (its name, not its path). @param {Work} was @param {{ now: number, folder: string }} at */
export function opened(was, { now, folder: where }) {
  const name = named(where)
  return on(was, now, d => ({ ...d, chats: d.chats + 1, folders: name && (Object.hasOwn(d.folders, name) || Object.keys(d.folders).length < FOLDERS) ? { ...d.folders, [name]: (Object.hasOwn(d.folders, name) ? d.folders[name] ?? 0 : 0) + 1 } : d.folders }))
}
/** A turn ended, having changed `files` files. @param {Work} was @param {{ now: number, files: number }} at */
export const turned = (was, { now, files }) => on(was, now, d => ({ ...d, turns: d.turns + 1, files: d.files + count(files) }))
/** The line about yesterday was said, or there was none to say. @param {Work} was @param {number} now @returns {Work} */
export const said = (was, now) => ({ ...whole(was), told: dayOf(now) })

/**
 * The other chats whose last turn was on `day`, by folder name: the ones left mid-turn (closed, or dead, with a turn cut short)
 * and the ones that still wait for the person. One at work now is neither.
 * @param {import('./company.js').Marks} marks @param {string} id @param {number} day @param {number} now
 */
export function left(marks, id, day, now) {
  /** @type {string[]} */ const mid = [], /** @type {string[]} */ wait = []
  for (const [k, m] of Object.entries(marks)) {
    const last = leftOf(m), st = stateOf(m, now), name = folder(m.cwd)
    if (k === id || !name || last.at > now || dayOf(last.at) !== day) continue
    if (st === 'closed') { if (last.mid) mid.push(name) }
    else if (st === 'waiting' || st === 'asking') wait.push(name)
  }
  return { mid: [...new Set(mid)], wait: [...new Set(wait)] }
}

const n1 = (/** @type {string | undefined} */ lang, /** @type {string} */ key, /** @type {number} */ n) => text(lang, `work.${key}.${n === 1 ? 'one' : 'many'}`, { n })
/** A day's counts in words: `3 chats, 2 folders, 14 turns, 9 files changed`. @param {Day} d @param {string} [lang] */
const counts = (d, lang) => [n1(lang, 'chats', d.chats), n1(lang, 'folders', Object.keys(d.folders).length), n1(lang, 'turns', d.turns), n1(lang, 'files', d.files)].join(text(lang, 'sep'))

/**
 * The report of /pet diary: `span` is `today`, `yesterday`, `week` (the last seven days and their sum) or anything else for today
 * and yesterday. A day with its counts, its folders with the chats opened in each, and the chats left mid-turn or still waiting.
 * @param {Work} w @param {import('./company.js').Marks} marks @param {{ id: string, now: number, span?: string }} at @param {string} [lang]
 */
export function report(w, marks, { id, now, span }, lang) {
  const today = dayOf(now), sep = text(lang, 'sep')
  const days = span === 'today' ? [0] : span === 'yesterday' ? [1] : span === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1]
  /** @type {string[]} */ const out = [text(lang, 'work.title')]
  /** @type {Day} */ const sum = { chats: 0, turns: 0, files: 0, folders: {} }
  for (const back of days) {
    const d = w.days[String(today - back)], l = left(marks, id, today - back, now)
    const when = back === 0 ? text(lang, 'work.today') : back === 1 ? text(lang, 'recap.yesterday') : dated(now - back * 86_400_000)
    if (!d && !l.mid.length && !l.wait.length) { if (span !== 'week') out.push(`${when}: ${text(lang, 'work.none')}`); continue }
    out.push(`${when}: ${d ? counts(d, lang) : text(lang, 'work.none')}`)
    if (d && Object.keys(d.folders).length) out.push(`  ${text(lang, 'work.in', { list: Object.entries(d.folders).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(sep) })}`)
    if (l.mid.length) out.push(`  ${text(lang, 'work.mid', { list: l.mid.join(sep) })}`)
    if (l.wait.length) out.push(`  ${text(lang, 'work.wait', { list: l.wait.join(sep) })}`)
    if (d) { sum.chats += d.chats; sum.turns += d.turns; sum.files += d.files; for (const f of Object.keys(d.folders)) sum.folders[f] = 1 }
  }
  if (span === 'week') out.push(sum.chats || sum.turns ? `${text(lang, 'work.week')}: ${counts(sum, lang)}` : `${text(lang, 'work.week')}: ${text(lang, 'work.none')}`)
  return [...out, text(lang, 'work.note')].join('\n')
}

/**
 * Yesterday in one line, for the first greeting of a day: '' when it was said today already, or nothing is kept of yesterday.
 * @param {Work} w @param {import('./company.js').Marks} marks @param {{ id: string, now: number }} at @param {string} [lang]
 */
export function yesterday(w, marks, { id, now }, lang) {
  const day = dayOf(now) - 1, d = w.days[String(day)]
  if (w.told === dayOf(now) || !d || !d.chats) return ''
  const { mid } = left(marks, id, day, now), fill = { chats: n1(lang, 'chats', d.chats), folders: n1(lang, 'folders', Object.keys(d.folders).length) }
  return mid.length === 1 ? text(lang, 'greet.yesterday.mid', { ...fill, name: mid[0] ?? '' }) : mid.length ? text(lang, 'greet.yesterday.mids', { ...fill, n: mid.length }) : text(lang, 'greet.yesterday', fill)
}
