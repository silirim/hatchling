// @ts-check
// Reads the two kinds of image a Codex pet's sprite sheet may be: PNG, and lossless WebP (VP8L). Plain JavaScript and Node's own
// zlib, no dependency: the importer (engine/skin-import.js) runs on a machine with nothing installed. The mod never loads this file.
// A lossy WebP (VP8) is not read: it is said, and converting the sheet to PNG first is the way.
// The WebP reader follows the "WebP Lossless Bitstream Specification" (developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification).

import { inflateSync } from 'node:zlib'

/** @typedef {{ width: number, height: number, rgba: Uint8Array }} Image eight bits a channel, rows from the top, red green blue alpha */

const MAX_SIDE = 4096 // a sheet is 1536 by 1872 or 2288: nothing near this is one
const MAX_GROUPS = 4096 // groups of codes in one image: an encoder makes at most 2600, a file may claim 65,536 and five tables for each

/** An image from the bytes of its file. Throws an Error that says what is wrong. @param {Uint8Array} bytes @returns {Image} */
export function decode(bytes) {
  const tag = (/** @type {number} */ at, /** @type {number} */ n) => String.fromCharCode(...bytes.subarray(at, at + n))
  if (tag(1, 3) === 'PNG') return png(bytes)
  if (tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') return webp(bytes)
  throw new Error('not a PNG nor a WebP image')
}

// ---- PNG ----

/** @param {Uint8Array} b @returns {Image} */
function png(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let at = 8, width = 0, height = 0, depth = 0, kind = 0, lace = 0
  /** @type {Uint8Array[]} */ const data = []
  /** @type {Uint8Array | null} */ let palette = null
  /** @type {Uint8Array | null} */ let clear = null
  while (at + 8 <= b.length) {
    const n = view.getUint32(at), type = String.fromCharCode(...b.subarray(at + 4, at + 8)), body = b.subarray(at + 8, at + 8 + n)
    if (type === 'IHDR') { width = view.getUint32(at + 8); height = view.getUint32(at + 12); depth = /** @type {number} */ (body[8]); kind = /** @type {number} */ (body[9]); lace = /** @type {number} */ (body[12]) }
    else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') clear = body
    else if (type === 'IDAT') data.push(body)
    else if (type === 'IEND') break
    at += 12 + n
  }
  if (!width || !height || width > MAX_SIDE || height > MAX_SIDE) throw new Error('PNG: no size, or one too large')
  if (depth !== 8 || lace) throw new Error('PNG: only 8 bits a channel, not interlaced, is read')
  const channels = /** @type {Record<number, number>} */ ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[kind]
  if (!channels) throw new Error('PNG: colour type not read')
  const raw = inflateSync(Buffer.concat(data), { maxOutputLength: (width * channels + 1) * height + 16 }), line = width * channels
  const px = new Uint8Array(line * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (line + 1)], from = y * (line + 1) + 1, to = y * line
    for (let x = 0; x < line; x++) {
      const a = x >= channels ? /** @type {number} */ (px[to + x - channels]) : 0, up = y ? /** @type {number} */ (px[to + x - line]) : 0, c = x >= channels && y ? /** @type {number} */ (px[to + x - line - channels]) : 0
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c)
      const guess = filter === 1 ? a : filter === 2 ? up : filter === 3 ? (a + up) >> 1 : filter === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? up : c) : 0
      px[to + x] = /** @type {number} */ (raw[from + x]) + guess
    }
  }
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const s = i * channels, v = /** @type {number} */ (px[s])
    const [r, g, bl, al] = kind === 6 ? [v, px[s + 1], px[s + 2], px[s + 3]] : kind === 2 ? [v, px[s + 1], px[s + 2], 255] : kind === 4 ? [v, v, v, px[s + 1]] : kind === 0 ? [v, v, v, 255]
      : [palette?.[v * 3] ?? 0, palette?.[v * 3 + 1] ?? 0, palette?.[v * 3 + 2] ?? 0, clear && v < clear.length ? clear[v] : 255]
    rgba.set([r ?? 0, g ?? 0, bl ?? 0, al ?? 255], i * 4)
  }
  return { width, height, rgba }
}

