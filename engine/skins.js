// @ts-check
// Skin packs: animals, things to wear and coats that a person adds as JSON files in ~/.claude/hatchling-skins/ (docs/skins.md).
// A pack is data, never code: it is checked whole here before any of it is used, and a pack with one fault is left out whole,
// with what is wrong said plainly. The drawings Hatchling ships with (sprites/zoo.js `pack`) are a pack of the same format and
// pass through the same check and the same reading, so the format is proven by the real drawings.
// Pure: no file is read here. The mod reads the folder (hooks/register.js), `npm run skin:check` reads one file (engine/skin-check.js).

import zoo from '../sprites/zoo.js'
import { extend, WEARABLE, GOLDEN } from './engine.js'
import { tidy } from './width.js'

export const FORMAT = 1
/** The most a pack may hold; `bytes` is the file, `packs` the files read from the folder, `errors` the faults told of one pack. */
export const LIMITS = { side: 24, credit: 160, bytes: 512 * 1024, packs: 16, animals: 8, items: 24, coats: 8, frames: 8, rare: 4, gestures: 8, gestureFrames: 6, colours: 24, tints: 8, name: 32, artRows: 12, artCols: 16, pieces: 4, draws: 32, errors: 12 }

const W0 = zoo.width, H0 = zoo.height, SIDE = zoo.side, UNDER = zoo.under
const ID = /^[a-z][a-z0-9-]{1,23}$/
const HEX = /^#[0-9a-f]{6}$/i
const KEY = /^[A-Za-z0-9]$/
export const YOUNG = ['bloated', 'cheer', 'dizzy', 'stomach', 'loop', 'sleep'] // the moods a baby has a drawing of its own for, as `baby-<mood>`: a pet not yet grown is drawn small in every one of them
export const STATES = ['baby', 'adult', 'crown', 'sad', 'bloated', 'cheer', 'dizzy', 'stomach', 'loop', 'ko', 'sleep', ...YOUNG.map(name => `baby-${name}`)]
const CALM = ['baby', 'adult', 'crown'] // the states that may hold gestures
const BODIES = ['adult', 'baby']
/** The parts a thing of a pack may be worn on. A coat is not a thing: it has its own list. */
export const PARTS = ['head', 'face', 'body', 'feet', 'accessory']
export const ANCHORS = ['head', 'face', 'neck', 'feet', 'under', 'left', 'right']
const LANG = ['en', 'es', 'pt', 'zh']
/** Words a pack may not use as a name: what /pet wear and the kept choices already mean. The shipped names are added to them. */
export const RESERVED = ['none', 'off', 'plain', 'nohead', 'crown', 'golden', 'animal', 'coat', 'hatchling', 'constructor', 'prototype', ...PARTS]
/** A name a pack may give: sound, and none of what every object has of itself (`constructor`), which a lookup by name would find. */
const named = (/** @type {unknown} */ s) => typeof s === 'string' && ID.test(s) && !(s in Object.prototype)
const ERR_COLS = 240 // the most one fault takes when it is told

