// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { pack, parse, validate, movePath, asked, stageOf, FORMAT, LIMITS } from './move.js'
import { initialState, shared } from './engine.js'
import { whole as diaryOf, open as diaryOpened, bought } from './diary.js'

const T = new Date(2026, 10, 15, 9, 5, 7).getTime()
const PREFS = { species: 'penguin', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], personality: 'A quiet one.', hatched: 1_700_000_000_000, cuddles: 12, cuddled: T - 5000, wear: 'sombrero golden', lang: 'es', style: true, hidden: false, model: 'claude-haiku-5-5', voice: true, voiceAsked: true, asked: true, chats: false, callme: "Ana-Li O'Neil", missing: 'robot', lost: false }
const PET = { ...initialState(1), variant: 'golden', born: T - 9 * 86_400_000, coins: 123, affection: 456, days: 9, day: 20_000, lately: [19_999, 20_000], owned: ['sombrero', 'golden'], animals: ['penguin'], cuddledAt: T - 5000 }
const DIARY = bought(diaryOpened(diaryOf(undefined), { now: T - 86_400_000, folder: 'hatchling', born: true }), 'sombrero', T - 1000)
const good = () => pack({ pet: PET, prefs: PREFS, diary: DIARY, now: T })
/** The first fault of a file like the good one with `change` made to it. */
const fault = (/** @type {(m: any) => void} */ change) => { const m = structuredClone(good()); change(m); const r = parse(JSON.stringify(m)); assert.equal(r.move, null); return r.errors[0] ?? '' }

test('a file holds the pet, its choices and the diary, and reads back as the same', () => {
  const m = good(), r = parse(JSON.stringify(m, null, 2))
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.move, m)
  assert.deepEqual(Object.keys(m), ['hatchling', 'format', 'exported', 'pet', 'prefs', 'diary'])
  assert.deepEqual([m.hatchling, m.format, m.exported], ['pet', FORMAT, T])
  assert.deepEqual(m.pet, shared(PET))
  assert.deepEqual([m.pet.variant, m.pet.coins, m.pet.owned, m.pet.animals, m.pet.born], ['golden', 123, ['sombrero', 'golden'], ['penguin'], PET.born])
  assert.deepEqual(m.prefs, { species: 'penguin', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], personality: 'A quiet one.', hatched: 1_700_000_000_000, cuddles: 12, cuddled: T - 5000, wear: 'sombrero golden', lang: 'es', style: true, hidden: false, model: 'claude-haiku-5-5', voice: true, voiceAsked: true, asked: true, chats: false, callme: "Ana-Li O'Neil" })
  assert.deepEqual(m.diary, DIARY)
  assert.equal(stageOf(m), 'healthy')
  // nothing of a chat's own: no session, no notes, no cheer, no animal put aside, and no key but the ones named
  assert.doesNotMatch(JSON.stringify(m), /session|issues|cheer"|queued|missing|robot|lost/)
})

test('a file exported under the earlier name of the project is read as it is, and one with both names or neither is refused', () => {
  const { hatchling, ...rest } = good(), old = { cachito: hatchling, ...rest }
  const r = parse(JSON.stringify(old))
  assert.deepEqual(r.errors, [])
  assert.deepEqual([r.move?.pet, r.move?.prefs, r.move?.diary], [rest.pet, rest.prefs, rest.diary])
  assert.equal(r.move && stageOf(r.move), 'healthy')
  const NOT = ['file: not a pet saved by /pet export']
  assert.deepEqual(validate({ ...old, hatchling: 'pet' }), NOT)
  assert.deepEqual(validate(rest), NOT)
  assert.deepEqual(validate({ ...rest, cachito: 'x' }), NOT)
  assert.deepEqual(validate({ ...old, extra: 1 }), ['file: unknown field "extra"'])
  // whatever the file is called: the path is the person's, the earlier file name included
  assert.deepEqual(asked('~/.claude/cachito-share/cachito-miro-2026-11-15.json yes', '/home/me'), { path: '/home/me/.claude/cachito-share/cachito-miro-2026-11-15.json', yes: true, typed: '~/.claude/cachito-share/cachito-miro-2026-11-15.json' })
})

