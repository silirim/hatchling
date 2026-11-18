// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGS, list, put } from './lang/index.js'
import { LIMITS, empty, whole, touch, next, answer, setUntil, usual, stage, minsLeft, back, switched, cleared, dayKey, minutes, clock, hhmm } from './routine.js'

const MIN = 60_000, H = 60 * MIN
// by the clock of the machine the tests run on, as the routine reads it: Tuesday 17 November 2026 is day 17
const at = (/** @type {number} */ day, /** @type {number} */ h, m = 0) => new Date(2026, 10, day, h, m).getTime()
/** A day that began at `h`, the person there since. */
const begun = (/** @type {number} */ day, /** @type {number} */ h, m = 0, r = empty()) => touch(r, at(day, h, m))
/** A routine with `n` earlier days that each finished at 18:00 and started at 9:00. */
const learned = (n = 3, coffee = true) => { let r = empty(); for (let d = 17 - n; d < 17; d++) { r = touch(r, at(d, 9)); r = setUntil(r, '18', at(d, 9, 5)).r; r = { ...r, days: { ...r.days, [dayKey(at(d, 9))]: { .../** @type {any} */ (r.days[dayKey(at(d, 9))]), coffee, coffeeAt: at(d, 9, 20) } } }; r = touch(r, at(d, 18)) } return r }

test('a day runs from 04:00 to 04:00 by the local clock, and times read in 24 hours', () => {
  assert.equal(dayKey(at(17, 9)), '2026-11-17')
  assert.equal(dayKey(at(18, 0, 30)), '2026-11-17') // past midnight: still the day it began in
  assert.equal(dayKey(at(18, 3, 59)), '2026-11-17')
  assert.equal(dayKey(at(18, 4)), '2026-11-18')
  assert.deepEqual([minutes(at(17, 18, 30)), minutes(at(18, 0, 30))], [18 * 60 + 30, 24 * 60 + 30])
  assert.deepEqual([clock(18 * 60 + 30), clock(1470), clock(9 * 60 + 5), hhmm(at(17, 7, 3))], ['18:30', '00:30', '09:05', '07:03'])
})

test('the finish time is asked once a day, ten minutes after the first use, with three hours, other and later; never during a turn', () => {
  let r = begun(17, 9)
  assert.equal(next(r, at(17, 9, 5)).ask, undefined) // too soon
  assert.equal(next(r, at(17, 9, 10), { busy: true }).ask, undefined) // a turn runs
  const n = next(r, at(17, 9, 10))
  assert.deepEqual(n.ask, { kind: 'finish', at: at(17, 9, 10), opts: ['17', '18', '19', 'other', 'later'] })
  assert.deepEqual([n.r.asked, n.r.q?.kind, n.changed], [1, 'finish', true])
  assert.equal(next(n.r, at(17, 9, 12)).ask, undefined) // one question at a time
  // answered with an hour: the finish time of today, remembered in the day
  const a = answer(n.r, '18', at(17, 9, 12))
  assert.deepEqual([a.ok, a.reply, a.time, a.r.until, a.r.q, a.r.days['2026-11-17']?.finish], [true, 'until.set', at(17, 18), at(17, 18), null, at(17, 18)])
  assert.deepEqual(answer(n.r, '18:00', at(17, 9, 12)).time, at(17, 18)) // as the button shows it
  // not asked again that day, whatever the answer; the next day it is
  let later = answer(n.r, 'later', at(17, 9, 12))
  assert.deepEqual([later.ok, later.reply, later.r.until], [true, 'answer.later', 0])
  for (const h of [10, 12, 15, 20]) assert.notEqual(next(touch(later.r, at(17, h)), at(17, h, 30)).ask?.kind, 'finish')
  assert.equal(next(touch(a.r, at(18, 9)), at(18, 9, 15)).ask?.kind, 'finish')
  // late in the day the hours offered are the ones still ahead; too late, nothing is asked
  assert.deepEqual(next(begun(17, 18, 30), at(17, 18, 45)).ask?.opts, ['20', '21', '22', 'other', 'later'])
  assert.deepEqual(next(begun(17, 21), at(17, 21, 10)).ask?.opts, ['22', '23', 'other', 'later'])
  assert.equal(next(begun(17, 22), at(17, 22, 20)).ask, undefined) // no whole hour is left
  assert.equal(next(begun(17, 23), at(17, 23, 30)).ask, undefined)
})

