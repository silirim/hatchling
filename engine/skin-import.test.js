// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { decode } from './image.js'
import { convert, read, DEFAULTS } from './skin-import.js'
import { validate, compile, BUILTIN, LIMITS } from './skins.js'

const taken = [...Object.keys(BUILTIN.species), ...Object.keys(BUILTIN.items), ...Object.keys(BUILTIN.coats)]

/** A PNG file of an image, each row with the filter given (0 none, 1 left, 2 up, 3 average, 4 Paeth). */
function png(/** @type {number} */ w, /** @type {number} */ h, /** @type {Uint8Array} */ rgba, filter = 0) {
  const line = w * 4, raw = Buffer.alloc((line + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (line + 1)] = filter
    for (let x = 0; x < line; x++) {
      const v = /** @type {number} */ (rgba[y * line + x]), a = x >= 4 ? /** @type {number} */ (rgba[y * line + x - 4]) : 0, up = y ? /** @type {number} */ (rgba[(y - 1) * line + x]) : 0, c = x >= 4 && y ? /** @type {number} */ (rgba[(y - 1) * line + x - 4]) : 0
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c)
      raw[y * (line + 1) + 1 + x] = v - [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][filter]
    }
  }
  const crc = (/** @type {Uint8Array} */ b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1 } return ~c >>> 0 }
  const chunk = (/** @type {string} */ t, /** @type {Buffer} */ d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(td)); return Buffer.concat([len, td, sum]) }
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

/** A lossless WebP of one colour, written bit by bit as the specification says: five codes of one symbol each, so no bit a pixel. */
function webp(/** @type {number} */ w, /** @type {number} */ h, /** @type {[number, number, number, number]} */ [r, g, b, a]) {
  /** @type {number[]} */ const bits = []
  const put = (/** @type {number} */ v, /** @type {number} */ n) => { for (let i = 0; i < n; i++) bits.push((v >> i) & 1) }
  put(0x2f, 8); put(w - 1, 14); put(h - 1, 14); put(1, 1); put(0, 3)
  put(0, 1) // no transform
  put(0, 1) // no colour cache
  put(0, 1) // one group of codes
  for (const symbol of [g, r, b, a]) { put(1, 1); put(0, 1); put(1, 1); put(symbol, 8) } // a simple code: one symbol, of 8 bits
  put(1, 1); put(0, 1); put(0, 1); put(0, 1) // the distances: one symbol, of 1 bit
  const data = Buffer.alloc(Math.ceil(bits.length / 8))
  bits.forEach((bit, i) => { data[i >> 3] = /** @type {number} */ (data[i >> 3]) | bit << (i & 7) })
  const body = Buffer.concat([Buffer.from('VP8L'), Buffer.from(new Uint32Array([data.length]).buffer), data, Buffer.alloc(data.length & 1)])
  return Buffer.concat([Buffer.from('RIFF'), Buffer.from(new Uint32Array([4 + body.length]).buffer), Buffer.from('WEBP'), body])
}

/** A Codex sheet made here: in every cell of the rows we use, a body of one colour with two dark eyes, moved a little from cell to cell. */
function sheet(rows = 9) {
  const W = 1536, H = 208 * rows, rgba = new Uint8Array(W * H * 4)
  const box = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ w, /** @type {number} */ h, /** @type {number[]} */ c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba.set(c, (y * W + x) * 4) }
  for (const [row, n, colour] of /** @type {[number, number, number[]][]} */ ([[0, 6, [240, 180, 60, 255]], [3, 4, [240, 180, 60, 255]], [4, 5, [240, 180, 60, 255]], [6, 6, [120, 140, 220, 255]]])) for (let c = 0; c < n; c++) {
    const x = c * 192, y = row * 208, shift = c % 2 ? 6 : 0
    box(x + 40, y + 40 - shift, 112, 150, colour) // the body
    box(x + 64, y + 80 - shift, 16, 16, [20, 20, 20, 255]); box(x + 112, y + 80 - shift, 16, 16, [20, 20, 20, 255]) // the eyes
    box(x + 40, y + 190, 112, 10, [200, 80, 40, 255]) // the feet, where they stand
  }
  return { width: W, height: H, rgba }
}

