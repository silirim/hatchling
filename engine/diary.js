// @ts-check
// The pet's diary: a few lines the mod writes by itself, kept in the store on the person's machine. Zero tokens: no model writes it.
// It holds times, counts and folder names, and nothing else: never a command, an error, a prompt, a file's text or an answer.
// Three kinds of line: milestones (written once), habits drawn from counters (one line each, rewritten when the habit changes) and
// recent facts. Pure: the adapter gives the time and the folder's name, and keeps the result.

import { RULES, dayOf } from './engine.js'
import { tidy } from './width.js'
import { text, put, voicedAs } from './lang/index.js'

/** @typedef {'first' | 'began' | 'bought' | 'grew' | 'cuddles' | 'week' | 'month' | 'hundred' | 'folder' | 'band' | 'sitting' | 'longest' | 'longday' | 'away' | 'newfolder'} Kind */
/** A line: when, what, and at most a number and a name (a folder, a thing of the shop, a stage). @typedef {{ at: number, kind: Kind, n?: number, name?: string }} Line */
/**
 * `lines` is the diary. The rest are the counters the habits come from: `done` the milestones written, `first` when the diary began,
 * `folders` chats opened by folder, `bands` chats opened by time of day, `sittings` the minutes of the last sittings, `sit` the
 * sitting under way, `today` the time at work in the day `day` (`at` its last moment), `longest` the longest day, `lastDay` the last
 * day a chat opened, `told` the day a memory was last said and `toldKind` which.
 * @typedef {{ lines: Line[], done: string[], first: number, folders: Record<string, number>, bands: number[], sittings: number[], sit: { from: number, to: number } | null, today: { day: number, ms: number, at: number }, longest: { ms: number, at: number }, lastDay: number, told: number, toldKind: string }} Diary
 */

const KINDS = ['first', 'began', 'bought', 'grew', 'cuddles', 'week', 'month', 'hundred', 'folder', 'band', 'sitting', 'longest', 'longday', 'away', 'newfolder']
const HABITS = ['folder', 'band', 'sitting', 'longest']
const AFTER = /** @type {[Kind, number][]} */ ([['week', 7], ['month', 30], ['hundred', 100]])
const CUDDLES = [10, 50, 100]
const NAME_MAX = 24

/** The time of day a moment falls in, by the clock of the person's machine: 0 night, 1 morning, 2 afternoon, 3 evening. @param {number} t */
export const bandOf = (t) => Math.floor(new Date(t).getHours() / 6)

const num = (/** @type {unknown} */ x) => typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0
const name = (/** @type {unknown} */ x) => tidy(x, NAME_MAX) // a folder's name comes from outside: cleaned before it is kept, shown or sent
/** A count kept under a name of its own: a folder called `constructor` has none until it is counted. */
const had = (/** @type {Record<string, number>} */ o, /** @type {string} */ k) => Object.hasOwn(o, k) ? o[k] ?? 0 : 0

/** What the store holds, made whole: a line of a kind there is not, or without a time, is left out. @param {any} raw @returns {Diary} */
export function whole(raw) {
  const lines = (Array.isArray(raw?.lines) ? raw.lines : []).filter((/** @type {any} */ l) => KINDS.includes(l?.kind) && num(l.at)).slice(-RULES.diaryMax)
    .map((/** @type {any} */ l) => ({ at: l.at, kind: l.kind, ...(num(l.n) ? { n: l.n } : null), ...(name(l.name) ? { name: name(l.name) } : null) }))
  const folders = Object.fromEntries(Object.entries(raw?.folders && typeof raw.folders === 'object' ? raw.folders : {}).filter(([k, n]) => name(k) === k && num(n)).slice(0, RULES.diaryFolders))
  const sit = num(raw?.sit?.from) && num(raw?.sit?.to) ? { from: raw.sit.from, to: raw.sit.to } : null
  return {
    lines, done: Array.isArray(raw?.done) ? raw.done.filter((/** @type {unknown} */ x) => typeof x === 'string').slice(0, 40) : [], first: num(raw?.first), folders: /** @type {Record<string, number>} */ (folders),
    bands: [0, 1, 2, 3].map(i => num(raw?.bands?.[i])), sittings: (Array.isArray(raw?.sittings) ? raw.sittings : []).filter(num).slice(-RULES.diarySittings), sit,
    today: { day: num(raw?.today?.day), ms: num(raw?.today?.ms), at: num(raw?.today?.at) }, longest: { ms: num(raw?.longest?.ms), at: num(raw?.longest?.at) },
    lastDay: num(raw?.lastDay), told: num(raw?.told), toldKind: typeof raw?.toldKind === 'string' ? raw.toldKind : '',
  }
}