test('an answer that is none of the question\'s, or with no question up, changes nothing', () => {
  const n = next(begun(17, 9), at(17, 9, 10))
  const bad = answer(n.r, 'maybe', at(17, 9, 11))
  assert.deepEqual([bad.ok, bad.reply, bad.opts, bad.r.q?.kind], [false, 'answer.what', ['17', '18', '19', 'other', 'later'], 'finish'])
  assert.deepEqual([answer(n.r, 'yes', at(17, 9, 11)).ok, answer(begun(17, 9), 'yes', at(17, 9, 11)).reply], [false, 'answer.none'])
})

test('a question unanswered for 30 minutes goes away quietly, and is not asked again', () => {
  const n = next(begun(17, 9), at(17, 9, 10))
  assert.equal(next(n.r, at(17, 9, 39)).r.q?.kind, 'finish')
  const gone = next(n.r, at(17, 9, 40), { busy: true })
  assert.deepEqual([gone.r.q, gone.changed, gone.ask, gone.say, gone.warn], [null, true, undefined, undefined, undefined])
  assert.deepEqual([answer(n.r, '18', at(17, 9, 41)).ok, answer(n.r, '18', at(17, 9, 41)).reply], [false, 'answer.none']) // too late to answer
  assert.notEqual(next(gone.r, at(17, 9, 50)).ask?.kind, 'finish')
})

test('never more than three questions a day, and not one right after another', () => {
  let r = begun(17, 9)
  const first = next(r, at(17, 9, 10))
  r = answer(first.r, 'later', at(17, 9, 11)).r
  assert.equal(next(r, at(17, 9, 12)).ask, undefined) // five minutes between two
  const second = next(r, at(17, 9, 15))
  assert.equal(second.ask?.kind, 'coffee')
  assert.equal(second.r.asked, 2)
  // a day that somehow reached its cap asks nothing more
  const full = { ...begun(17, 9), asked: LIMITS.questionsDay }
  assert.equal(next(full, at(17, 9, 30)).ask, undefined)
  assert.equal(next(touch(full, at(18, 9)), at(18, 9, 30)).ask?.kind, 'finish') // a new day counts from none
})

test('coffee: asked in the morning; no gets one reminder two hours later, yes one line three hours later, and never a second question', () => {
  let r = answer(next(begun(17, 9), at(17, 9, 10)).r, 'later', at(17, 9, 11)).r
  const q = next(r, at(17, 9, 20))
  assert.deepEqual(q.ask, { kind: 'coffee', at: at(17, 9, 20), opts: ['yes', 'no'] })
  // no
  const no = answer(q.r, 'no', at(17, 9, 21))
  assert.deepEqual([no.ok, no.reply, no.r.days['2026-11-17']?.coffee, no.r.days['2026-11-17']?.coffeeAt], [true, 'answer.coffee.no', false, at(17, 9, 21)])
  assert.equal(next(no.r, at(17, 11, 20)).say, undefined)
  const again = next(no.r, at(17, 11, 21), { busy: true }) // a line is no question: a turn does not hold it
  assert.equal(again.say, 'coffee.no')
  assert.equal(next(again.r, at(17, 13, 30)).say, undefined) // once
  // yes
  const yes = answer(q.r, 'yes', at(17, 9, 21))
  assert.deepEqual([yes.reply, yes.r.days['2026-11-17']?.coffee], ['answer.coffee.yes', true])
  assert.equal(next(yes.r, at(17, 12, 20)).say, undefined)
  const line = next(yes.r, at(17, 12, 21))
  assert.equal(line.say, 'coffee.yes')
  // the rest of the day: no other small question, lunch included
  for (const r2 of [again.r, line.r, yes.r, no.r]) for (const h of [13, 14, 15, 17]) assert.equal(next(touch(r2, at(17, h)), at(17, h, 30)).ask, undefined)
  // a day that starts at 11 or later is not asked about coffee
  const late = answer(next(begun(17, 11), at(17, 11, 10)).r, 'later', at(17, 11, 11)).r
  assert.equal(next(late, at(17, 11, 30)).ask, undefined)
})

