// @ts-check
// The routine: the small closed questions the pet asks in a day (what time do you finish, had your coffee, had lunch), the finish
// time it then warns about, and what it learns from the answers. Kept in the store on the person's machine under `routine`, one
// copy for all their chats. Per day only the answers: when the day started and ended, coffee yes or no and when it was said, the
// finish time; for LIMITS.days days. Zero tokens: never sent to the comments model, never on the picture of /pet share. It is in
// the file of /pet export: it is the pet's memory of the person, and moves with the pet.
// Pure: the adapter gives the time, keeps the result, draws the question and its buttons. Times are moments (ms); the hour of the
// day is read by the clock of the person's machine, as engine.js `dayOf` does.

const MIN = 60_000, H = 60 * MIN
export const LIMITS = {
  days: 30,               // days remembered
  dayStartsH: 4,          // a day runs from 04:00 to 04:00: work past midnight belongs to the day it began in
  questionsDay: 3,        // questions asked in a day, at most
  questionMs: 30 * MIN,   // a question nobody answered goes away quietly after this
  gapMs: 5 * MIN,         // between one question and the next
  finishAfterMs: 10 * MIN, // the finish time is asked this long after the first use of the day
  coffeeBeforeH: 11,      // the coffee is asked about before this hour
  coffeeAgainMs: 2 * H,   // `no`: one reminder this long after
  coffeeLaterMs: 3 * H,   // `yes`: one line this long after
  lunchFromH: 13, lunchBeforeH: 16, // with no coffee question that day, lunch is asked about between these hours
  lunchAgainMs: 1 * H,    // `no`: one reminder this long after
  warnMin: [30, 10, 0],   // minutes before the finish time at which the pet warns
  warnLateMs: 30 * MIN,   // the last warning is still said this long after the time; later it is dropped
  usualDays: 3,           // answered days from which "as usual?" is proposed
  backAfterMs: 1 * H,     // a pause of the person this long gets a welcome back
  untilAheadMs: 16 * H,   // /pet until takes a time at most this far ahead
}
/** @typedef {'finish' | 'usual' | 'coffee' | 'lunch'} Kind */
/** A question that is up: its kind, when it was asked, the answers it takes, and for `usual` the moment proposed. @typedef {{ kind: Kind, at: number, opts: string[], time?: number }} Question */
/** A day as it is remembered. @typedef {{ start: number, end: number, coffee?: boolean, coffeeAt?: number, finish?: number }} Day */
/**
 * `days` is the memory. The rest is today's: `day` the day it is for, `asked` the questions asked, `qAt` when the last one was,
 * `done` the steps taken once (finish, small, again, later, w30, w10, w0), `until` the finish time (0 for none), `small` the
 * answer to the day's small question, `q` the question that is up, `seen` when the person last did something in any chat.
 * @typedef {{ off: boolean, days: Record<string, Day>, day: string, asked: number, qAt: number, done: string[], until: number, small: { kind: 'coffee' | 'lunch', yes: boolean, at: number } | null, q: Question | null, seen: number }} Routine
 */
const KINDS = ['finish', 'usual', 'coffee', 'lunch'], DONE = ['finish', 'small', 'again', 'later', 'w30', 'w10', 'w0']
const time = (/** @type {unknown} */ x) => typeof x === 'number' && Number.isFinite(x) && x > 0
const two = (/** @type {number} */ n) => String(n).padStart(2, '0')
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** The day a moment belongs to, `2026-11-17`: the date by the person's clock, a day starting at LIMITS.dayStartsH. @param {number} t */
export function dayKey(t) { const d = new Date(t - LIMITS.dayStartsH * H); return `${String(d.getFullYear()).padStart(4, '0')}-${two(d.getMonth() + 1)}-${two(d.getDate())}` }
/** The minutes into its day of a moment: 0 at midnight, over 1440 for the small hours that belong to the day before. @param {number} t */
export function minutes(t) { const d = new Date(t), m = d.getHours() * 60 + d.getMinutes(); return m < LIMITS.dayStartsH * 60 ? m + 1440 : m }
/** A count of minutes into a day as the clock shows it, 24 hours: `18:30`, and `00:30` for 1470. @param {number} m */
export const clock = (m) => `${two(Math.floor(m / 60) % 24)}:${two(Math.round(m) % 60)}`
/** A moment as the clock shows it. @param {number} t */
export const hhmm = (t) => clock(minutes(t))
/** The moment of the day `now` belongs to that is `m` minutes into it. @param {number} now @param {number} m */
function moment(now, m) { const d = new Date(now - LIMITS.dayStartsH * H); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m).getTime() }

