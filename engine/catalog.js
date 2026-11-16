// @ts-check
// Speech bubbles: what Cachito says for each issue and cheer, with a one-line fix and a docs link.

import { STATS } from './persona.js'
import { BASE, text, list, voicedAs } from './lang/index.js'
import { tidy } from './width.js'

export const DOCS = 'https://github.com/silirim/cachito-pet/blob/main/docs/fix/'

// Notes, all of them: a friend's advice, worded without blame, and none costs the pet anything. The words are in engine/lang/.
// `ask` is what the fix button puts in the prompt box: a command, or a line for the agent, which stays in English like the style.
const NOTE = /** @type {Record<string, { doc: string, ask: string }>} */ ({
  // advice only, and only when a prompt comes after a pause over the cache's life in a chat of 100k or more (RULES.coldAfterMs, coldTokens)
  cold: { doc: 'cache-break.md', ask: '/compact' },
  stomach: { doc: 'cache-break.md', ask: '' }, // a habit of the person, nothing to tell the agent
  dizzy: { doc: 'rereads.md', ask: 'Use what is already in context instead of reading unchanged files again.' },
  loop: { doc: 'loops.md', ask: 'That command keeps failing. Read the error, explain the cause, then try a different approach.' },
  heavy: { doc: 'long-chat.md', ask: '/pet briefox on' },
  bloated: { doc: 'context-full.md', ask: '/compact' },
})
/**
 * What a note says, in a language.
 * @param {string} kind @param {string | undefined} d @param {{ n?: number, turns?: number }} i @param {string} [lang]
 */
function noteSay(kind, d, i, lang) {
  if (kind === 'stomach') return text(lang, 'stomach.say', { d: d ? text(lang, `cause.${d}`, {}, d) : text(lang, 'stomach.none') })
  if (kind === 'dizzy') return d ? text(lang, 'dizzy.say.file', { d: tidy(d.split(/[/\\]/).pop(), 40) }) : text(lang, 'dizzy.say') // the file's name only, cleaned: it comes from outside
  // the program's name only (engine.js `program`): arguments and VAR=value may hold a secret
  if (kind === 'loop') return text(lang, (i.turns ?? 1) > 1 ? 'loop.say.turns' : 'loop.say', { d: d || text(lang, 'loop.none'), n: i.n ?? 3, turns: i.turns ?? 1 })
  if (kind === 'bloated') return d ? text(lang, 'bloated.say', { d }) : text(lang, 'bloated.say.none')
  return text(lang, `${kind}.say`, { d: d ?? text(lang, `${kind}.none`) })
}
export const ISSUES = /** @type {Record<string, { doc: string, ask: string, say: (d?: string, i?: { n?: number, turns?: number }, lang?: string) => string, fix: (lang?: string) => string }>} */ (
  Object.fromEntries(Object.entries(NOTE).map(([kind, n]) => [kind, { ...n, say: (/** @type {string | undefined} */ d, i = {}, /** @type {string | undefined} */ lang) => noteSay(kind, d, i, lang), fix: (/** @type {string | undefined} */ lang) => text(lang, `${kind}.fix`) }])))

/** The place of a statistic in STATS, -1 for none: which of a line's six wordings is said. @param {string} [stat] */
const at = (stat) => STATS.indexOf(/** @type {any} */ (stat))

export const CHEERS = /** @type {Record<string, (value?: number, lang?: string, stat?: string) => string>} */ ({
  lean: (_, lang, stat) => voicedAs(lang, 'cheer.lean', at(stat)),
  evolve: (_, lang, stat) => voicedAs(lang, 'cheer.evolve', at(stat)),
})

// What /pet briefox on adds to the system prompt: written once, in the briefox plugin of this repository (briefox/text.js).
export { BENCH, TEXT as BRIEF, ID as BRIEF_ID } from '../briefox/text.js'

