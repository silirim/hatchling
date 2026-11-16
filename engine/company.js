// @ts-check
// The marks chats leave for each other in the shared store, and what a chat that opens makes of them. Pure: the adapter does the IO.
// A mark is the least that lets the pet say "a chat was left here": the working folder, when its last turn started or ended, and whether
// it ended. The working folder is kept as its full path, so that a chat left in this very folder can be told; it is the one path
// the store holds, for up to RULES.marksMax chats and RULES.marksMs. Never the content of the chat, a prompt, the path of a file or a command.

import { RULES } from './engine.js'
import { tidy } from './width.js'

const AHEAD_MS = 60_000 // a mark dated later than this after now was left by a clock that was ahead: it is not believed

/**
 * `took` is how long the turn that ended lasted, in ms: only a long one is news for the other chats. `beat` is when the chat last
 * said it was alive, `asking` since when a tool call of its turn has been waiting for the person's leave, `closed` that it ended.
 * A closed chat's `at` is when it closed: `left` is then when its last turn started or ended, and `mid` that this turn was cut short.
 * `recap` is the pause (the time of that last turn) the pet already made its recap for: no second one in the same process. A chat closed and resumed is asked again.
 * @typedef {{ cwd: string, at: number, done: boolean, took?: number, beat?: number, asking?: number, closed?: true, left?: number, mid?: true, recap?: number }} Mark
 */
/** @typedef {Record<string, Mark>} Marks by chat id */
/** What a chat is doing, for the person who has several open. @typedef {'working' | 'waiting' | 'asking' | 'closed'} ChatState */

/** What the store holds, made whole: anything that is not a mark is dropped. @param {unknown} raw @returns {Marks} */
export function marks(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const time = (/** @type {unknown} */ x) => typeof x === 'number' && Number.isFinite(x) && x > 0
  // made from pairs: a chat id is a name from outside, and is never set as a field by hand
  return Object.fromEntries(Object.entries(raw).flatMap(([id, m]) => m && typeof m.cwd === 'string' && time(m.at) ? [[id, { cwd: m.cwd.slice(0, 1024), at: m.at, done: !!m.done, ...(time(m.took) && { took: m.took }), ...(time(m.beat) && { beat: m.beat }), ...(time(m.asking) && { asking: m.asking }), ...(m.closed === true && { closed: true }), ...(time(m.left) && { left: m.left }), ...(m.mid === true && { mid: true }), ...(time(m.recap) && { recap: m.recap }) }]] : []))
}

/**
 * What a chat is doing now, from its mark. Closed when it said so, and when it has not said it is alive for RULES.chatDeadMs
 * (it died without a word, or is of a version before the board): never trusted for longer on its last word. A beat dated after
 * now, from a clock that was ahead, is no sign of life either.
 * @param {Mark} m @param {number} now @returns {ChatState}
 */
export function stateOf(m, now) {
  const beat = m.beat ?? 0
  if (m.closed || !beat || now - beat > RULES.chatDeadMs || beat - now > AHEAD_MS) return 'closed'
  return m.done ? 'waiting' : m.asking ? 'asking' : 'working'
}
/**
 * The last turn of a chat as its mark tells it: when it started or ended (`at`), and whether it was left midway (`mid`).
 * @param {Mark} m
 */
export const leftOf = (m) => m.closed ? { at: m.left ?? m.at, mid: !!m.mid } : { at: m.at, mid: !m.done }
/** Since when a chat is in its state: its last turn's start or end, or the moment a call began to wait for leave. @param {Mark} m */
const sinceOf = (m) => !m.done && m.asking ? m.asking : m.at

/**
 * How many of the person's OTHER chats are at work, wait for them, or may wait for their OK. Never this chat. One whose turn ended
 * waits for RULES.waitCountMs and is then counted no more (it is still listed), so a chat left open for days does not hold the count.
 * @param {Marks} all @param {string} id @param {number} now
 */
export function counts(all, id, now) {
  const n = { working: 0, waiting: 0, asking: 0 }
  for (const [k, m] of Object.entries(all)) { const st = stateOf(m, now); if (k !== id && st !== 'closed' && !(st === 'waiting' && now - m.at > RULES.waitCountMs)) n[st]++ }
  return n
}

/**
 * The chats that are open, for /pet chats: this one first, then the others, the one that changed last on top. Each with its
 * folder's name (never its path), its state and for how long: nothing of what is in it.
 * @param {Marks} all @param {string} id @param {number} now @returns {{ me: boolean, name: string, state: ChatState, ago: number }[]}
 */
export function listing(all, id, now) {
  return Object.entries(all).map(([k, m]) => ({ me: k === id, name: folder(m.cwd), state: stateOf(m, now), ago: Math.max(0, now - sinceOf(m)) }))
    .filter(c => c.state !== 'closed').sort((a, b) => Number(b.me) - Number(a.me) || a.ago - b.ago)
}