test('lunch takes the place of the coffee question on a day that had none: asked between 13 and 16, no gets one reminder', () => {
  const late = answer(next(begun(17, 11), at(17, 11, 10)).r, 'later', at(17, 11, 11)).r
  assert.equal(next(late, at(17, 12, 59)).ask, undefined)
  const q = next(late, at(17, 13, 5))
  assert.deepEqual(q.ask, { kind: 'lunch', at: at(17, 13, 5), opts: ['yes', 'no'] })
  const no = answer(q.r, 'no', at(17, 13, 6))
  assert.deepEqual([no.reply, no.r.small, Object.keys(/** @type {any} */ (no.r.days['2026-11-17'])).sort()], ['answer.lunch.no', { kind: 'lunch', yes: false, at: at(17, 13, 6) }, ['end', 'start']]) // lunch is today's only: not in the memory
  assert.equal(next(no.r, at(17, 14, 6)).say, 'lunch.no')
  assert.equal(next(next(no.r, at(17, 14, 6)).r, at(17, 15)).say, undefined)
  assert.equal(next(answer(q.r, 'yes', at(17, 13, 6)).r, at(17, 15)).say, undefined)
  // a day that starts after 16 has no small question at all
  const evening = answer(next(begun(17, 16, 30), at(17, 16, 40)).r, 'later', at(17, 16, 41)).r
  const n = next(evening, at(17, 16, 50))
  assert.deepEqual([n.ask, n.r.done.includes('small')], [undefined, true])
})

test('/pet until: any time, 24 hours; off drops it; and the day\'s question about it is not asked', () => {
  const r = begun(17, 9)
  for (const [typed, h, m] of /** @type {[string, number, number][]} */ ([['18:30', 18, 30], ['18', 18, 0], ['18.30', 18, 30], ['1830', 18, 30], ['18h30', 18, 30], ['18h', 18, 0], ['9:45', 9, 45]])) assert.equal(setUntil(r, typed, at(17, 9, 1)).time, at(17, h, m), typed)
  const set = setUntil(r, '18:30', at(17, 9, 1))
  assert.deepEqual([set.ok, set.reply, set.r.until, set.r.days['2026-11-17']?.finish], [true, 'until.set', at(17, 18, 30), at(17, 18, 30)])
  assert.notEqual(next(set.r, at(17, 9, 15)).ask?.kind, 'finish')
  // while the question is up, the command answers it
  const q = next(r, at(17, 9, 10))
  assert.equal(setUntil(q.r, '19', at(17, 9, 11)).r.q, null)
  // off
  const off = setUntil(set.r, 'off', at(17, 10))
  assert.deepEqual([off.reply, off.r.until, off.r.days['2026-11-17']?.finish, next(off.r, at(17, 10, 30)).ask?.kind], ['until.off', 0, undefined, 'coffee'])
  // past midnight: the next time the clock shows it, and the day stays the one that began
  const night = setUntil(begun(17, 22), '00:30', at(17, 23))
  assert.deepEqual([night.time, dayKey(night.time)], [at(18, 0, 30), '2026-11-17'])
  assert.equal(setUntil(begun(17, 22), '24', at(17, 23)).time, at(18, 0))
  // a time gone many hours ago is not tomorrow's; and what is no time is refused
  assert.deepEqual([setUntil(begun(17, 15), '9', at(17, 15)).reply, setUntil(begun(17, 15), '9', at(17, 15)).ok], ['until.past', false])
  for (const typed of ['', 'soon', '25', '18:60', '24:30', '-3', '18:5']) assert.deepEqual([setUntil(r, typed, at(17, 9, 1)).ok, setUntil(r, typed, at(17, 9, 1)).reply], [false, 'until.usage'], typed)
})

