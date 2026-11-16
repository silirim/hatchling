import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, reduce, view, program, dayOf, RULES } from './engine.js'
import { bubble, ago, TALK, SILLY, OUTLINE, CALM } from './catalog.js'
import { marks, remember, greeting, finished, folder, stateOf, counts, listing, chatName, clip, namesOf, NAME_COLS } from './company.js'
import { cols } from './width.js'

const run = (events, s = initialState(1)) => events.reduce(reduce, s)
let t = Date.UTC(2026, 10, 12, 12)
const at = (e, ms = 1000) => ({ t: (t += ms), ...e })
const MIN = 60_000, H = 60 * MIN, DAY = 24 * H
const start = () => run([at({ type: 'sessionStart' })])
const small = () => at({ type: 'usage', input: 100, cacheRead: 1000, cacheWrite: 0 })
const long = () => at({ type: 'usage', input: 100, cacheRead: RULES.heavyTokens, cacheWrite: 0 })
const say = (s) => bubble(view(s, t)).say
/** a turn: a prompt after `gap`, then its end */
const turn = (gap = 1000, roll) => [at({ type: 'prompt' }, gap), at({ type: 'turnEnd', roll })]

test('program: the bare name only, past cd, wrappers and VAR=value; nothing when it is not a plain name', () => {
  assert.equal(program('TOKEN=abc curl -H secret http://x'), 'curl')
  assert.equal(program('cd /srv/app && sudo env A=1 /usr/bin/npm test -- --token=x'), 'npm')
  assert.equal(program('cd a; cd b && ./run.sh --key k'), 'run.sh')
  assert.equal(program('"my secret" arg'), '')
  assert.equal(program('$(cat key) x'), '')
  assert.equal(program(''), '')
})

test('the loop note says which program, how many times and over how many turns', () => {
  const fail = () => at({ type: 'cmd', cmd: 'cd /p && npm test --token=abc', ok: false })
  let s = run([fail(), fail(), fail()], start())
  assert.equal(say(s), 'npm failed 3 times in a row')
  s = run([at({ type: 'turnEnd' }), fail(), at({ type: 'turnEnd' }), fail()], s)
  assert.equal(say(s), 'npm failed 5 times in a row, over 3 turns')
  assert.doesNotMatch(JSON.stringify(s.issues), /token|\/p/) // the note keeps the name, not the command
  assert.equal(say(run([at({ type: 'cmd', cmd: '"odd one" x', ok: false }), at({ type: 'cmd', cmd: '"odd one" x', ok: false }), at({ type: 'cmd', cmd: '"odd one" x', ok: false })], start())), 'same command failed 3 times in a row')
  // C14: what is kept of the command is a print of it, never the line: nothing of it can be read back from the session
  assert.doesNotMatch(JSON.stringify(s.session), /token|abc|\/p|npm test/)
  assert.match(Object.keys(s.session.blind).join(), /^h[0-9a-f]{8}$/)
})

test('marks: only folder, time and done are kept; old and surplus ones are dropped', () => {
  const raw = { a: { cwd: '/w/a', at: 5, done: 1, prompt: 'secret', files: ['/x'] }, b: 'junk', c: { cwd: 7, at: 1 }, d: { cwd: '/w/d', at: NaN } }
  assert.deepEqual(marks(raw), { a: { cwd: '/w/a', at: 5, done: true } })
  assert.deepEqual(marks(undefined), {})
  const now = 100 * DAY
  let all = { old: { cwd: '/o', at: now - RULES.marksMs - 1, done: true }, recent: { cwd: '/r', at: now - DAY, done: false } }
  all = remember(all, 'me', { cwd: '/m', at: now, done: false })
  assert.deepEqual(Object.keys(all), ['me', 'recent'])
  for (let i = 0; i < RULES.marksMax + 5; i++) all = remember(all, `c${i}`, { cwd: '/m', at: now + i, done: true })
  assert.equal(Object.keys(all).length, RULES.marksMax)
  assert.ok(!('recent' in all) && `c${RULES.marksMax + 4}` in all)
  assert.equal(folder('/home/me/work/hatchling/'), 'hatchling')
  assert.equal(folder('C:\\work\\app'), 'app')
})

test('the greeting: a chat left here, a long pause, the first chat of the day, a known folder, a new one', () => {
  const now = Date.UTC(2026, 10, 12, 12), me = { id: 'me', cwd: '/w/hatchling', now }
  const g = (all) => greeting(all, me)
  assert.deepEqual(g({}), { kind: 'first' })
  assert.deepEqual(g({ me: { cwd: '/w/hatchling', at: now - MIN, done: true } }), { kind: 'first' }) // its own mark is not another chat
  assert.deepEqual(g({ a: { cwd: '/w/hatchling', at: now - 20 * MIN, done: false }, b: { cwd: '/w/other', at: now - MIN, done: true } }), { kind: 'resume', ago: 20 * MIN, done: false })
  assert.deepEqual(g({ a: { cwd: '/w/hatchling', at: now - RULES.backAfterMs - H, done: true } }), { kind: 'back', ago: RULES.backAfterMs + H })
  assert.deepEqual(g({ a: { cwd: '/w/hatchling', at: now - 30 * H, done: true } }), { kind: 'first' })
  assert.deepEqual(g({ a: { cwd: '/w/hatchling', at: now - 30 * H, done: true }, b: { cwd: '/w/other', at: now - H, done: true } }), { kind: 'seen', name: 'hatchling' })
  assert.deepEqual(g({ b: { cwd: '/w/other', at: now - H, done: true } }), { kind: 'new' })

  const line = (e) => bubble(view(run([at({ type: 'greet', ...e })], start()), t))
  assert.deepEqual([line({ kind: 'resume', ago: 20 * MIN, done: false }).say, line({ kind: 'resume', ago: 20 * MIN, done: false }).ask, line({ kind: 'resume', ago: 20 * MIN, done: false }).label], ['a chat here stopped mid-turn 20 min ago. pick it up?', '/resume', 'resume'])
  assert.equal(line({ kind: 'resume', ago: 3 * H, done: true }).say, 'a chat here finished its turn 3 h ago. pick it up?')
  assert.equal(line({ kind: 'back', ago: 4 * DAY }).say, `welcome back, good to see you. ${RULES.coinsWelcome} stars for you`)
  assert.equal(line({ kind: 'first' }).say, 'first chat of the day, here we go')
  assert.equal(line({ kind: 'seen', name: 'hatchling' }).say, 'back in hatchling, I know this place')
  assert.equal(line({ kind: 'new' }).say, 'a new folder, let us look around')
  assert.deepEqual([ago(30_000), ago(89 * MIN), ago(5 * H), ago(3 * DAY)], ['just now', '89 min ago', '5 h ago', '3 days ago'])
})

