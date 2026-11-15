// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import zoo from '../sprites/zoo.js'
import { validate, parse, compile, install, place, marksFor, coatOf, REG, BUILTIN, LIMITS, FORMAT } from './skins.js'
import { SHOP, WEARABLE, closetOf, wornOf, putOn, takeOff, turnSlot, view, initialState } from './engine.js'

const EXAMPLE = readFileSync(new URL('../docs/skins-example.json', import.meta.url), 'utf8')
/** A copy of the example pack, changed. @param {(p: any) => void} [change] */
const pack = (change) => { const p = JSON.parse(EXAMPLE); change?.(p); return p }
const taken = [...Object.keys(BUILTIN.species), ...Object.keys(BUILTIN.items), ...Object.keys(BUILTIN.coats)]
const file = (/** @type {string} */ name, /** @type {any} */ p) => ({ file: name, text: typeof p === 'string' ? p : JSON.stringify(p) })

test('the shipped drawings are a pack of the same format and pass the same check', () => {
  assert.equal(zoo.pack.format, FORMAT)
  assert.deepEqual(validate(zoo.pack, { builtin: true }), [])
  // as a person's pack it would be refused for its names alone: they are the shipped ones, and only they say how often an animal is born
  const asMine = validate(zoo.pack, { taken })
  assert.ok(asMine.length > 0 && asMine.every(e => /taken already|unknown field "weight"|more$/.test(e)), asMine.join('\n'))
  assert.deepEqual(Object.keys(BUILTIN.species), ['penguin', 'chick', 'dog', 'bunny', 'fox', 'cactus', 'axolotl'])
  assert.deepEqual(Object.entries(BUILTIN.items).map(([id, i]) => [id, i.slot]), SHOP.map(i => [i.id, i.slot]))
  assert.deepEqual(Object.keys(BUILTIN.coats), ['golden'])
  for (const sp of Object.values(BUILTIN.species)) { assert.equal(sp.pack, ''); assert.ok(sp.weight > 0); assert.ok(sp.states.sleep.at === undefined && sp.states.adult.at.length) }
  assert.ok(JSON.stringify(zoo).length < LIMITS.bytes) // the real drawings fit the size a pack may have
})

test('a larger body and credits: an animal may say its own size, up to 24 by 24, and a pack who made it and under which licence', () => {
  const big = Array.from({ length: 22 }, (_, y) => y < 4 ? '.'.repeat(20) : y === 9 ? '....BBkBBBBBBkBB....' : '....BBBBBBBBBBBB....')
  const p = pack(q => { q.animals.robot.size = [20, 22]; q.animals.robot.states.adult.frames = [big]; q.credits = { author: 'A. Person', license: 'CC BY 4.0', source: 'https://example.org/robot' } })
  assert.deepEqual(validate(p, { taken }), [])
  const c = compile(p), robot = /** @type {any} */ (c.species.robot)
  assert.deepEqual([robot.size, c.credits, BUILTIN.species.fox?.size], [[20, 22], { author: 'A. Person', license: 'CC BY 4.0', source: 'https://example.org/robot' }, [12, 10]])
  assert.deepEqual(robot.anchors.adult, { top: 4, eyes: [[9, 6], [9, 13]], neck: 16 }) // found on its own size
  install([file('a.json', p)])
  assert.deepEqual(REG.packs[0]?.credits, { author: 'A. Person', license: 'CC BY 4.0', source: 'https://example.org/robot' })
  // a thing of the shop on it: set by its anchors on its own size (the mug on the ground at its right, past column 20)
  assert.ok(marksFor('mug', 'robot', 'adult').every(([r, col]) => col >= 21 && r <= 21))
  assert.deepEqual(marksFor('shades', 'robot', 'adult').map(m => m[0]), [9, 9, 9, 9, 9, 9])
  assert.equal(Math.max(...marksFor('sneakers', 'robot', 'adult').map(m => m[0])), 21) // on the row of its feet
  install([])
})

