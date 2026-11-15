// @ts-check
// The pet's name and character: made here from a stored seed, or taken from the old /buddy. Pure, and no model is asked: zero tokens.

import { RULES } from './engine.js'
import { text } from './lang/index.js'
import { tidy } from './width.js'

// The traits of the pets born before the statistics, and of the words of a /buddy personality: each stands for one statistic (OF_TRAIT).
export const TRAITS = /** @type {const} */ (['dry', 'curious', 'patient', 'fussy', 'cheerful', 'sweet', 'shy'])
/** @typedef {typeof TRAITS[number]} Trait */

export const NAME_MAX = 20
const PERSONALITY_MAX = 120
// consonant and vowel pairs that read the same in most languages; a syllable never comes twice in a row
const SYL = ['ba', 'bi', 'bo', 'da', 'di', 'do', 'ki', 'ko', 'la', 'li', 'lo', 'lu', 'ma', 'mi', 'mo', 'mu', 'na', 'ni', 'no', 'nu', 'pa', 'ra', 'ri', 'ro', 'ru', 'sa', 'so', 'ta', 'to', 'va', 'vi', 'zo', 'zu']

/**
 * The animal a new pet is born as: by weight, so the rare ones stay rare. One with no weight (an animal of a skin pack) is never rolled.
 * @param {Record<string, { weight?: number }>} species @param {number} r a random number from 0 to 1
 * @returns {string | undefined} undefined when there is nothing to roll
 */
export function roll(species, r) {
  const all = Object.entries(species).flatMap(([name, sp]) => sp.weight && sp.weight > 0 ? [/** @type {[string, { weight: number }]} */ ([name, { weight: sp.weight }])] : [])
  let left = r * all.reduce((t, [, sp]) => t + sp.weight, 0)
  for (const [name, sp] of all) if ((left -= sp.weight) < 0) return name
  return all.at(-1)?.[0]
}

/** A new seed: the only random part of a pet's name and character. */
export const newSeed = () => Math.floor(Math.random() * 2 ** 32)

// The character: five statistics from 0 to 100, set at birth and never changed. One is the peak, one the weak point.
export const STATS = /** @type {const} */ (['wit', 'curiosity', 'calm', 'rigor', 'warmth'])
/** @typedef {typeof STATS[number]} Stat */
// the stat each of the old traits stood for: a pet born with two traits keeps its character
const OF_TRAIT = /** @type {Record<Trait, Stat>} */ ({ dry: 'wit', curious: 'curiosity', patient: 'calm', shy: 'calm', fussy: 'rigor', cheerful: 'warmth', sweet: 'warmth' })

const lcg = (/** @type {number} */ seed) => { let x = seed >>> 0; return (/** @type {number} */ n) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return Math.floor(x / 2 ** 32 * n) } }

/**
 * The five values: the peak 82 to 100, the second 64 to 78, the weak point 4 to 22, the other two 30 to 60. So the peak and the weak
 * point are never in doubt. `peak` and `second` are positions in STATS; one not given, or a second equal to the peak, is drawn.
 * @param {(n: number) => number} next @param {number} [peak] @param {number} [second] @returns {number[]}
 */
function spread(next, peak = next(STATS.length), second) {
  const rest = (/** @type {number[]} */ ...not) => STATS.map((_, i) => i).filter(i => !not.includes(i))
  const two = second !== undefined && second !== peak ? second : /** @type {number} */ (rest(peak)[next(STATS.length - 1)])
  const weak = rest(peak, two)[next(STATS.length - 2)]
  return STATS.map((_, i) => i === peak ? 82 + next(19) : i === two ? 64 + next(15) : i === weak ? 4 + next(19) : 30 + next(31))
}

/**
 * The name and the five statistics a seed gives, always the same for the same seed.
 * @param {number} seed @returns {{ name: string, stats: number[] }}
 */
export function born(seed) {
  const next = lcg(seed)
  next(TRAITS.length) // the draw of the old first trait: a seed keeps the name it had
  let name = '', last = -1
  for (let i = 2 + next(2); i > 0; i--) {
    let s = next(SYL.length - 1)
    if (s >= last && last >= 0) s++ // skips the syllable just used
    name += SYL[last = s]
  }
  return { name: name.charAt(0).toUpperCase() + name.slice(1), stats: spread(lcg(seed ^ 0x5bd1e995)) }
}

/**
 * The statistics of a pet that had the two old traits: the first is its peak, the second its second highest (drawn when both stand
 * for the same stat, or there is one only), the rest comes from the seed. The same for the same seed and traits.
 * @param {number} seed @param {Trait} trait @param {Trait} [trait2] @returns {number[]}
 */
