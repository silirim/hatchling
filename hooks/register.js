// Cachito for Claude Code: feeds session events to the engine and draws the pet above the prompt.
// As installed it observes only: nothing is added to the model's context. Two levers the person turns on change that:
// /pet lean adds a short section to the system prompt (the style, the one lever the bench showed).
// What the pet says is local text. A button only fills the prompt box: the person sends it, or not.
// A third thing the person can turn on, /pet comments, spends their tokens: a small model then writes a line about the turn (engine/voice.js;
// in the code and the store it is still the `voice`).
// The pet speaks English, Spanish, Portuguese or Simplified Chinese (engine/lang/): /pet lang picks, and a newborn takes the system's.

import { atom, read, update } from 'claude-code'
import { initialState, reduce, view, card, dayOf, sync, adopt, shared, whole, program, SHOP, SOLD, COATS, GOLDEN, PLAIN, OWNABLE, EGGSHELL, FOUNDER_UNTIL, birth, sells, WEARABLE, SLOTS as PARTS, RULES, wornOf, putOn, takeOff, turnSlot } from '../engine/engine.js'
import { MODEL, tally, due, left, reserve, settle as settled, average, money, system, summary, news, reply, clean, tooLong, pathy, question } from '../engine/voice.js'
import { whole as diaryOf, open as diaryOpened, touch as diaryTouched, cuddled as diaryCuddled, bought as diaryBought, grew as diaryGrew, memory, saying, told, memories, page } from '../engine/diary.js'
import { marks, greeting, finished, folder, counts, listing } from '../engine/company.js'
import { bubble, cuddle as cuddleLine, called, ago, BENCH, STYLE, STYLE_ID, DOCS } from '../engine/catalog.js'
import { born as bornAs, newSeed, cleanName, asTrait, traitsOf, statsOf, asStats, extremes, speaker, personalityOf, bar, buddy, roll as rollOf, STATS, NAME_MAX, cleanCall, CALL_MAX } from '../engine/persona.js'
import { text, list as listOf, voicedAs, asLang, fromLocale } from '../engine/lang/index.js'
import { cols, pad, wrap, tidy } from '../engine/width.js'
import zoo from '../sprites/zoo.js'
import { REG, install, coatOf, dressed, portrait, LIMITS as SKIN_LIMITS } from '../engine/skins.js'
import { shareLines, picture, png, svg, sharePath } from '../engine/share.js'

const pet = atom(/** @type {const} */ ({ plugin: 'cachito', key: 'pet' }), null)
// `skin` is the ticks the row of the parts stays open, in place of the buttons, after the skin button.
// `idle` is the small gesture a calm pet is making and `idleN` its frame; `spark` the sparkles lit next to a golden coat, a bit each spot; `hush` counts the phrases that left the bubble, only to draw again.
// `sig` and `sigAt` are the phrase last shown and when it came up: kept here so that a reload of the mod does not show again a phrase that had its time
// `note` is a line the pet says for a while by itself, over any other line (its answer to /pet say, the line of a cuddle), `noteFix` the dim line under it, `noteLeft` the ticks it stays: then the bubble is what it was
const ANIM0 = { n: 0, rare: -1, demo: '', sleep: false, egg: 0, love: 0, ask: '', note: '', noteFix: '', noteLeft: 0, skin: 0, idle: '', idleN: 0, spark: 0, hush: 0, sig: '', sigAt: 0 }
const anim = atom(/** @type {const} */ ({ plugin: 'cachito', key: 'anim' }), ANIM0)
const PREFS0 = { hidden: false, wear: '', species: '', born: '', style: false, seed: 0, name: '', stats: /** @type {number[]} */ ([]), personality: '', hatched: 0, asked: false, cuddles: 0, cuddled: 0, voice: false, voiceAsked: false, lang: '', missing: '', chats: true, callme: '' }
const prefs = atom(/** @type {const} */ ({ plugin: 'cachito', key: 'prefs' }), PREFS0)

const DEFAULT = 0x01000000 // the terminal's own colour
const STATE = /** @type {Record<string, string>} */ ({ seedling: 'baby', healthy: 'adult', bloom: 'crown' }) // engine mood or stage -> drawing. The sad and ko drawings stay in the zoo, and nothing leads to them
/** Whether a name is an animal there is now: a shipped one, or one of a skin pack that is installed. A stored or typed name may be neither. */
const isAnimal = (/** @type {unknown} */ id) => typeof id === 'string' && Object.hasOwn(REG.species, id)
const SLEEP_MS = 5 * 60_000
// a pet is born from an egg, once: at the first start it is whole, then it rocks, then it cracks, and the animal rolled comes out
const EGG_TICKS = 16, EGG_ROCKS = 11, EGG_CRACKS = 4 // 8 s in all; the ticks left from which it rocks, and from which it is cracked
let newborn = false // this start found no pet in the store
const LOVE_TICKS = 5 // 2.5 s of hearts after a cuddle
/** A line that holds the bubble by itself for `ms`, over whatever it was saying, which comes back after. */
async function hold(/** @type {any} */ $, /** @type {string} */ say, /** @type {string} */ fix, /** @type {number} */ ms) {
  await update($, anim, a => ({ ...a, note: say, noteFix: fix, noteLeft: Math.round(ms / TICK_MS), sleep: false }))
}
const HEART = 0x2665, HEART_RED = 0xe53935
const TICK_MS = 500
const GONE_SHOW_MS = 20_000 // how long the line about a pack that is gone stays
const SKIN_MS = 20_000 // how long the row of the parts stays open after the last press
// how coins come, said the same in the shop and when one is short
const earn = (/** @type {string} */ lang) => text(lang, 'earn', { turn: RULES.coinsTurn, turns: RULES.coinTurnsDay, cuddle: RULES.coinsCuddle, cuddles: RULES.coinCuddlesDay, first: RULES.coinsFirstUse })
/** A count with its noun, one or many. */
const petted = (/** @type {string} */ lang, /** @type {number} */ n) => n === 1 ? text(lang, 'pet.once') : text(lang, 'pet.times', { n })
const count1 = (/** @type {string} */ lang, /** @type {string} */ key, /** @type {number} */ n) => text(lang, `${key}.${n === 1 ? 'one' : 'many'}`, { n })
/** The name of an animal or of a thing of the shop in a language; its own name when the language has none. */
/** What comes from a skin pack is told with the pack's name after it. */
const animalName = (/** @type {string} */ lang, /** @type {string} */ id) => { const sp = isAnimal(id) ? REG.species[id] : null; return sp?.pack ? `${sp.names[lang] ?? sp.names.en} (${sp.pack})` : text(lang, `animal.${id}`, {}, id) }
const itemName = (/** @type {string} */ lang, /** @type {{ id: string, name: string, pack?: string, names?: Record<string, string> }} */ i) => i.pack ? `${i.names?.[lang] ?? i.name} (${i.pack})` : text(lang, `item.${i.id}`, {}, i.name)
/** The animals of the installed skin packs: the person's at once, for nothing. */
const packAnimals = () => Object.keys(REG.species).filter(id => REG.species[id].pack)
/** An animal's name as it is typed, with its pack after it when it has one. */
const typed = (/** @type {string} */ id) => REG.species[id]?.pack ? `${id} (${REG.species[id].pack})` : id
/** The animals a pet can be shown as: the one it was born as (free, always its own), the ones unlocked, the ones of the installed skin packs, and the one it is shown as now, which a pet of before the prices keeps. */
const zooOf = (/** @type {string[]} */ animals, /** @type {{ born: string, species: string }} */ p) => [...new Set([p.born, ...RULES.animals.filter(id => animals.includes(id)), ...packAnimals(), p.species])].filter(isAnimal)
const partOf = (/** @type {string} */ id) => WEARABLE.find(i => i.id === id)?.slot ?? ''
// B9: the figure shown is an estimate, and says so wherever it is shown
const PRICE_NOTE = `The dollars are an estimate: the tokens are the ones each call reports, priced at Haiku 5.5's list price, and the alias ${MODEL} may lead to another model with another price.`
const STYLE_BENCH = `${BENCH}. Every run: bench/RESULTS.md in the repository.`

// the environment switches are for headless runs, where no command can be typed
const STYLE_SWITCH_UNDER = 30_000 // context tokens under which switching the style mid-chat is cheap
/** @type {boolean | undefined} */ let styleLive // what the system prompt carries now; follows the preference only when the switch is cheap
const styleOn = async (/** @type {any} */ $) => (await getPrefs($)).style || (await $.env.get('CACHITO_STYLE').catch(() => undefined)) === '1'
/** Whether the next request carries the style: the choice when a switch is cheap (no request yet, a small chat, right after a compaction), else what it carries now. */
const styleNext = (/** @type {boolean} */ want) => styleLive === undefined || ctxTokens < STYLE_SWITCH_UNDER || afterCompact ? want : styleLive
// The cachito-lean plugin (lean/ in this repository) sends the same section under the same id, on as installed. With it the style is
// in the system prompt whatever /pet lean says, and the pet must not call that `lean off`. Asked of the prompt itself, not of the
// other plugin's store: $.prompt.compose goes through every other plugin's hook, above this one or below, and not through this one.
/** @type {boolean | undefined} */ let styleOther // whether the others put the style in; undefined: not asked since the last prompt was composed
/** @type {import('claude-code').PromptComposeInput | undefined} */ let styleAsked // the last prompt composed: the same facts are asked again
let styleProbing = false // true while the pet asks what the others add: where the call comes back through this hook too (the test kit), the pet then adds nothing
async function otherStyle(/** @type {any} */ $) {
  if (styleOther === undefined) {
    styleProbing = true
    try { styleOther = (await $.prompt.compose(styleAsked)).sections.some((/** @type {any} */ s) => s.id === STYLE_ID) } catch { styleOther = false } finally { styleProbing = false }
  }
  return styleOther
}
/** Lean for the engine. Lean is the style alone: `lean` with the style really in (by the pet or by cachito-lean), `wait` with it chosen and waiting for a cheap moment. */
async function leanState(/** @type {any} */ $) {
  const style = await styleOn($), live = styleNext(style)
  if (!style && await otherStyle($)) return { lean: true, wait: false }
  return { lean: style && live, wait: style && !live }
}
/** Tells the engine where lean stands; it cheers when a waiting style gets in. */
const feedLean = async (/** @type {any} */ $) => leanState($).then(({ lean, wait }) => feed($, { type: 'lean', on: lean, wait })).catch(() => {})
// Under the bench (bench/run.mjs sets CACHITO_BENCH to a folder of its own, and nothing else does) the mod must leave the person's pet alone:
// the store is then a map in memory, never read from disk nor written to it. The lever comes from
// the arm's variable only, since the preferences read are the defaults.
/** @type {string | undefined} */ let benchDir // '' when not under the bench
/** @type {Record<string, unknown>} */ const benchStore = {}
const bench = async (/** @type {any} */ $) => benchDir ??= String((await $.env.get('CACHITO_BENCH').catch(() => '')) ?? '')
/** Reads and writes of the store: the person's, or under the bench one that lives and dies with this process. */
async function storeGet(/** @type {any} */ $, /** @type {string} */ key) {
  if (!(await bench($))) return $.store.get(key)
  return benchStore[key] === undefined ? undefined : JSON.parse(JSON.stringify(benchStore[key]))
}
async function storeSet(/** @type {any} */ $, /** @type {string} */ key, /** @type {unknown} */ value) {
  if (!(await bench($))) return $.store.set(key, value)
  benchStore[key] = JSON.parse(JSON.stringify(value))
}

/** @type {any} */ let cur = null // engine state; mirrored in $.state (reload) and $.store (next session)
let lastActive = 0
let lastOwn = 0 // the last event of this chat's own: another chat's news wakes the pet but does not count as use
// the company of other chats: each leaves a mark in the shared store (engine/company.js), read when a chat opens and every PEER_TICKS
const PEER_TICKS = 20 // 10 s
let social = false // only with a person at the prompt: a headless run leaves no mark and greets nobody
let cwd = ''
let chatId = ''
let openedAt = 0
/** @type {Record<string, number>} */ let peersSeen = {}
/** @type {Record<string, number>} */ let peersTold = {} // when each other chat was last told of
// The board of the chats ("which chat needs me"). Each chat keeps its mark under a key of its own, `chat.<id>`, and writes that key
// and no other: its folder, when its last turn started or ended, whether it ended, how long it took, when it last said it was
// alive, and since when a call of its turn has been waiting for the person's leave. Never a copy of the others' marks. The one
// object `chats` of earlier versions is still read, for the greeting, and never written again.
const chatKey = (/** @type {string} */ id) => `chat.${id}`
async function storeKeys(/** @type {any} */ $) { return (await bench($)) ? Object.keys(benchStore) : /** @type {Promise<string[]>} */ ($.store.keys()) }
async function chats(/** @type {any} */ $) {
  const old = marks(await storeGet($, 'chats').catch(() => undefined))
  const keys = (await storeKeys($).catch(() => /** @type {string[]} */ ([]))).filter(k => k.startsWith('chat.')).slice(0, 200)
  const own = Object.fromEntries(await Promise.all(keys.map(async k => [k.slice(5), await storeGet($, k).catch(() => undefined)])))
  return { ...old, ...marks(own) }
}
/** This chat's id; a new one after /clear. */
async function myId(/** @type {any} */ $) { return chatId ||= String(await $.session.id().catch(() => '') || `c${Math.random().toString(36).slice(2)}`) }
/** @type {import('../engine/company.js').Mark | null} */ let myMark = null // this chat's mark as it last wrote it
/** @type {{ id: string, at: number } | null} */ let asked = null // a tool call the agent was told to ask leave for, and since when: not started yet
let peerSaidAt = -Infinity // when this chat last told of another one
let board = '' // how many of the other chats are working, waiting or asking, as the head of the band says it; '' with none
const chatsOn = async (/** @type {any} */ $) => social && !!cwd && (await getPrefs($)).chats
/**
 * Leaves this chat's mark: the folder, now, and whether the turn ended. With the board on it also says it is alive (`beat`), so
 * the other chats count it; with the board off the mark is the least there ever was, and the others take the chat for closed.
 */
async function mark(/** @type {any} */ $, /** @type {boolean} */ done, /** @type {{ closed?: true }} */ more = {}) {
  if (!social || !cwd) return
  const at = await $.clock.now()
  asked = null
  // how long the turn that ends lasted: the other chats tell of it only when it was a long one
  myMark = { cwd, at, done, ...(done && turnAt && { took: at - turnAt }), ...((await chatsOn($)) && { beat: at }), ...more }
  await storeSet($, chatKey(await myId($)), myMark).catch(() => {})
}
/**
 * Every tick: says this chat is alive once every RULES.chatBeatMs, so that one that dies without a word is closed for the others
 * after RULES.chatDeadMs; and marks it as maybe waiting for the person's OK when a call it had to ask leave for has not started
 * after RULES.chatAskAfterMs (a classifier or a rule answers sooner than that; a dialog waits for the person).
 */