test('one greeting, gone after the first prompt; a warning or a cheer holds the bubble over it', () => {
  let s = run([at({ type: 'greet', kind: 'first' })], start())
  assert.equal(say(s), 'first chat of the day, here we go')
  s = run([at({ type: 'prompt' }, RULES.talkShowMs)], s)
  assert.equal(say(s), CALM.short[0])
  // a long chat without lean is a warning: the greeting is not seen, and nothing is added to the bubble
  const long = run([at({ type: 'usage', input: 100, cacheRead: RULES.heavyTokens, cacheWrite: 0 }), at({ type: 'greet', kind: 'first' })], start())
  assert.deepEqual([bubble(view(long, t)).ask, bubble(view(long, t)).more], ['/pet briefox on', null])
  const cheered = run([at({ type: 'turnEnd' }), at({ type: 'greet', kind: 'first' })], { ...start(), days: RULES.grownAt.days, affection: RULES.grownAt.affection - 1, day: dayOf(t) })
  assert.equal(say(cheered), 'grew a stage')
})

test('another chat ending a long turn is told once, with its folder and since when; a short turn is no news, and the same chat not again for 10 minutes', () => {
  let s = run([at({ type: 'peer', here: false, name: 'vodmax', ago: 4 * MIN })], start())
  assert.equal(say(s), 'the chat in vodmax finished its job 4 min ago')
  const first = s.session.talk.at
  s = run([at({ type: 'peer', here: true, name: 'hatchling', ago: 0 }, MIN)], s)
  assert.equal(s.session.talk.at, first)
  s = run([at({ type: 'peer', here: true, name: 'hatchling', ago: 0 }, RULES.peerGapMs)], s)
  assert.equal(say(s), 'the other chat in this folder (hatchling) finished its job just now')
  // with the comments on the small model says it, in the pet's character: its line takes the place of the fixed one
  s = run([at({ type: 'peer', here: false, name: 'vodmax', ago: 0 }, 2 * RULES.peerGapMs)], s)
  assert.equal(say(s), 'the chat in vodmax finished its job just now')
  s = run([at({ type: 'peer', here: false, name: 'other', ago: 0, said: 'not about this news' }, 2 * RULES.peerGapMs)], s)
  assert.equal(say(s), 'the chat in vodmax finished its job just now')
  s = run([at({ type: 'peer', here: false, name: 'vodmax', ago: 0, said: 'vodmax is done, I heard it sigh' }, 2 * RULES.peerGapMs)], s)
  assert.equal(say(s), 'vodmax is done, I heard it sigh')

  // which chat: one that ended a turn of 2 minutes or more after this chat last looked; its own mark, a turn still running and a short turn are not news
  assert.deepEqual([RULES.peerMinTurnMs, RULES.peerAgainMs], [2 * MIN, 10 * MIN])
  const me = { id: 'me', cwd: '/w/a', since: 100, now: 1000 }
  const took3 = 3 * MIN
  const all = { me: { cwd: '/w/a', at: 500, done: true, took: took3 }, old: { cwd: '/w/b', at: 50, done: true, took: took3 }, busy: { cwd: '/w/a', at: 300, done: false }, quick: { cwd: '/w/q', at: 400, done: true, took: MIN } }
  let r = finished(all, {}, me)
  assert.deepEqual(r, { seen: { old: 50, busy: 300, quick: 400 }, told: {}, peer: null })
  r = finished({ ...all, busy: { cwd: '/w/a', at: 400, done: true, took: took3 } }, r.seen, me)
  assert.deepEqual(r.peer, { here: true, name: 'a', dir: 'a', ago: 600, took: took3, ask: false })
  assert.deepEqual(r.told, { busy: 1000 })
  assert.equal(finished({ ...all, busy: { cwd: '/w/a', at: 400, done: true, took: took3 } }, r.seen, { ...me, told: r.told }).peer, null) // once
  // the same chat ends another long turn: not news again within 10 minutes, news after
  const again = { busy: { cwd: '/w/a', at: 900, done: true, took: took3 } }
  assert.equal(finished(again, r.seen, { ...me, now: 1000 + 9 * MIN, told: r.told }).peer, null)
  assert.deepEqual(finished(again, r.seen, { ...me, now: 1000 + 10 * MIN, told: r.told }).peer?.name, 'a')
  assert.deepEqual(finished({ new: { cwd: '/w/zed', at: 150, done: true, took: 2 * MIN } }, {}, me).peer, { here: false, name: 'zed', dir: 'zed', ago: 850, took: 2 * MIN, ask: false })
  assert.equal(finished({ new: { cwd: '/w/zed', at: 150, done: true } }, {}, me).peer, null) // a mark of before the durations: unknown, so not told
  // a mark keeps its duration through the store, and only a number
  assert.deepEqual(marks({ a: { cwd: '/w', at: 1, done: true, took: 5 }, b: { cwd: '/w', at: 1, done: true, took: 'x' } }), { a: { cwd: '/w', at: 1, done: true, took: 5 }, b: { cwd: '/w', at: 1, done: true } })
})

test('a long turn where things went wrong ends with a recap: programs by name, never their arguments', () => {
  const fail = (cmd) => at({ type: 'cmd', cmd, ok: false })
  const wrong = [fail('npm test --token=abc'), fail('npm run build'), fail('SECRET=1 git push origin'), fail('go vet ./...'), at({ type: 'read', path: '/a', mtime: 1 }), at({ type: 'read', path: '/a', mtime: 1 })]
  let s = run([small(), at({ type: 'prompt' }), ...wrong, at({ type: 'turnEnd' }, RULES.recapTurnMs)], start())
  // the re-read is a note of its own and keeps the first line: the recap sits under it
  assert.deepEqual([say(s), bubble(view(s, t)).more?.say], ['re-read, unchanged: a', 'long turn: npm failed 2 times, git failed once, 1 more failing, 1 re-read'])
  assert.equal(say(run([at({ type: 'prompt' }), ...wrong.slice(0, 3), at({ type: 'turnEnd' }, RULES.recapTurnMs)], start())), 'long turn: npm failed 2 times, git failed once')
  assert.doesNotMatch(JSON.stringify(s.session.talk), /token|SECRET|origin|run build|vet/)
  // a short turn, or a long one with a single slip, gets none; the counts start again with each prompt
  s = run([at({ type: 'prompt' }, RULES.talkShowMs), ...wrong, at({ type: 'turnEnd' })], s)
  assert.equal(view(s, t).talk, null)
  s = run([at({ type: 'prompt' }), fail('npm test'), at({ type: 'turnEnd' }, RULES.recapTurnMs)], s)
  assert.equal(view(s, t).talk, null)
  // under a note the recap is a second line, the note keeps the first
  s = run([at({ type: 'prompt' }), fail('make'), fail('make'), fail('make'), at({ type: 'turnEnd' }, RULES.recapTurnMs)], s)
  const b = bubble(view(s, t))
  assert.deepEqual([b.say, b.more], ['make failed 3 times in a row', { say: 'long turn: make failed 3 times', ask: '', label: '' }])
})