/** An empty routine. @returns {Routine} */
export const empty = () => ({ off: false, days: {}, day: '', asked: 0, qAt: 0, done: [], until: 0, small: null, q: null, seen: 0 })

/** What the store holds, made whole: what is not of the routine is dropped. @param {unknown} raw @returns {Routine} */
export function whole(raw) {
  const r = /** @type {any} */ (raw && typeof raw === 'object' ? raw : {}), out = empty()
  out.off = r.off === true
  for (const [k, v] of Object.entries(r.days && typeof r.days === 'object' ? r.days : {}).filter(([k]) => DATE.test(k)).sort(([a], [b]) => a < b ? -1 : 1).slice(-LIMITS.days)) {
    const d = /** @type {any} */ (v)
    if (!time(d?.start)) continue
    out.days[k] = { start: d.start, end: time(d.end) && d.end >= d.start ? d.end : d.start, ...(typeof d.coffee === 'boolean' && { coffee: d.coffee, ...(time(d.coffeeAt) && { coffeeAt: d.coffeeAt }) }), ...(time(d.finish) && { finish: d.finish }) }
  }
  if (typeof r.day !== 'string' || !DATE.test(r.day)) return { ...out, seen: time(r.seen) ? r.seen : 0 }
  const q = r.q && KINDS.includes(r.q.kind) && time(r.q.at) && Array.isArray(r.q.opts) ? { kind: r.q.kind, at: r.q.at, opts: r.q.opts.filter((/** @type {unknown} */ o) => typeof o === 'string' && /^[a-z0-9]{1,8}$/.test(o)).slice(0, 5), ...(time(r.q.time) && { time: r.q.time }) } : null
  return {
    ...out, day: r.day, asked: Number.isInteger(r.asked) && r.asked > 0 ? Math.min(r.asked, 99) : 0, qAt: time(r.qAt) ? r.qAt : 0,
    done: Array.isArray(r.done) ? DONE.filter(x => r.done.includes(x)) : [], until: time(r.until) ? r.until : 0,
    small: r.small && (r.small.kind === 'coffee' || r.small.kind === 'lunch') && time(r.small.at) ? { kind: r.small.kind, yes: r.small.yes === true, at: r.small.at } : null,
    q: q && q.opts.length >= 2 ? q : null, seen: time(r.seen) ? r.seen : 0,
  }
}

/** The routine on the day `now` belongs to: a new day starts with nothing asked, no finish time and no question. @param {Routine} r @param {number} now @returns {Routine} */
function today(r, now) {
  const day = dayKey(now)
  return r.day === day ? r : { ...r, day, asked: 0, qAt: 0, done: [], until: 0, small: null, q: null }
}

/**
 * The person did something (a prompt, a button, a command): the day has started if it had not, and lasts until now. A clock set
 * back does not move the start of a day later nor its end earlier.
 * @param {Routine} was @param {number} now @returns {Routine}
 */
export function touch(was, now) {
  const r = today(was, now), d = r.days[r.day]
  const days = { ...r.days, [r.day]: d ? { ...d, start: Math.min(d.start, now), end: Math.max(d.end, now) } : { start: now, end: now } }
  const keep = Object.keys(days).sort().slice(-LIMITS.days)
  return { ...r, days: Object.fromEntries(keep.map(k => [k, /** @type {Day} */ (days[k])])), seen: now }
}

const median = (/** @type {number[]} */ xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? /** @type {number} */ (s[Math.floor((s.length - 1) / 2)]) : undefined }
/**
 * What the days say is usual, the day `now` belongs to left out: the start and the finish as minutes into the day (the middle
 * one of the days that have it), whether coffee is usual (the answer given more often; a tie is none), and how many days there are.
 * @param {Routine} r @param {number} [now]
 * How many days say each is given too: under LIMITS.usualDays it is no habit yet, and whoever shows it leaves it out.
 * @returns {{ days: number, start?: number, finish?: number, finishDays: number, coffee?: boolean, coffeeDays: number }}
 */
