// @ts-check
// The picture of /pet share: the pet in colour on the cover's ground, a few words about it beside it, as a PNG file's bytes.
// Pure, and no Node: the mod loads this file. The mod cannot write bytes itself ($.fs.write takes text): it hands them to
// engine/share-save.js, and where there is no Node it writes the same picture as an SVG (`svg`).

export const WIDTH = 800, HEIGHT = 420 // about 1.9 to 1: shown whole in a post on X or Reddit
export const TEXT_X = 340 // the words start here; the pet stays to the left of it
const NIGHT = '#1e1e2e', FLOOR = '#27273a', EDGE = '#8d4325', SAND = '#efe9dc', STAR = '#ffd54f' // sprites/cover.py
const FLOOR_H = 76, EDGE_H = 4, MARGIN = 30
const PET_MAX = 20 // the pet's scale, at most: screen pixels a pixel
export const LINK = 'github.com/silirim/cachito-pet'

// 5 px wide pixel font, rows 8 and 9 are descenders: the small letters, `W`, `C`, `?` and `·` are those of sprites/cover.py
export const FONT = /** @type {Record<string, string>} */ ({
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.', C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.', E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#', I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..', K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#', O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....', Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..', U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..', W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  a: '/.../.###./....#/.####/#...#/.####', b: '#..../#..../#.##./##..#/#...#/#...#/####.', c: '/.../.###./#..../#..../#...#/.###.',
  d: '....#/....#/.##.#/#..##/#...#/#...#/.####', e: '/.../.###./#...#/#####/#..../.###.', f: '..##./.#..#/.#.../###../.#.../.#.../.#...',
  g: '/.../.####/#...#/#...#/#..##/.##.#/....#/.###.', h: '#..../#..../#.##./##..#/#...#/#...#/#...#', i: '..#../...../.##../..#../..#../..#../.###.',
  j: '...#./...../..##./...#./...#./...#./...#./#..#./.##..', k: '#..../#..../#..#./#.#../##.../#.#../#..#.', l: '.##../..#../..#../..#../..#../..#../.###.',
  m: '/.../##.#./#.#.#/#.#.#/#.#.#/#.#.#', n: '/.../#.##./##..#/#...#/#...#/#...#', o: '/.../.###./#...#/#...#/#...#/.###.',
  p: '/.../####./#...#/#...#/#...#/####./#..../#....', q: '/.../.####/#...#/#...#/#..##/.##.#/....#/....#', r: '/.../#.##./##..#/#..../#..../#....',
  s: '/.../.####/#..../.###./....#/####.', t: '.#.../.#.../###../.#.../.#.../.#..#/..##.', u: '/.../#...#/#...#/#...#/#..##/.##.#',
  v: '/.../#...#/#...#/#...#/.#.#./..#..', w: '/.../#...#/#...#/#.#.#/#.#.#/.#.#.', x: '/.../#...#/.#.#./..#../.#.#./#...#',
  y: '/.../#...#/#...#/#...#/#..##/.##.#/....#/.###.', z: '/.../#####/...#./..#../.#.../#####',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.', 2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '.###./#...#/....#/..##./....#/#...#/.###.', 4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...', 8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/....#/.###.',
  '?': '.###./#...#/....#/...#./..#../...../..#..', '·': '/.../.../.../..#..', '.': '//////..#..', ',': '/////..#../..#../.#...', "'": '..#../..#..',
  '-': '///.###.', '/': '....#/....#/...#./..#../.#.../#..../#....', '(': '...#./..#../.#.../.#.../.#.../..#../...#.', ')': '.#.../..#../...#./...#./...#./..#../.#...',
  '★': '/..#../..#../#####/.###./.#.#./#...#', ' ': '',
})

/** A text as the font can draw it: accents dropped, and what it has no drawing for left out. @param {string} s */
export const drawable = (s) => [...String(s).normalize('NFKD')].filter(ch => ch in FONT).join('').replace(/ +/g, ' ').trim()

