// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import zoo from '../sprites/zoo.js'
import { validate, parse, compile, install, place, marksFor, coatOf, snore, portrait, REG, BUILTIN, LIMITS, FORMAT, YOUNG } from './skins.js'
import { SHOP, COATS, WEARABLE, GOLDENEGG, closetOf, wornOf, putOn, takeOff, turnSlot, view, initialState } from './engine.js'

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
  assert.deepEqual(Object.entries(BUILTIN.items).map(([id, i]) => [id, i.slot]), [...SHOP, GOLDENEGG].map(i => [i.id, i.slot])) // what is sold, then the founder's golden egg
  assert.deepEqual(Object.keys(BUILTIN.coats), COATS.map(i => i.id))
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
    ['another format', p => { p.format = 2 }, /^format: this Hatchling reads format 1$/],
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
    ['a pixel of no colour', p => { p.animals.robot.states.adult.frames[0][1] = '..BBBBQQBB..' }, /uses a colour key the palette lacks: "Q"$/],
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
  assert.match(validate(pack(p => { p.id = 'hatchling' }), { taken }).join('|'), /id: "hatchling" is taken already/)

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
  const s = initialState(1), closet = view(s, 0).closet
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
  assert.deepEqual(Object.keys(mint?.palette ?? {}).sort(), ['1', '2', '3', 'B', 'W', 'a', 'o']) // every colour of the body that can change; eyes, cheeks and the fixed ones stay
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

test('every thing of the shop is drawn by hand for every animal of the shipped pack, the hidden one too, adult and baby', () => {
  install([])
  const animals = Object.keys(zoo.pack.animals)
  assert.deepEqual([Object.keys(zoo.pack.items), animals.length], [[...SHOP, GOLDENEGG].map(i => i.id), 7])
  for (const [id, item] of Object.entries(zoo.pack.items)) {
    assert.equal(item.part, [...SHOP, GOLDENEGG].find(i => i.id === id)?.slot, id)
    assert.ok(item.fallback.length > 0, id) // and by its anchors on an animal of a pack
    assert.deepEqual(Object.keys(item.draw), animals, id)
    for (const animal of animals) for (const body of /** @type {const} */ (['adult', 'baby'])) {
      const d = /** @type {Record<string, Record<string, { at: number[], art: string[] }>>} */ (item.draw)[animal]?.[body], marks = marksFor(id, animal, body)
      assert.ok(d && d.art.length > 0 && marks.length >= 4, `${id} on the ${body} ${animal}`) // a drawing, not a dot
      assert.equal(marks.length, d.art.join('').replaceAll('.', '').length) // the hand-made one is what is drawn, not the fallback
      for (const [r, c, ch] of marks) assert.ok(r >= -2 && r < zoo.height + zoo.under && c >= -zoo.side && c < zoo.width + zoo.side && zoo.fixed.includes(ch), `${id} on the ${body} ${animal}`)
    }
  }
  // a head thing never reaches the eyes, so it goes with glasses or the eye patch; a thing of the face never leaves the head's rows
  for (const [name, a] of Object.entries(zoo.pack.animals)) for (const body of /** @type {const} */ (['adult', 'baby'])) {
    const eye = /** @type {number} */ (a.anchors[body].eyes[0]?.[0])
    for (const i of SHOP.filter(i => i.slot === 'head' && i.id !== 'headphones')) assert.ok(marksFor(i.id, name, body).every(m => m[0] < eye), `${i.id} on the ${body} ${name}`)
    for (const i of SHOP.filter(i => i.slot === 'face')) assert.ok(marksFor(i.id, name, body).every(m => Math.abs(m[0] - eye) <= 1), `${i.id} on the ${body} ${name}`)
  }
})

