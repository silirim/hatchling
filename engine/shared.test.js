// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { initialState, reduce, view, sync, adopt, shared, merge, whole, card, dayOf, RULES } from './engine.js'
import { bubble } from './catalog.js'

const T = Date.UTC(2026, 10, 12, 12) // noon: the same day in any time zone

/** A chat as the mod runs it: its own copy of the pet, the store read before every write, only its own changes put in. */
function chat(/** @type {{ pet?: any }} */ disk, /** @type {number} */ t0) {
  const born = disk.pet ? shared(disk.pet) : null
  /** @type {any} */ let cur = reduce(/** @type {any} */ ({ ...initialState(1), ...born, ...(born && { base: born }) }), { type: 'sessionStart', t: t0 })
  const share = (/** @type {boolean} */ write) => {
    const { pet, seen } = sync(cur, disk.pet)
    if (write) disk.pet = JSON.parse(JSON.stringify(pet))
    cur = adopt(cur, pet, write ? pet : seen ?? cur.base ?? shared(cur))
  }
  let t = t0
  return {
    get cur() { return cur },
    look: () => share(false),
    /** One turn over `context` tokens, lean on or off, then the save. */
    turn(/** @type {number} */ context, lean = false) {
      cur = reduce(cur, { type: 'prompt', t: ++t })
      cur = reduce(cur, { type: 'usage', t: ++t, input: 0, cacheRead: context, cacheWrite: 0, lean })
      cur = reduce(cur, { type: 'turnEnd', t: ++t })
      share(true)
    },
    /** The greeting of a chat opened after days away. */
    back() { cur = reduce(cur, { type: 'greet', t: ++t, kind: 'back' }) },
    buy(/** @type {string} */ id) { cur = reduce(cur, { type: 'buy', t: ++t, id }); share(true) },
  }
}

test('two chats that take turns: one pet, and neither writes its copy over what the other did', () => {
  /** @type {{ pet?: any }} */ const disk = {}
  const a = chat(disk, T)
  a.turn(10_000) // the first use of the day and a turn: the store is born
  const b = chat(disk, T + 1000)
  assert.equal(b.cur.coins, RULES.coinsFirstUse + 1)

  // a is long without lean, b is short, in turn: a coin a turn each, whatever the chat
  for (let i = 0; i < 5; i++) { a.turn(90_000); b.turn(10_000) }
  assert.deepEqual([disk.pet.coins, disk.pet.affection, disk.pet.days, disk.pet.dayTurns], [16, 16, 1, 11])
  assert.equal(b.cur.coins, 16) // b wrote last and holds the shared value
  a.look()
  assert.equal(a.cur.coins, 16) // a sees it at its next look, without writing
  assert.equal(disk.pet.life.cacheRead, 10_000 + 5 * 90_000 + 5 * 10_000)

  // each keeps its own chat: the size, the turns of the chat, the note on screen
  assert.deepEqual([a.cur.session.context, b.cur.session.context], [90_000, 10_000])
  assert.deepEqual([a.cur.session.turns, b.cur.session.turns], [6, 5])
  assert.deepEqual([a.cur.issues.map((/** @type {any} */ i) => i.kind), b.cur.issues], [['heavy'], []])
  assert.equal(disk.pet.session, undefined)
  assert.equal(disk.pet.issues, undefined)

  // b buys while a goes on: a's next write keeps the purchase and adds its own coin
  b.buy('shades')
  a.turn(90_000)
  assert.deepEqual([disk.pet.owned, disk.pet.coins], [['shades'], 16 - (RULES.prices.shades ?? 0) + 1])
  assert.deepEqual(card(a.cur).owned, ['shades'])
})

test('what two chats both saw is counted once: the first use of a day, the gift of a return; the cap of the day is one; things bought anywhere are owned everywhere', () => {
  /** @type {{ pet?: any }} */ const disk = { pet: { ...shared(initialState(1)), coins: 20, affection: 20, days: 3, day: dayOf(T) - 4 } }
  const a = chat(disk, T), b = chat(disk, T + 1000) // both open before either takes a turn
  a.back(); b.back()
  a.turn(10_000) // the gift, the first use of the day, the turn
  assert.deepEqual([disk.pet.coins, disk.pet.days], [20 + RULES.coinsWelcome + RULES.coinsFirstUse + 1, 4])
  b.turn(10_000) // b counted the same gift and the same first use on its own: only its turn goes in
  assert.deepEqual([disk.pet.coins, disk.pet.affection, disk.pet.days, disk.pet.dayTurns], [37, 27, 4, 2])
  assert.equal(b.cur.coins, 37)
  for (let i = 0; i < RULES.coinTurnsDay; i++) a.turn(10_000)
  assert.deepEqual([disk.pet.coins, disk.pet.dayTurns], [37 + RULES.coinTurnsDay - 2, RULES.coinTurnsDay])
  b.buy('shades'); a.buy('mug')
  assert.deepEqual([disk.pet.owned, disk.pet.coins], [['shades', 'mug'], 65 - (RULES.prices.shades ?? 0) - (RULES.prices.mug ?? 0)])
})