async function beat(/** @type {any} */ $) {
  if (!myMark || myMark.closed || !(await chatsOn($))) return
  const now = await $.clock.now(), stuck = asked && !myMark.done && !myMark.asking && now - asked.at >= RULES.chatAskAfterMs
  if (!stuck && now - (myMark.beat ?? 0) < RULES.chatBeatMs) return
  myMark = { ...myMark, beat: now, ...(stuck && asked && { asking: asked.at }) }
  await storeSet($, chatKey(await myId($)), myMark).catch(() => {})
}
/**
 * The board was switched: off, this chat's mark loses its sign of life at once, so the other chats take it for closed from this
 * moment and not 90 seconds later; on, it says it is alive again.
 */
async function showing(/** @type {any} */ $) {
  if (!myMark || myMark.closed) return
  const { beat: was, asking, ...rest } = myMark
  myMark = (await chatsOn($)) ? { ...rest, beat: await $.clock.now() } : rest
  await storeSet($, chatKey(await myId($)), myMark).catch(() => {})
}
/** The call that waited was answered (it started, or the turn went on): the chat is at work again. */
async function unask(/** @type {any} */ $) {
  asked = null
  if (!myMark?.asking) return
  const { asking, ...rest } = myMark
  myMark = { ...rest, beat: await $.clock.now() }
  await storeSet($, chatKey(await myId($)), myMark).catch(() => {})
}
/** At a start: the marks nobody needs any more leave the store, the ones older than RULES.marksMs and the ones past the newest RULES.marksMax. */
async function prune(/** @type {any} */ $) {
  if (!social || await bench($)) return
  const now = await $.clock.now(), keys = (await storeKeys($).catch(() => /** @type {string[]} */ ([]))).filter(k => k.startsWith('chat.'))
  const all = marks(Object.fromEntries(await Promise.all(keys.map(async k => [k, await storeGet($, k).catch(() => undefined)]))))
  const newest = Object.entries(all).sort((a, b) => Math.max(b[1].at, b[1].beat ?? 0) - Math.max(a[1].at, a[1].beat ?? 0))
  for (const [k, m] of newest.slice(0, 200)) if (newest.findIndex(x => x[0] === k) >= RULES.marksMax || now - Math.max(m.at, Math.min(m.beat ?? 0, now)) > RULES.marksMs) await $.store.delete(k).catch(() => {})
}
/** The greeting of a chat that opens, chosen from the marks. */
async function greet(/** @type {any} */ $) {
  if (!social || !cwd) return
  const now = openedAt = await $.clock.now()
  // Once in a pet's life the greeting says, under its own line, that who had the old /buddy can bring its name and character back
  // with /pet adopt. Nothing is read to say it: the person's config holds their account and the secrets of their MCP servers, and
  // is opened only when they run /pet adopt
  const hint = !(await getPrefs($)).asked
  const hello = greeting(await chats($), { id: await myId($), cwd, now })
  // the diary notes the chat that opens, and may have a memory to say: at most one a day, in place of a plain greeting. A greeting
  // with something to press, or with the gift of a return, is said as it is, and the memory waits for another opening
  const plain = hello.kind === 'first' || hello.kind === 'seen' || hello.kind === 'new'
  const mem = await diaryOpen($, now, plain && !newborn).catch(() => '')
  // said now: once marked, nothing is written at a chat's opening. With a store that cannot be read nothing is said that could not be marked as said
  if (hint && !mem && !(await setPrefs($, { asked: true }))) return
  await feed($, mem ? { type: 'voice', text: mem, why: 'memory' } : { type: 'greet', ...hello, ...(hint && { buddy: true }) })
}
// The diary (engine/diary.js): written here by the mod itself, in the store, with times, counts and folder names only. Kept with a
// person at the prompt and never under the bench: a headless run and a bench run leave no line.
const diaryOn = async (/** @type {any} */ $) => social && !(await bench($))
/** The diary in the store, whole; null when it is not kept here or the store cannot be read (then nothing is written over it). */
async function diaryGet(/** @type {any} */ $) {
  if (!(await diaryOn($))) return null
  const none = {}, raw = await storeGet($, 'diary').catch(() => none)
  return raw === none ? null : diaryOf(raw)
}
/** Writes what `change` makes of the diary. (No atomic update: two chats writing in the same instant can lose one line.) */
async function diaryDo(/** @type {any} */ $, /** @type {(d: import('../engine/diary.js').Diary, now: number) => import('../engine/diary.js').Diary} */ change) {
  const d = await diaryGet($)
  if (d) await storeSet($, 'diary', change(d, await $.clock.now())).catch(() => {})
}
/** A chat opens: the diary counts it, and gives the memory to say now, in the pet's language and character, or '' when there is none or `tell` is false. */
async function diaryOpen(/** @type {any} */ $, /** @type {number} */ now, /** @type {boolean} */ tell) {
  const was = await diaryGet($)
  if (!was) return ''
  const at = { now, folder: folder(cwd) }, p = await getPrefs($)
  let d = diaryOpened(was, { ...at, born: newborn })
  const m = tell ? memory(d, at) : null
  if (m) d = told(d, m.kind, now)
  await storeSet($, 'diary', d).catch(() => {})
  return m ? saying(m, p.lang, STATS.indexOf(speaker(p.stats, cur?.turn ?? 0))) : ''
}
/** The two or three lines of the diary that bear on this moment, in English, for the small model; none when there is no diary here. */
async function diaryMemories(/** @type {any} */ $) {
  const d = await diaryGet($).catch(() => null)
  return d ? memories(d, { now: await $.clock.now(), folder: folder(cwd) }) : []
}
/**
 * /pet say: the person speaks to the pet, and the pet answers in its bubble with one line of its own. With the comments on the text
 * goes to the small model with the pet's character, language and memories: a request of its own, not a turn of the chat, counted in
 * the day's cap like any comment. The pet does no work and gives no advice (engine/voice.js `system`). With the comments off, or when
 * no usable line comes back, it says a fixed line in its character; at the cap that line says the comments are finished for today
 * and come back tomorrow. Nothing of what was written is kept anywhere.
 */
async function sayTo(/** @type {any} */ $, /** @type {string} */ said) {
  const p = await getPrefs($), L = p.lang
  if (!cur) await load($)
  const who = STATS.indexOf(speaker(p.stats, cur?.turn ?? 0))
  const show = (/** @type {string} */ say, fix = '') => hold($, say, fix, RULES.sayShowMs)
  lastActive = await $.clock.now()
  if (!said.trim()) return $.ui.toast(text(L, 'say.usage'))
  if (!(await voiceOn($))) return show(voicedAs(L, 'say.off', who), text(L, 'say.off.fix'))
  const r = await askLine($, 'say', { talk: true }, async t => reply({ said, last: t.last, lang: L, memories: await diaryMemories($) }))
  await show(r.line || voicedAs(L, r.stop === 'cap' ? 'say.cap' : 'say.lost', who))
}
/**
 * One request to the small model for one line, the only place a call is made. None goes out when the comments are off or the band
 * is hidden (`voiceOn`), while another call is out, when the store cannot be read or written (the cap could not be held), at the
 * day's cap, within the wait of that reason, or, for a line nobody asked for, while the person types.
 * The line is counted in the day and timed in the store BEFORE the call (engine/voice.js `reserve`): two chats, or a slow call,
 * cannot pass the cap or the wait together, and a call that fails or runs out of time stays counted. What it used is added after.
 * `stop` says why no call was made; `line` is the reply made fit to show, '' when there is none.
 */
async function askLine(/** @type {any} */ $, /** @type {import('../engine/voice.js').Why} */ why, /** @type {{ talk?: boolean }} */ sys, /** @type {(t: import('../engine/voice.js').Tally) => string | Promise<string>} */ prompt) {
  const none = (/** @type {string} */ stop) => ({ asked: false, line: '', stop })
  if (speaking || !(await voiceOn($))) return none('off')
  const t = await voiceTally($), now = await $.clock.now()
  if (!t) return none('lost')
  const stop = due(t, why, now)
  if (stop) return none(stop)
  if (why !== 'say' && await typing($)) return none('typing')
  speaking = true
  try {
    if (!(await storeSet($, 'voice', reserve(t, why, now)).then(() => true, () => false))) return none('lost')
    const p = await getPrefs($)
    const r = await $.model.complete({ model: MODEL, system: system({ name: p.name, animal: p.species, stats: p.stats, lang: p.lang, person: p.callme, ...sys }), prompt: await prompt(t), maxTokens: RULES.voiceMaxTokens, effort: 'low', timeoutMs: RULES.voiceTimeoutMs }).catch(() => null)
    const line = r?.isAnswered ? clean(r.text) : ''
    // added over the store as it is now: another chat may have spoken meanwhile
    const after = await voiceTally($)
    if (after && r) await storeSet($, 'voice', settled(after, r.usage, { long: !!r.isAnswered && tooLong(r.text), path: !!r.isAnswered && !tooLong(r.text) && pathy(r.text), line })).catch(() => {})
    return { asked: true, line, stop: '' }
  } finally { speaking = false }
}
/**
 * The person's skin packs: the .json files of ~/.claude/cachito-skins (or of the config folder Claude Code was given), in the order
 * of their names. Each is data, checked whole by engine/skins.js before any of it is used; one that is not sound is left out and
 * told by /pet skins. No folder, no packs, and nothing here can fail: the band is drawn all the same. Under the bench none is read.
 */
async function configDir(/** @type {any} */ $, /** @type {string} */ folder) {
  const config = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  const home = (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined))
  return config ? `${config}/${folder}` : home ? `${home}/.claude/${folder}` : ''
}
const skinsDir = (/** @type {any} */ $) => configDir($, 'cachito-skins')
async function readPacks(/** @type {any} */ $) {
  const dir = (await bench($)) ? '' : await skinsDir($)
  const found = /** @type {{ name: string, kind: string, size: number }[]} */ (dir ? await $.fs.list(dir).catch(() => []) : [])
  /** @type {{ file: string, text?: string, error?: string }[]} */ const files = []
  for (const f of found.filter(f => f.name.endsWith('.json')).sort((a, b) => a.name < b.name ? -1 : 1).slice(0, SKIN_LIMITS.packs + 1)) {
    if (f.kind !== 'file') files.push({ file: f.name, error: 'not a regular file (a link is not followed)' })
    else if (f.size > SKIN_LIMITS.bytes) files.push({ file: f.name, error: `larger than ${SKIN_LIMITS.bytes / 1024} KiB` })
    else files.push(await $.fs.read(`${dir}/${f.name}`).then((/** @type {unknown} */ t) => ({ file: f.name, text: String(t) }), () => ({ file: f.name, error: 'could not be read' })))
  }
  install(files)
}
/** @type {Promise<void> | null} */ let packsRead = null
/** The packs, read once a start; `again` reads the folder anew (/pet skins, a reload). Every reader of the animals waits for it. */
const packs = (/** @type {any} */ $, again = false) => packsRead && !again ? packsRead : packsRead = readPacks($).catch(() => { try { install([]) } catch { /* the shipped drawings stay */ } })
/** After the packs are read: an animal whose pack came back is the pet's again, one whose pack went is put aside, here and in the store. */
async function settle(/** @type {any} */ $) {
  const { raw, lost, ...p } = await storedPrefs($)
  if (lost || !raw) return
  await update($, prefs, () => p)
  await fill($, p, raw)
}
let farewell = '', farewellSaid = '' // the animal of a pack that is gone: said once, gently, by the tick
/**
 * Where `node` is, as an absolute path, for the receipt: looked for in the absolute folders of the PATH Claude Code was started
 * with, in their order. A relative entry, an empty one (the working folder), and a folder inside the project are passed over,
 * so a `node` someone left in the repository is never the one run. '' when there is none.
 */
async function nodePath(/** @type {any} */ $) {
  const path = String((await $.env.get('PATH').catch(() => '')) ?? ''), win = /^[A-Za-z]:[\\/]/.test(path) || path.includes(';')
  const here = cwd.replace(/[\\/]+$/, '')
  for (const dir of path.split(win ? ';' : ':')) {
    const d = dir.replace(/[\\/]+$/, '')
    if (!(win ? /^[A-Za-z]:[\\/]/ : /^\//).test(dir) || (here && (d === here || d.startsWith(`${here}/`) || d.startsWith(`${here}\\`)))) continue
    for (const name of win ? ['node.exe'] : ['node']) {
      const file = `${d}${win ? '\\' : '/'}${name}`
      if ((await $.fs.stat(file).catch(() => null))?.kind === 'file') return file
    }
  }
  return ''
}
/**
 * The old /buddy companion kept in the person's ~/.claude.json: null when there is none, undefined when the file cannot be read.
 * Called by /pet adopt and by nothing else: the file is read whole at that moment (it also holds the person's account and the
 * secrets of their MCP servers), three fields of it are kept (name, personality, hatching time: engine/persona.js `buddy`), the
 * rest is dropped at once, and nothing is ever written to that file.
 */
async function oldBuddy(/** @type {any} */ $) {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)) || (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined))
  if (!dir) return undefined
  return $.fs.read(`${dir}/.claude.json`).then((/** @type {unknown} */ text) => buddy(String(text)), () => undefined)
}
/**
 * Looks at the other chats: how many are working, waiting or asking goes beside the name; one that ended a long turn, or may be
 * waiting for the person's OK, is told to the engine once. Never about this chat itself. Nothing with the board off.
 */
async function peers(/** @type {any} */ $) {
  const now = await $.clock.now()
  if (!social || !cwd) return
  const p = await getPrefs($), all = p.chats ? await chats($) : {}, id = await myId($), n = counts(all, id, now)
  const said = /** @type {const} */ (['working', 'waiting', 'asking']).flatMap(k => n[k] ? [text(p.lang, `chats.${k}`, { n: n[k] })] : []).join(' · ')
  if (said !== board) { board = said; await update($, anim, a => ({ ...a, hush: a.hush + 1 })) } // drawn again with the new count
  if (!p.chats || now - lastOwn > RULES.peerActiveMs) return
  const r = finished(all, peersSeen, { id, cwd, since: openedAt, now, told: peersTold })
  // a turn that ended while another piece of news is still fresh is not lost: it is looked at again, and told when the wait is over
  if (r.peer && !r.peer.ask && now - peerSaidAt < RULES.peerGapMs) return
  peersSeen = r.seen
  peersTold = r.told
  if (!r.peer) return
  const peer = r.peer
  peerSaidAt = now
  await feed($, { type: 'peer', ...peer })
  // said: with the comments on the small model says the same in the pet's character, and its line takes the place of the fixed one. Not awaited: the drawing goes on
  const on = view(cur, now).talk
  if (on?.kind === 'peer' && on.name === peer.name) peerLine($, peer).then(line => line ? feed($, { type: 'peer', ...peer, said: line }) : undefined).catch(() => {})
}
/**
 * The news of another chat as the small model says it, in the pet's character, when the comments are on: '' when they are off, the
 * day's cap is reached, the person is typing, or the call fails or says nothing usable. Then the fixed line is said. What is sent is
 * the folder's name, how long the turn took and how long ago it ended: nothing of that chat's content.
 */