test('the plain coats: a tint drawn for every shipped animal with the eyes on a light tone, the ramp for an animal of a pack, the same edge on a light theme as the golden one', () => {
  install([file('a.json', EXAMPLE)])
  const luma = (/** @type {string} */ h) => 0.299 * parseInt(h.slice(1, 3), 16) + 0.587 * parseInt(h.slice(3, 5), 16) + 0.114 * parseInt(h.slice(5, 7), 16)
  for (const coat of ['pastel', 'terminal']) {
    const ramp = /** @type {Record<string, { ramp: string[] }>} */ (zoo.pack.coats)[coat]?.ramp ?? []
    assert.ok(ramp.length === 3 && luma(String(ramp[0])) < luma(String(ramp[1])) && luma(String(ramp[1])) < luma(String(ramp[2])), coat) // dark to light
    for (const [name, a] of Object.entries(zoo.pack.animals)) {
      const c = coatOf(coat, name), tint = /** @type {Record<string, Record<string, string>>} */ (a.tints)[coat]
      assert.ok(tint && Object.keys(tint).length > 0, `${coat} on the ${name}`)
      assert.deepEqual([c?.palette, c?.edge], [tint, ramp[0]]) // the path of every coat: its tint, and the coat's darkest colour for the edge
      assert.equal(a.gold[coat], undefined) // no glint, no sparkle: those are the golden coat's
      // the face stays readable: each eye has a far lighter tone next to it, and nothing next to it is nearly as dark (an ear may be), on the adult and on the baby
      const pal = /** @type {Record<string, string>} */ ({ ...zoo.common, ...a.palette, ...tint })
      for (const body of /** @type {const} */ (['adult', 'baby'])) for (const [r, col] of a.anchors[body].eyes) {
        const frame = /** @type {string[]} */ (a.states[body].frames[0]), row = String(frame[r])
        assert.equal(row[col], 'k')
        const apart = [row[col - 1], row[col + 1]].map(ch => luma(String(pal[String(ch)])) - luma(zoo.common.k))
        assert.ok(Math.max(...apart) > 90 && Math.min(...apart) > 50, `${coat} on the ${body} ${name}: ${apart}`)
      }
    }
    // an animal of a pack has no tint for it: its colours on the ramp
    assert.match(String(coatOf(coat, 'robot')?.palette.B), /^#[0-9a-f]{6}$/)
    assert.equal(coatOf(coat, 'robot')?.edge, ramp[0])
  }
  install([])
})

test('a pack may not reuse the name of a thing or a coat of the shop, the new ones too', () => {
  for (const id of [...SHOP.map(i => i.id), ...COATS.map(i => i.id)]) {
    assert.match(validate(pack(p => { p.items[id] = p.items.tophat }), { taken }).join('\n'), new RegExp(`the name "${id}" is taken already`), id)
  }
})

test('the redraws of the second pass: brown boots with a darker sole, glasses that stay on the face and leave the eyes seen, a strap that shows on a dark head, a face under the terminal coat', () => {
  install([])
  const dark = (/** @type {string} */ hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0) }
  for (const [name, a] of Object.entries(/** @type {Record<string, any>} */ (zoo.pack.animals))) for (const body of /** @type {const} */ (['adult', 'baby'])) {
    const base = /** @type {string[]} */ (a.states[body].frames[0]), eyes = /** @type {[number, number][]} */ (a.anchors[body].eyes), at = `${name} ${body}`
    const inside = (/** @type {number} */ r, /** @type {number} */ c) => (base[r]?.[c] ?? '.') !== '.'
    // boots: the leg brown, the sole under it darker and a pixel longer at the toe, at least two rows in all; never green
    const boots = marksFor('boots', name, body), rows = [...new Set(boots.map(m => m[0]))].sort((x, y) => x - y)
    assert.deepEqual([...new Set(boots.map(m => m[2]))].sort(), ['N', 'n'], at)
    assert.ok(rows.length >= 2 && boots.filter(m => m[0] === rows.at(-1)).every(m => m[2] === 'N') && boots.filter(m => m[0] !== rows.at(-1)).every(m => m[2] === 'n'), at)
    assert.ok(boots.filter(m => m[2] === 'N').length > boots.filter(m => m[0] === rows.at(-2)).length, at)
    // glasses: a dark frame, every pixel of it on the body (nothing above the head), no pixel on an eye, and a frame at both sides of each eye
    const glasses = marksFor('glasses', name, body)
    assert.ok(glasses.length > 0 && glasses.every(m => m[2] === 'n' && inside(m[0], m[1])), at)
    for (const [r, c] of eyes) { assert.ok(!glasses.some(m => m[0] === r && m[1] === c), at); assert.ok([-1, 1].every(d => glasses.some(m => m[0] === r && m[1] === c + d)), at) }
    // the eye patch: its strap is never the body's own darkness
    const strap = marksFor('eyepatch', name, body).filter(m => m[0] < (eyes[0]?.[0] ?? 0))
    assert.ok(strap.length > 0, at)
    for (const [r, c, ch] of strap) assert.ok(Math.abs(dark(/** @type {any} */ (zoo.common)[ch]) - dark({ ...zoo.common, ...a.palette }[/** @type {string} */ (base[r]?.[c])] ?? '#000000')) > 25, `${at} ${r},${c}`)
    // the terminal coat: the eyes keep their near black, and what is next to an eye is a green lighter than it by far: the darkest of the three at least
    const tint = { ...zoo.common, ...a.palette, ...a.tints.terminal }
    assert.equal(tint.k, '#1b1b1b', at)
    for (const [r, c] of eyes) for (const [dr, dc] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) { const ch = base[r + (dr ?? 0)]?.[c + (dc ?? 0)]; if (ch && ch !== '.' && ch !== 'k') assert.ok(dark(tint[ch]) > 75, `${at}: ${ch} next to an eye`) }
  }
  // the founder's golden egg: on every animal and body the same small whole egg, narrower at its top, in three golds (the gold, one
  // highlight, one darker shade), standing on the ground at the pet's right with an empty column between them
  const EGG = ['..yy..', '.yxyy.', 'yxyyyK', 'yxyyyK', 'yyyyKK', 'yyyKKK', '.KKKK.']
  assert.deepEqual(zoo.pack.items.goldenegg.fallback, [{ anchor: 'right', art: EGG }])
  assert.deepEqual([...new Set(EGG.join(''))].sort(), ['.', 'K', 'x', 'y'])
  for (const [animal, d] of Object.entries(zoo.pack.items.goldenegg.draw)) for (const body of /** @type {const} */ (['adult', 'baby'])) {
    assert.deepEqual([d[body]?.art, d[body].at[0] + EGG.length], [EGG, zoo.height], `${animal} ${body}`) // on the ground
    const frames = Object.values(zoo.pack.animals[/** @type {keyof typeof zoo.pack.animals} */ (animal)].states).flatMap(st => /** @type {string[][]} */ ([...st.frames, ...st.rare]))
    const reach = Math.max(...frames.flatMap(f => f.map(row => row.length))) // the widest frame of the pet, its effects too
    assert.ok(d[body].at[1] > zoo.width && d[body].at[1] >= reach - 1, `${animal} ${body}: the egg and the body never share a pixel`)
    const { rows } = portrait(animal, body, ['goldenegg']), bare = portrait(animal, body, []).rows
    assert.deepEqual([rows.slice(-bare.length).map(r => r.slice(1, 1 + zoo.width)), rows.every(r => r[1 + zoo.width] === '.')], [bare, true], `${animal} ${body}: the body as with nothing on, and an empty column before the egg`)
  }
  // on a light theme the gold and its shade are darker, the shade still the darker of the two
  const lum = (/** @type {string} */ h) => [1, 3, 5].reduce((n, i, k) => n + parseInt(h.slice(i, i + 2), 16) * /** @type {number} */ ([0.299, 0.587, 0.114][k]), 0)
  for (const pal of [zoo.common, { ...zoo.common, ...zoo.light }]) assert.ok(lum(pal.x) > lum(pal.y) && lum(pal.y) > lum(pal.K) + 15, JSON.stringify([pal.x, pal.y, pal.K]))
})