/** Adds a line; the oldest go over RULES.diaryMax. @param {Diary} d @param {Kind} kind @param {number} at @param {{ n?: number, name?: string }} [more] */
function add(d, kind, at, more = {}) {
  d.lines = [...d.lines, { at, kind, ...more }].slice(-RULES.diaryMax)
}
/** Adds a milestone once in the diary's life, whatever became of its line. @param {Diary} d @param {string} key @param {Kind} kind @param {number} at @param {{ n?: number, name?: string }} [more] */
function once(d, key, kind, at, more) {
  if (d.done.includes(key)) return
  d.done = [...d.done, key]
  add(d, kind, at, more)
}
/** A habit's one line: left as it is when the habit is the same, else taken out and written again, or only taken out when there is none. @param {Diary} d @param {Kind} kind @param {number} at @param {{ n?: number, name?: string } | null} now */
function habit(d, kind, at, now) {
  const old = d.lines.findLast(l => l.kind === kind)
  if (now && old && old.n === now.n && old.name === now.name) return
  d.lines = d.lines.filter(l => l.kind !== kind)
  if (now) add(d, kind, at, now)
}

/** The day changes: a long day is written down as it ends, and the count of today starts again. @param {Diary} d @param {number} now */
function roll(d, now) {
  const day = dayOf(now)
  if (d.today.day === day) return
  if (d.today.day && d.today.ms >= RULES.diaryLongMs) add(d, 'longday', d.today.at, { n: Math.round(d.today.ms / 60_000) })
  d.today = { day, ms: 0, at: now }
}

/** Time at work: a moment of use joins the sitting under way, or ends it and starts another after a pause of RULES.sitGapMs. @param {Diary} d @param {number} now */
function work(d, now) {
  roll(d, now)
  if (d.sit && now >= d.sit.to && now - d.sit.to < RULES.sitGapMs) {
    d.today = { ...d.today, ms: d.today.ms + now - d.sit.to, at: now }
    d.sit = { from: d.sit.from, to: now }
  } else {
    const min = d.sit ? Math.round((d.sit.to - d.sit.from) / 60_000) : 0
    if (min >= 1) d.sittings = [...d.sittings, min].slice(-RULES.diarySittings)
    d.sit = { from: now, to: now }
  }
  if (d.today.ms > d.longest.ms) d.longest = { ms: d.today.ms, at: now }
}

/** The habits the counters show now, each as its one line. @param {Diary} d @param {number} now */
function habits(d, now) {
  const top = (/** @type {[string, number][]} */ rows) => rows.reduce((a, b) => b[1] > a[1] ? b : a, ['', 0])
  const opened = d.bands.reduce((a, b) => a + b, 0), enough = opened >= RULES.diaryHabitMin
  const [where, times] = top(Object.entries(d.folders)), visits = Object.values(d.folders).reduce((a, b) => a + b, 0)
  habit(d, 'folder', now, visits >= RULES.diaryHabitMin && times * 2 >= visits ? { name: where } : null)
  const [band, often] = top(d.bands.map((n, i) => [String(i), n]))
  habit(d, 'band', now, enough && often * 2 >= opened ? { n: Number(band) + 1 } : null) // kept from 1: a line's number is never 0
  const sorted = [...d.sittings].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)] ?? 0
  habit(d, 'sitting', now, sorted.length >= RULES.diaryHabitMin ? { n: Math.max(5, Math.round(median / 5) * 5) } : null)
  habit(d, 'longest', d.longest.at || now, d.longest.ms >= 3_600_000 ? { n: Math.round(d.longest.ms / 60_000 / 10) * 10 } : null) // to ten minutes: it does not move at every turn
}