test('the finish time is warned about 30 and 10 minutes before and at the time, each once, for all the chats together', () => {
  let r = setUntil(begun(17, 9), '18', at(17, 9, 1)).r
  assert.deepEqual([stage(at(17, 18), at(17, 17, 29)), stage(at(17, 18), at(17, 17, 30)), stage(at(17, 18), at(17, 17, 50)), stage(at(17, 18), at(17, 18)), stage(at(17, 18), at(17, 18, 29)), stage(at(17, 18), at(17, 18, 30)), stage(0, at(17, 18))], ['', 'w30', 'w10', 'w0', 'w0', '', ''])
  assert.equal(next(r, at(17, 17, 29)).warn, undefined)
  const w30 = next(r, at(17, 17, 30), { busy: true }) // a warning is no question: said during a turn too
  assert.equal(w30.warn, 'w30')
  assert.equal(next(w30.r, at(17, 17, 31)).warn, undefined) // another chat, reading what the first one kept: said once
  const w10 = next(w30.r, at(17, 17, 50))
  assert.equal(w10.warn, 'w10')
  const w0 = next(w10.r, at(17, 18))
  assert.deepEqual([w0.warn, next(w0.r, at(17, 18, 5)).warn], ['w0', undefined])
  // a machine asleep through the first two: only the one that is due, and the earlier ones are not said late
  const woke = next(r, at(17, 18, 3))
  assert.deepEqual([woke.warn, woke.r.done.filter(x => x.startsWith('w'))], ['w0', ['w30', 'w10', 'w0']])
  assert.equal(next(r, at(17, 18, 40)).warn, undefined) // half an hour late: dropped
  // a new time the same day is warned about anew; with the routine off the warnings stay
  const moved = setUntil(w0.r, '19', at(17, 18, 10)).r
  assert.equal(next(moved, at(17, 18, 31)).warn, 'w30')
  assert.equal(next(switched(r, true), at(17, 17, 30)).warn, 'w30')
  // past midnight
  const night = setUntil(begun(17, 22), '00:30', at(17, 23)).r
  assert.deepEqual([next(night, at(18, 0, 0)).warn, next(night, at(18, 0, 30)).warn], ['w30', 'w0'])
})

test('after three answered days the usual time is proposed: yes takes it, no brings the hours without counting a second question', () => {
  assert.equal(next(touch(learned(2), at(17, 9)), at(17, 9, 10)).ask?.kind, 'finish') // two days are not a habit
  const r = touch(learned(3), at(17, 9))
  assert.deepEqual(usual(r, at(17, 9)), { days: 3, start: 9 * 60, finish: 18 * 60, finishDays: 3, coffee: true, coffeeDays: 3 })
  const q = next(r, at(17, 9, 10))
  assert.deepEqual(q.ask, { kind: 'usual', at: at(17, 9, 10), opts: ['yes', 'no'], time: at(17, 18) })
  const yes = answer(q.r, 'yes', at(17, 9, 11))
  assert.deepEqual([yes.reply, yes.time, yes.r.until], ['until.set', at(17, 18), at(17, 18)])
  const no = answer(q.r, 'no', at(17, 9, 11))
  assert.deepEqual([no.ok, no.reply, no.ask, no.r.asked], [true, '', { kind: 'finish', at: at(17, 9, 11), opts: ['17', '18', '19', 'other', 'later'] }, 1])
  assert.equal(answer(no.r, '19', at(17, 9, 12)).r.until, at(17, 19))
  // a day that starts after the usual time is asked plainly
  assert.equal(next(touch(learned(3), at(17, 17, 40)), at(17, 17, 50)).ask?.kind, 'finish')
  // the middle one of the days, to five minutes; a tie on coffee is no habit; today is left out
  let mixed = empty()
  for (const [d, fin, cup] of /** @type {[number, string, boolean][]} */ ([[13, '17:02', true], [14, '18:33', false], [15, '21:00', true], [16, '18:31', false]])) { mixed = touch(mixed, at(d, 8, d)); mixed = setUntil(mixed, fin, at(d, 8, 30)).r; mixed = answer({ ...mixed, q: { kind: 'coffee', at: at(d, 8, 31), opts: ['yes', 'no'] } }, cup ? 'yes' : 'no', at(d, 8, 32)).r }
  assert.deepEqual(usual(mixed), { days: 4, start: 8 * 60 + 14, finish: 18 * 60 + 30, finishDays: 4, coffeeDays: 4 })
  assert.equal(usual(setUntil(touch(mixed, at(17, 6)), '23', at(17, 6)).r, at(17, 6)).finish, 18 * 60 + 30)
})

test('/pet routine off stops every question and the lines that follow one; on brings them back; clear forgets', () => {
  const q = next(begun(17, 9), at(17, 9, 10))
  const off = switched(q.r, true)
  assert.equal(off.q, null) // the question that was up goes
  for (const h of [9, 10, 13, 15]) { const n = next(touch(off, at(17, h, 20)), at(17, h, 40)); assert.deepEqual([n.ask, n.say], [undefined, undefined]) }
  assert.equal(answer(off, 'yes', at(17, 9, 12)).reply, 'answer.none')
  // the days go on being counted, and a day later the questions are back with `on`
  const day2 = touch(off, at(18, 9))
  assert.deepEqual(Object.keys(day2.days), ['2026-11-17', '2026-11-18'])
  assert.equal(next(switched(day2, false), at(18, 9, 10)).ask?.kind, 'finish')
  // clear: nothing learned is left, the choice stays
  const gone = cleared(switched(learned(5), true))
  assert.deepEqual([gone.days, gone.off, gone.until, usual(gone).days], [{}, true, 0, 0])
})