test('what an earlier version kept in a shape this one refuses is written whole, so the file made is always one that is read', () => {
  const m = pack({ pet: { coins: 'many', owned: ['sombrero', 'unicorn'] }, prefs: { ...PREFS, hatched: Infinity, cuddled: 'x', wear: 'sombrero unicorn  none' }, diary: { ...DIARY, done: ['first', 'A B'], toldKind: '\u001b[2J' }, now: T })
  assert.deepEqual([m.prefs.hatched, m.prefs.cuddled, m.prefs.wear, m.pet.coins, m.pet.owned, m.diary.done, m.diary.toldKind], [0, 0, 'sombrero none', 0, ['sombrero'], ['first'], ''])
  assert.deepEqual(parse(JSON.stringify(m)).errors, [])
})

test('a hostile file is refused whole, with what is wrong in one line', () => {
  for (const [text, why] of /** @type {[unknown, RegExp][]} */ ([
    [7, /^file: could not be read as text$/],
    ['{"hatchling":"pet",', /^file: not JSON/],
    [`{"hatchling":"pet","pad":"${'x'.repeat(LIMITS.bytes)}"}`, /^file: larger than 256 KiB$/],
    ['[]', /^file: not a pet saved by \/pet export$/],
    ['{"format":1}', /^file: not a pet saved by/],
    ['{"hatchling":"pet","format":"1"}', /^format: must be a whole number from 1$/],
  ])) { const r = parse(text); assert.equal(r.move, null); assert.match(r.errors[0] ?? '', why) }
  // a newer format says so, and nothing else of the file is judged
  assert.equal(fault(m => { m.format = FORMAT + 1; m.pet = 'x' }), `format: the file was made by a newer Hatchling (format ${FORMAT + 1}, this one reads ${FORMAT}): update Hatchling here, then import it`)
  // escape sequences, controls and invisible characters, wherever they are: in a value, in a list, in the name of a field
  assert.match(fault(m => { m.prefs.name = 'Mi\u001b[31mro' }), /^file\.prefs\.name: must be a text/)
  assert.match(fault(m => { m.prefs.callme = 'Ana\u202e' }), /^file\.prefs\.callme: must be a text/)
  assert.match(fault(m => { m.diary.lines[0].name = 'a\u0007b' }), /^file\.diary\.lines\[0\]\.name: must be a text/)
  assert.match(fault(m => { m.diary.folders['\u001b]0;x\u0007'] = 3 }), /a field's name/)
  assert.match(fault(m => { m.diary.done.push('x\ny') }), /^file\.diary\.done\[\d\]: must be a text/)
  assert.match(fault(m => { m.prefs.personality = 'x'.repeat(LIMITS.text + 1) }), /^file\.prefs\.personality: must be a text of up to 200/)
  for (const e of [fault(m => { m.prefs.name = '\u001b[2J' }), fault(m => { m['\u001b[2J'] = 1 })]) assert.doesNotMatch(e, /\u001b/) // and a fault never carries one to the screen
  // wrong kinds, ranges, fields nobody knows, fields missing
  assert.match(fault(m => { m.extra = 1 }), /^file: unknown field "extra"$/)
  assert.match(fault(m => { m.exported = 0 }), /^exported:/)
  assert.match(fault(m => { m.prefs.extra = true }), /^prefs: unknown field "extra"$/)
  assert.match(fault(m => { delete m.prefs.lang }), /^prefs\.lang: is missing$/)
  for (const [k, v] of /** @type {[string, unknown][]} */ ([['seed', 0], ['seed', 1.5], ['name', ''], ['name', 'x'.repeat(21)], ['name', 'a/b'], ['stats', [1, 2, 3]], ['stats', [1, 2, 3, 4, 101]], ['hatched', -1], ['cuddles', -1], ['lang', 'it'], ['style', 1], ['hidden', 'no'], ['model', 'a model'], ['voice', null], ['chats', 0], ['callme', 'x'.repeat(25)], ['callme', 7], ['wear', 7], ['personality', 'x'.repeat(121)]]))
    assert.match(fault(m => { m.prefs[k] = v }), new RegExp(`^prefs\\.${k}: not of the right kind, or out of range$`), `${k} ${v}`)
  assert.match(fault(m => { m.pet = [] }), /^pet: must be an object$/)
  for (const [k, v] of /** @type {[string, unknown][]} */ ([['coins', '9'], ['coins', 1.5], ['coins', -100_001], ['affection', -1], ['days', 1e300], ['born', -5], ['variant', 'silver'], ['life', { input: 1 }], ['lately', [20_001]], ['extra', 1], ['owned', ['golden', 'sombrero']], ['owned', 'sombrero']]))
    assert.match(fault(m => { m.pet[k] = v }), k === 'days' ? /^file\.pet\.days: a number out of range$/ : new RegExp(`^pet\\.${k}: missing, unknown, not of the right kind, or out of range$`), `${k} ${v}`)
  assert.match(fault(m => { delete m.pet.turn }), /^pet\.turn: missing/)
  assert.match(fault(m => { m.diary = null }), /^diary: must be an object$/)
  assert.match(fault(m => { m.diary.extra = 1 }), /^diary\.extra: missing, unknown/)
  assert.match(fault(m => { m.diary.lines.push({ at: 5, kind: 'gossip' }) }), /^diary\.lines: /)
  assert.match(fault(m => { m.diary.lines[0].name = 'x'.repeat(25) }), /^diary\.lines: /)
  assert.match(fault(m => { m.diary.first = '1' }), /^diary\.first: /)
  assert.match(fault(m => { m.diary.done = ['Not A Milestone'] }), /^diary\.done: not the name of a milestone$/)
  assert.match(fault(m => { m.pet.life = { input: { a: { b: { c: { d: 1 } } } }, cacheRead: 0 } }), /nested too deep$/)
  // animals, things and coats that are not known here
  assert.equal(fault(m => { m.prefs.species = 'unicorn' }), 'prefs.species: the animal "unicorn" is not known here: if it comes from a skin pack, install the pack first')
  assert.match(fault(m => { m.prefs.born = 'constructor' }), /^prefs\.born: the animal "constructor" is not known here/)
  assert.match(fault(m => { m.prefs.wear = 'sombrero tophat' }), /^prefs\.wear: "tophat" is not a thing or a coat known here/)
  assert.equal(fault(m => { m.pet.owned = ['sombrero', 'jetpack'] }), 'pet.owned: "jetpack" is not an item or a coat known here')
  assert.equal(fault(m => { m.pet.animals = ['unicorn'] }), 'pet.animals: "unicorn" is not an animal that can be unlocked here')
  // path tricks: no field can hold a path, and a name of an object's own is not one of ours
  for (const name of ['../../etc/passwd', '/etc/passwd', '~/.ssh/id_rsa', 'C:\\Windows', 'a\u0000b']) assert.match(fault(m => { m.prefs.name = name }), /^(file\.)?prefs\.name: /, name)
  assert.match(fault(m => { m.prefs.callme = '../x/y' }), /^prefs\.callme: /)
  assert.match(fault(m => { m.prefs.model = '../../x y' }), /^prefs\.model: /)
  assert.match(parse(JSON.stringify(good()).replace('"prefs":{', '"prefs":{"__proto__":{"name":"x"},')).errors[0] ?? '', /^prefs: unknown field "__proto__"$/)
  // no more faults told than LIMITS.errors, then how many more
  const many = validate({ ...good(), prefs: Object.fromEntries(Object.keys(good().prefs).map(k => [k, null])) })
  assert.equal(many.length, LIMITS.errors + 1)
  assert.match(many.at(-1) ?? '', /^and \d+ more$/)
})

test('the file is named by the pet and the day, in the folder whatever the name; a backup has the time too', () => {
  assert.equal(movePath('/home/me/.claude/hatchling-share', 'Miro', T), '/home/me/.claude/hatchling-share/hatchling-miro-2026-11-15.json')
  assert.equal(movePath('/cfg/hatchling-share/', 'Miro', T, true), '/cfg/hatchling-share/hatchling-miro-2026-11-15-backup-090507.json')
  assert.equal(movePath('/d', '../../etc/x', T), '/d/hatchling-etc-x-2026-11-15.json')
  assert.equal(movePath('/d', '--', T), '/d/hatchling-pet-2026-11-15.json')
})

test('the path typed after /pet import: spaces, quotes, ~, and yes after it', () => {
  assert.deepEqual(asked('  /a/b.json  '), { path: '/a/b.json', yes: false, typed: '/a/b.json' })
  assert.deepEqual(asked('/a/b.json YES'), { path: '/a/b.json', yes: true, typed: '/a/b.json' })
  assert.deepEqual(asked('/my files/the pet.json yes'), { path: '/my files/the pet.json', yes: true, typed: '/my files/the pet.json' })
  assert.deepEqual(asked('"/my files/yes" yes'), { path: '/my files/yes', yes: true, typed: '"/my files/yes"' })
  assert.deepEqual(asked("'/a/it is yes'"), { path: '/a/it is yes', yes: false, typed: "'/a/it is yes'" })
  assert.deepEqual(asked('/my\\ files/pet.json yes'), { path: '/my files/pet.json', yes: true, typed: '/my\\ files/pet.json' })
  assert.equal(asked('C:\\My Files\\ pet.json').path, 'C:\\My Files\\ pet.json') // a Windows path keeps its backslashes
  assert.equal(asked('~/Downloads/my pet.json', '/home/me').path, '/home/me/Downloads/my pet.json')
  assert.equal(asked('~', '/home/me/').path, '/home/me')
  assert.equal(asked('~/x.json').path, '') // no home known: no path
  assert.equal(asked('~other/x.json', '/home/me').path, '~other/x.json') // not the person's home: left as it is, a relative path
  assert.equal(asked('pets/x.json', '/home/me').path, 'pets/x.json')
  assert.deepEqual(asked('   '), { path: '', yes: false, typed: '' })
  assert.equal(asked('yes').path, 'yes')
})

test('the routine the pet learned is in the file: the days and the choice of off, nothing of today\'s questions; a file without it reads as before', async () => {
  const { touch, setUntil, empty, next } = await import('./routine.js')
  const at = (/** @type {number} */ d, /** @type {number} */ h, m = 0) => new Date(2026, 10, d, h, m).getTime()
  let r = setUntil(touch(empty(), at(16, 9)), '18', at(16, 9, 5)).r
  r = next(touch(r, at(17, 9)), at(17, 9, 10)).r // a question is up
  const m = pack({ pet: PET, prefs: PREFS, diary: DIARY, routine: r, now: T })
  assert.deepEqual(Object.keys(m), ['hatchling', 'format', 'exported', 'pet', 'prefs', 'diary', 'routine'])
  assert.deepEqual(m.routine, { off: false, days: r.days })
  assert.deepEqual(parse(JSON.stringify(m)).errors, [])
  assert.deepEqual(parse(JSON.stringify(good())).errors, []) // none in it
  const fault = (/** @type {(m: any) => void} */ change) => { const x = JSON.parse(JSON.stringify(m)); change(x); return parse(JSON.stringify(x)).errors.join('\n') }
  assert.match(fault(x => { x.routine = 'usual' }), /^routine: must be an object/)
  assert.match(fault(x => { x.routine.q = { kind: 'finish', at: 5, opts: ['17', '18'] } }), /^routine\.q: /)
  assert.match(fault(x => { x.routine.days['2026-11-16'].note = 'x' }), /^routine\.days: /)
  assert.match(fault(x => { x.routine.days.someday = { start: 5, end: 6 } }), /^routine\.days: /)
  assert.match(fault(x => { x.routine.off = 'no' }), /^routine\.off: /)
})