/**
 * The words of the picture, a line each: the name, the animal, its stage with what is special about this pet, the character's
 * strong point, the stars, and the link. Made of these fields and nothing else: whatever more the object holds is not read.
 * @param {{ name: string, animal: string, stage: string, peak: string, stars: number, golden?: boolean, rare?: boolean, founder?: boolean }} pet
 */
export function shareLines({ name, animal, stage, peak, stars, golden, rare, founder }) {
  const n = Math.max(0, Math.floor(Number(stars) || 0)), tags = [drawable(stage), golden && 'golden', rare && 'a rare one', founder && 'founder'].filter(Boolean)
  return [drawable(name), `Cachito the ${drawable(animal)}`, tags.join(' · '), drawable(peak), `★ ${n} ${n === 1 ? 'star' : 'stars'}`, LINK].filter(Boolean)
}

/** The largest scale, from `most` down to 2, at which a line fits the room; one still too long is cut. @param {string} s @param {number} most @param {number} room */
function fit(s, most, room) {
  let k = most
  while (k > 2 && (s.length * 6 - 1) * k > room) k--
  return { text: s.slice(0, Math.floor((room / k + 1) / 6)), k }
}

/**
 * The picture: the pet standing on the floor at the left, as large as a whole scale lets it, and the lines at its right, the first
 * (the name) larger and the last (the link) on the floor. `rows` are a frame's pixel rows, `.` empty; `palette` gives each key its colour.
 * @param {{ rows: string[], palette: Record<string, string> }} pet @param {string[]} lines
 * @returns {{ width: number, height: number, colours: string[], px: Uint8Array }} one byte a pixel, an index into `colours`
 */
export function picture({ rows, palette }, lines) {
  const colours = [NIGHT, FLOOR, EDGE, SAND, STAR], px = new Uint8Array(WIDTH * HEIGHT), floor = HEIGHT - FLOOR_H
  const index = (/** @type {string} */ hex) => { const at = colours.indexOf(hex); return at < 0 ? colours.push(hex) - 1 : at }
  const rect = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ c) => {
    for (let r = Math.max(0, y); r < Math.min(HEIGHT, y + h); r++) px.fill(c, r * WIDTH + Math.max(0, x), r * WIDTH + Math.max(0, Math.min(WIDTH, x + w)))
  }
  rect(0, floor, WIDTH, FLOOR_H, 1)
  rect(0, floor, WIDTH, EDGE_H, 2)
  // the pet: its empty rows and columns cut, so it stands on the floor and in the middle of its room
  const full = rows.map(r => [...r]).filter((r, y, all) => all.slice(0, y + 1).some(q => q.some(ch => ch !== '.')) && all.slice(y).some(q => q.some(ch => ch !== '.')))
  const xs = full.flatMap(r => r.flatMap((ch, x) => ch === '.' ? [] : [x])), x0 = Math.min(...xs), wide = Math.max(...xs) - x0 + 1
  if (full.length) {
    const room = TEXT_X - 2 * MARGIN, k = Math.max(1, Math.min(PET_MAX, Math.floor(room / wide), Math.floor((floor - MARGIN) / full.length)))
    const left = MARGIN + Math.floor((room - wide * k) / 2)
    full.forEach((r, y) => r.forEach((ch, x) => { const hex = palette[ch]; if (ch !== '.' && hex) rect(left + (x - x0) * k, floor - (full.length - y) * k, k, k, index(hex)) }))
  }
  const room = WIDTH - TEXT_X - MARGIN
  const write = (/** @type {string} */ s, /** @type {number} */ y, /** @type {number} */ most) => {
    const { text, k } = fit(s, most, room)
    ;[...text].forEach((ch, i) => (FONT[ch] ?? '').split('/').forEach((row, r) => [...row].forEach((bit, c) => { if (bit === '#') rect(TEXT_X + (i * 6 + c) * k, y + r * k, k, k, ch === '★' ? 4 : 3) })))
  }
  const said = lines.slice(0, -1), last = lines.at(-1)
  said.forEach((s, i) => write(s, i ? 50 + i * 42 : 36, i ? 3 : 5))
  if (last) write(last, floor + EDGE_H + Math.floor((FLOOR_H - EDGE_H - 9 * 2) / 2), 2)
  return { width: WIDTH, height: HEIGHT, colours, px }
}

