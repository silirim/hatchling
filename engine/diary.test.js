// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { RULES, dayOf } from './engine.js'
import { whole, open, touch, cuddled, bought, grew, memory, saying, told, recall, memories, words, page, lasting, bandOf, dated } from './diary.js'
import { LANGS } from './lang/index.js'

const DAY = 86_400_000, H = 3_600_000, MIN = 60_000
// 10 in the morning by the clock of the machine the test runs on, whatever its time zone
const T = new Date(2026, 10, 13, 10).getTime()
const kinds = (/** @type {import('./diary.js').Diary} */ d) => d.lines.map(l => l.kind)
/** One chat a day in `folder` at the same hour, for `days` days after the first. */
const daily = (/** @type {import('./diary.js').Diary} */ d, /** @type {number} */ days, folder = 'cachito', from = 1) => { for (let i = from; i < from + days; i++) d = open(d, { now: T + i * DAY, folder }); return d }

test('the diary begins with the first chat: a newborn has its first day together, an older pet only begins one', () => {
  assert.deepEqual(whole(undefined), { lines: [], done: [], first: 0, folders: {}, bands: [0, 0, 0, 0], sittings: [], sit: null, today: { day: 0, ms: 0, at: 0 }, longest: { ms: 0, at: 0 }, lastDay: 0, told: 0, toldKind: '' })
  const born = open(whole(undefined), { now: T, folder: 'cachito', born: true })
  assert.deepEqual(born.lines, [{ at: T, kind: 'first' }])
  assert.deepEqual([born.first, born.folders, born.bands, born.lastDay], [T, { cachito: 1 }, [0, 1, 0, 0], dayOf(T)])
  assert.deepEqual(kinds(open(whole(undefined), { now: T, folder: 'cachito' })), ['began'])
  // a second chat the same day writes nothing: no line a chat
  assert.deepEqual(kinds(open(born, { now: T + H, folder: 'cachito' })), ['first'])
  // before any chat opened it, nothing is written
  assert.deepEqual(touch(whole(undefined), T).lines, [])
  assert.deepEqual(cuddled(whole(undefined), 10, T).lines, [])
})

test('milestones are written once: a week, a month, 100 days, the first thing bought, each stage, 10, 50 and 100 cuddles', () => {
  let d = open(whole(undefined), { now: T, folder: 'cachito', born: true })
  d = open(d, { now: T + 6 * DAY, folder: 'cachito' })
  assert.ok(!kinds(d).includes('week'))
  d = open(d, { now: T + 7 * DAY, folder: 'cachito' })
  d = open(d, { now: T + 8 * DAY, folder: 'cachito' })
  assert.equal(kinds(d).filter(k => k === 'week').length, 1)
  d = open(d, { now: T + 30 * DAY, folder: 'cachito' })
  d = open(d, { now: T + 100 * DAY, folder: 'cachito' })
  assert.deepEqual(kinds(d).filter(k => ['week', 'month', 'hundred'].includes(k)), ['week', 'month', 'hundred'])
  // a pet met again after 40 days gets the week and the month it passed, once each
  const late = open(open(whole(undefined), { now: T, folder: 'x' }), { now: T + 40 * DAY, folder: 'x' })
  assert.deepEqual(kinds(late).filter(k => k === 'week' || k === 'month'), ['week', 'month'])
  for (const n of [1, 9, 10, 10, 11, 50, 100, 101]) d = cuddled(d, n, T + 100 * DAY)
  assert.deepEqual(d.lines.filter(l => l.kind === 'cuddles').map(l => l.n), [10, 50, 100])
  d = bought(bought(d, 'mug', T + 100 * DAY), 'scarf', T + 101 * DAY)
  assert.deepEqual(d.lines.filter(l => l.kind === 'bought').map(l => l.name), ['mug']) // the first only
  d = grew(grew(grew(d, 'adult', T + 100 * DAY), 'adult', T + 101 * DAY), 'crown', T + 102 * DAY)
  assert.deepEqual(d.lines.filter(l => l.kind === 'grew').map(l => l.name), ['adult', 'crown'])
  // written once in the diary's life: a milestone whose line has gone out is not written again
  const gone = { ...d, lines: d.lines.filter(l => l.kind !== 'week') }
  assert.ok(!kinds(open(gone, { now: T + 103 * DAY, folder: 'cachito' })).includes('week'))
})