// Calm lines rotate with the turn. Each one is true of its state: a short chat, or a long one with lean on.
const SPOKEN = ['calm.short.0', 'calm.short.1', 'calm.short.2', 'calm.long.0', 'calm.long.1', 'calm.long.2', 'greet.first', 'greet.new', 'cheer.lean', 'cheer.evolve']
const plain = (/** @type {string} */ key) => voicedAs(BASE, key)
export const CALM = { short: [0, 1, 2].map(i => plain(`calm.short.${i}`)), long: [0, 1, 2].map(i => plain(`calm.long.${i}`)) }
// The character: the same thing said by each of the five (STATS, in order): the wit, the curious, the calm, the rigorous, the warm one.
// A pet speaks as its highest statistic, and now and then as its second highest (persona.js `speaker`). Lines that carry a number or a
// name are said the same by all. This is the English table, by its plain line; every language has its own in engine/lang/.
export const VOICE = /** @type {Record<string, string[]>} */ (Object.fromEntries(SPOKEN.map(key => [plain(key), list(BASE, key).slice(1)])))
/** An English line as the pet of this character says it: the line itself when it has no variant, or no character is given. @param {string} say @param {string} [stat] */
export const voiced = (say, stat) => VOICE[say]?.[at(stat)] ?? say

// What the pet says when it is petted, by character (STATS, in order): two lines each, in turn.
export const CUDDLES = STATS.map(stat => list(BASE, `cuddle.${stat}`))
/** The line for the `n`th cuddle of a pet of this character. @param {string | undefined} stat @param {number} n @param {string} [lang] */
export const cuddle = (stat, n, lang) => pick(list(lang, `cuddle.${STATS[at(stat)] ?? 'calm'}`), n)
/**
 * A fixed line with the person's name before it, one time in three by `n` (the cuddles counted, the day): the line reads whole
 * without the name, and a name in every line would wear. With no name told (/pet call me), the line as it is.
 * @param {string} line @param {string | undefined} name @param {string | undefined} lang @param {number} n
 */
export const called = (line, name, lang, n) => name && n % 3 === 0 ? text(lang, 'callme.line', { name, line }) : line

const pick = (/** @type {string[]} */ lines, /** @type {number} */ turn) => /** @type {string} */ (lines[turn % lines.length])

const LEAN_FIX = { link: DOCS + 'long-chat.md', ask: '/pet briefox on' }

// The companion's lines. All of it is local text: nothing here enters the model's context, except the outline request, and that only
// when the person presses the button and then Enter.
export const SILLY = list(BASE, 'silly')
/**
 * When a moment was, for the recap: how long ago on the same day, `yesterday` for the day before, then the days. Worked out when
 * the line is drawn, so it is right for as long as the line stays.
 * @param {number} at @param {number} now @param {string} [lang]
 */
export function since(at, now, lang) {
  const day = (/** @type {number} */ t) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000 }
  const days = day(now) - day(at)
  return days <= 0 ? ago(Math.max(0, now - at), lang) : days === 1 ? text(lang, 'recap.yesterday') : text(lang, 'ago.days', { n: days })
}

// what the outline button puts in the prompt box
export const OUTLINE = 'Write an outline of this chat that I can paste into a new one. Three parts: where we are (what is done and decided, with the files and commands that matter), where we need to get to (the goal and its constraints), and what is still missing (the open steps, in order). Keep it short and self-contained: the new chat knows nothing of this one.'

/** How long ago, in words. @param {number} ms @param {string} [lang] */
export function ago(ms, lang) {
  const min = Math.round(ms / 60_000)
  return min < 2 ? text(lang, 'ago.now') : min < 90 ? text(lang, 'ago.min', { n: min }) : min < 36 * 60 ? text(lang, 'ago.h', { n: Math.round(min / 60) }) : text(lang, 'ago.days', { n: Math.round(min / 1440) })
}