test('images: a PNG is read with every filter, a lossless WebP by the specification, and what is neither is refused with a reason', () => {
  const w = 5, h = 4, rgba = Uint8Array.from({ length: w * h * 4 }, (_, i) => (i * 37 + (i >> 2) * 11) & 255)
  for (const filter of [0, 1, 2, 3, 4]) {
    const img = decode(png(w, h, rgba, filter))
    assert.deepEqual([img.width, img.height, Buffer.from(img.rgba).equals(Buffer.from(rgba))], [w, h, true], `filter ${filter}`)
  }
  const one = decode(webp(3, 2, [10, 200, 30, 255]))
  assert.deepEqual([one.width, one.height, [...one.rgba]], [3, 2, Array.from({ length: 6 }, () => [10, 200, 30, 255]).flat()])
  assert.deepEqual([...decode(webp(1, 1, [0, 0, 0, 0])).rgba], [0, 0, 0, 0])
  assert.throws(() => decode(Buffer.from('GIF89a..........')), /not a PNG nor a WebP/)
  assert.throws(() => decode(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.from([4, 0, 0, 0, 1, 2, 3, 4])])), /lossy WebP is not read: convert the sheet to PNG/)
  assert.throws(() => decode(webp(3, 2, [1, 2, 3, 4]).subarray(0, 24)), /ends early/)
  const huge = png(2, 2, new Uint8Array(16)); huge.writeUInt32BE(100_000, 16)
  assert.throws(() => decode(huge), /too large/)
})

test('a Codex pet becomes a pack that passes the same check as any other: three states, a small palette, its name, author and licence', () => {
  const { pack, id, taken: frames } = convert({ meta: { id: 'pixel-duck--someone', displayName: 'Pixel Duck', description: 'x' }, sheet: sheet(), credits: { author: 'Some One', license: 'CC BY 4.0', source: 'https://example.org/duck' } })
  assert.deepEqual(validate(pack, { taken }), [])
  assert.deepEqual([pack.format, pack.id, pack.name, id, pack.credits], [1, 'codex-pixel-duck', 'Pixel Duck', 'pixel-duck', { author: 'Some One', license: 'CC BY 4.0', source: 'https://example.org/duck' }])
  const a = pack.animals['pixel-duck']
  assert.deepEqual([a.size, a.name], [DEFAULTS.size, { en: 'Pixel Duck' }])
  assert.deepEqual(Object.keys(a.states), ['adult', 'cheer', 'sleep']) // still, happy, asleep
  const [w, h] = DEFAULTS.size, still = /** @type {string[]} */ (a.states.adult.frames[0])
  assert.deepEqual([still.length, still.every(r => r.length === w)], [h, true])
  assert.ok(Object.keys(a.palette).length <= DEFAULTS.colours)
  assert.equal(still.at(-1)?.replaceAll('.', '').length ? true : false, true) // it stands on the ground: the last row is drawn
  assert.ok(still.some(r => r.includes('.')) && still.join('').replaceAll('.', '').length > w * h / 3) // a figure, with room around it, that fills the grid
  // the eyes are kept: a dark colour is in the palette and in the frame, though it covers little
  const dark = Object.entries(a.palette).filter(([, c]) => parseInt(String(c).slice(1, 3), 16) < 60).map(([k]) => k)
  assert.ok(dark.length > 0 && dark.some(k => still.join('').includes(k)), JSON.stringify(a.palette))
  // the idle loop is a gesture of its own, the wave is the cheer (it stays in place), the waiting row stands in for sleep
  assert.deepEqual([frames.still > 1, frames.happy, frames.asleep, a.states.adult.idle.loop.frames.length > 0], [true, 4, 2, true])
  assert.notEqual(a.states.sleep.frames[0].join(), still.join())
  // it reads as a pack: the animal is there with its size, and the things of the shop fall on it by its anchors
  const c = compile(pack)
  assert.deepEqual(c.species['pixel-duck']?.size, DEFAULTS.size)
  assert.equal(c.credits.license, 'CC BY 4.0')
  // other sizes and palettes, within the limits of a pack
  const small = convert({ meta: { id: 'otter' }, sheet: sheet(11), size: [12, 10], colours: 4 })
  assert.deepEqual([validate(small.pack, { taken }), small.pack.animals.otter.size, Object.keys(small.pack.animals.otter.palette).length <= 4, small.pack.credits], [[], [12, 10], true, { author: 'not declared', license: 'not declared' }])
  assert.deepEqual(validate(convert({ meta: { id: 'otter' }, sheet: sheet(), size: [LIMITS.side, LIMITS.side], colours: 99 }).pack, { taken }), [])
  // what is not a Codex sheet, or a size out of the limits, is said
  assert.throws(() => convert({ meta: { id: 'otter' }, sheet: { width: 800, height: 600, rgba: new Uint8Array(800 * 600 * 4) } }), /a Codex sheet is 1536 wide/)
  assert.throws(() => convert({ meta: { id: 'otter' }, sheet: { width: 1536, height: 1872, rgba: new Uint8Array(1536 * 1872 * 4) } }), /idle\) is empty/)
  assert.throws(() => convert({ meta: { id: 'otter' }, sheet: sheet(), size: [26, 22] }), /even numbers from 8 to 24/)
  assert.equal(convert({ meta: { id: '!!' }, sheet: sheet() }).id, 'pet') // no usable id or name: a plain one
  // a name from the pet's file is cleaned before it is a pack's
  const odd = convert({ meta: { id: 'Evil__Pet', displayName: 'Evil\u001b[31m\nPet ' + 'x'.repeat(60) }, sheet: sheet() })
  assert.deepEqual([odd.id, validate(odd.pack, { taken }), /[\u0000-\u001f]/.test(odd.pack.name)], ['evil-pet', [], false])
})