/**
 * A chat opens in `folder` (its name, not its path). The first time the diary begins: `born` says the pet hatched just now, so it is
 * its first day; a pet older than its diary only begins one.
 * @param {Diary} was @param {{ now: number, folder: string, born?: boolean }} at @returns {Diary}
 */
export function open(was, { now, folder, born = false }) {
  const d = whole(was), day = dayOf(now), where = name(folder)
  if (!d.first) { d.first = now; once(d, 'first', born ? 'first' : 'began', now) }
  else if (d.lastDay && day - d.lastDay >= RULES.diaryAwayDays) add(d, 'away', now, { n: day - d.lastDay })
  work(d, now)
  const together = day - dayOf(d.first)
  for (const [kind, days] of AFTER) if (together >= days) once(d, kind, kind, now)
  if (where) {
    if (!had(d.folders, where) && together > 0) add(d, 'newfolder', now, { name: where })
    d.folders = { ...d.folders, [where]: had(d.folders, where) + 1 }
    const all = Object.entries(d.folders)
    if (all.length > RULES.diaryFolders) { const [least] = all.filter(([k]) => k !== where).reduce((a, b) => b[1] < a[1] ? b : a); delete d.folders[least] }
  }
  d.bands = d.bands.map((n, i) => i === bandOf(now) ? n + 1 : n)
  d.lastDay = day
  habits(d, now)
  return d
}

/** A turn ended: time at work goes on. @param {Diary} was @param {number} now @returns {Diary} */
export function touch(was, now) {
  const d = whole(was)
  if (!d.first) return d // no chat opened it yet
  work(d, now)
  habits(d, now)
  return d
}

/** The `n`th cuddle: 10, 50 and 100 are milestones. @param {Diary} was @param {number} n @param {number} now @returns {Diary} */
export function cuddled(was, n, now) {
  const d = whole(was)
  if (d.first && CUDDLES.includes(n)) once(d, `cuddles${n}`, 'cuddles', now, { n })
  return d
}
/** The first thing bought, by its id in the shop. @param {Diary} was @param {string} id @param {number} now @returns {Diary} */
export function bought(was, id, now) {
  const d = whole(was)
  if (d.first) once(d, 'bought', 'bought', now, { name: name(id) })
  return d
}
/** The pet grew a stage: `stage` is the new one, as the card names it. @param {Diary} was @param {string} stage @param {number} now @returns {Diary} */
export function grew(was, stage, now) {
  const d = whole(was)
  if (d.first) once(d, `grew:${stage}`, 'grew', now, { name: name(stage) })
  return d
}

/**
 * The memory the pet may say now, at most one a day: a week, a month or a hundred days reached today, a long day yesterday, or a
 * habit that is true of this moment (the usual time of day, the usual folder). A habit is not said twice running. Never the days away.
 * @param {Diary} d @param {{ now: number, folder: string }} at @returns {{ kind: string, key: string, fill: Record<string, string | number> } | null}
 */
export function memory(d, { now, folder }) {
  const day = dayOf(now)
  if (d.told === day) return null
  for (const kind of ['hundred', 'month', 'week']) if (d.lines.some(l => l.kind === kind && dayOf(l.at) === day)) return { kind, key: `mem.${kind}`, fill: {} }
  if (d.lines.some(l => l.kind === 'longday' && dayOf(l.at) === day - 1)) return { kind: 'longday', key: 'mem.longday', fill: {} }
  const band = d.lines.find(l => l.kind === 'band' && l.n === bandOf(now) + 1), here = d.lines.find(l => l.kind === 'folder' && l.name === name(folder))
  /** @type {{ kind: string, key: string, fill: Record<string, string | number> }[]} */
  const can = [...(band ? [{ kind: 'band', key: 'mem.band', fill: { band: bandOf(now) } }] : []), ...(here ? [{ kind: 'folder', key: 'mem.folder', fill: { name: here.name ?? '' } }] : [])]
  return can.find(m => m.kind !== d.toldKind) ?? null
}
/** A memory in the pet's words: in a language, as the character at place `at` of STATS says it, or plainly. @param {NonNullable<ReturnType<typeof memory>>} m @param {string} [lang] @param {number} [at] */
export const saying = (m, lang, at) => put(voicedAs(lang, m.key, at), { ...m.fill, band: text(lang, `band.${m.fill.band}`) })
/** The memory was said. @param {Diary} was @param {string} kind @param {number} now @returns {Diary} */
export const told = (was, kind, now) => ({ ...whole(was), told: dayOf(now), toldKind: kind })