test('every shipped animal has the baby\'s own drawing of the sleep and of each mood, the body the baby\'s and placed, so it wears as awake', () => {
  for (const [id, sp] of Object.entries(BUILTIN.species)) {
    const baby = sp.states.baby.frames[0].join('').replace(/\./g, '').length
    for (const mood of YOUNG) {
      const st = sp.states[`baby-${mood}`]
      assert.ok(st && st.frames.length >= 1 && Array.isArray(st.at), `${id} baby-${mood}`)
      // the baby's pixels, give or take the marks of the mood: far from the grown body's count
      const grown = sp.states[mood].frames[0].join('').replace(/\./g, '').length, own = st.frames[0].join('').replace(/\./g, '').length
      assert.ok(Math.abs(own - baby) < Math.abs(own - grown), `${id} baby-${mood} is drawn from the baby`)
    }
  }
})

test('the Zs of the sleep are beside the head, never over it: no shipped drawing of the sleep has them, and `snore` adds columns at the right and no row', () => {
  for (const [id, sp] of Object.entries(BUILTIN.species)) for (const name of ['sleep', 'baby-sleep']) {
    const st = sp.states[name]
    assert.equal(st.frames.length, 2, `${id} ${name}`) // two frames all the same: the small z, then with the large one
    for (const f of st.frames) {
      const top = f.findIndex(r => /[^.]/.test(r)), wide = f[0].length
      assert.ok(!f.join('').includes('w'), `${id} ${name}: a Z drawn in`)
      const [small, large] = [snore(f, 0), snore(f, 1)]
      for (const z of [small, large]) {
        assert.deepEqual([z.length, z[0].length <= wide + 9, new Set(z.map(r => r.length)).size], [f.length, true, 1], `${id} ${name}`)
        assert.equal(z.findIndex(r => /[^.]/.test(r)), top, `${id} ${name}: over the head`) // nothing above the topmost pixel of the pet
        z.forEach((r, y) => { assert.equal(r.slice(0, wide).replace(/w/g, '.'), f[y].replace(/w/g, '.')); [...r].forEach((ch, x) => { if (ch === 'w' && f[y][x] !== 'w') assert.ok(f[y].slice(x - 1, x + 2).replace(/\./g, '') === '', `${id} ${name}: a Z on the body`) }) })
      }
      assert.equal(small[0].length, large[0].length) // as wide on both frames: the pet does not step aside
      assert.ok(large.join('').split('w').length > small.join('').split('w').length)
    }
  }
})