test('merge: only the changes since the last look go in; a store from before the shop keeps what was unlocked and loses the old counters', () => {
  const base = shared({ coins: 50, affection: 80, days: 4, day: 100, dayTurns: 3, life: { input: 100, cacheRead: 90 }, owned: ['shades'] })
  const stored = { ...base, coins: 20, affection: 90, dayTurns: 9, life: { input: 500, cacheRead: 400 }, owned: ['shades', 'cap'] }
  assert.deepEqual(merge(stored, base, base), stored) // nothing changed here: the store as it is
  const mine = { ...base, coins: 53, affection: 83, dayTurns: 6, life: { input: 130, cacheRead: 110 } }
  assert.deepEqual(merge(stored, base, mine), { ...stored, coins: 23, affection: 93, dayTurns: 12, life: { input: 530, cacheRead: 420 } })
  assert.equal(merge({ ...stored, coins: 1 }, base, { ...base, coins: 40 }).coins, -9) // spent here and there at once: a debt, not a gift
  // a pet of the version before: health, knock-outs and efficient sessions are not read, what those sessions had unlocked is owned
  const old = { variant: null, life: { input: 9, cacheRead: 8 }, health: 20, turn: 280, cleanStreak: 20, efficientSessions: 12, bestSessionHit: 0.97, ko: true, drowned: 3, flowerDebt: 0, lastCheerAt: 5, pending: [] }
  assert.deepEqual(shared(old), { ...shared(initialState(1)), life: { input: 9, cacheRead: 8 }, turn: 280, lastCheerAt: 5, owned: ['shades', 'sombrero'] })
  assert.deepEqual([shared({ efficientSessions: 4 }).owned, shared({ efficientSessions: 20 }).owned], [[], ['shades', 'scarf', 'sombrero']])
  assert.deepEqual(shared({ efficientSessions: 20, owned: ['shades', 'yacht'] }).owned, ['shades']) // once there is a list, the list stands
  assert.deepEqual(shared({ coins: 'x', owned: 7, bestStreak: 56, cheer: { kind: 'lean' }, session: { reads: { '/secret': 1 } } }), shared(initialState(1)))
  assert.deepEqual(sync({ ...initialState(1), coins: 60 }, undefined), { pet: { ...shared(initialState(1)), coins: 60 }, seen: null })
})

test('whole: a state kept by any earlier version, or a broken one, comes out with every field of this version and none of the old', () => {
  const keys = (/** @type {any} */ o) => Object.keys(o).sort()
  const fresh = initialState(1)
  // the version with health and ko, mid-chat: a ko on screen, cheers that no longer exist, a session without the companion's fields
  const old = {
    variant: 'golden', life: { input: 900, cacheRead: 800 }, health: 0, turn: 12, cleanStreak: 2, efficientSessions: 17, bestSessionHit: 0.97, ko: true, drowned: 3, flowerDebt: 2,
    issues: [{ kind: 'heavy', untilTurn: 14, until: 5000, detail: '90' }, { kind: 'thirsty', untilTurn: 14, until: 5000 }, 'x'],
    cheer: { kind: 'unlock', at: 1000, value: 1 }, lastCheerAt: 1000, queued: { kind: 'record', value: 0 }, pending: [{ kind: 'evolve', value: 0 }],
    session: { reads: { '/a': 1 }, blind: { 'npm test': 2 }, requests: 7, input: 100, cacheRead: 90, lastUsageAt: 900, expectRebuild: false, turnHadIssue: true, issueCount: 3, contextPct: 40, context: 90_000, lean: 'yes', cheeredHighHit: true },
    base: { health: 3, efficientSessions: 17, ko: false, pending: [] },
  }
  const s = whole(old)
  assert.deepEqual(keys(s), keys({ ...fresh, base: 0 }))
  assert.deepEqual(keys(s.session), keys(fresh.session))
  assert.deepEqual(keys(s.base), keys(shared(fresh)))
  assert.deepEqual([s.variant, s.turn, s.life, s.owned, s.coins, s.cheer, s.queued], ['golden', 12, { input: 900, cacheRead: 800 }, ['golden'], 0, null, null]) // born golden: the coat is its own
  assert.deepEqual(s.issues.map(i => i.kind), ['heavy']) // a note that still exists stays
  assert.deepEqual([s.session.reads, s.session.context, s.session.lean, s.session.talk, s.session.fails], [{}, 90_000, false, null, {}]) // a path kept as a field's name by an earlier version is dropped (C14), kept, wrong kind, absent, absent
  // whatever comes in, the rest of the engine runs on it
  for (const raw of [old, {}, null, 7, 'x', [], { session: 5, issues: 5, cheer: 5, owned: 5, base: 5 }, { cheer: { kind: 'lean' }, session: { talk: { kind: 'sing', at: 1 } } }, JSON.parse(JSON.stringify(fresh))]) {
    let w = whole(raw)
    assert.deepEqual([keys({ ...w, base: 0 }), keys(w.session)], [keys({ ...fresh, base: 0 }), keys(fresh.session)])
    for (const e of [{ type: 'prompt' }, { type: 'cmd', cmd: 'npm test', ok: false }, { type: 'usage', input: 1, cacheRead: 90_000, cacheWrite: 0 }, { type: 'cuddle' }, { type: 'turnEnd' }, { type: 'buy', id: 'shades' }]) w = reduce(w, /** @type {any} */ ({ ...e, t: T }))
    assert.equal(typeof bubble(view(w, T)).say, 'string')
    assert.ok(Array.isArray(view(w, T).owned) && Number.isFinite(card(w).coins) && sync(w, undefined).pet.owned)
  }
  assert.deepEqual(whole(JSON.parse(JSON.stringify(fresh))), JSON.parse(JSON.stringify(fresh))) // today's state passes unchanged
})