// ---- WebP, lossless ----

/** @param {Uint8Array} b @returns {Image} */
function webp(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  for (let at = 12; at + 8 <= b.length;) {
    const type = String.fromCharCode(...b.subarray(at, at + 4)), n = view.getUint32(at + 4, true)
    if (type === 'VP8L') return vp8l(b.subarray(at + 8, at + 8 + n))
    if (type === 'VP8 ') throw new Error('a lossy WebP is not read: convert the sheet to PNG first (the importer reads PNG and lossless WebP)')
    if (type === 'ANIM') throw new Error('an animated WebP is not a sprite sheet')
    at += 8 + n + (n & 1)
  }
  throw new Error('WebP: no image data found')
}

/** Bits from a byte stream, the lowest first. */
class Bits {
  /** @param {Uint8Array} b */
  constructor(b) { this.b = b; this.at = 0; this.bit = 0 }
  /** @param {number} n at most 25 @returns {number} */
  read(n) {
    let v = 0
    for (let i = 0; i < n; i++) {
      if (this.at >= this.b.length) throw new Error('WebP: the data ends early')
      v |= ((/** @type {number} */ (this.b[this.at]) >> this.bit) & 1) << i
      if (++this.bit === 8) { this.bit = 0; this.at++ }
    }
    return v >>> 0
  }
}

/** A prefix code from the length of each symbol's code: read a bit at a time, the canonical way. */
class Code {
  /** @param {ArrayLike<number>} lengths */
  constructor(lengths) {
    const count = new Uint16Array(16)
    for (let i = 0; i < lengths.length; i++) { const l = /** @type {number} */ (lengths[i]); count[l] = /** @type {number} */ (count[l]) + 1 }
    count[0] = 0
    this.count = count
    const first = new Uint16Array(17)
    for (let l = 1; l < 16; l++) first[l + 1] = /** @type {number} */ (first[l]) + /** @type {number} */ (count[l])
    this.symbols = new Uint16Array(lengths.length)
    const next = first.slice()
    for (let s = 0; s < lengths.length; s++) { const l = /** @type {number} */ (lengths[s]); if (l) { const at = /** @type {number} */ (next[l]); this.symbols[at] = s; next[l] = at + 1 } }
    const used = /** @type {number} */ (first[16])
    // a code with one symbol takes no bits; one with none reads as symbol 0
    this.only = used <= 1 ? (used ? /** @type {number} */ (this.symbols[0]) : 0) : -1
  }
  /** @param {Bits} r @returns {number} */
  read(r) {
    if (this.only >= 0) return this.only
    let code = 0, first = 0, index = 0
    for (let l = 1; l < 16; l++) {
      code |= r.read(1)
      const n = /** @type {number} */ (this.count[l])
      if (code - n < first) return /** @type {number} */ (this.symbols[index + (code - first)])
      index += n; first = (first + n) << 1; code <<= 1
    }
    throw new Error('WebP: a code that is not one')
  }
}

const ORDER = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
/** @param {Bits} r @param {number} size the alphabet's @returns {Code} */
function readCode(r, size) {
  const lengths = new Uint8Array(size)
  if (r.read(1)) { // simple: one or two symbols
    const two = r.read(1), first = r.read(r.read(1) ? 8 : 1)
    if (first < size) lengths[first] = 1
    if (two) { const second = r.read(8); if (second < size) lengths[second] = 1 }
    return new Code(lengths)
  }
  const meta = new Uint8Array(19), n = 4 + r.read(4)
  for (let i = 0; i < n; i++) meta[/** @type {number} */ (ORDER[i])] = r.read(3)
  const by = new Code(meta)
  let left = size
  if (r.read(1)) { left = 2 + r.read(2 + 2 * r.read(3)); if (left > size) throw new Error('WebP: more codes than symbols') }
  for (let s = 0, prev = 8; s < size && left-- > 0;) {
    const c = by.read(r)
    if (c < 16) { lengths[s++] = c; if (c) prev = c; continue }
    const times = c === 16 ? 3 + r.read(2) : c === 17 ? 3 + r.read(3) : 11 + r.read(7), fill = c === 16 ? prev : 0
    if (s + times > size) throw new Error('WebP: a run past the last symbol')
    lengths.fill(fill, s, s + times); s += times
  }
  return new Code(lengths)
}

