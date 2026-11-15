#!/usr/bin/env node
// @ts-check
// Turns a Codex pet into a Cachito skin pack: npm run skin:import <folder of the pet | its pet.json> [options]
// A Codex pet is a folder with `pet.json` and one sprite sheet (spritesheet.webp or .png): 8 columns of cells of 192x208 pixels,
// one row for each state (docs/skins.md, "Importing a Codex pet", has the sources). This reads those two files from the person's
// own disk, and nothing else: it downloads nothing. The sheet is reduced to our grid of half blocks with a small palette, three
// states are taken (still, happy, asleep), and the result is checked with the rules every pack is checked with before it is written.

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import zoo from '../sprites/zoo.js'
import { decode } from './image.js'
import { BUILTIN, LIMITS, validate } from './skins.js'
import { tidy } from './width.js'

const CELL = { w: 192, h: 208, columns: 8 } // the cell of a Codex sheet, and how many in a row
// the rows of a sheet we take from, and how many of their cells are drawn (openai/skills hatch-pet, references/animation-rows.md)
const ROWS = { idle: { row: 0, n: 6 }, waving: { row: 3, n: 4 }, jumping: { row: 4, n: 5 }, waiting: { row: 6, n: 6 } }
export const DEFAULTS = { size: /** @type {[number, number]} */ ([20, 22]), colours: 16 }
const SHEET_MAX = 20 * 1024 * 1024 // what Codex itself allows a sheet to weigh
const NOTE_MAX = 64 * 1024 // pet.json and submission.json are a few lines
const SOLID = 0.45 // a pixel of ours is drawn when this share of what it covers is
const DARK = 90, DARK_WEIGHT = 2.5 // a source pixel darker than this (of 255) counts this many times: an eye or an outline survives the reduction

/** @typedef {import('./image.js').Image} Image */

/** The colours to use, at most `n`: the pixels' own, split where they differ most until there are that many groups (median cut). @param {number[][]} px @param {number} n */
function palette(px, n) {
  /** @type {number[][][]} */ let boxes = [px]
  const span = (/** @type {number[][]} */ box) => [0, 1, 2].map(k => { let lo = 255, hi = 0; for (const p of box) { const v = /** @type {number} */ (p[k]); if (v < lo) lo = v; if (v > hi) hi = v } return hi - lo })
  while (boxes.length < n) {
    const pick = boxes.map((box, i) => ({ i, box, range: Math.max(...span(box)) })).filter(b => b.box.length > 1 && b.range > 0).sort((a, b) => b.range * b.box.length - a.range * a.box.length)[0]
    if (!pick) break
    const k = span(pick.box).indexOf(pick.range), sorted = [...pick.box].sort((a, b) => /** @type {number} */ (a[k]) - /** @type {number} */ (b[k])), mid = sorted.length >> 1
    boxes.splice(pick.i, 1, sorted.slice(0, mid), sorted.slice(mid))
  }
  return boxes.filter(b => b.length).map(box => [0, 1, 2].map(k => Math.round(box.reduce((t, p) => t + /** @type {number} */ (p[k]), 0) / box.length)))
}

/**
 * A Codex pet as a pack of ours. `meta` is its pet.json, `sheet` its sprite sheet read, `credits` who made it and under which licence.
 * @param {{ meta: any, sheet: Image, credits?: { author?: string, license?: string, source?: string }, size?: [number, number], colours?: number }} pet
 * @returns {{ pack: any, id: string, taken: Record<string, number> }} the pack, the animal's name in it, and how many frames each state took
 */
