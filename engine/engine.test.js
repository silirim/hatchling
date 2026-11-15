import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, reduce, view, card, dayOf, shared, merge, RULES, SHOP, SOLD, COATS, GOLDEN, SLOTS, WEARABLE, EGGSHELL, FOUNDER_UNTIL, founder, birth, sells, closetOf, wornOf, putOn, takeOff, turnSlot } from './engine.js'
import { existsSync } from 'node:fs'
import { bubble, CHEERS, ISSUES, CALM, DOCS } from './catalog.js'

// the roll is always given: left out, one pet in a hundred is born golden and owns the coat, and a test fails one run in a hundred
const run = (events, s = initialState(1)) => events.reduce(reduce, s)
let t = 1_000_000
const at = (e) => ({ t: (t += 1000), ...e })
const usage = (input, cacheRead, cacheWrite, contextPct) => at({ type: 'usage', input, cacheRead, cacheWrite, contextPct })
// a turn of a long chat without lean: a note, like the others
const DAY = 86_400_000
const heavyTurn = () => [usage(100, RULES.heavyTokens, 0), at({ type: 'turnEnd' })]
const small = () => usage(100, 1000, 0)

test('re-reading an unchanged file makes it dizzy; a changed one does not', () => {
  let s = run([at({ type: 'sessionStart' }), at({ type: 'read', path: '/a.js', mtime: 1 }), at({ type: 'read', path: '/a.js', mtime: 2 })])
  assert.equal(view(s, t).mood, 'seedling') // a new pet starts as a seedling
  s = run([at({ type: 'read', path: '/a.js', mtime: 2 })], s)
  assert.equal(view(s, t).mood, 'dizzy')
})

test('compaction makes re-reads legitimate again', () => {
  const s = run([at({ type: 'sessionStart' }), at({ type: 'read', path: '/a', mtime: 1 }), at({ type: 'compact' }), at({ type: 'read', path: '/a', mtime: 1 })])
  assert.equal(view(s, t).issue, null)
})

test('third consecutive failure of the same command is a loop, shown as a note', () => {
  let s = run([at({ type: 'sessionStart' }), ...[1, 2].map(() => at({ type: 'cmd', cmd: 'npm  test', ok: false }))])
  assert.equal(view(s, t).issue, null)
  s = run([at({ type: 'cmd', cmd: 'npm test', ok: false })], s)
  assert.equal(view(s, t).mood, 'loop')
  s = run([at({ type: 'cmd', cmd: 'npm test', ok: true }), at({ type: 'turnEnd' })], s)
  assert.equal(s.cheer, null) // passing again measures nothing: no cheer
})

test('first request writes the cache by design; a later big write is a cache break', () => {
  let s = run([at({ type: 'sessionStart' }), usage(500, 0, 30000)])
  assert.equal(view(s, t).issue, null)
  s = run([usage(500, 29000, 1000), usage(500, 1000, 30000)], s)
  assert.equal(view(s, t).mood, 'stomach')
  assert.match(bubble(view(s, t)).say, /^cache rebuilt: the prompt/)
})

test('the view gives the weight of the chat: what the last request re-read, the number the long-chat rule uses', () => {
  let s = run([at({ type: 'sessionStart' })])
  assert.equal(view(s, t).context, 0) // nothing to show yet
  s = run([usage(100, 40_000, 900)], s)
  assert.deepEqual([view(s, t).context, view(s, t).long], [41_000, false])
  s = run([usage(100, RULES.heavyTokens - 100, 0)], s) // each request replaces it
  assert.deepEqual([view(s, t).context, view(s, t).long], [RULES.heavyTokens, true])
  assert.equal(view(run([at({ type: 'compact' })], s), t).context, 0)
  assert.equal(view(run([at({ type: 'sessionEnd' }), at({ type: 'sessionStart' })], s), t).context, 0) // as after /clear
  assert.equal('hit' in view(s, t), false)
})

test('the rebuild right after a compaction is not a break', () => {
  const s = run([at({ type: 'sessionStart' }), usage(500, 0, 30000), at({ type: 'compact' }), usage(500, 0, 30000)])
  assert.equal(view(s, t).issue, null)
})

test('context over the threshold is bloated, with the percentage in the bubble', () => {
  const s = run([at({ type: 'sessionStart' }), usage(100, 9000, 100, 91)])
  assert.equal(view(s, t).mood, 'bloated')
  assert.equal(bubble(view(s, t)).say, 'context 91% full')
})

test('issues clear after their turns; a cheer is held as a still pose until the next prompt', () => {
  let s = run([at({ type: 'sessionStart' }), ...heavyTurn()])
  s = run([small(), at({ type: 'turnEnd' }), at({ type: 'turnEnd' })], s)
  assert.equal(view(s, t).issue?.kind, 'heavy') // two turns passed, but too fast to have been seen
  t += RULES.issueMinMs
  assert.equal(view(s, t).issue, null)
  s = run([...heavyTurn(), at({ type: 'lean', on: true })], s)
  assert.equal(view(s, t).mood, 'cheer')
  const held = view(s, t + RULES.cheerShowMs) // still shown, as a still pose, until the next prompt
  assert.deepEqual([held.mood, held.animate], ['cheer', false])
  s = run([at({ type: 'prompt' })], s)
  assert.equal(view(s, t + RULES.cheerShowMs).mood, 'seedling')
})

