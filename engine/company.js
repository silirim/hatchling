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

/** How many of the person's OTHER chats are at work, wait for them, or may wait for their OK. @param {Marks} all @param {string} id @param {number} now */
export function counts(all, id, now) {
  const n = { working: 0, waiting: 0, asking: 0 }
  for (const [k, m] of Object.entries(all)) { const st = stateOf(m, now); if (k !== id && st !== 'closed') n[st]++ }
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
