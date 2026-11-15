// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { speaker, born, roll, cleanName, asTrait, traitsOf, statsOf, asStats, extremes, personalityOf, bar, buddy, TRAITS, STATS, NAME_MAX } from './persona.js'
import { bubble, voiced, cuddle, VOICE, CUDDLES, CALM, CHEERS, TALK } from './catalog.js'
import { initialState, reduce, view, RULES } from './engine.js'
import zoo from '../sprites/zoo.js'

test('a seed always gives the same name and five statistics with one peak and one weak point; names are short, capitalised, with no syllable twice in a row', () => {
  const peaks = new Set(), ends = new Set(), names = new Set(), lines = new Set()
  for (let seed = 1; seed <= 2000; seed++) {
    const a = born(seed)
    assert.deepEqual(born(seed), a)
    assert.match(a.name, /^[A-Z][a-z]{3,5}$/)
    const syl = a.name.toLowerCase().match(/../g) ?? []
    assert.ok(syl.every((x, i) => x !== syl[i - 1]), a.name)
    assert.equal(asStats(a.stats), a.stats) // five whole numbers from 0 to 100
    const sorted = [...a.stats].sort((x, y) => y - x)
    assert.ok(Number(sorted[0]) >= 82 && Number(sorted[1]) <= 78 && Number(sorted[3]) >= 30 && Number(sorted[4]) <= 22, String(a.stats)) // the peak and the weak point stand apart
    const { peak, weak } = extremes(a.stats)
    assert.notEqual(peak, weak)
    const line = personalityOf(a.stats)
    assert.ok(line.length <= 60 && /^[A-Z][a-z ,]+\.$/.test(line), line)
    peaks.add(peak); ends.add(`${peak} ${weak}`); names.add(a.name); lines.add(line)
  }
  assert.equal(peaks.size, STATS.length)
  assert.equal(ends.size, STATS.length * (STATS.length - 1)) // every pair of extremes comes up
  assert.equal(lines.size, ends.size) // and each has a line of its own
  assert.equal(born(3791863706).name, 'Tobo') // a pet born before the statistics keeps its name
  assert.ok(names.size > 500)
  assert.equal(STATS.join(' '), STATS.join(' ').toLowerCase())
  for (const not of ['debugging', 'patience', 'chaos', 'wisdom', 'snark']) assert.ok(!STATS.includes(/** @type {any} */ (not))) // not the ones of /buddy
})

test('a pet born with two traits keeps its character: the first trait is its peak, the second its second highest, always the same', () => {
  const top = (/** @type {number[]} */ st) => [...STATS].sort((x, y) => Number(st[STATS.indexOf(y)]) - Number(st[STATS.indexOf(x)]))
  const OF = { dry: 'wit', curious: 'curiosity', patient: 'calm', shy: 'calm', fussy: 'rigor', cheerful: 'warmth', sweet: 'warmth' }
  for (let seed = 1; seed <= 300; seed++) for (const a of TRAITS) for (const b of TRAITS) {
    const st = statsOf(seed, a, b)
    assert.deepEqual(statsOf(seed, a, b), st)
    assert.equal(asStats(st), st)
    assert.equal(extremes(st).peak, OF[a])
    if (OF[a] !== OF[b]) assert.equal(top(st)[1], OF[b])
    assert.ok(Number(top(st).map(n => st[STATS.indexOf(n)])[4]) <= 22)
  }
  assert.equal(extremes(statsOf(7, 'fussy')).peak, 'rigor') // one trait only: the rest is drawn
  assert.equal(asStats([1, 2, 3, 4]), undefined)
  assert.equal(asStats([1, 2, 3, 4, 101]), undefined)
  assert.equal(asStats([1, 2, 3, 4, 5.5]), undefined)
  assert.equal(asStats('x'), undefined)
  assert.deepEqual(extremes([50, 50, 50, 50, 50]), { peak: 'wit', weak: 'wit' }) // a tie: the first
  assert.equal(bar(0), '░░░░░░░░░░')
  assert.equal(bar(100), '██████████')
  assert.equal(bar(46), '█████░░░░░')
  assert.equal(personalityOf([90, 50, 10, 40, 70]), 'Says it dry and short, and jumps at every red line.')
})