const isObj = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (/** @type {unknown} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Number.isInteger(v) && /** @type {number} */ (v) >= lo && /** @type {number} */ (v) <= hi
const entries = (/** @type {any} */ v) => /** @type {[string, any][]} */ (isObj(v) ? Object.entries(v) : [])

/**
 * Checks a pack, whole. Nothing is changed and nothing is trusted: every field is looked at, and one nobody knows is a fault too.
 * @param {unknown} raw the parsed JSON
 * @param {{ taken?: Iterable<string>, builtin?: boolean }} [opts] `taken`: the names already in use (the shipped ones, the packs read before); `builtin`: the shipped pack, which alone may use those names and say how often an animal is born
 * @returns {string[]} what is wrong, each with where; empty for a sound pack
 */
export function validate(raw, opts = {}) {
  /** @type {string[]} */ const errors = []
  // a fault quotes what the pack says (a field's name, a colour key): made safe to show here, where it is written
  const err = (/** @type {string} */ at, /** @type {string} */ what) => { errors.push(tidy(`${at}: ${what}`, ERR_COLS)) }
  const taken = new Set(opts.builtin ? [] : [...RESERVED, ...(opts.taken ?? [])])

  /** An object with only the keys named; false when it is not one. */
  const shape = (/** @type {any} */ v, /** @type {string} */ at, /** @type {string[]} */ must, /** @type {string[]} */ may = []) => {
    if (!isObj(v)) { err(at, 'must be an object'); return false }
    for (const k of Object.keys(v)) if (!must.includes(k) && !may.includes(k)) err(at, `unknown field "${k.slice(0, 24)}"`)
    for (const k of must) if (!Object.hasOwn(v, k)) err(at, `"${k}" is missing`)
    return true
  }
  const label = (/** @type {any} */ v, /** @type {string} */ at, max = LIMITS.name) => {
    if (typeof v !== 'string' || !v.trim() || v !== v.trim() || [...v].length > max) return err(at, `must be a text of 1 to ${max} characters, with no space at its ends`)
    // the rule of every text from outside (width.js `tidy`): what it would take out or change may not be there
    if (tidy(v) !== v) err(at, 'holds a control, an invisible or an unassigned character, marks piled on one character, or spaces in a row')
  }
  const names = (/** @type {any} */ v, /** @type {string} */ at) => {
    if (!shape(v, at, ['en'], LANG)) return
    for (const [lang, s] of entries(v)) if (LANG.includes(lang)) label(s, `${at}.${lang}`)
  }
  const colours = (/** @type {any} */ v, /** @type {string} */ at, /** @type {(key: string) => string | undefined} */ bad) => {
    if (!isObj(v)) return err(at, 'must be an object of colour keys')
    if (Object.keys(v).length > LIMITS.colours) err(at, `more than ${LIMITS.colours} colours`)
    for (const [k, c] of entries(v)) {
      const why = !KEY.test(k) ? 'a colour key is one letter or digit' : bad(k)
      if (why) err(`${at}.${k.slice(0, 8)}`, why)
      if (typeof c !== 'string' || !HEX.test(c)) err(`${at}.${k.slice(0, 8)}`, 'a colour is written #rrggbb')
    }
  }
  /** A list of [row, column] pairs within the limits given. */
  const points = (/** @type {any} */ v, /** @type {string} */ at, /** @type {number} */ max, /** @type {[number, number, number, number]} */ [r0, r1, c0, c1]) => {
    if (!Array.isArray(v) || !v.length || v.length > max) return err(at, `must be a list of 1 to ${max} [row, column] pairs`)
    v.forEach((p, i) => { if (!Array.isArray(p) || p.length !== 2 || !isInt(p[0], r0, r1) || !isInt(p[1], c0, c1)) err(`${at}[${i}]`, `must be [row, column], row ${r0} to ${r1}, column ${c0} to ${c1}`) })
  }
  // the animal being checked: its body's width and height in pixels (12 by 10 unless it says its own `size`)
  let W = W0, H = H0
  /** One frame: the body's size (12x10 pixels), or two more each way for one with room around the body. Returns its height, 0 when unsound. */
  const frame = (/** @type {any} */ f, /** @type {string} */ at, /** @type {Set<string>} */ ink) => {
    if (!Array.isArray(f) || !f.every(r => typeof r === 'string')) { err(at, 'a frame is a list of rows of text'); return 0 }
    const small = f.length === H && f.every(r => r.length === W), big = f.length === H + 2 && f.every(r => r.length === W + 2)
    if (!small && !big) { err(at, `a frame is ${H} rows of ${W} pixels, or ${H + 2} rows of ${W + 2}`); return 0 }
    const odd = [...new Set(f.join(''))].filter(ch => ch !== '.' && !ink.has(ch))
    if (odd.length) err(at, `uses a colour key the palette lacks: ${odd.slice(0, 5).map(ch => JSON.stringify(ch)).join(' ')}`)
    return f.length
  }
  /** A list of frames with where the body sits in each: a small frame is set at [2, 1] by the adapter, so that is what it must say. */
  const frames = (/** @type {any} */ st, /** @type {string} */ at, /** @type {Set<string>} */ ink, /** @type {number} */ max, /** @type {boolean} */ placed) => {
    if (!Array.isArray(st.frames) || !st.frames.length || st.frames.length > max) return err(`${at}.frames`, `must be a list of 1 to ${max} frames`)
    const heights = st.frames.map((/** @type {any} */ f, /** @type {number} */ i) => frame(f, `${at}.frames[${i}]`, ink))
    if (st.at === undefined) return
    if (!placed) return err(`${at}.at`, 'asleep the pet wears nothing: no "at" here')
    points(st.at, `${at}.at`, st.frames.length, [0, 2, 0, 2])
    if (Array.isArray(st.at)) heights.forEach((/** @type {number} */ h, /** @type {number} */ i) => { const p = st.at[i] ?? st.at[0]; if (h === H && Array.isArray(p) && (p[0] !== 2 || p[1] !== 1)) err(`${at}.at`, `a frame of ${H} rows sits at [2, 1]`) })
  }
  /** A small drawing of a thing: rows of the fixed colours. Returns its cells as marks from (0, 0), or null. */
  const art = (/** @type {any} */ a, /** @type {string} */ at) => {
    if (!Array.isArray(a) || !a.length || a.length > LIMITS.artRows || !a.every(r => typeof r === 'string' && r.length >= 1 && r.length <= LIMITS.artCols && r.length === a[0].length)) { err(at, `must be 1 to ${LIMITS.artRows} rows of text, each as long, of 1 to ${LIMITS.artCols} pixels`); return null }
    const odd = [...new Set(a.join(''))].filter(ch => ch !== '.' && !zoo.fixed.includes(ch))
    if (odd.length) { err(at, `a thing is drawn with the fixed colours only (${zoo.fixed}), not ${odd.slice(0, 5).map(ch => JSON.stringify(ch)).join(' ')}`); return null }
    if (!a.join('').replaceAll('.', '')) { err(at, 'draws nothing'); return null }
    return a
  }
  /** A drawing set by hand on a body: its top left corner and its rows, all of it within reach of the frame. */
  const drawing = (/** @type {any} */ d, /** @type {string} */ at) => {
    if (!shape(d, at, ['at', 'art'])) return
    const rows = art(d.art, `${at}.art`)
    if (!Array.isArray(d.at) || d.at.length !== 2 || !isInt(d.at[0], -2, H + UNDER - 1) || !isInt(d.at[1], -SIDE, W + SIDE - 1)) return err(`${at}.at`, 'must be [row, column] of the top left corner')
    if (rows && (d.at[0] + rows.length > H + UNDER || d.at[1] + rows[0].length > W + SIDE)) err(at, `reaches out of the frame: rows -2 to ${H + UNDER - 1}, columns ${-SIDE} to ${W + SIDE - 1}`)
  }
  /** How the bodies of animals wear a thing, by hand: { <name>: { adult, baby } }. */
  const draws = (/** @type {any} */ v, /** @type {string} */ at) => {
    if (!isObj(v)) return err(at, 'must be an object')
    if (Object.keys(v).length > LIMITS.draws) err(at, `more than ${LIMITS.draws} entries`)
    for (const [who, bodies] of entries(v)) {
      if (!named(who)) { err(`${at}.${who.slice(0, 24)}`, 'not a name'); continue }
      if (shape(bodies, `${at}.${who}`, [], BODIES)) for (const [body, d] of entries(bodies)) if (BODIES.includes(body)) drawing(d, `${at}.${who}.${body}`)
    }
  }

  if (!shape(raw, 'pack', ['format', 'id', 'name'], ['animals', 'items', 'coats', 'credits'])) return errors
  const pack = /** @type {any} */ (raw)
  if (pack.format !== FORMAT) { err('format', `this Hatchling reads format ${FORMAT}`); return errors } // another format: nothing else can be judged
  if (!named(pack.id)) err('id', 'must be 2 to 24 of a-z, 0-9 and -, a letter first')
  else if (taken.has(pack.id)) err('id', `"${pack.id}" is taken already`)
  label(pack.name, 'name')
  // who made what the pack holds, under which licence, and where it comes from: texts, shown by /pet skins
  if (pack.credits !== undefined && shape(pack.credits, 'credits', [], ['author', 'license', 'source'])) for (const [k, v] of entries(pack.credits)) label(v, `credits.${k}`, LIMITS.credit)

  /** @type {string[]} */ const mine = []
  /** A group of the pack: an object of named things, not too many, each name sound, free and used once in the pack. */
  const group = (/** @type {string} */ kind, /** @type {number} */ max, /** @type {(v: any, at: string) => void} */ each) => {
    const v = pack[kind]
    if (v === undefined) return
    if (!isObj(v)) return err(kind, 'must be an object')
    if (Object.keys(v).length > max) err(kind, `more than ${max}`)
    for (const [id, one] of entries(v).slice(0, max)) {
      const at = `${kind}.${id.slice(0, 24)}`
      if (!named(id)) { err(at, 'a name is 2 to 24 of a-z, 0-9 and -, a letter first, and not a word every object has (constructor)'); continue }
      if (taken.has(id)) err(at, `the name "${id}" is taken already`)
      if (mine.includes(id) || id === pack.id) err(at, `the name "${id}" is used twice in this pack`)
      mine.push(id)
      each(one, at)
    }
  }

  group('animals', LIMITS.animals, (a, at) => {
    W = W0; H = H0
    if (!shape(a, at, ['name', 'palette', 'states'], ['size', 'anchors', 'tints', 'gold', 'wear', ...(opts.builtin ? ['weight'] : [])])) return
    // a body larger than 12 by 10, for a drawing with more in it: even numbers, so that two pixel rows make one row of text
    if (a.size !== undefined) {
      if (!Array.isArray(a.size) || a.size.length !== 2 || !a.size.every((/** @type {unknown} */ n) => isInt(n, 8, LIMITS.side) && /** @type {number} */ (n) % 2 === 0)) err(`${at}.size`, `must be [width, height] in pixels, even numbers from 8 to ${LIMITS.side}`)
      else [W, H] = a.size
    }
    names(a.name, `${at}.name`)
    if (a.weight !== undefined && !(typeof a.weight === 'number' && a.weight > 0 && a.weight <= 100)) err(`${at}.weight`, 'must be a number over 0')
    colours(a.palette, `${at}.palette`, k => Object.hasOwn(zoo.common, k) ? `"${k}" is a shared colour: pick another key` : undefined)
    const own = Object.keys(isObj(a.palette) ? a.palette : {}), ink = new Set([...Object.keys(zoo.common), ...own])
    const tintable = new Set([...own, ...Object.keys(zoo.common).filter(k => !zoo.fixed.includes(k))])
    if (a.tints !== undefined) {
      if (!isObj(a.tints)) err(`${at}.tints`, 'must be an object')
      else {
        if (Object.keys(a.tints).length > LIMITS.tints) err(`${at}.tints`, `more than ${LIMITS.tints}`)
        for (const [name, pal] of entries(a.tints)) {
          if (!named(name)) { err(`${at}.tints.${name.slice(0, 24)}`, 'not a name'); continue }
          colours(pal, `${at}.tints.${name}`, k => tintable.has(k) ? undefined : `"${k}" is not a colour of this animal that can change`)
        }
      }
    }
    if (isObj(a.states)) {
      for (const [name, st] of entries(a.states)) {
        const sat = `${at}.states.${name.slice(0, 24)}`
        if (!STATES.includes(name)) { err(sat, `not a state: ${STATES.join(', ')}`); continue }
        if (!shape(st, sat, ['frames'], ['rare', 'at', 'tint', 'idle'])) continue
        frames(st, sat, ink, LIMITS.frames, name !== 'sleep')
        if (st.rare !== undefined) {
          if (!Array.isArray(st.rare) || st.rare.length > LIMITS.rare) err(`${sat}.rare`, `must be a list of up to ${LIMITS.rare} frames`)
          else st.rare.forEach((/** @type {any} */ f, /** @type {number} */ i) => frame(f, `${sat}.rare[${i}]`, ink))
        }
        if (st.tint !== undefined && !(typeof st.tint === 'string' && isObj(a.tints) && Object.hasOwn(a.tints, st.tint))) err(`${sat}.tint`, 'names no tint of this animal')
        if (st.idle !== undefined) {
          if (!CALM.includes(name)) err(`${sat}.idle`, `only ${CALM.join(', ')} have gestures`)
          else if (!isObj(st.idle)) err(`${sat}.idle`, 'must be an object')
          else {
            if (Object.keys(st.idle).length > LIMITS.gestures) err(`${sat}.idle`, `more than ${LIMITS.gestures} gestures`)
            for (const [g, move] of entries(st.idle)) {
              if (!named(g)) { err(`${sat}.idle.${g.slice(0, 24)}`, 'not a name'); continue }
              if (shape(move, `${sat}.idle.${g}`, ['frames'], ['at'])) frames(move, `${sat}.idle.${g}`, ink, LIMITS.gestureFrames, true)
            }
          }
        }
      }
      if (!Object.hasOwn(a.states, 'adult')) err(`${at}.states`, 'the "adult" state is missing: every other one falls back on it')
    } else err(`${at}.states`, 'must be an object')
    for (const [what, check] of /** @type {[string, (v: any, at: string) => void][]} */ ([
      ['anchors', (v, p) => { if (shape(v, p, ['top', 'eyes', 'neck'])) { if (!isInt(v.top, 0, H - 1)) err(`${p}.top`, `must be a row, 0 to ${H - 1}`); if (!isInt(v.neck, 0, H - 1)) err(`${p}.neck`, `must be a row, 0 to ${H - 1}`); points(v.eyes, `${p}.eyes`, 2, [0, H - 1, 0, W - 1]); if (Array.isArray(v.eyes) && v.eyes.length !== 2) err(`${p}.eyes`, 'must be the two eyes') } }],
      ['gold', (v, p) => { if (shape(v, p, ['shine', 'spark'])) { points(v.shine, `${p}.shine`, 4, [0, H - 1, 0, W - 1]); points(v.spark, `${p}.spark`, 4, [-2, H - 1, -1, W]) } }],
    ])) {
      if (a[what] === undefined || !shape(a[what], `${at}.${what}`, [], BODIES)) continue
      for (const [body, v] of entries(a[what])) if (BODIES.includes(body)) check(v, `${at}.${what}.${body}`)
    }
    if (a.wear !== undefined) draws(a.wear, `${at}.wear`)
  })

  group('items', LIMITS.items, (i, at) => {
    W = W0; H = H0 // a thing drawn by hand is set on the usual body
    if (!shape(i, at, ['part', 'name', 'fallback'], ['draw'])) return
    if (!PARTS.includes(i.part)) err(`${at}.part`, `must be one of ${PARTS.join(', ')}`)
    names(i.name, `${at}.name`)
    if (i.draw !== undefined) draws(i.draw, `${at}.draw`)
    if (!Array.isArray(i.fallback) || !i.fallback.length || i.fallback.length > LIMITS.pieces) return err(`${at}.fallback`, `must be a list of 1 to ${LIMITS.pieces} pieces: how an animal the pack does not know wears it`)
    i.fallback.forEach((/** @type {any} */ piece, /** @type {number} */ n) => {
      const p = `${at}.fallback[${n}]`
      if (!shape(piece, p, ['anchor', 'art'], ['dx', 'dy'])) return
      if (!ANCHORS.includes(piece.anchor)) err(`${p}.anchor`, `must be one of ${ANCHORS.join(', ')}`)
      art(piece.art, `${p}.art`)
      for (const d of ['dx', 'dy']) if (piece[d] !== undefined && !isInt(piece[d], -8, 8)) err(`${p}.${d}`, 'must be a whole number, -8 to 8')
    })
  })

  group('coats', LIMITS.coats, (c, at) => {
    if (!shape(c, at, ['name', 'ramp'])) return
    names(c.name, `${at}.name`)
    if (!Array.isArray(c.ramp) || c.ramp.length < 2 || c.ramp.length > 4 || !c.ramp.every((/** @type {unknown} */ h) => typeof h === 'string' && HEX.test(h))) err(`${at}.ramp`, 'must be 2 to 4 colours written #rrggbb, dark to light')
  })

  if (!errors.length && !mine.length) err('pack', 'brings nothing: no animal, no item, no coat')
  return errors.length > LIMITS.errors ? [...errors.slice(0, LIMITS.errors), `and ${errors.length - LIMITS.errors} more`] : errors
}

/**
 * A pack from the text of its file: too big, not JSON or unsound, and it is not a pack.
 * @param {string} text @param {{ taken?: Iterable<string> }} [opts]
 * @returns {{ pack: any, errors: string[] }} `pack` is null when there are errors
 */
export function parse(text, opts = {}) {
  if (typeof text !== 'string') return { pack: null, errors: ['file: could not be read as text'] }
  if (text.length > LIMITS.bytes) return { pack: null, errors: [`file: larger than ${LIMITS.bytes / 1024} KiB`] }
  let raw
  try { raw = JSON.parse(text) } catch (e) { return { pack: null, errors: [`file: not JSON (${tidy(String(/** @type {any} */ (e)?.message ?? e), 80)})`] } } // the message quotes the file's text
  const errors = validate(raw, opts)
  return { pack: errors.length ? null : raw, errors }
}

/** @typedef {[number, number, string]} Mark a pixel of a thing on a body: row, column, colour key */
/** @typedef {{ top: number, eyes: [number, number][], neck: number }} Anchors */

const marksOf = (/** @type {{ at: [number, number], art: string[] }} */ d) => d.art.flatMap((row, i) => [...row].flatMap((ch, j) => ch === '.' ? [] : [/** @type {Mark} */ ([d.at[0] + i, d.at[1] + j, ch])]))
const bodies = (/** @type {any} */ v) => Object.fromEntries(entries(v).map(([body, d]) => [body, marksOf(d)]))

/** The body of a calm state's first frame, as rows of the body's own size: a frame with room around it is cut where `at` says the body sits. */
function bodyOf(/** @type {any} */ st, /** @type {[number, number]} */ [W, H]) {
  const f = /** @type {string[]} */ (st.frames[0]), [r, c] = st.at?.[0] ?? [2, 1]
  return f.length === H ? f : f.slice(r, r + H).map(row => row.slice(c, c + W))
}
/** Where things go on a body nobody gave anchors for: the head starts at its first row at the centre, the eyes are its first dark pixels. */
function guess(/** @type {string[]} */ body, /** @type {[number, number]} */ [W, H]) {
  const filled = body.findIndex(r => r.slice(W / 2 - 1, W / 2 + 1).replaceAll('.', '')), any = body.findIndex(r => r.replaceAll('.', ''))
  const top = filled >= 0 ? filled : Math.max(0, any)
  const row = body.findIndex(r => r.includes('k')), r = row >= 0 ? row : Math.min(H - 1, top + Math.round(H * 0.3))
  const eyes = /** @type {[number, number][]} */ (row >= 0 ? [[r, /** @type {string} */ (body[r]).indexOf('k')], [r, /** @type {string} */ (body[r]).lastIndexOf('k')]] : [[r, Math.round(W / 4)], [r, W - 1 - Math.round(W / 4)]])
  return { top, eyes, neck: Math.min(H - 3, r + Math.round(H * 0.3)) }
}

/**
 * The pieces of a thing set on a body by its anchors: over the head, on the eyes, at the neck, on the feet, under them, or on the
 * ground at either side. What falls out of reach of the frame is left out. `size` is the body's, 12 by 10 unless the animal says its own.
 * @param {{ anchor: string, art: string[], dx?: number, dy?: number }[]} pieces @param {Anchors} a @param {[number, number]} [size] @returns {Mark[]}
 */
export function place(pieces, a, [W, H] = [W0, H0]) {
  const mid = ((a.eyes[0]?.[1] ?? 3) + (a.eyes[1]?.[1] ?? W - 4)) / 2, eye = a.eyes[0]?.[0] ?? a.top + 3
  return pieces.flatMap(p => {
    const h = p.art.length, w = /** @type {string} */ (p.art[0]).length
    const centred = Math.round(mid - (w - 1) / 2), flat = Math.floor((W - w) / 2)
    const [r, c] = /** @type {Record<string, [number, number]>} */ ({
      head: [a.top - h, centred], face: [eye - Math.floor(h / 2), centred], neck: [a.neck, centred],
      feet: [H - h, flat], under: [H, flat], left: [H - h, -w - 1], right: [H - h, W + 1],
    })[p.anchor] ?? [0, 0]
    return marksOf({ at: [r + (p.dy ?? 0), c + (p.dx ?? 0)], art: p.art }).filter(([y, x]) => y >= -2 && y < H + UNDER && x >= -SIDE && x < W + SIDE)
  })
}

/**
 * A checked pack as the adapter draws from it. Call it only on what `validate` passed.
 * @param {any} pack @param {boolean} [builtin]
 */
export function compile(pack, builtin = false) {
  const from = builtin ? '' : String(pack.name)
  const species = Object.fromEntries(entries(pack.animals).map(([id, a]) => {
    const states = Object.fromEntries(entries(a.states).map(([name, st]) => [name, {
      ...st, rare: st.rare ?? [], ...(name === 'sleep' ? null : { at: st.at ?? [[2, 1]] }),
      ...(st.idle ? { idle: Object.fromEntries(entries(st.idle).map(([g, move]) => [g, { ...move, at: move.at ?? [[2, 1]] }])) } : null),
    }]))
    const grown = /** @type {any} */ (states.adult), small = states.baby ?? grown
    const size = /** @type {[number, number]} */ (a.size ?? [W0, H0])
    return [id, {
      pack: from, names: a.name, size, weight: builtin ? a.weight ?? 0 : 0,
      palette: { ...zoo.common, ...a.palette }, states: { ...states, baby: small, crown: states.crown ?? grown }, tints: a.tints ?? {}, gold: a.gold ?? {},
      // a body with no state of its own is drawn as the adult: it wears as the adult does
      anchors: { adult: a.anchors?.adult ?? guess(bodyOf(grown, size), size), baby: states.baby ? a.anchors?.baby ?? guess(bodyOf(small, size), size) : a.anchors?.adult ?? guess(bodyOf(grown, size), size) },
      wear: Object.fromEntries(entries(a.wear).map(([item, d]) => [item, bodies(d)])),
    }]
  }))
  const items = Object.fromEntries(entries(pack.items).map(([id, i]) => [id, { pack: from, names: i.name, slot: i.part, draw: Object.fromEntries(entries(i.draw).map(([who, d]) => [who, bodies(d)])), fallback: i.fallback }]))
  const coats = Object.fromEntries(entries(pack.coats).map(([id, c]) => [id, { pack: from, names: c.name, ramp: c.ramp }]))
  return { id: String(pack.id), name: String(pack.name), credits: /** @type {Record<string, string>} */ ({ ...pack.credits }), species, items, coats }
}

/** @typedef {ReturnType<typeof compile>} Compiled */
/** @typedef {{ file: string, id: string, name: string, animals: string[], items: string[], coats: string[], errors: string[], credits?: Record<string, string> }} Found a pack of the folder: what it brings, or why it was left out */

const shipped = validate(zoo.pack, { builtin: true })
if (shipped.length) throw new Error(`sprites/zoo.js is not a sound pack: ${shipped.join('; ')}`)
/** The drawings Hatchling ships with, read as the pack they are. */
export const BUILTIN = compile(zoo.pack, true)

/** Everything there is to draw now: the shipped drawings and the person's packs. `install` fills it; the adapter only reads. */
export const REG = {
  species: /** @type {Record<string, any>} */ ({ ...BUILTIN.species }),
  items: /** @type {Record<string, any>} */ ({ ...BUILTIN.items }),
  coats: /** @type {Record<string, any>} */ ({ ...BUILTIN.coats }),
  /** @type {Found[]} */ packs: [],
}
/** @type {Map<string, any>} */ const memo = new Map()

/**
 * Reads the person's packs over the shipped drawings, in the order given: each is checked whole, and one with a fault, or with a
 * name an earlier one took, is left out whole and told in `REG.packs`. Nothing here can fail: no pack, no change.
 * What a pack brings is the person's at once: its things join what can be worn (engine.js `extend`), and cost nothing.
 * @param {{ file: string, text?: string, error?: string }[]} files a file that could not be read comes with its `error`
 * @returns {Found[]}
 */
export function install(files) {
  const reg = { species: { ...BUILTIN.species }, items: { ...BUILTIN.items }, coats: { ...BUILTIN.coats } }
  /** @type {Found[]} */ const packs = []
  /** @type {string[]} */ const ids = []
  for (const f of files) {
    const file = tidy(f.file, 80) // a file's name is the stranger's too
    const none = { file, id: '', name: '', animals: [], items: [], coats: [] }
    if (packs.length >= LIMITS.packs) { packs.push({ ...none, errors: [`folder: more than ${LIMITS.packs} packs, this one was not read`] }); continue }
    if (f.text === undefined) { packs.push({ ...none, errors: [`file: ${tidy(f.error ?? '', ERR_COLS) || 'could not be read'}`] }); continue }
    const { pack, errors } = parse(f.text, { taken: [...ids, ...Object.keys(reg.species), ...Object.keys(reg.items), ...Object.keys(reg.coats)] })
    if (!pack) { packs.push({ ...none, errors }); continue }
    const c = compile(pack)
    Object.assign(reg.species, c.species); Object.assign(reg.items, c.items); Object.assign(reg.coats, c.coats)
    ids.push(c.id)
    packs.push({ file, id: c.id, name: c.name, animals: Object.keys(c.species), items: Object.keys(c.items), coats: Object.keys(c.coats), errors: [], credits: c.credits })
  }
  REG.species = reg.species; REG.items = reg.items; REG.coats = reg.coats; REG.packs = packs
  memo.clear()
  const worn = (/** @type {Record<string, any>} */ group, /** @type {(v: any) => string} */ slot) => Object.entries(group).filter(([, v]) => v.pack).map(([id, v]) => ({ id, name: String(v.names.en), names: /** @type {Record<string, string>} */ (v.names), slot: slot(v), price: 0, pack: String(v.pack) }))
  extend([...worn(reg.items, v => v.slot), ...worn(reg.coats, () => 'coat')])
  return packs
}

/** What a table holds under a name, its own only: `constructor` and the like, which every object has, are not in it. */
const own = (/** @type {Record<string, any>} */ table, /** @type {string} */ name) => Object.hasOwn(table, name) ? table[name] : undefined

/**
 * How one body of an animal wears a thing: drawn by hand for it by the thing's pack or by the animal's own, else set by its anchors.
 * @param {string} item @param {string} animal @param {'adult' | 'baby'} body @returns {Mark[]}
 */
export function marksFor(item, animal, body) {
  const key = `${item}/${animal}/${body}`
  if (!memo.has(key)) {
    const i = own(REG.items, item), sp = own(REG.species, animal)
    memo.set(key, !i || !sp ? [] : own(i.draw, animal)?.[body] ?? own(sp.wear, item)?.[body] ?? place(i.fallback, sp.anchors[body], sp.size))
  }
  return memo.get(key)
}

const rgb = (/** @type {string} */ c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
/**
 * The colours an animal takes under a coat: its own tint for that coat when it has one, else each colour of its body that can
 * change set on the coat's ramp by how light it was, so its light and dark parts stay apart. The cheeks keep their colour.
 * `edge` is the coat's darkest colour: on a light theme the pale pixels of the coat get it where they touch the background.
 * @param {string} coat @param {string} animal @returns {{ palette: Record<string, string>, edge: string } | null}
 */
export function coatOf(coat, animal) {
  const key = `coat/${coat}/${animal}`
  if (!memo.has(key)) {
    const c = own(REG.coats, coat), sp = own(REG.species, animal)
    const ramp = /** @type {string[]} */ (c?.ramp ?? []), n = ramp.length - 1
    const on = (/** @type {string} */ own) => {
      const [r, g, b] = /** @type {[number, number, number]} */ (rgb(own)), t = (0.299 * r + 0.587 * g + 0.114 * b) / 255 * n, i = Math.min(n - 1, Math.floor(t))
      const lo = rgb(/** @type {string} */ (ramp[i])), hi = rgb(/** @type {string} */ (ramp[i + 1]))
      return '#' + lo.map((x, k) => Math.round(x + ((hi[k] ?? x) - x) * (t - i)).toString(16).padStart(2, '0')).join('')
    }
    memo.set(key, !c || !sp ? null : { edge: ramp[0], palette: own(sp.tints, coat) ?? Object.fromEntries(Object.entries(/** @type {Record<string, string>} */ (sp.palette)).filter(([k]) => !zoo.fixed.includes(k) && k !== 'r').map(([k, v]) => [k, on(v)])) })
  }
  return memo.get(key)
}

const partOf = (/** @type {string} */ id) => WEARABLE.find(i => i.id === id)?.slot ?? ''

/**
 * A frame with shop items drawn over it. The marks are in the body's own coordinates and `at` is where the body sits on the effect
 * canvas, so a calm frame is first set on that canvas: a hat needs the rows above the head. The accessories stand on the ground next
 * to the body: the frame is widened by the columns they take, the same for every frame of that item, so the pet does not jump between
 * moods. A thing under the feet (the skateboard) makes the frame taller by its rows. Without `at` (asleep) the frame only takes
 * that size and nothing is drawn: the rows are then added above, and the pet sleeps on the ground.
 */
export function dress(/** @type {string[]} */ rows, /** @type {[number, number, string][]} */ marks, /** @type {[number, number] | undefined} */ at, /** @type {[number, number]} */ [W, H] = [zoo.width, zoo.height]) {
  const cols = marks.map(m => m[1]), left = Math.max(0, -Math.min(0, ...cols)), right = Math.max(0, Math.max(0, ...cols) - (W - 1))
  const under = Math.max(0, ...marks.map(m => m[0] - (H - 1)))
  const wide = rows.length === H ? ['', '', ...rows].map(r => (r && `.${r}`).padEnd(W + 2, '.')) : rows
  const more = Array.from({ length: under + under % 2 }, () => '.'.repeat(W + 2))
  const g = (at ? [...wide, ...more] : [...more, ...wide]).map(r => [...'.'.repeat(left) + r + '.'.repeat(right)])
  if (at) for (const [r, c, ch] of marks) { const row = g[r + at[0]], x = c + at[1] + left; if (row && x >= 0 && x < row.length) row[x] = ch }
  return g.map(r => r.join(''))
}

/**
 * A frame with what is worn drawn over it, one thing over the other from the ground up to the head. A thing of the body that goes
 * above the neck (the hood of the hoodie) gives way to a hat: with a thing on the head, its marks above the neck are not drawn.
 * The crown is no hat here: it sits inside the head, and the hood goes round it.
 */
export function dressed(/** @type {string[]} */ rows, /** @type {[number, number] | undefined} */ at, /** @type {string[]} */ wear, /** @type {[number, number, string][]} */ glint, /** @type {string} */ animal, /** @type {'adult' | 'baby'} */ body) {
  if (!wear.length && !glint.length) return rows
  const sp = REG.species[animal], hat = wear.some(id => partOf(id) === 'head'), neck = Number(sp.anchors[body]?.neck)
  const marks = (/** @type {string} */ id) => { const all = marksFor(id, animal, body); return hat && partOf(id) === 'body' && neck >= 0 ? all.filter(m => m[0] >= neck) : all }
  // with a thing under the feet the ground is lower: the accessories stand on it, not at the feet
  const under = Math.max(0, ...wear.flatMap(id => marks(id).map(m => m[0] - (sp.size[1] - 1))))
  return dress(rows, [...glint, ...wear.toReversed().flatMap(id => partOf(id) === 'accessory' ? marks(id).map(([r, c, ch]) => /** @type {[number, number, string]} */ ([r + under, c, ch])) : marks(id))], at, sp.size)
}

/**
 * The pet standing calm, in colour, with what it has on and its coat, the golden one with its glint and every sparkle lit: the
 * picture of /pet share. `stage` names the drawing: baby, adult or crown. `worn` is what is on (engine.js `wornOf`).
 * @param {string} animal @param {string} stage @param {string[]} worn @returns {{ rows: string[], palette: Record<string, string> }}
 */
export function portrait(animal, stage, worn) {
  const sp = REG.species[animal], body = stage === 'baby' ? 'baby' : 'adult'
  const st = sp.states[stage === 'crown' && !worn.includes('crown') ? 'adult' : stage] ?? sp.states.adult
  const coat = worn.find(id => partOf(id) === GOLDEN.slot), gold = coat === GOLDEN.id ? /** @type {{ shine: [number, number][], spark: [number, number][] } | undefined} */ (sp.gold[body]) : null
  const glint = gold ? [...gold.shine.map(([r, c]) => /** @type {[number, number, string]} */ ([r, c, 'x'])), ...gold.spark.map(([r, c]) => /** @type {[number, number, string]} */ ([r, c, 'y']))] : []
  return { rows: dressed(st.frames[0], st.at?.[0], worn.filter(id => id !== 'crown' && partOf(id) !== GOLDEN.slot), glint, animal, body), palette: { ...sp.palette, ...(coat ? coatOf(coat, animal)?.palette : null) } }
}
