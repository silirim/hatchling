// @ts-check
// List input prices in $/MTok. The rows of LISTED were read from Anthropic's model table (cached 2026-11-03) and match that version
// only: `opus-5` is not `opus-5-5`, and a later `fable-5-3` is not listed.
// The rows of GUESSED are not: a model that only matches its family name (an older or a future one) is priced like the family's
// current models, and audit.js says so on the receipt. Update both when prices change.
const LISTED = /** @type {[string, number][]} */ ([
  ['fable-5-2', 8], ['mythos-5-2', 8], ['fable-5-1', 10], ['mythos-5-1', 10], ['fable-5', 10],
  ['opus-5-5', 4], ['opus-5', 5], ['opus-4-8', 5], ['opus-4-7', 5], ['opus-4-6', 5],
  ['sonnet-5-5', 2], ['sonnet-5', 2], ['sonnet-4-6', 3],
  ['haiku-5-5', 0.1], ['haiku-4-5', 1],
])
const GUESSED = /** @type {[string, number][]} */ ([['fable', 10], ['mythos', 10], ['opus', 5], ['sonnet', 3], ['haiku', 1]])
// a listed name must not be followed by one more version digit (a date like -20260401 may follow)
const listed = (/** @type {string} */ model) => LISTED.find(([k]) => new RegExp(`${k}(?!-\\d(?!\\d))`).test(model))?.[1]
const family = (/** @type {string} */ model) => GUESSED.find(([k]) => model.includes(k))?.[1]

/** List input price of a model in $/MTok, undefined when the family is unknown. */
export const price = (/** @type {string} */ model) => listed(model) ?? family(model)
/** True when the price is the family's, not one read from the price list. */
export const guessed = (/** @type {string} */ model) => listed(model) === undefined && family(model) !== undefined

// What the other kinds of token cost, as multiples of the input price.
export const RATIO = { cacheRead: 0.1, cacheWrite: 1.25, output: 5 }

/**
 * What one request pays per kind of token, in $/MTok.
 * Read from the price list: output is 5x input on every listed model; a cache read is $0.20 on Fable/Mythos 5.2 (0.025x) and on
 * Opus 5.5 (0.05x), $0.10 on Sonnet 5.5 (0.05x); Haiku 5.5 costs five times as much when the prompt is over 100k tokens.
 * Not on the list we could read, only checked against the cost the CLI reports (2026-11, Opus 5.5 and Haiku 5.5 sessions):
 * the 0.1x cache read of the other models, the 0.025x of Fable/Mythos 5.1, the 1.25x write of the 5-minute cache and the 2x of the 1-hour one.
 * @param {string} model @param {number} prompt tokens of the whole prompt @param {number} [fallback] input price of an unknown model
 */
export function rates(model, prompt, fallback) {
  const base = price(model) ?? fallback
  if (base === undefined) return undefined
  const inp = base * (model.includes('haiku-5') && prompt > 100_000 ? 5 : 1)
  const read = /(fable|mythos)-5-[1-9]/.test(model) ? 0.025 : /opus-5-5|sonnet-5-5/.test(model) ? 0.05 : RATIO.cacheRead
  return { inp, read: inp * read, w5: inp * RATIO.cacheWrite, w1: inp * 2, out: inp * RATIO.output }
}
