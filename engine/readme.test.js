// @ts-check
// README.md as a page: every picture it shows is in the repository, the pictures made for it stay small, the rare animal is named
// nowhere in it or in what draws them, and its prose stays within the limit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import zoo from '../sprites/zoo.js'
import { RULES } from './engine.js'
import { ANIMALS, WORN, COATED, SHARED, FILES, DRAW, png } from '../sprites/readme.mjs'

const root = new URL('../', import.meta.url), at = (/** @type {string} */ path) => fileURLToPath(new URL(path, root))
const README = readFileSync(at('README.md'), 'utf8')
const shown = README.replace(/<!--[\s\S]*?-->/g, '') // what GitHub renders: a comment is not shown
// the animals of the pack the shop does not sell: worked out, so that the name is written in no test either
const HIDDEN = Object.keys(zoo.pack.animals).filter(id => !RULES.animals.includes(id))
const BADGES = 'https://img.shields.io/badge/' // static badges only: a dynamic one breaks while the repository is private

/** The words of the prose: comments, tags with their attributes (so alt texts and URLs) and the targets of links are dropped; what is left, code and tables included, is counted by its runs of letters and digits. @param {string} md */
export const words = (md) => md.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\]\([^)]*\)/g, '] ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

test('every picture of the README has an alt text, and is a file of the repository or a static badge', () => {
  const tags = shown.match(/<img\b[^>]*>/g) ?? []
  assert.ok(tags.length >= 5, 'the page opens its sections with pictures')
  assert.equal(/!\[/.test(shown), false, 'pictures are <img> tags, so that each has a width and an alt')
  for (const tag of tags) {
    const src = /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? ''
    assert.match(tag, /\salt="[^"]{3,}"/, tag)
    if (src.startsWith(BADGES)) { assert.match(src, /style=flat-square/, src); continue }
    assert.match(src, /^assets\/[\w.-]+$/, `a relative path: ${src}`)
    assert.ok(existsSync(at(src)), `missing: ${src}`)
  }
  for (const name of [...FILES, 'cover.png', 'hatch.gif', 'terminal.gif', 'results.svg']) assert.ok(shown.includes(`src="assets/${name}"`), name)
})

test('every link of the README stays in the repository, and leads to a file or to a heading of the page', () => {
  const targets = [...shown.matchAll(/\shref="([^"]+)"/g), ...shown.matchAll(/\]\(([^)]+)\)/g)].map(m => String(m[1]))
  const anchors = [...shown.matchAll(/^#+ (.+)$/gm)].map(m => `#${String(m[1]).toLowerCase().replace(/[^\w -]/g, '').replace(/ /g, '-')}`)
  assert.ok(targets.length > 5)
  for (const to of targets) {
    assert.doesNotMatch(to, /^[a-z]+:|^\//, `a relative path: ${to}`)
    assert.ok(to.startsWith('#') ? anchors.includes(to) : existsSync(at(to)), `leads nowhere: ${to}`)
  }
})

test('only what GitHub keeps: no style, no script, no class', () => {
  assert.doesNotMatch(README, /<(script|style|iframe)\b|\s(style|class|on\w+)=/i)
})

test('the rare animal is named nowhere: not in the README, not in what draws its pictures', () => {
  assert.equal(HIDDEN.length, 1)
  const script = readFileSync(at('sprites/readme.mjs'), 'utf8'), lists = JSON.stringify([ANIMALS, WORN, COATED, SHARED])
  for (const name of HIDDEN) for (const [where, body] of Object.entries({ README, 'sprites/readme.mjs': script, 'the lists': lists })) assert.equal(body.toLowerCase().includes(name), false, where)
  assert.deepEqual(ANIMALS, RULES.animals)
})

/** The rows of a PNG of ours, inflated: the bytes deflate gives may differ from a machine to another, the pixels may not. @param {Buffer} file */
const rows = (file) => { const from = file.indexOf('IDAT', 0, 'latin1'); return inflateSync(file.subarray(from + 4, from + 4 + file.readUInt32BE(from - 4))) }

test('the pictures made for the README: on disk as the script draws them now, under 200 KB, at most 1200 px wide, the corners see-through', () => {
  for (const name of FILES) {
    const pic = /** @type {() => { w: number, h: number, colours: string[], px: Uint8Array }} */ (DRAW[name])(), file = at(`assets/${name}`)
    assert.ok(statSync(file).size < 200_000, name)
    assert.ok(pic.w <= 1200 && pic.w >= 800, name)
    const disk = readFileSync(file)
    assert.deepEqual([disk.readUInt32BE(16), disk.readUInt32BE(20)], [pic.w, pic.h], `${name} is stale: node sprites/readme.mjs`)
    assert.ok(rows(disk).equals(rows(png(pic))), `${name} is stale: node sprites/readme.mjs`)
    assert.equal(rows(disk)[1], 0, 'the first pixel is the see-through one')
  }
})

test('the README says what must stay in sight, and its prose is 750 words or fewer', () => {
  const open = shown.replace(/<details>[\s\S]*?<\/details>/g, '')
  assert.match(open, /It does not beat ponytail on gin/)
  assert.match(open, /It is not shown to beat a single "Be brief\."\*\*, on either project/)
  assert.match(open, /Bluetooth/)
  assert.doesNotMatch(README, /\/pet where/)
  const n = words(README)
  assert.ok(n <= 750, `${n} words`)
})