test('habits come from counters and have one line each, rewritten only when the habit changes', () => {
  // the folder worked in most, and the usual time of day, once five chats were opened
  let d = daily(open(whole(undefined), { now: T, folder: 'cachito', born: true }), 3)
  assert.deepEqual(kinds(d).filter(k => k === 'folder' || k === 'band'), [])
  d = daily(d, 1, 'cachito', 4)
  assert.deepEqual(d.lines.filter(l => l.kind === 'folder' || l.kind === 'band').map(l => [l.kind, l.name ?? l.n]), [['folder', 'cachito'], ['band', bandOf(T) + 1]])
  const before = d.lines.find(l => l.kind === 'folder')?.at
  d = daily(d, 3, 'cachito', 5)
  assert.equal(d.lines.filter(l => l.kind === 'folder').length, 1)
  assert.equal(d.lines.find(l => l.kind === 'folder')?.at, before) // the same habit: the line is not touched
  // another folder takes over: the line is written again, still one
  d = daily(d, 12, 'vodmax', 8)
  assert.deepEqual(d.lines.filter(l => l.kind === 'folder').map(l => l.name), ['vodmax'])
  // no folder holds half the chats: no habit to tell
  let mixed = open(whole(undefined), { now: T, folder: 'a' })
  for (const [i, f] of ['b', 'c', 'd', 'e', 'f'].entries()) mixed = open(mixed, { now: T + (i + 1) * H, folder: f })
  assert.ok(!kinds(mixed).includes('folder'))
  // the folders counted are bounded: the least used goes, never the one just opened
  let many = whole(undefined)
  for (let i = 0; i < 30; i++) many = open(many, { now: T + i * MIN, folder: `f${i}` })
  assert.equal(Object.keys(many.folders).length, RULES.diaryFolders)
  assert.ok(many.folders.f29)
})

test('time at work: turns close together make a sitting, a pause of 15 minutes ends it; the usual sitting, the longest day and a long day come from it', () => {
  let d = open(whole(undefined), { now: T, folder: 'cachito' })
  // six sittings of 40 minutes, an hour apart: a turn every 10 minutes
  for (let s = 0; s < 6; s++) for (let m = 0; m <= 40; m += 10) d = touch(d, T + s * 100 * MIN + m * MIN)
  assert.deepEqual(d.sittings, [40, 40, 40, 40, 40]) // the sixth is under way
  assert.equal(d.today.ms, 6 * 40 * MIN)
  assert.deepEqual(d.lines.filter(l => l.kind === 'sitting').map(l => l.n), [40])
  assert.deepEqual(d.lines.filter(l => l.kind === 'longest').map(l => l.n), [240])
  assert.ok(!kinds(d).includes('longday')) // the day is not over
  // the next day opens: yesterday, 4 hours at work, was a long one, and is dated yesterday
  const next = open(d, { now: T + DAY, folder: 'cachito' })
  const long = next.lines.find(l => l.kind === 'longday')
  assert.deepEqual([long?.n, dayOf(long?.at ?? 0)], [240, dayOf(T)])
  assert.equal(next.today.ms, 0)
  // a short day leaves no such line, and the pause between turns is not work
  const short = open(touch(touch(open(whole(undefined), { now: T, folder: 'x' }), T + 5 * MIN), T + 3 * H), { now: T + DAY, folder: 'x' })
  assert.ok(!kinds(short).includes('longday'))
  assert.equal(touch(touch(open(whole(undefined), { now: T, folder: 'x' }), T + 5 * MIN), T + 3 * H).today.ms, 5 * MIN)
  assert.deepEqual([lasting(45), lasting(200), lasting(200, 'zh'), lasting(60, 'es')], ['45 min', '3 h 20 min', '3 小时 20 分钟', '1 h 0 min'])
})

test('recent facts: back after days away, a folder new this week; the first day no folder is new', () => {
  let d = open(whole(undefined), { now: T, folder: 'cachito' })
  assert.ok(!kinds(d).includes('newfolder'))
  d = open(d, { now: T + DAY, folder: 'vodmax' })
  assert.deepEqual(d.lines.filter(l => l.kind === 'newfolder').map(l => l.name), ['vodmax'])
  d = open(d, { now: T + 2 * DAY, folder: 'vodmax' })
  assert.equal(d.lines.filter(l => l.kind === 'newfolder').length, 1)
  assert.ok(!kinds(open(d, { now: T + 4 * DAY, folder: 'vodmax' })).includes('away')) // two days: not away
  d = open(d, { now: T + 7 * DAY, folder: 'vodmax' })
  assert.deepEqual(d.lines.filter(l => l.kind === 'away').map(l => l.n), [5])
})