export function convert({ meta, sheet, credits = {}, size = DEFAULTS.size, colours = DEFAULTS.colours }) {
  const [W, H] = size
  if (sheet.width !== CELL.w * CELL.columns || sheet.height % CELL.h || sheet.height / CELL.h < 9) throw new Error(`the sheet is ${sheet.width}x${sheet.height}: a Codex sheet is ${CELL.w * CELL.columns} wide and 1872 or 2288 tall (cells of ${CELL.w}x${CELL.h})`)
  if (!(W >= 8 && W <= LIMITS.side && H >= 8 && H <= LIMITS.side && W % 2 === 0 && H % 2 === 0)) throw new Error(`the size is even numbers from 8 to ${LIMITS.side}, as 20x22`)
  const alpha = (/** @type {number} */ x, /** @type {number} */ y) => /** @type {number} */ (sheet.rgba[(y * sheet.width + x) * 4 + 3])
  /** The cells of a row that hold something. */
  const cells = (/** @type {{ row: number, n: number }} */ r) => Array.from({ length: r.n }, (_, c) => ({ x: c * CELL.w, y: r.row * CELL.h })).filter(c => { for (let y = 0; y < CELL.h; y += 4) for (let x = 0; x < CELL.w; x += 4) if (alpha(c.x + x, c.y + y) > 32) return true; return false })
  // happy is the wave, which stays where the pet stands; a pet with no wave jumps, and its jump may leave the frame at the top
  const idle = cells(ROWS.idle), glad = cells(ROWS.waving).length ? cells(ROWS.waving) : cells(ROWS.jumping), waiting = cells(ROWS.waiting)
  if (!idle.length) throw new Error('the first row of the sheet (idle) is empty: nothing to draw')
  // one frame for every cell we use, all cut and reduced the same way, so the pet does not jump between them
  // The window is the one the pet takes standing still and waiting, so that it fills our small grid
  const used = [...idle, ...glad, ...waiting]
  let x0 = CELL.w, y0 = CELL.h, x1 = 0, y1 = 0
  for (const c of [...idle, ...waiting]) for (let y = 0; y < CELL.h; y++) for (let x = 0; x < CELL.w; x++) if (alpha(c.x + x, c.y + y) > 32) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, scale = Math.min(W / bw, H / bh)
  const ow = Math.max(1, Math.min(W, Math.round(bw * scale))), oh = Math.max(1, Math.min(H, Math.round(bh * scale))), left = (W - ow) >> 1, top = H - oh // centred, standing on the ground
  /**
   * One cell reduced: for each pixel of ours its colour, or null where it is clear. Not the average of what it covers, which
   * turns a detailed drawing to a pale blur: the colour most of it has, with the dark ones (eyes, outlines) counted for more
   * so that they are not lost, then the average of that colour's own pixels.
   */
  const reduce = (/** @type {{ x: number, y: number }} */ c) => Array.from({ length: H }, (_, ty) => Array.from({ length: W }, (_, tx) => {
    if (tx < left || tx >= left + ow || ty < top) return null
    const sx0 = Math.floor(x0 + (tx - left) * bw / ow), sx1 = Math.max(sx0 + 1, Math.ceil(x0 + (tx - left + 1) * bw / ow)), sy0 = Math.floor(y0 + (ty - top) * bh / oh), sy1 = Math.max(sy0 + 1, Math.ceil(y0 + (ty - top + 1) * bh / oh))
    /** @type {Map<number, number[]>} */ const kinds = new Map()
    let solid = 0, n = 0
    for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++, n++) {
      if (x >= CELL.w || y >= CELL.h || x < 0 || y < 0) continue
      const at = ((c.y + y) * sheet.width + c.x + x) * 4, al = /** @type {number} */ (sheet.rgba[at + 3]) / 255
      if (al < 0.5) continue
      const r = /** @type {number} */ (sheet.rgba[at]), g = /** @type {number} */ (sheet.rgba[at + 1]), b = /** @type {number} */ (sheet.rgba[at + 2])
      const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5), k = kinds.get(key) ?? [0, 0, 0, 0, 0]
      k[0] = /** @type {number} */ (k[0]) + r; k[1] = /** @type {number} */ (k[1]) + g; k[2] = /** @type {number} */ (k[2]) + b; k[3] = /** @type {number} */ (k[3]) + 1
      k[4] = /** @type {number} */ (k[4]) + (0.299 * r + 0.587 * g + 0.114 * b < DARK ? DARK_WEIGHT : 1)
      kinds.set(key, k); solid++
    }
    if (solid / n < SOLID) return null
    const [r, g, b, count] = /** @type {number[]} */ ([...kinds.values()].sort((p, q) => /** @type {number} */ (q[4]) - /** @type {number} */ (p[4]))[0])
    return [r, g, b].map(v => Math.round(/** @type {number} */ (v) / /** @type {number} */ (count)))
  }))
  const reduced = new Map(used.map(c => [c, reduce(c)]))
  // the palette: the colour keys an animal may use (one letter or digit, none of the shared ones), as many as asked
  const keys = [...'ABCDEFGHIJLNOPQTUVXYZabcdefgjlmopstz0123456789'].filter(k => !Object.hasOwn(zoo.common, k)).slice(0, Math.max(2, Math.min(colours, LIMITS.colours)))
  const tones = palette([...reduced.values()].flat(2).filter(p => p !== null), keys.length)
  const nearest = (/** @type {number[]} */ p) => { let best = 0, d = Infinity; tones.forEach((t, i) => { const e = 2 * (/** @type {number} */ (t[0]) - /** @type {number} */ (p[0])) ** 2 + 4 * (/** @type {number} */ (t[1]) - /** @type {number} */ (p[1])) ** 2 + 3 * (/** @type {number} */ (t[2]) - /** @type {number} */ (p[2])) ** 2; if (e < d) { d = e; best = i } }); return /** @type {string} */ (keys[best]) }
  const frame = (/** @type {{ x: number, y: number }} */ c) => /** @type {(number[] | null)[][]} */ (reduced.get(c)).map(row => row.map(p => p ? nearest(p) : '.').join(''))
  const differ = (/** @type {string[][]} */ list) => list.filter((f, i) => !i || f.join() !== /** @type {string[]} */ (list[i - 1]).join()) // a frame equal to the one before adds nothing
  const still = idle.map(frame), first = /** @type {string[]} */ (still[0])
  // the idle frame least like the first: shown now and then, as the blink of our own animals is
  const far = (/** @type {string[]} */ f) => f.join('').split('').filter((ch, i) => ch !== first.join('')[i]).length
  const other = still.slice(1).sort((a, b) => far(b) - far(a))[0]
  const loop = differ(still.slice(1)).slice(0, LIMITS.gestureFrames)
  const happy = differ(glad.map(frame)).slice(0, LIMITS.frames), asleep = differ(waiting.filter((_, i) => i % 3 === 0).map(frame))
  const slug = (/** @type {unknown} */ raw) => tidy(String(raw ?? '')).toLowerCase().split('--')[0]?.replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 18).replace(/-+$/, '') ?? ''
  const id = slug(meta?.id) || slug(meta?.displayName) || 'pet'
  if (id.length < 2) throw new Error('the pet has no usable id or name')
  const name = tidy(meta?.displayName, LIMITS.name) || id
  const told = Object.fromEntries(Object.entries(credits).flatMap(([k, v]) => { const t = tidy(v, LIMITS.credit); return t ? [[k, t]] : [] }))
  const pack = {
    format: 1, id: `codex-${id}`, name,
    credits: { author: 'not declared', license: 'not declared', ...told },
    animals: { [id]: {
      name: { en: name }, size: [W, H],
      palette: Object.fromEntries(tones.map((t, i) => [keys[i], `#${t.map(v => v.toString(16).padStart(2, '0')).join('')}`])),
      states: {
        adult: { frames: [first], ...(other && far(other) ? { rare: [other] } : null), ...(loop.length ? { idle: { loop: { frames: loop } } } : null) },
        ...(happy.length ? { cheer: { frames: happy } } : null),
        ...(asleep.length ? { sleep: { frames: asleep } } : null),
      },
    } },
  }
  return { pack, id, taken: { still: 1 + loop.length, happy: happy.length, asleep: asleep.length } }
}

