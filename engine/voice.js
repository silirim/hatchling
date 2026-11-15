// @ts-check
// The voice: one short line about the turn, written by a small model. Off unless the person turns it on, since it spends their tokens.
// Pure: what is sent (`system`, `summary`), what comes back made fit to show (`clean`), and the count of lines and cost (`tally`, `count`).
// The adapter does the call. Nothing here reads a file, a command's output or the person's prompt.

import { RULES, dayOf } from './engine.js'
import { STATS } from './persona.js'
import { rates } from './prices.js'
import { BASE, asLang, text, list } from './lang/index.js'
import { cols, tidy } from './width.js'

export const MODEL = 'haiku' // the alias, resolved by Claude Code
// shortcut: the call gives back tokens, not dollars, and not the model the alias came to: the cost is those tokens at this model's list price
export const PRICED_AS = 'claude-haiku-5-5'

/** Why the pet speaks. `turn` (a turn ended) and `long` (a turn still running after RULES.voiceGapMs) wait for RULES.voiceGapMs since the last line, the others do not; `say` is an answer to /pet say. @typedef {'turn' | 'long' | 'fail' | 'files' | 'cuddle' | 'say' | 'peer'} Why */
const WHY = /** @type {Record<Why, string>} */ ({
  turn: 'the turn ended',
  long: 'the assistant is still at work on the same request: the turn has not ended',
  fail: 'a command or a test failed in this turn',
  files: 'this turn changed many files',
  cuddle: 'the person just petted you',
  say: 'the person spoke to you',
  peer: 'another chat of the person finished a long job',
})

/**
 * The count kept in the store, shared by every chat: `today` and `todayUsd` belong to `day`, `lines`, `usd`, `input` and `output`
 * are all-time, `at` is when the last line was asked for, `by` when the last one was asked for each reason, `dropped` how many of
 * the lines paid for were not shown because they came back too long, `paths` how many because they named a file or a path,
 * `last` the newest RULES.voiceRecall lines shown, oldest first: sent back so the next one differs.
 * @typedef {{ day: number, today: number, todayUsd: number, lines: number, usd: number, input: number, output: number, at: number, by: Record<string, number>, dropped: number, paths: number, last: string[] }} Tally
 */

/** The newest RULES.voiceRecall lines of a list, each a text short enough to have been shown. @param {unknown} list @returns {string[]} */
const recall = (list) => Array.isArray(list) ? list.filter(x => typeof x === 'string' && x && cols(x) <= RULES.voiceMaxCols).slice(-RULES.voiceRecall) : []

const num = (/** @type {unknown} */ x) => typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.min(x, Number.MAX_SAFE_INTEGER) : 0

/**
 * What the store holds, made whole, with today's part at zero on a new day. The days only go forward, as the pet's own do: a clock
 * behind the day kept (set back, another time zone) leaves the count in the day kept, so going back never gives the day's lines again.
 * A time kept that is after now counts as now: the wait starts from here.
 * @param {any} raw @param {number} now @returns {Tally}
 */
export function tally(raw, now) {
  const today = dayOf(now), kept = Number.isInteger(raw?.day) && raw.day > 0 && raw.day < 1e8 ? raw.day : 0
  const day = Math.max(today, kept), same = kept > 0 && kept === day
  const past = (/** @type {unknown} */ x) => Math.min(num(x), now)
  const by = Object.fromEntries(Object.keys(WHY).flatMap(why => { const at = past(raw?.by?.[why]); return at ? [[why, at]] : [] }))
  return { day, today: same ? Math.floor(num(raw.today)) : 0, todayUsd: same ? num(raw.todayUsd) : 0, lines: Math.floor(num(raw?.lines)), usd: num(raw?.usd), input: Math.floor(num(raw?.input)), output: Math.floor(num(raw?.output)), at: past(raw?.at), by, dropped: Math.floor(num(raw?.dropped)), paths: Math.floor(num(raw?.paths)), last: recall(raw?.last) }
}

/**
 * Why the pet stays silent now: the day's cap, the wait since the last line, or '' when it may speak. A turn's line waits
 * RULES.voiceGapMs since any line; every other reason waits its own RULES.voiceEvery since the last line asked for that reason.
 * @param {Tally} t @param {Why} why @param {number} now
 */