test('a rate-limited cheer is kept and shown later', () => {
  // lean is turned on, and right after it the turn that makes the pet grow ends: one cheer now, the other after the wait
  const g = RULES.grownAt
  let s = run([at({ type: 'sessionStart' }), ...heavyTurn(), at({ type: 'lean', on: true })], { ...initialState(0.5), ...g, affection: g.affection - 2, day: dayOf(t) })
  s = run([at({ type: 'turnEnd' })], s)
  assert.deepEqual([s.cheer?.kind, s.queued?.kind], ['lean', 'evolve'])
  t += RULES.cheerGapMs
  assert.equal(run([at({ type: 'turnEnd' })], s).cheer?.kind, 'evolve')
})

test('the pet loses nothing: a long chat without lean, re-reads and loops are notes, and coins and affection only grow', () => {
  let s = run([at({ type: 'sessionStart' })])
  const fail = () => at({ type: 'cmd', cmd: 'npm test', ok: false }), moods = new Set()
  for (let i = 0; i < 40; i++) {
    const was = s
    s = run([at({ type: 'read', path: '/a', mtime: 1 }), fail(), ...heavyTurn()], s)
    assert.ok(s.coins >= was.coins && s.affection >= was.affection)
    moods.add(view(s, t).mood)
  }
  assert.deepEqual([...moods].filter(m => /ko|sad|wilted/.test(m)), [])
  assert.deepEqual(['health', 'ko', 'drowned'].filter(k => k in s || k in view(s, t) || k in card(s)), [])
})

test('coins: 1 a turn up to 30 a day, 2 a cuddle up to 3 a day, 5 at the first use of a day; no streak; affection follows and is never spent', () => {
  t = 400 * DAY + DAY / 2 // noon: the same day in any time zone
  let s = run([at({ type: 'sessionStart' }), at({ type: 'prompt' })])
  assert.deepEqual([s.coins, s.days], [0, 0]) // opening a chat is not use yet
  s = run([at({ type: 'turnEnd' })], s)
  assert.deepEqual([s.coins, s.affection, s.days], [RULES.coinsFirstUse + 1, RULES.coinsFirstUse + 1, 1])
  s = run(Array.from({ length: 40 }, () => at({ type: 'turnEnd' })), s)
  assert.equal(s.coins, 5 + 30)
  s = run(Array.from({ length: 5 }, () => at({ type: 'cuddle' })), s)
  assert.deepEqual([s.coins, s.affection], [5 + 30 + 6, 41])
  t += DAY // the next day earns the same again, and nothing more for coming two days in a row
  s = run([at({ type: 'cuddle' })], s)
  assert.deepEqual([s.coins, s.days], [41 + 5 + 2, 2])
  t += 5 * DAY // days away take nothing
  const later = run([at({ type: 'turnEnd' })], s)
  assert.deepEqual([later.coins, later.affection, later.days], [48 + 6, 48 + 6, 3])
  // buying spends coins, never affection; a thing owned, unknown or too dear is not bought
  const bought = run([at({ type: 'buy', id: 'shades' })], later)
  assert.deepEqual([bought.coins, bought.affection, bought.owned, view(bought, t).owned], [54 - RULES.prices.shades, 54, ['shades'], ['shades']])
  for (const id of ['shades', 'yacht', 'sombrero']) assert.deepEqual(run([at({ type: 'buy', id })], bought), bought)
})

test('the shop: every price is in RULES, the first buy comes within a first session and any item within three days', () => {
  assert.deepEqual(SHOP.map(i => i.id).sort(), Object.keys(RULES.prices).sort())
  for (const i of SHOP) assert.equal(i.price, RULES.prices[i.id])
  const prices = SHOP.map(i => i.price), day = RULES.coinsFirstUse + RULES.coinsTurn * RULES.coinTurnsDay + RULES.coinsCuddle * RULES.coinCuddlesDay
  assert.ok(Math.min(...prices) <= RULES.coinsFirstUse + 10 * RULES.coinsTurn) // ten turns of a first session
  assert.ok(Math.max(...prices) <= 3 * day && prices.filter(n => n > day).length >= 4) // the usual one takes more than a full day, none more than three
})

test('the pet grows with the days it was used on and the affection gathered, not with the cache', () => {
  const g = RULES.grownAt, b = RULES.bloomAt, born = initialState(0.5)
  const moods = [born, { ...born, ...g }, { ...born, ...b }, { ...born, ...g, days: g.days - 1 }, { ...born, ...g, affection: g.affection - 1 }].map(s => view(s, t).mood)
  assert.deepEqual(moods, ['seedling', 'healthy', 'bloom', 'seedling', 'seedling'])
  // a chat answered from the cache all along: no cheer for it (nothing the person did, and the usual case), and no growth
  const reqs = Array.from({ length: 20 }, () => usage(100, 9500, 400))
  const cached = run([at({ type: 'sessionStart' }), ...reqs, at({ type: 'sessionEnd' })], born)
  assert.deepEqual([view(cached, t).mood, cached.cheer, cached.queued, card(cached).stage], ['seedling', null, null, 'seedling'])
  assert.deepEqual([card(born).next, card({ ...born, ...g }).next, card({ ...born, ...b }).next], [g, b, null])
  // the turn that crosses the line is cheered
  t += RULES.cheerGapMs
  let s = run([at({ type: 'sessionStart' }), at({ type: 'turnEnd' })], { ...born, ...g, affection: g.affection - 1, day: dayOf(t) })
  assert.deepEqual([s.cheer?.kind, bubble(view(s, t)).say], ['evolve', 'grew a stage'])
  s = run([at({ type: 'prompt' })], s)
  assert.equal(view(s, t + RULES.cheerShowMs).mood, 'healthy')
})

