// @ts-check
// The pet moved to another computer: /pet export writes it as one JSON file, /pet import reads such a file (docs/pet.md).
// In the file: the shared pet (engine.js `shared`), the choices that make it this pet and the person's (PREFS), and the diary.
// Not in it: the marks of the chats, the pet's last lines, the day's count of comments, anything of a chat.
// The file comes from outside, like a skin pack: it is checked whole before any of it is used, and with one fault nothing of it is.
// Every text in it must be as the cleaning of the pack loader leaves it (width.js `tidy`, and the cleaners built on it).
// Pure: no file is read or written here (hooks/register.js does both).

import { shared, stage, OWNABLE, WEARABLE, RULES, PLAIN } from './engine.js'
import { whole as diaryOf, dated } from './diary.js'
import { REG } from './skins.js'
import { tidy } from './width.js'
import { cleanName, cleanCall, asStats } from './persona.js'
import { asLang } from './lang/index.js'
import { asModel } from './voice.js'
import { sharePath } from './share.js'

export const FORMAT = 1
/** The field that says a file is a pet: today's, and the one of files exported under the project's earlier name. */
const MARKS = ['hatchling', 'cachito']
/** The most a file may be: `bytes` the file, `text` one text of it, `deep` how far objects nest, `errors` the faults told. */
export const LIMITS = { bytes: 256 * 1024, text: 200, deep: 6, errors: 4 }
const MAX_TIME = 8.64e15 // the last moment a date can hold
const ERR_COLS = 200

const isObj = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const bool = (/** @type {unknown} */ v) => typeof v === 'boolean'
const time = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_TIME
const count = (/** @type {unknown} */ v) => Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0
/** A text as its own cleaner leaves it: nothing in it would be taken out, changed or cut. */
const kept = (/** @type {(raw: unknown) => string} */ cleaner) => (/** @type {unknown} */ v) => typeof v === 'string' && cleaner(v) === v
const animal = (/** @type {unknown} */ v) => typeof v === 'string' && Object.hasOwn(REG.species, v)
/** The words /pet wear keeps beside the names of things (engine.js `kept`). */
const WORN = ['none', 'nohead', PLAIN]
const wearable = (/** @type {string} */ id) => WORN.includes(id) || WEARABLE.some(i => i.id === id)
const things = (/** @type {unknown} */ v) => String(v ?? '').split(/\s+/).filter(Boolean)

/** The choices in the file, by the names the store keeps them under, each with what it must be. `missing` (an animal put aside) is not moved. */
const PREFS = /** @type {Record<string, (v: unknown) => boolean>} */ ({
  species: animal, born: animal, seed: v => count(v) && v !== 0, name: v => !!v && kept(cleanName)(v), stats: v => !!asStats(v),
  personality: kept(s => tidy(s, 120)), hatched: time, cuddles: count, cuddled: time,
  wear: v => typeof v === 'string' && v.length <= LIMITS.text && things(v).join(' ') === v && things(v).every(wearable),
  lang: v => !!asLang(v), style: bool, hidden: bool, model: kept(asModel), voice: bool, voiceAsked: bool, asked: bool, chats: bool, callme: kept(cleanCall),
})
const DONE = /^[a-z][a-z0-9:-]{0,31}$/ // a milestone written in the diary: `first`, `cuddles10`, `grew:adult`

/** The same data, whatever the order of the keys. @param {any} a @param {any} b @returns {boolean} */
const same = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && !!a && !!b && Array.isArray(a) === Array.isArray(b)
  && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && same(a[k], b[k])))
/** The first field two objects differ in, '' with none. */
const differs = (/** @type {any} */ a, /** @type {any} */ b) => Object.keys({ ...a, ...b }).find(k => !same(a[k], b[k])) ?? ''

/** The choices of a file. @typedef {{ species: string, born: string, seed: number, name: string, stats: number[], personality: string, hatched: number, cuddles: number, cuddled: number, wear: string, lang: string, style: boolean, hidden: boolean, model: string, voice: boolean, voiceAsked: boolean, asked: boolean, chats: boolean, callme: string }} Prefs */
/** What a file holds. @typedef {{ hatchling: 'pet', format: number, exported: number, pet: import('./engine.js').Shared, prefs: Prefs, diary: import('./diary.js').Diary }} Move */

