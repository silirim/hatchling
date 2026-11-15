// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { LANGS, BASE, asLang, fromLocale, text, list, voicedAs } from './index.js'
import { cols } from '../width.js'
import { RULES, SOLD, initialState, reduce, view } from '../engine.js'
import { STATS, personalityOf } from '../persona.js'
import { bubble, cuddle, ago, ISSUES, CHEERS, TALK } from '../catalog.js'
import { clean } from '../voice.js'
import zoo from '../../sprites/zoo.js'

const LINE = 44 // a line of the bubble, in columns (hooks/register.js BUBBLE_MAX)
const en = /** @type {Record<string, string | string[]>} */ (LANGS[BASE])
// what a {place} is filled with to measure a line: the longest value it meets in use
const FILL = { d: '100', n: '12', turns: '3', pct: '93', name: 'cachito', ago: '', usd: '$0.00280', parts: '' }
const filled = (/** @type {string} */ s, band = '') => s.replace(/\{(\w+)\}/g, (all, k) => k === 'band' ? band : /** @type {Record<string, string>} */ (FILL)[k] ?? all)
/** The most columns a key may take; undefined for the replies of a command, which are not in the bubble. @param {string} key @param {string | string[]} v */
function limit(key, v) {
  if (key === 'help') return undefined // the reply of /pet help: a list of commands, not a line of the bubble
  if (Array.isArray(v) && key.startsWith('tone.')) return RULES.voiceMaxCols // the comments' own limit
  if (Array.isArray(v) || /^(egg\.|sleep|wait\.say|greet\.back$)/.test(key)) return LINE // said in one line
  if (key.startsWith('btn.')) return 16
  if (key === 'comments.ask') return LINE * 4
  if (key === 'say.off.fix') return LINE * 3
  if (/^(cold|stomach|dizzy|loop|heavy|bloated|wait|greet|peer|tidy|cheer)\.|^coffee$/.test(key)) return 72 // two lines at most
  return undefined
}

test('there are four languages, English is the base, and a system locale picks one of them or English', () => {
  assert.deepEqual(Object.keys(LANGS), ['en', 'es', 'pt', 'zh'])
  assert.equal(BASE, 'en')
  assert.deepEqual(['es', 'zh', 'it', '', undefined, 7, 'toString'].map(asLang), ['es', 'zh', undefined, undefined, undefined, undefined, undefined])
  assert.deepEqual([fromLocale('es_ES.UTF-8'), fromLocale('pt_BR.UTF-8'), fromLocale('zh_CN.UTF-8'), fromLocale('zh-Hans'), fromLocale('en_US.UTF-8')], ['es', 'pt', 'zh', 'zh', 'en'])
  assert.deepEqual([fromLocale('it_IT.UTF-8'), fromLocale('C'), fromLocale('POSIX'), fromLocale(), fromLocale(undefined, '')], ['en', 'en', 'en', 'en', 'en'])
  assert.deepEqual([fromLocale('zh_TW.UTF-8'), fromLocale('zh_HK'), fromLocale('zh-Hant')], ['en', 'en', 'en']) // traditional characters are not ours
  // LC_ALL goes before LANG; one that is empty or not set leaves it to the next
  assert.equal(fromLocale('pt_PT.UTF-8', 'es_ES.UTF-8'), 'pt')
  assert.equal(fromLocale('', 'es_MX.UTF-8'), 'es')
  assert.equal(fromLocale(undefined, 'zh_CN'), 'zh')
})

test('every language has every key of English, of the same kind and length, with the same places to fill', () => {
  const places = (/** @type {string | string[]} */ v) => [...[v].flat().join(' ').matchAll(/\{\w+\}/g)].map(m => m[0]).sort().join()
  for (const [lang, table] of Object.entries(LANGS)) {
    assert.deepEqual(Object.keys(table).sort(), Object.keys(en).sort(), lang) // none missing, none of its own
    for (const [key, v] of Object.entries(en)) {
      const mine = /** @type {string | string[]} */ (table[key])
      assert.equal(Array.isArray(mine), Array.isArray(v), `${lang} ${key}`)
      if (Array.isArray(v)) assert.equal(mine.length, v.length, `${lang} ${key}`)
      assert.equal(places(mine), places(v), `${lang} ${key}`)
    }
  }
  // the keys the code builds from a name are all there
  for (const stat of STATS) for (const k of ['cuddle', 'tone', 'peak', 'weak', 'stat']) assert.ok(en[`${k}.${stat}`], `${k}.${stat}`)
  for (const kind of Object.keys(ISSUES)) assert.ok(en[`${kind}.fix`] && en[`${kind}.say`], kind)
  for (const i of SOLD) assert.equal(en[`item.${i.id}`], i.name)
  for (const name of Object.keys(zoo.pack.animals)) assert.ok(en[`animal.${name}`], name)
})

