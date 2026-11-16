#!/usr/bin/env node
// @ts-check
// Writes the pictures of README.md into assets/: animals.png, shop.png, coats.png, share.png and the small briefox.png. Each is drawn from the plugin's own
// sprites, prices and code (share.png is the picture of /pet share itself), on the cover's ground with rounded corners.
//
//   node sprites/readme.mjs

import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { RULES, SHOP, COATS } from '../engine/engine.js'
import { portrait } from '../engine/skins.js'
import { FONT, shareLines, picture } from '../engine/share.js'
import { text as say } from '../engine/lang/index.js'

const NIGHT = '#1e1e2e', FLOOR = '#27273a', EDGE = '#8d4325', SAND = '#efe9dc', STAR = '#ffd54f', SHADE = '#34344a' // sprites/cover.py; SHADE is the hidden slot
const WIDTH = 1200, PAD = 40, RADIUS = 24, FLOOR_H = 6

// What each picture shows. The animals are the ones the shop sells (RULES.animals): the rare one is in none of these lists.
export const ANIMALS = RULES.animals
export const WORN = [ // a thing, and the animal that wears it
  ['shades', 'penguin'], ['mug', 'chick'], ['balloon', 'dog'], ['scarf', 'bunny'], ['headphones', 'fox'], ['sombrero', 'cactus'],
  ['wizard', 'penguin'], ['hoodie', 'bunny'], ['skateboard', 'fox'], ['backpack', 'chick'], ['laptop', 'cactus'], ['partyhat', 'dog'],
].map(([item, animal]) => ({ item: String(item), animal: String(animal) }))
export const COATED = 'fox'
// the pet of share.png: made up, with nothing of anyone's work
export const SHARED = { name: 'Nube', animal: 'dog', stage: 'adult', peak: 'calm', stars: 86, worn: ['cap', 'scarf', 'duck'] }
export const FILES = ['animals.png', 'shop.png', 'coats.png', 'share.png']
export const MASCOT = 'briefox.png' // the fox of the pet, as the mascot of the briefox plugin: a small picture, not one of the wide ones

/** A picture being drawn: one byte a pixel, an index into `colours`; index 0 is see-through. @param {number} w @param {number} h */
function canvas(w, h) {
  const colours = ['', NIGHT], px = new Uint8Array(w * h).fill(1)
  const index = (/** @type {string} */ hex) => { const at = colours.indexOf(hex); return at < 0 ? colours.push(hex) - 1 : at }
  const rect = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ bw, /** @type {number} */ bh, /** @type {string} */ hex) => {
    const c = index(hex)
    for (let r = Math.max(0, y); r < Math.min(h, y + bh); r++) px.fill(c, r * w + Math.max(0, x), r * w + Math.max(0, Math.min(w, x + bw)))
  }
  const width = (/** @type {string} */ s, /** @type {number} */ k) => ([...s].length * 6 - 1) * k
  /** A line in the pixel font, centred on `cx`; a star is drawn in gold. */
  const text = (/** @type {string} */ s, /** @type {number} */ cx, /** @type {number} */ y, /** @type {number} */ k, hex = SAND) => {
    const x = Math.round(cx - width(s, k) / 2)
    ;[...s].forEach((ch, i) => (FONT[ch] ?? '').split('/').forEach((row, r) => [...row].forEach((bit, c) => { if (bit === '#') rect(x + (i * 6 + c) * k, y + r * k, k, k, ch === '★' ? STAR : hex) })))
  }
  /** A pet with its empty rows and columns cut, centred on `cx`, its feet on `bottom`. With `hex`, its shape in that one colour. */
  const pet = (/** @type {{ rows: string[], palette: Record<string, string> }} */ { rows, palette }, /** @type {number} */ cx, /** @type {number} */ bottom, /** @type {number} */ k, hex = '') => {
    const full = rows.filter((_, y) => rows.slice(0, y + 1).some(r => /[^.]/.test(r)) && rows.slice(y).some(r => /[^.]/.test(r)))
    const xs = full.flatMap(r => [...r].flatMap((ch, x) => ch === '.' ? [] : [x])), x0 = Math.min(...xs), wide = Math.max(...xs) - x0 + 1
    const left = Math.round(cx - wide * k / 2)
    full.forEach((r, y) => [...r].forEach((ch, x) => { const c = hex || palette[ch]; if (ch !== '.' && c) rect(left + (x - x0) * k, bottom - (full.length - y) * k, k, k, c) }))
  }
  const floor = (/** @type {number} */ y) => { rect(0, y, w, FLOOR_H, EDGE); rect(0, y + FLOOR_H, w, h, FLOOR) }
  return { w, h, colours, px, rect, text, pet, floor }
}

/** The file: a PNG with a palette, the corners rounded off to see-through. @param {{ w: number, h: number, colours: string[], px: Uint8Array }} pic */
export function png({ w, h, colours, px }) {
  if (colours.length > 256) throw new Error('more than 256 colours')
  const raw = new Uint8Array((w + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.max(0, RADIUS - x - 0.5, x + 0.5 - (w - RADIUS)), dy = Math.max(0, RADIUS - y - 0.5, y + 0.5 - (h - RADIUS))
    raw[y * (w + 1) + 1 + x] = dx * dx + dy * dy > RADIUS * RADIUS ? 0 : /** @type {number} */ (px[y * w + x])
  }
  const table = new Int32Array(256).map((_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n })
  const chunk = (/** @type {string} */ kind, /** @type {Uint8Array} */ data) => {
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length)
    out.write(kind, 4, 'latin1')
    out.set(data, 8)
    let c = ~0
    for (const v of out.subarray(4, 8 + data.length)) c = /** @type {number} */ (table[(c ^ v) & 255]) ^ (c >>> 8)
    out.writeUInt32BE(~c >>> 0, 8 + data.length)
    return out
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w)
  head.writeUInt32BE(h, 4)
  head.set([8, 3, 0, 0, 0], 8)
  const plte = Uint8Array.from(colours.flatMap(hex => [1, 3, 5].map(i => parseInt((hex || NIGHT).slice(i, i + 2), 16))))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('PLTE', plte), chunk('tRNS', Uint8Array.of(0)), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())])
}