test('a long chat gets the outline offer once, lean on or off, then again only after many turns', () => {
  // lean on: the offer is the bubble, its button fills the request
  let s = run([at({ type: 'lean', on: true }), long(), ...turn()], start())
  let b = bubble(view(s, t))
  assert.deepEqual([b.say, b.ask, b.label, b.link], ['long chat: shall we put our thoughts in order?', OUTLINE, 'outline', null])
  assert.doesNotMatch(b.say + b.fix + OUTLINE, /sav|cheap|cost|%|token/i) // not a saving: none was measured
  assert.match(OUTLINE, /where we are.*where we need to get to.*still missing.*new chat/s)
  s = run([at({ type: 'prompt' }, RULES.talkShowMs)], s)
  assert.equal(view(s, t).talk, null)
  for (let i = 1; i < RULES.tidyAgainTurns; i++) { s = run([long(), ...turn(RULES.talkGapMs)], s); assert.notEqual(s.session.talk?.at, t, `turn ${i}`) }
  s = run([long(), ...turn(RULES.talkGapMs)], s)
  assert.equal(view(s, t).talk?.kind, 'tidy')
  // a short chat gets none
  assert.equal(view(run([small(), ...turn()], start()), t).talk, null)
  // lean off: the heavy warning keeps the bubble and its button, the offer is a second line with its own
  s = run([long(), ...turn()], start())
  b = bubble(view(s, t))
  assert.deepEqual([b.ask, b.label, b.more], ['/pet briefox on', 'fix', { say: 'long chat: shall we put our thoughts in order?', ask: OUTLINE, label: 'outline' }])
})

test('coffee break: after many turns in a row, once in a while; a pause ends the sitting', () => {
  let s = start()
  for (let i = 1; i < RULES.coffeeTurns; i++) s = run([small(), ...turn()], s)
  assert.equal(view(s, t).talk, null)
  s = run([small(), ...turn()], s)
  assert.equal(say(s), `${RULES.coffeeTurns} turns in a row. coffee break?`)
  // the next one needs as many turns again and the gap
  const first = t
  for (let i = 0; i < RULES.coffeeTurns; i++) s = run([small(), ...turn(MIN)], s)
  assert.equal(s.session.talk.at, first)
  while (s.session.talk.at === first) s = run([small(), ...turn(MIN)], s)
  assert.equal(s.session.talk.kind, 'coffee')
  assert.ok(t - first >= RULES.coffeeGapMs && t - first < RULES.coffeeGapMs + 3 * MIN)
  // a pause: the count starts again
  let p = start()
  for (let i = 1; i < RULES.coffeeTurns; i++) p = run([small(), ...turn()], p)
  p = run([small(), ...turn(RULES.sitGapMs + MIN)], p)
  assert.deepEqual([view(p, t).talk, p.session.sit], [null, 1])
  // the sitting goes on across a /clear
  let c = start()
  for (let i = 1; i < RULES.coffeeTurns; i++) c = run([small(), ...turn()], c)
  c = run([at({ type: 'sessionEnd' }), at({ type: 'sessionStart' }), small(), ...turn()], c)
  assert.equal(view(c, t).talk?.kind, 'coffee')
})

test('nonsense: rare, one or two words, never early, never twice close, never over a warning', () => {
  const lucky = RULES.sillyChance / 2
  let s = start()
  for (let i = 1; i < RULES.sillyMinTurns; i++) s = run([small(), ...turn(1000, lucky)], s)
  assert.equal(view(s, t).talk, null)
  assert.equal(view(run([small(), ...turn(1000, RULES.sillyChance)], s), t).talk, null) // the roll missed
  assert.equal(view(run([small(), ...turn()], s), t).talk, null) // an adapter that rolls nothing
  s = run([small(), ...turn(1000, lucky)], s)
  assert.equal(say(s), SILLY[Math.floor(SILLY.length / 2)])
  const said = s.session.talk.at
  for (let i = 1; i < RULES.sillyMinTurns; i++) { s = run([small(), ...turn(RULES.sitGapMs + MIN, lucky)], s); assert.equal(s.session.talk.at, said) }
  assert.equal(run([small(), ...turn(RULES.sitGapMs + MIN, lucky)], s).session.talk.at, t)
  // a note is on screen: no nonsense, and the turn is not spent
  let w = start()
  for (let i = 0; i < RULES.sillyMinTurns; i++) w = run([small(), ...turn()], w)
  w = run([at({ type: 'prompt' }), at({ type: 'read', path: '/a', mtime: 1 }), at({ type: 'read', path: '/a', mtime: 1 }), at({ type: 'turnEnd', roll: lucky })], w)
  assert.deepEqual([view(w, t).issue?.kind, w.session.talk], ['dizzy', null])
  for (const word of SILLY) assert.ok(word.split(' ').length <= 2, word)
})

test('priorities and gaps: a line gives way only to one that ranks the same or higher, and chatter waits its gap', () => {
  assert.deepEqual(RULES.talkRank, ['recap', 'tidy', 'voice', 'peer', 'greet', 'coffee', 'silly'])
  // the outline offer is on screen: a peer's news ranks lower and is dropped, a recap takes over
  let s = run([at({ type: 'lean', on: true }), long(), ...turn(), at({ type: 'peer', here: true })], start())
  assert.equal(view(s, t).talk.kind, 'tidy')
  s = run([at({ type: 'prompt' }), at({ type: 'cmd', cmd: 'npm t', ok: false }), at({ type: 'cmd', cmd: 'npm x', ok: false }), at({ type: 'turnEnd' }, RULES.recapTurnMs)], s)
  assert.equal(view(s, t).talk.kind, 'recap')
  // right after a greeting the coffee waits for talkGapMs, then comes at a later turn
  let c = { ...start() }
  c.session.sit = RULES.coffeeTurns
  c = run([at({ type: 'greet', kind: 'new' }), small(), ...turn(RULES.talkShowMs)], c)
  assert.equal(view(c, t).talk, null)
  c = run([small(), ...turn(RULES.talkGapMs)], c)
  assert.equal(view(c, t).talk?.kind, 'coffee')
})

