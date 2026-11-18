// Hatchling for Claude Code: feeds session events to the engine and draws the pet above the prompt.
// As installed it observes only: nothing is added to the model's context. One lever the person turns on changes that:
// /pet briefox adds one sentence to the system prompt, in a section of its own (briefox/text.js; the one lever the bench showed).
// In the code the lever keeps the name it had when it was eight lines: `style` (the preference, kept so that an earlier choice still holds), `lean` (the engine's word).
// What the pet says is local text. A button only fills the prompt box: the person sends it, or not.
// The comments spend the person's tokens: a small model writes a line about the turn (engine/voice.js; in the code and the store
// they are still the `voice`). They are on as installed: a notice says so once, before any is asked for, and /pet comments off stops them.
// The pet speaks English, Spanish, Portuguese or Simplified Chinese (engine/lang/): /pet lang picks, and a newborn takes the system's.

import { atom, read, update } from 'claude-code'
import { initialState, reduce, view, card, dayOf, sync, adopt, shared, whole, program, SHOP, SOLD, COATS, GOLDEN, PLAIN, OWNABLE, EGGSHELL, FOUNDER_UNTIL, birth, sells, WEARABLE, SLOTS as PARTS, RULES, wornOf, putOn, takeOff, turnSlot } from '../engine/engine.js'
import { MODEL, MODEL_MAX, asModel, unavailable, tellGone, measuredHow, tally, due, left, reserve, settle as settled, average, system, summary, news, reply, clean, tooLong, pathy, notice, lastTurn, recap as recapOf, cleanRecap, RECAP_COST } from '../engine/voice.js'
import { whole as diaryOf, open as diaryOpened, touch as diaryTouched, cuddled as diaryCuddled, bought as diaryBought, grew as diaryGrew, memory, saying, told, memories, page, dated, lasting } from '../engine/diary.js'
import { marks, greeting, finished, folder, counts, listing, leftOf, WATCH, sight, seen, watched, namesOf } from '../engine/company.js'
import { titles, TITLES } from '../engine/titles.js'
import { whole as workOf, opened as workOpened, turned as workTurned, said as workSaid, report, yesterday } from '../engine/work.js'
import { whole as remindersOf, asked as remindAsked, add as remindAdd, done as remindDone, ready as remindReady, due as remindDue, LIMITS as REMIND } from '../engine/remind.js'
import { bubble, cuddle as cuddleLine, called, ago, since, BENCH, BRIEF, BRIEF_ID, DOCS } from '../engine/catalog.js'
import { born as bornAs, newSeed, cleanName, asTrait, traitsOf, statsOf, asStats, extremes, speaker, personalityOf, bar, buddy, roll as rollOf, STATS, NAME_MAX, cleanCall, CALL_MAX } from '../engine/persona.js'
import { text, put, list as listOf, voicedAs, asLang, fromLocale, LANGS } from '../engine/lang/index.js'
import { cols, pad, wrap, tidy } from '../engine/width.js'
import { pick } from '../engine/pick.js'
import { whole as routineOf, touch as routineTouch, next as routineNext, answer as routineAnswer, setUntil, usual as routineUsual, stage as warnStage, minsLeft, back as backKind, switched as routineSwitched, cleared as routineCleared, hhmm, minutes as minutesOf, LIMITS as ROUTINE } from '../engine/routine.js'
import zoo from '../sprites/zoo.js'
import { REG, install, coatOf, dressed, portrait, LIMITS as SKIN_LIMITS } from '../engine/skins.js'
import { shareLines, picture, png, svg, sharePath } from '../engine/share.js'
import { pack as movePack, parse as moveParse, movePath, asked as moveAsked, stageOf, LIMITS as MOVE_LIMITS } from '../engine/move.js'

const pet = atom(/** @type {const} */ ({ plugin: 'hatchling', key: 'pet' }), null)
// `skin` is the ticks the row of the parts stays open, in place of the buttons, after the skin button.
// `idle` is the small gesture a calm pet is making and `idleN` its frame; `spark` the sparkles lit next to a golden coat, a bit each spot; `hush` counts the phrases that left the bubble, only to draw again.
// `sig` and `sigAt` are the phrase last shown and when it came up: kept here so that a reload of the mod does not show again a phrase that had its time
// `note` is a line the pet says for a while by itself, over any other line (its answer to /pet say, the line of a cuddle), `noteFix` the dim line under it, `noteLeft` the ticks it stays: then the bubble is what it was
// `ask` is a line that holds the bubble with its buttons until it is answered: the notice that the comments are on when `askKind` is '',
// else one of the routine (engine/routine.js), `askKind` its kind and `askOpts` the answers it takes, with a comma between them.
// `back` is when the person last did something before a pause of an hour or more: the welcome back holds the bubble until they do something again
// `recap` is where the work got to, as the small model said it after a pause, and `recapAt` when that work was left: the line holds
// the bubble until the next prompt, with its time word made anew at each drawing. Here and nowhere else: never in the store
const ANIM0 = { n: 0, rare: -1, demo: '', sleep: false, egg: 0, love: 0, ask: '', askKind: '', askOpts: '', back: 0, note: '', noteFix: '', noteLeft: 0, skin: 0, idle: '', idleN: 0, spark: 0, hush: 0, sig: '', sigAt: 0, recap: '', recapAt: 0 }
const NO_ASK = { ask: '', askKind: '', askOpts: '' }
const anim = atom(/** @type {const} */ ({ plugin: 'hatchling', key: 'anim' }), ANIM0)
// Every change of the animation's state goes through `animate`, which counts it: the tick reads that state once and again only
// after a change. And it wakes the ticker: a pet asleep with nothing under way ticks once a frame of its sleep (DOZE_MS), and is
// back to TICK_MS the moment anything changes what it shows.
// The count goes up before the write and after it: a read made while the write is under way is never taken for the new state.
let stirs = 0, prefStirs = 0
const animate = async (/** @type {any} */ $, /** @type {(a: typeof ANIM0) => typeof ANIM0} */ fn) => { stirs++; if (tickEvery === DOZE_MS) await wake($); try { return await update($, anim, /** @type {any} */ (fn)) } finally { stirs++ } }
// While a tick runs, what the ticks read of the session's state is kept until the next change: a tick and its look at the other
// chats ask for the animation and the preferences a dozen times. Kept from a tick to the next for KEEP_TICKS at most, then asked
// again whatever the count says, and dropped when a session starts or ends: the engine empties the state at a /clear without a
// write of ours. Outside a tick nothing is kept: every read asks the session.
/** @typedef {{ anim?: { at: number, v: typeof ANIM0 }, prefs?: { at: number, v: any } }} Memo */
/** @type {Memo | null} */ let memo = null
/** @type {Memo} */ let kept = {}
const KEEP_TICKS = 4
const PREFS0 = { hidden: false, wear: '', species: '', born: '', style: false, seed: 0, name: '', stats: /** @type {number[]} */ ([]), personality: '', hatched: 0, asked: false, cuddles: 0, cuddled: 0, voice: true, voiceAsked: false, lang: '', missing: '', chats: true, callme: '', model: '' }
const prefs = atom(/** @type {const} */ ({ plugin: 'hatchling', key: 'prefs' }), PREFS0)
/** The preferences the session holds are written here and nowhere else, counted as the animation's changes are. */
const hold0 = async (/** @type {any} */ $, /** @type {any} */ p) => { prefStirs++; try { return await update($, prefs, () => p) } finally { prefStirs++ } }

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
  await animate($, a => ({ ...a, note: say, noteFix: fix, noteLeft: Math.round(ms / TICK_MS), sleep: false }))
}
const HEART = 0x2665, HEART_RED = 0xe53935
const TICK_MS = 500
const DOZE_TICKS = 4, DOZE_MS = DOZE_TICKS * TICK_MS // a frame of the sleep: what a pet asleep with nothing else under way ticks at
// One ticker a process, whatever the starts of a session (a /clear, a resume, a reload): the one before is stopped, so the pet never
// moves at twice its pace. `tickEvery` is its period now, `dozeAt` the time of the last slow tick (kept by adding, to count the ticks missed at a wake).
/** @type {{ cancel: () => void } | null} */ let ticker = null
let tickEvery = 0, dozeAt = 0
function pace(/** @type {any} */ $, /** @type {number} */ ms) {
  if (ticker && tickEvery === ms) return
  ticker?.cancel()
  tickEvery = ms
  ticker = $.clock.every(ms, () => { tick($).catch(() => {}) })
}
/** Out of the slow ticks, at once: the count of ticks takes the ones that would have passed since the last slow one, so what is counted in ticks (a look at the other chats every 10 s) keeps its time. */
async function wake(/** @type {any} */ $) {
  if (tickEvery !== DOZE_MS) return
  pace($, TICK_MS)
  const now = await $.clock.now().catch(() => dozeAt)
  ticks += Math.max(0, Math.min(DOZE_TICKS - 1, Math.floor((now - dozeAt) / TICK_MS)))
}
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
// Only an id acts: it is unique, and two things may one day be shown under the same name. A typed word that is not an id but is a shown
// name, in any of the languages, is answered with the ids it could be, and nothing is bought, put on or switched (engine/pick.js).
const TONGUES = Object.keys(LANGS)
/** Things and animals with every name they are shown under, for that answer. */
const asThings = (/** @type {{ id: string, name: string, pack?: string, names?: Record<string, string> }[]} */ items) => items.map(i => ({ id: i.id, names: i.pack ? [...Object.values(i.names ?? {}), i.name] : [...TONGUES.map(l => text(l, `item.${i.id}`, {}, i.name)), i.name] }))
const asAnimals = (/** @type {string[]} */ ids) => ids.map(id => { const sp = REG.species[id]; return { id, names: sp?.pack ? Object.values(sp.names ?? {}).map(String) : TONGUES.map(l => text(l, `animal.${id}`, {}, id)) } })
/** Two sentences in one line: a space between them, none after a Chinese full stop. */
const after = (/** @type {string} */ a, /** @type {string} */ b) => `${a}${/[。！？]$/.test(a) ? '' : ' '}${b}`
/** The one-line answer to a word that is no id: the commands it may have meant, or the closest ids, or `none`. Nothing is done. */
const meantLine = (/** @type {string} */ lang, /** @type {string} */ verb, /** @type {{ meant: string[], near: string[] }} */ got, /** @type {string} */ none) =>
  got.meant.length ? text(lang, 'pick.meant', { list: got.meant.map(id => `/pet ${verb} ${id}`).join(', ') }) : got.near.length ? after(none, text(lang, 'pick.near', { list: got.near.join(', ') })) : none
/** The animals of the installed skin packs: the person's at once, for nothing. */
const packAnimals = () => Object.keys(REG.species).filter(id => REG.species[id].pack)
/** An animal's name as it is typed, with its pack after it when it has one. */
const typed = (/** @type {string} */ id) => REG.species[id]?.pack ? `${id} (${REG.species[id].pack})` : id
/** The animals a pet can be shown as: the one it was born as (free, always its own), the ones unlocked, the ones of the installed skin packs, and the one it is shown as now, which a pet of before the prices keeps. */
const zooOf = (/** @type {string[]} */ animals, /** @type {{ born: string, species: string }} */ p) => [...new Set([p.born, ...RULES.animals.filter(id => animals.includes(id)), ...packAnimals(), p.species])].filter(isAnimal)
const partOf = (/** @type {string} */ id) => WEARABLE.find(i => i.id === id)?.slot ?? ''
const STYLE_BENCH = `${BENCH}. Every run: bench/RESULTS.md in the repository.`

// the environment switches are for headless runs, where no command can be typed
// Growth of the context under which switching the style mid-chat is cheap: what the chat added since its first request (or the first
// after a compaction), not its size, which in the desktop app or with many MCP servers is 60k and more before a word is said.
// 15k: the 30k of context of the rule before this one, less the 17k a chat of the bench started at.
const STYLE_SWITCH_UNDER = 15_000
/** @type {boolean | undefined} */ let styleLive // what the system prompt carries now; follows the preference only when the switch is cheap
const styleOn = async (/** @type {any} */ $) => (await getPrefs($)).style || (await $.env.get('HATCHLING_STYLE').catch(() => undefined)) === '1'
/** Whether the next request carries the style: the choice when a switch is cheap (no request yet, a chat that has grown little, right after a compaction), else what it carries now. */
const styleNext = (/** @type {boolean} */ want) => styleLive === undefined || ctxTokens - baseTokens < STYLE_SWITCH_UNDER || afterCompact ? want : styleLive
// The briefox plugin (briefox/ in this repository) sends the same section under the same id, on as installed. With it the sentence is
// in the system prompt whatever /pet briefox says, and the pet must not call that `briefox off`. Asked of the prompt itself, not of the
// other plugin's store: $.prompt.compose goes through every other plugin's hook, above this one or below, and not through this one.
/** @type {boolean | undefined} */ let styleOther // whether the others put the style in; undefined: not asked since the last prompt was composed
/** @type {import('claude-code').PromptComposeInput | undefined} */ let styleAsked // the last prompt composed: the same facts are asked again
let styleProbing = false // true while the pet asks what the others add: where the call comes back through this hook too (the test kit), the pet then adds nothing
/**
 * The facts to ask a prompt with before any was composed in this chat: whole, since `next` refuses an argument that lacks one of
 * them and the hook of the plugin asked (briefox's) would be skipped, its sentence missing from the answer. The session's model and
 * surfaces; no tool, output style or trait, which do not bear on whether the sentence is added. Undefined when the session tells no model.
 */
async function composeFacts(/** @type {any} */ $) {
  const model = await $.session.model().catch(() => undefined)
  return model ? { model, promptModel: model, surfaces: await $.session.surfaces().catch(() => []), tools: [], outputStyle: null, traits: [] } : undefined
}
async function otherStyle(/** @type {any} */ $) {
  if (styleOther === undefined) {
    styleProbing = true
    try { styleOther = (await $.prompt.compose(styleAsked ?? await composeFacts($))).sections.some((/** @type {any} */ s) => s.id === BRIEF_ID) } catch { styleOther = false } finally { styleProbing = false }
  }
  return styleOther
}
/** Lean for the engine. Lean is the style alone: `lean` with the style really in (by the pet or by the briefox plugin), `wait` with it chosen and waiting for a cheap moment. */
async function leanState(/** @type {any} */ $) {
  const style = await styleOn($), live = styleNext(style)
  if (!style && await otherStyle($)) return { lean: true, wait: false }
  return { lean: style && live, wait: style && !live }
}
/** Tells the engine where lean stands; it cheers when a waiting style gets in. */
const feedLean = async (/** @type {any} */ $) => leanState($).then(({ lean, wait }) => feed($, { type: 'lean', on: lean, wait })).catch(() => {})
// Under the bench (bench/run.mjs sets HATCHLING_BENCH to a folder of its own, and nothing else does) the mod must leave the person's pet alone:
// the store is then a map in memory, never read from disk nor written to it. The lever comes from
// the arm's variable only, since the preferences read are the defaults.
/** @type {string | undefined} */ let benchDir // '' when not under the bench
/** @type {Record<string, unknown>} */ const benchStore = {}
const bench = async (/** @type {any} */ $) => benchDir ??= String((await $.env.get('HATCHLING_BENCH').catch(() => '')) ?? '')
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
/** @type {string[]} */ let formerIds = [] // the ids this process had before a /clear: its own closed chats, never "another chat" on the board
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
// The thin watcher (engine/company.js `seen`): `claude agents --json` lists every live session, the ones without Hatchling too. One
// look serves every chat: it is kept in the store (ids, folders, statuses, one fixed label, the names the person gave), and a chat takes a new one only when
// the one kept is WATCH.everyMs old. Never under the bench or without a person, never two at once in a chat, with a time limit;
// the first failure (no `claude` found, an older version, a surface that runs no command) ends it for this chat, which then
// knows the other chats by their marks alone, as before.
let watching = false, watchOff = false
/** What the watcher last saw, as the store has it; null with none. */
async function looked(/** @type {any} */ $) { return social && !(await bench($)) ? sight(await storeGet($, 'agents').catch(() => null)) : null }
async function watch(/** @type {any} */ $) {
  if (watchOff || watching || !social || await bench($) || !(await getPrefs($)).chats) return
  const none = {}, raw = await storeGet($, 'agents').catch(() => none), was = raw === none ? null : sight(raw), now = await $.clock.now()
  if (raw === none || (was && now - was.at < WATCH.everyMs && was.at - now < WATCH.everyMs)) return
  watching = true
  try {
    const home = await $.env.get('HOME').catch(() => undefined), local = home ? `${home}/.local/bin/claude` : ''
    const bin = (await nodePath($, 'claude')) || (local && await $.fs.stat(local).then(() => local, () => ''))
    const r = bin ? await $.process.run([bin, 'agents', '--json'], { timeoutMs: WATCH.timeoutMs }) : null
    const look = r && r.exitCode === 0 && !r.isStdoutTruncated ? seen(r.stdout, was, await $.clock.now()) : null
    if (look) await storeSet($, 'agents', look).catch(() => {})
    else watchOff = true
  } catch { watchOff = true } finally { watching = false }
}
/** The other chats as this one knows them: their marks, and what the watcher saw of the ones that left none. */
async function known(/** @type {any} */ $, /** @type {number} */ now) { return watched(await chats($), await looked($).catch(() => null), await myId($), now, formerIds) }
/**
 * The automatic titles (/pet chats titles on; off unless the person turned it on, the choice under the store's key `titles`): for
 * the other chats listed that the person did not name, the last title line of each one's transcript (engine/titles.js). With it
 * off nothing is looked for: no stat, no list, no command. The file system here reads a whole file or none, and none over 4 MiB,
 * so the end of a transcript comes from `tail -c`: a bounded piece, of which only a title line is parsed. What is read stays in
 * `titled`, in this chat's memory: never in the store or the state, the diary, an export, a picture or a call to a model.
 */
