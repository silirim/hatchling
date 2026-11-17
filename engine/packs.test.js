// @ts-check
// The public packs (packs/*.json, packs/README.md): each is read with the check the mod uses, as one folder a person might install whole.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, lstatSync } from 'node:fs'
import { BUILTIN, LIMITS, RESERVED, parse, compile } from './skins.js'

const DIR = new URL('../packs/', import.meta.url)
const FILES = readdirSync(DIR).filter(f => f !== 'README.md').sort()
const SHIPPED = [...Object.keys(BUILTIN.species), ...Object.keys(BUILTIN.items), ...Object.keys(BUILTIN.coats)]

test('packs/ holds packs and their README, nothing else, and is not empty', () => {
  assert.ok(FILES.length > 0)
  for (const f of FILES) {
    assert.match(f, /^[a-z][a-z0-9-]{1,23}\.json$/, f)
    const st = lstatSync(new URL(f, DIR))
    assert.ok(st.isFile() && st.size <= LIMITS.bytes, `${f}: a regular file of at most ${LIMITS.bytes / 1024} KiB`)
  }
})

test('every public pack is sound, says who made it and under which licence, and shares no id or name with the catalogue or another pack', () => {
  /** @type {string[]} */ const ids = []
  const taken = [...SHIPPED]
  for (const f of FILES) {
    // as the mod reads a folder (skins.js `install`): the ids and the names of the packs before are taken too
    const { pack, errors } = parse(readFileSync(new URL(f, DIR), 'utf8'), { taken: [...ids, ...taken] })
    assert.deepEqual(errors, [], `${f}:\n${errors.join('\n')}`)
    assert.equal(`${pack.id}.json`, f, `${f}: the file is named after the pack's id`)
    assert.ok(!ids.includes(pack.id), `${f}: the id "${pack.id}" is another pack's`)
    assert.ok(!taken.includes(pack.id) && !RESERVED.includes(pack.id), `${f}: the id "${pack.id}" is a name of the catalogue or of another pack`)
    for (const k of ['author', 'license']) assert.ok(pack.credits?.[k], `${f}: credits.${k} is missing`)
    const c = compile(pack)
    ids.push(pack.id)
    taken.push(...Object.keys(c.species), ...Object.keys(c.items), ...Object.keys(c.coats))
  }
})

test('the README of packs/ lists every pack', () => {
  const readme = readFileSync(new URL('README.md', DIR), 'utf8')
  for (const f of FILES) assert.ok(readme.includes(`](${f})`), `${f} has no row in packs/README.md`)
})