/**
 * The lines that bear most on this moment, at most RULES.diaryRecall, the weightiest first: what the model may be told as memories
 * when the comments are on. A habit counts when it is true now, a fact when it is fresh, a milestone always a little.
 * @param {Diary} d @param {{ now: number, folder: string }} at @returns {Line[]}
 */
export function recall(d, { now, folder }) {
  const day = dayOf(now), where = name(folder)
  const weight = (/** @type {Line} */ l) => {
    const age = day - dayOf(l.at)
    switch (l.kind) {
      case 'band': return l.n === bandOf(now) + 1 ? 4 : 0
      case 'folder': return l.name === where ? 4 : 0
      case 'longday': return age === 1 ? 5 : age <= 7 ? 2 : 0
      case 'away': return age === 0 ? 4 : 0
      case 'newfolder': return l.name === where && age <= 7 ? 3 : 0
      case 'sitting': case 'longest': return 1
      default: return age <= 7 ? 3 : 1 // a milestone
    }
  }
  return d.lines.map((l, i) => ({ l, i, w: weight(l) })).filter(x => x.w > 0).sort((a, b) => b.w - a.w || b.i - a.i).slice(0, RULES.diaryRecall).map(x => x.l)
}

/**
 * The memories for the model, in English, each with how long ago it was written: the lines of `recall`, and nothing else of the diary.
 * @param {Diary} d @param {{ now: number, folder: string }} at @returns {string[]}
 */
export function memories(d, at) {
  const day = dayOf(at.now), age = (/** @type {number} */ t) => { const n = day - dayOf(t); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago` }
  return recall(d, at).map(l => `${words(l, 'en')} (${HABITS.includes(l.kind) ? 'a habit' : age(l.at)})`)
}

/** Minutes as a length of time, in a language. @param {number} min @param {string} [lang] */
export const lasting = (min, lang) => min < 60 ? text(lang, 'dur.min', { m: min }) : text(lang, 'dur.h', { h: Math.floor(min / 60), m: min % 60 })

/** A line in words, in a language, without its date. @param {Line} l @param {string} [lang] */
export function words(l, lang) {
  const named = l.kind === 'bought' ? text(lang, `item.${l.name}`, {}, l.name ?? '') : l.kind === 'grew' ? text(lang, `stage.${l.name}`, {}, l.name ?? '') : l.name ?? ''
  return text(lang, `diary.${l.kind}`, { n: l.n ?? 0, name: named, dur: lasting(l.n ?? 0, lang), band: text(lang, `band.${(l.n ?? 1) - 1}`) })
}
/** The day of a moment as the person's machine writes it: 2026-11-13. @param {number} t */
export const dated = (t) => { const d = new Date(t), two = (/** @type {number} */ n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}` }

/** The whole diary as /pet diary shows it: every line with its day, then the counters the habits come from, then what it holds. @param {Diary} d @param {number} now @param {string} [lang] */
export function page(d, now, lang) {
  if (!d.lines.length) return [text(lang, 'diary.empty'), '', text(lang, 'diary.note')].join('\n')
  const sep = text(lang, 'sep'), folders = Object.entries(d.folders).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(sep)
  const bands = d.bands.map((n, i) => `${text(lang, `band.${i}`)} ${n}`).join(sep)
  return [
    text(lang, 'diary.title', { n: d.lines.length, max: RULES.diaryMax }),
    '',
    ...d.lines.map(l => `${dated(l.at)}  ${words(l, lang)}`),
    '',
    text(lang, 'diary.counts', { folders: folders || '-', bands, n: d.sittings.length, dur: lasting(Math.round((d.today.day === dayOf(now) ? d.today.ms : 0) / 60_000), lang) }),
    text(lang, 'diary.note'),
  ].join('\n')
}
