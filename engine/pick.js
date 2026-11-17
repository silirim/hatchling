// @ts-check
// What the person may have meant by a typed word that is not an id. Only an id acts (buys, puts on, switches): it is unique, and a
// shown name may one day be shared by two things. A word that is a shown name, in any language, with or without its article, or a
// word or a beginning of one, is answered with the ids it could be, and nothing is done. Capitals and accents do not count. Pure.

// the articles a shown name may begin with, in the four languages (Chinese names have none)
const ARTICLE = /^(?:a|an|the|some|el|la|los|las|un|una|unos|unas|o|os|as|um|uma|uns|umas|um par de)\s+(?=\S)/
/** How many ids a reply names at most. */
export const PICK_MAX = 5

/** A name as it is compared: small letters, no accents, no punctuation, single spaces. @param {string} s */
const plain = (s) => s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
/** The same without its article. @param {string} s */
export const bare = (s) => { const p = plain(s); return p.replace(ARTICLE, '') }

/** The changes that turn one word into another: letters added, dropped or swapped for another. @param {string} a @param {string} b */
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(/** @type {number} */ (row[j]) + 1, /** @type {number} */ (next[j - 1]) + 1, /** @type {number} */ (row[j - 1]) + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return /** @type {number} */ (row[b.length])
}

/**
 * What a typed word is among `things`. `id` only when it is an id as written (capitals aside): the one case that acts. Else `meant`,
 * the ids whose shown name it is, all of them when several share it; failing a whole name, the ids a word of whose name it is
 * ("mug"), then the ones it begins ("sung"). Else `near`, the ids closest to it by letters, nearest first, empty when nothing is close.
 * When more words are typed and the first is an id, that is the id ("shades sunglasses", read off a row of the shop).
 * @param {string} typed @param {{ id: string, names: (string | undefined)[] }[]} things
 * @returns {{ id: string, meant: string[], near: string[] }}
 */
export function pick(typed, things) {
  const said = bare(typed), none = { id: '', meant: /** @type {string[]} */ ([]), near: /** @type {string[]} */ ([]) }
  if (!said) return none
  const first = typed.trim().toLowerCase().split(/\s+/)[0]
  const exact = things.find(t => t.id.toLowerCase() === first)
  if (exact) return { ...none, id: exact.id }
  const known = things.map(t => ({ id: t.id, key: plain(t.id), names: [...new Set(t.names.filter(n => typeof n === 'string').map(n => bare(/** @type {string} */ (n))).filter(Boolean))] }))
  const long = said.length > 1 || /[^\x00-\x7f]/.test(said) // one Latin letter is no beginning
  const steps = [
    (/** @type {typeof known[number]} */ t) => t.key === said || t.names.includes(said),
    (/** @type {typeof known[number]} */ t) => t.names.some(n => ` ${n} `.includes(` ${said} `)),
    (/** @type {typeof known[number]} */ t) => long && (t.key.startsWith(said) || t.names.some(n => n.startsWith(said) || n.split(' ').some(w => w.startsWith(said)))),
  ]
  for (const step of steps) {
    const hit = known.filter(step).map(t => t.id)
    if (hit.length) return { ...none, meant: hit.slice(0, PICK_MAX) }
  }
  // nothing: the closest ids, by the letters that differ from the id, from a name or from a word of one
  if (!long) return none
  const far = Math.max(1, Math.floor(said.length / 3))
  const near = known.map(t => ({ id: t.id, d: Math.min(...[t.key, ...t.names, ...t.names.flatMap(n => n.split(' '))].map(n => n.includes(said) || (n.length > 2 && said.includes(n)) ? 1 : distance(said, n))) }))
    .filter(t => t.d <= far).sort((a, b) => a.d - b.d).slice(0, 3).map(t => t.id)
  return { ...none, near }
}
