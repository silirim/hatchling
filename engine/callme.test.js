// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanCall, CALL_MAX } from './persona.js'
import { called, cuddle, bubble } from './catalog.js'
import { system } from './voice.js'
import { initialState, view } from './engine.js'
import { LANGS, text } from './lang/index.js'
import { cols } from './width.js'

test('the name of the person, cleaned: one line of letters, 24 columns at most, no control or escape character, no stacked marks', () => {
  assert.equal(CALL_MAX, 24)
  assert.deepEqual(['Ana', '  Ana   María ', "José-Luis d'Ávila Jr.", 'Ana\nBob\r\tCid', '\x1b[31mAna\x1b[0m\x07', 'A‮na​', '<b>{name}</b> $(rm) `x`', 'Zo' + 'é'.repeat(1) + '́́́́́', '小狐', '', 7, null, undefined].map(cleanCall),
    ['Ana', 'Ana María', "José-Luis d'Ávila Jr.", 'Ana Bob Cid', 'Ana', 'Ana', 'bname/b rm x'.replace('/', ''), 'Zoé́́', '小狐', '', '', '', ''])
  const long = cleanCall('Maximiliano Alexander von Hohenzollern-Sigmaringen')
  assert.deepEqual([long, cols(long) <= 24], ['Maximiliano Alexander vo', true]) // cut at 24, as a pet's name is at 20
  assert.ok(cols(cleanCall('名'.repeat(40))) <= 24)
  assert.doesNotMatch(cleanCall('\x1b]0;title\x07A\u0000B C{x}[y](z)'), /[^\p{L}\p{M}\p{N} '.-]/u)
})

test('a fixed line with and without the name in each language: the name comes first, one time in three, and the line is whole without it', () => {
  const said = /** @type {Record<string, [string, string]>} */ ({
    en: ['welcome back, good to see you', 'Ana, welcome back, good to see you'], es: ['has vuelto, qué alegría verte', 'Ana, has vuelto, qué alegría verte'],
    pt: [text('pt', 'greet.back'), `Ana, ${text('pt', 'greet.back')}`], zh: ['欢迎回来，见到你真好', 'Ana，欢迎回来，见到你真好'],
  })
  assert.deepEqual(Object.keys(said).sort(), Object.keys(LANGS).sort())
  for (const [lang, [plain, named]] of Object.entries(said)) {
    const line = text(lang, 'greet.back')
    assert.deepEqual([called(line, '', lang, 0), called(line, undefined, lang, 0), called(line, 'Ana', lang, 0), called(line, 'Ana', lang, 1), called(line, 'Ana', lang, 2), called(line, 'Ana', lang, 3)], [plain, plain, named, plain, plain, named])
    // in the bubble: the welcome back and the first greeting of a day carry it on such a day, the other greetings never
    const v = (/** @type {string} */ greet) => /** @type {any} */ ({ ...view(initialState(1), 1000), calm: true, talk: { kind: 'greet', greet } })
    assert.equal(bubble(v('back'), { lang, call: 'Ana', callN: 3 }).say, named)
    assert.deepEqual([bubble(v('back'), { lang, call: 'Ana', callN: 4 }).say, bubble(v('back'), { lang, callN: 3 }).say], [plain, plain])
    const first = bubble(v('first'), { lang, voice: 'calm' }).say
    assert.equal(bubble(v('first'), { lang, voice: 'calm', call: 'Ana', callN: 0 }).say, text(lang, 'callme.line', { name: 'Ana', line: first }))
    assert.equal(bubble(v('new'), { lang, voice: 'calm', call: 'Ana', callN: 0 }).say, bubble(v('new'), { lang, voice: 'calm' }).say)
    // a cuddle's line: every third one
    const pats = [1, 2, 3, 4, 5, 6].map(n => called(cuddle('warmth', n, lang), 'Ana', lang, n))
    assert.deepEqual(pats.map(l => l.startsWith('Ana')), [false, false, true, false, false, true])
    assert.deepEqual([1, 2, 3].map(n => called(cuddle('warmth', n, lang), '', lang, n)), [1, 2, 3].map(n => cuddle('warmth', n, lang)))
  }
})

test('the request to the small model: one more line with the name when the person told one, and no word of it otherwise', () => {
  const pet = { name: 'Miro', animal: 'fox', stats: [91, 45, 12, 70, 38] }
  for (const lang of Object.keys(LANGS)) for (const talk of [false, true]) {
    const without = system({ ...pet, lang, talk }), withName = system({ ...pet, lang, talk, person: 'Ana María' })
    assert.equal(withName, `${without}\nThe person asked you to call them Ana María. You may say that name now and then, in few of your lines, never in every one.`)
    assert.doesNotMatch(without, /call them|Ana/)
    assert.equal(system({ ...pet, lang, talk, person: '' }), without)
  }
})