// where a short distance code points: so many pixels left (8 - low half) and rows up (high half)
const NEAR = [0x18, 0x07, 0x17, 0x19, 0x28, 0x06, 0x27, 0x29, 0x16, 0x1a, 0x26, 0x2a, 0x38, 0x05, 0x37, 0x39, 0x15, 0x1b, 0x36, 0x3a, 0x25, 0x2b, 0x48, 0x04, 0x47, 0x49, 0x14, 0x1c, 0x35, 0x3b, 0x46, 0x4a, 0x24, 0x2c, 0x58, 0x45, 0x4b, 0x34, 0x3c, 0x03, 0x57, 0x59, 0x13, 0x1d, 0x56, 0x5a, 0x23, 0x2d, 0x44, 0x4c, 0x55, 0x5b, 0x33, 0x3d, 0x68, 0x02, 0x67, 0x69, 0x12, 0x1e, 0x66, 0x6a, 0x22, 0x2e, 0x54, 0x5c, 0x43, 0x4d, 0x65, 0x6b, 0x32, 0x3e, 0x78, 0x01, 0x77, 0x79, 0x53, 0x5d, 0x11, 0x1f, 0x64, 0x6c, 0x42, 0x4e, 0x76, 0x7a, 0x21, 0x2f, 0x75, 0x7b, 0x31, 0x3f, 0x63, 0x6d, 0x52, 0x5e, 0x00, 0x74, 0x7c, 0x41, 0x4f, 0x10, 0x20, 0x62, 0x6e, 0x30, 0x73, 0x7d, 0x51, 0x5f, 0x40, 0x72, 0x7e, 0x61, 0x6f, 0x50, 0x71, 0x7f, 0x60, 0x70]

const up = (/** @type {number} */ n, /** @type {number} */ bits) => (n + (1 << bits) - 1) >> bits

/**
 * One coded image: the pixels as 32-bit alpha red green blue. The main image (`top`) may use several groups of codes, picked by
 * a smaller image; the small images inside it (of a transform, of the groups) use one.
 * @param {Bits} r @param {number} w @param {number} h @param {boolean} top @returns {Uint32Array}
 */
function pixels(r, w, h, top) {
  const cacheBits = r.read(1) ? r.read(4) : 0
  if (cacheBits > 11) throw new Error('WebP: a colour cache too large')
  const cache = cacheBits ? new Uint32Array(1 << cacheBits) : null
  let groupBits = 0, groupW = 0
  /** @type {Uint32Array | null} */ let groupOf = null
  if (top && r.read(1)) { groupBits = r.read(3) + 2; groupW = up(w, groupBits); groupOf = pixels(r, groupW, up(h, groupBits), false) }
  let groups = 1
  if (groupOf) for (let i = 0; i < groupOf.length; i++) { const g = (/** @type {number} */ (groupOf[i]) >> 8) & 0xffff; groupOf[i] = g; if (g >= groups) groups = g + 1 }
  if (groups > MAX_GROUPS) throw new Error('WebP: too many groups of codes')
  /** @type {Code[][]} */ const codes = []
  for (let g = 0; g < groups; g++) codes.push([256 + 24 + (cache ? cache.length : 0), 256, 256, 256, 40].map(size => readCode(r, size)))
  const out = new Uint32Array(w * h), extra = (/** @type {number} */ p) => { if (p < 4) return p + 1; const n = (p - 2) >> 1; return ((2 + (p & 1)) << n) + r.read(n) + 1 }
  const keep = (/** @type {number} */ c) => { if (cache) cache[(Math.imul(c, 0x1e35a7bd) >>> (32 - cacheBits))] = c }
  for (let at = 0, x = 0, y = 0; at < out.length;) {
    const set = /** @type {Code[]} */ (codes[groupOf ? /** @type {number} */ (groupOf[(y >> groupBits) * groupW + (x >> groupBits)]) : 0])
    const s = /** @type {Code} */ (set[0]).read(r)
    if (s < 256) {
      const red = /** @type {Code} */ (set[1]).read(r), blue = /** @type {Code} */ (set[2]).read(r), alpha = /** @type {Code} */ (set[3]).read(r)
      const c = ((alpha << 24) | (red << 16) | (s << 8) | blue) >>> 0
      out[at++] = c; keep(c)
      if (++x === w) { x = 0; y++ }
    } else if (s < 280) {
      const length = extra(s - 256), d = extra(/** @type {Code} */ (set[4]).read(r))
      const near = d <= 120 ? /** @type {number} */ (NEAR[d - 1]) : -1, dist = near < 0 ? d - 120 : Math.max(1, (near >> 4) * w + 8 - (near & 15))
      if (dist > at || at + length > out.length) throw new Error('WebP: a copy from outside the image')
      for (let i = 0; i < length; i++, at++) { const c = /** @type {number} */ (out[at - dist]); out[at] = c; keep(c) }
      x += length; y += Math.floor(x / w); x %= w
    } else {
      if (!cache || s - 280 >= cache.length) throw new Error('WebP: a colour from a cache that is not there')
      out[at++] = /** @type {number} */ (cache[s - 280])
      if (++x === w) { x = 0; y++ }
    }
  }
  return out
}