export function usual(r, now) {
  const skip = now === undefined ? '' : dayKey(now), days = Object.entries(r.days).filter(([k]) => k !== skip).map(([, d]) => d)
  const fin = days.flatMap(d => d.finish ? [minutes(d.finish)] : []), cups = days.flatMap(d => d.coffee === undefined ? [] : [d.coffee]), yes = cups.filter(Boolean).length
  const start = median(days.map(d => minutes(d.start))), finish = median(fin)
  return { days: days.length, ...(start !== undefined && { start }), ...(finish !== undefined && { finish: Math.round(finish / 5) * 5 }), finishDays: fin.length, ...(cups.length && yes * 2 !== cups.length && { coffee: yes * 2 > cups.length }), coffeeDays: cups.length }
}

/** The hours offered for the finish time: three whole hours from 17, or from the first that is 45 minutes away, none past 23; then
 * `other`, for a time that is none of them (the adapter puts `/pet until ` in the prompt box to complete), and `later`. @param {number} now */
function hours(now) {
  const first = Math.max(17, Math.ceil((minutes(now) + 45) / 60))
  return [...[first, first + 1, first + 2].filter(h => h <= 23).map(String), 'other', 'later']
}

/** The warning due now for a finish time: the last of LIMITS.warnMin whose moment has come, '' before the first and once the time is LIMITS.warnLateMs behind. @param {number} until @param {number} now */
export function stage(until, now) {
  if (!until || now >= until + LIMITS.warnLateMs) return ''
  const m = [...LIMITS.warnMin].sort((a, b) => a - b).find(min => now >= until - min * MIN)
  return m === undefined ? '' : `w${m}`
}

/** The whole minutes left to a finish time, rounded up, 1 at least: what a warning says, which is not 30 or 10 when the time was set that near. @param {number} until @param {number} now */
export const minsLeft = (until, now) => Math.max(1, Math.ceil((until - now) / MIN))

/** The reply to a finish time just set, naming only the warnings still to come: until.set (30 and 10 minutes before, and at the time), until.set.10, until.set.0. @param {number} until @param {number} now */
const setReply = (until, now) => { const m = (until - now) / MIN; return m > 30 ? 'until.set' : m > 10 ? 'until.set.10' : 'until.set.0' }

/**
 * What the pet does now, at most one thing: `warn` a warning about the finish time (`w30`, `w10`, `w0`), `ask` a question to put
 * up, `say` a line of its own (`coffee.no`, `coffee.yes`, `lunch.no`). `busy` is a turn running, or anything else that holds the
 * bubble: no new question then. `lines` false leaves the pet's own lines for a chat the person is at. The routine comes back as it is to be kept; `changed` says whether it differs.
 * With the routine off: no question and none of the lines that follow one; a finish time set with /pet until is still warned about.
 * @param {Routine} was @param {number} now @param {{ busy?: boolean, lines?: boolean }} [at]
 * @returns {{ r: Routine, changed: boolean, warn?: string, ask?: Question, say?: string }}
 */