test('the humour: content after a cuddle or a day of much use, calm otherwise, never sad; hearts fill with affection and never empty', () => {
  let s = run([at({ type: 'sessionStart' })])
  assert.deepEqual([view(s, t).happy, view(initialState(1), 1000).happy], [false, false]) // never cuddled is not cuddled at time zero
  s = run([at({ type: 'cuddle' })], s)
  assert.deepEqual([view(s, t).happy, view(s, t + RULES.happyCuddleMs).happy], [true, false])
  const busy = run(Array.from({ length: RULES.happyTurns }, () => at({ type: 'turnEnd' })), run([at({ type: 'sessionStart' })]))
  assert.deepEqual([view(busy, t).happy, view(busy, t + 30 * DAY).happy], [true, false])
  assert.deepEqual([view(busy, t).hearts, view(busy, t + 30 * DAY).hearts], [1, 1]) // a month away: calm, and nothing lost
  assert.deepEqual([0, ...RULES.heartsAt].map(affection => view({ ...initialState(1), affection }, t).hearts), [0, 1, 2, 3, 4, 5])
})

test('back after a long pause: a warm welcome and a few coins, once, with no word on the absence', () => {
  let s = run([at({ type: 'sessionStart' }), at({ type: 'greet', kind: 'back', ago: 4 * DAY })])
  assert.deepEqual([s.coins, s.affection], [RULES.coinsWelcome, 0])
  const say = bubble(view(s, t), { name: 'Miro' }).say
  assert.equal(say, `Miro: welcome back, good to see you. ${RULES.coinsWelcome} stars for you`)
  assert.doesNotMatch(say, /day|away|gone|missed|where|long|finally/i)
  // a second chat opened in the same return welcomes too, and gives no second gift
  const again = run([at({ type: 'sessionStart' }), at({ type: 'greet', kind: 'back', ago: 4 * DAY })], s)
  assert.deepEqual([again.coins, bubble(view(again, t)).say], [RULES.coinsWelcome, 'welcome back, good to see you'])
  t += RULES.backAfterMs
  assert.equal(run([at({ type: 'sessionStart' }), at({ type: 'greet', kind: 'back', ago: 4 * DAY })], again).coins, 2 * RULES.coinsWelcome)
})

test('state survives a JSON round trip (adapters persist it as JSON)', () => {
  const s = run([at({ type: 'sessionStart' }), at({ type: 'read', path: '/a', mtime: 1 }), usage(1, 2, 3, 4)])
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s)
})

test('reading another range of the same file is not a re-read', () => {
  const read = (range) => at({ type: 'read', path: '/big.js', mtime: 1, range })
  let s = run([at({ type: 'sessionStart' }), read('0:200'), read('200:200')])
  assert.equal(view(s, t).issue, null)
  s = run([read('0:200')], s)
  assert.equal(view(s, t).mood, 'dizzy')
})

test('test, fix, test again is not a loop: an edit between failures resets it', () => {
  const fail = () => at({ type: 'cmd', cmd: 'npm test', ok: false })
  const s = run([at({ type: 'sessionStart' }), fail(), at({ type: 'edit' }), fail(), at({ type: 'edit' }), fail(), fail()])
  assert.equal(view(s, t).issue, null)
  assert.equal(view(run([fail()], s), t).mood, 'loop')
})

test('the card claims no saving and carries no cache figure: that one is in /pet audit only', () => {
  const s = run([at({ type: 'sessionStart' }), usage(100_000, 900_000, 0)], initialState(0.5))
  assert.deepEqual(Object.keys(card(s)).filter(k => /saved|hit|cache/i.test(k)), [])
})

test('one pet in a hundred is born golden', () => {
  assert.deepEqual([initialState(0.001).variant, initialState(0.5).variant], ['golden', null])
})

test('animals: the six common ones are unlocked once for 100 stars and kept; a free one is kept and not paid; the rare one and one of a skin pack are never sold', () => {
  assert.deepEqual([RULES.animalPrice, RULES.animals], [100, ['penguin', 'chick', 'dog', 'bunny', 'fox', 'cactus']])
  const s = { ...initialState(0.5), coins: 250 }
  assert.deepEqual(s.animals, [])
  const one = reduce(s, { type: 'animal', id: 'fox', t: 1 })
  assert.deepEqual([one.coins, one.animals, view(one, 1).animals, card(one).animals], [150, ['fox'], ['fox'], ['fox']])
  assert.deepEqual(reduce(one, { type: 'animal', id: 'fox', t: 2 }), one) // once: never paid twice
  const two = reduce(one, { type: 'animal', id: 'dog', t: 2 })
  assert.deepEqual([two.coins, two.animals], [50, ['fox', 'dog']])
  assert.deepEqual(reduce(two, { type: 'animal', id: 'bunny', t: 3 }), two) // too dear: nothing taken
  for (const id of ['axolotl', 'robot', 'yacht']) assert.deepEqual(reduce({ ...two, coins: 999 }, { type: 'animal', id, t: 3 }).animals, ['fox', 'dog'])
  // the one a pet of before the prices was shown as: kept for nothing
  const kept = reduce(two, { type: 'animal', id: 'chick', free: true, t: 4 })
  assert.deepEqual([kept.coins, kept.animals], [50, ['fox', 'dog', 'chick']])
  // through the store: only the animals that can be unlocked, in their order; a store of before has none; two chats' unlocks are joined
  assert.deepEqual([shared({ animals: ['dog', 'robot', 'fox', 7] }).animals, shared({}).animals, shared({ animals: 'x' }).animals], [['dog', 'fox'], [], []])
  assert.deepEqual(merge(shared({ animals: ['dog'] }), shared({}), shared({ animals: ['fox'] })).animals, ['dog', 'fox'])
})