test('npm run skin:import reads a pet from a folder of the disk and writes the pack where the mod looks; a pet that points outside its folder is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cachito-import-')), pet = join(dir, 'my-pet'), out = join(dir, 'skins')
  mkdirSync(pet)
  const s = sheet()
  writeFileSync(join(pet, 'spritesheet.png'), png(s.width, s.height, s.rgba))
  writeFileSync(join(pet, 'pet.json'), JSON.stringify({ id: 'my-pet', displayName: 'My Pet', description: 'made for a test', spritesheetPath: 'spritesheet.png' }))
  writeFileSync(join(pet, 'submission.json'), JSON.stringify({ author: 'A. Person', license: 'MIT License', source_url: 'https://example.org/my-pet' }))
  const got = read(pet)
  assert.deepEqual([got.meta.id, got.sheet.width, got.credits], ['my-pet', 1536, { author: 'A. Person', license: 'MIT License', source: 'https://example.org/my-pet' }])
  const run = (/** @type {string[]} */ args) => { try { return { code: 0, text: execFileSync(process.execPath, [fileURLToPath(new URL('./skin-import.js', import.meta.url)), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } } catch (e) { return { code: /** @type {any} */ (e).status, text: String(/** @type {any} */ (e).stderr) } } }
  const done = run([pet, '--out', out, '--size', '16x18'])
  assert.equal(done.code, 0, done.text)
  assert.match(done.text, /codex-my-pet\.json: written\. Pack "My Pet" \(codex-my-pet\), animal my-pet\.\n  drawn at 16x18 pixels with \d+ colours: in the band 16 columns by 9 rows of text, 18 by 10 with a thing on \(the shipped animals take 12 by 5, 14 by 6 with a thing on\)\./)
  assert.match(done.text, /author: A\. Person; license: MIT License; source: https:\/\/example\.org\/my-pet/)
  const written = JSON.parse(readFileSync(join(out, 'codex-my-pet.json'), 'utf8'))
  assert.deepEqual([validate(written, { taken }), written.animals['my-pet'].size], [[], [16, 18]])
  assert.equal(run([join(pet, 'pet.json'), '--out', out]).code, 0) // by its pet.json, and over its own earlier import
  // a file there already that is another pack is left alone
  writeFileSync(join(out, 'codex-my-pet.json'), JSON.stringify({ format: 1, id: 'mine', name: 'Mine' }))
  assert.match(run([pet, '--out', out]).text, /is there already and is not this pack/)
  // no licence known: said, with what to do
  writeFileSync(join(pet, 'submission.json'), '{}')
  const bare = run([pet, '--out', join(dir, 'other')])
  assert.match(bare.text, /license: not declared\n  The licence is not declared in the pet's files: check it where you got the pet/)
  assert.match(run([pet, '--out', join(dir, 'other'), '--license', 'CC0', '--author', 'Me']).text, /author: Me; license: CC0/)
  // a sheet named outside the pet's folder, a folder with no pet, no argument
  writeFileSync(join(pet, 'pet.json'), JSON.stringify({ id: 'my-pet', spritesheetPath: '../../etc/passwd' }))
  assert.deepEqual([run([pet, '--out', out]).code, /names a sheet outside its own folder/.test(run([pet, '--out', out]).text)], [1, true])
  assert.deepEqual([run([dir, '--out', out]).code, run([]).code], [1, 2])
  assert.equal(existsSync(join(out, 'codex-my-pet.json')), true)
})

const CLI = fileURLToPath(new URL('./skin-import.js', import.meta.url))
/** The importer run as a person runs it, and stopped if it has not ended in ten seconds: a file that never ends, or never opens, shows as no exit code. */
const cli = (/** @type {string[]} */ args) => { try { return { code: 0, text: execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 }) } } catch (e) { return { code: /** @type {any} */ (e).status, text: String(/** @type {any} */ (e).stderr) } } }
const RAW = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Zl}\p{Zp}]/u