test('no line of any language has an exclamation mark or a line break, and none is wider than its limit in columns', () => {
  for (const [lang, table] of Object.entries(LANGS)) for (const [key, v] of Object.entries(table)) {
    const max = limit(key, v)
    for (const line of [v].flat()) {
      assert.doesNotMatch(line, /[!！¡\n]/, `${lang} ${key}`)
      if (key !== 'sep' && key !== 'help') assert.ok(line.trim() === line && line, `${lang} ${key}`)
      const band = [0, 1, 2, 3].map(i => String(table[`band.${i}`])).reduce((x, y) => cols(y) > cols(x) ? y : x) // the widest time of day a line may name
      if (max !== undefined) assert.ok(cols(filled(line, band)) <= max, `${lang} ${key}: ${cols(filled(line, band))} columns over ${max}: ${line}`)
    }
  }
  // Chinese is counted by what it takes on screen: 22 characters fill a line, and no line of it is counted by its letters
  assert.ok([en, /** @type {any} */ (LANGS.zh)].every(t => cols(t['calm.short.0'][0]) <= LINE))
  assert.equal(cols('对话不长，轻装上路'), 18)
  assert.ok(Object.values(/** @type {any} */ (LANGS.zh)).flat().some((/** @type {string} */ l) => l.length <= LINE && cols(l) > LINE)) // the replies of commands: such lines exist, so the count matters
})

test('a line said six ways: six different wordings in every language, and the tone lines pass the rules of a comment', () => {
  for (const [lang, table] of Object.entries(LANGS)) {
    for (const [key, v] of Object.entries(table)) if (Array.isArray(v) && v.length === STATS.length + 1) {
      assert.equal(new Set(v).size, v.length, `${lang} ${key}`)
      STATS.forEach((_, i) => assert.equal(voicedAs(lang, key, i), v[i + 1]))
      assert.equal(voicedAs(lang, key), v[0])
    }
    const cuddles = STATS.flatMap(s => list(lang, `cuddle.${s}`))
    assert.equal(new Set(cuddles).size, STATS.length * 2, lang)
    for (const stat of STATS) for (const line of list(lang, `tone.${stat}`)) assert.equal(clean(line), line, `${lang} ${line}`) // shown as it is: no mark taken out, not too wide
    if (lang !== BASE) assert.notDeepEqual(list(lang, 'calm.short.0'), list(BASE, 'calm.short.0'))
  }
})

test('a key a language lacks is said in English; a key nobody has reads as the fallback', () => {
  const es = /** @type {Record<string, string | string[]>} */ (LANGS.es), kept = { say: es['wait.say'], six: es['greet.new'] }
  try {
    delete es['wait.say']; delete es['greet.new']
    assert.equal(text('es', 'wait.say'), 'long chat, lean chosen')
    assert.equal(voicedAs('es', 'greet.new', 2), 'a new folder. we look around slowly')
    assert.equal(text('es', 'wait.fix'), 'El estilo empieza en la próxima compactación o chat.') // the rest stays Spanish
  } finally { es['wait.say'] = /** @type {string} */ (kept.say); es['greet.new'] = /** @type {string[]} */ (kept.six) }
  assert.equal(text('es', 'wait.say'), 'chat largo, lean elegido')
  assert.equal(text('xx', 'wait.say'), 'long chat, lean chosen') // a language there is not
  assert.equal(text(undefined, 'wait.say'), 'long chat, lean chosen')
  assert.equal(text('es', 'animal.robot', {}, 'robot'), 'robot')
  assert.equal(text('es', 'no.such.key'), 'no.such.key')
  assert.deepEqual(list('es', 'no.such.key'), [])
  assert.equal(text('zh', 'loop.say', { d: 'npm', n: 3 }), 'npm 连续失败 3 次')
  assert.equal(text('en', 'loop.say', { d: 'npm' }), 'npm failed {n} times in a row') // a place not filled stays visible
})