test('the golden coat: born with it or bought for 300, on by itself, plain by choice, and left alone by the things to wear', () => {
  assert.deepEqual([GOLDEN.price, GOLDEN.slot, RULES.goldenPrice], [300, 'coat', 300])
  assert.ok(!SHOP.includes(GOLDEN) && SOLD.at(-1) === GOLDEN) // not one of the things to wear: sold after them
  // born golden: owned from the start and on, in the pet's view and in a store of before the coat
  const born = initialState(0.001), usual = initialState(0.5)
  assert.deepEqual([born.owned, view(born, 0).closet, wornOf(view(born, 0).closet, ''), usual.owned], [['golden'], ['golden'], ['golden'], []])
  assert.deepEqual([shared({ variant: 'golden', owned: ['mug'] }).owned, shared({ variant: null, owned: ['mug'] }).owned], [['mug', 'golden'], ['mug']])
  // bought: 300 stars, never twice, and a pet born golden is not asked to pay
  const rich = { ...usual, coins: 310 }
  const bought = reduce(rich, { type: 'buy', id: 'golden', t: 1 })
  assert.deepEqual([bought.coins, bought.owned], [10, ['golden']])
  assert.deepEqual(reduce({ ...usual, coins: 299 }, { type: 'buy', id: 'golden', t: 1 }).owned, [])
  assert.equal(reduce({ ...born, coins: 310 }, { type: 'buy', id: 'golden', t: 1 }).coins, 310)
  // the coat part turns between golden and plain, and the choice is kept; the other parts stay
  const closet = ['shades', 'cap', 'golden']
  let w = putOn(closet, 'shades', 'golden')
  assert.deepEqual(wornOf(closet, w), ['shades', 'golden'])
  w = turnSlot(closet, w, 'coat')
  assert.deepEqual([w, wornOf(closet, w)], ['shades plain', ['shades']])
  w = turnSlot(closet, w, 'coat')
  assert.deepEqual(wornOf(closet, w), ['shades', 'golden'])
  // taking everything off leaves the colour as it is, golden or plain; alone it is kept without the old fallback
  assert.deepEqual(wornOf(closet, takeOff(closet, w, 'none')), ['golden'])
  assert.deepEqual(wornOf(closet, takeOff(closet, 'shades plain', 'none')), [])
  assert.equal(takeOff(closet, w, 'golden'), 'shades plain')
  // a choice from before the parts still counts under the coat, and the coat is never that fallback
  assert.deepEqual([wornOf(closet, ''), wornOf(['golden'], ''), wornOf(closet, 'none')], [['cap', 'golden'], ['golden'], ['golden']])
  // with the crown: both on by themselves, each off by its own choice
  assert.deepEqual(wornOf(['crown', 'golden'], ''), ['crown', 'golden'])
  assert.equal(takeOff(['crown', 'golden'], '', 'golden'), 'crown plain')
  assert.equal(takeOff(['crown', 'golden'], '', 'crown'), 'golden nohead')
})

test('a cache break after a pause is shown as an expired cache, a note', () => {
  let s = run([at({ type: 'sessionStart' }), usage(100, 0, 9000), usage(100, 9000, 100), at({ type: 'turnEnd' })])
  t += RULES.cacheTtlMs + 1000
  s = run([usage(100, 0, 9000)], s)
  assert.match(bubble(view(s, t)).say, /idle over 5 minutes/)
  assert.match(bubble(view(s, t)).fix, /^A note only: the cache expires/)
})

test('the loop bubble names the program only, never arguments or VAR=value', () => {
  const fail = () => at({ type: 'cmd', cmd: 'TOKEN=abc curl -H secret http://x', ok: false })
  const say = bubble(view(run([fail(), fail(), fail()]), t)).say
  assert.equal(say, 'curl failed 3 times in a row')
})

test('a long chat without lean is a note at every turn until lean is on, then the pet cheers', () => {
  t += RULES.cheerGapMs
  let s = run([at({ type: 'sessionStart' }), ...heavyTurn(), ...heavyTurn()])
  const v = view(s, t)
  assert.deepEqual([v.mood, v.issue?.kind, bubble(v).ask, bubble(v).fix], ['bloated', 'heavy', '/pet lean on', 'A note only. In our bench the style cost less on long tasks.'])
  s = run([at({ type: 'usage', input: 100, cacheRead: RULES.heavyTokens, cacheWrite: 0, lean: true }), at({ type: 'turnEnd' })], s)
  assert.deepEqual([view(s, t).issue, s.cheer?.kind], [null, 'lean'])
  assert.equal(run([at({ type: 'sessionStart' }), ...heavyTurn(), at({ type: 'lean', on: true })]).cheer?.kind, 'lean') // the command is answered at once
  // a short chat gets no note, lean or not; a compaction ends a long one
  assert.equal(view(run([at({ type: 'sessionStart' }), small(), at({ type: 'turnEnd' })]), t).issue, null)
  assert.equal(view(run([at({ type: 'sessionStart' }), usage(100, RULES.heavyTokens, 0), at({ type: 'compact' }), at({ type: 'turnEnd' })]), t).issue, null)
})

