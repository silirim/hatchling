// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pick, bare } from './pick.js'
import { SOLD, SHOP, COATS, WEARABLE, EGGSHELL, PLAIN, RULES } from './engine.js'
import { REG } from './skins.js'
import { LANGS, text } from './lang/index.js'

/** The shop as the mod hands it over: each id with every name it is shown under. */
const shop = () => [
  ...[...SOLD, EGGSHELL].map(i => ({ id: i.id, names: Object.keys(LANGS).map(l => text(l, `item.${i.id}`)) })),
  ...RULES.animals.map(id => ({ id, names: Object.keys(LANGS).map(l => text(l, `animal.${id}`)) })),
]
const got = (/** @type {string} */ typed) => pick(typed, shop())
const NONE = { id: '', meant: [], near: [] }

test('only an id acts: as written, capitals aside, and as the first word of a row read off the shop', () => {
  for (const t of shop()) assert.deepEqual(got(t.id), { ...NONE, id: t.id })
  for (const typed of ['shades', ' SHADES ', 'Shades', 'shades sunglasses']) assert.equal(got(typed).id, 'shades', typed)
  assert.equal(got('glasses').id, 'glasses') // an id, though it is also a word of another thing's name
})

test('a shown name never acts: in any language, with or without its article, it is answered with the id it could be', () => {
  for (const typed of ['sunglasses', 'Sunglasses', 'gafas de sol', 'oculos de sol', '墨镜']) assert.deepEqual(got(typed), { ...NONE, meant: ['shades'] }, typed)
  for (const typed of ['a coffee mug', 'coffee mug', 'Coffee Mug', 'the coffee mug', 'coffee', 'una taza de café', 'taza', '咖啡杯']) assert.deepEqual(got(typed), { ...NONE, meant: ['mug'] }, typed)
  assert.deepEqual(got("a wizard's hat").meant, ['wizard'])
  assert.deepEqual(got('zorro').meant, ['fox'])
  assert.equal(bare('Una Taza de Café'), 'taza de cafe')
  // every shown name of every thing, in every language: never an id, always among the ones meant
  for (const t of shop()) for (const name of t.names) {
    const r = got(name)
    if (r.id) assert.equal(r.id, t.id, name) // a name that is the id itself (cactus, sombrero)
    else assert.ok(r.meant.includes(t.id), `${name}: ${r.meant}`)
  }
})

test('two things shown under the same name are both suggested, and neither is picked', () => {
  const twins = [{ id: 'shades', names: ['sunglasses'] }, { id: 'aviators', names: ['sunglasses', 'gafas de sol'] }, { id: 'mug', names: ['a coffee mug'] }]
  for (const typed of ['sunglasses', 'Sunglasses', 'the sunglasses', 'sung']) assert.deepEqual(pick(typed, twins), { ...NONE, meant: ['shades', 'aviators'] }, typed)
  assert.deepEqual(pick('aviators', twins), { ...NONE, id: 'aviators' })
  // a word of several names: all of them, in the shop's order
  assert.deepEqual(got('hat').meant, ['partyhat', 'santa', 'wizard'])
  assert.deepEqual(got('coat').meant, ['pastel', 'terminal', 'golden'])
})

test('an unknown word gives the closest ids, or none when nothing is close; a beginning is a suggestion too', () => {
  assert.deepEqual(got('sung'), { ...NONE, meant: ['shades'] })
  assert.deepEqual(got('skate'), { ...NONE, meant: ['skateboard'] })
  assert.deepEqual(got('sunglases'), { ...NONE, near: ['shades'] })
  assert.deepEqual(got('shadez'), { ...NONE, near: ['shades'] })
  assert.equal(got('baloon').near[0], 'balloon')
  for (const typed of ['yacht', 'unicorn', '', 's']) assert.deepEqual(got(typed), NONE, typed)
})

test('ids are unique across the things, the coats and the animals, and none is a word a command keeps for itself', () => {
  const ids = [...WEARABLE.map(i => i.id), ...Object.keys(REG.species)]
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [])
  for (const group of [SHOP, COATS, RULES.animals.map(id => ({ id }))]) for (const i of group) assert.ok(ids.includes(i.id), i.id)
  for (const id of ids) { assert.match(id, /^[a-z][a-z0-9-]*$/, id); assert.ok(!['none', 'off', PLAIN].includes(id), id) }
  assert.ok(ids.length >= SOLD.length + RULES.animals.length + 2)
})