/**
 * The marks with this chat's set: the newest RULES.marksMax, none older than RULES.marksMs.
 * @param {Marks} all @param {string} id @param {Mark} mark
 */
export function remember(all, id, mark) {
  const kept = Object.entries({ ...all, [id]: mark }).filter(([, m]) => mark.at - m.at < RULES.marksMs && m.at - mark.at <= AHEAD_MS /* nor one from the future, which would never grow old */).sort((a, b) => b[1].at - a[1].at).slice(0, RULES.marksMax)
  return Object.fromEntries(kept)
}

/** The last part of a folder's path, the only part ever shown. @param {string} cwd */
export const folder = (cwd) => tidy(String(cwd).split(/[\\/]/).filter(Boolean).pop() ?? '', 24) // cleaned: it is shown, and sent to the small model

/**
 * The one greeting of a chat that opens in `cwd`, from what the other chats left: a chat left here lately, else a return after
 * a long pause, else the first chat of the day, else a folder seen before, else a new one.
 * @param {Marks} all @param {{ id: string, cwd: string, now: number }} me
 * @returns {{ kind: import('./engine.js').GreetKind, name?: string, ago?: number, done?: boolean }}
 */
export function greeting(all, { id, cwd, now }) {
  const others = Object.entries(all).filter(([k, m]) => k !== id && m.at - now <= AHEAD_MS).sort((a, b) => b[1].at - a[1].at).map(([, m]) => ({ ...m, at: Math.min(m.at, now) }))
  const here = others.filter(m => m.cwd === cwd), name = folder(cwd)
  const [left] = here, [last] = others
  if (left && now - left.at <= RULES.resumeWithinMs) return { kind: 'resume', ago: now - left.at, done: left.done }
  if (last && now - last.at >= RULES.backAfterMs) return { kind: 'back', ago: now - last.at }
  if (!last || new Date(last.at).toDateString() !== new Date(now).toDateString()) return { kind: 'first' }
  return left ? { kind: 'seen', name } : { kind: 'new' }
}

/**
 * Which other chat ended a long turn since this one last looked: a job of RULES.peerMinTurnMs or more, one the person was likely
 * waiting for. A short turn is no news. `seen` is what this chat saw then, by chat id; a chat not seen before counts from `since`.
 * `told` is when each chat was last told of, by id: the same chat is not news again within RULES.peerAgainMs.
 * The news names the chat by its folder and says how long ago it ended (`ago`) and how long the turn took (`took`), in ms.
 * @param {Marks} all @param {Record<string, number>} seen @param {{ id: string, cwd: string, since: number, now: number, told?: Record<string, number> }} me
 * A chat that may be waiting for the person's OK (`ask`) goes first, and the finished turn it passed over is told at the next look.
 * @returns {{ seen: Record<string, number>, told: Record<string, number>, peer: { here: boolean, name: string, ago: number, took: number, ask: boolean } | null }}
 */
export function finished(all, seen, { id, cwd, since, now, told = {} }) {
  /** @type {Record<string, number>} */ const next = {}
  /** @type {[string, Mark] | null} */ let hit = null
  /** @type {[string, Mark] | null} */ let ask = null
  for (const [k, m] of Object.entries(all)) {
    if (k === id || m.at - now > AHEAD_MS) continue
    next[k] = m.at
    // a chat whose call has been waiting for the person's leave: told once for each such wait, whatever was told of that chat before
    if (stateOf(m, now) === 'asking' && told[`${k}?`] !== m.asking && (!ask || /** @type {number} */ (m.asking) > /** @type {number} */ (ask[1].asking))) ask = [k, m]
    const news = m.done && m.at > (seen[k] ?? since) && (m.took ?? 0) >= RULES.peerMinTurnMs && (told[k] === undefined || now - told[k] >= RULES.peerAgainMs)
    if (news && (!hit || m.at > hit[1].at)) hit = [k, m]
  }
  if (ask) { const [k, m] = ask; return { seen: { ...seen, ...Object.fromEntries(Object.entries(next).filter(([x]) => x !== hit?.[0])) }, told: { ...told, [`${k}?`]: /** @type {number} */ (m.asking) }, peer: { here: m.cwd === cwd, name: folder(m.cwd), ago: Math.max(0, now - /** @type {number} */ (m.asking)), took: 0, ask: true } } }
  if (!hit) return { seen: next, told, peer: null }
  const [k, m] = hit
  return { seen: next, told: { ...told, [k]: now }, peer: { here: m.cwd === cwd, name: folder(m.cwd), ago: Math.max(0, now - m.at), took: m.took ?? 0, ask: false } }
}