test('the bubble speaks the language: notes, cheers, calm lines, greetings, cuddles and the keys, each in the pet\'s character', () => {
  const t = 1000, s = reduce(initialState(1), { type: 'sessionStart', t }), v = view(s, t)
  assert.equal(bubble(v, { voice: 'wit', lang: 'es' }).say, 'chat corto. casi sin equipaje')
  assert.equal(bubble(v, { voice: 'warmth', lang: 'pt' }).say, 'conversa curta e levinha. que bom')
  assert.equal(bubble(v, { voice: 'rigor', lang: 'zh' }).say, '对话不长：带得少，符合预期')
  assert.equal(bubble(v, { lang: 'zh' }).say, '对话不长，轻装上路')
  assert.equal(bubble(v, { voice: 'wit', lang: 'en' }).say, bubble(v, { voice: 'wit' }).say)
  const hello = view(reduce(s, { type: 'greet', t, kind: 'first' }), t)
  assert.equal(bubble(hello, { name: 'Miro', voice: 'rigor', lang: 'es' }).say, 'Miro: chat número uno del día, para ser exactos')
  const resume = bubble(view(reduce(s, { type: 'greet', t, kind: 'resume', ago: 12 * 60_000, done: true }), t), { lang: 'pt' })
  assert.deepEqual([resume.say, resume.ask, resume.label], ['uma conversa aqui terminou o turno há 12 min. retomar?', '/resume', 'retomar'])
  // a note: the words are translated, the command and the line for the agent are not
  const note = (/** @type {string} */ kind, /** @type {string} */ lang, detail = /** @type {string | undefined} */ (undefined)) => bubble({ ...v, long: true, issue: /** @type {any} */ ({ kind, detail, untilTurn: 0, until: 0 }) }, { lang })
  assert.deepEqual([note('heavy', 'es').say, note('heavy', 'es').ask, note('heavy', 'es').label], ['chat largo sin lean: más de 60k tokens releídos por petición', '/pet lean on', 'arreglar'])
  assert.equal(note('dizzy', 'zh', '/src/a.txt').say, '重复读取，内容没变：a.txt')
  assert.equal(note('dizzy', 'zh').ask, note('dizzy', 'en').ask)
  assert.equal(note('stomach', 'pt', 'ttl_expired_5m').say, 'cache refeito: mais de 5 minutos sem atividade')
  assert.equal(note('stomach', 'pt', 'ttl_expired_5m').fix, 'Só uma nota: o cache expira depois de uma pausa.')
  assert.equal(note('stomach', 'es', 'something_new').say, 'caché reconstruida: something_new') // a cause without words is shown as it came
  assert.equal(note('bloated', 'en').say, 'context almost full')
  assert.equal(note('bloated', 'es', '91').say, 'contexto al 91%')
  assert.deepEqual(Object.keys(CHEERS), ['lean', 'evolve']) // none about the cache: a high hit is the usual case and nothing the person did
  assert.equal(/** @type {any} */ (CHEERS.lean)(0, 'zh'), 'lean 已开：风格生效了')
  assert.equal(TALK.recap({ kind: 'recap', at: 0, fails: { npm: 2, '?': 1, go: 1 }, rereads: 1, rebuilds: 2 }, 'es').say, 'turno largo: npm falló 2 veces, un comando falló una vez, otros 1 con fallos, 1 relectura, caché reconstruida 2 veces')
  assert.equal(TALK.recap({ kind: 'recap', at: 0, fails: { npm: 2 }, rereads: 3 }, 'zh').say, '这一轮很长：npm 失败 2 次，重复读取 3 次')
  assert.equal(TALK.silly({ kind: 'silly', at: 0, n: 0.99 }, 'pt').say, 'protagonista')
  assert.deepEqual(['en', 'es', 'pt', 'zh'].map(l => cuddle('wit', 0, l)), ['noted. carry on', 'anotado. sigue', 'anotado. pode seguir', '收到。继续吧'])
  assert.deepEqual(['en', 'es', 'pt', 'zh'].map(l => ago(5 * 3_600_000, l)), ['5 h ago', 'hace 5 h', 'há 5 h', '5 小时前'])
  assert.deepEqual(['es', 'zh'].map(l => personalityOf([90, 50, 10, 40, 70], l)), ['Lo dice seco y corto, y se sobresalta con cada línea roja.', '说话干脆利落，却见到红字就一惊。'])
})

test('in every language every bubble is short and sober: no exclamation mark, and never over two lines of text', () => {
  const t = 1000, v = { ...view(initialState(), t), long: true }
  // the details each note really gets: the widest of each
  const DETAILS = /** @type {Record<string, string[]>} */ ({ stomach: ['ttl_expired_5m', 'likely_server_side', 'system_prompt_changed', 'tools_changed'], dizzy: ['/src/some/long-file-name.test.js'], loop: ['docker-compose'], heavy: ['1000'], cold: ['1000'], bloated: ['100'] })
  const views = [
    ...Object.keys(ISSUES).flatMap(kind => [undefined, ...(DETAILS[kind] ?? [])].map(detail => ({ ...v, mood: kind, issue: { kind, detail, untilTurn: 0, until: 0, n: 12, turns: 3 } }))),
    ...Object.keys(CHEERS).map(kind => ({ ...v, mood: 'cheer', cheer: { kind, at: 0, value: 1 } })),
    ...[true, false].flatMap(lean => [true, false].flatMap(long => [0, 1, 2].map(turn => ({ ...v, lean, long, turn })))),
    ...[true, false].map(long => ({ ...v, wait: true, long })),
  ]
  for (const lang of Object.keys(LANGS)) for (const stat of STATS) for (const x of views) {
    const b = bubble(/** @type {any} */ (x), { voice: stat, lang })
    for (const one of [b]) for (const line of [one.say, one.fix ?? '']) {
      assert.doesNotMatch(line, /[!！¡\n{}]|undefined|NaN/, `${lang} ${line}`)
      assert.ok(cols(line) <= 72, `${lang} ${cols(line)}: ${line}`)
    }
  }
})