test('the memory is 30 days of answers and nothing else; what the store holds is made whole', () => {
  let r = empty()
  for (let d = 0; d < 40; d++) r = touch(r, new Date(2026, 8, 1 + d, 9).getTime())
  assert.equal(Object.keys(r.days).length, LIMITS.days)
  assert.equal(Object.keys(r.days)[0], dayKey(new Date(2026, 8, 11, 9).getTime()))
  // a day: when it started and ended, and the answers
  const day = answer(next(setUntil(begun(17, 9), '18', at(17, 9, 1)).r, at(17, 9, 15)).r, 'yes', at(17, 9, 16)).r
  assert.deepEqual(touch(day, at(17, 17, 55)).days['2026-11-17'], { start: at(17, 9), end: at(17, 17, 55), coffee: true, coffeeAt: at(17, 9, 16), finish: at(17, 18) })
  assert.deepEqual(whole(JSON.parse(JSON.stringify(day))), day)
  // junk
  assert.deepEqual(whole(undefined), empty())
  assert.deepEqual(whole({ off: 'yes', days: { nope: { start: 5 }, '2026-11-17': { start: 'x' }, '2026-11-16': { start: 10, end: 3, coffee: 'yes', finish: -1, text: 'hello' } }, day: '2026-11-17', asked: -4, done: ['w30', 'rm -rf', 7], until: 'soon', q: { kind: 'finish', at: 5, opts: ['17', '<b>', 9] }, small: { kind: 'tea' }, seen: NaN, extra: 1 }),
    { ...empty(), days: { '2026-11-16': { start: 10, end: 10 } }, day: '2026-11-17', done: ['w30'] })
})

test('midnight and a clock that changes: the day, the question and the answers hold', () => {
  // working past midnight: no new day, no new finish question
  let r = answer(next(begun(17, 21), at(17, 21, 10)).r, 'later', at(17, 21, 11)).r
  r = touch(r, at(18, 0, 30))
  assert.deepEqual([Object.keys(r.days), r.days['2026-11-17']?.end, next(r, at(18, 0, 45)).ask], [['2026-11-17'], at(18, 0, 30), undefined])
  // at 04:00 the next day begins: nothing of yesterday's questions, finish time or count is left
  const set = setUntil(begun(17, 22), '03:30', at(17, 23)).r
  const day2 = touch({ ...set, asked: 3 }, at(18, 8))
  assert.deepEqual([day2.day, day2.asked, day2.until, day2.done, day2.q], ['2026-11-18', 0, 0, [], null])
  // the clock set back an hour while a question is up: the question, asked at a moment not reached yet, goes; the day's start does not move later
  const q = next(begun(17, 9), at(17, 9, 10))
  const backHour = next(q.r, at(17, 8, 20))
  assert.deepEqual([backHour.r.q, backHour.ask], [null, undefined])
  assert.equal(answer(q.r, '18', at(17, 8, 20)).ok, false)
  assert.deepEqual([touch(q.r, at(17, 8, 20)).days['2026-11-17']?.start, touch(q.r, at(17, 8, 20)).days['2026-11-17']?.end], [at(17, 8, 20), at(17, 9)])
  // set forward past the finish time by hours: the warnings are dropped, not said late
  const jumped = next(setUntil(begun(17, 9), '12', at(17, 9, 1)).r, at(17, 15))
  assert.equal(jumped.warn, undefined)
  // set back to the day before: that day is today again, and what was asked there is asked no more
  const yesterday = next(touch(day2, at(17, 23)), at(17, 23, 30))
  assert.deepEqual([yesterday.r.day, yesterday.ask], ['2026-11-17', undefined])
})