/**
 * A file of the pet, looked at before it is opened and without following a link: a regular file of at most `max` bytes that is
 * in the pet's own folder. A link is refused (it may lead anywhere on the disk), and so is a device or a pipe (reading /dev/zero
 * never ends, a pipe waits for ever), and a path through a linked folder that comes out elsewhere.
 * @param {string} file @param {string} dir @param {number} max @param {string} what
 */
function plain(file, dir, max, what) {
  const s = lstatSync(file)
  if (!s.isFile()) throw new Error(`${what} is not a regular file (a link, a folder, a device or a pipe is not read)`)
  if (s.size > max) throw new Error(`${what} is over ${max >= 1024 * 1024 ? `${max / 1024 / 1024} MiB` : `${max / 1024} KiB`}`)
  const home = realpathSync(dir), real = realpathSync(file)
  if (!real.startsWith(home.endsWith(sep) ? home : home + sep)) throw new Error(`${what} is outside the pet's own folder`)
  return file
}

/** A Codex pet read from the person's disk: the folder, or the pet.json in it. Only those files are opened. @param {string} where */
export function read(where) {
  const dir = statSync(where).isDirectory() ? where : dirname(where)
  const file = ['pet.json', 'avatar.json'].map(n => join(dir, n)).find(existsSync)
  if (!file) throw new Error(`no pet.json in ${dir}`)
  /** @type {any} */ let meta
  try { meta = JSON.parse(readFileSync(plain(file, dir, NOTE_MAX, basename(file)), 'utf8')) } catch (e) { throw e instanceof SyntaxError ? new Error(`${basename(file)} is not JSON (${tidy(e.message, 80)})`) : e } // the message quotes the file's text
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('pet.json is not an object')
  // the sheet named by the pet, inside its own folder and nowhere else; spritesheet.webp when it names none
  const named = typeof meta.spritesheetPath === 'string' ? meta.spritesheetPath : 'spritesheet.webp', sheet = resolve(dir, named)
  if (isAbsolute(named) || relative(dir, sheet).startsWith('..')) throw new Error('the pet names a sheet outside its own folder')
  const at = [sheet, join(dir, 'spritesheet.png')].find(existsSync)
  if (!at) throw new Error(`no sprite sheet in ${dir} (${tidy(basename(named), 64)})`)
  plain(at, dir, SHEET_MAX, 'the sheet')
  // a gallery's own note beside the pet (legeling/awesome-codex-pet keeps one): who made it, under which licence, from where
  const note = join(dir, 'submission.json')
  /** @type {any} */ let sub = null
  try { if (existsSync(note)) sub = JSON.parse(readFileSync(plain(note, dir, NOTE_MAX, 'submission.json'), 'utf8')) } catch { sub = null } // a note that is not sound is no note
  const text = (/** @type {unknown} */ v) => typeof v === 'string' ? v : undefined
  return { meta, sheet: decode(readFileSync(at)), credits: { author: text(sub?.author), license: text(sub?.license), source: text(sub?.source_url) } }
}