/**
 * The file's content for a pet. Made whole on the way: a choice kept by an earlier version in a shape this one would refuse
 * (a moment that is no number, a thing worn that is not there any more) is written as this version keeps it.
 * @param {{ pet: unknown, prefs: Record<string, unknown>, diary: unknown, now: number }} from @returns {Move}
 */
export function pack({ pet, prefs, diary, now }) {
  const d = diaryOf(diary)
  return {
    hatchling: 'pet', format: FORMAT, exported: now,
    pet: shared(pet),
    prefs: /** @type {Prefs} */ ({
      ...Object.fromEntries(Object.keys(PREFS).map(k => [k, prefs[k]])),
      hatched: time(prefs.hatched) ? prefs.hatched : 0, cuddled: time(prefs.cuddled) ? prefs.cuddled : 0,
      wear: things(prefs.wear).filter(wearable).join(' ').slice(0, LIMITS.text),
    }),
    diary: { ...d, done: d.done.filter(x => DONE.test(x)), toldKind: DONE.test(d.toldKind) ? d.toldKind : '' },
  }
}

/**
 * Checks what a file holds, whole. Nothing is changed and nothing is trusted: a field nobody knows is a fault, like one of the
 * wrong kind or out of its range, a text the cleaning would change, and an animal, a thing or a coat that is not known here.
 * @param {unknown} raw the parsed JSON
 * @returns {string[]} what is wrong, each with where; empty for a sound file
 */
export function validate(raw) {
  /** @type {string[]} */ const errors = []
  const err = (/** @type {string} */ at, /** @type {string} */ what) => { errors.push(tidy(`${at}: ${what}`, ERR_COLS)) }
  const quote = (/** @type {unknown} */ v) => `"${tidy(String(v), 24)}"`
  // a file exported before the rename of 2026-11-16 says `cachito: 'pet'`: the same file under the earlier name, read as it is. Never both names
  const marks = isObj(raw) ? MARKS.filter(k => Object.hasOwn(/** @type {object} */ (raw), k)) : [], mark = marks[0] ?? ''
  if (marks.length !== 1 || /** @type {any} */ (raw)[mark] !== 'pet') return ['file: not a pet saved by /pet export']
  const file = /** @type {any} */ (raw)
  if (!Number.isInteger(file.format) || file.format < 1) return ['format: must be a whole number from 1']
  // a newer format: nothing else can be judged
  if (file.format > FORMAT) return [`format: the file was made by a newer Hatchling (format ${file.format}, this one reads ${FORMAT}): update Hatchling here, then import it`]

  // every text, of a value or of a field's name, as the cleaning leaves it and short; every number one that can be kept; nothing nested deep
  let sound = true
  const walk = (/** @type {unknown} */ v, /** @type {string} */ at, /** @type {number} */ deep) => {
    if (!sound) return
    const bad = (/** @type {string} */ what) => { sound = false; err(at, what) }
    if (typeof v === 'string') { if (v.length > LIMITS.text || tidy(v) !== v) bad(`must be a text of up to ${LIMITS.text} characters with no control, invisible or unassigned character and no spaces in a row`) }
    else if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) bad('a number out of range') }
    else if (v === null || typeof v !== 'object') { if (v !== null && typeof v !== 'boolean') bad('must be a text, a number, true or false') }
    else if (deep >= LIMITS.deep) bad('nested too deep')
    else for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) walk(k, `${at} (a field's name)`, deep); walk(x, Array.isArray(v) ? `${at}[${k}]` : `${at}.${tidy(k, 24)}`, deep + 1) }
  }
  walk(file, 'file', 0)
  if (!sound) return errors

  for (const k of Object.keys(file)) if (![mark, 'format', 'exported', 'pet', 'prefs', 'diary'].includes(k)) err('file', `unknown field ${quote(k)}`)
  if (!time(file.exported) || !file.exported) err('exported', 'must be a moment')

  if (!isObj(file.prefs)) err('prefs', 'must be an object')
  else {
    for (const k of Object.keys(file.prefs)) if (!Object.hasOwn(PREFS, k)) err('prefs', `unknown field ${quote(k)}`)
    for (const [k, ok] of Object.entries(PREFS)) {
      const v = file.prefs[k]
      if (!Object.hasOwn(file.prefs, k)) err(`prefs.${k}`, 'is missing')
      else if (ok(v)) continue
      else if ((k === 'species' || k === 'born') && typeof v === 'string') err(`prefs.${k}`, `the animal ${quote(v)} is not known here: if it comes from a skin pack, install the pack first`)
      else if (k === 'wear' && typeof v === 'string' && things(v).some(id => !wearable(id))) err('prefs.wear', `${quote(things(v).find(id => !wearable(id)))} is not a thing or a coat known here: if it comes from a skin pack, install the pack first`)
      else err(`prefs.${k}`, 'not of the right kind, or out of range')
    }
  }

  if (!isObj(file.pet)) err('pet', 'must be an object')
  else {
    const p = file.pet, list = (/** @type {unknown} */ v) => Array.isArray(v) ? v : []
    const item = list(p.owned).find(id => !OWNABLE.some(i => i.id === id)), beast = list(p.animals).find(id => !RULES.animals.includes(id))
    if (item !== undefined) err('pet.owned', `${quote(item)} is not an item or a coat known here`)
    else if (beast !== undefined) err('pet.animals', `${quote(beast)} is not an animal that can be unlocked here`)
    else { const k = differs(shared(p), p); if (k) err(`pet.${k}`, 'missing, unknown, not of the right kind, or out of range') } // sound when it is as the store keeps a pet
  }

  if (!isObj(file.diary)) err('diary', 'must be an object')
  else {
    const d = file.diary, k = differs(diaryOf(d), d)
    if (k) err(`diary.${k}`, 'missing, unknown, not of the right kind, or out of range') // as the store keeps a diary
    else if (!d.done.every((/** @type {string} */ x) => DONE.test(x)) || (d.toldKind && !DONE.test(d.toldKind))) err('diary.done', 'not the name of a milestone')
  }
  return errors.length > LIMITS.errors ? [...errors.slice(0, LIMITS.errors), `and ${errors.length - LIMITS.errors} more`] : errors
}