test('every line is short, sober English: no exclamation mark, and none claims a saving', () => {
  const lines = [
    ...['resume', 'back', 'first', 'seen', 'new'].map(greet => TALK.greet({ kind: 'greet', at: 0, greet, ago: 5 * DAY, done: true, name: 'x' }).say),
    TALK.peer({ kind: 'peer', at: 0, here: true }).say, TALK.peer({ kind: 'peer', at: 0, here: false, name: 'x' }).say,
    TALK.recap({ kind: 'recap', at: 0, fails: { npm: 2, '?': 1 }, rereads: 2, rebuilds: 1 }).say,
    TALK.tidy({ kind: 'tidy', at: 0 }).say, TALK.tidy({ kind: 'tidy', at: 0 }).fix, TALK.coffee({ kind: 'coffee', at: 0, n: 20 }).say, ...SILLY, OUTLINE,
  ]
  for (const line of lines) { assert.doesNotMatch(line, /!|undefined|NaN/, line); if (line !== OUTLINE) assert.ok(line.length <= 90, line) }
  assert.equal(TALK.recap({ kind: 'recap', at: 0, fails: { npm: 2, '?': 1 }, rereads: 2, rebuilds: 1 }).say, 'long turn: npm failed 2 times, a command failed once, 2 re-reads, 1 cache rebuild')
})

test('which chat needs me: a chat is at work, waits for the person, may wait for their OK, or is closed; one that stopped saying it is alive is closed', () => {
  const now = 1_000_000, live = { cwd: '/w/a', at: now - 5 * MIN, beat: now - 10_000 }
  assert.equal(stateOf({ ...live, done: false }, now), 'working')
  assert.equal(stateOf({ ...live, done: true }, now), 'waiting')
  assert.equal(stateOf({ ...live, done: false, asking: now - 30_000 }, now), 'asking')
  assert.equal(stateOf({ ...live, done: true, asking: now - 30_000 }, now), 'waiting') // its turn ended since: the wait is over
  assert.equal(stateOf({ ...live, done: false, closed: true }, now), 'closed')
  // no beat for chatDeadMs: it died without a word. A mark with no beat at all is of a version before the board
  assert.equal(stateOf({ ...live, done: false, beat: now - RULES.chatDeadMs - 1 }, now), 'closed')
  assert.equal(stateOf({ ...live, done: false, beat: now - RULES.chatDeadMs }, now), 'working')
  assert.equal(stateOf({ cwd: '/w/a', at: now - MIN, done: false }, now), 'closed')
  // the clock: a beat dated after now (a clock that was ahead) is no sign of life; one a few seconds ahead is another machine's clock
  assert.equal(stateOf({ ...live, done: false, beat: now + 400 * DAY }, now), 'closed')
  assert.equal(stateOf({ ...live, done: false, beat: now + 5_000 }, now), 'working')
  // what the store holds is made whole: a beat, a wait or a closing that are not what they should be are dropped
  assert.deepEqual(marks({ a: { cwd: '/w', at: 5, done: 0, beat: 'x', asking: -4, closed: 'yes' }, b: { cwd: '/w', at: 5, done: true, beat: 9, asking: 7, closed: true } }), { a: { cwd: '/w', at: 5, done: false }, b: { cwd: '/w', at: 5, done: true, beat: 9, asking: 7, closed: true } })

  // four chats beside this one: one at work, one waiting, one stopped on a permission, one dead
  const all = marks({
    me: { cwd: '/w/here', at: now - MIN, done: false, beat: now },
    busy: { cwd: '/home/me/work/vodmax', at: now - 4 * MIN, done: false, beat: now - 5_000 },
    idle: { cwd: '/home/me/work/notes', at: now - 9 * MIN, done: true, took: 3 * MIN, beat: now - 15_000 },
    stuck: { cwd: '/home/me/secret-client/api', at: now - 6 * MIN, done: false, asking: now - 2 * MIN, beat: now - 2_000 },
    dead: { cwd: '/home/me/work/old', at: now - 3 * MIN, done: false, beat: now - 10 * MIN },
  })
  assert.deepEqual(counts(all, 'me', now), { working: 1, waiting: 1, asking: 1 })
  assert.deepEqual(counts({ me: /** @type {any} */ (all.me) }, 'me', now), { working: 0, waiting: 0, asking: 0 }) // only this chat: nothing to count
  assert.deepEqual(listing(all, 'me', now), [
    { id: 'me', me: true, name: 'here', label: '', state: 'working', ago: MIN },
    { id: 'stuck', me: false, name: 'api', label: '', state: 'asking', ago: 2 * MIN }, // since its call began to wait, not since its turn began
    { id: 'busy', me: false, name: 'vodmax', label: '', state: 'working', ago: 4 * MIN },
    { id: 'idle', me: false, name: 'notes', label: '', state: 'waiting', ago: 9 * MIN },
  ])
  assert.doesNotMatch(JSON.stringify(listing(all, 'me', now)), /secret-client|home\/me/) // a folder's name, never its path

  // the news: the chat that may wait for an OK is told once, at once, before a turn that ended; then the turn; then nothing
  const me = { id: 'me', cwd: '/w/here', since: now - 20 * MIN, now }
  let r = finished(all, {}, me)
  assert.deepEqual(r.peer, { here: false, name: 'api', dir: 'api', ago: 2 * MIN, took: 0, ask: true })
  r = finished(all, r.seen, { ...me, told: r.told })
  assert.deepEqual(r.peer, { here: false, name: 'notes', dir: 'notes', ago: 9 * MIN, took: 3 * MIN, ask: false })
  r = finished(all, r.seen, { ...me, told: r.told })
  assert.equal(r.peer, null)
  // the same chat stops on another call later: told again, once
  const later = { ...all, stuck: { .../** @type {any} */ (all.stuck), asking: now + 60_000, beat: now + 70_000 } }
  const r2 = finished(later, r.seen, { ...me, now: now + 70_000, told: r.told })
  assert.deepEqual([r2.peer?.name, r2.peer?.ask], ['api', true])
  assert.equal(finished(later, r2.seen, { ...me, now: now + 80_000, told: r2.told }).peer, null)
  // never about this chat itself, nor about a dead one
  assert.equal(finished({ me: { .../** @type {any} */ (all.me), asking: now - 9_000 }, dead: { .../** @type {any} */ (all.dead), asking: now - 9 * MIN } }, {}, me).peer, null)
  // said in the bubble: a fixed line with the folder's name, in every language
  const line = (/** @type {any} */ talk, /** @type {string} */ lang) => TALK.peer({ kind: 'peer', at: 0, ...talk }, lang).say
  assert.equal(line({ name: 'api', here: false, ask: true }, 'en'), 'the chat in api may be waiting for your OK')
  assert.equal(line({ name: 'api', here: true, ask: true }, 'en'), 'the other chat in this folder (api) may be waiting for your OK')
  assert.equal(line({ name: 'api', here: false, ask: true }, 'es'), 'el chat de api quizá espera tu permiso')
  assert.equal(line({ name: 'api', here: false, ask: true }, 'zh'), 'api 里的对话可能在等你批准')
  // the engine says it at once, over the wait between two pieces of news of other chats
  let s = run([at({ type: 'sessionStart' }), at({ type: 'prompt' }), at({ type: 'peer', here: false, name: 'vodmax', ago: 0 })], start())
  s = run([at({ type: 'peer', here: false, name: 'api', ago: 0, ask: true })], s)
  assert.equal(say(s), 'the chat in api may be waiting for your OK')
})