test('a name is cleaned: no control or markup characters, one space between words, at most NAME_MAX', () => {
  assert.equal(cleanName('  Mo\u001b[31mchi   the <b>2nd</b>\n'), 'Mochi the b2ndb') // the escape sequence goes whole, not only its first character
  assert.equal(cleanName("Zoë d'Or-1"), "Zoë d'Or-1")
  assert.equal(cleanName('x'.repeat(50)).length, NAME_MAX)
  assert.equal(cleanName('!!!'), '')
  assert.equal(cleanName(42), '')
  assert.equal(asTrait('fussy'), 'fussy')
  assert.equal(asTrait('angry'), undefined)
})

test('the old /buddy: only name, personality and hatching time are taken from the config', () => {
  const config = JSON.stringify({ userID: 'u-123', oauthAccount: { emailAddress: 'me@example.com' }, companion: { name: 'Pixel', personality: 'A calm duck\nwho waits.', hatchedAt: 1775001600000, species: 'duck', secret: 's3cr3t' } })
  assert.deepEqual(buddy(config), { name: 'Pixel', personality: 'A calm duck who waits.', hatchedAt: 1775001600000 })
  assert.equal(buddy(JSON.stringify({ companion: { name: 'P', hatchedAt: '2026-04-01T00:00:00Z' } }))?.hatchedAt, Date.UTC(2026, 3, 1))
  assert.equal(buddy(JSON.stringify({ companion: { name: 'P', personality: 'x'.repeat(500) } }))?.personality.length, 120)
  for (const none of ['{}', 'not json', 'null', '{"companion":null}', '{"companion":"x"}', '{"companion":{"name":""}}', '{"companion":{"personality":"shy"}}']) assert.equal(buddy(none), null)
  assert.deepEqual(traitsOf('A calm duck who waits.'), ['patient'])
  assert.deepEqual(traitsOf('Sweet, introverted, deadpan'), ['dry', 'sweet']) // two at most, in the order of TRAITS
  assert.deepEqual(traitsOf('likes bread'), [])
})

test('each of the five characters says the same lines its own way: short, sober, English, and not the plain line with a tail', () => {
  const lines = [...Object.values(CALM).flat(), CHEERS.lean(), CHEERS.evolve(), TALK.greet({ kind: 'greet', at: 0, greet: 'first' }).say, TALK.greet({ kind: 'greet', at: 0, greet: 'new' }).say]
  assert.deepEqual(Object.keys(VOICE).sort(), [...lines].sort()) // a line reworded in catalog.js must be reworded here too
  const bare = (/** @type {string} */ x) => x.replace(/[^a-z ]/g, '').replace(/ +/g, ' ')
  for (const [line, variants] of Object.entries(VOICE)) {
    assert.equal(variants.length, STATS.length)
    assert.equal(voiced(line), line)
    assert.equal(new Set([line, ...variants]).size, STATS.length + 1, line) // six wordings, all different
    const key = line.split(/[ ,:]+/).filter(w => w.length >= 4)
    variants.forEach((v, i) => {
      assert.equal(voiced(line, STATS[i]), v)
      assert.ok(v.length <= 44, v) // one line of the bubble
      assert.match(v, /^[a-zI][a-zI ,.:?]*$/, v) // plain English letters: no exclamation mark, no capital but I, no symbols
      if (line.split(' ').length > 3) assert.ok(!bare(v).startsWith(bare(line)), v) // not the plain line plus a few words
      assert.ok(!key.length || key.some(w => v.includes(w)), v) // still about the same thing
    })
    // no two characters share the words they add: the old table said the same line with one of a few tails
    const ends = variants.map(v => bare(v).split(' ').slice(-2).join(' '))
    assert.equal(new Set(ends).size, ends.length, line)
  }
  assert.equal(voiced('context 91% full', 'warmth'), 'context 91% full')
  // cuddles: two short lines for each character, none shared
  assert.equal(CUDDLES.length, STATS.length)
  const all = CUDDLES.flat()
  assert.equal(new Set(all).size, STATS.length * 2)
  for (const c of all) { assert.ok(c.length <= 44, c); assert.match(c, /^[a-zI][a-zI ,.?]*$/, c) }
  STATS.forEach((st, i) => { assert.equal(cuddle(st, 1), CUDDLES[i]?.[1]); assert.equal(cuddle(st, 2), CUDDLES[i]?.[0]) })
  assert.ok(all.includes(cuddle(undefined, 0)))
})