export function due(t, why, now) {
  if (t.today >= RULES.voiceCapDay) return 'cap'
  const [since, gap] = why === 'turn' || why === 'long' ? [t.at, RULES.voiceGapMs] : [t.by[why] ?? 0, RULES.voiceEvery[why] ?? 0]
  return since && now - since < gap ? 'wait' : ''
}

/** A count of tokens as the call reports it, when it is one: a text, a negative or a broken number is none. @param {unknown} x */
const tokens = (x) => Math.floor(num(x))

/** What one call cost, in dollars: its tokens at the list price of PRICED_AS. @param {{ input_tokens?: number, output_tokens?: number, cache_read_input_tokens?: number, cache_creation_input_tokens?: number } | undefined} u */
export function usd(u) {
  const inp = tokens(u?.input_tokens), read = tokens(u?.cache_read_input_tokens), write = tokens(u?.cache_creation_input_tokens)
  const r = rates(PRICED_AS, inp + read + write)
  return r ? (inp * r.inp + read * r.read + write * r.w5 + tokens(u?.output_tokens) * r.out) / 1e6 : 0
}

/**
 * The tally with one line asked for: counted in the day and timed BEFORE the call goes out, so that two chats, or a slow call,
 * cannot both pass the cap or the wait on the same count. A call that then fails or is cut short stays counted.
 * @param {Tally} t @param {Why} why @param {number} now @returns {Tally}
 */
export const reserve = (t, why, now) => ({ ...t, today: t.today + 1, lines: t.lines + 1, at: now, by: { ...t.by, [why]: now } })

/**
 * The tally with what a call that was reserved came to: its tokens and cost, whether its reply was dropped for its length (`long`)
 * or for naming a file or a path (`path`), and the line shown, if one was.
 * @param {Tally} t @param {Parameters<typeof usd>[0]} u @param {{ long?: boolean, path?: boolean, line?: string }} [how] @returns {Tally}
 */
export function settle(t, u, { long = false, path = false, line = '' } = {}) {
  const cost = usd(u)
  return { ...t, todayUsd: t.todayUsd + cost, usd: t.usd + cost, input: t.input + tokens(u?.input_tokens) + tokens(u?.cache_read_input_tokens) + tokens(u?.cache_creation_input_tokens), output: t.output + tokens(u?.output_tokens), dropped: t.dropped + (long ? 1 : 0), paths: t.paths + (path ? 1 : 0), last: recall([...t.last, line]) }
}

/** How many lines are left today. @param {Tally} t */
export const left = (t) => Math.max(0, RULES.voiceCapDay - t.today)

/** What a line costs on average: measured once one was paid for, RULES.voiceEstUsd until then. @param {Tally} t */
export const average = (t) => t.lines ? { usd: t.usd / t.lines, measured: true } : { usd: RULES.voiceEstUsd, measured: false }

/** Dollars, to the digits a line's cost needs. @param {number} x */
export const money = (x) => `$${x >= 1 ? x.toFixed(2) : x.toFixed(5)}`

/** What the pet asks once, before it ever speaks: what a yes comes to, in few words. `usdDay` is the most a day can cost. @param {number} usdDay @param {string} [lang] */
export const question = (usdDay, lang) => text(lang, 'comments.ask', { usd: money(usdDay) })

// How each statistic sounds when it leads and what it is like as the weak point. Three lines in its tone are in engine/lang/ (`tone.*`),
// in the language the pet speaks: reactions, not reports. The rest of what the model reads stays in English.
const LEAD = /** @type {Record<string, string>} */ ({ wit: 'dry and deadpan, you understate', curiosity: 'curious, you wonder and ask questions', calm: 'calm and unhurried, nothing rattles you', rigor: 'rigorous, you count and check', warmth: 'warm, fond of the person' })
const LACK = /** @type {Record<string, string>} */ ({ wit: 'you take things literally', curiosity: 'you rarely ask why', calm: 'you startle easily', rigor: 'you lose count', warmth: 'you keep a little distance' })
// shortcut: a language written without spaces is known by its own name being wide on screen. Its lines are asked for in characters, not words
const wide = (/** @type {string | undefined} */ lang) => cols(text(lang, 'self')) > text(lang, 'self').length
/** How long a line is asked to be. @param {string | undefined} lang */
const about = (lang) => wide(lang) ? 'about ten characters' : 'about six words'

