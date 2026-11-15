import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, reduce, view, program, dayOf, RULES } from './engine.js'
import { bubble, ago, TALK, SILLY, OUTLINE, CALM } from './catalog.js'
import { marks, remember, greeting, finished, folder, stateOf, counts, listing } from './company.js'

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
  assert.equal(folder('/home/me/work/cachito/'), 'cachito')
  assert.equal(folder('C:\\work\\app'), 'app')
})

test('the greeting: a chat left here, a long pause, the first chat of the day, a known folder, a new one', () => {
  const now = Date.UTC(2026, 10, 12, 12), me = { id: 'me', cwd: '/w/cachito', now }
  const g = (all) => greeting(all, me)
  assert.deepEqual(g({}), { kind: 'first' })
  assert.deepEqual(g({ me: { cwd: '/w/cachito', at: now - MIN, done: true } }), { kind: 'first' }) // its own mark is not another chat
  assert.deepEqual(g({ a: { cwd: '/w/cachito', at: now - 20 * MIN, done: false }, b: { cwd: '/w/other', at: now - MIN, done: true } }), { kind: 'resume', ago: 20 * MIN, done: false })
  assert.deepEqual(g({ a: { cwd: '/w/cachito', at: now - RULES.backAfterMs - H, done: true } }), { kind: 'back', ago: RULES.backAfterMs + H })
  assert.deepEqual(g({ a: { cwd: '/w/cachito', at: now - 30 * H, done: true } }), { kind: 'first' })
  assert.deepEqual(g({ a: { cwd: '/w/cachito', at: now - 30 * H, done: true }, b: { cwd: '/w/other', at: now - H, done: true } }), { kind: 'seen', name: 'cachito' })
  assert.deepEqual(g({ b: { cwd: '/w/other', at: now - H, done: true } }), { kind: 'new' })

  const line = (e) => bubble(view(run([at({ type: 'greet', ...e })], start()), t))
  assert.deepEqual([line({ kind: 'resume', ago: 20 * MIN, done: false }).say, line({ kind: 'resume', ago: 20 * MIN, done: false }).ask, line({ kind: 'resume', ago: 20 * MIN, done: false }).label], ['a chat here stopped mid-turn 20 min ago. pick it up?', '/resume', 'resume'])
  assert.equal(line({ kind: 'resume', ago: 3 * H, done: true }).say, 'a chat here finished its turn 3 h ago. pick it up?')
  assert.equal(line({ kind: 'back', ago: 4 * DAY }).say, `welcome back, good to see you. ${RULES.coinsWelcome} stars for you`)
  assert.equal(line({ kind: 'first' }).say, 'first chat of the day, here we go')
  assert.equal(line({ kind: 'seen', name: 'cachito' }).say, 'back in cachito, I know this place')
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
  assert.deepEqual([bubble(view(long, t)).ask, bubble(view(long, t)).more], ['/pet lean on', null])
  const cheered = run([at({ type: 'turnEnd' }), at({ type: 'greet', kind: 'first' })], { ...start(), days: RULES.grownAt.days, affection: RULES.grownAt.affection - 1, day: dayOf(t) })
  assert.equal(say(cheered), 'grew a stage')
})

test('another chat ending a long turn is told once, with its folder and since when; a short turn is no news, and the same chat not again for 10 minutes', () => {
  let s = run([at({ type: 'peer', here: false, name: 'vodmax', ago: 4 * MIN })], start())
  assert.equal(say(s), 'the chat in vodmax finished its job 4 min ago')
  const first = s.session.talk.at
  s = run([at({ type: 'peer', here: true, name: 'cachito', ago: 0 }, MIN)], s)
  assert.equal(s.session.talk.at, first)
  s = run([at({ type: 'peer', here: true, name: 'cachito', ago: 0 }, RULES.peerGapMs)], s)
  assert.equal(say(s), 'the other chat in this folder (cachito) finished its job just now')
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
  assert.deepEqual(r.peer, { here: true, name: 'a', ago: 600, took: took3, ask: false })
  assert.deepEqual(r.told, { busy: 1000 })
  assert.equal(finished({ ...all, busy: { cwd: '/w/a', at: 400, done: true, took: took3 } }, r.seen, { ...me, told: r.told }).peer, null) // once
  // the same chat ends another long turn: not news again within 10 minutes, news after
  const again = { busy: { cwd: '/w/a', at: 900, done: true, took: took3 } }
  assert.equal(finished(again, r.seen, { ...me, now: 1000 + 9 * MIN, told: r.told }).peer, null)
  assert.deepEqual(finished(again, r.seen, { ...me, now: 1000 + 10 * MIN, told: r.told }).peer?.name, 'a')
  assert.deepEqual(finished({ new: { cwd: '/w/zed', at: 150, done: true, took: 2 * MIN } }, {}, me).peer, { here: false, name: 'zed', ago: 850, took: 2 * MIN, ask: false })
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
  assert.deepEqual([b.ask, b.label, b.more], ['/pet lean on', 'fix', { say: 'long chat: shall we put our thoughts in order?', ask: OUTLINE, label: 'outline' }])
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
    { me: true, name: 'here', state: 'working', ago: MIN },
    { me: false, name: 'api', state: 'asking', ago: 2 * MIN }, // since its call began to wait, not since its turn began
    { me: false, name: 'vodmax', state: 'working', ago: 4 * MIN },
    { me: false, name: 'notes', state: 'waiting', ago: 9 * MIN },
  ])
  assert.doesNotMatch(JSON.stringify(listing(all, 'me', now)), /secret-client|home\/me/) // a folder's name, never its path

  // the news: the chat that may wait for an OK is told once, at once, before a turn that ended; then the turn; then nothing
  const me = { id: 'me', cwd: '/w/here', since: now - 20 * MIN, now }
  let r = finished(all, {}, me)
  assert.deepEqual(r.peer, { here: false, name: 'api', ago: 2 * MIN, took: 0, ask: true })
  r = finished(all, r.seen, { ...me, told: r.told })
  assert.deepEqual(r.peer, { here: false, name: 'notes', ago: 9 * MIN, took: 3 * MIN, ask: false })
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