export function statsOf(seed, trait, trait2) {
  return spread(lcg(seed ^ 0x5bd1e995), STATS.indexOf(OF_TRAIT[trait]), trait2 && STATS.indexOf(OF_TRAIT[trait2]))
}

/** Five whole numbers from 0 to 100, or undefined. @param {unknown} raw @returns {number[] | undefined} */
export const asStats = (raw) => Array.isArray(raw) && raw.length === STATS.length && raw.every(n => Number.isInteger(n) && n >= 0 && n <= 100) ? raw : undefined

/** The highest and the lowest statistic; the first in STATS wins a tie. @param {number[]} stats @returns {{ peak: Stat, weak: Stat }} */
export function extremes(stats) {
  const at = (/** @type {number} */ v) => /** @type {Stat} */ (STATS[stats.indexOf(v)] ?? STATS[0])
  return { peak: at(Math.max(...stats)), weak: at(Math.min(...stats)) }
}

/**
 * Who says the `n`th line: the highest statistic, or now and then the second highest, the more often the closer the two values are
 * (RULES.voiceSecond). No dice: the same line number always has the same speaker, so a line does not change voice while it is on
 * screen, and the second one's lines come evenly spread. The first in STATS wins a tie.
 * @param {number[]} stats @param {number} n @returns {Stat}
 */
export function speaker(stats, n) {
  const [first, second] = STATS.map((stat, i) => ({ stat, value: stats[i] ?? 0 })).sort((a, b) => b.value - a.value)
  if (!first || !second) return STATS[0]
  const { near, far, gap } = RULES.voiceSecond
  const share = Math.max(far, near - (near - far) * (first.value - second.value) / gap)
  return (n + 1) * 0.6180339887498949 % 1 < share ? second.stat : first.stat
}

/** One line of personality, from the peak and the weak point, in a language. @param {number[]} stats @param {string} [lang] */
export function personalityOf(stats, lang) {
  const { peak, weak } = extremes(stats)
  return text(lang, 'personality', { peak: text(lang, `peak.${peak}`), weak: text(lang, `weak.${weak}`) })
}

/** A statistic as a short bar of `width` cells. @param {number} value @param {number} [width] */
export const bar = (value, width = 10) => '█'.repeat(Math.round(value * width / 100)).padEnd(width, '░')

/**
 * A name fit to show: letters with the marks they are written with (a name in Hindi or Thai keeps its vowel signs), digits, spaces,
 * hyphens and apostrophes, at most NAME_MAX columns on screen, never cut through a letter and its marks. Empty when nothing is left.
 * @param {unknown} raw
 */
export function cleanName(raw) {
  return tidy(tidy(raw).replace(/[^\p{L}\p{M}\p{N} '-]/gu, ''), NAME_MAX)
}

/** A valid trait, or undefined. @param {unknown} raw @returns {Trait | undefined} */
export const asTrait = (raw) => TRAITS.find(t => t === raw)

const HINTS = /** @type {[Trait, RegExp][]} */ ([
  ['dry', /\b(dry|deadpan|wry|sarcas|snark|blunt)/i],
  ['curious', /\b(curio|inquisit|wonder|nosy)/i],
  ['patient', /\b(patien|calm|gentle|stoic|serene)/i],
  ['fussy', /\b(fuss|picky|pedant|meticulous|perfectionis|nitpick)/i],
  ['cheerful', /\b(cheer|happy|joy|sunny|playful|bubbly|upbeat)/i],
  ['sweet', /\b(sweet|kind|warm|tender|affection|loving)/i],
  ['shy', /\b(shy|introvert|quiet|timid|reserved)/i],
])
/** The traits a /buddy personality reads as, by its words: at most two, none when no word fits. @param {string} personality @returns {Trait[]} */
export const traitsOf = (personality) => HINTS.filter(([, re]) => re.test(personality)).map(([t]) => t).slice(0, 2)

/**
 * The old /buddy companion in the text of ~/.claude.json: its name, personality and hatching time, and nothing else of that file.
 * Null when there is none, or it has no usable name.
 * @param {string} text @returns {{ name: string, personality: string, hatchedAt: number } | null}
 */
export function buddy(text) {
  let c
  try { c = JSON.parse(text)?.companion } catch { return null }
  if (!c || typeof c !== 'object') return null
  const name = cleanName(c.name)
  if (!name) return null
  const personality = tidy(c.personality, PERSONALITY_MAX)
  const at = typeof c.hatchedAt === 'string' ? Date.parse(c.hatchedAt) : Number(c.hatchedAt)
  return { name, personality, hatchedAt: Number.isFinite(at) && at > 0 ? at : 0 }
}