// What each animal has and has not, so a line never names a part the drawing lacks. An animal not listed here names no part at all.
const BODY = /** @type {Record<string, string>} */ ({
  penguin: 'flippers, a beak, feathers, webbed feet. You have no paws, no fur, no ears to show, no hands',
  chick: 'small wings, a beak, fluffy down, thin legs. You have no paws, no fur, no ears, no hands',
  dog: 'paws, floppy ears, a tail, fur, a wet nose. You have no hands',
  bunny: 'long ears, paws, a small round tail, fur, whiskers. You have no hands',
  fox: 'pointed ears, paws, a bushy tail, fur, a snout. You have no hands',
  cactus: 'a round green body in a pot, spines, sometimes a flower. You have no ears, no paws, no fur, no tail, no hands, no head to rub',
  axolotl: 'feathery gills, a smooth tail, four tiny legs, soft skin. You have no fur, no ears, no paws, no hands',
})

/**
 * The system prompt: who the pet is, how its five statistics sound together, and the rules of a line. The pet reacts, in the first
 * person, as a companion of that character would: it does not report what happened.
 * With `talk` the person spoke to it (/pet say): it answers them, still as a pet. It gives no technical advice and does no work, and says so in its own way when asked.
 * `person` is the name the person asked to be called by (/pet call me): one more line, and none when they told none.
 * @param {{ name: string, animal: string, stats: number[], lang?: string, talk?: boolean, person?: string }} pet
 */
export function system({ name, animal, stats, lang, talk = false, person = '' }) {
  const tongue = text(lang, 'name'), own = (asLang(lang) ?? BASE) === BASE
  const by = STATS.map((stat, i) => ({ stat, value: stats[i] ?? 0 })).sort((x, y) => y.value - x.value)
  const first = by[0]?.stat ?? 'calm', second = by[1]?.stat ?? 'calm', last = by.at(-1)?.stat ?? 'wit'
  return [
    `You are ${name}, a small pixel ${animal} who keeps a programmer company at their terminal.`,
    `Your character, from 0 to 100: ${STATS.map((s, i) => `${s.toUpperCase()} ${stats[i] ?? 0}`).join(', ')}. First of all you are ${LEAD[first]}. Then ${LEAD[second]}. Your weak point: ${LACK[last]}. The other two show a little.`,
    Object.hasOwn(BODY, animal) ? `Your body: ${BODY[animal]}. Speak only of parts you have.` : 'Name no part of your body.',
    talk
      ? 'The person speaks to you. Answer them in the first person, as that companion would: a feeling, a quip, a question back. You are a pet, not an assistant: you give no technical advice and you do no work. Asked to do a task, to write, fix or explain something, you say in your own way that this is the job of the assistant in the chat, not yours: in six words too, with no reason given.'
      : 'You are told what just happened. React to the moment in the first person, as that companion would: a feeling, a question, a quip. Do not report it: no retelling, and no word, name or detail taken from what you are told.',
    `One line of ${about(lang)}, never more than ${wide(lang) ? RULES.voiceMaxCols / 2 : RULES.voiceMaxWords}. Plain ${tongue}${own ? '' : `: the line is in ${tongue}, whatever language the rest is in`}. No file names, no paths, no quoted text, no quotation marks, no exclamation marks, no emoji, no advice. Never unkind to the person.`,
    `Your tone, for instance: ${list(lang, `tone.${first}`).join(' / ')} Say something new, not one of these, and begin each line your own way: no habitual opening word such as Oh, Ooh, Eek or Well.`,
    ...(person ? [`The person asked you to call them ${person}. You may say that name now and then, in few of your lines, never in every one.`] : []),
  ].join('\n')
}

/** The lines of the diary the pet may hint at. @param {string[]} memories */
const remembered = (memories) => memories.length ? ['', 'What you remember of your time with this person:', ...memories.map(m => `- ${m}`), 'You may hint at one of these when it fits, or at none. Never list them.'] : []
/** Its own last lines, not to be said again. @param {string[]} said */
const again = (said) => said.length ? ['', `Your last lines, oldest first: ${said.join(' / ')}`, 'Do not repeat them: another first word, another image, another shape of sentence.'] : []