test('the example of docs/skins.md is a sound pack, and is read whole', () => {
  assert.deepEqual(parse(EXAMPLE, { taken }).errors, [])
  const c = compile(JSON.parse(EXAMPLE))
  assert.deepEqual([c.id, c.name, Object.keys(c.species), Object.keys(c.items), Object.keys(c.coats)], ['example', 'Example', ['robot'], ['tophat'], ['mint']])
  const robot = /** @type {any} */ (c.species.robot)
  assert.equal(robot.pack, 'Example')
  assert.equal(robot.weight, 0) // never born as
  assert.equal(robot.states.baby, robot.states.adult) // a stage it does not draw is the adult
  assert.equal(robot.states.crown, robot.states.adult)
  assert.deepEqual(robot.states.adult.at, [[2, 1]])
  assert.deepEqual(robot.anchors.adult, { top: 0, eyes: [[3, 3], [3, 8]], neck: 6 }) // found on the drawing: nobody gave them
  assert.equal(robot.palette.B, '#90a4ae')
  assert.equal(robot.palette.k, zoo.common.k) // the shared colours are there for every animal
})

test('a pack that is not sound is refused whole, and told why: every way tried here', () => {
  const big = Array.from({ length: 12 }, () => '.'.repeat(14))
  /** @type {[string, (p: any) => void, RegExp][]} */ const cases = [
    ['another format', p => { p.format = 2 }, /^format: this Cachito reads format 1$/],
    ['a bad pack id', p => { p.id = 'My Pack' }, /^id: must be 2 to 24/],
    ['a field nobody knows', p => { p.script = 'alert(1)' }, /^pack: unknown field "script"$/],
    ['a name with an escape sequence', p => { p.name = 'x\u001b[31m' }, /^name: holds a control, an invisible or an unassigned character/],
    ['a name too long', p => { p.animals.robot.name.en = 'r'.repeat(33) }, /^animals\.robot\.name\.en: must be a text of 1 to 32/],
    ['no English name', p => { p.items.tophat.name = { es: 'chistera' } }, /^items\.tophat\.name: "en" is missing$/],
    ['a language there is not', p => { p.items.tophat.name.fr = 'haut' }, /^items\.tophat\.name: unknown field "fr"$/],
    ['a colour that is not hexadecimal', p => { p.animals.robot.palette.B = 'red' }, /^animals\.robot\.palette\.B: a colour is written #rrggbb$/],
    ['a colour key of two letters', p => { p.animals.robot.palette.BB = '#000000' }, /^animals\.robot\.palette\.BB: a colour key is one letter or digit$/],
    ['a shared colour redefined', p => { p.animals.robot.palette.k = '#ffffff' }, /"k" is a shared colour/],
    ['a frame of the wrong size', p => { p.animals.robot.states.adult.frames[0].pop() }, /^animals\.robot\.states\.adult\.frames\[0\]: a frame is 10 rows of 12 pixels, or 12 rows of 14$/],
    ['a row of the wrong width', p => { p.animals.robot.states.adult.frames[0][2] += '.' }, /frames\[0\]: a frame is 10 rows/],
    ['a pixel of no colour', p => { p.animals.robot.states.adult.frames[0][1] = '..BBBBZZBB..' }, /uses a colour key the palette lacks: "Z"$/],
    ['no adult', p => { p.animals.robot.states = { baby: p.animals.robot.states.adult } }, /the "adult" state is missing/],
    ['a state there is not', p => { p.animals.robot.states.angry = p.animals.robot.states.adult }, /^animals\.robot\.states\.angry: not a state/],
    ['too many frames', p => { p.animals.robot.states.adult.frames = Array(9).fill(p.animals.robot.states.adult.frames[0]) }, /frames: must be a list of 1 to 8 frames$/],
    ['a small frame set elsewhere', p => { p.animals.robot.states.adult.at = [[0, 0]] }, /a frame of 10 rows sits at \[2, 1\]$/],
    ['asleep with a place for things', p => { p.animals.robot.states.sleep = { frames: [big], at: [[2, 1]] } }, /asleep the pet wears nothing/],
    ['a tint nobody defined', p => { p.animals.robot.states.adult.tint = 'sick' }, /tint: names no tint of this animal$/],
    ['a tint of a colour the animal lacks', p => { p.animals.robot.tints = { sick: { Q: '#00ff00' } } }, /"Q" is not a colour of this animal that can change$/],
    ['a gesture on a mood', p => { p.animals.robot.states.cheer = { frames: [big], idle: {} } }, /only baby, adult, crown have gestures$/],
    ['an anchor out of the body', p => { p.animals.robot.anchors = { adult: { top: 12, eyes: [[3, 3], [3, 8]], neck: 6 } } }, /anchors\.adult\.top: must be a row, 0 to 9$/],
    ['how often it is born', p => { p.animals.robot.weight = 50 }, /^animals\.robot: unknown field "weight"$/],
    ['a part there is not', p => { p.items.tophat.part = 'tail' }, /^items\.tophat\.part: must be one of head, face, body, feet, accessory$/],
    ['a thing with no fallback', p => { delete p.items.tophat.fallback }, /^items\.tophat: "fallback" is missing$/],
    ['an anchor there is not', p => { p.items.tophat.fallback[0].anchor = 'tail' }, /fallback\[0\]\.anchor: must be one of/],
    ['a thing drawn with an animal\'s colour', p => { p.items.tophat.fallback[0].art = ['BBB'] }, /a thing is drawn with the fixed colours only/],
    ['a drawing too wide', p => { p.items.tophat.fallback[0].art = ['u'.repeat(17)] }, /must be 1 to 12 rows of text, each as long, of 1 to 16 pixels$/],
    ['a drawing out of the frame', p => { p.items.tophat.draw = { fox: { adult: { at: [9, 15], art: ['uuuuuuuu'] } } } }, /draw\.fox\.adult: reaches out of the frame/],
    ['a ramp of one colour', p => { p.coats.mint.ramp = ['#000000'] }, /^coats\.mint\.ramp: must be 2 to 4 colours/],
    ['too many animals', p => { for (let i = 0; i < LIMITS.animals; i++) p.animals[`robot${i}`] = p.animals.robot }, /^animals: more than 8$/],
    ['a bad name of a thing', p => { p.items.__proto__x = p.items.tophat }, /^items\.__proto__x: a name is 2 to 24/],
    ['a name used twice in the pack', p => { p.coats.tophat = p.coats.mint }, /the name "tophat" is used twice in this pack$/],
    ['nothing in it', p => { delete p.animals; delete p.items; delete p.coats }, /^pack: brings nothing/],
    ['a body too large', p => { p.animals.robot.size = [26, 22] }, /^animals\.robot\.size: must be \[width, height\] in pixels, even numbers from 8 to 24$/],
    ['a body of an odd height', p => { p.animals.robot.size = [12, 11] }, /^animals\.robot\.size: must be/],
    ['a frame of the usual size on a larger body', p => { p.animals.robot.size = [20, 22] }, /frames\[0\]: a frame is 22 rows of 20 pixels, or 24 rows of 22$/],
    ['credits that are not texts', p => { p.credits = { author: 7 } }, /^credits\.author: must be a text of 1 to 160 characters/],
    ['credits with an escape sequence', p => { p.credits = { license: 'MIT\u001b[2J' } }, /^credits\.license: holds a control, an invisible or an unassigned character/],
    ['a credit nobody knows', p => { p.credits = { email: 'x' } }, /^credits: unknown field "email"$/],
  ]
  for (const [what, change, want] of cases) {
    const errors = validate(pack(change), { taken })
    assert.ok(errors.some(e => want.test(e)), `${what}: ${errors.join(' | ')}`)
    assert.equal(parse(JSON.stringify(pack(change)), { taken }).pack, null, what)
  }
  assert.ok(cases.length >= 10)
  // not an object, not JSON, too big: no pack either, and nothing thrown
  for (const raw of [null, [], 'x', 7]) assert.deepEqual(validate(raw), ['pack: must be an object'])
  assert.match(String(parse('{ "format": 1,', {}).errors[0]), /^file: not JSON/)
  assert.deepEqual(parse(' '.repeat(LIMITS.bytes + 1), {}).errors, ['file: larger than 512 KiB'])
  // many faults are told up to a limit
  const many = validate(pack(p => { for (let i = 0; i < 40; i++) p[`x${i}`] = 1 }), { taken })
  assert.equal(many.length, LIMITS.errors + 1)
  assert.match(String(many.at(-1)), /^and \d+ more$/)
})

test('names: a pack may not take a shipped name, a word the commands use, or a name an earlier pack took', () => {
  for (const id of ['fox', 'mug', 'golden', 'none', 'plain', 'crown', 'head']) {
    assert.match(validate(pack(p => { p.items[id] = p.items.tophat; delete p.items.tophat }), { taken }).join('|'), new RegExp(`items\\.${id}: the name "${id}" is taken already`), id)
  }
  assert.match(validate(pack(p => { p.animals.penguin = p.animals.robot }), { taken }).join('|'), /animals\.penguin: the name "penguin" is taken already/)
  assert.match(validate(pack(p => { p.id = 'cachito' }), { taken }).join('|'), /id: "cachito" is taken already/)

  // two packs in the folder: the second takes a name of the first and is left out whole; a third with its own names gets in
  const found = install([file('a.json', pack()), file('b.json', pack(p => { p.id = 'other'; delete p.animals; delete p.coats })), file('c.json', pack(p => { p.id = 'third'; delete p.animals; delete p.coats; p.items = { bowler: p.items.tophat } })), file('d.json', pack())])
  assert.deepEqual(found.map(f => [f.file, f.id, f.errors.length]), [['a.json', 'example', 0], ['b.json', '', 1], ['c.json', 'third', 0], ['d.json', '', 4]])
  assert.deepEqual(found[1]?.errors, ['items.tophat: the name "tophat" is taken already'])
  assert.match(String(found[3]?.errors[0]), /^id: "example" is taken already$/)
  assert.deepEqual(Object.keys(REG.items).slice(-2), ['tophat', 'bowler'])
  install([])
})

test('no folder, an empty one, unreadable and broken files: the shipped drawings stay as they are and nothing is thrown', () => {
  const before = JSON.stringify([REG.species, REG.items, REG.coats])
  assert.deepEqual(install([]), [])
  assert.equal(JSON.stringify([REG.species, REG.items, REG.coats]), before)
  const found = install([{ file: 'gone.json', error: 'could not be read' }, file('half.json', '{'), file('bad.json', pack(p => { p.animals.robot.palette.B = 'red' }))])
  assert.deepEqual(found.map(f => f.errors.length > 0), [true, true, true])
  assert.equal(JSON.stringify([REG.species, REG.items, REG.coats]), before) // not one thing of a refused pack is used
  assert.equal(WEARABLE.some(i => i.pack), false)
  // more files than the folder may hold: the rest is not read
  const lots = install(Array.from({ length: LIMITS.packs + 1 }, (_, i) => file(`p${i}.json`, pack(p => { p.id = `p${i}`; delete p.animals; delete p.coats; p.items = { [`hat${i}`]: p.items.tophat } }))))
  assert.match(String(lots.at(-1)?.errors[0]), /more than 16 packs/)
  assert.equal(lots.filter(f => !f.errors.length).length, LIMITS.packs)
  install([])
})

test('what a pack brings is the person\'s at once: in the closet for nothing, worn by choice, gone with the pack', () => {
  install([file('a.json', EXAMPLE)])
  const s = initialState(), closet = view(s, 0).closet
  assert.deepEqual(closet, ['tophat', 'mint'])
  assert.deepEqual([s.owned, s.coins], [[], 0]) // not bought, no stars given or taken
  assert.deepEqual(WEARABLE.filter(i => i.pack).map(i => [i.id, i.slot, i.price, i.pack]), [['tophat', 'head', 0, 'Example'], ['mint', 'coat', 0, 'Example']])
  assert.deepEqual(wornOf(closet, ''), []) // never put on by itself, unlike the last thing bought of earlier versions
  assert.deepEqual(wornOf(closet, putOn(closet, '', 'tophat')), ['tophat'])
  assert.deepEqual(wornOf(closet, putOn(closet, 'tophat', 'mint')), ['tophat', 'mint'])
  assert.deepEqual(wornOf(closet, takeOff(closet, 'tophat mint', 'none')), ['mint']) // a coat is a colour: it stays
  assert.deepEqual(wornOf(closet, turnSlot(closet, 'tophat mint', 'coat')), ['tophat'])
  // with the golden coat owned too: the pack's coat goes over it when picked, and plain takes either off
  const both = closetOf(['golden'], 'healthy')
  assert.deepEqual(wornOf(both, ''), ['golden'])
  const minted = putOn(both, '', 'mint')
  assert.deepEqual([minted, wornOf(both, minted)], ['mint plain', ['mint']])
  assert.deepEqual(wornOf(both, takeOff(both, minted, 'mint')), [])
  assert.deepEqual(wornOf(both, turnSlot(both, minted, 'coat')), [])
  // the pack is taken away: what it brought is nobody's, and a choice that named it means nothing
  install([])
  assert.deepEqual(view(s, 0).closet, [])
  assert.deepEqual(wornOf(view(s, 0).closet, 'tophat mint'), [])
})

test('a thing on an animal: drawn by hand where the pack knows it, else set by the animal\'s anchors', () => {
  const a = { top: 2, eyes: /** @type {[number, number][]} */ ([[4, 3], [4, 8]]), neck: 7 }
  const at = (/** @type {string} */ anchor, art = ['uu'], more = {}) => place([{ anchor, art, ...more }], a).map(([r, c]) => [r, c])
  assert.deepEqual(at('head'), [[1, 5], [1, 6]]) // its last row right over the head, centred between the eyes
  assert.deepEqual(at('head', ['u', 'u']), [[0, 6], [1, 6]])
  assert.deepEqual(at('face'), [[4, 5], [4, 6]])
  assert.deepEqual(at('neck'), [[7, 5], [7, 6]])
  assert.deepEqual(at('feet'), [[9, 5], [9, 6]])
  assert.deepEqual(at('under'), [[10, 5], [10, 6]])
  assert.deepEqual(at('left'), [[9, -3], [9, -2]]) // on the ground, an empty column from the body
  assert.deepEqual(at('right'), [[9, 13], [9, 14]])
  assert.deepEqual(at('head', ['uu'], { dx: 2, dy: -1 }), [[0, 7], [0, 8]])
  assert.deepEqual(at('head', ['u', 'u', 'u', 'u', 'u', 'u']), [[-2, 6], [-1, 6], [0, 6], [1, 6]]) // what is out of reach of the frame is left out

  install([file('a.json', pack(p => { p.items.tophat.draw = { fox: { adult: { at: [-2, 3], art: ['uuuuuu'] } } } }))])
  assert.deepEqual(marksFor('tophat', 'fox', 'adult'), [-2, -2, -2, -2, -2, -2].map((r, i) => [r, 3 + i, 'u'])) // by hand
  assert.equal(marksFor('tophat', 'fox', 'baby').length, 14) // the fallback, on the baby's own anchors
  assert.deepEqual([...new Set(marksFor('tophat', 'robot', 'adult').map(m => m[0]))], [-2, -1]) // over the robot's head, which starts at the top row: the hat's first row is out of reach
  // a shipped thing on the pack's animal: its fallback, inside the frame, the sunglasses on the eyes
  assert.deepEqual(marksFor('shades', 'robot', 'adult'), [3, 4, 5, 6, 7, 8].map(c => [3, c, 'S']))
  for (const id of Object.keys(BUILTIN.items)) {
    const marks = marksFor(id, 'robot', 'adult')
    assert.ok(marks.length > 0, id)
    for (const [r, c] of marks) assert.ok(r >= -2 && r < zoo.height + zoo.under && c >= -zoo.side && c < zoo.width + zoo.side, id)
  }
  assert.deepEqual(marksFor('nothing', 'fox', 'adult'), [])
  install([])
})

test('a coat on an animal: its own tint for it, else its colours set on the coat\'s ramp, light and dark kept apart', () => {
  install([file('a.json', EXAMPLE)])
  const golden = coatOf('golden', 'fox')
  assert.equal(golden?.palette, BUILTIN.species.fox?.tints.golden) // drawn for it
  assert.equal(golden?.edge, zoo.pack.coats.golden.ramp[0])
  const mint = coatOf('mint', 'penguin')
  assert.deepEqual(Object.keys(mint?.palette ?? {}).sort(), ['1', '2', 'B', 'W', 'a', 'o']) // every colour of the body that can change; eyes, cheeks and the fixed ones stay
  assert.equal(mint?.palette.W, '#aadcd7') // white: near the light end
  assert.equal(mint?.palette.B, '#29998d') // dark slate: near the dark end
  assert.equal(mint?.edge, '#00796b')
  // the golden coat on the pack's animal, which has no tint for it: the ramp
  assert.match(String(coatOf('golden', 'robot')?.palette.B), /^#f[0-9a-f]{5}$/)
  assert.equal(coatOf('nothing', 'fox'), null)
  install([])
})

test('security: nothing a stranger\'s pack says reaches the terminal raw: every fault told, and the file\'s name, are made safe where they are written', () => {
  const raw = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Zl}\p{Zp}]/u // an escape sequence, a C1 control (U+009B is CSI in one character), a hidden mark
  const ESC = '\u001b[2J\u001b]0;owned\u0007', C1 = '\u009b31m'
  /** @type {[string, (p: any) => void, RegExp][]} */ const cases = [
    ['a field nobody knows', p => { p[`${ESC}x${C1}`] = 1 }, /^pack: unknown field "/],
    ['a pack id', p => { p.id = `ab${ESC}` }, /^id: /],
    ['the name of an item', p => { p.items[`${C1}hat${ESC}`] = p.items.tophat }, /^items\..*a name is/],
    ['a colour key of a frame', p => { const f = p.animals.robot.states.adult.frames[0]; f[0] = '\u009b' + f[0].slice(1) }, /uses a colour key the palette lacks: "/],
    ['a colour key of a thing', p => { const a = p.items.tophat.fallback[0].art; a[0] = '\u009b' + a[0].slice(1) }, /a thing is drawn with the fixed colours only/],
    ['a colour key of a palette', p => { p.animals.robot.palette['\u009b'] = '#000000' }, /a colour key is one letter or digit/],
    ['the name of a tint', p => { p.animals.robot.tints = { [`${ESC}t`]: {} } }, /tints\..*: not a name$/],
    ['the name of a state', p => { p.animals.robot.states[`${ESC}${C1}`] = { frames: [] } }, /states\..*: not a state/],
    ['the name of a gesture', p => { p.animals.robot.states.adult.idle = { [`${C1}g`]: { frames: [] } } }, /idle\..*: not a name$/],
    ['who wears a thing by hand', p => { p.items.tophat.draw = { [`${ESC}who`]: {} } }, /draw\..*: not a name$/],
  ]
  for (const [what, change, want] of cases) {
    const errors = validate(pack(change), { taken })
    assert.ok(errors.some(e => want.test(e)), `${what}: ${JSON.stringify(errors)}`)
    assert.deepEqual(errors.filter(e => raw.test(e)), [], what)
  }
  // the message of JSON.parse quotes the text of the file
  const broken = parse(`{ "format": ${ESC}${C1}`, {}).errors
  assert.match(String(broken[0]), /^file: not JSON \(/)
  assert.deepEqual(broken.filter(e => raw.test(e)), [])
  // the folder: the name of the file and why it could not be read
  const found = install([{ file: `a${ESC}${C1}.json`, error: `EACCES${ESC}` }, file(`b${C1}${ESC}.json`, pack(p => { p[`${ESC}`] = 1 })), file(`c${ESC}.json`, pack())])
  assert.deepEqual(found.map(f => f.file), ['a 31m.json', 'b 31m.json', 'c.json'])
  assert.deepEqual(found.flatMap(f => [f.file, ...f.errors]).filter(t => raw.test(t)), [])
  assert.deepEqual(found.map(f => f.errors.length > 0), [true, true, false])
  install([])
})

test('security: a name every object has of itself (constructor) is no name of a pack, and a lookup by name finds only what is there', () => {
  // as a coat, an item, an animal, the pack's id, a tint, a gesture: refused
  for (const [what, change, want] of /** @type {[string, (p: any) => void, RegExp][]} */ ([
    ['a coat', p => { p.coats.constructor = p.coats.mint }, /^coats\.constructor: a name is/],
    ['an item', p => { p.items.constructor = p.items.tophat }, /^items\.constructor: a name is/],
    ['an animal', p => { p.animals.constructor = p.animals.robot }, /^animals\.constructor: a name is/],
    ['the pack', p => { p.id = 'constructor' }, /^id: must be/],
    ['a tint', p => { p.animals.robot.tints = { constructor: {} } }, /tints\.constructor: not a name$/],
    ['a gesture', p => { p.animals.robot.states.adult.idle = { constructor: { frames: p.animals.robot.states.adult.frames } } }, /idle\.constructor: not a name$/],
    ['who wears a thing by hand', p => { p.items.tophat.draw = { constructor: {} } }, /draw\.constructor: not a name$/],
  ])) {
    const errors = validate(pack(change), { taken })
    assert.ok(errors.some(e => want.test(e)), `${what}: ${errors.join(' | ')}`)
  }
  // asked for by that name (/pet wear constructor, a kept choice written by hand): nothing is found
  install([file('a.json', EXAMPLE)])
  for (const name of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
    assert.equal(coatOf(name, 'fox'), null, name)
    assert.equal(coatOf('golden', name), null, name)
    assert.deepEqual(marksFor(name, 'fox', 'adult'), [], name)
    assert.deepEqual(marksFor('tophat', name, 'adult'), [], name)
  }
  // a tint of that name is not taken for the coat's: the ramp is used, and what comes out is colours
  REG.coats.constructor = REG.coats.mint
  const got = coatOf('constructor', 'penguin')
  assert.equal(typeof got?.palette, 'object')
  assert.ok(Object.values(got?.palette ?? {}).every(c => /^#[0-9a-f]{6}$/.test(c)))
  install([])
})

test('security: a text of a pack follows the rule of every text from outside: no marks piled on a character, no unassigned code point, no spaces in a row', () => {
  for (const [what, name] of [['marks piled up', 'Zá̂̃̄̅lgo'], ['an unassigned code point', 'Ro͸bot'], ['a mark with no character', '́Robot'], ['a private use character', 'Robot'], ['a tab', 'Ro\tbot'], ['two spaces', 'Ro  bot']]) {
    for (const change of /** @type {((p: any) => void)[]} */ ([p => { p.name = name }, p => { p.animals.robot.name.en = name }, p => { p.credits = { author: name } }])) {
      const errors = validate(pack(change), { taken })
      assert.ok(errors.some(e => /: holds a control, an invisible or an unassigned character, marks piled on one character, or spaces in a row$/.test(e)), `${what}: ${errors.join(' | ')}`)
    }
  }
  // a script that needs its marks keeps them: up to three on a character
  assert.deepEqual(validate(pack(p => { p.name = 'Việt  é'.replace('  ', ' ') }), { taken }), [])
})