test('the welcome back: by how long the person was away and the hour it is', () => {
  assert.equal(back(at(17, 10), at(17, 10, 59)), '') // under an hour
  assert.equal(back(0, at(17, 10)), '')
  assert.equal(back(at(17, 10), at(17, 11)), 'hour')
  assert.equal(back(at(17, 12, 30), at(17, 13, 45)), 'lunch')
  assert.equal(back(at(17, 12, 30), at(17, 16, 30)), 'long') // back too late for lunch
  assert.equal(back(at(17, 9), at(17, 12, 30)), 'long')
  assert.equal(back(at(17, 18), at(18, 8, 30)), 'morning') // Tuesday evening to Wednesday morning
  assert.equal(back(at(17, 18), at(18, 14)), 'long')
  assert.equal(back(at(17, 23), at(18, 1)), 'hour') // past midnight, the same day
  assert.equal(back(at(20, 18), at(23, 9)), 'weekend') // Friday evening to Monday morning
  assert.equal(back(at(20, 18), at(21, 10)), 'morning') // Saturday morning after Friday: no weekend away
  assert.equal(back(at(19, 18), at(24, 15)), 'weekend')
})

test('a finish time set near: the warning says the minutes really left, rounded up, in every language; the reply names only the warnings still to come', () => {
  // 18:46 set at 18:35: the first warning is due at once, and it is 11 minutes, not 30
  const set = setUntil(begun(17, 18, 18), '18:46', at(17, 18, 35))
  assert.deepEqual([set.reply, next(set.r, at(17, 18, 35)).warn, minsLeft(set.r.until, at(17, 18, 35))], ['until.set.10', 'w30', 11])
  assert.deepEqual([minsLeft(at(17, 18), at(17, 17, 30)), minsLeft(at(17, 18), at(17, 17, 30) + 11_000), minsLeft(at(17, 18), at(17, 17, 49) + 1_000), minsLeft(at(17, 18), at(17, 17, 50)), minsLeft(at(17, 18), at(17, 17, 59) + 59_000), minsLeft(at(17, 18), at(17, 18))], [30, 30, 11, 10, 1, 1])
  // the reply: 30 and 10 and the time, 10 and the time, the time alone
  const reply = (/** @type {string} */ typed) => setUntil(begun(17, 17), typed, at(17, 17, 20)).reply
  assert.deepEqual(['18', '17:51', '17:50', '17:31', '17:30', '17:21'].map(reply), ['until.set', 'until.set', 'until.set.10', 'until.set.10', 'until.set.0', 'until.set.0'])
  for (const [lang, table] of Object.entries(LANGS)) {
    for (const key of ['until.w30', 'until.w10']) {
      const lines = list(lang, key)
      assert.equal(lines.length, 6, `${lang} ${key}`)
      for (const l of lines) {
        assert.ok(l.includes('{min}') && l.includes('{time}') && !/\d/.test(l), `${lang} ${key}: ${l}`) // no minutes written in the line itself
        assert.match(put(l, { time: '18:46', min: 11 }), /11.*18:46|18:46.*11/, `${lang} ${key}`)
      }
    }
    assert.match(String(table['until.set']), /30.*10/, lang)
    assert.ok(/10/.test(String(table['until.set.10'])) && !/30/.test(String(table['until.set.10'])), lang)
    assert.ok(!/\b(30|10)\b/.test(String(table['until.set.0']).replace('{time}', '')), lang)
  }
})

test('the finish time, other: a time that is none of the hours offered; the question stays up until /pet until gives it, also one before 17', () => {
  const n = next(begun(17, 9), at(17, 9, 10))
  assert.deepEqual(n.ask?.opts, ['17', '18', '19', 'other', 'later'])
  const other = answer(n.r, 'other', at(17, 9, 11))
  assert.deepEqual([other.ok, other.reply, other.time, other.r.q?.kind, other.r.until], [true, 'answer.other', 0, 'finish', n.r.until])
  const noon = setUntil(other.r, '12:00', at(17, 9, 12))
  assert.deepEqual([noon.ok, noon.time, noon.r.until, noon.r.q], [true, at(17, 12), at(17, 12), null])
  // kept whole: a question with five answers is read back with all five
  assert.deepEqual(whole(JSON.parse(JSON.stringify(n.r))).q?.opts, ['17', '18', '19', 'other', 'later'])
  // each language has the button and the two lines
  for (const lang of Object.keys(LANGS)) for (const key of ['btn.other', 'ask.how.until', 'answer.other']) assert.equal(typeof (/** @type {any} */ (LANGS)[lang][key]), 'string', `${lang} ${key}`)
})