test('never more than 40 lines, the oldest go; whatever the store holds reads whole, and nothing but times, numbers and names is kept', () => {
  let d = open(whole(undefined), { now: T, folder: 'f0' })
  for (let i = 1; i <= 60; i++) d = open(d, { now: T + i * DAY, folder: `f${i}` }) // a new folder a day
  assert.equal(d.lines.length, RULES.diaryMax)
  assert.equal(RULES.diaryMax, 40)
  assert.ok(!kinds(d).includes('began')) // the oldest went
  assert.equal(d.lines.at(-1)?.name, 'f60')
  // a broken store, and one with fields that have no place in a diary
  assert.deepEqual(whole({ lines: 'x', folders: 7, bands: null, sit: 'no' }), whole(undefined))
  const odd = whole({ lines: [{ at: T, kind: 'first', cmd: 'rm -rf', error: 'boom', text: 'secret' }, { at: T, kind: 'nonsense' }, { kind: 'week' }, { at: T, kind: 'folder', name: 'a\nb'.padEnd(80, 'x') }], prompt: 'secret' })
  assert.deepEqual(odd.lines, [{ at: T, kind: 'first' }, { at: T, kind: 'folder', name: 'a b'.padEnd(24, 'x') }])
  assert.ok(!('prompt' in odd))
  for (const l of d.lines) assert.deepEqual(Object.keys(l).filter(k => !['at', 'kind', 'n', 'name'].includes(k)), [])
  assert.doesNotMatch(JSON.stringify(d), /cmd|error|prompt|answer|text/)
})

test('a memory to say, at most one a day: a milestone of time reached today, a long day yesterday, or a habit true of this moment, never twice running', () => {
  // a month reached today
  let d = daily(open(whole(undefined), { now: T, folder: 'cachito', born: true }), 29)
  const at = { now: T + 30 * DAY, folder: 'cachito' }
  d = open(d, at)
  const m = memory(d, at)
  assert.deepEqual([m?.kind, m?.key], ['month', 'mem.month'])
  assert.equal(saying(/** @type {any} */ (m), 'en'), 'a month that we know each other')
  assert.equal(saying(/** @type {any} */ (m), 'es', 3), 'treinta días juntos. llevé la cuenta')
  d = told(d, 'month', at.now)
  assert.equal(memory(d, at), null) // said: nothing more today
  assert.equal(memory(d, { ...at, now: at.now + 5 * H }), null)
  // the next day the habits are true: here at the usual hour, in the usual folder. One is said, the other the day after
  const day2 = { now: T + 31 * DAY, folder: 'cachito' }
  d = open(d, day2)
  const band = memory(d, day2)
  assert.equal(band?.kind, 'band')
  assert.equal(saying(/** @type {any} */ (band), 'en', 2), 'here again in the morning. a good hour')
  assert.equal(saying(/** @type {any} */ (band), 'zh'), '上午又见面了')
  d = told(d, 'band', day2.now)
  const day3 = { now: T + 32 * DAY, folder: 'cachito' }
  d = open(d, day3)
  const here = memory(d, day3)
  assert.equal(here?.kind, 'folder')
  assert.equal(saying(/** @type {any} */ (here), 'pt', 4), 'cachito de novo. gosto daqui')
  d = told(d, 'folder', day3.now)
  assert.equal(memory(open(d, { now: T + 33 * DAY, folder: 'cachito' }), { now: T + 33 * DAY, folder: 'cachito' })?.kind, 'band') // in turn
  // at another hour, in another folder, no habit is true: nothing to say
  assert.equal(memory(d, { now: T + 33 * DAY + 9 * H, folder: 'elsewhere' }), null)
  // a long day yesterday goes before the habits; the days away are written and never said
  let long = open(whole(undefined), { now: T, folder: 'x' })
  for (let i = 1; i <= 20; i++) long = touch(long, T + i * 10 * MIN)
  const morrow = { now: T + DAY, folder: 'x' }
  long = open(long, morrow)
  assert.equal(memory(long, morrow)?.kind, 'longday')
  const away = open(open(whole(undefined), { now: T, folder: 'x' }), { now: T + 9 * DAY, folder: 'x' })
  assert.ok(kinds(away).includes('away'))
  assert.notEqual(memory(away, { now: T + 9 * DAY, folder: 'x' })?.kind, 'away')
})