export function next(was, now, { busy = false, lines = true } = {}) {
  let r = today(was, now)
  const changed = () => r !== was
  // the finish time: each warning once, the earlier ones skipped when a later one is due already
  const w = stage(r.until, now)
  if (w && !r.done.includes(w)) {
    r = { ...r, done: [...r.done, ...['w30', 'w10', 'w0'].slice(0, ['w30', 'w10', 'w0'].indexOf(w) + 1).filter(x => !r.done.includes(x))] }
    return { r, changed: true, warn: w }
  }
  // a question nobody answered, or one asked at a moment the clock has not reached (it was set back): gone, quietly
  if (r.q && (now - r.q.at >= LIMITS.questionMs || r.q.at > now)) r = { ...r, q: null }
  if (r.off) return { r: r.q ? { ...r, q: null } : r, changed: changed() || !!r.q }
  // the lines that follow an answer
  if (!lines) return { r, changed: changed() }
  const d = r.days[r.day], take = (/** @type {string} */ step) => { r = { ...r, done: [...r.done, step] } }
  if (d?.coffee === false && d.coffeeAt && now - d.coffeeAt >= LIMITS.coffeeAgainMs && !r.done.includes('again')) { take('again'); return { r, changed: true, say: 'coffee.no' } }
  if (d?.coffee === true && d.coffeeAt && now - d.coffeeAt >= LIMITS.coffeeLaterMs && !r.done.includes('later')) { take('later'); return { r, changed: true, say: 'coffee.yes' } }
  if (r.small?.kind === 'lunch' && !r.small.yes && now - r.small.at >= LIMITS.lunchAgainMs && !r.done.includes('again')) { take('again'); return { r, changed: true, say: 'lunch.no' } }
  // a question: one at a time, never during a turn, a few a day, not one right after another
  if (busy || r.q || !d || r.asked >= LIMITS.questionsDay || (r.qAt && now - r.qAt < LIMITS.gapMs)) return { r, changed: changed() }
  const ask = (/** @type {Kind} */ kind, /** @type {string[]} */ opts, /** @type {string} */ step, t = 0) => {
    const q = { kind, at: now, opts, ...(t && { time: t }) }
    r = { ...r, q, asked: r.asked + 1, qAt: now, done: [...r.done, step] }
    return { r, changed: true, ask: q }
  }
  if (!r.done.includes('finish')) {
    if (r.until) take('finish') // said already, with /pet until
    else if (now - d.start >= LIMITS.finishAfterMs) {
      const u = usual(r, now), t = u.finish !== undefined && u.finishDays >= LIMITS.usualDays ? moment(now, u.finish) : 0
      if (t > now + 45 * MIN) return ask('usual', ['yes', 'no'], 'finish', t)
      const opts = hours(now)
      if (opts.length >= 3) return ask('finish', opts, 'finish') // an hour at least, beside `other` and `later`
      take('finish') // too late in the day to ask
    }
    else return { r, changed: changed() }
  }
  if (!r.done.includes('small')) {
    const h = minutes(now) / 60
    if (h < LIMITS.coffeeBeforeH) return ask('coffee', ['yes', 'no'], 'small')
    if (h >= LIMITS.lunchFromH && h < LIMITS.lunchBeforeH) return ask('lunch', ['yes', 'no'], 'small')
    if (h >= LIMITS.lunchBeforeH) take('small') // the day's small question had no moment
  }
  return { r, changed: changed() }
}

/**
 * An answer to the question that is up: `yes`, `no`, or one of its choices (an hour, `later`). `ok` false when no question is up
 * or the answer is none of its own (`opts` then says which there are). `reply` names the line to say back, `time` the moment it speaks of.
 * `usual` answered no becomes the question with the hours, the same question going on: it is not counted again.
 * @param {Routine} was @param {string} choice @param {number} now
 * @returns {{ r: Routine, ok: boolean, opts: string[], reply: string, time: number, ask?: Question }}
 */
export function answer(was, choice, now) {
  const r0 = today(was, now), q = r0.q && now - r0.q.at < LIMITS.questionMs && r0.q.at <= now ? r0.q : null, c = String(choice).trim().toLowerCase().replace(/^(\d{1,2})(:00|h)$/, '$1')
  if (!q) return { r: r0, ok: false, opts: [], reply: 'answer.none', time: 0 }
  if (!q.opts.includes(c)) return { r: r0, ok: false, opts: q.opts, reply: 'answer.what', time: 0 }
  if (q.kind === 'finish' && c === 'other') return { r: r0, ok: true, opts: [], reply: 'answer.other', time: 0 } // the question stays: /pet until <time> answers it
  const r = { ...r0, q: null }, d = /** @type {Day} */ (r.days[r.day] ?? { start: now, end: now }), day = (/** @type {Partial<Day>} */ more) => ({ ...r.days, [r.day]: { ...d, ...more } })
  const until = (/** @type {number} */ t) => ({ r: { ...r, until: t, days: day({ finish: t }), done: r.done.filter(x => !/^w\d/.test(x)) }, ok: true, opts: [], reply: setReply(t, now), time: t })
  if (q.kind === 'usual') {
    if (c === 'yes' && q.time) return until(q.time)
    const again = { kind: /** @type {const} */ ('finish'), at: now, opts: hours(now) }
    return { r: { ...r, q: again }, ok: true, opts: [], reply: '', time: 0, ask: again }
  }
  if (q.kind === 'finish') return c === 'later' ? { r, ok: true, opts: [], reply: 'answer.later', time: 0 } : until(moment(now, Number(c) * 60))
  if (q.kind === 'coffee') return { r: { ...r, days: day({ coffee: c === 'yes', coffeeAt: now }), small: { kind: 'coffee', yes: c === 'yes', at: now } }, ok: true, opts: [], reply: `answer.coffee.${c}`, time: 0 }
  return { r: { ...r, small: { kind: 'lunch', yes: c === 'yes', at: now } }, ok: true, opts: [], reply: `answer.lunch.${c}`, time: 0 }
}