/** @type {Map<string, import('../engine/titles.js').Titled>} */ const titled = new Map()
async function titlesOf(/** @type {any} */ $, /** @type {{ id: string, cwd: string }[]} */ rows, /** @type {number} */ now) {
  if (!social || await bench($) || (await storeGet($, 'titles').catch(() => false)) !== true) { titled.clear(); return {} }
  const base = (await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)) || await $.env.get('HOME').then((/** @type {string | undefined} */ h) => h ? `${h}/.claude` : '', () => '')
  const bin = base && rows.length ? await nodePath($, 'tail') : ''
  if (!bin) return {}
  /** @type {import('../engine/titles.js').TitleIo} */ const io = {
    stat: path => $.fs.stat(path),
    list: path => $.fs.list(path),
    tail: async (path, bytes) => { const r = await $.process.run([bin, '-c', String(bytes), path], { timeoutMs: TITLES.timeoutMs }); return r.exitCode === 0 ? r.stdout : '' },
  }
  return titles(io, `${String(base).replace(/[\\/]+$/, '')}/projects`, rows, titled, now)
}
/** This chat's id; a new one after /clear. */
async function myId(/** @type {any} */ $) { return chatId ||= String(await $.session.id().catch(() => '') || `c${Math.random().toString(36).slice(2)}`) }
/** @type {import('../engine/company.js').Mark | null} */ let myMark = null // this chat's mark as it last wrote it
/** @type {{ id: string, at: number } | null} */ let asked = null // a tool call the agent was told to ask leave for, and since when: not started yet
let peerSaidAt = -Infinity // when this chat last told of another one
let board = '' // how many of the other chats wait for the person (their turn ended, or a call waits for an OK), as the head of the band says it; '' with none
const chatsOn = async (/** @type {any} */ $) => social && !!cwd && (await getPrefs($)).chats
/**
 * Leaves this chat's mark: the folder, now, and whether the turn ended. With the board on it also says it is alive (`beat`), so
 * the other chats count it; with the board off the mark is the least there ever was, and the others take the chat for closed.
 */
async function mark(/** @type {any} */ $, /** @type {boolean} */ done, /** @type {Partial<import('../engine/company.js').Mark>} */ more = {}) {
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
  ydayLine = await workOpen($, now).catch(() => ''); ydayUntil = now + BUBBLE_MAX_MS // yesterday in one line, under the first greeting of a day
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
// The work diary (engine/work.js): counts and folder names by day, for /pet diary and the line about yesterday. Kept as the diary is.
let ydayLine = '', ydayUntil = 0 // yesterday in one line, said under this chat's greeting until then; '' when another chat said it today
/** The work counters in the store, whole; null when they are not kept here or the store cannot be read. */
async function workGet(/** @type {any} */ $) {
  if (!(await diaryOn($))) return null
  const none = {}, raw = await storeGet($, 'work').catch(() => none)
  return raw === none ? null : workOf(raw)
}
async function workDo(/** @type {any} */ $, /** @type {(w: import('../engine/work.js').Work, now: number) => import('../engine/work.js').Work} */ change) {
  const w = await workGet($)
  if (w) await storeSet($, 'work', change(w, await $.clock.now())).catch(() => {})
}
/** A chat opens: counted in its day, and the line about yesterday comes back when no chat said it today ('' when there is none). */
async function workOpen(/** @type {any} */ $, /** @type {number} */ now) {
  const was = await workGet($)
  if (!was) return ''
  const line = yesterday(was, await chats($), { id: await myId($), now }, (await getPrefs($)).lang)
  await storeSet($, 'work', workSaid(workOpened(was, { now, folder: folder(cwd) }), now))
  return line
}
// Reminders (engine/remind.js): the person's own lines, in the store under `reminders`. Read and written here and nowhere else:
// no request to a model, no picture and no export file is ever made from them.
let remindAt = 0 // when this chat shows the reminders next: a while after it opened, and when the person is back after a pause; 0 for not
/** /pet remind and /pet reminders: what was asked is done, and the reply comes back as text: the command's answer, a line of the chat. */
async function reminders(/** @type {any} */ $, /** @type {string} */ verb, /** @type {string} */ typed) {
  const L = (await getPrefs($)).lang, now = await $.clock.now(), none = {}, raw = await storeGet($, 'reminders').catch(() => none)
  if (raw === none) return text(L, 'remind.unkept')
  const list = remindersOf(raw), keep = (/** @type {unknown} */ next) => storeSet($, 'reminders', next).then(() => true, () => false)
  const left = (/** @type {number} */ ms) => { const min = Math.max(1, Math.round(ms / 60_000)); return min >= 2880 ? count1(L, 'days', Math.round(min / 1440)) : lasting(min, L) }
  const when = (/** @type {{ at?: number }} */ r) => !r.at ? '' : r.at <= now ? text(L, 'remind.due') : text(L, 'remind.in', { dur: left(r.at - now) })
  if (verb === 'reminders') return list.length ? [text(L, 'remind.title'), ...list.map((r, i) => `  ${i + 1}. ${r.text}${r.at ? `  (${when(r)})` : ''}`), text(L, 'remind.note')].join('\n') : text(L, 'remind.none')
  const ask = remindAsked(typed, now)
  if (ask.verb === 'add') {
    const r = remindAdd(list, ask, now)
    if (r.full) return text(L, 'remind.full', { max: REMIND.max })
    if (!(await keep(r.list))) return text(L, 'remind.unkept')
    return ask.at ? text(L, 'remind.kept.at', { n: r.n, when: when(ask), text: ask.text }) : text(L, 'remind.kept', { n: r.n, text: ask.text })
  }
  if (ask.verb === 'done') {
    const r = remindDone(list, ask.n)
    if (!r.gone.length) return ask.n === 'all' ? text(L, 'remind.none') : text(L, 'remind.done.none', { n: ask.n })
    if (!(await keep(r.list))) return text(L, 'remind.unkept')
    return ask.n === 'all' ? text(L, 'remind.done.all', { n: r.gone.length }) : text(L, 'remind.done.one', { text: r.gone[0]?.text ?? '' })
  }
  return text(L, 'remind.usage')
}
/**
 * Looked at every PEER_TICKS: a timed reminder that fell due is said once, by a chat the person used lately (it is then marked as
 * said for every chat); and when this chat's moment has come (`remindAt`) the first of the ones to show is said. The line holds
 * the bubble for RULES.remindShowMs; the reminder stays in the list until /pet remind done. Never while the egg hatches or
 * another held line is up: it is looked at again. A question that waits does not hold it back: the line passes over it.
 */
async function remind(/** @type {any} */ $) {
  if (!social || await bench($)) return
  const a = await heldAnim($), p = await getPrefs($), now = await $.clock.now(), none = {}
  if (p.hidden || a.egg > 0 || a.noteLeft > 0 || a.demo) return // over the question about the comments it is said all the same: a held line covers the question for its seconds, and the question is back after
  const raw = await storeGet($, 'reminders').catch(() => none)
  if (raw === none) return
  const { list, hit } = remindDue(remindersOf(raw), now), fell = hit && now - lastOwn <= RULES.peerActiveMs ? hit : null
  if (fell && !(await storeSet($, 'reminders', list).then(() => true, () => false))) return
  const open = remindReady(list, now), mine = remindAt > 0 && now >= remindAt, first = fell ?? (mine ? open[0] : null)
  if (mine) remindAt = 0
  if (!first) return
  await hold($, text(p.lang, 'remind.say', { text: tidy(first.text, 80) }), open.length > 1 ? text(p.lang, 'remind.more', { n: open.length - 1 }) : text(p.lang, 'remind.how', { n: first.n }), RULES.remindShowMs)
}
// The routine (engine/routine.js): the pet keeps company through the day with fixed lines, the comments on or off. It asks a few
// closed questions (what time do you finish, had your coffee, had lunch), each with its buttons and /pet yes, /pet no, /pet answer;
// warns before the finish time; greets the person who is back after an hour or more; and keeps the answers of the last 30 days in
// the store under `routine`, one copy for all the chats. Zero tokens: nothing of it is sent to a model, and no line is asked of one.
let personAt = 0 // when the person last did something in this chat: a prompt, a button, a /pet command (not the agent's work)
let warned = '' // the warning about the finish time this chat showed last: the time and the stage
/** @type {number | undefined} */ let usualStart // the minute of the day the person usually starts, once the days say so: for the morning's greeting
const routineGet = async (/** @type {any} */ $) => { const none = {}, raw = await storeGet($, 'routine').catch(() => none); return raw === none ? null : routineOf(raw) }
const routineSet = (/** @type {any} */ $, /** @type {unknown} */ r) => storeSet($, 'routine', r).then(() => true, () => false)
/** The line of the pet's character among the six ways a key is said. */
const voiced = (/** @type {{ lang: string, stats: number[] }} */ p, /** @type {string} */ key, /** @type {Record<string, string | number>} */ fill = {}) => put(voicedAs(p.lang, key, STATS.indexOf(speaker(p.stats, cur?.turn ?? 0))), fill)
/**
 * The person did something here: a prompt, a button, a /pet command, a chat opened. The welcome back goes, and the day of the
 * routine has started if it had not and lasts until now. Never without a person, nor under the bench.
 */
async function touched(/** @type {any} */ $) {
  await wake($) // the person is here: the quick ticks at once, whatever the pet was doing
  const now = personAt = await $.clock.now()
  if ((await heldAnim($)).back) await animate($, a => ({ ...a, back: 0 }))
  if (!social || await bench($)) return
  const r = await routineGet($)
  if (r) await routineSet($, routineTouch(r, now))
}
/** A question of the routine goes up: its words in the language, its kind and the answers its buttons give. */
async function putQuestion(/** @type {any} */ $, /** @type {import('../engine/routine.js').Question} */ q) {
  const L = (await getPrefs($)).lang
  await animate($, a => ({ ...a, ask: text(L, `ask.${q.kind}`, { time: q.time ? hhmm(q.time) : '' }), askKind: q.kind, askOpts: q.opts.join(','), sleep: false }))
}
/** What a button of a question shows for an answer: yes, no, later, or an hour as the clock shows it. */
/** How a question is answered where there are no buttons: the command with its choices, and for a time that is none of them /pet until. */
const howTo = (/** @type {string} */ lang, /** @type {string[]} */ opts) => `${text(lang, 'ask.how', { list: opts.filter(o => o !== 'other').join('|') })}${opts.includes('other') ? ` ${text(lang, 'ask.how.until')}` : ''}`
const answerLabel = (/** @type {string} */ lang, /** @type {string} */ opt) => /^\d+$/.test(opt) ? `${opt.padStart(2, '0')}:00` : text(lang, `btn.${opt}`, {}, opt)
/**
 * An answer, from a button or from /pet yes, /pet no, /pet answer <choice>: to the question about the comments when that is the
 * one up, else to the one of the routine, which may have been asked in another chat. The line to say back; `again` when the
 * answer brought the next part of the same question, which is up now.
 */
async function answerQ(/** @type {any} */ $, /** @type {string} */ choice) {
  const a = await heldAnim($), L = (await getPrefs($)).lang, now = await $.clock.now()
  if (a.ask && !a.askKind) {
    if (choice !== 'yes' && choice !== 'no') return { line: text(L, 'answer.what', { list: 'yes, no' }), again: false }
    await setVoice($, choice === 'yes') // to the notice: yes leaves the comments on, no turns them off
    return { line: text(L, choice === 'yes' ? 'toast.comments.on' : 'toast.comments.off'), again: false }
  }
  const r = await routineGet($)
  if (!r) return { line: text(L, 'routine.unkept'), again: false }
  const res = routineAnswer(r, choice, now)
  if (!res.ok) {
    if (a.ask && !res.opts.length) await animate($, x => ({ ...x, ...NO_ASK })) // its time passed, or it was answered elsewhere
    return { line: text(L, res.reply, { list: res.opts.join(', ') }), again: false }
  }
  if (!(await routineSet($, res.r))) return { line: text(L, 'routine.unkept'), again: false }
  if (res.ask) { await putQuestion($, res.ask); return { line: `${text(L, `ask.${res.ask.kind}`)} ${howTo(L, res.ask.opts)}`, again: true } }
  if (a.ask && !res.r.q) await animate($, x => ({ ...x, ...NO_ASK })) // `other` leaves the question up: /pet until answers it
  if (res.time) warned = ''
  return { line: text(L, res.reply, { time: res.time ? hhmm(res.time) : '' }), again: false }
}
/** A button of a question: the answer, and what the pet says back held in the bubble for a while. */
async function pressAnswer(/** @type {any} */ $, /** @type {string} */ choice) {
  const r = await answerQ($, choice)
  if (!r.again) await hold($, r.line, '', RULES.sayShowMs)
}
/**
 * Looked at every PEER_TICKS. The welcome back: once the person has done nothing in any chat for an hour the line goes in the
 * bubble and stays until they do something, here; done elsewhere, it goes. A warning about the finish time is shown in every open
 * chat's band, and said once: the chat that sees it first marks it in the store and makes the toast. A question, or a line that
 * follows an answer, comes only in a chat the person used lately, with no turn running, nothing typed and nothing else held in
 * the bubble; never over the question about the comments, nor before it was asked.
 */
async function company(/** @type {any} */ $) {
  if (!social || await bench($)) return
  const a = await heldAnim($), p = await getPrefs($), now = await $.clock.now()
  if (p.hidden || a.egg > 0 || a.demo) return
  const r = await routineGet($)
  if (!r) return
  { const u = routineUsual(r, now); usualStart = u.days >= ROUTINE.usualDays ? u.start : undefined } // a habit from three days on
  const seen = Math.max(r.seen, personAt)
  if (a.back && r.seen > a.back && r.seen > personAt) await animate($, x => ({ ...x, back: 0 })) // back, in another chat
  else if (!a.back && backKind(seen, now)) await animate($, x => ({ ...x, back: seen, sleep: false }))
  // a question that is up here and no longer in the store: answered in another chat, or its 30 minutes passed
  if (a.ask && a.askKind && (r.q?.kind !== a.askKind || now - r.q.at >= ROUTINE.questionMs || r.q.at > now)) await animate($, x => ({ ...x, ...NO_ASK }))
  const w = warnStage(r.until, now), key = `${r.until}:${w}`, line = w ? voiced(p, `until.${w}`, { time: hhmm(r.until), min: String(minsLeft(r.until, now)) }) : ''
  if (w && warned !== key) { warned = key; await hold($, line, '', RULES.warnShowMs) }
  const here = personAt > 0 && now - personAt <= RULES.peerActiveMs, held = (await heldAnim($)).noteLeft > 0 && !(w && warned === key)
  const free = here && !held && !a.ask && p.voiceAsked && !turnAt && !(await typing($))
  const res = routineNext(r, now, { busy: !free, lines: here && !held })
  if (res.changed && !(await routineSet($, res.r))) return // nothing is asked that could not be kept
  if (res.warn) await $.ui.toast(line).catch(() => {})
  if (res.ask) await putQuestion($, res.ask)
  if (res.say) await hold($, voiced(p, res.say === 'lunch.no' ? 'lunch.no' : res.say === 'coffee.no' ? 'cup.no' : 'cup.yes'), '', RULES.remindShowMs)
}
/** /pet until: today's finish time, said, set or dropped. The answer is a line of the chat. */
async function untilCmd(/** @type {any} */ $, /** @type {string} */ typed) {
  const L = (await getPrefs($)).lang, now = await $.clock.now(), r = await routineGet($)
  if (!r) return text(L, 'routine.unkept')
  if (!typed.trim()) return r.until && now < r.until + ROUTINE.warnLateMs ? text(L, 'until.now', { time: hhmm(r.until) }) : text(L, 'until.none')
  const res = setUntil(routineTouch(r, now), typed, now)
  if (!res.ok) return text(L, res.reply, { time: res.time ? hhmm(res.time) : '' })
  if (!(await routineSet($, res.r))) return text(L, 'routine.unkept')
  const a = await heldAnim($)
  if (a.ask && (a.askKind === 'finish' || a.askKind === 'usual')) await animate($, x => ({ ...x, ...NO_ASK })) // the question about it is answered
  warned = ''
  return text(L, res.reply, { time: res.time ? hhmm(res.time) : '' })
}
/** /pet routine: what the pet learned, in a few lines; off and on switch its questions; clear forgets. The answer is a line of the chat. */
async function routineCmd(/** @type {any} */ $, /** @type {string | undefined} */ arg) {
  const p = await getPrefs($), L = p.lang, now = await $.clock.now(), r = await routineGet($)
  if (!r) return text(L, 'routine.unkept')
  if (arg === 'off' || arg === 'on' || arg === 'clear') {
    if (!(await routineSet($, arg === 'clear' ? routineTouch(routineCleared(r), now) : routineSwitched(r, arg === 'off')))) return text(L, 'routine.unkept')
    if (arg !== 'on' && (await heldAnim($)).askKind) await animate($, x => ({ ...x, ...NO_ASK }))
    if (arg === 'clear') { warned = ''; usualStart = undefined }
    return text(L, arg === 'clear' ? 'routine.cleared' : `routine.${arg}`, { max: ROUTINE.questionsDay })
  }
  if (arg) return text(L, 'routine.usage')
  const u = routineUsual(r, now), habit = (/** @type {number} */ n) => n >= ROUTINE.usualDays, today = r.days[r.day], // what is usual: from the days before today, three at least
    clockOf = (/** @type {number} */ m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return [
    text(L, 'routine.title', { name: p.name, n: Object.keys(r.days).length }),
    ...(u.start !== undefined && habit(u.days) ? [`  ${text(L, 'routine.start', { time: clockOf(u.start) })}`] : []),
    ...(u.finish !== undefined && habit(u.finishDays) ? [`  ${text(L, 'routine.finish', { time: clockOf(u.finish) })}`] : []),
    ...(u.coffee !== undefined && habit(u.coffeeDays) ? [`  ${text(L, u.coffee ? 'routine.coffee.yes' : 'routine.coffee.no')}`] : []),
    ...(today ? [`  ${text(L, 'routine.today', { time: hhmm(today.start) })}`] : []),
    ...(r.until ? [`  ${text(L, 'routine.today.until', { time: hhmm(r.until) })}`] : []),
    text(L, r.off ? 'routine.questions.off' : 'routine.questions.on', { n: r.asked, max: ROUTINE.questionsDay }),
    text(L, 'routine.note'),
  ].join('\n')
}
/** Hatched: who it is, at once, in the bubble for a while (its name, its animal, the five statistics by name, its character), and in a toast where the bubble has no room. */
async function born(/** @type {any} */ $) {
  const p = await getPrefs($), L = p.lang
  if (p.hidden || !asStats(p.stats)) return
  await hold($, text(L, 'born.say', { name: p.name, animal: animalName(L, p.species) }), `${STATS.map((st, i) => `${text(L, `stat.${st}`)} ${p.stats[i]}`).join(' · ')} · ${personalityOf(p.stats, L)}`, RULES.bornShowMs)
  await $.ui.toast(text(L, 'born.toast', { name: p.name })).catch(() => {})
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
 * A recap has its own length, time and cap of the reply, and its line is not kept among the pet's last lines: nothing of it is in the store.
 */
async function askLine(/** @type {any} */ $, /** @type {import('../engine/voice.js').Why} */ why, /** @type {{ talk?: boolean, recap?: boolean }} */ sys, /** @type {(t: import('../engine/voice.js').Tally) => string | Promise<string>} */ prompt) {
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
    const long = why === 'recap'
    const model = p.model || MODEL // the person's choice, never another: a model that fails is told of, not replaced
    const r = await $.model.complete({ model, system: system({ name: p.name, animal: p.species, stats: p.stats, lang: p.lang, person: p.callme, ...sys }), prompt: await prompt(t), maxTokens: long ? RULES.recapMaxTokens : RULES.voiceMaxTokens, effort: 'low', timeoutMs: long ? RULES.recapTimeoutMs : RULES.voiceTimeoutMs }).catch((/** @type {unknown} */ thrown) => ({ isAnswered: false, usage: undefined, text: '', thrown }))
    if (unavailable(r)) await modelGone($, model, p.lang).catch(() => {})
    const line = !r?.isAnswered ? '' : long ? cleanRecap(r.text) : clean(r.text)
    // added over the store as it is now: another chat may have spoken meanwhile
    const after = await voiceTally($)
    if (after && !('thrown' in r)) await storeSet($, 'voice', settled(after, r.usage, long ? {} : { long: !!r.isAnswered && tooLong(r.text), path: !!r.isAnswered && !tooLong(r.text) && pathy(r.text), line })).catch(() => {})
    return { asked: true, line, stop: '' }
  } finally { speaking = false }
}
/**
 * The model of the comments did not answer because it is not there for this person (engine/voice.js `unavailable`): said in a toast,
 * once a day for a model over all the chats (the day and the model told are kept in the store). The pet stays silent as for any
 * failed call and never takes another model by itself: the choice is the person's, with /pet model.
 */
async function modelGone(/** @type {any} */ $, /** @type {string} */ model, /** @type {string} */ lang) {
  const now = await $.clock.now()
  if (!tellGone(await storeGet($, 'voiceGone'), model, now)) return
  await storeSet($, 'voiceGone', { day: dayOf(now), model })
  await $.ui.toast(text(lang, 'model.gone', { model }))
}
/**
 * The person's skin packs: the .json files of ~/.claude/hatchling-skins (or of the config folder Claude Code was given), in the order
 * of their names. Each is data, checked whole by engine/skins.js before any of it is used; one that is not sound is left out and
 * told by /pet skins. No folder, no packs, and nothing here can fail: the band is drawn all the same. Under the bench none is read.
 */
async function configDir(/** @type {any} */ $, /** @type {string} */ folder) {
  const config = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  const home = (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined))
  return config ? `${config}/${folder}` : home ? `${home}/.claude/${folder}` : ''
}
const skinsDir = (/** @type {any} */ $) => configDir($, 'hatchling-skins')
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
  await hold0($, p)
  await fill($, p, raw)
}
let farewell = '', farewellSaid = '' // the animal of a pack that is gone: said once, gently, by the tick
/**
 * Where `node` is, as an absolute path, for the picture of /pet share: looked for in the absolute folders of the PATH Claude Code was started
 * with, in their order. A relative entry, an empty one (the working folder), and a folder inside the project are passed over,
 * so a `node` someone left in the repository is never the one run. '' when there is none. `bin` names another program looked for the same way.
 */
