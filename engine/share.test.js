// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { shareLines, picture, png, svg, sharePath, drawable, WIDTH, HEIGHT, TEXT_X, LINK } from './share.js'
import { decode } from './image.js'
import { portrait, coatOf, BUILTIN, REG } from './skins.js'
import en from './lang/en.js'

const MIRO = { name: 'Miro', animal: 'fox', stage: 'crown', peak: 'Checks everything twice', stars: 123, golden: true, founder: true }
const WORN = ['sombrero', 'hoodie', 'skateboard', 'suitcase', 'golden']
const crc = (/** @type {Uint8Array} */ b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1 } return ~c >>> 0 }
/** The chunks of a PNG file, each with whether its CRC is the one of its bytes. @param {Uint8Array} b */
function chunks(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength), out = []
  for (let at = 8; at < b.length;) {
    const n = view.getUint32(at)
    out.push({ kind: String.fromCharCode(...b.subarray(at + 4, at + 8)), data: b.subarray(at + 8, at + 8 + n), sound: view.getUint32(at + 8 + n) === crc(b.subarray(at + 4, at + 8 + n)) })
    at += 12 + n
  }
  return out
}

test('the picture is a PNG any reader takes: signature, size, every CRC, a zlib stream that inflates to the rows, and the pixels come back', () => {
  const pic = picture(portrait('fox', 'crown', WORN), shareLines(MIRO)), file = png(pic)
  assert.deepEqual([...file.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const all = chunks(file), head = /** @type {typeof all[number]} */ (all[0]), view = new DataView(head.data.buffer, head.data.byteOffset)
  assert.deepEqual(all.map(c => [c.kind, c.sound]), [['IHDR', true], ['PLTE', true], ['IDAT', true], ['IEND', true]])
  assert.deepEqual([view.getUint32(0), view.getUint32(4), ...head.data.subarray(8)], [800, 420, 8, 3, 0, 0, 0]) // 8 bits, a palette, not interlaced
  assert.deepEqual([WIDTH, HEIGHT], [800, 420])
  const raw = inflateSync(/** @type {typeof all[number]} */ (all[2]).data) // checks the Adler-32 too
  assert.equal(raw.length, (WIDTH + 1) * HEIGHT)
  const back = decode(file), rgb = (/** @type {number} */ i) => '#' + [0, 1, 2].map(k => /** @type {number} */ (back.rgba[i * 4 + k]).toString(16).padStart(2, '0')).join('')
  assert.deepEqual([back.width, back.height], [WIDTH, HEIGHT])
  for (let i = 0; i < WIDTH * HEIGHT; i += 7) assert.equal(rgb(i), pic.colours[/** @type {number} */ (pic.px[i])])
  // the ground and the floor band of the cover, the pet in its colours: the gold of the coat, the blue of the hoodie
  assert.deepEqual(pic.colours.slice(0, 5), ['#1e1e2e', '#27273a', '#8d4325', '#efe9dc', '#ffd54f'])
  assert.deepEqual([rgb(0), rgb(WIDTH * (HEIGHT - 1))], ['#1e1e2e', '#27273a'])
  for (const hex of [coatOf('golden', 'fox')?.palette.o, BUILTIN.species.fox?.palette.u]) assert.ok(hex && pic.colours.includes(hex), hex)
  assert.ok(pic.colours.length <= 256)
})

test('the pet stays at the left of the words, whole, whatever it wears; the words differ and the pet does not', () => {
  const lines = shareLines(MIRO), empty = picture({ rows: [], palette: {} }, lines)
  const col = (/** @type {{ px: Uint8Array }} */ p, /** @type {number} */ from, /** @type {number} */ to) => Array.from({ length: HEIGHT }, (_, y) => p.px.subarray(y * WIDTH + from, y * WIDTH + to).join()).join('\n')
  for (const animal of Object.keys(BUILTIN.species)) for (const stage of ['baby', 'adult', 'crown']) for (const worn of [[], WORN, ['balloon', 'wizard', 'boots', 'terminal']]) {
    const pet = portrait(animal, stage, worn), pic = picture(pet, lines)
    assert.equal(col(pic, TEXT_X, WIDTH), col(empty, TEXT_X, WIDTH), `${animal} ${stage} ${worn}`) // nothing of the pet among the words
    assert.equal(col(pic, 0, TEXT_X), col(picture(pet, ['Other', LINK]), 0, TEXT_X)) // nothing of the words on the pet
    const drawn = pet.rows.join('').replace(/\./g, '').length, k2 = pic.px.filter((c, i) => c !== empty.px[i]).length / drawn
    assert.ok(Number.isInteger(Math.sqrt(k2)) && k2 >= 36, `${animal} ${stage} ${worn}: every pixel of the pet a whole square, ${k2}`)
  }
})

test('the words come from the fields allowed and from nothing else', () => {
  const stuffed = { ...MIRO, cwd: '/w/secretproj', folder: 'secretproj', project: 'secret', tokens: 77_777_777, cost: '$12.50', personality: 'A secret adopted line.', days: 5151 }
  assert.deepEqual(shareLines(stuffed), ['Miro', 'Hatchling the fox', 'crown · golden · founder', 'Checks everything twice', '★ 123 stars', 'github.com/silirim/hatchling'])
  assert.deepEqual(shareLines({ name: 'Lola', animal: 'axolotl', stage: 'baby', peak: 'Hard to rattle', stars: 1, rare: true }), ['Lola', 'Hatchling the axolotl', 'baby · a rare one', 'Hard to rattle', '★ 1 star', LINK])
  // what the font cannot draw is left out, never drawn as something else; a name with nothing to draw gives no line
  assert.deepEqual(shareLines({ ...MIRO, name: '小狐\x1b[31m', stars: NaN, golden: false, founder: false }).slice(0, 2), ['31m', 'Hatchling the fox'])
  assert.deepEqual(shareLines({ ...MIRO, name: '小狐' })[0], 'Hatchling the fox')
  assert.equal(drawable('Zoé  d\'Ávila-3 <b>'), "Zoe d'Avila-3 b")
  // every word the mod can put there has its letters: the animals, the stages, the strong points
  const words = Object.entries(en).filter(([k]) => /^(animal\.(penguin|chick|dog|bunny|fox|cactus|axolotl)|stage\.(baby|adult|crown)|peak\.\w+)$/.test(k)).map(([, v]) => String(v))
  assert.ok(words.length >= 15)
  for (const w of [...words, 'golden', 'a rare one', 'founder', LINK, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789']) assert.equal(drawable(w), w)
  // a different word is a different picture: the words are drawn
  assert.notDeepEqual(picture({ rows: [], palette: {} }, ['Miro', LINK]).px, picture({ rows: [], palette: {} }, ['Mira', LINK]).px)
})

test('the file of a picture is in the folder whatever the name of the pet', () => {
  const dir = '/home/me/.claude/hatchling-share'
  for (const name of ['Miro', '../../etc/passwd', '..', '.', '/abs/olute', 'C:\\Windows\\x', 'a/b\\c', '\x1b[2J\n\r\t\0', '~', '%2e%2e%2f', '....//', 'con', '', ' ', '小狐', 'x'.repeat(500), 'Zoé d\'Ávila']) {
    const file = sharePath(dir, name, 'png'), base = file.slice(dir.length + 1)
    assert.ok(file.startsWith(`${dir}/`), name)
    assert.match(base, /^hatchling-[\p{L}\p{N}-]{1,40}\.png$/u, name) // no separator, no dot but the suffix's, never a bare device name
    assert.equal(join(dir, base), file)
  }
  assert.deepEqual([sharePath(dir, 'Miro', 'png'), sharePath(`${dir}/`, '../x', 'svg'), sharePath(dir, '..', 'png'), sharePath(dir, 'Zoé d\'Ávila', 'png')],
    [`${dir}/hatchling-miro.png`, `${dir}/hatchling-x.svg`, `${dir}/hatchling-pet.png`, `${dir}/hatchling-zoé-d-ávila.png`])
})

test('with no Node the same picture is an SVG; with Node, share-save.js writes the bytes it is given and only a PNG', () => {
  const pic = picture(portrait('penguin', 'baby', ['goldenegg']), shareLines({ ...MIRO, name: 'Bru', animal: 'penguin', stage: 'baby', golden: false }))
  const drawn = svg(pic), fills = new Set([...drawn.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(m => m[1]))
  assert.match(drawn, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="800" height="420"/)
  assert.deepEqual([...fills].sort(), [...new Set(pic.px)].map(c => pic.colours[c]).sort())
  assert.doesNotMatch(drawn, /<(?!\/?svg|rect )/) // rectangles only: no script, no text, no link
  const dir = mkdtempSync(join(tmpdir(), 'hatchling-share-test-')), file = join(dir, 'new folder', 'hatchling-bru.png'), save = new URL('./share-save.js', import.meta.url).pathname
  try {
    const bytes = png(pic), ok = spawnSync(process.execPath, [save, file], { input: Buffer.from(bytes).toString('base64') })
    assert.deepEqual([ok.status, String(ok.stdout), String(ok.stderr)], [0, '', ''])
    assert.deepEqual(new Uint8Array(readFileSync(file)), bytes)
    assert.equal(spawnSync(process.execPath, [save, join(dir, 'not-a-picture')], { input: Buffer.from('#!/bin/sh').toString('base64') }).status, 2)
    assert.throws(() => readFileSync(join(dir, 'not-a-picture')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('the terminal coat: on every animal, grown or baby, the eyes are dark with light tones round them, and nothing next to them is as dark', () => {
  const luma = (/** @type {string} */ hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.299 * Number(r) + 0.587 * Number(g) + 0.114 * Number(b) }
  for (const [animal, sp] of Object.entries(/** @type {Record<string, any>} */ (REG.species))) for (const body of ['adult', 'baby']) {
    const { rows, palette } = portrait(animal, body, ['terminal']), at = [0, 0] // a coat alone: the frame as it is drawn
    for (const [r, c] of sp.anchors[body].eyes) {
      const tone = (/** @type {number} */ dr, /** @type {number} */ dc) => luma(/** @type {string} */ (palette[/** @type {string} */ (rows[r + at[0] + dr]?.[c + at[1] + dc])]))
      assert.ok(tone(0, 0) < 40, `${animal} ${body}: a dark eye`)
      const next = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => tone(Number(dr), Number(dc))) // an eye may touch the coat's dark tone (the baby dog's ear, the cactus's outline), never on more than two sides
      assert.ok(next.every(v => v > 60) && next.filter(v => v > 140).length >= 2, `${animal} ${body}: next to the eye at ${r},${c} the tones ${next}`)
    }
  }
  // the two whose eyes did not show: the lightest tone on two sides of each eye at least, the cheeks as light, and the beak not as dark as the eyes
  for (const animal of ['penguin', 'chick']) for (const body of ['adult', 'baby']) {
    const sp = /** @type {any} */ (REG.species)[animal], { rows, palette } = portrait(animal, body, ['terminal']), at = [0, 0]
    for (const [r, c] of sp.anchors[body].eyes) assert.ok([[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dr, dc]) => palette[/** @type {string} */ (rows[r + at[0] + Number(dr)]?.[c + at[1] + Number(dc)])] === '#8cffa8').length >= 2, `${animal} ${body}`)
    assert.ok(luma(/** @type {string} */ (palette.o)) > 60 && palette.r === '#8cffa8', `${animal}: beak and cheeks`)
  }
})