test('security: the importer opens only regular files of the pet\'s own folder, small ones for its notes: no link, no pipe, no file too large', { skip: process.platform === 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cachito-hostile-')), pet = join(dir, 'pet'), out = join(dir, 'skins'), away = join(dir, 'away')
  mkdirSync(pet); mkdirSync(away)
  const s = sheet(), image = png(s.width, s.height, s.rgba), META = JSON.stringify({ id: 'my-pet', displayName: 'My Pet', spritesheetPath: 'spritesheet.png' })
  const fresh = () => { for (const f of ['pet.json', 'submission.json', 'spritesheet.png', 'sub']) rmSync(join(pet, f), { force: true, recursive: true }); writeFileSync(join(pet, 'pet.json'), META); writeFileSync(join(pet, 'spritesheet.png'), image) }
  fresh()
  assert.equal(read(pet).sheet.width, 1536) // sound as it is
  // pet.json: a link (to anything on the disk: /dev/zero would never end), a file too large, a pipe (which waits for ever)
  writeFileSync(join(away, 'pet.json'), META)
  rmSync(join(pet, 'pet.json')); symlinkSync(join(away, 'pet.json'), join(pet, 'pet.json'))
  assert.throws(() => read(pet), /^Error: pet\.json is not a regular file/)
  fresh(); writeFileSync(join(pet, 'pet.json'), META + ' '.repeat(64 * 1024))
  assert.throws(() => read(pet), /^Error: pet\.json is over 64 KiB$/)
  fresh(); rmSync(join(pet, 'pet.json')); execFileSync('mkfifo', [join(pet, 'pet.json')])
  const piped = cli([pet, '--out', out])
  assert.deepEqual([piped.code, /pet\.json is not a regular file/.test(piped.text)], [1, true], piped.text)
  // submission.json, the note beside it: the same, and a note that may not be read is no note, the pet is still imported
  for (const how of ['link', 'large', 'pipe']) {
    fresh()
    writeFileSync(join(away, 'submission.json'), JSON.stringify({ author: 'From Elsewhere' }))
    if (how === 'link') symlinkSync(join(away, 'submission.json'), join(pet, 'submission.json'))
    else if (how === 'large') writeFileSync(join(pet, 'submission.json'), JSON.stringify({ author: 'Too Much' }) + ' '.repeat(64 * 1024))
    else execFileSync('mkfifo', [join(pet, 'submission.json')])
    const done = cli([pet, '--out', join(dir, `out-${how}`)])
    assert.deepEqual([done.code, /author: not declared; license: not declared/.test(done.text)], [0, true], `${how}: ${done.text}`)
  }
  // the sheet: a link to a file elsewhere is not followed, nor is a path through a linked folder that comes out elsewhere
  writeFileSync(join(away, 'sheet.png'), image)
  fresh(); rmSync(join(pet, 'spritesheet.png')); symlinkSync(join(away, 'sheet.png'), join(pet, 'spritesheet.png'))
  assert.throws(() => read(pet), /^Error: the sheet is not a regular file/)
  fresh(); rmSync(join(pet, 'spritesheet.png')); symlinkSync(away, join(pet, 'sub'))
  writeFileSync(join(pet, 'pet.json'), JSON.stringify({ id: 'my-pet', spritesheetPath: 'sub/sheet.png' }))
  assert.throws(() => read(pet), /^Error: the sheet is outside the pet's own folder$/)
  // a folder of its own inside the pet's is fine
  rmSync(join(pet, 'sub')); mkdirSync(join(pet, 'sub')); writeFileSync(join(pet, 'sub', 'sheet.png'), image)
  assert.equal(read(pet).sheet.width, 1536)
})

test('security: what the importer says of a pet that is not sound holds no escape sequence: the name of the sheet, the text of a pet.json that is not JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cachito-loud-')), pet = join(dir, 'pet')
  mkdirSync(pet)
  const ESC = '\u001b[2J\u001b]0;owned\u0007', C1 = '\u009b31m'
  writeFileSync(join(pet, 'pet.json'), JSON.stringify({ id: 'my-pet', spritesheetPath: `sheet${ESC}${C1}.png` }))
  assert.throws(() => read(pet), e => /no sprite sheet in .* \(sheet 31m\.png\)$/.test(String(/** @type {any} */ (e).message)) && !RAW.test(String(/** @type {any} */ (e).message)))
  writeFileSync(join(pet, 'pet.json'), `{ "id": ${ESC}${C1}`)
  assert.throws(() => read(pet), e => /^pet\.json is not JSON \(/.test(String(/** @type {any} */ (e).message)) && !RAW.test(String(/** @type {any} */ (e).message)))
  const said = cli([pet, '--out', join(dir, 'skins')])
  assert.equal(said.code, 1)
  assert.match(said.text, /^skin:import: pet\.json is not JSON \(/)
  assert.equal(RAW.test(said.text.replace(/\n/g, '')), false, JSON.stringify(said.text))
})

