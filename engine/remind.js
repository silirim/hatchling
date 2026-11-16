// @ts-check
// Reminders: a few lines the person writes for themselves with /pet remind, kept in the store on their machine and shown by the
// pet in its bubble. Zero tokens. The text is the person's own: it is never sent to the comments model, never on the picture of
// /pet share and never in the file of /pet export. The answer of /pet remind and of /pet reminders is a line of the chat, as any
// command's, so that chat's assistant can read it; the bubble is drawn locally and is no line. Pure: the adapter gives the time and keeps the result.

import { tidy } from './width.js'

export const LIMITS = { max: 20, chars: 200, days: 365 }
/** `made` when it was written, `at` when a timed one falls due, `told` that the pet said it when it fell due. @typedef {{ text: string, made: number, at?: number, told?: true }} Reminder */

const time = (/** @type {unknown} */ x) => typeof x === 'number' && Number.isFinite(x) && x > 0
/** A reminder's text made safe, as any text from outside: no control or escape character, one line, LIMITS.chars characters at most. @param {unknown} raw */
export const clean = (raw) => [...tidy(raw, LIMITS.chars)].slice(0, LIMITS.chars).join('').trim()

/** What the store holds, made whole: what is no reminder is dropped, and only the first LIMITS.max are kept. @param {unknown} raw @returns {Reminder[]} */
export function whole(raw) {
  return (Array.isArray(raw) ? raw : []).flatMap((/** @type {any} */ r) => { const t = clean(r?.text); return t && time(r?.made) ? [{ text: t, made: r.made, ...(time(r.at) && { at: r.at }), ...(r.told === true && { told: /** @type {const} */ (true) }) }] : [] }).slice(0, LIMITS.max)
}

const UNIT = /** @type {Record<string, number>} */ ({ m: 60_000, h: 3_600_000, d: 86_400_000 })
/**
 * What was typed after /pet remind: a text to keep, timed when it starts with `in <20m|2h|1d>`; `done <n|all>`; or nothing usable.
 * `in` followed by anything but such a length is the start of a plain text ("in the morning ..."). A length of zero, or over
 * LIMITS.days, is not kept.
 * @param {string} typed @param {number} now
 * @returns {{ verb: 'add', text: string, at?: number } | { verb: 'done', n: number | 'all' } | { verb: 'usage' }}
 */
export function asked(typed, now) {
  const s = String(typed).trim()
  const done = /^done(?:\s+(\S+))?$/i.exec(s)
  if (done) { const n = (done[1] ?? '').toLowerCase(); return n === 'all' ? { verb: 'done', n: 'all' } : /^\d{1,3}$/.test(n) && Number(n) > 0 ? { verb: 'done', n: Number(n) } : { verb: 'usage' } }
  const timed = /^in\s+(\d{1,5})\s*([mhd])(?:\s+([^]*))?$/i.exec(s)
  if (timed) {
    const ms = Number(timed[1]) * /** @type {number} */ (UNIT[String(timed[2]).toLowerCase()]), t = clean(timed[3] ?? '')
    return t && ms > 0 && ms <= LIMITS.days * 86_400_000 ? { verb: 'add', text: t, at: now + ms } : { verb: 'usage' }
  }
  const t = clean(s)
  return t ? { verb: 'add', text: t } : { verb: 'usage' }
}

/** The list with one more; `full` when there is no room, and nothing is added. @param {Reminder[]} was @param {{ text: string, at?: number }} r @param {number} now */
export function add(was, r, now) {
  const list = whole(was), t = clean(r.text)
  if (!t || list.length >= LIMITS.max) return { list, full: list.length >= LIMITS.max, n: 0 }
  return { list: [...list, { text: t, made: now, ...(time(r.at) && { at: r.at }) }], full: false, n: list.length + 1 }
}
/** The list without its `n`th (from 1, as /pet reminders numbers them), or empty for `all`; `gone` the ones taken out. @param {Reminder[]} was @param {number | 'all'} n */
export function done(was, n) {
  const list = whole(was)
  if (n === 'all') return { list: [], gone: list }
  return { list: list.filter((_, i) => i !== n - 1), gone: list.slice(n - 1, n) }
}
/** The ones to show now: the plain ones and the timed ones that fell due, each with its number. @param {Reminder[]} list @param {number} now */
export const ready = (list, now) => list.map((r, i) => ({ ...r, n: i + 1 })).filter(r => !r.at || r.at <= now)
/** The first timed one that fell due and was not said yet, with its number, and the list with it marked as said. @param {Reminder[]} was @param {number} now */
export function due(was, now) {
  const list = whole(was), i = list.findIndex(r => r.at && r.at <= now && !r.told)
  if (i < 0) return { list, hit: null }
  return { list: list.map((r, k) => k === i ? { ...r, told: /** @type {const} */ (true) } : r), hit: { .../** @type {Reminder} */ (list[i]), n: i + 1 } }
}