test('a mark tells its last turn: a closed one keeps when it was and whether it was cut, and the pause a recap was made for', async () => {
  const { leftOf } = await import('./company.js')
  const { since } = await import('./catalog.js')
  assert.deepEqual(marks({ a: { cwd: '/w', at: 9, done: true, closed: true, left: 5, mid: true, recap: 5, text: 'never' } }), { a: { cwd: '/w', at: 9, done: true, closed: true, left: 5, mid: true, recap: 5 } })
  assert.deepEqual(marks({ a: { cwd: '/w', at: 9, done: true, left: 'x', mid: 1, recap: -1 } }), { a: { cwd: '/w', at: 9, done: true } })
  assert.deepEqual(leftOf({ cwd: '/w', at: 9, done: true }), { at: 9, mid: false })
  assert.deepEqual(leftOf({ cwd: '/w', at: 9, done: false }), { at: 9, mid: true })
  assert.deepEqual(leftOf({ cwd: '/w', at: 9, done: true, closed: true, left: 5, mid: true }), { at: 5, mid: true })
  assert.deepEqual(leftOf({ cwd: '/w', at: 9, done: true, closed: true }), { at: 9, mid: false }) // closed by a version before: when it closed
  // when it was, as of now: the same day how long ago, the day before `yesterday`, then the days
  const noon = new Date(2026, 10, 12, 12).getTime(), H = 3_600_000
  assert.equal(since(noon - 2 * H, noon, 'en'), '2 h ago')
  assert.equal(since(noon - 40 * 60_000, noon, 'en'), '40 min ago')
  assert.equal(since(noon - 13 * H, noon, 'en'), 'yesterday') // 23:00 of the day before
  assert.equal(since(noon - 20 * H, noon + 4 * H, 'en'), 'yesterday')
  assert.equal(since(noon - 48 * H, noon, 'en'), '2 days ago')
  assert.equal(since(noon + H, noon, 'en'), 'just now') // a clock that was ahead
  assert.deepEqual(['es', 'pt', 'zh'].map(l => since(noon - 24 * H, noon, l)), ['ayer', 'ontem', '昨天'])
})

