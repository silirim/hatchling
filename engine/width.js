// @ts-check
// Width on screen: a Chinese character, and its punctuation, takes two columns of a terminal, a combining mark none. The bubble
// wraps and sizes its border by these columns, and the limits of a line are counted in them. Pure.

// the ranges a terminal draws two columns wide (East Asian Wide and Fullwidth)
const WIDE = [[0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd]]
const ZERO = /^[\p{Mn}\p{Me}\p{Cf}\p{Cc}]$/u
// marks that may not begin a line: they stay with the character before them
const NO_START = /^[，。？！：；、）」』》]$/

/** The columns one character takes: 0, 1 or 2. @param {string} ch */
function colsOf(ch) {
  if (ZERO.test(ch)) return 0
  const cp = ch.codePointAt(0) ?? 0
  return WIDE.some(([a, b]) => cp >= /** @type {number} */ (a) && cp <= /** @type {number} */ (b)) ? 2 : 1
}

/** The columns a text takes on screen. @param {string} text */
export function cols(text) {
  let n = 0
  for (const ch of text) n += colsOf(ch)
  return n
}

/** A text padded with spaces to `n` columns. @param {string} text @param {number} n */
export const pad = (text, n) => text + ' '.repeat(Math.max(0, n - cols(text)))

/**
 * What a line may be broken between: words, and each wide character, since Chinese has no spaces. `gap` says a space came before.
 * @param {string} text @returns {{ s: string, gap: boolean }[]}
 */
function units(text) {
  /** @type {{ s: string, gap: boolean }[]} */ const out = []
  for (const word of text.split(' ')) {
    let gap = out.length > 0, unit = '', lastWide = false
    for (const ch of word) {
      const wide = colsOf(ch) === 2
      if (unit && !NO_START.test(ch) && (wide || lastWide)) { out.push({ s: unit, gap }); gap = false; unit = '' }
      unit += ch
      lastWide = wide
    }
    if (unit) out.push({ s: unit, gap })
  }
  return out
}

/**
 * A text as the lines of at most `max` columns it is shown in: broken at spaces and between wide characters, never before a closing
 * mark. A word wider than a line is cut by columns, never through a character.
 * @param {string} text @param {number} max @returns {string[]}
 */
export function wrap(text, max) {
  /** @type {string[]} */ const lines = []
  let line = ''
  for (const { s, gap } of units(text)) {
    const sep = line && gap ? ' ' : ''
    if (cols(line) + sep.length + cols(s) <= max) { line += sep + s; continue }
    if (line) lines.push(line)
    line = ''
    for (const ch of s) {
      if (line && cols(line) + colsOf(ch) > max) { lines.push(line); line = '' }
      line += ch
    }
  }
  if (line || !lines.length) lines.push(line)
  return lines
}

// What a terminal acts on: an escape sequence, whole (CSI with its parameters, OSC up to its end, a two-character escape)
const ESCAPES = /\u001b(?:\[[0-?]*[ -/]*[@-~]?|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?|[@-Z\\-_])?/g
/**
 * A text from outside (a folder's name, a file's, a model's reply, an adopted personality) made safe to show and to send: one line,
 * with no escape sequence, control or invisible character (the marks that turn the direction of writing among them), no unpaired
 * surrogate, at most three combining marks on a character (a script that needs its marks keeps them), spaces run together.
 * With `max`, cut to that many columns on screen, never through a character with its marks.
 * @param {unknown} raw @param {number} [max] @returns {string}
 */
export function tidy(raw, max = Infinity) {
  if (typeof raw !== 'string') return ''
  const s = raw.slice(0, 8000).replace(ESCAPES, '').replace(/[\p{Cc}\p{Zl}\p{Zp}\s]+/gu, ' ').replace(/[\p{Cf}\p{Cs}\p{Co}\p{Cn}]/gu, '')
    .replace(/(\p{M}{3})\p{M}+/gu, '$1').replace(/^\p{M}+/u, '').replace(/ +/g, ' ').trim()
  if (cols(s) <= max) return s
  let out = '', n = 0
  for (const g of s.match(/\P{M}\p{M}*/gu) ?? []) {
    const w = cols(g)
    if (n + w > max) break
    out += g; n += w
  }
  return out.trimEnd()
}
