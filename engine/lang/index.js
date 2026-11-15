// @ts-check
// The pet's languages: one file each, a flat table of keys. English is the base: a key another language lacks is said in English.
// A value is a text with {places} to fill, or a list of texts. A list of six is one line said six ways: plainly, then by each of
// the five characters (persona.js STATS, in order). Command names, the style sent to the model and the documents stay in English.

import en from './en.js'
import es from './es.js'
import pt from './pt.js'
import zh from './zh.js'

/** @typedef {Record<string, string | string[]>} Table */
export const LANGS = /** @type {Record<string, Table>} */ ({ en, es, pt, zh })
export const BASE = 'en'

/** A language there is, or undefined. @param {unknown} raw @returns {string | undefined} */
export const asLang = (raw) => typeof raw === 'string' && Object.hasOwn(LANGS, raw) ? raw : undefined

/**
 * The language of a system locale (`es_ES.UTF-8`, `pt-BR`, `zh_CN`): the first of the values given that is set, as LC_ALL goes
 * before LANG. English when it is none of ours; Chinese written in traditional characters is not ours either.
 * @param {...unknown} locales @returns {string}
 */
export function fromLocale(...locales) {
  const first = String(locales.find(l => typeof l === 'string' && l.trim()) ?? '').trim().toLowerCase()
  const code = /^[a-z]+/.exec(first)?.[0]
  if (code === 'zh' && /^zh[_-](tw|hk|mo|hant)/.test(first)) return BASE
  return asLang(code) ?? BASE
}

/** What a key holds in a language, or in English when that language lacks it. @param {string | undefined} lang @param {string} key */
const entry = (lang, key) => LANGS[lang ?? BASE]?.[key] ?? /** @type {Table} */ (en)[key]

/** A text with its {places} filled; a place nothing fills stays as it is, to be seen. @param {string} s @param {Record<string, string | number>} fill */
export const put = (s, fill) => s.replace(/\{(\w+)\}/g, (all, name) => name in fill ? String(fill[name]) : all)

/**
 * A text, with its {places} filled. A key nobody has reads as `fallback`, or as the key itself.
 * @param {string | undefined} lang @param {string} key @param {Record<string, string | number>} [fill] @param {string} [fallback]
 */
export function text(lang, key, fill = {}, fallback = key) {
  const v = entry(lang, key)
  return put(typeof v === 'string' ? v : fallback, fill)
}

/** A list of texts; empty when the key holds none. @param {string | undefined} lang @param {string} key @returns {string[]} */
export function list(lang, key) {
  const v = entry(lang, key)
  return Array.isArray(v) ? v : []
}

/**
 * A line said six ways, as the character `at` says it (0 to 4, the place in STATS), or plainly without one.
 * @param {string | undefined} lang @param {string} key @param {number} [at]
 */
export const voicedAs = (lang, key, at = -1) => { const l = list(lang, key); return l[at + 1] ?? l[0] ?? key }