/** @param {Uint8Array} b @returns {Image} */
function vp8l(b) {
  const r = new Bits(b)
  if (r.read(8) !== 0x2f) throw new Error('WebP: not a lossless image')
  const width = r.read(14) + 1, height = r.read(14) + 1
  r.read(1) // whether alpha is used: the pixels say it themselves
  if (r.read(3)) throw new Error('WebP: a version this reader does not know')
  if (width > MAX_SIDE || height > MAX_SIDE) throw new Error('WebP: an image too large')
  /** @type {{ type: number, bits: number, data: Uint32Array, w: number }[]} */ const steps = []
  let w = width
  while (r.read(1)) {
    const type = r.read(2)
    if (steps.some(s => s.type === type)) throw new Error('WebP: a transform given twice')
    if (type === 0 || type === 1) { const bits = r.read(3) + 2; steps.push({ type, bits, data: pixels(r, up(w, bits), up(height, bits), false), w }) }
    else if (type === 2) steps.push({ type, bits: 0, data: new Uint32Array(0), w })
    else {
      const size = r.read(8) + 1, table = pixels(r, size, 1, false), bits = size <= 2 ? 3 : size <= 4 ? 2 : size <= 16 ? 1 : 0
      for (let i = 1; i < size; i++) { const a = /** @type {number} */ (table[i]), p = /** @type {number} */ (table[i - 1]); table[i] = (((a >>> 24) + (p >>> 24)) << 24 | (((a >> 16) + (p >> 16)) & 255) << 16 | (((a >> 8) + (p >> 8)) & 255) << 8 | ((a + p) & 255)) >>> 0 }
      steps.push({ type, bits, data: table, w })
      w = up(w, bits)
    }
  }
  let px = pixels(r, w, height, true)
  for (const s of steps.reverse()) px = undo(s, px, height)
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) { const c = /** @type {number} */ (px[i]); rgba[i * 4] = (c >> 16) & 255; rgba[i * 4 + 1] = (c >> 8) & 255; rgba[i * 4 + 2] = c & 255; rgba[i * 4 + 3] = c >>> 24 }
  return { width, height, rgba }
}