test('calm bubbles say the real state of the chat', () => {
  const long = usage(100, RULES.heavyTokens, 0)
  const say = (events) => bubble(view(run([at({ type: 'sessionStart' }), ...events]), t)).say
  const turns = (n) => Array.from({ length: n }, () => at({ type: 'turnEnd' }))
  assert.deepEqual([0, 1, 2, 3].map(n => say([small(), ...turns(n)])), [...CALM.short, CALM.short[0]]) // they rotate with the turn
  // the outline offered at the first long turn is gone once the next prompt has been up a while
  const seen = () => { t += RULES.talkShowMs; return at({ type: 'prompt' }) }
  assert.deepEqual([0, 1, 2].map(n => say([at({ type: 'lean', on: true }), long, ...turns(n), seen()])), CALM.long)
  for (const line of CALM.short) assert.match(line, /short|small/)
  for (const line of CALM.long) assert.match(line, /long/)
  // long with lean off: the heavy message, already before the turn ends
  const early = bubble(view(run([at({ type: 'sessionStart' }), long]), t))
  assert.deepEqual([early.say, early.ask], ['long chat, lean off: over 60k tokens re-read per request', '/pet lean on'])
})

test('every line is short and sober: one line, no exclamation mark', () => {
  const v = { ...view(initialState(1), t), long: true }
  const views = [
    ...Object.keys(ISSUES).flatMap(kind => [undefined, 'ttl_expired_5m', 'likely_server_side', 'tools_changed', '/src/some/file.js'].map(detail => ({ ...v, mood: kind, issue: { kind, detail, untilTurn: 0, until: 0 } }))),
    ...Object.keys(CHEERS).map(kind => ({ ...v, mood: 'cheer', cheer: { kind, at: 0, value: 0 } })),
    ...['seedling', 'bloom'].flatMap(mood => [true, false].flatMap(lean => [true, false].flatMap(long => [0, 1, 2].map(turn => ({ ...v, mood, lean, long, turn }))))),
    ...['seedling', 'bloom'].flatMap(mood => [true, false].map(long => ({ ...v, mood, wait: true, long }))),
  ]
  for (const x of views) for (const b of [bubble(x)]) for (const line of [b.say, b.fix ?? '']) {
    assert.doesNotMatch(line, /[!\n]|lovely|sip of tokens/, line)
    assert.ok(line.length <= 72, line)
  }
})

test('lean chosen while the style still waits: no note, no cheer, the bubble says when the style starts; the cheer comes when it is in', () => {
  t += RULES.cheerGapMs
  let s = run([at({ type: 'sessionStart' }), ...heavyTurn()])
  s = run([at({ type: 'lean', on: false, wait: true })], s)
  let v = view(s, t), b = bubble(v)
  assert.deepEqual([v.issue, v.cheer, v.lean, v.wait], [null, null, false, true]) // the heavy issue goes, and nothing is celebrated
  assert.deepEqual([b.say, b.fix, b.ask], ['long chat, lean chosen', 'The style starts at the next compaction or chat.', ''])
  s = run([at({ type: 'usage', input: 100, cacheRead: RULES.heavyTokens, cacheWrite: 0, lean: false, wait: true }), at({ type: 'turnEnd' })], s)
  assert.deepEqual([view(s, t).issue, s.cheer], [null, null]) // no note while it waits
  // the compaction lets the style in: now the pet cheers
  s = run([at({ type: 'compact' }), at({ type: 'lean', on: true })], s)
  assert.deepEqual([s.cheer?.kind, view(s, t).wait, bubble(view(s, t)).say], ['lean', false, CHEERS.lean()])
  // waiting for the next chat: /clear starts it, and the cheer comes there
  const cleared = run([at({ type: 'lean', on: false, wait: true }), at({ type: 'sessionEnd' }), at({ type: 'sessionStart' }), at({ type: 'lean', on: true })], run([at({ type: 'sessionStart' }), ...heavyTurn()]))
  assert.equal(cleared.cheer?.kind, 'lean')
  // turning the choice off again brings the note back
  const off = run([at({ type: 'lean', on: false, wait: true }), at({ type: 'lean', on: false }), ...heavyTurn()], run([at({ type: 'sessionStart' })]))
  assert.deepEqual([view(off, t).issue?.kind, view(off, t).wait], ['heavy', false])
})

test('every guide the bubbles link to exists in docs/fix', () => {
  const docs = [...Object.values(ISSUES).map(i => i.doc), 'long-chat.md']
  for (const doc of docs) assert.ok(existsSync(new URL(`../docs/fix/${doc}`, import.meta.url)), doc)
  // and no bubble links anywhere else
  const v = { ...view(initialState(1), t), long: true }
  const views = [...Object.keys(ISSUES).map(kind => ({ ...v, issue: { kind, untilTurn: 0, until: 0 } })), ...['ko', 'wilted', 'seedling'].flatMap(mood => [{ ...v, mood }, { ...v, mood, wait: true }])]
  for (const x of views) { const link = bubble(x).link; if (link) assert.ok(link.startsWith(DOCS) && docs.includes(link.slice(DOCS.length)), link) }
})