test('the bubble: the highest statistic picks the wording, a greeting starts with the name, the offer to adopt has a button', () => {
  const t = 1000
  const s = reduce(initialState(), { type: 'sessionStart', t })
  assert.equal(bubble(view(s, t), { name: 'Miro', voice: 'calm' }).say, VOICE[CALM.short[0] ?? '']?.[2])
  assert.equal(bubble(view(s, t)).say, CALM.short[0])
  const odd = { ...view(s, t), turn: 1 } // one character, turn after turn
  assert.equal(bubble(odd, { voice: 'calm' }).say, VOICE[CALM.short[1] ?? '']?.[2])
  const hello = reduce(s, { type: 'greet', t, kind: 'first' })
  assert.equal(bubble(view(hello, t), { name: 'Miro', voice: 'rigor' }).say, 'Miro: chat one of the day, to be precise')
  // D16: the hint about the old /buddy is a dim line under the greeting, with its button, and names nothing: no file was read to say it
  const offer = bubble(view(reduce(s, { type: 'greet', t, kind: 'new', buddy: true }), t), { name: 'Miro', voice: 'wit' })
  assert.deepEqual([offer.fix, offer.ask, offer.label], ['had a /buddy before? /pet adopt gives me its name and character', '/pet adopt', 'adopt'])
  assert.match(offer.say, /^Miro: /)
})

test('the animal rolled at birth: by weight, and never one with no weight, as the animals of a skin pack are', () => {
  const species = zoo.pack.animals
  /** @type {Record<string, number>} */ const got = {}
  const N = 100_000
  for (let i = 0; i <= N; i++) { const a = roll(species, i / N) ?? ''; got[a] = (got[a] ?? 0) + 1 } // every roll there is, 1 included
  assert.deepEqual(Object.keys(got).sort(), Object.keys(species).sort())
  assert.ok(Number(got.axolotl) < N * 0.03 && Number(got.penguin) > N * 0.15) // the rare one stays rare
  assert.equal(roll({ a: {}, b: { weight: 1 } }, 0), 'b')
  assert.equal(roll({ a: { weight: 0 }, b: { weight: 1 } }, 0), 'b')
  assert.equal(roll({ a: {} }, 0.5), undefined)
})

test('two characters share the voice: the dominant one nearly always, the second the more often the closer its value', () => {
  const share = (/** @type {number[]} */ stats) => Array.from({ length: 1000 }, (_, n) => speaker(stats, n)).filter(s => s === 'curiosity').length / 1000
  const others = (/** @type {number[]} */ stats) => Array.from({ length: 1000 }, (_, n) => speaker(stats, n)).filter(s => s !== 'wit' && s !== 'curiosity')
  const near = [82, 78, 40, 50, 20], mid = [90, 70, 40, 50, 20], far = [100, 64, 40, 50, 20]
  for (const stats of [near, mid, far]) assert.deepEqual(others(stats), []) // only the two highest ever speak
  assert.ok(Math.abs(share(near) - 0.45) < 0.01 && Math.abs(share(mid) - 0.25) < 0.01 && Math.abs(share(far) - RULES.voiceSecond.far) < 0.01, `${share(near)} ${share(mid)} ${share(far)}`)
  assert.ok(Math.abs(share([80, 80, 40, 50, 20]) - RULES.voiceSecond.near) < 0.01) // equal values: nearly even, the first in STATS counts as the dominant
  assert.equal(share([100, 20, 40, 50, 30]), 0) // the second is `calm` here: curiosity, the weak point, never speaks
  // no dice: the same line has the same speaker, the first line is the dominant one's, and the second's lines never come three in a row
  assert.deepEqual([0, 1, 2, 3].map(n => speaker(mid, n)), [0, 1, 2, 3].map(n => speaker(mid, n)))
  assert.equal(speaker(near, 0), 'wit')
  assert.doesNotMatch(Array.from({ length: 1000 }, (_, n) => speaker(near, n) === 'wit' ? 'w' : 'c').join(''), /ccc/)
  // the bubble takes whoever speaks
  assert.notEqual(voiced(CALM.short[0] ?? '', 'wit'), voiced(CALM.short[0] ?? '', 'curiosity'))
})