/** The six animals, baby above and adult below, each with its name, and a slot more for the seventh: a question mark and nothing of it. */
export function animals() {
  const K = 10, LEFT = 110, col = (WIDTH - LEFT - PAD) / (ANIMALS.length + 1), baby = PAD + 10 * K, adult = baby + FLOOR_H + 50 + 10 * K
  const c = canvas(WIDTH, adult + FLOOR_H + 64)
  c.rect(0, baby, WIDTH, FLOOR_H, EDGE)
  c.floor(adult)
  c.text('baby', LEFT / 2 + 8, baby - 5 * K - 9, 2)
  c.text('adult', LEFT / 2 + 8, adult - 5 * K - 9, 2)
  const at = (/** @type {number} */ i) => Math.round(LEFT + col * (i + 0.5))
  ANIMALS.forEach((id, i) => {
    c.pet(portrait(id, 'baby', []), at(i), baby, K)
    c.pet(portrait(id, 'adult', []), at(i), adult, K)
    c.text(say('en', `animal.${id}`, {}, id), at(i), adult + FLOOR_H + 20, 3)
  })
  for (const [bottom, k] of [[baby, 8], [adult, 12]]) c.text('?', at(ANIMALS.length), Number(bottom) - 8 * Number(k), Number(k), SHADE)
  c.text('?', at(ANIMALS.length), adult + FLOOR_H + 20, 3)
  return c
}

/** A thing of the shop without its article, as a label. @param {{ name: string }} item */
const label = (item) => item.name.replace(/^(a|an|the) /, '')
const stars = (/** @type {number} */ n) => `★ ${n}`

/** Twelve things of the shop, each on an adult, with its name and its price in stars. */
export function shop() {
  const K = 8, PER = 6, col = (WIDTH - 2 * PAD) / PER, ROW = 236, c = canvas(WIDTH, PAD + ROW * Math.ceil(WORN.length / PER) - 16)
  WORN.forEach(({ item, animal }, i) => {
    const sold = SHOP.find(s => s.id === item)
    if (!sold) throw new Error(`not in the shop: ${item}`)
    const cx = Math.round(PAD + col * (i % PER + 0.5)), ground = PAD + Math.floor(i / PER) * ROW + 136
    c.rect(cx - 80, ground, 160, 4, EDGE)
    c.pet(portrait(animal, 'adult', [item]), cx, ground, K)
    c.text(label(sold), cx, ground + 18, 2)
    c.text(stars(sold.price), cx, ground + 44, 2)
  })
  return c
}

/** One animal in its own colours and in each coat, with the coat's name and price. */
export function coats() {
  const K = 16, all = [{ id: '', name: 'its own colours', price: 0 }, ...COATS], col = (WIDTH - 2 * PAD) / all.length, ground = PAD + 12 * K
  const c = canvas(WIDTH, ground + FLOOR_H + 90)
  c.floor(ground)
  all.forEach((coat, i) => {
    const cx = Math.round(PAD + col * (i + 0.5))
    c.pet(portrait(COATED, 'adult', coat.id ? [coat.id] : []), cx, ground, K)
    c.text(label(coat), cx, ground + FLOOR_H + 20, 3)
    c.text(coat.price ? stars(coat.price) : 'free', cx, ground + FLOOR_H + 54, 2, coat.price ? SAND : '#9a98a8')
  })
  return c
}

/** The picture /pet share makes (engine/share.js `picture`), as the mod calls it, for a made-up pet. */
export function share() {
  const { name, animal, stage, peak, stars: n, worn } = SHARED
  const pic = picture(portrait(animal, stage, worn), shareLines({ name, animal: say('en', `animal.${animal}`, {}, animal), stage: say('en', `stage.${stage}`, {}, stage), peak: say('en', `peak.${peak}`), stars: n }))
  return { w: pic.width, h: pic.height, colours: ['', ...pic.colours], px: pic.px.map(v => v + 1) }
}

/** The mascot of briefox: the pet's own fox, grown, with the plugin's name under it. */
export function briefox() {
  const c = canvas(240, 200), ground = 140
  c.floor(ground)
  c.pet(portrait('fox', 'adult', []), 120, ground, 9)
  c.text('briefox', 120, ground + FLOOR_H + 18, 3)
  return c
}

export const DRAW = /** @type {Record<string, () => { w: number, h: number, colours: string[], px: Uint8Array }>} */ ({ 'animals.png': animals, 'shop.png': shop, 'coats.png': coats, 'share.png': share, [MASCOT]: briefox })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const name of [...FILES, MASCOT]) {
    const pic = /** @type {() => { w: number, h: number, colours: string[], px: Uint8Array }} */ (DRAW[name])(), file = png(pic)
    writeFileSync(new URL(`../assets/${name}`, import.meta.url), file)
    console.log(`assets/${name} ${pic.w}x${pic.h} ${file.length} bytes`)
  }
}