/**
 * The prompt of an answer to /pet say: what the person wrote (its first RULES.saySaidChars characters, on one line), the memories and
 * the pet's last lines. This text is the person's own, written for the pet: it is the one thing of theirs that is ever sent.
 * @param {{ said: string, last?: string[], lang?: string, memories?: string[] }} talk
 */
export function reply({ said, last = [], lang, memories = [] }) {
  return [
    `The person says to you: ${said.replace(/\s+/g, ' ').trim().slice(0, RULES.saySaidChars)}`,
    ...remembered(memories),
    ...again(recall(last)),
    '',
    `Now your one line in answer, in ${about(lang)}${(asLang(lang) ?? BASE) === BASE ? '' : `, in ${text(lang, 'name')}`}. One line only, and nothing after it. No file or command names, no advice, no task done.`,
  ].join('\n')
}

/**
 * The prompt of the news of another chat: a chat of the person's, named by its folder only, ended a turn of `took` ms, `ago` ms ago.
 * The pet tells the person, in its character: here the fact is to be said, not kept as background.
 * @param {{ name: string, here: boolean, took: number, ago: number, ask?: boolean, last?: string[], lang?: string }} peer `ask`: that chat is not done, it may be waiting for the person's OK
 */
export function news({ name, here, took, ago, ask = false, last = [], lang }) {
  const min = (/** @type {number} */ ms) => Math.max(1, Math.round(ms / 60_000))
  if (ask) return [
    'What just happened:',
    `- another chat of the person's, the one in the folder ${name || 'unknown'}${here ? ' (the same folder as this chat)' : ''}, has stopped in the middle of its work`,
    '- it seems to be waiting for the person to allow something, and it does nothing until they go there',
    ...again(recall(last)),
    '',
    `Now your one line: tell the person that the chat in ${name || 'the other folder'} may be waiting for their OK, naming that folder, in your own way, in ${about(lang)}${(asLang(lang) ?? BASE) === BASE ? '' : `, in ${text(lang, 'name')}`}. No other file or command names.`,
  ].join('\n')
  return [
    'What just happened:',
    `- another chat of the person's, the one in the folder ${name || 'unknown'}${here ? ' (the same folder as this chat)' : ''}, finished the job it was on`,
    `- that job took about ${min(took)} minutes, and it ended ${ago < 90_000 ? 'just now' : `${min(ago)} minutes ago`}`,
    '- the person was probably waiting for it and may not have seen it',
    ...again(recall(last)),
    '',
    `Now your one line: tell the person that the chat in ${name || 'the other folder'} is done${ago < 90_000 ? '' : ' and since when'}, naming that folder, in your own way, in ${about(lang)}${(asLang(lang) ?? BASE) === BASE ? '' : `, in ${text(lang, 'name')}`}. No other file or command names.`,
  ].join('\n')
}

/**
 * The prompt: a short account of the turn, made here from counts and names. Tool names with how many calls, the program names of the
 * failed commands (never their arguments), how many files changed, and the end of the assistant's reply, given as background only.
 * During a turn (`why` is `long`) the counts are the turn's so far, `minutes` says how long it has lasted, and `answer` is what the
 * assistant wrote last in it, when it wrote anything yet.
 * Then the lines the pet said last, its own words, so that it does not say them again.
 * @param {{ why: Why, tools?: Record<string, number>, failed?: Record<string, number>, files?: number, answer?: string, minutes?: number, last?: string[], lang?: string, memories?: string[] }} turn `memories` are lines of the diary (engine/diary.js), in English: times, counts, a folder's name
 */