/** What went wrong in a long turn, shortest first: programs by name, never their arguments. @param {import('./engine.js').Talk} t @param {string} [lang] */
function recap(t, lang) {
  const times = (/** @type {number} */ n, /** @type {string} */ key) => text(lang, `${key}.${n === 1 ? 'one' : 'many'}`, { n })
  const fails = Object.entries(t.fails ?? {}).sort((a, b) => b[1] - a[1])
  const parts = fails.slice(0, 2).map(([name, n]) => text(lang, n === 1 ? 'recap.fail.once' : 'recap.fail.many', { name: name === '?' ? text(lang, 'recap.cmd') : name, n }))
  if (fails.length > 2) parts.push(text(lang, 'recap.more', { n: fails.length - 2 }))
  if (t.rereads) parts.push(times(t.rereads, 'recap.reread'))
  if (t.rebuilds) parts.push(times(t.rebuilds, 'recap.rebuild'))
  return text(lang, 'recap', { parts: parts.join(text(lang, 'sep')) })
}

/** A greeting. @param {import('./engine.js').Talk} t @param {string} [lang] @param {string} [stat] */
function greet(t, lang, stat) {
  switch (t.greet) {
    case 'resume': return text(lang, t.done ? 'greet.resume.done' : 'greet.resume.mid', { ago: ago(t.ago ?? 0, lang) })
    // a return after days away: warm, with the gift when one was given, and never a count of the days
    case 'back': return t.n ? text(lang, 'greet.back.gift', { n: t.n }) : text(lang, 'greet.back')
    case 'first': return voicedAs(lang, 'greet.first', at(stat))
    case 'seen': return t.name ? text(lang, 'greet.seen', { name: t.name }) : text(lang, 'greet.seen.here')
    default: return voicedAs(lang, 'greet.new', at(stat))
  }
}

/** Each takes the talk, the language and the statistic that speaks. @type {Record<import('./engine.js').TalkKind, (t: import('./engine.js').Talk, lang?: string, stat?: string) => { say: string, fix?: string, ask?: string, label?: string }>} */
export const TALK = {
  // `buddy`: once in a pet's life a dim line under the greeting says that who had the old /buddy can bring back its name and character.
  // Nothing was read to say it: the person's config is opened only when they run /pet adopt
  greet: (t, lang, stat) => ({ say: greet(t, lang, stat), ...(t.buddy ? { fix: text(lang, 'greet.buddy') } : null), ...(t.greet === 'resume' ? { ask: '/resume', label: text(lang, 'btn.resume') } : t.buddy ? { ask: '/pet adopt', label: text(lang, 'btn.adopt') } : null) }),
  // which chat (its folder) and since when; with the comments on the small model says the same fact in the pet's character (`said`)
  // `ask`: that chat may be waiting for the person's OK on a tool call
  peer: (t, lang) => ({ say: t.said || text(lang, `peer.${t.ask ? 'ask.' : ''}${!t.name ? 'away' : t.here ? 'here' : 'in'}`, { name: t.name ?? '', ago: ago(t.ago ?? 0, lang) }) }),
  recap: (t, lang) => ({ say: recap(t, lang) }),
  // never worded as a saving: no run measured one
  tidy: (_, lang) => ({ say: text(lang, 'tidy.say'), fix: text(lang, 'tidy.fix'), ask: OUTLINE, label: text(lang, 'btn.outline') }),
  voice: t => ({ say: t.text ?? '' }),
  coffee: (t, lang) => ({ say: text(lang, 'coffee', { n: t.n ?? 0 }) }),
  silly: (t, lang) => { const words = list(lang, 'silly'); return { say: /** @type {string} */ (words[Math.min(words.length - 1, Math.floor((t.n ?? 0) * words.length))]) } },
}

/**
 * @typedef {{ say: string, fix: string | null, link: string | null, ask: string, label: string, more: { say: string, ask: string, label: string } | null, aside: string }} Bubble
 * `label` names the button that puts `ask` in the prompt box; `more` is a second, dim line with a button of its own; `aside` is the
 * comment about the turn under a recap or an outline offer, a dim last line with no button ('' = none).
 */