async function peerLine(/** @type {any} */ $, /** @type {{ here: boolean, name: string, ago: number, took: number, ask: boolean }} */ peer) {
  const lang = (await getPrefs($)).lang
  return (await askLine($, 'peer', {}, t => news({ ...peer, last: t.last, lang }))).line
}
// The voice. What the main agent did in the running turn, as counts and names only: tools by name, failed commands by program name
// (never their arguments), the files changed (kept as a set to count them: no path leaves this module).
// The names are from outside (a tool of an MCP server, a program): the objects that count them have no prototype, so no name is ever one of an object's own (`__proto__`, `constructor`)
const TURN0 = () => ({ tools: /** @type {Record<string, number>} */ (Object.create(null)), failed: /** @type {Record<string, number>} */ (Object.create(null)), files: /** @type {Record<string, true>} */ (Object.create(null)) })
let turnInfo = TURN0()
let turnAt = 0 // when the running turn of the main thread began; 0 between turns
let midAt = 0 // when a comment was last asked for during a turn
let turnSaid = '' // the end of what the assistant wrote last in the running turn; '' while it wrote nothing yet
let speaking = false // one call at a time
/** @type {{ text: string, why: string } | null} */ let heldLine = null // a line that came while the person was typing: shown when the box is empty
const typing = async (/** @type {any} */ $) => !!String((await $.prompt.read().catch(() => null))?.text ?? '').trim()
/** Whether the comments are the person's choice here: chosen, with a person at the prompt, and never under the bench. */
const voiceChosen = async (/** @type {any} */ $) => social && !(await bench($)) && (await getPrefs($)).voice
/** Whether a line may be asked for now: chosen, and the band is shown. A hidden band shows no line, so none is paid for. */
const voiceOn = async (/** @type {any} */ $) => (await voiceChosen($)) && !(await getPrefs($)).hidden
/** The count of lines and cost in the store, whole; null when the store cannot be read (then nothing is asked: the cap could not be held). */
async function voiceTally(/** @type {any} */ $) {
  const none = {}, raw = await storeGet($, 'voice').catch(() => none)
  return raw === none ? null : tally(raw, await $.clock.now())
}
/**
 * The voice is the person's choice, asked for once in a pet's life: right after the hatching, or at the first start of this version for
 * a pet born before. The question holds the bubble, with its two buttons, until it is answered or the next prompt is sent; it is
 * marked as asked when it comes up, so no later chat asks again, and unanswered the voice stays off (/pet comments on is always there).
 * Never under the bench nor without a person at the prompt, and not for who already turned the voice on. A chat whose greeting
 * offers the old /buddy leaves the question to the next start.
 */
async function askVoice(/** @type {any} */ $) {
  if (!social || await bench($)) return
  const p = await getPrefs($)
  if (p.voiceAsked || p.hidden || (await storedPrefs($)).lost) return // nor while the store cannot be read: the answer could not be kept; with the band hidden nobody would see the question: it is asked when the band is back, not marked as asked
  await setPrefs($, { voiceAsked: true })
  if (p.voice) return
  const t = (await voiceTally($)) ?? tally(undefined, await $.clock.now())
  await update($, anim, a => ({ ...a, ask: question(RULES.voiceCapDay * average(t).usd, p.lang) }))
}
/** The answer, from a button of the question or from /pet comments on|off: kept in the preferences, and the question goes. */
async function setVoice(/** @type {any} */ $, /** @type {boolean} */ on) {
  await setPrefs($, { voice: on, voiceAsked: true })
  if ((await heldAnim($)).ask) await update($, anim, a => ({ ...a, ask: '' }))
}
async function answerVoice(/** @type {any} */ $, /** @type {boolean} */ on) {
  await setVoice($, on)
  await $.ui.toast(text((await getPrefs($)).lang, on ? 'toast.comments.on' : 'toast.comments.off'))
}
/**
 * Asks the small model for one line and shows it. Never awaited by a hook: the turn and the prompt go on meanwhile. Silent, with the
 * fixed line left where it is, when the voice is off, the day's cap is reached, the wait since the last line is not over, the person
 * is typing, or the call fails, says nothing usable, or takes over RULES.voiceTimeoutMs. Under a recap or the outline offer the
 * line is shown as the last line of the bubble (the engine keeps it with them). The line about a cuddle holds the bubble by itself for
 * RULES.cuddleShowMs and then goes. `minutes` is how long the turn has lasted, for a line during it. True when the model was asked.
 */
async function speak(/** @type {any} */ $, /** @type {import('../engine/voice.js').Why} */ why, /** @type {{ tools: Record<string, number>, failed: Record<string, number>, files: Record<string, true> }} */ turn, answer = '', minutes = 0) {
  if (!cur) return false
  const lang = (await getPrefs($)).lang
  const r = await askLine($, why, {}, async t => summary({ why, tools: turn.tools, failed: turn.failed, files: Object.keys(turn.files).length, answer, minutes, last: t.last, lang, memories: await diaryMemories($) }))
  const text = r.line
  if (!text) return r.asked
  if (why === 'cuddle') { if (!(await typing($))) await hold($, text, '', RULES.cuddleShowMs) } // it takes the place of the fixed line, and the time starts again
  else if (await typing($)) heldLine = { text, why }
  else { heldLine = null; await feed($, { type: 'voice', text, why }) }
  return true
}
/**
 * A turn that lasts: a long job of the agent is one turn, and the person waits through it. Once it has run for RULES.voiceGapMs the
 * pet may say a line about it so far (the tools used, the files changed, how long it has lasted, and what the assistant wrote last
 * when it wrote anything), then again no sooner than RULES.voiceGapMs later: the wait and the day's cap are the ones of the lines at the
 * end of a turn (engine/voice.js `due`), so over every chat there is at most one such line in that time. Looked at every PEER_TICKS.
 */