test('a prompt after a pause over the cache life, in a chat of 100k or more, gets the advice to restart small; under 100k nothing', () => {
  const pause = (tokens, ms, more = {}) => { const s = run([at({ type: 'sessionStart' }), at({ type: 'lean', on: true }), usage(100, tokens, 0), at({ type: 'turnEnd' })]); t += ms; return run([at({ type: 'prompt', ...more })], s) }
  const big = pause(RULES.coldTokens, RULES.coldAfterMs)
  const b = bubble(view(big, t))
  assert.deepEqual([view(big, t).issue?.kind, view(big, t).mood], ['cold', 'stomach']) // advice only
  assert.deepEqual([b.say, b.fix, b.ask, b.link], ['cache expired: 100k sent again in full', 'Restarting small costs less: /compact, or /clear if the task is done.', '/compact', DOCS + 'cache-break.md'])
  // silent under 100k, within the cache life, and for a slash command, which sends no request
  assert.equal(view(pause(RULES.coldTokens - 1000, RULES.coldAfterMs), t).issue, null)
  assert.equal(view(pause(RULES.coldTokens, RULES.coldAfterMs - 5000), t).issue, null)
  assert.equal(view(pause(RULES.coldTokens, RULES.coldAfterMs, { turn: false }), t).issue, null)
  // the request that follows rebuilds the cache: the advice stays in front of that note, and a compaction ends it
  const sent = run([usage(100, 0, RULES.coldTokens)], big)
  assert.equal(view(sent, t).issue?.kind, 'cold')
  assert.equal(view(run([at({ type: 'compact' })], big), t).issue, null)
})

test('the skin: one thing on each part, a new one takes the part of the old, and a choice from before the parts still counts', () => {
  const all = SHOP.map(i => i.id)
  assert.deepEqual(SLOTS, ['head', 'face', 'body', 'feet', 'accessory', 'coat'])
  assert.deepEqual(SHOP.filter(i => i.slot === 'feet').map(i => `${i.id} ${i.price}`), ['sneakers 35', 'boots 35', 'skateboard 55'])
  assert.deepEqual(SHOP.map(i => i.price), SHOP.map(i => i.price).toSorted((a, b) => a - b)) // the catalogue goes from the cheapest up
  assert.ok(SHOP.every(i => SLOTS.includes(i.slot)))
  // before the places: no choice is the last thing owned, one id is that thing, a thing not owned falls back, none is nothing
  assert.deepEqual(wornOf(['shades', 'scarf'], ''), ['scarf'])
  assert.deepEqual(wornOf(['shades', 'scarf'], 'shades'), ['shades'])
  assert.deepEqual(wornOf(['shades', 'scarf'], 'cap'), ['scarf'])
  assert.deepEqual(wornOf(['shades', 'scarf'], 'none'), [])
  assert.deepEqual(wornOf([], ''), [])
  // more than one, told in the order of the places; two for one place: the last named
  assert.deepEqual(wornOf(all, 'mug scarf shades sombrero'), ['sombrero', 'shades', 'scarf', 'mug'])
  assert.deepEqual(wornOf(all, 'cap mug sombrero lamp'), ['sombrero', 'lamp'])
  // putting on keeps the other places and frees its own
  let w = putOn(all, 'shades', 'mug')
  assert.deepEqual(wornOf(all, w), ['shades', 'mug'])
  w = putOn(all, w, 'cap'); w = putOn(all, w, 'scarf'); w = putOn(all, w, 'lamp'); w = putOn(all, w, 'headphones')
  assert.deepEqual(wornOf(all, w), ['headphones', 'shades', 'scarf', 'lamp'])
  assert.equal(putOn(['shades'], 'shades', 'mug'), 'shades') // not owned: nothing changes
  // from no choice at all, the thing worn until now stays on
  assert.deepEqual(wornOf(['shades', 'scarf'], putOn(['shades', 'scarf'], '', 'shades')), ['shades', 'scarf'])
  // taking off: one thing, and the last one leaves `none`, not the old fallback
  w = takeOff(all, w, 'shades')
  assert.deepEqual(wornOf(all, w), ['headphones', 'scarf', 'lamp'])
  assert.equal(takeOff(['mug'], 'mug', 'mug'), 'none')
  assert.equal(takeOff(['mug', 'cap'], '', 'cap'), 'none')
  // a place turned: each thing owned for it, then nothing, then round again; the other places stay
  const some = ['shades', 'cap', 'sombrero']
  w = 'shades'
  const seen = []
  for (let i = 0; i < 4; i++) { w = turnSlot(some, w, 'head'); seen.push(wornOf(some, w).join(' ')) }
  assert.deepEqual(seen, ['cap shades', 'sombrero shades', 'shades', 'cap shades'])
  assert.equal(turnSlot(some, 'shades', 'body'), 'shades') // nothing owned for the body
  // the feet: sneakers or the skateboard, one at a time
  assert.deepEqual(wornOf(all, putOn(all, putOn(all, 'cap', 'sneakers'), 'skateboard')), ['cap', 'skateboard'])
  assert.equal(turnSlot(some, 'shades', 'face'), 'none')
})