test('for the model: at most three lines, the ones that bear on this moment, in English, with their age and nothing else', () => {
  let d = daily(open(whole(undefined), { now: T, folder: 'cachito', born: true }), 8)
  d = cuddled(d, 10, T + 8 * DAY)
  const now = T + 8 * DAY
  const top = recall(d, { now, folder: 'cachito' })
  assert.equal(top.length, RULES.diaryRecall)
  assert.deepEqual(top.map(l => l.kind).sort(), ['band', 'cuddles', 'folder']) // the habits true now, and the newest milestone
  assert.deepEqual(memories(d, { now, folder: 'cachito' }).sort(), ['10 cuddles (today)', 'usually here in the morning (a habit)', 'works most often in cachito (a habit)'])
  // elsewhere, at another hour, the habits do not bear: milestones only, the fresh ones first
  assert.deepEqual(recall(d, { now: now + 9 * H, folder: 'other' }).map(l => l.kind), ['cuddles', 'week', 'first'])
  assert.deepEqual(recall(whole(undefined), { now, folder: 'x' }), [])
  for (const line of memories(d, { now, folder: 'cachito' })) assert.match(line, /^[\w ]+ \((today|yesterday|\d+ days ago|a habit)\)$/)
})

test('/pet diary shows every line with its day, the counters and what the diary holds, in the four languages', () => {
  let d = daily(open(whole(undefined), { now: T, folder: 'cachito', born: true }), 7)
  d = grew(bought(d, 'mug', T + 7 * DAY), 'adult', T + 7 * DAY)
  const en = page(d, T + 7 * DAY, 'en').split('\n')
  assert.equal(en[0], `CACHITO DIARY · ${d.lines.length} of 40 lines`)
  assert.deepEqual(en.slice(2, 2 + d.lines.length), [`${dated(T)}  first day together`, `${dated(T + 4 * DAY)}  works most often in cachito`, `${dated(T + 4 * DAY)}  usually here in the morning`, `${dated(T + 7 * DAY)}  a week together`, `${dated(T + 7 * DAY)}  first thing bought: a coffee mug`, `${dated(T + 7 * DAY)}  grew up: adult`])
  assert.match(en.at(-2) ?? '', /^counted for the habits: chats opened by folder: cachito 8; by time of day: at night 0, in the morning 8, in the afternoon 0, in the evening 0; sittings: \d+; at work today: 0 min$/)
  assert.match(en.at(-1) ?? '', /^Only times, counts and folder names, kept on this machine; no command, error, prompt, file or answer\. With comments on, two or three of these lines go to the small model\. \/pet diary clear empties it\.$/)
  assert.match(page(d, T + 7 * DAY, 'es'), /^DIARIO DE CACHITO · 6 de 40 líneas\n\n.*  primer día juntos\n.*  trabaja casi siempre en cachito\n.*  suele estar aquí por la mañana\n.*  una semana juntos\n.*  primera compra: una taza de café\n.*  creció: adulto\n/)
  assert.match(page(d, T + 7 * DAY, 'zh'), /  最常在 cachito 工作\n.*  通常上午在这里\n.*  在一起一周\n.*  第一次购物：咖啡杯\n.*  长大了：成年\n/)
  assert.equal(page(whole(undefined), T, 'pt').split('\n')[0], 'O diário está vazio. O pet escreve sozinho: marcos, hábitos e dias recentes.')
  // every kind of line has its words in every language: none shows a key or an empty place
  const all = /** @type {import('./diary.js').Line[]} */ ([['first'], ['began'], ['bought', 0, 'mug'], ['grew', 0, 'crown'], ['cuddles', 50], ['week'], ['month'], ['hundred'], ['folder', 0, 'cachito'], ['band', 4], ['sitting', 45], ['longest', 250], ['longday', 200], ['away', 5], ['newfolder', 0, 'vodmax']].map(([kind, n, name]) => ({ at: T, kind, ...(n ? { n } : null), ...(name ? { name } : null) })))
  for (const lang of Object.keys(LANGS)) for (const l of all) assert.doesNotMatch(words(l, lang), /diary\.|band\.|\{|undefined|[!！]/, `${lang} ${l.kind}`)
  assert.equal(words(/** @type {any} */ (all[9]), 'pt'), 'costuma estar aqui à noite')
})