async function nodePath(/** @type {any} */ $, bin = 'node') {
  const path = String((await $.env.get('PATH').catch(() => '')) ?? ''), win = /^[A-Za-z]:[\\/]/.test(path) || path.includes(';')
  const here = cwd.replace(/[\\/]+$/, '')
  for (const dir of path.split(win ? ';' : ':')) {
    const d = dir.replace(/[\\/]+$/, '')
    if (!(win ? /^[A-Za-z]:[\\/]/ : /^\//).test(dir) || (here && (d === here || d.startsWith(`${here}/`) || d.startsWith(`${here}\\`)))) continue
    for (const name of [win ? `${bin}.exe` : bin]) {
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
  const p = await getPrefs($), all = p.chats ? await known($, now) : {}, id = await myId($), n = counts(all, id, now)
  const need = n.waiting + n.asking, said = need ? count1(p.lang, 'chats.need', need) : '' // one short count: the chats that need the person
  if (said !== board) { board = said; await animate($, a => ({ ...a, hush: a.hush + 1 })) } // drawn again with the new count
  if (!p.chats || now - lastOwn > RULES.peerActiveMs) return
  const r = finished(all, peersSeen, { id, cwd, since: openedAt, now, told: peersTold, names: namesOf(await looked($).catch(() => null)) })
  // a turn that ended while another piece of news is still fresh is not lost: it is looked at again, and told when the wait is over
  if (r.peer && !r.peer.ask && now - peerSaidAt < RULES.peerGapMs) return
  peersSeen = r.seen
  peersTold = r.told
  if (!r.peer) return
  const peer = r.peer
  peerSaidAt = now
  const named = peer.name !== peer.dir // told by the name the person gave it: the small model is told the folder, as ever
  await feed($, { type: 'peer', ...peer, named })
  if (peer.ask) { // a chat began to wait for the person's OK: one toast, and a desktop notification only when /pet alerts is on
    const line = text(p.lang, named ? 'chats.ask.toast.named' : 'chats.ask.toast', { name: peer.name || '/' })
    try { $.ui.toast(line) } catch { /* no toast on this surface */ }
    if ((await storeGet($, 'alerts').catch(() => false)) === true) Promise.resolve($.ui.notify(line, { title: p.name, key: 'hatchling-ask' })).catch(() => {})
  }
  // said: with the comments on the small model says the same in the pet's character, and its line takes the place of the fixed one. Not awaited: the drawing goes on
  const on = view(cur, now).talk
  if (on?.kind === 'peer' && on.name === peer.name) peerLine($, { ...peer, name: peer.dir }).then(line => line ? feed($, { type: 'peer', ...peer, named, said: line }) : undefined).catch(() => {})
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
/** Whether the comments are on here: on as installed and until the person turns them off, with a person at the prompt, and never under the bench. */
const voiceChosen = async (/** @type {any} */ $) => social && !(await bench($)) && (await getPrefs($)).voice
/**
 * Whether a line may be asked for now: on, the person was told so (`voiceAsked`: the notice came up, or they chose with
 * /pet comments), and the band is shown. Nothing is sent before the person has been told; a hidden band shows no line, so none is paid for.
 */
const voiceOn = async (/** @type {any} */ $) => { const p = await getPrefs($); return (await voiceChosen($)) && p.voiceAsked && !p.hidden }
/** The count of lines and cost in the store, whole; null when the store cannot be read (then nothing is asked: the cap could not be held). */
async function voiceTally(/** @type {any} */ $) {
  const none = {}, raw = await storeGet($, 'voice').catch(() => none)
  return raw === none ? null : tally(raw, await $.clock.now())
}
/**
 * The comments are on as installed, and the person is told so once in a pet's life, before any is asked for: a notice right after
 * the hatching, or at the first start of this version for a pet that was never asked. It waits under the line of the birth, then
 * holds the bubble, with its one button (turn off), until the person does something: the button, or the next prompt.
 * Never under the bench nor without a person at the prompt, and not for who already chose (`voiceAsked`): that choice stands.
 */
async function askVoice(/** @type {any} */ $) {
  if (!social || await bench($)) return
  const p = await getPrefs($)
  if (p.voiceAsked || p.hidden || (await storedPrefs($)).lost) return // nor while the store cannot be read: that it was said could not be kept; with the band hidden nobody would see the notice: it comes when the band is back
  const t = (await voiceTally($)) ?? tally(undefined, await $.clock.now())
  await animate($, a => ({ ...a, ask: notice(t, p.lang) }))
  await toldVoice($) // in sight at once, unless the line of the birth is over it
}
/**
 * The notice is in sight (nothing holds the bubble over it): from now the person was told, which is kept, so no later chat says it
 * again and the comments may be asked for. Said in a toast too, for a band with no room for the bubble. Looked at every tick.
 */
async function toldVoice(/** @type {any} */ $) {
  const a = await heldAnim($), p = await getPrefs($)
  if (!a.ask || a.askKind || a.egg > 0 || a.demo || (a.noteLeft > 0 && a.note) || p.voiceAsked || p.hidden) return
  if (!(await setPrefs($, { voice: p.voice, voiceAsked: true }))) return // both: once told, what the store has is the choice, and an earlier version wrote `voice: false` at every birth
  await $.ui.toast(text(p.lang, 'toast.comments.notice', { notice: a.ask })).catch(() => {})
}
/** The choice, from the button of the notice or from /pet comments on|off: kept in the preferences, and the notice goes. */
async function setVoice(/** @type {any} */ $, /** @type {boolean} */ on) {
  await setPrefs($, { voice: on, voiceAsked: true })
  if ((await heldAnim($)).ask) await animate($, a => ({ ...a, ...NO_ASK }))
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
// The recap, part of the comments: when the person comes back to a chat after a pause the pet says, once, where the work got to and
// what is left. A pause is RULES.recapAfterMs after a turn ended with no new prompt: in a chat left open a timer waits for it; in a chat
// closed and resumed the start looks at the chat's own mark. The small model gets the start of the person's last prompt and the end
// of the text the assistant wrote in the last turn (engine/voice.js `lastTurn`): read from the session at that moment, sent, and
// dropped. Neither that text nor the line is ever in the store; the mark keeps only the time of the pause the recap was made for,
// which stops a second ask within the same process. A chat resumed in a new process is asked again: the line was lost with the old one.
/** @type {{ cancel: () => void } | null} */ let recapTimer = null
let pauseAt = 0 // when the last turn of this chat ended or was cut: the pause a recap would be for; 0 with no turn behind, or one running
let pauseMid = false // that turn was cut short
let lastSaid = '' // the end of what the assistant wrote in it, as the comments already hold it: used when the session gives no messages
/** This chat's mark as the store has it: the one a chat that was closed and resumed left behind. */
async function ownMark(/** @type {any} */ $) { return marks({ m: await storeGet($, chatKey(await myId($))).catch(() => undefined) }).m }
function recapWait(/** @type {any} */ $, /** @type {number} */ ms) {
  recapTimer?.cancel()
  recapTimer = $.clock.after(Math.max(0, ms), () => { recapTimer = null; recapNow($).catch(() => {}) })
}
/** A new prompt, or the end of the chat: no recap is waited for, and the one in the bubble goes. */
async function recapDrop(/** @type {any} */ $) {
  recapTimer?.cancel()
  recapTimer = null
  pauseAt = 0
  if ((await heldAnim($)).recap) await animate($, a => ({ ...a, recap: '', recapAt: 0 }))
}
/** The pause the recap was asked for goes in this chat's mark, a time and nothing else: a reload of the mod does not ask again. */
async function recapMarked(/** @type {any} */ $, /** @type {number} */ at) {
  const m = myMark ?? await ownMark($)
  if (!m) return
  if (myMark) myMark = { ...myMark, recap: at }
  await storeSet($, chatKey(await myId($)), { ...m, recap: at }).catch(() => {})
}
/**
 * Asks for the recap of the pause that began at `pauseAt` and shows it until the next prompt. Silent, like any comment, when the
 * comments are off, at the day's cap, while the person types, or when the call fails or says nothing usable. Nothing is read from
 * the session unless the comments are on. Counted in the day and in the tokens as any line (`askLine`).
 */
async function recapNow(/** @type {any} */ $) {
  const at = pauseAt, mid = pauseMid
  if (!at || turnAt || !(await voiceOn($))) return
  const read = lastTurn(await $.session.messages().catch(() => [])), work = read.prompt || read.text ? read : { prompt: '', text: lastSaid }
  if (!work.prompt && !work.text) return
  const lang = (await getPrefs($)).lang
  const r = await askLine($, 'recap', { recap: true }, () => recapOf({ ...work, mid, lang }))
  if (r.asked) await recapMarked($, at)
  if (!r.line || pauseAt !== at || turnAt) return // a prompt was sent meanwhile: the line is of no use any more
  lastActive = await $.clock.now()
  await animate($, a => ({ ...a, recap: r.line, recapAt: at, sleep: false }))
}
/**
 * At a start: a chat that has a turn behind it (its mark says when) gets its recap now when the pause is already over, else when
 * it will be. A chat closed and resumed is asked at each start of the process, also for a pause already recapped while it was open:
 * that line was in memory only and is gone. Under a reload of the mod, the same process, the mark stops a second ask for the same
 * pause, and a turn still running is left to its end.
 */
async function recapResume(/** @type {any} */ $, /** @type {boolean} */ fresh) {
  recapTimer?.cancel()
  recapTimer = null
  if (!social || !cwd) return
  const m = await ownMark($)
  if (!m) return
  const { at, mid } = leftOf(m)
  if (!fresh && (mid || m.recap === at)) return
  pauseAt = at
  pauseMid = mid
  const wait = at + RULES.recapAfterMs - await $.clock.now()
  if (wait > 0) recapWait($, Math.min(wait, RULES.recapAfterMs))
  else recapNow($).catch(() => {}) // not awaited: the start goes on
}
let light = false
let windowTokens = 0 // the model's context window; known after the first turn
let ctxTokens = 0 // what the last request of the main thread was answered over
let baseTokens = 0 // the same for the first request of the chat, or the first after a compaction: where the chat started. 0: not seen yet
let afterCompact = false
let ticks = 0
/** @type {{ at: number, stirs: number } | null} */ let dozing = null // set by a tick that found the pet asleep with nothing under way: `lastActive` and the count of changes as they were then; while it holds, the ticks are slow
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

const DARK = 72 // a colour darker than this (luma, 0-255) would vanish on a dark background the same way
const LIFT = 0.3 // how far its outline goes towards white
const luma = (/** @type {number} */ h) => 0.299 * (h >> 16) + 0.587 * (h >> 8 & 255) + 0.114 * (h & 255)

/**
 * The colour of each pixel of a frame, null where it is empty. `ground` is what the drawing stands on: `light` gives the
 * outline below; `any`, the apps, where a mod is not told the theme, gives it too, and one to the dark colours as well
 * (lightened where they touch the background), so the shape reads on a light and on a dark app.
 */
function inks(/** @type {string[]} */ rows, /** @type {Record<string, string>} */ pal, /** @type {'dark' | 'light' | 'any'} */ ground, /** @type {{ of: Set<number>, to: number } | null} */ edge = null) {
  const hue = (/** @type {number} */ r, /** @type {number} */ c) => { const ch = rows[r]?.[c], h = ch === undefined || ch === '.' ? undefined : pal[ch]; return h ? hex(h) : null }
  // on a light theme white and what is as pale or as bright would vanish: where such a pixel touches the background it is darkened, a thin outline.
  // A colour of a coat takes the coat's own darkest colour there (`edge`): gold darkened turns to mud
  return (/** @type {number} */ r, /** @type {number} */ c) => {
    const h = hue(r, c)
    if (h === null || ground === 'dark') return h
    const dim = ground === 'any' && luma(h) < DARK
    if (!dim && !pale(h)) return h
    if (hue(r - 1, c) !== null && hue(r + 1, c) !== null && hue(r, c - 1) !== null && hue(r, c + 1) !== null) return h
    const to = dim ? (/** @type {number} */ x) => Math.round(x + (255 - x) * LIFT) : (/** @type {number} */ x) => Math.round(x * RIM)
    return edge?.of.has(h) ? edge.to : to(h >> 16) << 16 | to(h >> 8 & 255) << 8 | to(h & 255)
  }
}

/** Pixel rows to Raster cells: two pixel rows per text row, drawn with half blocks. */
function cells(/** @type {string[]} */ rows, /** @type {Record<string, string>} */ pal, love = 0, /** @type {{ of: Set<number>, to: number } | null} */ edge = null) {
  const out = []
  const color = inks(rows, pal, light ? 'light' : 'dark', edge)
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

// For /pet where, in memory only and since the mod loaded: how many times the band was asked of each surface with what the
// last answer was, and the clients that attached, with when
/** @type {Record<string, { n: number, last: 'svg' | 'row' | 'raster' | 'nothing' }>} */ const bandAsks = {}
/** @type {{ surface: string, clientId: string, at: number, cells: string }[]} */ const attached = []
const ANSWER = { svg: 'the Svg picture', row: 'the row of text', raster: 'the terminal drawing', nothing: 'nothing' }

const SVG_MAX = 131072 // the characters an Svg's markup may hold
const SVG_PX = 6 // CSS pixels a pixel of the drawing: a pet of 12 rows is 72 high
const SVG_HIGH = 96 // ...and a taller drawing gets smaller pixels, to stay under this height

/**
 * Pixel rows to the markup of an `Svg`, for the apps: one rect per run of a colour, crisp edges, nothing behind the pet.
 * The empty rows and columns around it are cut, so the picture is as large as what is drawn.
 */
function svgOf(/** @type {string[]} */ rows, /** @type {Record<string, string>} */ pal, /** @type {{ of: Set<number>, to: number } | null} */ edge = null) {
  const color = inks(rows, pal, 'any', edge), wide = Math.max(0, ...rows.map(r => r.length))
  const grid = rows.map((_, r) => Array.from({ length: wide }, (_, c) => color(r, c)))
  const ys = grid.flatMap((row, y) => row.some(h => h !== null) ? [y] : []), xs = grid.flatMap(row => row.flatMap((h, x) => h === null ? [] : [x]))
  if (!ys.length) return null
  const x0 = Math.min(...xs), y0 = /** @type {number} */ (ys[0]), w = Math.max(...xs) - x0 + 1, h = /** @type {number} */ (ys.at(-1)) - y0 + 1
  const px = Math.max(1, Math.min(SVG_PX, Math.floor(SVG_HIGH / h)))
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w * px}" height="${h * px}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`]
  for (let y = y0; y < y0 + h; y++) for (let x = x0, end = x0; x < x0 + w; x = end) {
    const c = /** @type {(number | null)[]} */ (grid[y])[x] ?? null
    for (end = x + 1; end < x0 + w && (/** @type {(number | null)[]} */ (grid[y])[end] ?? null) === c; end++);
    if (c !== null) out.push(`<rect x="${x - x0}" y="${y - y0}" width="${end - x}" height="1" fill="#${c.toString(16).padStart(6, '0')}"/>`)
  }
  return { source: `${out.join('')}</svg>`, width: w * px, height: h * px }
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

/**
 * What is drawn for a view: the animal, the name of its state, what it has on and the drawings of that state. `small` says the body
 * is the baby's. The moods and the sleep were once drawn from the grown body alone, the sleep with nothing on: a baby that slept or
 * had a note looked grown, and bare asleep, until it was calm again. A pet not yet grown is drawn small in every state: by its own
 * drawing of the mood (`baby-<mood>`), and where an animal of a pack has a baby and no such drawing, by the baby as it stands.
 * The stage is the pet's real one, also under /pet demo, whose `healthy` and `bloom` alone show it grown.
 */
function drawn(/** @type {ReturnType<typeof view>} */ v, /** @type {{demo: string, sleep: boolean}} */ a, /** @type {{wear: string, species: string}} */ p) {
  const sp = species(p.species)
  const name = stateName(v, a)
  // the crown is a thing of the head, drawn as a state of its own: a grown pet with a hat on, or with its head left bare, is drawn
  // as the adult. /pet demo shows the crown whatever is on
  const worn = wornOf(v.closet, p.wear)
  const young = STATE[v.stage] === 'baby' && sp.states.baby !== sp.states.adult && name !== 'adult' && name !== 'crown'
  const st = young ? sp.states[`baby-${name}`] ?? sp.states.baby : sp.states[name === 'crown' && a.demo !== 'bloom' && !worn.includes('crown') ? 'adult' : name] ?? sp.states.adult
  return { sp, name, worn, st, small: young || name === 'baby' }
}

/** @typedef {{n: number, rare: number, demo: string, sleep: boolean, egg: number, love: number, idle: string, idleN: number, spark: number}} Pose */

/** Sprite for a view. Frames come in two heights, and an item on the ground widens them, so the Raster key carries the size. */
function sprite(/** @type {ReturnType<typeof view>} */ v, /** @type {Pose} */ a, /** @type {{wear: string, species: string}} */ p) {
  const { rows, pal, edge } = frame(v, a, p, light)
  if (a.egg > 0) return { key: `pet-${rows.length}`, columns: /** @type {string} */ (rows[0]).length, rows: rows.length / 2, cells: cells(rows, pal) }
  return { key: `pet-${/** @type {string} */ (rows[0]).length}x${rows.length}`, columns: /** @type {string} */ (rows[0]).length, rows: rows.length / 2, cells: cells(rows, pal, a.love, edge) }
}

/** The pet's drawing in the apps: the frame its mood stands still on. No tick moves it there, so no blink, gesture, heart or sparkle. */
function still(/** @type {ReturnType<typeof view>} */ v, /** @type {Pose} */ a, /** @type {{wear: string, species: string}} */ p) {
  const { rows, pal, edge } = frame(v, { ...a, n: 0, rare: -1, love: 0, idle: '', idleN: 0, spark: 0 }, p, false)
  return svgOf(rows, pal, edge)
}

/** The pixel rows of a view with their colours: what the terminal's cells and the apps' Svg are both made from. `lit` is a light theme. */
function frame(/** @type {ReturnType<typeof view>} */ v, /** @type {Pose} */ a, /** @type {{wear: string, species: string}} */ p, /** @type {boolean} */ lit) {
  const { sp, name, worn, st, small } = drawn(v, a, p)
  const wear = worn.filter(id => id !== 'crown' && partOf(id) !== GOLDEN.slot && !(a.demo === 'bloom' && partOf(id) === 'head'))
  if (a.egg > 0) { // not an animal yet: whole, then rocking, then cracked
    const rows = /** @type {string[]} */ (zoo.egg.frames[a.egg > EGG_ROCKS ? 0 : a.egg > EGG_CRACKS ? 1 + a.n % 2 : 3])
    return { rows, pal: /** @type {Record<string, string>} */ ({ ...zoo.egg.palette, ...(lit ? zoo.light : null) }), edge: null }
  }
  const i = v.animate || name === 'sleep' ? a.n % st.frames.length : 0, rare = a.rare >= 0 && st.rare.length > 0
  // a calm pet's small gesture (a look aside, a flick of the ears, a hop): a few frames of its own, each with where the body sits
  const move = !rare && !a.demo && a.idle ? st.idle?.[a.idle] : undefined, k = move ? Math.min(a.idleN, move.frames.length - 1) : 0
  let rows = rare ? st.rare[0] : move ? move.frames[k] : st.frames[i]
  // the items are drawn over every stage and under every bubble, one over the other from the ground up to the head; asleep a grown pet is curled up and wears nothing (no `at`), a baby only shuts its eyes and keeps it all: its frame is as wide all the same
  const at = move ? move.at[k] ?? move.at[0] : st.at?.[rare ? 0 : i] ?? st.at?.[0]
  // a coat is colours, not a drawing: it tints the body on every animal, stage and state, asleep too. Awake the golden one has
  // a glint of two pale pixels on it, and now and then a sparkle or two light up next to it
  const body = small ? 'baby' : 'adult', coatId = worn.find(id => partOf(id) === GOLDEN.slot)
  const coat = coatId ? coatOf(coatId, animalOf(p.species)) : null
  const gold = coatId === GOLDEN.id && at ? /** @type {{ shine: [number, number][], spark: [number, number][] } | undefined} */ (sp.gold[body]) : null
  const glint = gold ? [...gold.shine.map(([r, c]) => /** @type {[number, number, string]} */ ([r, c, 'x'])), ...gold.spark.filter((_, n) => a.spark >> n & 1).map(([r, c]) => /** @type {[number, number, string]} */ ([r, c, 'y']))] : []
  rows = dressed(rows, at, wear, glint, animalOf(p.species), body)
  const pal = /** @type {Record<string, string>} */ ({ ...sp.palette, ...coat?.palette, ...(st.tint ? sp.tints[st.tint] : null), ...(lit ? zoo.light : null) })
  // the coat's own outline: on a light theme, and in the apps, where the theme is not told
  const edge = coat ? { of: new Set(Object.values(coat.palette).map(hex)), to: hex(coat.edge) } : null
  return { rows: /** @type {string[]} */ (rows), pal, edge }
}

/** A text cut to the columns there are; one that fits is left as it is. */
const cut = (/** @type {string} */ t, /** @type {number} */ max) => cols(t) <= max ? t : tidy(t, max)
const TOUCH = 'touch' // the key of the region over the pet's drawing that hears a click
const BUBBLE_MIN = 14 // under this many columns of text there is no bubble: the pet alone
const BUBBLE_MAX = 44 // columns of text in the speech bubble before it wraps: columns on screen, where a Chinese character takes two
const PET_ROWS = 6 // the tallest frame with nothing under the feet (14x12 pixels), in text rows


const hearts = (/** @type {number} */ n) => '♥'.repeat(n).padEnd(5, '♡') // affection: they fill and never empty

// $.state outlives a reload of the mod, so what it holds may have been written by any earlier version. These three are the only
// readers of it: each gives a value whole for this version, or says there is none, and no drawing or command meets an absent field.
/** The chat's engine state, made whole (engine.js `whole`); null when the session holds none. */
const heldPet = async (/** @type {any} */ $) => { const held = await read($, pet); return held ? whole(held) : null }
/** The animation's state: a field an earlier version did not have reads as at rest. */
const heldAnim = async (/** @type {any} */ $) => {
  if (memo?.anim?.at === stirs) return memo.anim.v
  const at = stirs, a = /** @type {any} */ (await read($, anim)), v = /** @type {typeof ANIM0} */ (Object.fromEntries(Object.entries(ANIM0).map(([k, v]) => [k, typeof a?.[k] === typeof v ? a[k] : v])))
  if (memo && at === stirs) memo.anim = { at, v }
  return v
}
/** The preferences the session holds, when every field of this version is there and sound; else null, and the caller takes them from the store (storedPrefs makes those whole). */
async function heldPrefs(/** @type {any} */ $) {
  await packs($)
  if (memo?.prefs?.at === prefStirs) return heldSound(memo.prefs.v)
  const at = prefStirs, now = /** @type {any} */ (await read($, prefs))
  if (memo && at === prefStirs) memo.prefs = { at, v: now }
  return heldSound(now)
}
function heldSound(/** @type {any} */ now) {
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
  if ((await heldAnim($)).sleep) await animate($, a => ({ ...a, sleep: false }))
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
  await hold0($, p)
  await fill($, p, raw)
  return p
}
// How the preferences are kept. Each one has a key of its own in the store, `pref.<name>`, and a chat writes only the key of what
// the person changed in it: never a copy of them all, which would put the choices this chat last saw over the ones made meanwhile
// in another chat. Earlier versions kept them all in one object under `prefs`, written whole at every change: it is still read, for
// what has no key of its own yet, and never written again, so a chat still running such a version cannot undo a choice made here.
const prefKey = (/** @type {string} */ name) => `pref.${name}`
// Written beside every preference a chat writes, with a value never written before: what the other chats look at every 10 s
const PREFS_REV = 'prefs.rev', PULL_ALL = 6
/** @type {unknown} */ let prefsRev
let pulls = 0
let revs = 0
const revved = async (/** @type {any} */ $) => storeSet($, PREFS_REV, `${await myId($)}:${await $.clock.now().catch(() => 0)}:${++revs}`).catch(() => {})
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
  return { raw, lost, ...who, hidden: !!raw?.hidden, wear: String(raw?.wear ?? ''), species: /** @type {string} */ (born), born: /** @type {string} */ (isAnimal(raw?.born) ? raw.born : born), style: !!raw?.style, cuddles, cuddled, voice: raw?.voiceAsked ? !!raw.voice : true, voiceAsked: !!raw?.voiceAsked, model: asModel(raw?.model), lang, chats: raw?.chats !== false, missing: back ? '' : gone || (typeof raw?.missing === 'string' ? raw.missing : '') }
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
  await hold0($, p)
  if (!raw && !lost) await fill($, p, raw)
  for (const [name, value] of Object.entries(patch)) await storeSet($, prefKey(name), value).catch(() => {})
  await revved($)
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
  await animate($, a => ({ ...a, love: LOVE_TICKS }))
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
async function skin(/** @type {any} */ $, open = true) { await animate($, a => ({ ...a, skin: open ? Math.round(SKIN_MS / TICK_MS) : 0 })) }
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
async function pullPrefs(/** @type {any} */ $, timed = false) {
  // on the timer: one key says whether any chat of this version wrote a preference since the last look, and only then are they all
  // read. Every PULL_ALL looks they are read all the same, for a chat of an earlier version, which wrote no such key. A command and a
  // prompt read them all, always.
  if (timed) {
    const rev = await storeGet($, PREFS_REV).catch(() => prefsRev)
    if (rev === prefsRev && ++pulls % PULL_ALL) return
    prefsRev = rev
  }
  const now = await heldPrefs($)
  const { raw, lost, ...p } = await storedPrefs($)
  if (lost || !now || !isAnimal(raw?.species) || raw.seed !== p.seed || JSON.stringify(p) === JSON.stringify(now)) return // nothing whole to compare
  await hold0($, p)
  if (p.style !== now.style) await feedLean($)
}

/**
 * /pet export, and the copy made before an import: the pet as the store has it now, its choices and its diary, as one JSON file
 * in hatchling-share (engine/move.js says what is in it and what is not). Node writes it, for the person alone from its first byte
 * (engine/move-save.js); with no Node the mod writes it and `chmod` closes it after. Null when the store cannot be read or the
 * file cannot be written; `closed` false when it is written and may be read by the other users of the computer.
 */
async function moveOut(/** @type {any} */ $, /** @type {boolean} */ backup) {
  const dir = await configDir($, 'hatchling-share'), none = {}
  if (!dir || !cur) return null
  await share($, true).catch(() => {})
  const { raw, lost, ...p } = await storedPrefs($), diary = await storeGet($, 'diary').catch(() => none)
  if (lost || diary === none) return null
  const now = await $.clock.now(), body = JSON.stringify(movePack({ pet: cur, prefs: p, diary, routine: await storeGet($, 'routine').catch(() => undefined) ?? {}, now }), null, 2) // with what it learned of the person's days: its memory of them
  if (moveParse(body).errors.length) return null // a file this version would not read back is not written
  const file = movePath(dir, p.name, now, backup), ran = (/** @type {{ exitCode: number }} */ r) => r.exitCode === 0
  const node = await nodePath($)
  if (node && await $.process.run([node, `${$.plugin.root}/engine/move-save.js`, file], { stdin: body }).then(ran, () => false)) return { file, closed: true }
  if (!(await $.fs.write(file, body).then(() => true, () => false))) return null
  const chmod = await nodePath($, 'chmod')
  return { file, closed: !!chmod && await $.process.run([chmod, '600', file]).then(ran, () => false) }
}
/**
 * /pet import, once the person said yes: the pet of a checked file (engine/move.js `parse`) takes the place of the one here, in
 * the store and in this chat. Only the keys of the pet, of its choices and of the diary are written: the marks of the chats, the
 * pet's last lines and the day's count of comments stay as this computer has them. The eggshell follows the birth as ever
 * (`founding`). False when the store could not be written.
 */
async function moveIn(/** @type {any} */ $, /** @type {import('../engine/move.js').Move} */ m) {
  const set = (/** @type {string} */ key, /** @type {unknown} */ value) => storeSet($, key, value).then(() => true, () => false)
  if (!(await set('pet', m.pet))) return false // nothing was changed
  const wrote = [await set('diary', m.diary)]
  if (m.routine) wrote.push(await set('routine', routineOf(m.routine))) // what it learned of the person's days moves in with it; a file of before the routine leaves what is here
  // the comments move in as they were: off in the file stays off here, with no notice (it counts as a choice made)
  for (const name of Object.keys(PREFS0)) wrote.push(await set(prefKey(name), name === 'missing' ? '' : name === 'voiceAsked' ? m.prefs.voiceAsked || !m.prefs.voice : /** @type {Record<string, unknown>} */ (m.prefs)[name]))
  await revved($)
  cur = adopt(cur, m.pet, m.pet)
  await update($, pet, () => cur)
  const { raw, lost, ...p } = await storedPrefs($)
  if (!lost) await hold0($, p)
  if (!lost && p.voiceAsked && (await heldAnim($)).ask) await animate($, a => ({ ...a, ...NO_ASK })) // the notice was seen, or the choice made, where the pet comes from: what moved in stands
  await founding($)
  await feedLean($)
  return wrote.every(Boolean)
}
/** A pet in one line, for the import: its name, animal and stage, its stars, its affection and days. */
const brief = (/** @type {string} */ lang, /** @type {string} */ name, /** @type {string} */ animal, /** @type {string} */ stage, /** @type {{ coins: number, affection: number, days: number }} */ p) =>
  [text(lang, 'card.head', { name, animal: animalName(lang, animal), stage: text(lang, `stage.${STATE[stage] ?? stage}`, {}, stage) }), count1(lang, 'points', p.coins), text(lang, 'card.affection', { a: p.affection, days: count1(lang, 'days', p.days) })].join(text(lang, 'sep'))

/** A reload finds the state in $.state; a new session takes it from $.store and starts fresh. True for a new session. */
async function load(/** @type {any} */ $) {
  lastActive = lastOwn = await $.clock.now()
  await getPrefs($)
  const held = await heldPet($)
  if (held) { cur = held; await founding($); return false } // whatever version kept it, it is whole now
  const stored = await storeGet($, 'pet').catch(() => undefined)
  const born = stored && typeof stored === 'object' ? shared(stored) : null
  // HATCHLING_PLAIN=1 leaves the golden roll out (the tests, the bench): the pet is born plain
  const plain = (await $.env.get('HATCHLING_PLAIN').catch(() => undefined)) === '1'
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

/** Every PEER_TICKS: the other chats, the reminders, the routine, the preferences another chat changed, the shared pet, a comment during a long turn. */
async function round(/** @type {any} */ $) {
  watch($).catch(() => {}); await peers($).catch(() => {}); await remind($).catch(() => {}); await company($).catch(() => {}); await pullPrefs($, true).catch(() => {}); await share($, false).catch(() => {}); midTurn($).catch(() => {}) // the comment is not awaited: the drawing goes on
}
/** Runs the animation: frames while something moves, a rare blink when calm, sleep after 5 idle minutes, a redraw when a mood times out. */
async function tick(/** @type {any} */ $) {
  if (ticks % KEEP_TICKS === 0 || tickEvery === DOZE_MS) kept = {}
  memo = kept
  try { await ticked($) } finally { memo = null }
}
async function ticked(/** @type {any} */ $) {
  if (!cur) return
  if (tickEvery === DOZE_MS) {
    // a slow tick. Asleep, and nothing else under way since a tick last looked (no line held, nothing counting down, no question,
    // nobody back): the next frame of its sleep, and every 10 s the sign of life and the look at the other chats. Nothing else is asked
    if (dozing && dozing.at === lastActive && dozing.stirs === stirs && !asked && !heldLine && !farewell && !demoQueue.length && !bubbleUntil) {
      ticks += DOZE_TICKS; dozeAt += DOZE_MS
      stirs++
      await update($, anim, a => ({ ...a, n: a.n + 1, rare: -1 })).finally(() => { stirs++ }) // not through `animate`: its own frame does not wake it
      if (dozing) dozing.stirs = stirs
      if (ticks % PEER_TICKS === 0) { await beat($).catch(() => {}); await round($) }
      return
    }
    await wake($) // something is under way: the quick ticks again, from this one
  }
  dozing = null
  ticks++
  if (asked || ticks % 10 === 0) await beat($).catch(() => {}) // looked at every 5 s, and at every tick while a call waits for leave
  if (heldLine && !(await typing($))) { const line = heldLine; heldLine = null; await feed($, { type: 'voice', ...line }) }
  // the animation's state, read once a tick and again only after something changed it
  let seen = await heldAnim($), seenAt = stirs
  const anew = async () => { if (stirs !== seenAt) { seenAt = stirs; seen = await heldAnim($) } return seen }
  const hatching = seen
  if (hatching.egg > 0 && !hatching.demo && !demoQueue.length) {
    await animate($, a => ({ ...a, n: a.n + 1, egg: a.egg - 1 }))
    if (hatching.egg === 1) { await born($).catch(() => {}); await askVoice($).catch(() => {}) } // hatched: it says who it is, and then that the comments are on (the notice waits under the line)
    return
  }
  if (hatching.ask && !hatching.askKind) await toldVoice($).catch(() => {})
  if (farewell && !hatching.noteLeft) { // its pack is gone: it is the animal it was born as again, and says so once, with no blame
    const p = await getPrefs($), was = farewell
    farewell = ''; farewellSaid = was
    await hold($, text(p.lang, 'animal.gone', { animal: animalName(p.lang, p.species) }), text(p.lang, 'animal.gone.fix'), GONE_SHOW_MS)
  }
  if (hatching.love > 0) await animate($, a => ({ ...a, love: a.love - 1 }))
  if (hatching.skin > 0) await animate($, a => ({ ...a, skin: Math.max(0, a.skin - 1) }))
  if (hatching.noteLeft > 0) await animate($, a => ({ ...a, noteLeft: a.noteLeft - 1, ...(a.noteLeft === 1 ? { note: '', noteFix: '' } : null) }))
  if (ticks % PEER_TICKS === 0) await round($)
  const shown = (await anew()).demo
  if (demoQueue.length || shown) {
    // each mood gets its whole 5 s, counted from when it comes up; the egg goes through its phases in that time, as at a birth
    if (demoLeft <= 0) demoLeft = DEMO_TICKS
    const demo = demoLeft === DEMO_TICKS ? demoQueue.shift() ?? '' : shown
    demoLeft--
    const egg = demo === 'egg' ? Math.ceil((demoLeft + 1) * EGG_TICKS / DEMO_TICKS) - 1 : 0
    if (!demo) demoLeft = 0
    await animate($, a => ({ ...a, n: a.n + 1, rare: -1, demo, egg }))
    return
  }
  const now = await $.clock.now()
  { const kept = await anew(); if (kept.sig !== bubbleSig || kept.sigAt !== bubbleAt) await animate($, a => ({ ...a, sig: bubbleSig, sigAt: bubbleAt })) } // what the drawing noted, kept for a reload
  if (bubbleUntil && now >= bubbleUntil) { bubbleUntil = 0; await animate($, a => ({ ...a, hush: a.hush + 1 })) } // the phrase had its time: drawn again without it
  const a0 = await anew()
  if (now - lastActive > SLEEP_MS) {
    const still = stirs === seenAt && a0.sleep && !a0.egg && !a0.love && !a0.skin && !a0.noteLeft && !a0.demo && !(a0.ask && !a0.askKind) // nothing changed it while this tick ran, and nothing in it counts down or waits to be marked
    if (!a0.sleep || ticks % DOZE_TICKS === 0) await animate($, a => ({ ...a, n: a.n + 1, rare: -1, sleep: true, idle: '', idleN: 0, spark: 0 }))
    // asleep with nothing under way, on a frame of the sleep: from here the slow ticks, each on a frame
    if (still && ticks % DOZE_TICKS === 0) { dozing = { at: lastActive, stirs }; dozeAt = now; pace($, DOZE_MS) }
    return
  }
  const v = view(cur, now), p = await getPrefs($)
  const { st, worn } = drawn(v, a0, p)
  if (!rng) rng = p.seed | 0 || 1
  // a golden coat sparkles now and then: one or two pixels next to the body, lit for a second
  if (a0.spark) { if (--sparkLeft <= 0 || !worn.includes(GOLDEN.id)) await animate($, a => ({ ...a, spark: 0 })) }
  else if (worn.includes(GOLDEN.id)) {
    if (!sparkAt) sparkAt = now + between(SPARK_GAP_MS)
    else if (now >= sparkAt) { const spark = 1 << Math.floor(rnd() * 4) | (rnd() < 0.4 ? 1 << Math.floor(rnd() * 4) : 0); sparkLeft = SPARK_TICKS; sparkAt = now + between(SPARK_GAP_MS); await animate($, a => ({ ...a, spark })) }
  }
  if (a0.idle) { // a gesture under way: its next frame, and after the last one the pet is still again for a while
    const frames = st.idle?.[a0.idle]?.frames.length ?? 0
    if (a0.idleN + 1 >= frames) { idleAt = now + between(IDLE_GAP_MS); await animate($, a => ({ ...a, idle: '', idleN: 0 })) }
    else await animate($, a => ({ ...a, idleN: a.idleN + 1 }))
    lastMood = v.mood
    return
  }
  const moving = v.animate && st.frames.length > 1
  if (moving) await animate($, a => ({ ...a, n: a.n + 1, rare: -1 }))
  else if (rareShown) { rareShown = false; await animate($, a => ({ ...a, rare: -1 })) }
  else if (ticks % 12 === 0 && st.rare.length && rnd() < 0.5) {
    rareShown = true
    await animate($, a => ({ ...a, rare: 0 }))
  } else if (v.mood !== lastMood) await animate($, a => ({ ...a, n: a.n + 1, rare: -1 }))
  else if (st.idle && !bubbleOpen && !a0.skin && !a0.love) {
    // calm, with nothing in the bubble: now and then a small gesture, picked at random among the ones this body has. Never while a
    // phrase is up, and never sooner than IDLE_GAP_MS after the last. (Whether the terminal has the focus cannot be known from a mod.)
    const names = Object.keys(st.idle)
    if (!idleAt) idleAt = now + between(IDLE_GAP_MS)
    else if (now >= idleAt && names.length) { const idle = /** @type {string} */ (names[Math.floor(rnd() * names.length)]); await animate($, a => ({ ...a, idle, idleN: 0, rare: -1 })) }
  }
  lastMood = v.mood
}

export function register(/** @type {import('claude-code').On} */ on) {
  on('session.start', async ($, e, next) => {
    kept = {}
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
    if (fresh) { warned = ''; await touched($).catch(() => {}) } // who opens a chat is here: the day of the routine starts
    if (fresh && social) remindAt = (await $.clock.now()) + RULES.remindStartMs // the reminders, once the greeting had its time
    else openedAt = await $.clock.now()
    if (fresh && newborn && social) await animate($, a => ({ ...a, egg: EGG_TICKS })) // the first start ever: it hatches before the greeting
    newborn = false
    if (!(await heldAnim($)).egg) await askVoice($).catch(() => {}) // a pet never told is told once; a newborn after it hatched
    await recapResume($, fresh).catch(() => {})
    const rows = await $.config.list().catch(() => [])
    light = String(rows.find(r => r.key === 'theme')?.value ?? '').includes('light')
    await $.command.register({ name: 'pet', description: 'Hatchling: show the pet card. Also: /pet briefox <on|off> (one sentence in the system prompt), /pet comments <on|off>, /pet lang <en|es|pt|zh>, /pet say <text>, /pet call me <name>, /pet diary [today|yesterday|week], /pet remind <text>, /pet reminders, /pet share, /pet export, /pet import <file>, /pet hide, /pet show, /pet shop [item], /pet wear <item|off <item>|none>, /pet animal <name>, /pet skins, /pet chats, /pet chats titles <on|off>, /pet alerts <on|off>, /pet name <name>, /pet pet, /pet adopt, /pet demo' })
    ticker?.cancel(); ticker = null; pace($, TICK_MS) // with this start's `$`
    kept = {}
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
    styleOther = r.sections.some(s => s.id === BRIEF_ID) || undefined // there already: by a plugin below. Not there: one above may still add it, asked when needed
    // with the briefox plugin installed too the section may be there already: an id is unique in the list, and the style goes in once
    return styleLive && !r.sections.some(s => s.id === BRIEF_ID) ? { sections: [...r.sections, { id: BRIEF_ID, text: BRIEF, scope: /** @type {const} */ ('session') }] } : r
  })

  on('prompt.submit', async ($, e, next) => {
    await touched($).catch(() => {}) // the person is here: a prompt, or a command (/pet say is dropped below)
    // /pet say is for the pet alone: answered here and dropped, so neither what was written nor the answer becomes a row of the chat
    const toPet = e.command?.name === 'pet' ? /^say(?:\s+|$)([^]*)/i.exec(e.command.args.trim()) : null
    if (toPet) {
      const p = await getPrefs($)
      if (!(toPet[1] ?? '').trim()) return { drop: text(p.lang, 'say.usage') } // nothing to say: one line on how, and nothing else
      sayTo($, toPet[1] ?? '').catch(() => {}) // not awaited: the prompt box is free at once, the answer comes in the bubble
      return { drop: text(p.lang, 'say.heard', { name: p.name }) }
    }
    { const t = await $.clock.now(); if (social && lastOwn && t - lastOwn >= RULES.recapAfterMs) remindAt = t } // back after a pause: the reminders are said again
    await pullPrefs($).catch(() => {}) // lean switched in another chat counts from this turn
    await feed($, { type: 'prompt', turn: !e.command }).catch(() => {}) // a slash command sends no request: no word on an expired cache
    if (!e.command) { await mark($, false); turnInfo = TURN0(); turnAt = await $.clock.now(); midAt = 0; turnSaid = ''; await recapDrop($).catch(() => {}) } // a slash command starts no turn
    if (!e.command) { const up = await heldAnim($); if (up.ask && !up.askKind && (await getPrefs($)).voiceAsked) await animate($, a => ({ ...a, ...NO_ASK })).catch(() => {}) } // the notice was in sight and the person went on: it goes, the comments stay on. One still under the line of the birth waits; a question of the routine waits its 30 minutes
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
        if (!baseTokens) baseTokens = total
        afterCompact = false
        await feed($, { type: 'usage', input: u.input_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens, contextPct: windowTokens ? 100 * total / windowTokens : undefined, ...await leanState($) })
      }
    } catch {}
    return r
  })

  on('session.measure', ($, e, next) => {
    windowTokens = e.context.window
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && !r.skip) { ctxTokens = baseTokens = 0; afterCompact = true; await feed($, { type: 'compact' }).catch(() => {}); await feedLean($) }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const stage = cur ? card(cur).stage : ''
      await feed($, { type: 'turnEnd', roll: Math.random() }).catch(() => {})
      await share($, true).catch(() => {})
      const grown = cur ? card(cur).stage : ''
      await diaryDo($, (d, t) => grown !== stage && stage ? diaryGrew(diaryTouched(d, t), STATE[grown] ?? grown, t) : diaryTouched(d, t)).catch(() => {})
      await workDo($, (w, t) => workTurned(w, { now: t, files: Object.keys(turnInfo.files).length })).catch(() => {})
      await mark($, e.reason !== 'aborted' && e.reason !== 'error') // an interrupted turn is left midway
      // the pause begins: with no new prompt for RULES.recapAfterMs the pet says where the work got to (with the comments on, asked then)
      pauseAt = myMark?.at ?? await $.clock.now(); pauseMid = e.reason === 'aborted' || e.reason === 'error'
      lastSaid = String(e.answer ?? '').slice(-RULES.voiceTailChars) || turnSaid
      if (social) recapWait($, RULES.recapAfterMs)
      // the voice, when it is on: not awaited, so the turn ends as fast as ever. A failure or many files changed skip the wait
      const done = turnInfo, why = Object.keys(done.failed).length ? 'fail' : Object.keys(done.files).length >= RULES.voiceManyFiles ? 'files' : 'turn'
      turnInfo = TURN0(); turnAt = 0; turnSaid = ''
      if (e.reason !== 'aborted' && e.reason !== 'error') speak($, why, done, String(e.answer ?? '').slice(-RULES.voiceTailChars)).catch(() => {})
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    kept = {} // the state may be emptied under this: nothing read before is kept
    await feed($, { type: 'sessionEnd' }).catch(() => {})
    // after /clear the process goes on and no session.start fires, so start the next one here
    // the new chat sends everything again anyway: a style that waited gets in with its first request
    // the chat after a /clear is the same sitting: no second greeting, and a mark of its own
    await recapDrop($).catch(() => {})
    // closed, the mark still tells when the last turn was and whether it was cut
    const was = social && cwd ? myMark ?? await ownMark($).catch(() => undefined) : undefined, last = was ? leftOf(was) : null
    await mark($, true, { closed: true, ...(last && { left: last.at, ...(last.mid && { mid: /** @type {const} */ (true) }) }) }).catch(() => {}) // this chat is over: the others stop counting it at once (after /clear the next one has an id of its own)
    if (e.reason === 'clear') { if ((await heldAnim($)).ask) await animate($, a => ({ ...a, ...NO_ASK })).catch(() => {}); ctxTokens = baseTokens = turnAt = 0; styleOther = undefined; turnSaid = ''; styleLive = undefined; if (chatId) formerIds = [...formerIds, chatId].slice(-16); chatId = ''; await feed($, { type: 'sessionStart' }).catch(() => {}); await feedLean($) }
    await share($, true).catch(() => {})
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    attached.push({ surface: e.surface, clientId: e.clientId, at: await $.clock.now(), cells: e.viewport ? `${e.viewport.columns}x${e.viewport.rows} cells` : '' })
    return next(e)
  })

  // a click on the pet's drawing, heard by the region over it (touch.js): a cuddle, and the person is here
  on('ui.message', async ($, e, next) => {
    if (e.element === TOUCH && /** @type {any} */ (e.data)?.cuddle === true) { touched($).catch(() => {}); await cuddle($).catch(() => {}) }
    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    if (!cur) await load($)
    await pullPrefs($).catch(() => {})
    await share($, false).catch(() => {}) // the card shows the shared pet as it is now
    // verbs and their arguments are read without regard to capitals; a name given to the pet and what is said to it keep theirs
    await touched($).catch(() => {})
    const words = e.args.trim().split(/\s+/), [verb, arg, arg2] = words.map(w => w.toLowerCase()), rest = words.slice(1).join(' ') // `rest`: a name as typed, of more words too
    // E20: no real pet to show or change while the store cannot be read and this chat holds none: said in a line, and nothing is done
    if (!(await heldPrefs($)) && (await storedPrefs($)).lost) return { text: text(undefined, 'store.lost') }
    const L0 = (await getPrefs($)).lang, modelNow = (await getPrefs($)).model || MODEL
    const onOff = (/** @type {string} */ v) => arg && arg !== 'on' && arg !== 'off' ? { text: text(L0, 'onoff', { verb: v, arg: tidy(arg, 24) }) } : null
    if (verb === 'where') { // for troubleshooting the apps: what the session draws on, and what the band answered there. English, as a thing to paste in a report
      const now = /** @type {readonly string[]} */ (await $.session.surfaces().catch(() => []))
      const all = [...new Set([...now, ...attached.map(c => c.surface), ...Object.keys(bandAsks)])]
      const line = (/** @type {string} */ surface) => {
        const mine = attached.filter(c => c.surface === surface), a = bandAsks[surface]
        const roster = `${now.includes(surface) ? 'in the roster' : 'not in the roster now'}${mine.length ? mine.map(c => `; ${c.clientId} attached ${new Date(c.at).toISOString().slice(11, 19)} UTC${c.cells ? `, ${c.cells}` : ''}`).join('') : surface === 'terminal' ? '; the terminal raises no attach' : '; no attach heard since the mod loaded'}`
        return `  ${surface.padEnd(9)} ${roster}; band asked ${a?.n ?? 0} time${a?.n === 1 ? '' : 's'}${a ? `, last answer: ${ANSWER[a.last]}` : ''}`
      }
      return { text: ['Where Hatchling draws (counts since the mod loaded, in memory only; the roster does not tell a mod which elements an app draws)', ...(all.length ? all.map(line) : ['  no surface: nothing draws in this session'])].join('\n') }
    }
    if (verb === 'help') return { text: listOf(L0, 'help').map(line => put(line, { model: modelNow })).join('\n') }
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
      if (arg === 'clear') return { text: text(L, await storeSet($, 'diary', diaryOf(undefined)).then(() => storeSet($, 'work', workOf(undefined))).then(() => 'diary.cleared', () => 'diary.unkept')) } // a store that cannot be written is said, not thrown
      if (arg === 'lines') return { text: page(diaryOf(await storeGet($, 'diary').catch(() => undefined)), await $.clock.now(), L) } // the pet's own diary: milestones, habits, recent days
      // the work report: today and yesterday, or the days asked for. From the day counters and the chat marks, and nothing else
      return { text: report(workOf(await storeGet($, 'work').catch(() => undefined)), await chats($), { id: await myId($), now: await $.clock.now(), span: arg }, L) }
    }
    // the routine: an answer to the question that is up, today's finish time, what the pet learned. Answers like any other: lines of the chat
    if (verb === 'yes' || verb === 'no' || verb === 'answer') return { text: (await answerQ($, verb === 'answer' ? arg ?? '' : verb)).line }
    if (verb === 'until') return { text: await untilCmd($, rest) }
    if (verb === 'routine') return { text: await routineCmd($, arg) }
    if (verb === 'remind' || verb === 'reminders') return { text: await reminders($, verb, e.args.trim().slice(verb.length)) } // a command's answer like any other: a line of the chat, which its assistant can read; only the bubble is drawn here and is no line
    if (verb === 'alerts') { // a desktop notification when another chat may be waiting for the person's OK: off until asked for
      const bad = onOff('alerts')
      if (bad) return bad
      if (arg && !(await storeSet($, 'alerts', arg === 'on').then(() => true, () => false))) return { text: text(L0, 'alerts.unkept') }
      return { text: text(L0, (await storeGet($, 'alerts').catch(() => false)) === true ? 'alerts.on' : 'alerts.off') }
    }
    if (verb === 'chats') { // the board of the chats: which of the person's open chats is working, waiting for them, or may be waiting for an OK
      if (await bench($)) return { text: 'No board of the chats: under the bench no chat leaves a mark.' }
      if (arg === 'titles') { // the automatic titles: off unless turned on here, and said plainly what is read
        if (arg2 && arg2 !== 'on' && arg2 !== 'off') return { text: text(L0, 'onoff', { verb: 'chats titles', arg: tidy(arg2, 24) }) }
        if (arg2 && !(await storeSet($, 'titles', arg2 === 'on').then(() => true, () => false))) return { text: text(L0, 'alerts.unkept') }
        if (arg2 === 'off') titled.clear()
        return { text: text(L0, (await storeGet($, 'titles').catch(() => false)) === true ? 'chats.titles.on' : 'chats.titles.off') }
      }
      const bad = onOff('chats')
      if (bad) return bad
      if (arg === 'on' || arg === 'off') { await setPrefs($, { chats: arg === 'on' }); await showing($).catch(() => {}); await peers($).catch(() => {}); return { text: text(L0, arg === 'on' ? 'chats.on' : 'chats.off') } }
      if (!(await getPrefs($)).chats) return { text: text(L0, 'chats.off') }
      const now = await $.clock.now(), all = await known($, now), rows = listing(all, await myId($), now, namesOf(await looked($).catch(() => null)))
      const others = rows.filter(c => !c.me)
      // the row of the chat the person is in says only "here": no state, no time (it is never counted among the ones that wait)
      // what a chat is called: the name the person gave it, else (with the titles on, and never for this chat) its title, else its folder alone
      const titlesOn = (await storeGet($, 'titles').catch(() => false)) === true
      const title = await titlesOf($, others.filter(c => !c.label).map(c => ({ id: c.id, cwd: all[c.id]?.cwd ?? '' })), now).catch(() => /** @type {Record<string, string>} */ ({}))
      const heads = rows.map(c => c.label || (Object.hasOwn(title, c.id) ? title[c.id] : '') || c.name), wide = Math.max(0, ...heads.map(h => cols(h ?? ''))) + 2
      return { text: [text(L0, 'chats.title'), ...rows.map((c, i) => `  ${pad(heads[i] ?? '', wide)}${heads[i] !== c.name ? `${c.name}, ` : ''}${c.me ? text(L0, 'chats.me') : `${text(L0, `chats.state.${c.state}`)}, ${ago(c.ago, L0)}`}`), ...(others.length ? [] : [text(L0, 'chats.none')]), text(L0, titlesOn ? 'chats.help.titles' : 'chats.help')].join('\n') }
    }
    if (verb === 'skins') { // the folder is read anew: a pack just put there, or just mended, shows without a restart
      if (await bench($)) return { text: 'No skin packs: under the bench none is read.' }
      await packs($, true)
      await settle($)
      const dir = await skinsDir($), found = REG.packs.map(f => ({ ...f, file: tidy(f.file, 80), errors: f.errors.map(err => tidy(err, 300)) })), wide = Math.max(0, ...found.map(f => cols(f.file))) + 2 // a pack's file name and what is wrong with it come from a stranger: shown made safe
      const guide = `Format, an example to copy and how to try it: ${DOCS.replace(/fix\/$/, 'skins.md')}`
      if (!found.length) return { text: `No skin packs. A pack is one .json file in ${dir || '~/.claude/hatchling-skins'}: put it there and run /pet skins.\n${guide}` }
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
    if (verb === 'budget') return { text: text(L0, 'gone.budget') }
    // two commands of earlier versions, taken out: each says so, and why
    if (verb === 'weight') return { text: text((await getPrefs($)).lang, 'gone.weight') }
    if (verb === 'diet') return { text: text((await getPrefs($)).lang, 'gone.diet') }
    if (verb === 'briefox' || verb === 'lean' || verb === 'style') { // one lever: `lean` and `style` are its names of earlier versions, still answered
      const bad = onOff('briefox')
      if (bad) return bad
      if (arg === 'on' || arg === 'off') { await setPrefs($, { style: arg === 'on' }); await feedLean($) }
      const p = await getPrefs($), wait = p.style && !styleNext(true)
      if (!p.style && await otherStyle($)) return { text: `Briefox on: the briefox plugin adds "${BRIEF}" to the system prompt, whatever /pet briefox says. /briefox off takes it out. ${STYLE_BENCH}` }
      if (!p.style) return { text: `Briefox off. /pet briefox on adds one sentence to the system prompt: "${BRIEF}" ${STYLE_BENCH}` }
      return { text: `${wait ? `Briefox chosen: this chat is already long, so "${BRIEF}" starts at the next compaction or the next chat. Switching now would re-send the whole conversation.` : `Briefox on: every request carries one sentence in the system prompt, "${BRIEF}" Switching rewrites the cache once.`} ${STYLE_BENCH}` }
    }
    if (verb === 'model') { // the model the comments are asked of: an alias or a full id, checked for its shape only; `default` goes back to MODEL
      const typed = e.args.trim().split(/\s+/).slice(1) // as typed: an id keeps its capitals
      if (!typed.length) return { text: text(L0, 'model.is', { model: modelNow, default: MODEL }) }
      if (typed.length === 1 && arg === 'default') { await setPrefs($, { model: '' }); return { text: text(L0, 'model.back', { default: MODEL }) } }
      const model = typed.length === 1 ? asModel(typed[0]) : ''
      if (!model) return { text: text(L0, 'model.bad', { arg: tidy(typed.join(' '), 40), max: MODEL_MAX }) }
      await setPrefs($, { model })
      return { text: text(L0, 'model.now', { model, default: MODEL }) }
    }
    if (verb === 'comments' || verb === 'voice') { // `voice` was its name: kept, unlisted, for who typed it before
      if (await bench($)) return { text: 'Comments off: under the bench they are never used.' }
      const bad = onOff('comments')
      if (bad) return bad
      if (arg === 'on' || arg === 'off') await setVoice($, arg === 'on')
      else if (social && (!(await getPrefs($)).voiceAsked || ((await heldAnim($)).ask && !(await heldAnim($)).askKind))) await setVoice($, (await getPrefs($)).voice) // this answer says all the notice says, and more: the person was told, and the notice goes
      const t = (await voiceTally($)) ?? tally(undefined, await $.clock.now()), avg = average(t)
      const cost = avg.measured ? `${avg.input} tokens in and ${avg.output} out a line, measured over the ${t.lines} line${t.lines === 1 ? '' : 's'} paid so far` : `about ${avg.input} tokens in and ${avg.output} out a line, ${measuredHow(t)} on our own lines and replaced by your own after the first line`
      const thinks = "The tokens out are more than the line's own, about 12: the rest is the model's thinking, which a mod cannot switch off (it can only ask for low effort, and does)."
      const which = `The model in use: ${modelNow}${modelNow === MODEL ? '' : ` (the default is ${MODEL})`}. /pet model <alias or id> changes it; a larger model costs more tokens per line. If it does not answer, the pet stays silent, tells you once a day and never picks another by itself.`
      const cap = `${RULES.voiceCapDay} lines a day`
      if (!(await getPrefs($)).voice) return { text: `Comments off: the pet says its fixed lines, and nothing is sent anywhere for it. They are on as installed; you turned them off. /pet comments on lets a small model write one line about the turn again. That spends tokens of your own account: ${cost}, never more than ${cap}. The recap after a pause is a larger request: ${RECAP_COST}. ${which}` }
      return { text: [
        `Comments on. They spend tokens of your own account: each line is one request to a small model (${modelNow}, through Claude Code's own client).`,
        which,
        `Sent to the model: the pet's name, animal, five statistics and language; the name you told it with /pet call me, when you told one; why it speaks; the names of the tools used in the turn with their counts (the tools of your MCP servers too, by their names); the program names of the commands that failed; how many files changed; the last ${RULES.voiceTailChars} characters of the assistant's reply (during a turn, of what it wrote last in it, and how many minutes the turn has lasted); the pet's own last ${RULES.voiceRecall} lines, so that it does not repeat itself (they are kept in the store and go back to the model in later chats too); at most ${RULES.diaryRecall} lines of its diary, as memories it may hint at (times, counts, a folder's name: /pet diary lines shows all of it). When another of your chats ends a long turn: that chat's folder name, how long the turn took and how long ago it ended, and nothing of what was in it.`,
        `/pet say <text> speaks to the pet: what you write after it (its first ${RULES.saySaidChars} characters) is sent to the same model, which answers in the bubble with one line. It is a request of its own, not a turn of the chat, and counts in the day's lines.`,
        `After a pause the pet says once where the work got to and what is left: when ${RULES.recapAfterMs / 60_000} minutes pass after a turn with no new prompt, or when you resume a chat left for longer. For that one line, once per pause and once more each time you resume a closed chat, it sends up to ${RULES.recapChars} characters: the first ${RULES.recapPromptChars} of your last prompt and the end of the text the assistant wrote in the last turn (text only: nothing a tool was given or answered). It counts in the day's lines and in the tokens like any other line, and it is a larger request than a comment (its cost is below). Neither what is sent nor the line is kept on disk.`,
        `Never sent by the pet itself: the content of a file, the output of a command, the arguments of a command, a file path, your prompts to the assistant but for the start of the last one in a recap. But the assistant's text is sent as it is: the last ${RULES.voiceTailChars} characters of a reply, and in a recap the end of the last turn's text, can hold a path, a name or a piece of code the assistant wrote there.`,
        `Cost: ${cost}. ${thinks} The recap: ${RECAP_COST}. The tokens are the ones each call reports; what they cost in money depends on the model ${modelNow} leads to on your account.`,
        `When: at the end of a turn, at most one line every ${RULES.voiceGapMs / 60_000} minutes; without that wait after a failed command, a turn that changed ${RULES.voiceManyFiles} files or more, or a cuddle: each of those waits ${(RULES.voiceEvery.fail ?? 0) / 1000}, ${(RULES.voiceEvery.files ?? 0) / 1000} and ${(RULES.voiceEvery.cuddle ?? 0) / 1000} seconds since the last line for the same reason. A line is counted in the day when it is asked for, so one whose call fails or runs out of time is counted too. Also during a turn that lasts longer than ${RULES.voiceGapMs / 60_000} minutes, under the same wait. Never more than ${cap}, over all your chats. Never while you type, and a call slower than ${RULES.voiceTimeoutMs / 1000} seconds is dropped.`,
        `A line that comes back wider than ${RULES.voiceMaxCols} columns on screen (a Chinese character takes two) is not shown, and is paid for all the same: ${t.dropped} of ${t.lines} so far. Nor is one that names a file or a path: ${t.paths} so far.`,
        `Today: ${t.today} of ${RULES.voiceCapDay} lines, ${t.todayTokens} tokens (${t.input + t.output} in all): ${left(t) ? `${left(t)} left` : 'none left, they come back tomorrow'}. /pet comments off stops them.`,
      ].join('\n') }
    }
    if (verb === 'demo') {
      demoQueue = [...DEMO]
      demoLeft = 0 // from the first mood, whatever a demo still running was showing
      return { text: text(L0, 'demo.start', { list: DEMO.join(', ') }) }
    }
    if (verb === 'animal') { // free among the animals the pet has: the one it was born as and the ones unlocked. Unlocking is the shop's
      const p = await getPrefs($), lang = p.lang, mine = zooOf(card(cur).animals, p), locked = RULES.animals.filter(id => !mine.includes(id))
      // only the id switches; a shown name is answered with the id it could be
      const got = pick(rest, asAnimals(Object.keys(REG.species))), arg = got.id || rest.toLowerCase()
      if (mine.includes(arg)) {
        await setPrefs($, { species: arg, missing: '' })
        return { text: text(lang, 'animal.now', { animal: animalName(lang, arg) }) }
      }
      if (!got.id && (got.meant.length || got.near.length)) return { text: meantLine(lang, 'animal', got, text(lang, 'animal.unknown', { arg: tidy(rest, 24) })) }
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
      const mine = zooOf(c.animals, who)
      // only the id buys; a shown name is answered with the id it could be, an unknown word with the closest ids: one line, never the catalogue again
      const got = pick(rest, [...asThings([...SOLD, EGGSHELL]), ...asAnimals(RULES.animals)]), arg = got.id, item = SOLD.find(i => i.id === arg)
      if (rest && !arg) return { text: meantLine(L, 'shop', got, after(say('shop.none', { arg: tidy(rest, 24) }), got.near.length ? '' : say('shop.see')).trim()) }
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
      const eg = SHOP.find(i => !c.owned.includes(i.id) && !monthOf(i.id)) ?? /** @type {typeof SHOP[number]} */ (SHOP[0]) // the example of the help: a real thing, one still to buy
      const row = (/** @type {typeof SOLD[number]} */ i) => `  ${i.id.padEnd(12)}${pad(itemName(L, i), wide)}${String(i.price).padStart(3)}  ${pad(say(`part.${i.slot}`), place)}${c.owned.includes(i.id) ? say(wearing.includes(i.id) ? 'shop.worn' : 'shop.yours') : monthOf(i.id) ? say(`shop.month.${monthOf(i.id)}`) : ''}`.trimEnd()
      return { text: [
        ...(verb === 'buy' ? [say('shop.pick'), ''] : []),
        say('shop.title', { points: points(c.coins) }),
        ...(c.coins < 0 ? [say('shop.debt')] : []),
        '',
        `  ${pad(say('shop.col.id'), 12)}${say('shop.col.name')}`, // the first word of a row is the one to type
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
        say('shop.help', { id: eg.id, name: itemName(L, eg) }),
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
      // only the id puts on or takes off; a shown name is answered with the ids it could be, the things the pet has first
      const off = arg === 'off' && !!arg2, typedName = words.slice(off ? 2 : 1).join(' '), own = pick(typedName, asThings(WEARABLE.filter(i => c.closet.includes(i.id)))), any = own.id || own.meant.length ? own : pick(typedName, asThings(WEARABLE))
      const id = any.id || typedName.toLowerCase(), item = WEARABLE.find(i => i.id === id), name = item ? itemName(L, item) : ''
      const now = wornOf(c.closet, who.wear)
      const told = (/** @type {string} */ wear) => wornOf(c.closet, wear).length ? say('wears.now', { name: who.name, list: wornLine(L, c.closet, wear) }) : say('wears.none', { name: who.name })
      if (arg === 'none' || (arg === 'off' && !arg2)) { await setPrefs($, { wear: takeOff(c.closet, who.wear, 'none') }); return { text: say(now.includes(GOLDEN.id) ? 'wears.none.golden' : now.some(x => partOf(x) === GOLDEN.slot) ? 'wears.none.coat' : 'wears.none', { name: who.name }) } } // the coat is a colour: it stays, and the reply says so
      if (arg === PLAIN) { const coat = now.find(x => partOf(x) === GOLDEN.slot), wear = coat ? takeOff(c.closet, who.wear, coat) : who.wear; await setPrefs($, { wear }); return { text: told(wear) } } // the pet's own colour: what who has a coat on goes back to
      if (!item && any.meant.length && arg !== 'none' && arg !== PLAIN) return { text: text(L, 'pick.meant', { list: any.meant.map(x => `/pet wear ${off ? 'off ' : ''}${x}`).join(', ') }) }
      if (!item || !c.closet.includes(item.id)) return { text: say('wear.not', { arg: tidy(id, 24) || '?', list: c.closet.join(', ') || say('nothing') }) }
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
      const pic = picture(portrait(animal, stage, worn), lines), dir = await configDir($, 'hatchling-share'), node = dir ? await nodePath($) : ''
      if (!dir) return { text: say('share.failed') }
      const file = sharePath(dir, who.name, 'png')
      const saved = node ? await $.process.run([node, `${$.plugin.root}/engine/share-save.js`, file], { stdin: /** @type {Uint8Array & { toBase64(): string }} */ (png(pic)).toBase64() }).then((/** @type {{ exitCode: number }} */ r) => r.exitCode === 0, () => false) : false
      if (saved) return { text: `${say('share.saved', { path: file })}\n${say('share.saved.how')}` }
      const drawn = sharePath(dir, who.name, 'svg')
      return { text: await $.fs.write(drawn, svg(pic)).then(() => `${say('share.svg', { path: drawn })}\n${say('share.svg.how')}`, () => say('share.failed')) }
    }
    if (verb === 'export' || verb === 'import') { // the pet moved to another computer, as a file: nothing is sent anywhere
      if (await bench($)) return { text: 'No export or import: under the bench the pet lives in memory only.' }
      const closed = (/** @type {{ closed: boolean }} */ out) => out.closed ? [] : [say('export.open')]
      if (verb === 'export') {
        const out = await moveOut($, false)
        return { text: out ? [say('export.saved', { name: who.name, path: out.file }), ...closed(out), say('export.how')].join('\n') : say('export.failed') }
      }
      const home = (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined))
      const { path, yes, typed } = moveAsked(e.args.trim().slice(verb.length), String(home ?? ''))
      if (!path) return { text: say('import.usage') }
      // the file is a stranger's until it is checked: a regular file, not too big, read once, and judged whole (engine/move.js)
      const st = await $.fs.stat(path).catch(() => null)
      const why = !st ? 'file: there is no such file' : st.kind !== 'file' ? 'file: not a regular file' : st.size > MOVE_LIMITS.bytes ? `file: larger than ${MOVE_LIMITS.bytes / 1024} KiB` : ''
      const read = why ? null : await $.fs.read(path).then((/** @type {unknown} */ t) => moveParse(String(t)), () => null)
      const m = read?.move
      if (!m) return { text: say('import.bad', { path: tidy(path, 200), why: why || (read?.errors[0] ?? 'file: could not be read') }) }
      const told = [say('import.file', { pet: brief(L, m.prefs.name, m.prefs.species, stageOf(m), m.pet), date: dated(m.exported) }), say('import.here', { pet: brief(L, who.name, who.species, c.stage, c) })]
      if (!yes) return { text: [...told, say('import.ask', { path: tidy(typed, 200) })].join('\n') }
      const back = await moveOut($, true) // the pet that is here, saved first: with no copy of it, nothing is replaced
      if (!back) return { text: say('import.nobackup') }
      const done = await moveIn($, m), now = (await getPrefs($)).lang // said in the language the pet that moved in speaks
      return { text: [text(now, done ? 'import.done' : 'import.failed', { name: m.prefs.name }), text(now, 'import.backup', { path: back.file }), ...(back.closed ? [] : [text(now, 'export.open')])].join('\n') }
    }
    if (verb) return { text: say('cmd.unknown', { verb: tidy(verb, 24) }) } // a word that is no command says so, in one line: the card is /pet alone
    // lean is the style. Neither line claims a saving for this chat: the figures are the bench's, and are labelled so
    const isStyle = await styleOn($)
    const lean = say(isStyle && !styleNext(true) ? 'card.lean.wait' : isStyle ? 'card.lean.on' : await otherStyle($) ? 'card.lean.plugin' : 'card.lean.off', { bench: say('bench') })
    const names = OWNABLE.filter(i => c.owned.includes(i.id)).map(i => itemName(L, i))
    const spoken = await voiceTally($)
    const comments = !(await voiceChosen($)) ? say('card.comments.off')
      : spoken ? say('card.comments.on', { model: modelNow, n: spoken.today, cap: RULES.voiceCapDay, today: spoken.todayTokens, all: spoken.input + spoken.output, in: average(spoken).input, out: average(spoken).output }) : say('card.comments.unread')
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
      ].join('\n'),
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const tally = bandAsks[e.surface] = { n: (bandAsks[e.surface]?.n ?? 0) + 1, last: /** @type {'svg' | 'row' | 'raster' | 'nothing'} */ ('nothing') }
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
    const recapping = !hatching && !a.demo && !!a.recap // where the work got to: it holds the bubble until the next prompt, and when it was is said as of now
    const asking = !hatching && !a.demo && !!a.ask && !(a.askKind && recapping) // the notice about the comments, or a question of the routine, holds the bubble until it is answered; a cuddle's line passes over it for its seconds. One of the routine waits under the recap: where the work got to comes first
    const opts = a.askKind ? a.askOpts.split(',').filter(Boolean) : []
    const mine = zooOf(v.animals, p) // the animals to pick from: with more than one the skin menu has a part for them
    const dressing = !hatching && !asking && !a.demo && a.skin > 0 && (v.closet.length > 0 || mine.length > 1) // the row of the parts is open: the bubble tells what is on, the buttons are the parts
    const now = await $.clock.now()
    // the welcome back, kept until the person does something: worded by how long they were away and the hour it is, as of now
    const away = !hatching && !a.demo && a.back ? backKind(a.back, now) : '', welcome = away ? voicedAs(L, `back.${away}`, STATS.indexOf(who.voice)) : ''
    const early = away === 'morning' && usualStart !== undefined && minutesOf(now) <= usualStart - 45 ? text(L, 'back.early') : null
    // under the greeting of the first chat of a day: yesterday in one line, dim
    const spoken = () => { const said = bubble(v, who); return ydayLine && now < ydayUntil && v.talk && !said.aside ? { ...said, aside: ydayLine } : said }
    const b = hatching ? quiet(text(L, a.egg > EGG_CRACKS ? 'egg.whole' : 'egg.crack')) : dressing ? { ...quiet([...(v.closet.length ? [wornLine(L, v.closet, p.wear, true)] : []), ...(mine.length > 1 ? [text(L, 'wears.part', { slot: text(L, 'part.animal'), item: animalName(L, p.species) })] : [])].join(text(L, 'sep'))), fix: text(L, 'skin.pick') } : a.noteLeft > 0 && a.note && !a.demo ? { ...quiet(a.note), fix: a.noteFix || null } : asking ? quiet(a.ask) : recapping ? { ...quiet(text(L, 'recap.say', { when: since(a.recapAt, await $.clock.now(), L), line: a.recap })), aside: welcome } : away ? { ...quiet(welcome), fix: early } : (a.demo ? a.demo === 'sleep' : a.sleep) ? quiet(text(L, 'sleep')) : spoken()
    // how long the phrase stays. What has its own time, or waits for an answer, is not timed here: the egg, the row of the parts, a
    // line held for its seconds, the demo, the notice about the comments and a greeting that asks (both go at the next prompt).
    // The plain line of a calm chat is not news: it never opens the bubble.
    const question = v.calm && v.talk?.kind === 'greet' && v.talk.greet === 'resume'
    const timed = !(hatching || dressing || asking || recapping || away || a.demo || (a.noteLeft > 0 && a.note) || question)
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
    // one row of text: a surface with neither a cell grid nor a drawing of ours, and a terminal too narrow or too low for the drawing.
    // Where there are no buttons a question of the routine says how to answer it; the notice about the comments names its command itself
    const told = asking && a.askKind && !(a.noteLeft > 0 && a.note) ? `${b.say} ${howTo(L, opts)}` : b.say
    const row = (/** @type {number} */ max) => { tally.last = 'row'; return Box({ children: [Text({ dimColor: true, children: [cut(open ? `${head}  ${told}` : head, max)] })] }) }

    const more = b.more
    // The buttons, in two places. The pet's own (skin) is under the drawing, at its left. A cuddle has no button: it is a click
    // on the drawing where one can be heard (the terminal, below), and /pet pet everywhere.
    // No button of ours hides the band: the engine draws its own `[-]` at the right end of the band, which folds it, and a second
    // one beside it was one too many (/pet hide still puts the pet away until /pet show). The buttons of a phrase, of a question or of the parts are in a row under the bubble, which
    // is there only when there are some: `ask` goes with its phrase. Each has how soon it goes when its row is too wide.
    /** @typedef {{ key: string, label: string, drop: number, el: () => any }} Key */
    const buttons = (/** @type {boolean} */ bubbled) => {
      /** @type {Key[]} */ const keys = [], /** @type {Key[]} */ own = []
      // any button pressed is the person here: the welcome back goes, and the routine's day goes on
      const adder = (/** @type {Key[]} */ list) => (/** @type {string} */ id, /** @type {string} */ label, /** @type {number} */ drop, /** @type {() => void} */ press, dim = false) => { const onPress = () => { touched($).catch(() => {}); press() }; list.push({ key: id, label, drop, el: () => Button({ key: id, label, plain: true, ...(dim ? { dimColor: true } : null), onPress }) }) }
      const key = adder(keys), ownKey = adder(own)
      const ask = bubbled ? b.ask : ''
      // a line that holds the bubble by itself (a cuddle's, an answer) covers the question for its seconds: the question's buttons wait with it
      const answering = asking && !(a.noteLeft > 0 && a.note)
      if (dressing) {
        for (const slot of partsOf(v.closet)) key(`slot-${slot}`, text(L, `part.${slot}`), 0, () => { turn($, slot).catch(() => {}) })
        if (mine.length > 1) key('slot-animal', text(L, 'part.animal'), 0, () => { turnAnimal($).catch(() => {}) })
        key('skin-done', text(L, 'btn.done'), 0, () => { skin($, false).catch(() => {}) }, true)
      } else {
        // a question of the routine: a button an answer. `other`, of the finish time, answers nothing by itself: it puts `/pet until ` in the
        // prompt box, as a fix button does, for the person to complete with a time and send
        if (answering && a.askKind) for (const opt of opts) key(`answer-${opt}`, answerLabel(L, opt), 0, () => { (opt === 'other' ? fix($, '/pet until ') : pressAnswer($, opt)).catch(() => {}) })
        else if (answering) key('voice-off', text(L, 'btn.comments.off'), 0, () => { answerVoice($, false).catch(() => {}) }) // the notice: one button, turn off
        else if ((v.closet.length || mine.length > 1) && !hatching) ownKey('skin', text(L, 'btn.skin'), 2, () => { skin($).catch(() => {}) }, true)
        if (ask) key('fix', b.label, 0, () => { fix($, ask).catch(() => {}) })
        if (more?.ask && bubbled) key('more', more.label, 0, () => { fix($, more.ask).catch(() => {}) })
        if (b.link && bubbled) { const href = b.link; keys.push({ key: 'guide', label: text(L, 'btn.guide'), drop: 1, el: () => Link({ href, label: text(L, 'btn.guide') }) }) }
      }
      return { keys, own }
    }

    // The Claude apps (desktop, mobile): the pet as an Svg, the frame its mood stands still on, drawn again when something changes
    // and by no timer of its own. The picture's own column: the name and the stars above it, centred, and the skin button under it,
    // at its left. Beside it the count of the other chats, the phrase while it is open, and the phrase's buttons under it.
    // A drawing past the Svg's limit, or an app without the element, keeps the row of text
    const count = board && p.chats ? board : ''
    const pic = (e.surface === 'desktop' || e.surface === 'mobile') && 'Svg' in ui ? still(v, a, p) : null
    if (pic && pic.source.length <= SVG_MAX && 'Svg' in ui) {
      const { keys, own } = buttons(open)
      tally.last = 'svg'
      const said = open ? [b.say, b.fix, more?.say, b.aside].flatMap((t, i) => t ? [Text({ ...(i ? { dimColor: true } : null), children: [t] })] : []) : []
      return Box({ flexDirection: 'row', gap: 2, alignItems: 'center', children: [
        // the picture's column does not shrink, and the text beside it does: a long line (the statistics of the birth, on a phone) wraps, and never takes the picture's room
        Box({ key: 'pic', flexDirection: 'column', alignItems: 'center', flexShrink: 0, children: [
          Box({ key: 'head', children: [Text({ dimColor: true, children: [bare] })] }),
          ui.Svg({ source: pic.source, alt: hatching ? p.name : `${p.name}, ${animalName(L, p.species)}`, width: pic.width, height: pic.height }),
          ...(own.length ? [Box({ key: 'own', alignSelf: 'flex-start', flexDirection: 'row', gap: 2, children: own.map(k => k.el()) })] : []),
        ] }),
        Box({ key: 'beside', flexDirection: 'column', flexShrink: 1, children: [
          ...(count ? [Box({ key: 'count', children: [Text({ dimColor: true, children: [count] })] })] : []),
          ...said,
          ...(keys.length ? [Box({ key: 'keys', flexDirection: 'row', gap: 2, children: keys.map(k => k.el()) })] : []),
        ] }),
      ] })
    }
    if (e.surface !== 'terminal') return row(Infinity)
    const Raster = 'Raster' in ui ? ui.Raster : undefined
    if (!Raster) return next(e) // no cell grid on this surface: draw nothing
    const s = sprite(v, a, p)
    // The room the band has (`bodyColumns`, and `maxRows` where the engine gives it). The drawing is never squeezed: under its
    // width, or its height, one row of text. What it has, at the right edge, is the pet's own column: the name and the stars
    // above the drawing, centred on it; the drawing; the skin button under it, at its left. To the left of the column, on the top
    // row, the count of the other chats; under that the bubble, its tail at the pet's eyes, and the phrase's buttons under it.
    // With less room than everything needs, in this order: the bubble narrows and wraps, then goes; the count of the other chats
    // goes (/pet chats tells it); the stars go and the name stays (the /pet card has them); the name is cut. With fewer rows than
    // the column needs the skin button goes first (it has a command), then the name.
    const room = Number(e.props.bodyColumns) > 0 ? Number(e.props.bodyColumns) : Infinity, high = Number(e.props.maxRows) > 0 ? Number(e.props.maxRows) : Infinity
    if (room < s.columns || high < s.rows) return row(room)
    tally.last = 'raster'
    const gap = Math.max(0, PET_ROWS - s.rows) // a shorter frame is pushed down, so the feet (and the eyes) stay where they are
    const named = high >= gap + s.rows + 1 // a row for the name over the drawing
    const label = !named ? '' : cols(bare) <= room ? bare : cut(p.name, room)
    const wide = Math.max(s.columns, cols(label)) // the pet's column: as wide as the drawing, or as its name when that is longer
    const mid = (/** @type {number} */ n) => Math.floor((wide - n) / 2) // what centres something of `n` columns in it
    const beside = room - wide - 2 // what is left of the column, less the tail and a cell of margin
    const wrapAt = Math.min(BUBBLE_MAX, beside - 4) // less the border and a cell of padding each side
    // the speech bubble: each phrase is wrapped here, by its width on screen, and the border hugs the widest line
    const phrases = [{ rows: wrap(b.say, Math.max(1, wrapAt)), dim: false }, ...(b.fix ? [{ rows: wrap(b.fix, Math.max(1, wrapAt)), dim: true }] : []), ...(more ? [{ rows: wrap(more.say, Math.max(1, wrapAt)), dim: true }] : []), ...(b.aside ? [{ rows: wrap(b.aside, Math.max(1, wrapAt)), dim: true }] : [])]
    const tall = Math.max(0, s.rows - PET_ROWS)
    const top = named ? 1 : 0 // the rows over the drawing
    const under = dressing || (asking && !(a.noteLeft > 0 && a.note)) || !!(b.ask || b.link || more?.ask) // a row of buttons under the bubble
    // shown when it is open, there is room for a line of BUBBLE_MIN columns, and it is not taller than the band may be
    const bubbled = open && wrapAt >= BUBBLE_MIN && top + tall + 3 + phrases.reduce((n, ph) => n + ph.rows.length, 0) + (under ? 1 : 0) <= high
    const inside = phrases.map(ph => Text({ ...(ph.dim ? { dimColor: true } : null), children: [ph.rows.join('\n')] }))
    const width = Math.max(...phrases.flatMap(ph => ph.rows.map(cols))) + 4 // border and one cell of padding each side
    const { keys, own } = buttons(bubbled)
    const span = (/** @type {Key[]} */ list) => list.reduce((n, k) => n + cols(k.label), 0) + 2 * Math.max(0, list.length - 1)
    const fit = (/** @type {Key[]} */ list, /** @type {number} */ max) => { while (list.length && span(list) > max) list.splice(list.reduce((at, k, i) => k.drop >= /** @type {Key} */ (list[at]).drop ? i : at, 0), 1) }
    // the pet's own button (skin), under the drawing from its left edge: only with a row for it and the columns it takes
    if (high < top + gap + s.rows + 1) own.length = 0
    fit(own, wide - mid(s.columns))
    // A click on the pet cuddles it. The Raster is a leaf and takes no press, so an empty region of a surface module (touch.js) lies
    // over it, as large as the drawing, and posts the click (`ui.message`, below): the drawing under it is as it was. Not over the egg
    const Client = 'Client' in ui ? ui.Client : undefined
    const touch = Client && !hatching ? [Box({ position: 'absolute', top: 0, left: 0, children: [Client({ key: TOUCH, module: './touch.js', props: { columns: s.columns, rows: s.rows }, width: s.columns, height: s.rows })] })] : []
    const pet = Box({ key: 'pet', flexDirection: 'column', width: wide, flexShrink: 0, children: [
      ...(named ? [Box({ key: 'head', marginLeft: mid(cols(label)), children: [Text({ dimColor: true, children: [label] })] })] : []),
      Box({ marginTop: gap, marginLeft: mid(s.columns), children: [Raster({ key: s.key, columns: s.columns, rows: s.rows, cells: s.cells }), ...touch] }),
      ...(own.length ? [Box({ key: 'own', flexDirection: 'row', gap: 2, marginLeft: mid(s.columns), children: own.map(k => k.el()) })] : []),
    ] })
    // the count of the other chats: on the top row, left of the name, when the row has the room
    const counted = (/** @type {number} */ max) => count && named && cols(count) <= max ? [Text({ dimColor: true, children: [count] })] : []

    if (!bubbled) // no bubble (closed, or no room for it): the pet's column, and the count beside its name
      return Box({ flexDirection: 'row', width: '100%', justifyContent: 'flex-end', children: [Box({ key: 'count', marginRight: 2, children: counted(beside) }), pet] })
    fit(keys, beside)
    // bottom right, next to the prompt, where the old /buddy sat: text first, the pet's column at the edge.
    // Rows: 0 the count and, over the drawing, the name; 1 free; 2 the bubble's top border; 3 its first line. The pet's eyes are 4
    // rows above its feet, so a pet of PET_ROWS under its name has them on row 3, where the tail is; a shorter frame is pushed
    // down to keep the feet (and the eyes) still, and under a taller one (a pet on its skateboard) the bubble and the tail come
    // down with the eyes.
    return Box({ flexDirection: 'row', width: '100%', justifyContent: 'flex-end', children: [
      Box({ flexDirection: 'column', alignItems: 'flex-end', children: [
        Box({ key: 'count', height: 1 + top + tall, children: counted(beside) }),
        Box({ key: 'bubble', flexDirection: 'column', width, flexShrink: 0, paddingX: 1, borderStyle: 'round', borderDimColor: true, children: inside }),
        ...(keys.length ? [Box({ key: 'keys', flexDirection: 'row', gap: 2, children: keys.map(k => k.el()) })] : []),
      ] }),
      Box({ key: 'tail', marginTop: 2 + top + tall, marginRight: 1, children: [Text({ dimColor: true, children: ['─'] })] }),
      pet,
    ] })
  })
}