async function midTurn(/** @type {any} */ $) {
  const now = await $.clock.now()
  if (!turnAt || now - Math.max(turnAt, midAt) < RULES.voiceGapMs) return
  const was = midAt
  midAt = now // before the call: a second look while this one is out asks nothing
  if (!(await speak($, 'long', turnInfo, turnSaid, (now - turnAt) / 60_000))) midAt = was
}
let light = false
let windowTokens = 0 // the model's context window; known after the first turn
let ctxTokens = 0 // what the last request of the main thread was answered over
let afterCompact = false
let costUsd = /** @type {number | undefined} */ (undefined) // what the session cost so far, as /cost
let ticks = 0
// the life of a calm pet. Its chances come from the pet's own seed, not from Math.random: the same pet moves the same way from a start
const IDLE_GAP_MS = /** @type {[number, number]} */ ([8_000, 20_000]) // between two gestures: never more than one in this time
const SPARK_GAP_MS = /** @type {[number, number]} */ ([5_000, 13_000]) // between two sparkles of a golden coat
const SPARK_TICKS = 2 // a sparkle is lit for a second
let rng = 0, idleAt = 0, sparkAt = 0, sparkLeft = 0
const rnd = () => { rng = rng + 0x6d2b79f5 | 0; let t = Math.imul(rng ^ rng >>> 15, 1 | rng); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const between = (/** @type {[number, number]} */ [lo, hi]) => lo + Math.floor(rnd() * (hi - lo))
// the speech bubble is not always there: a phrase stays BUBBLE_MS, longer when it is long or has a button of its own, never over
// BUBBLE_MAX_MS; then only the pet is left, with its name, its stars and its own buttons, until there is something new to say
const BUBBLE_MS = 12_000, BUBBLE_MAX_MS = 30_000, BUBBLE_KEY_MS = 8_000, BUBBLE_COLS = 40, BUBBLE_COL_MS = 150 // 150 ms more for each column over 40, 8 s more with a button
const showFor = (/** @type {number} */ width, /** @type {boolean} */ keys) => Math.min(BUBBLE_MAX_MS, BUBBLE_MS + Math.max(0, width - BUBBLE_COLS) * BUBBLE_COL_MS + (keys ? BUBBLE_KEY_MS : 0))
let bubbleSig = '', bubbleAt = 0, bubbleUntil = 0, bubbleOpen = false
let lastMood = ''
let rareShown = false
/** @type {string[]} */ let demoQueue = [] // moods /pet demo still has to show
const DEMO = ['egg', 'seedling', 'healthy', 'bloom', 'cheer', 'dizzy', 'stomach', 'loop', 'bloated', 'sleep']
const DEMO_TICKS = 10 // 5 s per mood
let demoLeft = 0 // ticks left of the mood the demo shows now
const SAMPLE = /** @type {Record<string, string>} */ ({ dizzy: 'src/app.js', loop: 'npm', bloated: '91', stomach: 'tools_changed' })

/** The view /pet demo forces: one mood with a sample issue or cheer, so every sprite can be seen. */
function demoView(/** @type {ReturnType<typeof view>} */ v, /** @type {string} */ mood) {
  const issue = SAMPLE[mood] ? /** @type {any} */ ({ kind: mood, detail: SAMPLE[mood] }) : null
  const cheer = mood === 'cheer' ? /** @type {any} */ ({ kind: 'evolve', value: 0 }) : null
  return { ...v, mood: mood === 'sleep' ? 'healthy' : mood, issue, cheer, animate: true, talk: null, calm: false }
}

const hex = (/** @type {string} */ c) => parseInt(c.slice(1), 16)

const PALE = 175 // a colour whose every channel is over this is white or nearly: it gets the outline on a light theme
const RIM = 0.6 // how dark the outline is, as a share of the colour
const BRIGHT = 190 // ...and so does a colour brighter than this (luma, 0-255) with a dark channel: the chick's yellow, the axolotl's pink
const pale = (/** @type {number} */ h) => Math.min(h >> 16, h >> 8 & 255, h & 255) > PALE || 0.299 * (h >> 16) + 0.587 * (h >> 8 & 255) + 0.114 * (h & 255) > BRIGHT

/** Pixel rows to Raster cells: two pixel rows per text row, drawn with half blocks. */
function cells(/** @type {string[]} */ rows, /** @type {Record<string, string>} */ pal, love = 0, /** @type {{ of: Set<number>, to: number } | null} */ edge = null) {
  const out = []
  const hue = (/** @type {number} */ r, /** @type {number} */ c) => { const ch = rows[r]?.[c], h = ch === undefined || ch === '.' ? undefined : pal[ch]; return h ? hex(h) : null }
  // on a light theme white and what is as pale or as bright would vanish: where such a pixel touches the background it is darkened, a thin outline.
  // A colour of a coat takes the coat's own darkest colour there (`edge`): gold darkened turns to mud
  const color = (/** @type {number} */ r, /** @type {number} */ c) => {
    const h = hue(r, c)
    if (h === null || !light || !pale(h)) return h
    if (hue(r - 1, c) !== null && hue(r + 1, c) !== null && hue(r, c - 1) !== null && hue(r, c + 1) !== null) return h
    return edge?.of.has(h) ? edge.to : Math.round((h >> 16) * RIM) << 16 | Math.round((h >> 8 & 255) * RIM) << 8 | Math.round((h & 255) * RIM)
  }
  for (let r = 0; r < rows.length; r += 2) {
    const upper = rows[r] ?? '' // frames have an even number of rows
    for (let c = 0; c < upper.length; c++) {
      const top = color(r, c), bottom = color(r + 1, c)
      // after a cuddle two hearts rise along the edges, a text row a tick, drawn only where the frame is empty
      const heart = love > 0 && (c === 0 ? r / 2 === love - 1 : c === upper.length - 1 && r / 2 === love + 1)
      if (top === null && bottom === null) out.push(heart ? HEART : 0x20, heart ? HEART_RED : DEFAULT, DEFAULT)
      else if (top === null) out.push(0x2584, bottom, DEFAULT) // ▄
      else out.push(0x2580, top, bottom ?? DEFAULT) // ▀
    }
  }
  // the mod host has toBase64; the es2023 lib the plugin types pin does not declare it yet
  return /** @type {Uint8Array & { toBase64(): string }} */ (new Uint8Array(Uint32Array.from(out).buffer)).toBase64()
}

/** The animal drawn, by a name there is; and the one a new pet is born as: weighted, so the rare ones stay rare. An animal of a skin pack is never rolled. */
const animalOf = (/** @type {string} */ name) => isAnimal(name) ? name : 'penguin'
function species(/** @type {string} */ name) { return REG.species[animalOf(name)] }
const roll = () => rollOf(REG.species, Math.random()) ?? 'penguin'

/** Which drawing shows a view: asleep, or the mood. */
function stateName(/** @type {ReturnType<typeof view>} */ v, /** @type {{sleep: boolean, demo: string}} */ a) {
  if (a.demo ? a.demo === 'sleep' : a.sleep) return 'sleep' // the demo decides: a pet asleep still shows every mood of the row
  return STATE[v.mood] ?? v.mood
}

/** What is drawn for a view: the animal, the name of its state, what it has on and the drawings of that state. */
function drawn(/** @type {ReturnType<typeof view>} */ v, /** @type {{demo: string, sleep: boolean}} */ a, /** @type {{wear: string, species: string}} */ p) {
  const sp = species(p.species)
  const name = stateName(v, a)
  // the crown is a thing of the head, drawn as a state of its own: a grown pet with a hat on, or with its head left bare, is drawn
  // as the adult. /pet demo shows the crown whatever is on
  const worn = wornOf(v.closet, p.wear)
  const st = sp.states[name === 'crown' && a.demo !== 'bloom' && !worn.includes('crown') ? 'adult' : name] ?? sp.states.adult
  return { sp, name, worn, st }
}

/** Sprite for a view. Frames come in two heights, and an item on the ground widens them, so the Raster key carries the size. */
function sprite(/** @type {ReturnType<typeof view>} */ v, /** @type {{n: number, rare: number, demo: string, sleep: boolean, egg: number, love: number, idle: string, idleN: number, spark: number}} */ a, /** @type {{wear: string, species: string}} */ p) {
  const { sp, name, worn, st } = drawn(v, a, p)
  const wear = worn.filter(id => id !== 'crown' && partOf(id) !== GOLDEN.slot && !(a.demo === 'bloom' && partOf(id) === 'head'))
  if (a.egg > 0) { // not an animal yet: whole, then rocking, then cracked
    const rows = /** @type {string[]} */ (zoo.egg.frames[a.egg > EGG_ROCKS ? 0 : a.egg > EGG_CRACKS ? 1 + a.n % 2 : 3])
    return { key: `pet-${rows.length}`, columns: /** @type {string} */ (rows[0]).length, rows: rows.length / 2, cells: cells(rows, { ...zoo.egg.palette, ...(light ? zoo.light : null) }) }
  }
  const i = v.animate || name === 'sleep' ? a.n % st.frames.length : 0, rare = a.rare >= 0 && st.rare.length > 0
  // a calm pet's small gesture (a look aside, a flick of the ears, a hop): a few frames of its own, each with where the body sits
  const move = !rare && !a.demo && a.idle ? st.idle?.[a.idle] : undefined, k = move ? Math.min(a.idleN, move.frames.length - 1) : 0
  let rows = rare ? st.rare[0] : move ? move.frames[k] : st.frames[i]
  // the items are drawn over every stage and under every bubble, one over the other from the ground up to the head; asleep the pet is curled up and wears nothing (no `at`): its frame is as wide all the same
  const at = move ? move.at[k] ?? move.at[0] : st.at?.[rare ? 0 : i] ?? st.at?.[0]
  // a coat is colours, not a drawing: it tints the body on every animal, stage and state, asleep too. Awake the golden one has
  // a glint of two pale pixels on it, and now and then a sparkle or two light up next to it
  const body = name === 'baby' ? 'baby' : 'adult', coatId = worn.find(id => partOf(id) === GOLDEN.slot)
  const coat = coatId ? coatOf(coatId, animalOf(p.species)) : null
  const gold = coatId === GOLDEN.id && at ? /** @type {{ shine: [number, number][], spark: [number, number][] } | undefined} */ (sp.gold[body]) : null
  const glint = gold ? [...gold.shine.map(([r, c]) => /** @type {[number, number, string]} */ ([r, c, 'x'])), ...gold.spark.filter((_, n) => a.spark >> n & 1).map(([r, c]) => /** @type {[number, number, string]} */ ([r, c, 'y']))] : []
  rows = dressed(rows, at, wear, glint, animalOf(p.species), body)
  const pal = { ...sp.palette, ...coat?.palette, ...(st.tint ? sp.tints[st.tint] : null), ...(light ? zoo.light : null) }
  const edge = coat && light ? { of: new Set(Object.values(coat.palette).map(hex)), to: hex(coat.edge) } : null
  return { key: `pet-${rows[0].length}x${rows.length}`, columns: rows[0].length, rows: rows.length / 2, cells: cells(rows, pal, a.love, edge) }
}

/** A text cut to the columns there are; one that fits is left as it is. */
const cut = (/** @type {string} */ t, /** @type {number} */ max) => cols(t) <= max ? t : tidy(t, max)
const BUBBLE_MIN = 14 // under this many columns of text there is no bubble: the pet alone
const BUBBLE_MAX = 44 // columns of text in the speech bubble before it wraps: columns on screen, where a Chinese character takes two
const PET_ROWS = 6 // the tallest frame with nothing under the feet (14x12 pixels), in text rows


const hearts = (/** @type {number} */ n) => '♥'.repeat(n).padEnd(5, '♡') // affection: they fill and never empty

// $.state outlives a reload of the mod, so what it holds may have been written by any earlier version. These three are the only
// readers of it: each gives a value whole for this version, or says there is none, and no drawing or command meets an absent field.
/** The chat's engine state, made whole (engine.js `whole`); null when the session holds none. */
const heldPet = async (/** @type {any} */ $) => { const held = await read($, pet); return held ? whole(held) : null }
/** The animation's state: a field an earlier version did not have reads as at rest. */
const heldAnim = async (/** @type {any} */ $) => { const a = /** @type {any} */ (await read($, anim)); return /** @type {typeof ANIM0} */ (Object.fromEntries(Object.entries(ANIM0).map(([k, v]) => [k, typeof a?.[k] === typeof v ? a[k] : v]))) }
/** The preferences the session holds, when every field of this version is there and sound; else null, and the caller takes them from the store (storedPrefs makes those whole). */
async function heldPrefs(/** @type {any} */ $) {
  await packs($)
  const now = /** @type {any} */ (await read($, prefs))
  const sound = now && Object.entries(PREFS0).every(([k, v]) => Array.isArray(v) ? Array.isArray(now[k]) : typeof now[k] === typeof v)
  return sound && isAnimal(now.species) && isAnimal(now.born) && now.seed && asStats(now.stats) ? /** @type {typeof PREFS0} */ (now) : null
}

/** Feeds one event to the engine; the write redraws the band. */
async function feed(/** @type {any} */ $, /** @type {any} */ e) {
  if (!cur) await load($)
  lastActive = await $.clock.now()
  if (e.type !== 'peer') lastOwn = lastActive
  cur = reduce(cur, { ...e, t: lastActive })
  await update($, pet, () => cur)
  if ((await heldAnim($)).sleep) await update($, anim, a => ({ ...a, sleep: false }))
}
/**
 * The preferences, the only way to read them. $.state is the session's: after /clear it reads as the initial again while this module
 * and $.store live on, so a read that finds no animal, no seed or no statistics (also after a reload from a version that had none) refills it from the store.
 * A store that cannot be read gives this moment's answer and nothing is kept: the next read asks again.
 */
async function getPrefs(/** @type {any} */ $) {
  const now = await heldPrefs($)
  if (now) return now
  const { raw, lost, ...p } = await storedPrefs($)
  if (lost) return p
  if (!raw) newborn = true
  await update($, prefs, () => p)
  await fill($, p, raw)
  return p
}
// How the preferences are kept. Each one has a key of its own in the store, `pref.<name>`, and a chat writes only the key of what
// the person changed in it: never a copy of them all, which would put the choices this chat last saw over the ones made meanwhile
// in another chat. Earlier versions kept them all in one object under `prefs`, written whole at every change: it is still read, for
// what has no key of its own yet, and never written again, so a chat still running such a version cannot undo a choice made here.
const prefKey = (/** @type {string} */ name) => `pref.${name}`
const BORN = ['species', 'born', 'missing', 'seed', 'name', 'stats', 'lang'] // what makes the pet this pet: a store without one of them gets it at the first read
/** Writes what the store lacks and nothing else: the fields a pet is born with, or all of them when the store holds no preference at all. */
async function fill(/** @type {any} */ $, /** @type {Record<string, unknown>} */ p, /** @type {any} */ raw) {
  const packless = await bench($) // under the bench no pack is read: an animal that seems gone is not, and the store keeps it
  for (const name of raw ? BORN : Object.keys(PREFS0)) {
    if (raw && (name === 'stats' ? asStats(raw.stats) : raw[name] === p[name] || (name === 'missing' && !raw.missing === !p.missing))) continue
    if (raw && packless && ['species', 'born', 'missing'].includes(name)) continue
    await storeSet($, prefKey(name), p[name]).catch(() => {})
  }
}
/** What $.store holds, made whole; writes nothing, so the drawing, which may not write, can fall back on it. `raw` is what was stored,
 * undefined when nothing was; `lost` says the store could not be read: what comes back is then no ground to write anything from.
 * A `budget` kept by an earlier version is not carried over: that lever is gone. */
async function storedPrefs(/** @type {any} */ $) {
  await packs($)
  const none = {}, names = Object.keys(PREFS0)
  const [old, ...own] = await Promise.all([storeGet($, 'prefs'), ...names.map(name => storeGet($, prefKey(name)))].map(got => got.catch(() => none)))
  const lost = old === none || own.includes(none)
  const mine = Object.fromEntries(names.flatMap((name, i) => own[i] === undefined || own[i] === none ? [] : [[name, own[i]]]))
  const raw = /** @type {any} */ (lost || (!(old && typeof old === 'object') && !Object.keys(mine).length) ? undefined : { ...(old && typeof old === 'object' ? old : null), ...mine })
  // An animal of a skin pack that is not installed now (the pack was taken away, or broke): the pet goes back to the animal it was
  // born as, and the one it was is kept in `missing`, so it is that animal again as soon as the pack is back. Nothing is lost.
  const back = isAnimal(raw?.missing) ? String(raw.missing) : ''
  const gone = !back && typeof raw?.species === 'string' && /^[a-z][a-z0-9-]{1,23}$/.test(raw.species) && !isAnimal(raw.species) ? String(raw.species) : ''
  const born = back || (isAnimal(raw?.species) ? raw.species : isAnimal(raw?.born) ? raw.born : roll())
  if (gone && gone !== farewellSaid && !(await bench($))) farewell = gone
  // the name and the character come from a seed kept with the pet; a name the person gave, or an adopted one, stands over it
  const seed = Number.isInteger(raw?.seed) && raw.seed > 0 ? raw.seed : newSeed() || 1, own1 = bornAs(seed)
  // a pet born with the two traits of an earlier version has no statistics yet: the traits give them, once, and are not kept
  const old1 = asTrait(raw?.trait)
  const stats = asStats(raw?.stats) ?? (old1 ? statsOf(seed, old1, asTrait(raw?.trait2)) : own1.stats)
  const who = { seed, name: cleanName(raw?.name) || own1.name, stats, personality: tidy(raw?.personality, 120), hatched: Number(raw?.hatched) || 0, asked: !!raw?.asked, callme: cleanCall(raw?.callme) } // `callme`: what the person typed after /pet call me, and nothing read from anywhere else
  // cuddles: how many and when the last one was, for the card. What they earn is the engine's to count
  const cuddles = Math.max(0, Math.floor(Number(raw?.cuddles) || 0)), cuddled = Number(raw?.cuddled) || 0
  // the language: the one chosen; a newborn takes the system's when it is one of ours (LC_ALL before LANG); a pet born before the languages keeps English
  const lang = asLang(raw?.lang) ?? (raw ? 'en' : fromLocale(await $.env.get('LC_ALL').catch(() => undefined), await $.env.get('LANG').catch(() => undefined)))
  return { raw, lost, ...who, hidden: !!raw?.hidden, wear: String(raw?.wear ?? ''), species: /** @type {string} */ (born), born: /** @type {string} */ (isAnimal(raw?.born) ? raw.born : born), style: !!raw?.style, cuddles, cuddled, voice: !!raw?.voice, voiceAsked: !!raw?.voiceAsked, lang, chats: raw?.chats !== false, missing: back ? '' : gone || (typeof raw?.missing === 'string' ? raw.missing : '') }
}
/**
 * Changes the preferences and keeps them for the next session. Only the fields of `patch` are written, each under its own key: every
 * other choice stays as the store has it, whatever this chat last saw of it, and this chat's copy is brought up to the store's.
 * (A store that lost them all gets this chat's back, see `fill`.)
 */
let dietDropped = false
async function setPrefs(/** @type {any} */ $, /** @type {Partial<typeof PREFS0>} */ patch) {
  const now = await getPrefs($) // a patch over an empty session state would show the defaults in place of the stored choices
  const { raw, lost, ...stored } = await storedPrefs($)
  // E20: a chat that never read the store holds no real pet: while the store cannot be read it writes nothing, not even this
  // choice, since the pet it would be about is not the person's. A chat that already holds the real pet writes the one key of
  // the choice, as ever: each choice has a key of its own, so nothing else is written over
  if (lost && !(await heldPrefs($))) return false
  const p = { ...(raw ? stored : now), ...patch } // an empty or unreadable store: this session's are the ones to show
  await update($, prefs, () => p)
  if (!raw && !lost) await fill($, p, raw)
  for (const [name, value] of Object.entries(patch)) await storeSet($, prefKey(name), value).catch(() => {})
  // the diet is gone: a choice kept for it by an earlier version is read by nobody, and leaves the store at the first write
  if (!dietDropped && !(await bench($))) { dietDropped = true; await $.store.delete(prefKey('diet')).catch(() => {}) }
  return true
}
/**
 * A cuddle, from /pet pet or the button: counted with its time, hearts for a couple of seconds, and the coins and affection the engine
 * gives for it. Its line, in the pet's character, holds the bubble for RULES.cuddleShowMs over any other line (a note, the outline
 * offer, a greeting), which comes back after. With the comments on and the day's cap reached the line says so: finished for today, back tomorrow.
 */
async function cuddle(/** @type {any} */ $) {
  await getPrefs($)
  if (!cur) await load($)
  const now = await $.clock.now(), n = (await storedPrefs($)).cuddles + 1 // the store's count: another chat may have cuddled meanwhile
  await setPrefs($, { cuddles: n, cuddled: now })
  await diaryDo($, (d, t) => diaryCuddled(d, n, t)).catch(() => {})
  const had = cur.coins
  await feed($, { type: 'cuddle' })
  const coins = cur.coins - had
  await share($, true).catch(() => {})
  const p = await getPrefs($), t = (await voiceOn($)) ? await voiceTally($) : null
  const capped = !!t && due(t, 'cuddle', now) === 'cap'
  const say = capped ? voicedAs(p.lang, 'cuddle.cap', STATS.indexOf(speaker(p.stats, n))) : called(cuddleLine(speaker(p.stats, n), n, p.lang), p.callme, p.lang, n)
  await update($, anim, a => ({ ...a, love: LOVE_TICKS }))
  await hold($, say, '', RULES.cuddleShowMs)
  if (!capped) speak($, 'cuddle', turnInfo).catch(() => {}) // not awaited: the fixed line is on screen at once, the voice's takes its place if it comes
  return { name: p.name, n, coins, say, lang: p.lang }
}
/** The fix button: puts the command, or the line for the agent, in the prompt box. The person presses Enter, so tokens are spent by choice. */
async function fix(/** @type {any} */ $, /** @type {string} */ ask) {
  const lang = (await getPrefs($)).lang
  if ((await $.prompt.read().catch(() => ({ text: '' }))).text.trim()) return $.ui.toast(text(lang, 'toast.box'))
  const r = await $.prompt.fill({ text: ask, mode: 'replace' })
  if (!r?.isFilled) await $.ui.toast(text(lang, 'toast.type', { ask }))
}
/** The parts the person has something for, in their order: the only ones the skin menu, /pet skin and the bubble show. */
const partsOf = (/** @type {string[]} */ closet) => PARTS.filter(part => WEARABLE.some(i => i.slot === part && closet.includes(i.id)))
/** A part with nothing on it, in words: a dash, and for the coat the plain one. */
const bare = (/** @type {string} */ lang, /** @type {string} */ part) => part === GOLDEN.slot ? text(lang, 'coat.plain') : '–'
/** What is on, told part by part: `head: a travel cap, face: sunglasses`. With `all`, every part something is owned for, a dash where it is bare. */
function wornLine(/** @type {string} */ lang, /** @type {string[]} */ closet, /** @type {string} */ wear, all = false) {
  const worn = wornOf(closet, wear).map(id => /** @type {typeof WEARABLE[number]} */ (WEARABLE.find(i => i.id === id)))
  return (all ? partsOf(closet) : PARTS.filter(part => worn.some(i => i.slot === part)))
    .map(part => { const item = worn.find(i => i.slot === part); return text(lang, 'wears.part', { slot: text(lang, `part.${part}`), item: item ? itemName(lang, item) : bare(lang, part) }) }).join(text(lang, 'sep'))
}
/** The skin button opens the row of the parts, one button each; `done`, or a while without a press, closes it. */
async function skin(/** @type {any} */ $, open = true) { await update($, anim, a => ({ ...a, skin: open ? Math.round(SKIN_MS / TICK_MS) : 0 })) }
/**
 * A part's button: the next thing owned for that part, after the last one nothing. The other parts stay as the store has them now:
 * what is on and what is owned are read again first, so a press here never takes off what another chat put on meanwhile.
 */
/** The animal's button: the next of the animals the pet has, round again after the last. */
async function turnAnimal(/** @type {any} */ $) {
  await pullPrefs($).catch(() => {})
  await share($, false).catch(() => {})
  const p = await getPrefs($), mine = zooOf(card(cur).animals, p)
  await setPrefs($, { species: mine[(mine.indexOf(p.species) + 1) % mine.length], missing: '' })
  await skin($)
}
/** A pet of before the prices that is shown as another animal than the one it was born as keeps both: the one shown is unlocked for nothing, once. */
async function keepAnimal(/** @type {any} */ $) {
  const p = await getPrefs($)
  if (!cur || p.species === p.born || !RULES.animals.includes(p.species) || card(cur).animals.includes(p.species)) return
  await feed($, { type: 'animal', id: p.species, free: true })
  await share($, true).catch(() => {})
}
async function turn(/** @type {any} */ $, /** @type {string} */ slot) {
  await pullPrefs($).catch(() => {})
  await share($, false).catch(() => {})
  await setPrefs($, { wear: turnSlot(card(cur).closet, (await getPrefs($)).wear, slot) })
  await skin($)
}
/**
 * One pet per person: the store holds it, and every chat open holds a copy with its own session around it. This reads the store, puts
 * in only what this chat changed since it last looked (engine.js `merge`), and shows the result here; with `write` it is also kept.
 * Never the chat's whole copy over the store: the other chats' progress stays. The session part (file paths, commands), the notes and
 * the cheer on screen stay out of the disk. (The store has no atomic update: two writes in the same instant can still cross.)
 */
async function share(/** @type {any} */ $, /** @type {boolean} */ write) {
  if (!cur) return
  const none = {}, stored = await storeGet($, 'pet').catch(() => none)
  if (stored === none) return // an unreadable store is not an empty one: writing now would put this chat's copy over the shared pet
  const { pet: next, seen } = sync(cur, stored)
  const same = (/** @type {unknown} */ a, /** @type {unknown} */ b) => JSON.stringify(a) === JSON.stringify(b)
  const kept = write && (same(next, seen) || await storeSet($, 'pet', next).then(() => true, () => false))
  const base = kept ? next : seen ?? cur.base ?? shared(cur) // not written: this chat's changes are still to be counted
  if (same(shared(cur), next) && same(cur.base, base)) return
  cur = adopt(cur, next, base)
  await update($, pet, () => cur)
}
/** The choices made in another chat (lean above all) reach this one: the session's copy is brought up to the store's. */
async function pullPrefs(/** @type {any} */ $) {
  const now = await heldPrefs($)
  const { raw, lost, ...p } = await storedPrefs($)
  if (lost || !now || !isAnimal(raw?.species) || raw.seed !== p.seed || JSON.stringify(p) === JSON.stringify(now)) return // nothing whole to compare
  await update($, prefs, () => p)
  if (p.style !== now.style) await feedLean($)
}

/** A reload finds the state in $.state; a new session takes it from $.store and starts fresh. True for a new session. */
async function load(/** @type {any} */ $) {
  lastActive = lastOwn = await $.clock.now()
  await getPrefs($)
  const held = await heldPet($)
  if (held) { cur = held; await founding($); return false } // whatever version kept it, it is whole now
  const stored = await storeGet($, 'pet').catch(() => undefined)
  const born = stored && typeof stored === 'object' ? shared(stored) : null
  // CACHITO_PLAIN=1 leaves the golden roll out (the tests, the bench): the pet is born plain
  const plain = (await $.env.get('CACHITO_PLAIN').catch(() => undefined)) === '1'
  cur = reduce(/** @type {any} */ ({ ...initialState(plain ? 1 : undefined), ...born, ...(born && { base: born }) }), { type: 'sessionStart', t: lastActive })
  await update($, pet, () => cur)
  await founding($)
  return true
}

/**
 * The pet's birth and the founder's eggshell (engine.js `birth`): a newborn is born now; a pet of a version before this one, which
 * kept no birth, at the first moment its diary knows, else now. Born in time, it has the eggshell from here on, and it goes on a
 * head that has nothing on and was not left bare by choice. Under the bench the rule is the same, on the bench's own store.
 */
async function founding(/** @type {any} */ $) {
  const had = cur.owned.includes(EGGSHELL.id), first = cur.born || await bench($) ? 0 : Number(diaryOf(await storeGet($, 'diary').catch(() => null)).first) || 0 // read even in a headless run, which keeps no diary
  const next = birth(cur, lastActive, first)
  if (next === cur) return
  cur = next
  await update($, pet, () => cur)
  await share($, true).catch(() => {})
  if (had || !cur.owned.includes(EGGSHELL.id)) return
  const p = await getPrefs($), said = p.wear.split(/\s+/), closet = card(cur).closet
  if (!said.includes('none') && !said.includes('nohead') && !wornOf(closet, p.wear).some(id => partOf(id) === 'head')) await setPrefs($, { wear: putOn(closet, p.wear, EGGSHELL.id) })
}

/** Runs the animation: frames while something moves, a rare blink when calm, sleep after 5 idle minutes, a redraw when a mood times out. */
async function tick(/** @type {any} */ $) {
  if (!cur) return
  ticks++
  if (asked || ticks % 10 === 0) await beat($).catch(() => {}) // looked at every 5 s, and at every tick while a call waits for leave
  if (heldLine && !(await typing($))) { const line = heldLine; heldLine = null; await feed($, { type: 'voice', ...line }) }
  const hatching = await heldAnim($)
  if (hatching.egg > 0 && !hatching.demo && !demoQueue.length) {
    await update($, anim, a => ({ ...a, n: a.n + 1, egg: a.egg - 1 }))
    if (hatching.egg === 1) await askVoice($).catch(() => {}) // hatched: now it asks whether it may speak
    return
  }
  if (farewell && !hatching.noteLeft) { // its pack is gone: it is the animal it was born as again, and says so once, with no blame
    const p = await getPrefs($), was = farewell
    farewell = ''; farewellSaid = was
    await hold($, text(p.lang, 'animal.gone', { animal: animalName(p.lang, p.species) }), text(p.lang, 'animal.gone.fix'), GONE_SHOW_MS)
  }
  if (hatching.love > 0) await update($, anim, a => ({ ...a, love: a.love - 1 }))
  if (hatching.skin > 0) await update($, anim, a => ({ ...a, skin: Math.max(0, a.skin - 1) }))
  if (hatching.noteLeft > 0) await update($, anim, a => ({ ...a, noteLeft: a.noteLeft - 1, ...(a.noteLeft === 1 ? { note: '', noteFix: '' } : null) }))
  if (ticks % PEER_TICKS === 0) { await peers($).catch(() => {}); await pullPrefs($).catch(() => {}); await share($, false).catch(() => {}); midTurn($).catch(() => {}) } // the comment is not awaited: the drawing goes on
  const shown = (await heldAnim($)).demo
  if (demoQueue.length || shown) {
    // each mood gets its whole 5 s, counted from when it comes up; the egg goes through its phases in that time, as at a birth
    if (demoLeft <= 0) demoLeft = DEMO_TICKS
    const demo = demoLeft === DEMO_TICKS ? demoQueue.shift() ?? '' : shown
    demoLeft--
    const egg = demo === 'egg' ? Math.ceil((demoLeft + 1) * EGG_TICKS / DEMO_TICKS) - 1 : 0
    if (!demo) demoLeft = 0
    await update($, anim, a => ({ ...a, n: a.n + 1, rare: -1, demo, egg }))
    return
  }
  const now = await $.clock.now()
  { const kept = await heldAnim($); if (kept.sig !== bubbleSig || kept.sigAt !== bubbleAt) await update($, anim, a => ({ ...a, sig: bubbleSig, sigAt: bubbleAt })) } // what the drawing noted, kept for a reload
  if (bubbleUntil && now >= bubbleUntil) { bubbleUntil = 0; await update($, anim, a => ({ ...a, hush: a.hush + 1 })) } // the phrase had its time: drawn again without it
  const a0 = await heldAnim($)
  if (now - lastActive > SLEEP_MS) {
    if (!a0.sleep || ticks % 4 === 0) await update($, anim, a => ({ ...a, n: a.n + 1, rare: -1, sleep: true, idle: '', idleN: 0, spark: 0 }))
    return
  }
  const v = view(cur, now), p = await getPrefs($)
  const { st, worn } = drawn(v, a0, p)
  if (!rng) rng = p.seed | 0 || 1
  // a golden coat sparkles now and then: one or two pixels next to the body, lit for a second
  if (a0.spark) { if (--sparkLeft <= 0 || !worn.includes(GOLDEN.id)) await update($, anim, a => ({ ...a, spark: 0 })) }
  else if (worn.includes(GOLDEN.id)) {
    if (!sparkAt) sparkAt = now + between(SPARK_GAP_MS)
    else if (now >= sparkAt) { const spark = 1 << Math.floor(rnd() * 4) | (rnd() < 0.4 ? 1 << Math.floor(rnd() * 4) : 0); sparkLeft = SPARK_TICKS; sparkAt = now + between(SPARK_GAP_MS); await update($, anim, a => ({ ...a, spark })) }
  }
  if (a0.idle) { // a gesture under way: its next frame, and after the last one the pet is still again for a while
    const frames = st.idle?.[a0.idle]?.frames.length ?? 0
    if (a0.idleN + 1 >= frames) { idleAt = now + between(IDLE_GAP_MS); await update($, anim, a => ({ ...a, idle: '', idleN: 0 })) }
    else await update($, anim, a => ({ ...a, idleN: a.idleN + 1 }))
    lastMood = v.mood
    return
  }
  const moving = v.animate && st.frames.length > 1
  if (moving) await update($, anim, a => ({ ...a, n: a.n + 1, rare: -1 }))
  else if (rareShown) { rareShown = false; await update($, anim, a => ({ ...a, rare: -1 })) }
  else if (ticks % 12 === 0 && st.rare.length && rnd() < 0.5) {
    rareShown = true
    await update($, anim, a => ({ ...a, rare: 0 }))
  } else if (v.mood !== lastMood) await update($, anim, a => ({ ...a, n: a.n + 1, rare: -1 }))
  else if (st.idle && !bubbleOpen && !a0.skin && !a0.love) {
    // calm, with nothing in the bubble: now and then a small gesture, picked at random among the ones this body has. Never while a
    // phrase is up, and never sooner than IDLE_GAP_MS after the last. (Whether the terminal has the focus cannot be known from a mod.)
    const names = Object.keys(st.idle)
    if (!idleAt) idleAt = now + between(IDLE_GAP_MS)
    else if (now >= idleAt && names.length) { const idle = /** @type {string} */ (names[Math.floor(rnd() * names.length)]); await update($, anim, a => ({ ...a, idle, idleN: 0, rare: -1 })) }
  }
  lastMood = v.mood
}

export function register(/** @type {import('claude-code').On} */ on) {
  on('session.start', async ($, e, next) => {
    social = e.isInteractive
    cwd = e.cwd
    await packs($, true) // before anything reads the pet: its animal may be one of a pack
    await settle($).catch(() => {})
    rng = idleAt = sparkAt = bubbleAt = bubbleUntil = 0; bubbleSig = '' // a session starts: its phrases are new, and the pet moves from its seed again
    const fresh = await load($).catch(() => false)
    // a reload of the mod in a chat that goes on: the phrase that was up, and since when, are the session's, so one that had its time stays gone
    if (!fresh) { const kept = await heldAnim($); bubbleSig = kept.sig; bubbleAt = kept.sigAt }
    await feedLean($) // so the first bubble already knows
    await keepAnimal($).catch(() => {})
    await prune($).catch(() => {})
    if (fresh) await greet($).catch(() => {}) // a reload is not an opening
    else openedAt = await $.clock.now()
    if (fresh && newborn && social) await update($, anim, a => ({ ...a, egg: EGG_TICKS })) // the first start ever: it hatches before the greeting
    newborn = false
    if (!(await heldAnim($)).egg) await askVoice($).catch(() => {}) // a pet born before this version is asked once; a newborn after it hatched
    const rows = await $.config.list().catch(() => [])
    light = String(rows.find(r => r.key === 'theme')?.value ?? '').includes('light')
    await $.command.register({ name: 'pet', description: 'Cachito: show the pet card. Also: /pet audit [days], /pet lean <on|off> (the style), /pet comments <on|off>, /pet lang <en|es|pt|zh>, /pet say <text>, /pet call me <name>, /pet diary, /pet share, /pet hide, /pet show, /pet shop [item], /pet wear <item|off <item>|none>, /pet animal <name>, /pet skins, /pet chats, /pet name <name>, /pet pet, /pet adopt, /pet demo' })
    $.clock.every(TICK_MS, () => { tick($).catch(() => {}) })
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (styleProbing) return r
    // switching the style re-sends the whole conversation once: in a long chat that costs more than the style saves for a long while,
    // so a switch waits for a moment when the cache is rebuilt anyway (a new chat, a compaction) or the chat is still small
    const want = await styleOn($)
    styleLive = styleNext(want)
    styleAsked = e
    styleOther = r.sections.some(s => s.id === STYLE_ID) || undefined // there already: by a plugin below. Not there: one above may still add it, asked when needed
    // with the cachito-lean plugin installed too the section may be there already: an id is unique in the list, and the style goes in once
    return styleLive && !r.sections.some(s => s.id === STYLE_ID) ? { sections: [...r.sections, { id: STYLE_ID, text: STYLE, scope: /** @type {const} */ ('session') }] } : r
  })

  on('prompt.submit', async ($, e, next) => {
    // /pet say is for the pet alone: answered here and dropped, so neither what was written nor the answer becomes a row of the chat
    const toPet = e.command?.name === 'pet' ? /^say(?:\s+|$)([^]*)/i.exec(e.command.args.trim()) : null
    if (toPet) {
      const p = await getPrefs($)
      if (!(toPet[1] ?? '').trim()) return { drop: text(p.lang, 'say.usage') } // nothing to say: one line on how, and nothing else
      sayTo($, toPet[1] ?? '').catch(() => {}) // not awaited: the prompt box is free at once, the answer comes in the bubble
      return { drop: text(p.lang, 'say.heard', { name: p.name }) }
    }
    await pullPrefs($).catch(() => {}) // lean switched in another chat counts from this turn
    await feed($, { type: 'prompt', turn: !e.command }).catch(() => {}) // a slash command sends no request: no word on an expired cache
    if (!e.command) { await mark($, false); turnInfo = TURN0(); turnAt = await $.clock.now(); midAt = 0; turnSaid = '' } // a slash command starts no turn
    if (!e.command && (await heldAnim($)).ask) await update($, anim, a => ({ ...a, ask: '' })).catch(() => {}) // the question went unanswered: the voice stays off
    return next(e)
  })

  // A call the agent must ask leave for: the verdict `ask` with a person to answer it. Noted here; the tick marks the chat as
  // maybe waiting for an OK when the call has not started a few seconds later. Nothing is decided or changed: the verdict is passed on
  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    if (r?.decision === 'ask' && e.approver === 'person' && e.tool_use_id) asked = { id: e.tool_use_id, at: await $.clock.now() }
    return r
  })

  on('tool.call', async ($, e, next) => {
    const id = /** @type {any} */ (e).tool_use_id
    if (asked && asked.id === id) await unask($).catch(() => {}) // the call it asked leave for starts: the leave was given
    const r = await next(e)
    if (asked && asked.id === id) await unask($).catch(() => {}) // asked for while it was starting, and over now
    if (e.agentId !== undefined) return r // a subagent has its own context
    try {
      const a = /** @type {any} */ (e)
      turnInfo.tools[e.tool] = (turnInfo.tools[e.tool] ?? 0) + 1
      if (e.tool === 'Read') {
        const mtime = (await $.fs.stat(a.file_path).catch(() => null))?.mtimeMs ?? 0
        const range = a.offset !== undefined || a.limit !== undefined ? `${a.offset ?? 0}+${a.limit ?? ''}` : undefined
        if (!r.isError && !r.deny) await feed($, { type: 'read', path: a.file_path, mtime, range })
      } else if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit') {
        if (!r.isError && !r.deny) { turnInfo.files[String(a.file_path ?? a.notebook_path ?? '')] = true; await feed($, { type: 'edit' }) }
      } else if (e.tool === 'Bash' && !r.deny) {
        if (r.isError) { const name = program(String(a.command ?? '')) || 'a command'; turnInfo.failed[name] = (turnInfo.failed[name] ?? 0) + 1 }
        await feed($, { type: 'cmd', cmd: a.command, ok: !r.isError })
      }
    } catch {}
    return r
  })

  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    try {
      const u = r?.usage
      if (r?.answer && /** @type {any} */ (e).agentId === undefined) turnSaid = String(r.answer).slice(-RULES.voiceTailChars)
      if (u && /** @type {any} */ (e).agentId === undefined) {
        // fill from this request, as the status line computes it: session.measure only comes once a turn and is stale after a compaction
        const total = ctxTokens = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
        afterCompact = false
        await feed($, { type: 'usage', input: u.input_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens, contextPct: windowTokens ? 100 * total / windowTokens : undefined, ...await leanState($) })
      }
    } catch {}
    return r
  })

  on('session.measure', ($, e, next) => {
    windowTokens = e.context.window
    if (e.cost) costUsd = e.cost.usd
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && !r.skip) { ctxTokens = 0; afterCompact = true; await feed($, { type: 'compact' }).catch(() => {}); await feedLean($) }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const stage = cur ? card(cur).stage : ''
      await feed($, { type: 'turnEnd', roll: Math.random() }).catch(() => {})
      await share($, true).catch(() => {})
      const grown = cur ? card(cur).stage : ''
      await diaryDo($, (d, t) => grown !== stage && stage ? diaryGrew(diaryTouched(d, t), STATE[grown] ?? grown, t) : diaryTouched(d, t)).catch(() => {})
      await mark($, e.reason !== 'aborted' && e.reason !== 'error') // an interrupted turn is left midway
      // the voice, when it is on: not awaited, so the turn ends as fast as ever. A failure or many files changed skip the wait
      const done = turnInfo, why = Object.keys(done.failed).length ? 'fail' : Object.keys(done.files).length >= RULES.voiceManyFiles ? 'files' : 'turn'
      turnInfo = TURN0(); turnAt = 0; turnSaid = ''
      if (e.reason !== 'aborted' && e.reason !== 'error') speak($, why, done, String(e.answer ?? '').slice(-RULES.voiceTailChars)).catch(() => {})
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await feed($, { type: 'sessionEnd' }).catch(() => {})
    // after /clear the process goes on and no session.start fires, so start the next one here
    // the new chat sends everything again anyway: a style that waited gets in with its first request
    // the chat after a /clear is the same sitting: no second greeting, and a mark of its own
    await mark($, true, { closed: true }).catch(() => {}) // this chat is over: the others stop counting it at once (after /clear the next one has an id of its own)
    if (e.reason === 'clear') { if ((await heldAnim($)).ask) await update($, anim, a => ({ ...a, ask: '' })).catch(() => {}); ctxTokens = turnAt = 0; styleOther = undefined; turnSaid = ''; styleLive = undefined; chatId = ''; await feed($, { type: 'sessionStart' }).catch(() => {}); await feedLean($) }
    await share($, true).catch(() => {})
    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    if (!cur) await load($)
    await pullPrefs($).catch(() => {})
    await share($, false).catch(() => {}) // the card shows the shared pet as it is now
    // verbs and their arguments are read without regard to capitals; a name given to the pet and what is said to it keep theirs
    const words = e.args.trim().split(/\s+/), [verb, arg, arg2] = words.map(w => w.toLowerCase())
    // E20: no real pet to show or change while the store cannot be read and this chat holds none: said in a line, and nothing is done
    if (!(await heldPrefs($)) && (await storedPrefs($)).lost) return { text: text(undefined, 'store.lost') }
    const L0 = (await getPrefs($)).lang
    const onOff = (/** @type {string} */ v) => arg && arg !== 'on' && arg !== 'off' ? { text: text(L0, 'onoff', { verb: v, arg: tidy(arg, 24) }) } : null
    if (verb === 'help') return { text: listOf(L0, 'help').join('\n') }
    if (verb === 'hide' || verb === 'show') {
      await setPrefs($, { hidden: verb === 'hide' })
      return { text: text((await getPrefs($)).lang, verb === 'hide' ? 'toast.hidden' : 'toast.shown') }
    }
    if (verb === 'say') { // typed, it is answered at prompt.submit and never gets here; a command run by another mod does
      const said = e.args.trim().slice(verb.length)
      if (!said.trim()) return { text: text(L0, 'say.usage') }
      await sayTo($, said).catch(() => {})
      return {}
    }
    if (verb === 'diary') {
      const L = (await getPrefs($)).lang
      if (await bench($)) return { text: 'No diary: under the bench none is kept.' }
      if (arg === 'clear') return { text: text(L, await storeSet($, 'diary', diaryOf(undefined)).then(() => 'diary.cleared', () => 'diary.unkept')) } // a store that cannot be written is said, not thrown
      return { text: page(diaryOf(await storeGet($, 'diary').catch(() => undefined)), await $.clock.now(), L) }
    }
    if (verb === 'chats') { // the board of the chats: which of the person's open chats is working, waiting for them, or may be waiting for an OK
      if (await bench($)) return { text: 'No board of the chats: under the bench no chat leaves a mark.' }
      const bad = onOff('chats')
      if (bad) return bad
      if (arg === 'on' || arg === 'off') { await setPrefs($, { chats: arg === 'on' }); await showing($).catch(() => {}); await peers($).catch(() => {}); return { text: text(L0, arg === 'on' ? 'chats.on' : 'chats.off') } }
      if (!(await getPrefs($)).chats) return { text: text(L0, 'chats.off') }
      const now = await $.clock.now(), rows = listing(await chats($), await myId($), now), wide = Math.max(0, ...rows.map(c => cols(c.name))) + 2
      const others = rows.filter(c => !c.me)
      return { text: [text(L0, 'chats.title'), ...rows.map(c => `  ${pad(c.name, wide)}${text(L0, `chats.state.${c.state}`)}, ${ago(c.ago, L0)}${c.me ? `  (${text(L0, 'chats.me')})` : ''}`), ...(others.length ? [] : [text(L0, 'chats.none')]), text(L0, 'chats.help')].join('\n') }
    }
    if (verb === 'skins') { // the folder is read anew: a pack just put there, or just mended, shows without a restart
      if (await bench($)) return { text: 'No skin packs: under the bench none is read.' }
      await packs($, true)
      await settle($)
      const dir = await skinsDir($), found = REG.packs.map(f => ({ ...f, file: tidy(f.file, 80), errors: f.errors.map(err => tidy(err, 300)) })), wide = Math.max(0, ...found.map(f => cols(f.file))) + 2 // a pack's file name and what is wrong with it come from a stranger: shown made safe
      const guide = `Format, an example to copy and how to try it: ${DOCS.replace(/fix\/$/, 'skins.md')}`
      if (!found.length) return { text: `No skin packs. A pack is one .json file in ${dir || '~/.claude/cachito-skins'}: put it there and run /pet skins.\n${guide}` }
      const brings = (/** @type {typeof found[number]} */ f) => [['animals', f.animals], ['items', f.items], ['coats', f.coats]].flatMap(([kind, ids]) => ids?.length ? [`${kind}: ${/** @type {string[]} */ (ids).join(', ')}`] : []).join('; ')
      return { text: [
        `Skin packs in ${dir}: ${found.filter(f => !f.errors.length).length} loaded${found.some(f => f.errors.length) ? `, ${found.filter(f => f.errors.length).length} left out` : ''}.`,
        ...found.flatMap(f => f.errors.length ? [`  ${pad(f.file, wide)}left out, nothing of it is used:`, ...f.errors.map(err => `      ${err}`)] : [`  ${pad(f.file, wide)}${f.name} (${f.id})  ${brings(f)}`, ...(Object.keys(f.credits ?? {}).length ? [`  ${''.padEnd(wide)}${['author', 'license', 'source'].flatMap(k => f.credits?.[k] ? [`${k}: ${f.credits[k]}`] : []).join(', ')}`] : [])]),
        'What a pack brings is yours at once and costs no stars: /pet skin shows the things, /pet animal the animals.',
        guide,
      ].join('\n') }
    }
    if (verb === 'lang') {
      const lang = asLang(arg)
      if (arg && !lang) return { text: text(L0, 'lang.none', { arg: tidy(arg, 24) }) }
      if (lang) await setPrefs($, { lang })
      const now = (await getPrefs($)).lang
      return { text: text(now, lang ? 'lang.now' : 'lang.is', { self: text(now, 'self') }) }
    }
    if (verb === 'audit') {
      // shortcut: needs Node installed, a build inside the mod's own sandbox if people without Node ask
      if (arg !== undefined && !/^[1-9]\d{0,3}$/.test(arg) || Number(arg) > 3650) return { text: text(L0, 'audit.days', { arg: tidy(arg, 24) }) }
      const node = await nodePath($)
      if (!node) return { text: text(L0, 'audit.nonode') }
      const r = await $.process.run([node, `${$.plugin.root}/engine/audit.js`, ...(arg ? ['--days', arg] : [])], { timeoutMs: 300_000 }).catch((/** @type {unknown} */ err) => String(/** @type {any} */ (err)?.message ?? err))
      if (typeof r === 'string') return { text: /ENOENT|not found|no such file/i.test(r) ? text(L0, 'audit.nonode') : text(L0, 'audit.failed', { why: tidy(r, 200) }) }
      return { text: r.exitCode === 0 ? r.stdout : `${text(L0, 'audit.error', { code: r.exitCode })}\n${tidy(r.stderr, 300)}` }
    }
    if (verb === 'budget') return { text: text(L0, 'gone.budget') }
    // two commands of earlier versions, taken out: each says so, and why
    if (verb === 'weight') return { text: text((await getPrefs($)).lang, 'gone.weight') }
    if (verb === 'diet') return { text: text((await getPrefs($)).lang, 'gone.diet') }
    if (verb === 'lean' || verb === 'style') { // one lever, two names: lean is the style
      const bad = onOff(verb)
      if (bad) return bad
      if (arg === 'on' || arg === 'off') { await setPrefs($, { style: arg === 'on' }); await feedLean($) }
      const p = await getPrefs($), wait = p.style && !styleNext(true)
      if (!p.style && await otherStyle($)) return { text: `Lean on: the cachito-lean plugin adds the style to the system prompt, whatever /pet lean says. /lean off takes it out. ${STYLE_BENCH}\n\n${STYLE}` }
      if (!p.style) return { text: `Lean off. /pet lean on adds the style to the system prompt: short answers, the least code, read-only calls sent together. ${STYLE_BENCH}` }
      return { text: `${wait ? 'Lean chosen: this chat is already long, so the style starts at the next compaction or the next chat. Switching now would re-send the whole conversation.' : 'Lean on: every request carries the style, these lines in the system prompt. Switching rewrites the cache once.'} ${STYLE_BENCH}\n\n${STYLE}` }
    }
    if (verb === 'comments' || verb === 'voice') { // `voice` was its name: kept, unlisted, for who typed it before
      if (await bench($)) return { text: 'Comments off: under the bench they are never used.' }
      const bad = onOff('comments')
      if (bad) return bad
      if (arg === 'on' || arg === 'off') await setVoice($, arg === 'on')
      const t = (await voiceTally($)) ?? tally(undefined, await $.clock.now()), avg = average(t)
      const cost = avg.measured ? `${money(avg.usd)} a line, measured over the ${t.lines} line${t.lines === 1 ? '' : 's'} paid so far (${Math.round(t.input / t.lines)} tokens in and ${Math.round(t.output / t.lines)} out each)` : `about ${money(avg.usd)} a line: an estimate, replaced by the measured figure after the first line`
      const cap = `${RULES.voiceCapDay} lines a day, about ${money(RULES.voiceCapDay * avg.usd)}`
      if (!(await getPrefs($)).voice) return { text: `Comments off: the pet says its fixed lines, and nothing is sent anywhere for it. /pet comments on lets a small model write one line about the turn. That spends tokens of your own account: ${cost}, never more than ${cap}. ${PRICE_NOTE}` }
      return { text: [
        `Comments on. They spend tokens of your own account: each line is one request to a small model (the alias ${MODEL}, through Claude Code's own client).`,
        `Sent to the model: the pet's name, animal, five statistics and language; the name you told it with /pet call me, when you told one; why it speaks; the names of the tools used in the turn with their counts (the tools of your MCP servers too, by their names); the program names of the commands that failed; how many files changed; the last ${RULES.voiceTailChars} characters of the assistant's reply (during a turn, of what it wrote last in it, and how many minutes the turn has lasted); the pet's own last ${RULES.voiceRecall} lines, so that it does not repeat itself (they are kept in the store and go back to the model in later chats too); at most ${RULES.diaryRecall} lines of its diary, as memories it may hint at (times, counts, a folder's name: /pet diary shows all of it). When another of your chats ends a long turn: that chat's folder name, how long the turn took and how long ago it ended, and nothing of what was in it.`,
        `/pet say <text> speaks to the pet: what you write after it (its first ${RULES.saySaidChars} characters) is sent to the same model, which answers in the bubble with one line. It is a request of its own, not a turn of the chat, and counts in the day's lines.`,
        `Never sent by the pet itself: the content of a file, the output of a command, the arguments of a command, a file path, your prompts to the assistant. But the end of the assistant's reply is sent as it is: those ${RULES.voiceTailChars} characters can hold a path, a name or a piece of code the assistant wrote there.`,
        `Cost: ${cost}. ${PRICE_NOTE}`,
        `When: at the end of a turn, at most one line every ${RULES.voiceGapMs / 60_000} minutes; without that wait after a failed command, a turn that changed ${RULES.voiceManyFiles} files or more, or a cuddle: each of those waits ${(RULES.voiceEvery.fail ?? 0) / 1000}, ${(RULES.voiceEvery.files ?? 0) / 1000} and ${(RULES.voiceEvery.cuddle ?? 0) / 1000} seconds since the last line for the same reason. A line is counted in the day when it is asked for, so one whose call fails or runs out of time is counted too. Also during a turn that lasts longer than ${RULES.voiceGapMs / 60_000} minutes, under the same wait. Never more than ${cap}, over all your chats. Never while you type, and a call slower than ${RULES.voiceTimeoutMs / 1000} seconds is dropped.`,
        `A line that comes back wider than ${RULES.voiceMaxCols} columns on screen (a Chinese character takes two) is not shown, and is paid for all the same: ${t.dropped} of ${t.lines} so far. Nor is one that names a file or a path: ${t.paths} so far.`,
        `Today: ${t.today} of ${RULES.voiceCapDay} lines, ${money(t.todayUsd)}: ${left(t) ? `${left(t)} left` : 'none left, they come back tomorrow'}. /pet comments off stops them.`,
      ].join('\n') }
    }
    if (verb === 'demo') {
      demoQueue = [...DEMO]
      demoLeft = 0 // from the first mood, whatever a demo still running was showing
      return { text: text(L0, 'demo.start', { list: DEMO.join(', ') }) }
    }
    if (verb === 'animal') { // free among the animals the pet has: the one it was born as and the ones unlocked. Unlocking is the shop's
      const p = await getPrefs($), lang = p.lang, mine = zooOf(card(cur).animals, p), locked = RULES.animals.filter(id => !mine.includes(id))
      if (mine.includes(arg ?? '')) {
        await setPrefs($, { species: arg, missing: '' })
        return { text: text(lang, 'animal.now', { animal: animalName(lang, /** @type {string} */ (arg)) }) }
      }
      if (arg && locked.includes(arg)) return { text: text(lang, 'animal.locked', { animal: animalName(lang, arg), id: arg, price: RULES.animalPrice, coins: card(cur).coins }) }
      // an animal there is, not sold: only a pet born as one is one. A name that is no animal is said too, then the ones to pick from
      const why = !arg ? [] : [text(lang, isAnimal(arg) ? 'animal.rare' : 'animal.unknown', { animal: animalName(lang, arg), arg: tidy(arg, 24) })]
      return { text: [...why, text(lang, 'animal.pick', { list: mine.map(typed).join(', ') }), ...(locked.length ? [text(lang, 'animal.more', { list: locked.join(', '), price: RULES.animalPrice })] : [])].join('\n') }
    }
    if (verb === 'name') {
      const name = cleanName(e.args.trim().slice(verb.length)) // as typed: a name keeps its capitals
      const now = await getPrefs($)
      if (!name) return { text: text(now.lang, 'name.is', { name: now.name, max: NAME_MAX }) }
      await setPrefs($, { name })
      return { text: text(now.lang, 'name.now', { name }) }
    }
    if (verb === 'call') { // /pet call me <name>: the one way the pet learns the person's name. Alone it says the name, `nobody` or `off` forgets it
      const typed = e.args.trim().slice(verb.length).trim().replace(/^me(\s+|$)/i, ''), name = cleanCall(typed)
      const now = await getPrefs($)
      if (!typed) return { text: now.callme ? text(now.lang, 'call.is', { name: now.callme }) : text(now.lang, 'call.none', { max: CALL_MAX }) }
      if (/^(nobody|off)$/i.test(typed)) { await setPrefs($, { callme: '' }); return { text: text(now.lang, 'call.gone') } }
      if (!name) return { text: text(now.lang, 'call.none', { max: CALL_MAX }) }
      await setPrefs($, { callme: name })
      return { text: text(now.lang, 'call.now', { name }) }
    }
    if (verb === 'pet') {
      const c = await cuddle($)
      return { text: `${c.name}: ${c.say}  (${petted(c.lang, c.n)}${c.coins ? text(c.lang, 'pet.coins', { n: c.coins }) : ''})` }
    }
    if (verb === 'adopt') {
      const old = await oldBuddy($)
      if (!old) return { text: text(L0, old === null ? 'adopt.none' : 'adopt.unread') }
      const p = await getPrefs($)
      const [t1, t2] = traitsOf(old.personality) // what its words say; with no word that fits, the pet keeps the character it had
      await setPrefs($, { name: old.name, stats: t1 ? statsOf(p.seed, t1, t2) : p.stats, personality: old.personality, hatched: old.hatchedAt, asked: true })
      return { text: text(L0, 'adopt.done', { name: old.name, animal: animalName(L0, p.species) }) }
    }
    const c = card(cur), who = await getPrefs($), L = who.lang
    const say = (/** @type {string} */ key, /** @type {Record<string, string | number>} */ fill = {}) => text(L, key, fill)
    const points = (/** @type {number} */ n) => count1(L, 'points', n)
    if (verb === 'shop' || verb === 'buy') {
      const item = SOLD.find(i => i.id === arg), mine = zooOf(c.animals, who)
      // a thing sold in one month only: out of it the catalogue says the month where a thing owned says `yours`, and buying is refused with the reason
      const at = await $.clock.now(), monthOf = (/** @type {string} */ id) => sells(id, at) ? 0 : SHOP.find(i => i.id === id)?.month ?? 0
      if (arg && RULES.animals.includes(arg)) { // an animal: unlocked once, shown at once, and then its own for good
        const animal = animalName(L, arg), price = RULES.animalPrice
        if (mine.includes(arg)) return { text: say('animal.have', { animal, id: arg }) }
        if (c.coins < price) return { text: say('animal.short', { animal, price, coins: c.coins, earn: earn(L) }) }
        await feed($, { type: 'animal', id: arg })
        await share($, true).catch(() => {})
        await setPrefs($, { species: arg, missing: '' })
        return { text: say('animal.done', { animal, price, left: cur.coins }) }
      }
      if (arg === EGGSHELL.id) return { text: c.owned.includes(arg) ? say('buy.have', { item: itemName(L, EGGSHELL), id: arg }) : say('founder.not', { item: itemName(L, EGGSHELL), date: FOUNDER_UNTIL }) } // not sold: a founder's pet has it
      if (item) { // /pet shop <item> buys; /pet buy is the same, kept for who learnt it
        const name = itemName(L, item)
        if (c.owned.includes(item.id)) return { text: say('buy.have', { item: name, id: item.id }) }
        if (monthOf(item.id)) return { text: say(`buy.month.${monthOf(item.id)}`, { item: name }) }
        if (c.coins < item.price) return { text: say('buy.short', { item: name, price: item.price, coins: c.coins, earn: earn(L) }) }
        await feed($, { type: 'buy', id: item.id })
        await diaryDo($, (d, t) => diaryBought(d, item.id, t)).catch(() => {})
        await share($, true).catch(() => {})
        await setPrefs($, { wear: putOn([...c.closet, item.id], who.wear, item.id) }) // it takes its part: the other parts keep what they had
        return { text: say('buy.done', { item: name, price: item.price, left: cur.coins, name: who.name, id: item.id, slot: say(`part.${item.slot}`) }) }
      }
      const wearing = wornOf(c.closet, who.wear), place = Math.max(...[...PARTS, 'animal'].map(part => cols(say(`part.${part}`)))) + 2
      const sold = [...RULES.animals, ...mine.filter(id => !RULES.animals.includes(id) && !REG.species[id].pack)] // the six to unlock, and the pet's own rare one, which nobody can buy. What a skin pack brings is not the shop's
      // the columns are as wide as the widest name on screen: a Chinese name takes two columns a character
      const wide = Math.max(...OWNABLE.map(i => cols(itemName(L, i))), ...sold.map(id => cols(animalName(L, id)))) + 2
      const row = (/** @type {typeof SOLD[number]} */ i) => `  ${i.id.padEnd(12)}${pad(itemName(L, i), wide)}${String(i.price).padStart(3)}  ${pad(say(`part.${i.slot}`), place)}${c.owned.includes(i.id) ? say(wearing.includes(i.id) ? 'shop.worn' : 'shop.yours') : monthOf(i.id) ? say(`shop.month.${monthOf(i.id)}`) : ''}`.trimEnd()
      return { text: [
        ...(arg ? [say('shop.none', { arg }), ''] : verb === 'buy' ? [say('shop.pick'), ''] : []),
        say('shop.title', { points: points(c.coins) }),
        ...(c.coins < 0 ? [say('shop.debt')] : []),
        '',
        ...SHOP.map(row),
        '',
        ...COATS.map(row), // a coat is a colour, not a thing to wear: rows of their own
        '',
        // the founder's eggshell, apart: no price, and whether it is the pet's
        `  ${EGGSHELL.id.padEnd(12)}${pad(itemName(L, EGGSHELL), wide)}${'–'.padStart(3)}  ${pad(say(`part.${EGGSHELL.slot}`), place)}${say(!c.owned.includes(EGGSHELL.id) ? 'shop.founder' : wearing.includes(EGGSHELL.id) ? 'shop.worn' : 'shop.yours')}`,
        '',
        // the animals, apart: each with its price and whether it is the pet's own, the one shown marked
        ...sold.map(id => `  ${id.padEnd(12)}${pad(animalName(L, id), wide)}${(RULES.animals.includes(id) ? String(RULES.animalPrice) : '–').padStart(3)}  ${pad(say('part.animal'), place)}${!mine.includes(id) ? '' : say(id === who.species ? 'shop.shown' : 'shop.yours')}`.trimEnd()),
        ...(c.closet.length ? ['', wearing.length ? say('wears.now', { name: who.name, list: wornLine(L, c.closet, who.wear) }) : say('wears.none', { name: who.name })] : []),
        '',
        say('shop.help'),
        say('shop.animals'),
        say('shop.points', { earn: earn(L) }),
      ].join('\n') }
    }
    if (verb === 'skin' || (verb === 'wear' && !arg)) { // the parts the person has something for, each with what is on it, and the animal when there is more than one to pick
      const mine = zooOf(c.animals, who), parts = [...partsOf(c.closet), ...(mine.length > 1 ? ['animal'] : [])], worn = wornOf(c.closet, who.wear), wide = Math.max(0, ...parts.map(part => cols(say(`part.${part}`)))) + 2
      if (!parts.length) return { text: say('skin.none') }
      return { text: [say('skin.title', { name: who.name }), ...parts.map(part => { const item = WEARABLE.find(i => i.slot === part && worn.includes(i.id)); return `  ${pad(say(`part.${part}`), wide)}${part === 'animal' ? animalName(L, who.species) : item ? itemName(L, item) : bare(L, part)}` }), say('wear.help')].join('\n') }
    }
    if (verb === 'wear') {
      const off = arg === 'off' && !!arg2, id = off ? arg2 : arg, item = WEARABLE.find(i => i.id === id), name = item ? itemName(L, item) : ''
      const now = wornOf(c.closet, who.wear)
      const told = (/** @type {string} */ wear) => wornOf(c.closet, wear).length ? say('wears.now', { name: who.name, list: wornLine(L, c.closet, wear) }) : say('wears.none', { name: who.name })
      if (arg === 'none' || (arg === 'off' && !arg2)) { await setPrefs($, { wear: takeOff(c.closet, who.wear, 'none') }); return { text: say(now.includes(GOLDEN.id) ? 'wears.none.golden' : now.some(x => partOf(x) === GOLDEN.slot) ? 'wears.none.coat' : 'wears.none', { name: who.name }) } } // the coat is a colour: it stays, and the reply says so
      if (arg === PLAIN) { const coat = now.find(x => partOf(x) === GOLDEN.slot), wear = coat ? takeOff(c.closet, who.wear, coat) : who.wear; await setPrefs($, { wear }); return { text: told(wear) } } // the pet's own colour: what who has a coat on goes back to
      if (!item || !c.closet.includes(item.id)) return { text: say('wear.not', { arg: id ?? '?', list: c.closet.join(', ') || say('nothing') }) }
      if (off && !now.includes(item.id)) return { text: `${say('wear.notOn', { item: name })}\n${told(who.wear)}` }
      // the same thing asked a second time comes off
      const wear = now.includes(item.id) ? takeOff(c.closet, who.wear, item.id) : putOn(c.closet, who.wear, item.id)
      await setPrefs($, { wear })
      const old = WEARABLE.find(i => i.slot === item.slot && i.id !== item.id && now.includes(i.id)), slot = say(`part.${item.slot}`)
      return { text: `${now.includes(item.id) ? say('wear.off', { item: name }) : old ? say('wear.swap', { item: name, slot, old: itemName(L, old) }) : say('wear.on', { item: name, slot })}\n${told(wear)}` }
    }
    if (verb === 'share') {
      // a picture to attach to a post: the pet and a few words about it, in English (the font is Latin), and nothing about the
      // person's work. A mod cannot write bytes: Node writes the PNG (engine/share-save.js), and with no Node the picture is an SVG
      const worn = wornOf(c.closet, who.wear), animal = animalOf(who.species), stage = STATE[c.stage] ?? 'adult'
      const lines = shareLines({ name: who.name, animal: animalName('en', who.species), stage: text('en', `stage.${stage}`, {}, stage), peak: text('en', `peak.${extremes(who.stats).peak}`), stars: c.coins,
        golden: worn.includes(GOLDEN.id), rare: !RULES.animals.includes(who.species) && !REG.species[animal].pack, founder: c.owned.includes(EGGSHELL.id) })
      const pic = picture(portrait(animal, stage, worn), lines), dir = await configDir($, 'cachito-share'), node = dir ? await nodePath($) : ''
      if (!dir) return { text: say('share.failed') }
      const file = sharePath(dir, who.name, 'png')
      const saved = node ? await $.process.run([node, `${$.plugin.root}/engine/share-save.js`, file], { stdin: /** @type {Uint8Array & { toBase64(): string }} */ (png(pic)).toBase64() }).then((/** @type {{ exitCode: number }} */ r) => r.exitCode === 0, () => false) : false
      if (saved) return { text: `${say('share.saved', { path: file })}\n${say('share.saved.how')}` }
      const drawn = sharePath(dir, who.name, 'svg')
      return { text: await $.fs.write(drawn, svg(pic)).then(() => `${say('share.svg', { path: drawn })}\n${say('share.svg.how')}`, () => say('share.failed')) }
    }
    if (verb) return { text: say('cmd.unknown', { verb: tidy(verb, 24) }) } // a word that is no command says so, in one line: the card is /pet alone
    // lean is the style. Neither line claims a saving for this chat: the figures are the bench's, and are labelled so
    const isStyle = await styleOn($)
    const lean = say(isStyle && !styleNext(true) ? 'card.lean.wait' : isStyle ? 'card.lean.on' : await otherStyle($) ? 'card.lean.plugin' : 'card.lean.off', { bench: say('bench') })
    const names = OWNABLE.filter(i => c.owned.includes(i.id)).map(i => itemName(L, i))
    const spoken = await voiceTally($)
    const comments = !(await voiceChosen($)) ? say('card.comments.off')
      : spoken ? say('card.comments.on', { n: spoken.today, cap: RULES.voiceCapDay, today: money(spoken.todayUsd), all: money(spoken.usd) }) : say('card.comments.unread')
    const ends = extremes(who.stats), now = await $.clock.now()
    const stage = STATE[c.stage] ?? c.stage, label = Math.max(...STATS.map(name => cols(say(`stat.${name}`)))) + 1
    return {
      text: [
        `${say(wornOf(c.closet, who.wear).includes(GOLDEN.id) ? 'card.head.golden' : 'card.head', { name: who.name, animal: animalName(L, who.species), stage: text(L, `stage.${stage}`, {}, stage) })}   ${hearts(c.hearts)} ${say(view(cur, now).happy ? 'mood.happy' : 'mood.calm')}`,
        say('card.character', { line: personalityOf(who.stats, L) }),
        ...STATS.map((name, i) => `  ${pad(say(`stat.${name}`), label)}${bar(who.stats[i] ?? 0)} ${String(who.stats[i] ?? 0).padStart(3)}${name === ends.peak ? `  ${say('card.peak')}` : name === ends.weak ? `  ${say('card.weak')}` : ''}`),
        ...(who.personality ? [who.hatched ? say('card.adopted.on', { date: new Date(who.hatched).toISOString().slice(0, 10), text: who.personality }) : say('card.adopted', { text: who.personality })] : []),
        ...(who.cuddles ? [petted(L, who.cuddles) + say('card.last', { ago: ago(now - who.cuddled, L) })] : []),
        say('card.affection', { a: c.affection, days: count1(L, 'days', c.days) }) + (c.next ? say(c.stage === 'healthy' ? 'card.next.crown' : 'card.next.adult', { days: c.next.days, a: c.next.affection }) : ''),
        names.length ? say('card.points', { points: points(c.coins), items: names.join(say('sep')) }) : say('card.points.none', { points: points(c.coins) }),
        ...(c.closet.length ? [`  ${wornOf(c.closet, who.wear).length ? say('card.wears', { list: wornLine(L, c.closet, who.wear) }) : say('card.wears.none')}`] : []),
        lean,
        comments,
        ...(costUsd === undefined ? [] : [say('card.cost', { usd: `$${costUsd.toFixed(2)}` })]),
      ].join('\n'),
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = (await heldPet($)) ?? cur // after /clear the session's copy is empty until the next event
    const a = await heldAnim($)
    const p = (await heldPrefs($)) ?? await storedPrefs($)
    // E20: a store that cannot be read gives no pet: nothing is drawn until the real one can be, never one made up for the moment
    if (e.props.hasSurvey || !state || p.hidden || /** @type {any} */ (p).lost) return next(e)

    const real = view(/** @type {any} */ (state), await $.clock.now())
    const v = a.demo ? demoView(real, a.demo) : real
    const sp = species(p.species)
    const hatching = a.egg > 0
    const L = p.lang, who = { name: p.name, voice: speaker(p.stats, v.turn), lang: L, call: p.callme, callN: dayOf(await $.clock.now()) } // the dominant character, now and then the second: by the turn, so a line keeps its voice
    const quiet = (/** @type {string} */ say) => ({ say, fix: null, link: null, ask: '', label: '', more: null, aside: '' })
    const asking = !hatching && !a.demo && !!a.ask // the question about the voice holds the bubble until it is answered; a cuddle's line passes over it for its seconds
    const mine = zooOf(v.animals, p) // the animals to pick from: with more than one the skin menu has a part for them
    const dressing = !hatching && !asking && !a.demo && a.skin > 0 && (v.closet.length > 0 || mine.length > 1) // the row of the parts is open: the bubble tells what is on, the buttons are the parts
    const b = hatching ? quiet(text(L, a.egg > EGG_CRACKS ? 'egg.whole' : 'egg.crack')) : dressing ? { ...quiet([...(v.closet.length ? [wornLine(L, v.closet, p.wear, true)] : []), ...(mine.length > 1 ? [text(L, 'wears.part', { slot: text(L, 'part.animal'), item: animalName(L, p.species) })] : [])].join(text(L, 'sep'))), fix: text(L, 'skin.pick') } : a.noteLeft > 0 && a.note && !a.demo ? { ...quiet(a.note), fix: a.noteFix || null } : asking ? quiet(a.ask) : (a.demo ? a.demo === 'sleep' : a.sleep) ? quiet(text(L, 'sleep')) : bubble(v, who)
    // how long the phrase stays. What has its own time, or waits for an answer, is not timed here: the egg, the row of the parts, a
    // line held for its seconds, the demo, the question about the voice and a greeting that asks (both go at the next prompt).
    // The plain line of a calm chat is not news: it never opens the bubble.
    const now = await $.clock.now()
    const question = v.calm && v.talk?.kind === 'greet' && v.talk.greet === 'resume'
    const timed = !(hatching || dressing || asking || a.demo || (a.noteLeft > 0 && a.note) || question)
    const asleep = a.demo ? a.demo === 'sleep' : a.sleep
    const small = timed && !asleep && v.calm && !v.talk && !(v.long && (v.wait || !v.lean))
    const sig = JSON.stringify([b.say, b.fix, b.more?.say, b.aside])
    if (timed && sig !== bubbleSig) { bubbleSig = sig; bubbleAt = now } // what holds the bubble by itself for a while is not the phrase: after it, the phrase it covered is not new
    const stay = showFor(cols(b.say) + cols(b.fix ?? '') + cols(b.more?.say ?? '') + cols(b.aside), !!(b.ask || b.link || b.more?.ask))
    const open = !timed || (!small && now - bubbleAt < stay)
    bubbleOpen = open
    bubbleUntil = timed && open ? bubbleAt + stay : 0
    const ui = $.ui.resolve(e)
    const { Box, Text, Link, Button } = ui
    // the head of the band: who it is and its points, a star before the count (prize points, not money). Hearts and humour are on the /pet card only
    // beside them, only when other chats of the person are open: how many are working, waiting, or may be waiting for an OK
    const bare = `${p.name}  ★ ${v.coins}`, head = `${bare}${board && p.chats ? `  ·  ${board}` : ''}`
    // one row of text: the other surfaces, which have no cell grid, and a terminal too narrow or too low for the drawing.
    // Where there are no buttons the question about the comments says how to answer it
    const told = asking && !(a.noteLeft > 0 && a.note) ? `${b.say} ${text(L, 'comments.ask.how')}` : b.say
    const row = (/** @type {number} */ max) => Box({ children: [Text({ dimColor: true, children: [cut(open ? `${head}  ${told}` : head, max)] })] })

    if (e.surface !== 'terminal') return row(Infinity)
    const Raster = 'Raster' in ui ? ui.Raster : undefined
    if (!Raster) return next(e) // no cell grid on this surface: draw nothing
    const s = sprite(v, a, p)
    // The room the band has (`bodyColumns`, and `maxRows` where the engine gives it). With less than everything needs, in this
    // order: the bubble narrows and wraps; the row of the name gives way (the count of the other chats, the stars, then the
    // pet's own buttons); only the pet is left, with its name;
    // and under the width of the drawing, or the height of it, one row of text.
    const room = Number(e.props.bodyColumns) > 0 ? Number(e.props.bodyColumns) : Infinity, high = Number(e.props.maxRows) > 0 ? Number(e.props.maxRows) : Infinity
    if (room < s.columns || high < s.rows) return row(room)
    const beside = room - s.columns - 2 // what is left of the pet, less the tail and a cell of margin
    const wrapAt = Math.min(BUBBLE_MAX, beside - 4) // less the border and a cell of padding each side
    // the speech bubble: each phrase is wrapped here, by its width on screen, and the border hugs the widest line
    const more = b.more
    const phrases = [{ rows: wrap(b.say, Math.max(1, wrapAt)), dim: false }, ...(b.fix ? [{ rows: wrap(b.fix, Math.max(1, wrapAt)), dim: true }] : []), ...(more ? [{ rows: wrap(more.say, Math.max(1, wrapAt)), dim: true }] : []), ...(b.aside ? [{ rows: wrap(b.aside, Math.max(1, wrapAt)), dim: true }] : [])]
    const tall = Math.max(0, s.rows - PET_ROWS)
    const under = dressing || (asking && !(a.noteLeft > 0 && a.note)) || !!(b.ask || b.link || more?.ask) // a row of buttons under the bubble
    // shown when it is open, there is room for a line of BUBBLE_MIN columns, and it is not taller than the band may be
    const bubbled = open && wrapAt >= BUBBLE_MIN && tall + 3 + phrases.reduce((n, ph) => n + ph.rows.length, 0) + (under ? 1 : 0) <= high
    const inside = phrases.map(ph => Text({ ...(ph.dim ? { dimColor: true } : null), children: [ph.rows.join('\n')] }))
    const width = Math.max(...phrases.flatMap(ph => ph.rows.map(cols))) + 4 // border and one cell of padding each side
    // The buttons, in two rows. The pet's own (skin and pet) are in the row of the name, after it: `Tobo  ★ 29  ·  skin  pet`.
    // No button of ours hides the band: the engine draws its own `[-]` at the right end of the band, which folds it, and a second
    // one beside it was one too many (/pet hide still puts the pet away until /pet show). The buttons of a phrase, of a question or of the parts are in a row under the bubble, which
    // is there only when there are some: `ask` goes with its phrase. Each has how soon it goes when its row is too wide.
    /** @typedef {{ key: string, label: string, drop: number, el: () => any }} Key */
    /** @type {Key[]} */ const keys = [], /** @type {Key[]} */ own = []
    const adder = (/** @type {Key[]} */ list) => (/** @type {string} */ id, /** @type {string} */ label, /** @type {number} */ drop, /** @type {() => void} */ onPress, dim = false) => { list.push({ key: id, label, drop, el: () => Button({ key: id, label, plain: true, ...(dim ? { dimColor: true } : null), onPress }) }) }
    const key = adder(keys), ownKey = adder(own)
    const ask = bubbled ? b.ask : ''
    // a line that holds the bubble by itself (a cuddle's, an answer) covers the question for its seconds: the question's buttons wait with it
    const answering = asking && !(a.noteLeft > 0 && a.note)
    if (dressing) {
      for (const slot of partsOf(v.closet)) key(`slot-${slot}`, text(L, `part.${slot}`), 0, () => { turn($, slot).catch(() => {}) })
      if (mine.length > 1) key('slot-animal', text(L, 'part.animal'), 0, () => { turnAnimal($).catch(() => {}) })
      key('skin-done', text(L, 'btn.done'), 0, () => { skin($, false).catch(() => {}) }, true)
    } else {
      if (answering) { key('voice-on', text(L, 'btn.comments.on'), 0, () => { answerVoice($, true).catch(() => {}) }); key('voice-off', text(L, 'btn.comments.off'), 0, () => { answerVoice($, false).catch(() => {}) }) }
      else if ((v.closet.length || mine.length > 1) && !hatching) ownKey('skin', text(L, 'btn.skin'), 2, () => { skin($).catch(() => {}) }, true)
      if (ask) key('fix', b.label, 0, () => { fix($, ask).catch(() => {}) })
      if (more?.ask && bubbled) key('more', more.label, 0, () => { fix($, more.ask).catch(() => {}) })
      if (b.link && bubbled) { const href = b.link; keys.push({ key: 'guide', label: text(L, 'btn.guide'), drop: 1, el: () => Link({ href, label: text(L, 'btn.guide') }) }) }
      if (!hatching) ownKey('pet', text(L, 'btn.pet'), 3, () => { cuddle($).catch(() => {}) }, true)
    }
    const span = (/** @type {Key[]} */ list) => list.reduce((n, k) => n + cols(k.label), 0) + 2 * Math.max(0, list.length - 1)
    const fit = (/** @type {Key[]} */ list, /** @type {number} */ max) => { while (list.length && span(list) > max) list.splice(list.reduce((at, k, i) => k.drop >= /** @type {Key} */ (list[at]).drop ? i : at, 0), 1) }
    // The row of the name in `max` columns. What gives way when it is too wide, in this order: the count of the other chats
    // (/pet chats tells it), then the stars (the /pet card has them), and only then the pet's own buttons (pet, then
    // skin: each has a command): skin and pet stay as long as there is room for them beside the name. Last the name is cut.
    const headRow = (/** @type {number} */ max) => {
      const says = [...new Set([head, bare, p.name])], keysWide = () => own.length ? 5 + span(own) : 0 // the dot between the name and the buttons, two cells each side of it
      let said = says.find(t => cols(t) + keysWide() <= max)
      if (said === undefined) { fit(own, max - cols(p.name) - 5); said = own.length ? p.name : says.find(t => cols(t) <= max) ?? p.name } // with no button left, what fits of the stars and the count is back
      return Box({ key: 'head', flexDirection: 'row', gap: 2, children: [Text({ dimColor: true, children: [cut(said, max)] }), ...(own.length ? [Text({ dimColor: true, children: ['·'] })] : []), ...own.map(k => k.el())] })
    }
    const pet = Box({ marginTop: Math.max(0, PET_ROWS - s.rows), children: [Raster({ key: s.key, columns: s.columns, rows: s.rows, cells: s.cells })] })

    if (!bubbled) {
      // No bubble (closed, or no room for it): the pet, with the row of its name, stars and buttons beside it and no row under it:
      // the band is as tall as the drawing. The row goes above the drawing when the name does not fit beside it and the band may
      // be a row taller
      const aside = cols(bare) + 1 + s.columns <= room // judged without the count of the other chats, which gives way first
      return Box({ flexDirection: 'column', width: '100%', alignItems: 'flex-end', children:
        aside ? [Box({ key: 'beside', flexDirection: 'row', children: [headRow(room - s.columns - 1), Box({ width: 1 }), pet] })] : high > Math.max(PET_ROWS, s.rows) ? [headRow(room), pet] : [pet] })
    }
    fit(keys, beside)
    // bottom right, next to the prompt, where the old /buddy sat: text first, pet at the edge.
    // Rows: 0 the head line with the pet's own buttons, 1 the bubble's top border, 2 its first line. The pet's eyes are 4 rows above its feet, so a pet
    // of PET_ROWS has them on row 2, where the tail is; a shorter frame is pushed down to keep the feet (and the eyes) still, and
    // under a taller one (a pet on its skateboard) the bubble and the tail come down with the eyes.
    return Box({ flexDirection: 'row', width: '100%', justifyContent: 'flex-end', children: [
      Box({ flexDirection: 'column', alignItems: 'flex-end', marginTop: tall, children: [
        headRow(beside),
        Box({ key: 'bubble', flexDirection: 'column', width, flexShrink: 0, paddingX: 1, borderStyle: 'round', borderDimColor: true, children: inside }),
        ...(keys.length ? [Box({ key: 'keys', flexDirection: 'row', gap: 2, children: keys.map(k => k.el()) })] : []),
      ] }),
      Box({ key: 'tail', marginTop: 2 + tall, marginRight: 1, children: [Text({ dimColor: true, children: ['─'] })] }),
      pet,
    ] })
  })
}