/**
 * /pet until: `18`, `18:30`, `18.30`, `1830` or `18h30` sets today's finish time, the next time the clock shows it, at most
 * LIMITS.untilAheadMs ahead; `off` drops it. Either way the day's question about it is not asked. `reply`: until.set (or until.set.10, until.set.0: only the warnings still to come), until.off,
 * until.past (a time too far ahead: it reads as one already gone), until.usage.
 * @param {Routine} was @param {string} typed @param {number} now @returns {{ r: Routine, ok: boolean, reply: string, time: number }}
 */
export function setUntil(was, typed, now) {
  const r = today(was, now), s = String(typed).trim().toLowerCase(), taken = [...new Set([...r.done.filter(x => !/^w\d/.test(x)), 'finish'])]
  const q = r.q && (r.q.kind === 'finish' || r.q.kind === 'usual') ? null : r.q // the question about it is answered by this
  const d = r.days[r.day] ?? { start: now, end: now }
  if (s === 'off') { const { finish, ...rest } = d; return { r: { ...r, q, until: 0, done: taken, days: { ...r.days, [r.day]: rest } }, ok: true, reply: 'until.off', time: 0 } }
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?h?$/.exec(s), hh = Number(m?.[1]), mm = Number(m?.[2] ?? 0)
  if (!m || hh > 24 || mm > 59 || (hh === 24 && mm > 0)) return { r, ok: false, reply: 'until.usage', time: 0 }
  const at = new Date(now)
  let t = new Date(at.getFullYear(), at.getMonth(), at.getDate(), hh % 24, mm).getTime()
  if (t <= now) t = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, hh % 24, mm).getTime()
  if (t - now > LIMITS.untilAheadMs) return { r, ok: false, reply: 'until.past', time: t }
  return { r: { ...r, q, until: t, done: taken, days: { ...r.days, [r.day]: { ...d, finish: t } } }, ok: true, reply: setReply(t, now), time: t }
}

/** The routine with questions on or off; off takes the question that is up away. @param {Routine} r @param {boolean} off @returns {Routine} */
export const switched = (r, off) => ({ ...r, off, ...(off && { q: null }) })
/** Everything learned forgotten: the days, and today's answers; the choice of /pet routine off stays. @param {Routine} r @returns {Routine} */
export const cleared = (r) => ({ ...empty(), off: r.off, seen: r.seen })

/**
 * The welcome for a person who is back: by how long they were away and the hour it is. '' under LIMITS.backAfterMs.
 * `weekend`: away over a Saturday or a Sunday, on another day. `morning`: another day, before noon. `lunch`: left between 11:30
 * and 14:30 and back before 16, the same day. `long`: three hours or more. `hour`: the rest.
 * @param {number} from when the person last did something @param {number} now
 * @returns {'' | 'weekend' | 'morning' | 'lunch' | 'long' | 'hour'}
 */
export function back(from, now) {
  if (!from || now - from < LIMITS.backAfterMs) return ''
  if (dayKey(from) !== dayKey(now)) {
    for (let t = from; t < now; t += 12 * H) { const wd = new Date(t).getDay(); if ((wd === 0 || wd === 6) && dayKey(t) !== dayKey(now) && now - from >= 36 * H) return 'weekend' }
    return minutes(now) < 12 * 60 ? 'morning' : 'long'
  }
  const left = minutes(from), at = minutes(now)
  if (left >= 11 * 60 + 30 && left < 14 * 60 + 30 && at >= 12 * 60 && at < 16 * 60) return 'lunch'
  return now - from >= 3 * H ? 'long' : 'hour'
}

/** What of the routine moves with the pet in the file of /pet export: the days it remembers and the choice of /pet routine off. Nothing of today's questions. @param {unknown} raw */
export function memory(raw) { const r = whole(raw); return { off: r.off, days: r.days } }