export function summary({ why, tools = {}, failed = {}, files = 0, answer = '', minutes = 0, last = [], lang, memories = [] }) {
  const said = recall(last)
  const top = (/** @type {Record<string, number>} */ o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${tidy(k, 48)} ${n}`).join(', ') // a tool's name comes from outside (an MCP server's): one line, no control characters
  const tail = answer.replace(/\s+/g, ' ').trim().slice(-RULES.voiceTailChars)
  const mid = why === 'long'
  return [
    `${mid ? 'What is happening' : 'What just happened'} (background only, none of it is to be repeated):`,
    `- ${WHY[why]}`,
    ...(mid ? [`- it has lasted: ${Math.max(1, Math.round(minutes))} minutes so far, and the person is waiting`] : []),
    `- tools used${mid ? ' so far' : ''}: ${top(tools) || 'none'}`,
    `- commands that failed${mid ? ' so far' : ''}: ${top(failed) || 'none'}`,
    `- files changed${mid ? ' so far' : ''}: ${files}`,
    ...(tail ? [`- ${mid ? 'the assistant last wrote' : "the assistant's reply ended"}: ${tail}`] : []),
    ...remembered(memories),
    ...again(said),
    '',
    `Now your one line: what you feel or wonder about it, in ${about(lang)}${(asLang(lang) ?? BASE) === BASE ? '' : `, in ${text(lang, 'name')}`}. Not a report of it, and no file or command names.`,
  ].join('\n')
}

/** A reply's first line with what the bubble never shows taken out: escape sequences, emoji, quotation marks, exclamation marks, emphasis marks. @param {unknown} text */
function strip(text) {
  if (typeof text !== 'string') return ''
  return tidy((text.slice(0, 4000).split(/[\n\r\u0085\u2028\u2029]/).find(l => l.trim()) ?? '')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E0000}-\u{E007F}\u3164\u115F\u1160\uFFA0]/gu, ''))
    .replace(/[!！]+/g, m => m.includes('！') ? '。' : '.').replace(/["“”«»「」『』¡`*_]/g, '').replace(/(^|[\s(])['‘’]+|['‘’]+(?=$|[\s.,;:?)])/g, '$1') // every quotation mark; an apostrophe inside a word stays
    .replace(/\s+/g, ' ').replace(/ ([.,;:?])/g, '$1').replace(/\.{2,}/g, '.').trim()
}

/** Whether a reply is too long once cleaned: wider than RULES.voiceMaxCols on screen, or of more than RULES.voiceMaxChars characters. Such a line is dropped, never cut. @param {unknown} text */
export const tooLong = (text) => { const s = strip(text); return cols(s) > RULES.voiceMaxCols || [...s].length > RULES.voiceMaxChars }

const EXT = 'js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|c|h|cc|cpp|hpp|cs|php|sh|bash|zsh|md|txt|json|ya?ml|toml|html?|css|scss|sql|lock|env|cfg|ini|conf|log|xml|csv|png|jpe?g|gif|svg|pdf|zip|gz'
// A path: a separator at the start of a word (/etc, ~/notes, ./x, C:\\x), or between two words (src/app, a/b/c), unless the pair is
// plain speech: two numbers (50/50), or one of the pairs people write with a slash (and/or, yes/no). A file name: a word with one of
// the usual endings (app.js), not an abbreviation or a number (e.g., 1.2).
const SPOKEN = new Set(['and/or', 'either/or', 'yes/no', 'on/off', 'he/she', 'she/he', 'his/her', 'her/his', 's/he', 'him/her', 'n/a', 'w/o', 'true/false', 'in/out', 'read/write', 'before/after', 'pass/fail', 'y/n'])
const ROOTED = /(?:^|\s)(?:~|\.{1,2})?[/\\][\w.-]|[A-Za-z]:\\/, NAMED = new RegExp(`\\b[\\w-]+\\.(?:${EXT})\\b`, 'i')
const paired = (/** @type {string} */ s) => [...s.matchAll(/[\w.-]+(?:[/\\][\w.-]+)+/g)].some(([m]) => !/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(m) && !SPOKEN.has(m.toLowerCase().replace(/[.]+$/, '')))
const isPath = (/** @type {string} */ s) => ROOTED.test(s) || NAMED.test(s) || paired(s)
/** Whether a reply, cleaned, names a file or a path: what the line was told not to carry. Such a line is not shown. @param {unknown} text */
export const pathy = (text) => isPath(strip(text))

/**
 * A reply made fit for the bubble: its first line, without emoji, quotation marks or exclamation marks. Empty when nothing is left to
 * say, when the line is too long (half a sentence is worse than the fixed line), and when it names a file or a path.
 * @param {unknown} text
 */
export function clean(text) {
  const s = strip(text)
  return !tooLong(text) && /\p{L}{2}/u.test(s) && !isPath(s) ? s : ''
}