/** The folder the mod reads packs from. */
export const skinsDir = () => join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'cachito-skins')

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const opt = (/** @type {string} */ name) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args.splice(i, 2)[1] }
  const size = opt('size'), colours = opt('colours'), out = opt('out') ?? skinsDir(), author = opt('author'), license = opt('license'), source = opt('source')
  const where = args[0]
  if (!where || args.length > 1 || args[0]?.startsWith('--')) {
    console.error('usage: npm run skin:import <folder of a Codex pet | its pet.json> [--size 20x22] [--colours 16] [--author <name>] [--license <licence>] [--source <url>] [--out <folder>]')
    process.exit(2)
  }
  try {
    const pet = read(where)
    const dims = size ? /** @type {[number, number]} */ (size.split('x').map(Number)) : DEFAULTS.size
    const { pack, id, taken } = convert({ ...pet, credits: { ...pet.credits, ...(author && { author }), ...(license && { license }), ...(source && { source }) }, size: dims, colours: colours ? Number(colours) : DEFAULTS.colours })
    const errors = validate(pack, { taken: [...Object.keys(BUILTIN.species), ...Object.keys(BUILTIN.items), ...Object.keys(BUILTIN.coats)] })
    if (errors.length) throw new Error(`the pack made is not sound:\n  ${errors.join('\n  ')}`)
    const file = join(out, `${pack.id}.json`)
    // never over a file that is something else: only over an earlier import of the same pet
    if (existsSync(file)) { let was; try { was = JSON.parse(readFileSync(file, 'utf8')) } catch { was = null } if (was?.id !== pack.id) throw new Error(`${file} is there already and is not this pack: move it first`) }
    mkdirSync(out, { recursive: true })
    writeFileSync(file, `${JSON.stringify(pack, null, 1)}\n`)
    const [w, h] = dims
    console.log([
      `${file}: written. Pack "${pack.name}" (${pack.id}), animal ${id}.`,
      `  drawn at ${w}x${h} pixels with ${Object.keys(pack.animals[id].palette).length} colours: in the band ${w} columns by ${h / 2} rows of text, ${w + 2} by ${(h + 2) / 2} with a thing on (the shipped animals take 12 by 5, 14 by 6 with a thing on).`,
      `  frames: still ${taken.still}, happy ${taken.happy}, asleep ${taken.asleep}${taken.asleep ? ' (a Codex pet has no sleep: its "waiting" row is used)' : ''}.`,
      `  author: ${pack.credits.author}; license: ${pack.credits.license}${pack.credits.source ? `; source: ${pack.credits.source}` : ''}`,
      ...(pack.credits.license === 'not declared' ? ['  The licence is not declared in the pet\'s files: check it where you got the pet before you share the pack, and name it with --license.'] : []),
      `In Claude Code: /pet skins, then /pet animal ${id}.`,
    ].join('\n'))
  } catch (e) {
    // what went wrong may quote the pet's files: each line made safe to show
    console.error(`skin:import: ${String(/** @type {any} */ (e)?.message ?? e).split('\n').map(l => tidy(l, 400)).filter(Boolean).join('\n  ')}`)
    process.exit(1)
  }
}