/**
 * Bubble text for a view() result: the warning or state line, and the companion's line where it fits. With nothing to warn about the
 * companion's line is the bubble. Under a warning only the recap, the outline offer and a line of the voice are kept, as a second line: the rest is chatter and stays unseen.
 * The pet's character picks the tone of a line, and a greeting starts with its name.
 * @param {ReturnType<typeof import('./engine.js').view>} v
 * @param {{ name?: string, voice?: string, lang?: string, call?: string, callN?: number }} [who] the pet's name, the statistic that speaks this line and the language; without them, the plain English lines.
 *   `call` is the person's name, when they told it, and `callN` the day: the welcome back and the first greeting of a day carry the name one day in three (`called`)
 * @returns {Bubble}
 */
export function bubble(v, who = {}) {
  const tone = who.voice, lang = who.lang
  const b = { ...state(v, lang, tone), label: text(lang, 'btn.fix'), more: null, aside: '' }
  const t = v.talk && TALK[v.talk.kind]?.(v.talk, lang, tone)
  if (!t?.say) return b
  const hello = who.name && v.talk?.kind === 'greet' ? `${who.name}: ` : ''
  if (v.talk?.kind === 'greet' && (v.talk.greet === 'back' || v.talk.greet === 'first')) t.say = called(t.say, who.call, lang, who.callN ?? 0)
  // the recap and the outline offer do not silence the comment about the same turn: it is the last line, under theirs
  const aside = (v.talk?.kind === 'recap' || v.talk?.kind === 'tidy') && v.talk.text || ''
  if (v.calm) return { say: hello + t.say, fix: t.fix ?? null, link: null, ask: t.ask ?? '', label: t.label ?? text(lang, 'btn.fix'), more: null, aside }
  return v.talk?.kind === 'recap' || v.talk?.kind === 'tidy' || v.talk?.kind === 'voice' ? { ...b, more: { say: t.say, ask: t.ask ?? '', label: t.label ?? '' }, aside } : b
}

/**
 * The warning or state line. Calm lines say the real state of the chat; a long one with lean off gets the heavy message at once,
 * and one where lean is chosen but the style still waits says so, without a cheer.
 * @param {ReturnType<typeof import('./engine.js').view>} v @param {string} [lang] @param {string} [tone]
 * @returns {{ say: string, fix: string | null, link: string | null, ask: string }}
 */
function state(v, lang, tone) {
  if (v.issue) {
    const i = /** @type {NonNullable<typeof ISSUES[string]>} */ (ISSUES[v.issue.kind]), d = v.issue.detail
    const fix = v.issue.kind !== 'stomach' ? i.fix(lang) : d?.startsWith('ttl_') ? text(lang, 'stomach.fix.ttl') : d === 'likely_server_side' ? text(lang, 'stomach.fix.server') : i.fix(lang)
    return { say: i.say(d, v.issue, lang), fix, link: DOCS + i.doc, ask: i.ask }
  }
  if (v.cheer) return { say: /** @type {(value?: number, lang?: string, stat?: string) => string} */ (CHEERS[v.cheer.kind])(v.cheer.value ?? 0, lang, tone), fix: null, link: null, ask: '' }
  // lean is chosen and the style is not in the system prompt yet: no fix to press, the person did their part
  if (v.long && v.wait) return { say: text(lang, 'wait.say'), fix: text(lang, 'wait.fix'), link: DOCS + 'long-chat.md', ask: '' }
  if (v.long && !v.lean) return { say: noteSay('heavy', undefined, {}, lang), fix: text(lang, 'heavy.fix'), ...LEAN_FIX } // before the turn ends too: the same advice
  return { say: voicedAs(lang, `calm.${v.long ? 'long' : 'short'}.${v.turn % 3}`, at(tone)), fix: null, link: null, ask: '' }
}