test('the crown is a thing of the head: on by itself once the pet is fully grown, off under a hat or by choice, and never sold', () => {
  assert.ok(!SHOP.some(i => i.id === 'crown'))
  assert.deepEqual(WEARABLE.map(i => i.id), ['crown', 'eggshell', ...SHOP.map(i => i.id), 'pastel', 'terminal', 'golden'])
  assert.deepEqual([closetOf(['cap'], 'healthy'), closetOf(['cap'], 'bloom')], [['cap'], ['crown', 'cap']])
  // a pet's own view and card carry it only at the last stage
  const grown = { ...initialState(1), owned: ['cap'], days: RULES.bloomAt.days, affection: RULES.bloomAt.affection }
  assert.deepEqual([view(grown, 0).closet, card(grown).closet, card(grown).owned], [['crown', 'cap'], ['crown', 'cap'], ['cap']])
  assert.deepEqual(card({ ...grown, affection: 0 }).closet, ['cap'])
  const has = ['crown', 'cap', 'scarf']
  // by default, whatever was chosen before the pet grew: nothing, one thing, even everything off
  assert.deepEqual(wornOf(['crown'], ''), ['crown'])
  assert.deepEqual(wornOf(has, 'scarf'), ['crown', 'scarf'])
  assert.deepEqual(wornOf(has, 'none'), ['crown'])
  assert.deepEqual(wornOf(['crown', 'scarf'], ''), ['crown', 'scarf']) // from before the parts: the last thing owned, and the crown
  assert.deepEqual(wornOf(has, ''), ['crown']) // ...unless that thing is a hat: nobody chose it over the crown
  // a hat takes its part, and taking the hat off leaves the head bare: the person chose
  let w = putOn(has, 'scarf', 'cap')
  assert.deepEqual(wornOf(has, w), ['cap', 'scarf'])
  w = takeOff(has, w, 'cap')
  assert.equal(w, 'scarf nohead')
  assert.deepEqual(wornOf(has, w), ['scarf'])
  // taken off by itself, and put back
  assert.deepEqual(wornOf(has, takeOff(has, 'scarf', 'crown')), ['scarf'])
  assert.deepEqual(wornOf(has, putOn(has, 'scarf nohead', 'crown')), ['crown', 'scarf'])
  // everything off takes the crown too
  assert.equal(takeOff(has, 'cap scarf', 'none'), 'none nohead')
  assert.deepEqual(wornOf(has, 'none nohead'), [])
  assert.equal(takeOff(['cap', 'scarf'], 'cap scarf', 'none'), 'none')
  // the head turned: the crown, each hat, nothing, and round again
  const seen = []
  w = 'scarf'
  for (let i = 0; i < 4; i++) { w = turnSlot(has, w, 'head'); seen.push(wornOf(has, w).join(' ')) }
  assert.deepEqual(seen, ['cap scarf', 'scarf', 'crown scarf', 'cap scarf'])
})

test('the things added for the launch: eleven with their part and price, and the two plain coats', () => {
  const added = { balloon: ['accessory', 15], glasses: ['face', 20], eyepatch: ['face', 20], duck: ['accessory', 25], partyhat: ['head', 25], boots: ['feet', 35], santa: ['head', 40], hoodie: ['body', 45], wand: ['accessory', 50], laptop: ['accessory', 65], wizard: ['head', 80] }
  for (const [id, [slot, price]] of Object.entries(added)) assert.deepEqual([id, SHOP.find(i => i.id === id)?.slot, SHOP.find(i => i.id === id)?.price], [id, slot, price])
  assert.equal(SHOP.length, 22)
  assert.equal(new Set(SOLD.map(i => i.id)).size, SOLD.length) // no id twice
  // one thing on a part: the hoodie takes the scarf's, the glasses and the eye patch the sunglasses', a new hat an old one's; a hat and glasses go together
  const all = SHOP.map(i => i.id)
  assert.deepEqual(wornOf(all, putOn(all, 'scarf', 'hoodie')), ['hoodie'])
  assert.deepEqual(wornOf(all, putOn(all, putOn(all, 'shades', 'glasses'), 'eyepatch')), ['eyepatch'])
  assert.deepEqual(wornOf(all, putOn(all, putOn(all, putOn(all, 'cap', 'wizard'), 'glasses'), 'boots')), ['wizard', 'glasses', 'boots'])
  // under a new hat the crown is off, as under an old one, and back when the hat goes
  const grown = closetOf(['santa', 'cap'], 'bloom')
  assert.deepEqual([wornOf(grown, putOn(grown, '', 'santa')), wornOf(grown, putOn(grown, '', 'cap')), wornOf(grown, turnSlot(grown, 'cap', 'head'))], [['santa'], ['cap'], ['santa']])
  assert.deepEqual(wornOf(grown, takeOff(grown, 'santa', 'santa')), [])

  // the coats: cheapest first, the golden one last; the plain ones are bought, never had at birth, and go on by choice only
  assert.deepEqual(COATS.map(i => [i.id, i.slot, i.price]), [['pastel', 'coat', 150], ['terminal', 'coat', 200], ['golden', 'coat', 300]])
  assert.deepEqual([initialState(0.001).owned, initialState(0.5).owned], [['golden'], []])
  const rich = { ...initialState(0.5), coins: 360 }
  const two = reduce(reduce(rich, { type: 'buy', id: 'pastel', t: 1 }), { type: 'buy', id: 'terminal', t: 2 })
  assert.deepEqual([two.coins, two.affection, two.owned], [10, 0, ['pastel', 'terminal']])
  assert.deepEqual(reduce({ ...rich, coins: 149 }, { type: 'buy', id: 'pastel', t: 1 }).owned, [])
  assert.deepEqual([wornOf(['cap', 'pastel'], ''), wornOf(['pastel'], '')], [['cap'], []]) // not the thing a pet of before the parts wears by itself
  const closet = ['shades', 'pastel', 'terminal', 'golden']
  assert.deepEqual(wornOf(closet, 'shades'), ['shades', 'golden']) // golden still comes on by itself...
  let w = putOn(closet, 'shades', 'pastel')
  assert.deepEqual(wornOf(closet, w), ['shades', 'pastel']) // ...and a coat picked goes over it
  const seen = []
  for (let i = 0; i < 4; i++) { w = turnSlot(closet, w, 'coat'); seen.push(wornOf(closet, w).join(' ')) }
  assert.deepEqual(seen, ['shades terminal', 'shades golden', 'shades', 'shades pastel']) // each coat owned, then the pet's own colour
  assert.deepEqual(wornOf(closet, takeOff(closet, w, 'none')), ['pastel']) // a colour: taking everything off leaves it
  assert.deepEqual(wornOf(closet, takeOff(closet, w, 'pastel')), ['shades'])
})