// The thin watcher: what `claude agents --json` prints is input from outside
{
  const { WATCH, seen, sight, watched } = await import('./company.js')
  const NOW = Date.UTC(2026, 10, 16, 12)
  const row = (/** @type {Record<string, unknown>} */ more = {}) => ({ pid: 1, cwd: '/w/gin', kind: 'interactive', startedAt: NOW - 5000, sessionId: 'abc-1', name: 'gin-1a', status: 'busy', ...more })
  const out = (/** @type {unknown} */ list) => JSON.stringify(list)

  test('watch: of each session only its id, folder, status and one fixed label are kept; never its name or what it waits for', () => {
    const look = seen(out([row(), row({ sessionId: 'abc-2', status: 'waiting', waitingFor: 'approve Bash: rm -rf /secret --token=hunter2', prompt: 'my secret prompt' }), row({ sessionId: 'abc-3', status: 'waiting', waitingFor: 'dialog open' }), row({ sessionId: 'abc-4', status: 'idle' }), row({ sessionId: 'abc-5', status: 'waiting', waitingFor: 'sandbox request' })]), null, NOW)
    assert.deepEqual(look, { at: NOW, rows: [
      { id: 'abc-1', cwd: '/w/gin', st: 'busy', wait: '', since: NOW },
      { id: 'abc-2', cwd: '/w/gin', st: 'waiting', wait: 'permission', since: NOW },
      { id: 'abc-3', cwd: '/w/gin', st: 'waiting', wait: '', since: NOW },
      { id: 'abc-4', cwd: '/w/gin', st: 'idle', wait: '', since: NOW },
      { id: 'abc-5', cwd: '/w/gin', st: 'waiting', wait: 'permission', since: NOW },
    ] })
    assert.doesNotMatch(JSON.stringify(look), /secret|hunter2|rm -rf|gin-1a|approve|dialog/)
  })

  test('watch: hostile output is refused whole or row by row, and never throws', () => {
    for (const bad of [undefined, 7, '', 'not json', '{"a":1}', 'null', '"x"', `[${'1,'.repeat(WATCH.bytes)}1]`]) assert.equal(seen(bad, null, NOW), null)
    const rows = [null, 3, 'x', [], {}, row({ sessionId: 7 }), row({ sessionId: '__proto__' }), row({ sessionId: 'a b' }), row({ sessionId: 'x'.repeat(65) }), row({ cwd: 5 }), row({ cwd: '' }), row({ cwd: '/a\x1b[31m' }), row({ cwd: '/'.repeat(2000) }), row({ status: 'exploding' }), row({ status: ['busy'] }), row({ sessionId: 'constructor', status: 'idle' })]
    assert.deepEqual(seen(out(rows), null, NOW)?.rows, [{ id: 'constructor', cwd: '/w/gin', st: 'idle', wait: '', since: NOW }])
    assert.equal(seen(out(Array.from({ length: 500 }, (_, i) => row({ sessionId: `s${i}` }))), null, NOW)?.rows.length, WATCH.rows)
    assert.equal(seen(out([row(), row(), row()]), null, NOW)?.rows.length, 1) // an id counts once
    // a label is one of ours or none: a text that only looks like one is none
    for (const why of ['permission', 'approved', ' approve x', { toString: () => 'approve x' }, 'APPROVE plan']) assert.equal(seen(out([row({ status: 'waiting', waitingFor: why })]), null, NOW)?.rows[0]?.wait, why === 'APPROVE plan' ? 'permission' : '', String(why))
    assert.equal(seen(out([row({ status: 'busy', waitingFor: 'approve x' })]), null, NOW)?.rows[0]?.wait, 'permission'.slice(0, 0)) // a label only on one that waits
    // the store's copy is checked the same way
    for (const bad of [null, 7, [], { at: 'x', rows: [] }, { at: NOW }, { at: -1, rows: [] }]) assert.equal(sight(bad), null)
    assert.deepEqual(sight({ at: NOW, rows: [{ id: 'a', cwd: '/x', st: 'waiting', wait: 'rm -rf', since: NOW + 9e9 }, { id: 'b', cwd: '/x', st: 'nope' }, 4] }), { at: NOW, rows: [{ id: 'a', cwd: '/x', st: 'waiting', wait: '', since: NOW }] })
  })

  test('names: the name the person gave a chat is kept, cleaned and cut; the one Claude Code made is not a name', () => {
    // Claude Code's own: the folder, a hyphen and two hex digits. Anything else is the person's
    for (const [name, cwd] of [['workspace-5a', '/home/me/workspace'], ['gin-00', '/w/gin'], ['my app-ff', '/w/my app'], ['api-0c', 'C:\\work\\api'], ['-1a', '/']]) assert.equal(chatName(name, cwd), '', name)
    for (const [name, cwd] of [['release notes', '/w/gin'], ['gin', '/w/gin'], ['gin-1A', '/w/gin'], ['gin-1ab', '/w/gin'], ['gin-zz', '/w/gin'], ['other-5a', '/w/gin'], ['修复登录', '/w/gin']]) assert.equal(chatName(name, cwd), name, name)
    for (const bad of [undefined, null, 7, {}, ['x'], '', '   ', '\x1b[2J', 'x'.repeat(1025)]) assert.equal(chatName(bad, '/w/gin'), '')
    // hostile: escape sequences, control and invisible characters, line breaks and turns of direction go; a long one is cut with an ellipsis
    assert.equal(chatName('\x1b[31mred\x1b[0m\x07 \u202eeman\u200b\n\r\ttwo\x00', '/w/gin'), 'red eman two')
    assert.equal(chatName('\x1b]8;;http://evil\x07click\x1b]8;;\x07', '/w/gin'), 'click')
    const long = chatName('n'.repeat(500), '/w/gin'), wide = chatName('名'.repeat(500), '/w/gin')
    assert.deepEqual([long, cols(wide) <= NAME_COLS, wide.endsWith('…')], [`${'n'.repeat(NAME_COLS - 1)}…`, true, true])
    assert.deepEqual([clip('abc', 3), clip('abcd', 3), clip('é'.repeat(9), 4), clip(7, 4)], ['abc', 'ab…', 'ééé…', ''])
    // the look keeps a name only where there is one, and the store's copy is cleaned again
    const look = seen(out([row({ sessionId: 'a' }), row({ sessionId: 'b', name: 'release notes' }), row({ sessionId: 'c', name: '\x1b[2Jwipe\n' }), row({ sessionId: 'd', name: { toString: () => 'x' } }), row({ sessionId: '__proto__', name: 'polluted' })]), null, NOW)
    assert.deepEqual(look?.rows.map(r => [r.id, r.name]), [['a', undefined], ['b', 'release notes'], ['c', 'wipe'], ['d', undefined]])
    assert.deepEqual(namesOf(look), { b: 'release notes', c: 'wipe' })
    assert.deepEqual(namesOf(sight({ at: NOW, rows: [{ id: 'a', cwd: '/w/gin', st: 'busy', since: NOW, name: `\x1b[1m${'y'.repeat(99)}` }, { id: 'b', cwd: '/w/gin', st: 'busy', since: NOW, name: 'gin-1a' }, { id: 'c', cwd: '/w/gin', st: 'busy', since: NOW, name: 9 }] })), { a: `${'y'.repeat(NAME_COLS - 1)}…` })
    assert.deepEqual([namesOf(null), {}.polluted], [{}, undefined])
    // the list and the news say the name; the folder stays beside it, and is what the small model is told
    const all = marks({ me: { cwd: '/w/x', at: NOW, done: false, beat: NOW }, b: { cwd: '/w/gin', at: NOW - 3 * MIN, done: true, took: 5 * MIN, beat: NOW }, a: { cwd: '/w/api', at: NOW - MIN, done: false, beat: NOW, asking: NOW - MIN } })
    assert.deepEqual(listing(all, 'me', NOW, namesOf(look)).map(c => [c.id, c.name, c.label]), [['me', 'x', ''], ['a', 'api', ''], ['b', 'gin', 'release notes']])
    assert.deepEqual(listing(all, 'me', NOW, { toString: 'x' }).map(c => c.label), ['', '', '']) // only a chat's own id finds a name
    const me = { id: 'me', cwd: '/w/x', since: NOW - H, now: NOW, names: { b: 'release notes' } }
    const ask = finished(all, {}, me), done = finished(all, ask.seen, { ...me, told: ask.told })
    assert.deepEqual([ask.peer?.name, ask.peer?.dir, done.peer?.name, done.peer?.dir], ['api', 'api', 'release notes', 'gin'])
    // the bubble: a named chat is told by its name, in each language
    const s0 = run([{ t: NOW, type: 'sessionStart' }, { t: NOW + 1, type: 'peer', here: false, name: 'release notes', named: true, ago: 3 * MIN }])
    assert.equal(bubble(view(s0, NOW + 2)).say, 'your chat “release notes” finished its job 3 min ago')
    const s1 = run([{ t: NOW, type: 'sessionStart' }, { t: NOW + 1, type: 'peer', here: true, name: 'release notes', named: true, ask: true }])
    assert.equal(bubble(view(s1, NOW + 2)).say, 'your chat “release notes” may be waiting for your OK')
  })

  test('watch: a session keeps the moment it was first seen in its status, and a new status starts again', () => {
    const first = seen(out([row({ status: 'waiting', waitingFor: 'approve plan' })]), null, NOW)
    const same = seen(out([row({ status: 'waiting', waitingFor: 'approve plan' })]), first, NOW + 30_000)
    assert.equal(same?.rows[0]?.since, NOW)
    assert.equal(seen(out([row()]), same, NOW + 60_000)?.rows[0]?.since, NOW + 60_000)
  })

  test('watch: a session without a living mark is counted and listed; a marked chat, a hidden one, this one and an old look are not touched', () => {
    const look = /** @type {NonNullable<ReturnType<typeof seen>>} */ (seen(out([row({ sessionId: 'me' }), row({ sessionId: 'busy', cwd: '/w/a' }), row({ sessionId: 'idle', cwd: '/w/b', status: 'idle' }), row({ sessionId: 'ask', cwd: '/w/c', status: 'waiting', waitingFor: 'approve Bash: x' }), row({ sessionId: 'dialog', cwd: '/w/d', status: 'waiting', waitingFor: 'dialog open' }),
      row({ sessionId: 'marked', status: 'idle' }), row({ sessionId: 'hidden', status: 'idle' }), row({ sessionId: 'died', status: 'idle', cwd: '/w/e' })]), null, NOW))
    const all = marks({ marked: { cwd: '/w/m', at: NOW - 1000, done: false, beat: NOW }, hidden: { cwd: '/w/h', at: NOW - 1000, done: true }, died: { cwd: '/w/e', at: NOW - 9e6, done: false, beat: NOW - 9e6 } })
    const merged = watched(all, look, 'me', NOW + 1000)
    assert.deepEqual(counts(merged, 'me', NOW + 1000), { working: 2, waiting: 1, asking: 1 }) // the idle ones were never seen busy: they may never have had a turn
    assert.deepEqual(listing(merged, 'me', NOW + 1000).map(c => `${c.name} ${c.state}`).sort(), ['a working', 'c asking', 'd waiting', 'm working'])
    assert.equal(merged.me, undefined)
    assert.deepEqual(merged.marked, all.marked)
    assert.deepEqual(merged.hidden, all.hidden) // /pet chats off: the watcher does not bring it back
    // the chat that began to wait for an OK is news once, like a marked one
    const news = finished(merged, {}, { id: 'me', cwd: '/w/x', since: NOW, now: NOW + 1000 })
    assert.deepEqual([news.peer?.ask, news.peer?.name], [true, 'c'])
    assert.equal(finished(merged, news.seen, { id: 'me', cwd: '/w/x', since: NOW, now: NOW + 2000, told: news.told }).peer, null)
    // a look nobody renewed, or one from a clock ahead, is not believed: the marks alone
    assert.equal(watched(all, look, 'me', NOW + RULES.chatDeadMs + 1), all)
    assert.equal(watched(all, { ...look, at: NOW + 9e6 }, 'me', NOW), all)
    assert.equal(watched(all, null, 'me', NOW), all)
  })

  test('watch: a chat that closed is not brought back by an old row, and a mark whose session left the live list waits for nobody', () => {
    // this chat ended a turn, a look saw it, then /clear closed its mark: the row of the old id shows no life after that
    const seenBusy = seen(out([row({ sessionId: 'old' }), row({ sessionId: 'peer', cwd: '/w/p' })]), null, NOW)
    const look = /** @type {NonNullable<ReturnType<typeof seen>>} */ (seen(out([row({ sessionId: 'old', status: 'idle' }), row({ sessionId: 'peer', cwd: '/w/p' })]), seenBusy, NOW + 30_000))
    const closed = marks({ old: { cwd: '/w/x', at: NOW + 40_000, done: true, beat: NOW + 40_000, closed: true, left: NOW + 20_000 } })
    const none = { working: 1, waiting: 0, asking: 0 }
    for (const at of [look.at, NOW + 60_000]) { // the look from before the close, and a later one whose list still holds the old id
      const merged = watched(closed, { ...look, at }, 'new', NOW + 61_000)
      assert.deepEqual(counts(merged, 'new', NOW + 61_000), none)
      assert.deepEqual(listing(merged, 'new', NOW + 61_000).map(c => `${c.name} ${c.state}`), ['p working'])
    }
    // the same session at work again after it closed (resumed without Hatchling): that is life, and it is listed
    const back = /** @type {NonNullable<ReturnType<typeof seen>>} */ (seen(out([row({ sessionId: 'old' })]), look, NOW + 90_000))
    assert.equal(listing(watched(closed, back, 'new', NOW + 91_000), 'new', NOW + 91_000)[0]?.state, 'working')
    // the ids this process had before a /clear are never another chat, with a look or with none, whatever their mark says
    const mine = marks({ old: { cwd: '/w/x', at: NOW, done: true, beat: NOW + 60_000 } })
    assert.deepEqual(watched(mine, back, 'new', NOW + 91_000, ['old']), {})
    assert.deepEqual(watched(mine, null, 'new', NOW + 61_000, ['old']), {})
    assert.equal(counts(watched(mine, null, 'new', NOW + 61_000), 'new', NOW + 61_000).waiting, 1)

    // a mark that still says "waiting", of a session the live list no longer holds: not counted, not listed
    const t = NOW + 60_000, live = /** @type {NonNullable<ReturnType<typeof seen>>} */ (seen(out([row({ sessionId: 'me' }), row({ sessionId: 'here', status: 'idle' })]), null, t))
    const all = marks({ here: { cwd: '/w/h', at: NOW, done: true, beat: t }, gone: { cwd: '/w/g', at: NOW, done: true, beat: t }, cut: { cwd: '/w/c', at: NOW, done: false, beat: t }, fresh: { cwd: '/w/f', at: t + 500, done: true, beat: t + 500 }, me: { cwd: '/w/m', at: NOW, done: true, beat: t } })
    const merged = watched(all, live, 'me', t + 1000)
    assert.deepEqual(counts(merged, 'me', t + 1000), { working: 0, waiting: 2, asking: 0 })
    assert.deepEqual(listing(merged, 'me', t + 1000).map(c => c.name).sort(), ['f', 'h', 'm']) // a chat that did something since the look is not judged by it; never this one
    assert.deepEqual(merged.gone, { ...all.gone, closed: true })
    // with no list (an app, a failure), or one that is not whole, the marks alone, as before
    assert.deepEqual(counts(watched(all, null, 'me', t + 1000), 'me', t + 1000), { working: 1, waiting: 3, asking: 0 })
    const full = { at: t, rows: Array.from({ length: WATCH.rows }, (_, i) => ({ id: `s${i}`, cwd: '/w/z', st: 'idle', wait: '', since: t })) }
    assert.deepEqual(counts(watched(all, full, 'me', t + 1000), 'me', t + 1000), { working: 1, waiting: 3, asking: 0 })
  })

  const H = 3_600_000, LOOK = WATCH.everyMs
  /** Looks taken one after the other, each `LOOK` after the one before, from `NOW`: what the last one holds, and when it was. */
  const looks = (/** @type {object[][]} */ ...lists) => lists.reduce((s, list, i) => ({ look: seen(out(list), s.look, NOW + i * LOOK), at: NOW + i * LOOK }), { look: /** @type {ReturnType<typeof seen>} */ (null), at: NOW })
  const waitingAt = (/** @type {ReturnType<typeof looks>} */ s, /** @type {number} */ now, all = {}) => counts(watched(all, s.look && { ...s.look, at: now }, 'me', now), 'me', now).waiting

  test('watch: an idle session never seen busy does not count, however long it stays; this chat is never counted', () => {
    const idle = [row({ sessionId: 'me', status: 'idle' }), row({ sessionId: 'a', status: 'idle' }), row({ sessionId: 'b', status: 'idle' }), row({ sessionId: 'c', status: 'idle' })]
    const s = looks(idle, idle, idle)
    for (const later of [0, H, 100 * H]) assert.deepEqual(counts(watched({}, s.look && { ...s.look, at: s.at + later }, 'me', s.at + later), 'me', s.at + later), { working: 0, waiting: 0, asking: 0 })
    assert.deepEqual(listing(watched({}, s.look, 'me', s.at), 'me', s.at), [])
    // the own id: busy, idle after a turn, or waiting for an OK, with or without a mark of its own, it is not one of the others
    for (const mine of [[row({ sessionId: 'me' })], [row({ sessionId: 'me' }), row({ sessionId: 'me', status: 'idle' })], [row({ sessionId: 'me', status: 'waiting', waitingFor: 'approve plan' })]]) {
      const own = looks(.../** @type {object[][]} */ (mine.map(r => [r])))
      for (const all of [{}, marks({ me: { cwd: '/w/gin', at: NOW, done: true, beat: NOW } })]) {
        const merged = watched(all, own.look, 'me', own.at)
        assert.deepEqual(counts(merged, 'me', own.at), { working: 0, waiting: 0, asking: 0 })
        assert.equal(finished(merged, {}, { id: 'me', cwd: '/w/x', since: NOW - H, now: own.at }).peer, null)
      }
    }
  })

  test('watch: a session a look saw go from busy to idle waits for the person, for two hours from then; busy again clears it', () => {
    const s = looks([row()], [row({ status: 'idle' })], [row({ status: 'idle' })])
    assert.equal(s.look?.rows[0]?.done, NOW + LOOK) // when the turn ended, kept while it stays idle
    assert.equal(waitingAt(s, s.at), 1)
    assert.equal(waitingAt(s, NOW + LOOK + RULES.waitCountMs), 1)
    assert.equal(waitingAt(s, NOW + LOOK + RULES.waitCountMs + 1), 0) // two hours after the change: no more
    assert.equal(RULES.waitCountMs, 2 * H)
    assert.equal(listing(watched({}, s.look && { ...s.look, at: s.at + 3 * H }, 'me', s.at + 3 * H), 'me', s.at + 3 * H)[0]?.state, 'waiting') // still listed
    // busy again: at work, and the turn that ended is forgotten; idle after that counts from the new end
    const again = looks([row()], [row({ status: 'idle' })], [row()])
    assert.equal(again.look?.rows[0]?.done, undefined)
    assert.deepEqual(counts(watched({}, again.look, 'me', again.at), 'me', again.at), { working: 1, waiting: 0, asking: 0 })
    const twice = looks([row()], [row({ status: 'idle' })], [row()], [row({ status: 'idle' })])
    assert.equal(twice.look?.rows[0]?.done, NOW + 3 * LOOK)
    // from waiting for an OK to idle is no turn seen ending; a moment kept in the store that is no moment is not believed
    assert.equal(waitingAt(looks([row({ status: 'waiting', waitingFor: 'approve plan' })], [row({ status: 'idle' })]), NOW + LOOK), 0)
    assert.deepEqual(sight({ at: NOW, rows: [{ id: 'a', cwd: '/x', st: 'idle', done: 'x' }, { id: 'b', cwd: '/x', st: 'busy', done: NOW }, { id: 'c', cwd: '/x', st: 'idle', done: NOW + 9e9 }] })?.rows.map(r => r.done), [undefined, undefined, NOW])
  })

  test('watch: a session whose status is waiting counts at once and for as long as it waits for an OK', () => {
    const s = looks([row({ status: 'waiting', waitingFor: 'approve Bash: x' })])
    for (const later of [0, 5 * H]) { const now = NOW + later; assert.deepEqual(counts(watched({}, s.look && { ...s.look, at: now }, 'me', now), 'me', now), { working: 0, waiting: 0, asking: 1 }) }
  })

  test('a chat with a mark of its own: its ended turn counts as waiting for two hours, then it is listed and not counted; a new turn starts again', () => {
    const live = (/** @type {number} */ now, /** @type {object} */ m) => marks({ other: { cwd: '/w/a', beat: now, .../** @type {any} */ (m) } })
    assert.equal(counts(live(NOW + RULES.waitCountMs, { at: NOW, done: true }), 'me', NOW + RULES.waitCountMs).waiting, 1)
    const late = NOW + RULES.waitCountMs + 1, old = live(late, { at: NOW, done: true })
    assert.deepEqual(counts(old, 'me', late), { working: 0, waiting: 0, asking: 0 })
    assert.equal(listing(old, 'me', late)[0]?.state, 'waiting')
    assert.equal(counts(live(late, { at: late - 1000, done: false }), 'me', late).working, 1) // busy again
    assert.equal(counts(live(late + 5000, { at: late + 4000, done: true }), 'me', late + 5000).waiting, 1) // and its next end counts anew
    assert.equal(counts(live(late, { at: NOW, done: false, asking: NOW }), 'me', late).asking, 1) // a wait for an OK has no such limit
    assert.deepEqual(counts(marks({ me: { cwd: '/w/a', at: NOW, done: true, beat: NOW } }), 'me', NOW), { working: 0, waiting: 0, asking: 0 }) // never this chat
  })
}