/**
 * A pet from the text of its file: too big, not JSON or unsound, and nothing of it is used.
 * @param {unknown} text @returns {{ move: Move | null, errors: string[] }} `move` is null when there are errors
 */
export function parse(text) {
  if (typeof text !== 'string') return { move: null, errors: ['file: could not be read as text'] }
  if (text.length > LIMITS.bytes) return { move: null, errors: [`file: larger than ${LIMITS.bytes / 1024} KiB`] }
  let raw
  try { raw = JSON.parse(text) } catch (e) { return { move: null, errors: [`file: not JSON (${tidy(String(/** @type {any} */ (e)?.message ?? e), 80)})`] } } // the message quotes the file's text
  const errors = validate(raw)
  return { move: errors.length ? null : raw, errors }
}

/** The stage a pet of a file has grown to. @param {Move} move */
export const stageOf = (move) => stage(move.pet)

/**
 * Where a pet's file goes: in the folder, named by the pet and the day, written over within the day. A backup made before an
 * import has the time too, so it is never the file being imported. The name gives letters and digits only (share.js `sharePath`).
 * @param {string} dir @param {string} name @param {number} now @param {boolean} [backup]
 */
export function movePath(dir, name, now, backup = false) {
  const d = new Date(now), two = (/** @type {number} */ n) => String(n).padStart(2, '0')
  return sharePath(dir, name, 'json').replace(/\.json$/, `-${dated(now)}${backup ? `-backup-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}` : ''}.json`)
}

/**
 * What was typed after /pet import: the path, and whether `yes` came after it. The path may hold spaces, be in quotes, or have
 * its spaces written `\ ` as a terminal pastes them; `~` at its start is the home folder. '' when there is none.
 * @param {string} typed @param {string} [home] @returns {{ path: string, yes: boolean, typed: string }}
 */
export function asked(typed, home = '') {
  const m = /^("([^"]+)"|'([^']+)'|(.+?))(?:\s+(yes))?$/is.exec(typed.trim())
  if (!m) return { path: '', yes: false, typed: '' }
  let path = m[2] ?? m[3] ?? (/^[A-Za-z]:\\/.test(m[4] ?? '') ? m[4] ?? '' : (m[4] ?? '').replace(/\\ /g, ' '))
  if (path === '~' || /^~[\\/]/.test(path)) path = home ? `${home.replace(/[\\/]+$/, '')}${path.slice(1)}` : ''
  return { path, yes: !!m[5], typed: m[1] ?? '' } // `typed`: the path as it was written, to say the command again
}