const CRC = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n })
const crc32 = (/** @type {Uint8Array} */ b) => { let c = ~0; for (const v of b) c = /** @type {number} */ (CRC[(c ^ v) & 255]) ^ (c >>> 8); return ~c >>> 0 }

/**
 * A PNG file of a picture: 8 bits a pixel with a palette, the rows stored as they are (no compression: the environment of a mod has
 * no deflate, and a picture is a third of a megabyte). @param {ReturnType<typeof picture>} pic @returns {Uint8Array}
 */
export function png({ width, height, colours, px }) {
  const raw = new Uint8Array((width + 1) * height) // each row after its filter byte, 0: none
  for (let y = 0; y < height; y++) raw.set(px.subarray(y * width, (y + 1) * width), y * (width + 1) + 1)
  let a = 1, b = 0
  for (const v of raw) { a = (a + v) % 65521; b = (b + a) % 65521 } // Adler-32, the checksum zlib ends with
  const z = new Uint8Array(2 + 5 * Math.ceil(raw.length / 65535) + raw.length + 4)
  z.set([0x78, 0x01])
  let at = 2
  for (let from = 0; from < raw.length; from += 65535) { // stored blocks, 65,535 bytes each at most
    const n = Math.min(65535, raw.length - from)
    z.set([from + n === raw.length ? 1 : 0, n & 255, n >> 8, ~n & 255, ~n >> 8 & 255], at)
    z.set(raw.subarray(from, from + n), at + 5)
    at += 5 + n
  }
  z.set([b >> 8, b & 255, a >> 8, a & 255], at)
  const u32 = (/** @type {number} */ n) => [n >>> 24, n >> 16 & 255, n >> 8 & 255, n & 255]
  const chunk = (/** @type {string} */ kind, /** @type {ArrayLike<number>} */ data) => {
    const out = new Uint8Array(12 + data.length)
    out.set(u32(data.length))
    out.set([...kind].map(ch => ch.charCodeAt(0)), 4)
    out.set(data, 8)
    out.set(u32(crc32(out.subarray(4, 8 + data.length))), 8 + data.length)
    return out
  }
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk('IHDR', [...u32(width), ...u32(height), 8, 3, 0, 0, 0]),
    chunk('PLTE', colours.flatMap(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)))),
    chunk('IDAT', z),
    chunk('IEND', []),
  ]
  const file = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  parts.reduce((n, part) => { file.set(part, n); return n + part.length }, 0)
  return file
}

/** The same picture as an SVG, for a machine with no Node to write the PNG: a rectangle for each run of one colour in a row. @param {ReturnType<typeof picture>} pic */
export function svg({ width, height, colours, px }) {
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`, `<rect width="${width}" height="${height}" fill="${colours[0]}"/>`]
  for (let y = 0; y < height; y++) for (let x = 0, end = 0; x < width; x = end) {
    const c = px[y * width + x]
    for (end = x + 1; end < width && px[y * width + end] === c; end++);
    if (c) out.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${colours[c]}"/>`)
  }
  return `${out.join('\n')}\n</svg>\n`
}

/**
 * Where a pet's picture goes: one file a pet name in the folder, written over each time. The name gives letters and digits only,
 * so whatever it holds (a slash, dots, a drive, an escape) the file is in the folder. @param {string} dir @param {string} name @param {'png' | 'svg'} kind
 */
export function sharePath(dir, name, kind) {
  const slug = (String(name).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join('-').slice(0, 40)
  return `${dir.replace(/[\\/]+$/, '')}/cachito-${slug || 'pet'}.${kind}`
}