/** Two pixels added, or averaged, channel by channel. */
const add = (/** @type {number} */ a, /** @type {number} */ b) => ((((a & 0xff00ff00) >>> 0) + ((b & 0xff00ff00) >>> 0)) & 0xff00ff00 | ((a & 0x00ff00ff) + (b & 0x00ff00ff)) & 0x00ff00ff) >>> 0
const avg = (/** @type {number} */ a, /** @type {number} */ b) => ((((a ^ b) & 0xfefefefe) >>> 1) + (a & b)) >>> 0
const ch = (/** @type {number} */ c, /** @type {number} */ shift) => (c >>> shift) & 255
const clip = (/** @type {number} */ v) => v < 0 ? 0 : v > 255 ? 255 : v
const each = (/** @type {(shift: number) => number} */ f) => ((f(24) << 24) | (f(16) << 16) | (f(8) << 8) | f(0)) >>> 0

/** One transform taken back. @param {{ type: number, bits: number, data: Uint32Array, w: number }} s @param {Uint32Array} px @param {number} h @returns {Uint32Array} */
function undo(s, px, h) {
  const w = s.w, blockW = up(w, s.bits)
  if (s.type === 2) { for (let i = 0; i < px.length; i++) { const c = /** @type {number} */ (px[i]), g = (c >> 8) & 255; px[i] = ((c & 0xff00ff00) | ((((c >> 16) & 255) + g) & 255) << 16 | ((c & 255) + g) & 255) >>> 0 } return px }
  if (s.type === 3) {
    const out = new Uint32Array(w * h), per = 8 >> s.bits, packed = up(w, s.bits), mask = (1 << per) - 1
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = (/** @type {number} */ (px[y * packed + (x >> s.bits)]) >> 8) & 255, i = s.bits ? (g >> ((x & ((1 << s.bits) - 1)) * per)) & mask : g
      out[y * w + x] = i < s.data.length ? /** @type {number} */ (s.data[i]) : 0
    }
    return out
  }
  if (s.type === 1) {
    const int8 = (/** @type {number} */ v) => (v << 24) >> 24, delta = (/** @type {number} */ t, /** @type {number} */ c) => (int8(t) * int8(c)) >> 5
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const m = /** @type {number} */ (s.data[(y >> s.bits) * blockW + (x >> s.bits)]), c = /** @type {number} */ (px[y * w + x]), g = (c >> 8) & 255
      const red = (((c >> 16) & 255) + delta(m & 255, g)) & 255, blue = ((c & 255) + delta((m >> 8) & 255, g) + delta((m >> 16) & 255, red)) & 255
      px[y * w + x] = ((c & 0xff00ff00) | red << 16 | blue) >>> 0
    }
    return px
  }
  // the predictor: each pixel was kept as its difference from a guess made of the pixels to its left and above
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    let guess = 0xff000000
    if (y === 0) { if (x) guess = /** @type {number} */ (px[i - 1]) }
    else if (x === 0) guess = /** @type {number} */ (px[i - w])
    else {
      const L = /** @type {number} */ (px[i - 1]), T = /** @type {number} */ (px[i - w]), TL = /** @type {number} */ (px[i - w - 1]), TR = /** @type {number} */ (px[i - w + 1])
      switch ((/** @type {number} */ (s.data[(y >> s.bits) * blockW + (x >> s.bits)]) >> 8) & 255) {
        case 0: break
        case 1: guess = L; break
        case 2: guess = T; break
        case 3: guess = TR; break
        case 4: guess = TL; break
        case 5: guess = avg(avg(L, TR), T); break
        case 6: guess = avg(L, TL); break
        case 7: guess = avg(L, T); break
        case 8: guess = avg(TL, T); break
        case 9: guess = avg(T, TR); break
        case 10: guess = avg(avg(L, TL), avg(T, TR)); break
        case 11: { let toL = 0, toT = 0; for (const sh of [24, 16, 8, 0]) { toL += Math.abs(ch(T, sh) - ch(TL, sh)); toT += Math.abs(ch(L, sh) - ch(TL, sh)) } guess = toL < toT ? L : T; break }
        case 12: guess = each(sh => clip(ch(L, sh) + ch(T, sh) - ch(TL, sh))); break
        case 13: { const a = avg(L, T); guess = each(sh => clip(ch(a, sh) + Math.trunc((ch(a, sh) - ch(TL, sh)) / 2))); break }
        default: break
      }
    }
    px[i] = add(/** @type {number} */ (px[i]), guess)
  }
  return px
}