// The thin watcher: `claude agents --json` (Claude Code 2.1.139 or later) lists every live session of the person, the ones that run
// without Cachito too. What it prints is input from outside: capped in size, checked row by row, and of each row only the session's
// id, its folder, its status and one fixed label are kept. Never its name, a prompt or the text of what it waits for.
export const WATCH = { bytes: 262_144, rows: 64, everyMs: 30_000, timeoutMs: 5_000 }
const STATUS = ['busy', 'idle', 'waiting']
/** Why a session waits, as one of the labels there are: a leave to give, or '' for anything else. The text itself can name a tool and its command, and is dropped here. @param {unknown} why */
const labelOf = (why) => typeof why === 'string' && (/^approve\b/i.test(why) || why === 'sandbox request') ? 'permission' : ''
/** A session as the watcher keeps it: `since` is when it was first seen in this status, `done` when a look saw it go from busy to idle (a turn ended). @typedef {{ id: string, cwd: string, st: string, wait: string, since: number, done?: number }} Seen */
/** What the watcher last saw, and when. @typedef {{ at: number, rows: Seen[] }} Sight */

/** A row made whole, or null: an id that is a plain name, a path with no control character, a status there is. @param {any} r @param {number} now @returns {Seen | null} */
function seenOf(r, now) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[\w-]{1,64}$/.test(r.id) || r.id === '__proto__' || typeof r.cwd !== 'string' || !r.cwd || r.cwd.length > 1024 || /\p{Cc}/u.test(r.cwd) || !STATUS.includes(r.st)) return null
  const since = typeof r.since === 'number' && Number.isFinite(r.since) && r.since > 0 ? Math.min(r.since, now) : now
  const done = r.st === 'idle' && typeof r.done === 'number' && Number.isFinite(r.done) && r.done > 0 ? Math.min(r.done, now) : 0
  return { id: r.id, cwd: r.cwd, st: r.st, wait: r.st === 'waiting' && r.wait === 'permission' ? 'permission' : '', since, ...(done && { done }) }
}
/** What the store holds of the last look, made whole; null when it holds none. @param {any} raw @returns {Sight | null} */
export function sight(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.at !== 'number' || !Number.isFinite(raw.at) || raw.at <= 0 || !Array.isArray(raw.rows)) return null
  return { at: raw.at, rows: raw.rows.slice(0, WATCH.rows).flatMap((/** @type {unknown} */ r) => seenOf(r, raw.at) ?? []) }
}
/**
 * What `claude agents --json` printed, as a look taken at `now`; null when it is too long, no JSON or no list. A row that is not
 * sound is left out. A session seen in the same status at the look before (`was`) keeps the moment it was first seen so. One that
 * was busy then and is idle now ended a turn: `done` says when, and stays while it is idle; busy again, it is gone.
 * @param {unknown} stdout @param {Sight | null} was @param {number} now @returns {Sight | null}
 */
export function seen(stdout, was, now) {
  if (typeof stdout !== 'string' || stdout.length > WATCH.bytes) return null
  /** @type {unknown} */ let list
  try { list = JSON.parse(stdout) } catch { return null }
  if (!Array.isArray(list)) return null
  const rows = list.slice(0, WATCH.rows).flatMap((/** @type {any} */ r) => {
    const row = seenOf({ id: r?.sessionId, cwd: r?.cwd, st: r?.status, wait: labelOf(r?.waitingFor) }, now)
    const before = row && was?.rows.find(o => o.id === row.id), old = before && before.st === row.st && before.wait === row.wait ? before : null
    const done = row?.st !== 'idle' ? 0 : before?.st === 'busy' ? now : old?.done ?? 0
    return row ? [{ ...row, since: old ? Math.min(old.since, now) : now, ...(done && { done: Math.min(done, now) }) }] : []
  })
  return { at: now, rows: rows.filter((r, i) => rows.findIndex(o => o.id === r.id) === i) }
}
/**
 * The marks with what the watcher saw: a session that left no living mark of its own (it runs without Cachito) gets one made
 * from its row. Busy is at work, and one that waits for a leave may be waiting for their OK. An idle one waits for the person
 * only when a look saw it end a turn (from then, see `counts`); one never seen busy is left out: it may never have had a turn. A chat
 * with a living mark stays as its mark tells it; one whose board is off (a mark with no sign of life, not closed) stays hidden;
 * a look older than RULES.chatDeadMs is not believed.
 * @param {Marks} all @param {Sight | null} look @param {string} id @param {number} now @returns {Marks}
 */
export function watched(all, look, id, now) {
  if (!look || now - look.at > RULES.chatDeadMs || look.at - now > AHEAD_MS) return all
  const more = look.rows.flatMap(r => {
    const m = Object.hasOwn(all, r.id) ? all[r.id] : undefined
    if (r.id === id || (m && (stateOf(m, now) !== 'closed' || (!m.closed && !m.beat)))) return []
    const ask = r.st === 'waiting' && r.wait === 'permission'
    if (r.st === 'idle' && !r.done) return []
    return [[r.id, /** @type {Mark} */ ({ cwd: r.cwd, at: r.done ?? r.since, done: r.st !== 'busy' && !ask, beat: Math.min(look.at, now), ...(ask && { asking: r.since }) })]]
  })
  return { ...all, ...Object.fromEntries(more) }
}