test('the Santa hat is sold in December only, by the clock of the machine; who has it keeps and wears it all year', () => {
  const at = (/** @type {number} */ y, /** @type {number} */ m, /** @type {number} */ d, h = 12, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime() // local time, as the rule reads it
  assert.deepEqual(SHOP.filter(i => i.month).map(i => [i.id, i.month]), [['santa', 12]])
  assert.deepEqual([at(2026, 11, 30), at(2026, 11, 30, 23, 59, 59), at(2026, 12, 1, 0), at(2026, 12, 1), at(2026, 12, 31), at(2026, 12, 31, 23, 59, 59), at(2027, 1, 1, 0), at(2027, 1, 1)].map(t => sells('santa', t)),
    [false, false, true, true, true, true, false, false])
  for (const t of [at(2026, 11, 30), at(2026, 12, 1), at(2026, 12, 31), at(2027, 1, 1)]) assert.deepEqual([sells('wizard', t), sells('golden', t), sells('nothing', t)], [true, true, true]) // the rule is the Santa hat's alone
  const rich = { ...initialState(0.5), coins: 100 }
  const buy = (/** @type {number} */ t) => reduce(rich, { type: 'buy', id: 'santa', t })
  assert.deepEqual([at(2026, 11, 30), at(2026, 12, 1), at(2026, 12, 31), at(2027, 1, 1)].map(t => [buy(t).owned, buy(t).coins]), [[[], 100], [['santa'], 60], [['santa'], 60], [[], 100]])
  // bought in December, in January it is still owned, in the closet and on
  const mine = buy(at(2026, 12, 24)), later = reduce(mine, { type: 'prompt', t: at(2027, 1, 15) })
  assert.deepEqual([later.owned, view(later, at(2027, 7, 1)).closet, wornOf(view(later, at(2027, 7, 1)).closet, 'santa'), shared(later).owned], [['santa'], ['santa'], ['santa'], ['santa']])
})

test("the founder's eggshell: a pet born on or before FOUNDER_UNTIL has it, one born after never, and who has it keeps it", () => {
  const at = (/** @type {number[]} */ ...d) => new Date(d[0] ?? 0, (d[1] ?? 1) - 1, d[2] ?? 1, d[3] ?? 12, d[4] ?? 0, d[5] ?? 0).getTime() // the machine's own clock
  const [y, m, d] = FOUNDER_UNTIL.split('-').map(Number), last = at(y ?? 0, m, d, 23, 59, 59), after = at(y ?? 0, m, (d ?? 0) + 1, 0, 0, 0)
  assert.equal(FOUNDER_UNTIL, '2027-01-31') // provisional: the person sets it at launch
  assert.deepEqual([at(2026, 11, 15), at(y ?? 0, m, d, 0), last, after, at(2027, 6, 1), 0].map(founder), [true, true, true, false, false, false]) // the whole last day, by the local date
  assert.ok(!SOLD.includes(EGGSHELL) && !SHOP.some(i => i.id === 'eggshell') && EGGSHELL.slot === 'head' && EGGSHELL.price === 0) // never sold
  // a newborn: born now, and a founder's when now is in time
  const early = birth(initialState(1), last), late = birth(initialState(1), after)
  assert.deepEqual([early.born, early.owned, late.born, late.owned], [last, ['eggshell'], after, []])
  assert.deepEqual(wornOf(card(early).closet, ''), ['eggshell']) // with nothing else it is on by itself
  // a pet of before this version kept no birth: its first start is taken, or an earlier moment that is known (its diary's first)
  const old = { ...initialState(1), owned: ['cap'] }
  assert.deepEqual([birth(old, last).owned, birth(old, after).owned, birth(old, after, last).owned, birth(old, after, last).born], [['eggshell', 'cap'], ['cap'], ['eggshell', 'cap'], last])
  assert.equal(birth(old, last, after).born, last) // a moment after now is not known
  // the birth, once known, is the rule's ground whatever the clock says later; and nothing changes twice
  assert.deepEqual(birth(late, last).owned, [])
  assert.equal(birth(early, after), early)
  // owned, it survives the date: the store's reading keeps it, a merge keeps it, a buy refuses it, and it is still worn
  const kept = shared({ ...early, coins: 500 })
  assert.deepEqual([kept.owned, kept.born, shared({ owned: ['eggshell', 'cap'] }).owned], [['eggshell'], last, ['eggshell', 'cap']])
  assert.deepEqual(merge(shared(late), shared(late), kept).owned, ['eggshell'])
  assert.deepEqual([merge(shared(late), shared(late), kept).born, merge(kept, kept, shared({ ...kept, born: 0 })).born], [last, last]) // the earliest birth known
  const later = reduce({ ...initialState(1), ...kept }, { type: 'buy', id: 'eggshell', t: at(2030, 1, 1) })
  assert.deepEqual([later.owned, later.coins, wornOf(card(birth(later, at(2030, 1, 1))).closet, 'eggshell')], [['eggshell'], 500, ['eggshell']])
  assert.deepEqual(wornOf(card({ ...later, owned: ['eggshell', 'cap'] }).closet, putOn(['eggshell', 'cap'], 'eggshell', 'cap')), ['cap']) // a hat takes its place, as any thing of the head
})