test('security: a WebP that claims thousands of groups of codes is refused before a table is made for any', () => {
  /** @type {number[]} */ const bits = []
  const put = (/** @type {number} */ v, /** @type {number} */ n) => { for (let i = 0; i < n; i++) bits.push((v >> i) & 1) }
  const one = (/** @type {number} */ symbol) => { put(1, 1); put(0, 1); put(1, 1); put(symbol, 8) } // a simple code of one symbol: no bit a pixel
  put(0x2f, 8); put(3, 14); put(3, 14); put(1, 1); put(0, 3) // 4 by 4
  put(0, 1) // no transform
  put(0, 1) // no colour cache
  put(1, 1); put(0, 3) // groups of codes, picked by a small image: one block here
  put(0, 1) // the small image: no colour cache, and one pixel of red 255, green 255: group 65,535 of 65,536
  one(255); one(255); one(0); one(0); put(1, 1); put(0, 1); put(0, 1); put(0, 1)
  const data = Buffer.alloc(Math.ceil(bits.length / 8))
  bits.forEach((bit, i) => { data[i >> 3] = /** @type {number} */ (data[i >> 3]) | bit << (i & 7) })
  const body = Buffer.concat([Buffer.from('VP8L'), Buffer.from(new Uint32Array([data.length]).buffer), data, Buffer.alloc(data.length & 1)])
  assert.throws(() => decode(Buffer.concat([Buffer.from('RIFF'), Buffer.from(new Uint32Array([4 + body.length]).buffer), Buffer.from('WEBP'), body])), /^Error: WebP: too many groups of codes$/)
})
