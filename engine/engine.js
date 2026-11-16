// @ts-check
// Hatchling engine: pure state machine. Adapters (the Claude Code mod; Codex hooks are planned) feed it events
// and persist the JSON state; nothing here does IO or touches the model context.

import { tidy } from './width.js'

/**
 * Adapters send `read` and `cmd` only for the main agent: a subagent has its own context,
 * so its reads are not re-reads. `range` tells partial reads of one file apart.
 * @typedef {{ type: 'sessionStart', t: number }
 *   | { type: 'sessionEnd', t: number }
 *   | { type: 'prompt', t: number, turn?: boolean }
 *   | { type: 'read', t: number, path: string, mtime: number, range?: string }
 *   | { type: 'edit', t: number }
 *   | { type: 'cmd', t: number, cmd: string, ok: boolean }
 *   | { type: 'usage', t: number, input: number, cacheRead: number, cacheWrite: number, contextPct?: number, lean?: boolean, wait?: boolean }
 *   | { type: 'lean', t: number, on: boolean, wait?: boolean }
 *   | { type: 'cacheMiss', t: number, cause?: string }
 *   | { type: 'compact', t: number }
 *   | { type: 'turnEnd', t: number, roll?: number }
 *   | { type: 'cuddle', t: number }
 *   | { type: 'buy', t: number, id: string }
 *   | { type: 'animal', t: number, id: string, free?: boolean }
 *   | { type: 'greet', t: number, kind: GreetKind, name?: string, ago?: number, done?: boolean, buddy?: boolean }
 *   | { type: 'peer', t: number, here: boolean, name?: string, ago?: number, said?: string, ask?: boolean }
 *   | { type: 'voice', t: number, text: string, why?: string }} PetEvent
 * @typedef {'resume' | 'back' | 'first' | 'seen' | 'new'} GreetKind
 * @typedef {'recap' | 'tidy' | 'voice' | 'peer' | 'greet' | 'coffee' | 'silly'} TalkKind
 * What the pet says as a companion: one line at a time, local text only. `greet`, `name`, `ago` and `done` belong to a greeting or a peer's
 * line, `n` to the coffee break (turns), the nonsense (0..1, which word) and the welcome back (coins given), `fails`, `rereads` and `rebuilds` to the recap of a turn,
 * `text` and `why` to a line of the voice (written by a model when the person turned the voice on; the adapter hands it in already cleaned):
 * the talk itself when its kind is `voice`, the line shown under a recap or an outline offer when it came in the same turn.
 * @typedef {{ kind: TalkKind, at: number, until?: number, greet?: GreetKind, name?: string, ago?: number, done?: boolean, here?: boolean, n?: number, fails?: Record<string, number>, rereads?: number, rebuilds?: number, text?: string, why?: string, said?: string, buddy?: boolean, ask?: boolean }} Talk
 * @typedef {'stomach' | 'dizzy' | 'loop' | 'bloated' | 'heavy' | 'cold'} IssueKind
 * @typedef {'lean' | 'evolve'} CheerKind
 * @typedef {ReturnType<typeof initialState>} State
 * @typedef {{ kind: IssueKind, untilTurn: number, until: number, detail?: string, n?: number, turns?: number }} Issue
 */

// The pet never loses anything: no health, no knock-out, no sickness. What it notices (a long chat without lean, re-reads, loops, cache
// rebuilds, a nearly full context) is a note in the bubble, a friend's advice that costs nothing. The long-chat note rests on what the
// bench measured: a long chat cost less with the style on (bench/RESULTS.md, Series 4). Lean is the style in effect, as the adapter says;
// `wait` is the style chosen but not in the system prompt yet.
// What grows is affection: it comes with ordinary use and with cuddles, and nothing the person does or does not do takes it away.
export const RULES = {
  heavyTokens: 60_000,     // context re-read by every request from which a chat counts as long: between the bench's short tasks (about 26k, no saving shown) and its long one (about 96k, saving shown)
  loopFails: 3,            // same command failing this many times with no file edit in between = loop
  cacheBreakMinTokens: 2000,
  cacheBreakShare: 0.5,    // cache writes over half of the request's input = rebuilt prefix
  cacheTtlMs: 5 * 60_000,  // a break after a pause this long is the cache expiring: shown as a note
  // A prompt sent after a pause over coldAfterMs, in a chat of coldTokens or more, gets one piece of advice: the cache is gone, a smaller
  // start costs less. Nothing is done for the person. shortcut: 1 hour is an assumption (the documented cache life is 1 hour on a
  // subscription, 5 minutes with an API key, and the mod cannot tell which): with a 5 minute cache the advice comes late or not at all
  coldAfterMs: 60 * 60_000,
  coldTokens: 100_000,
  bloatedPct: 85,
  issueTurns: 2,           // an issue stays on screen for this many turns...
  issueMinMs: 30_000,      // ...and at least this long
  cheerGapMs: 10 * 60_000, // at most one cheer every 10 minutes; the best one skipped is shown later
  cheerShowMs: 8_000,      // animated this long, then held as a still pose until the next prompt
  daysKept: 8,             // how many of the last days counted are remembered, to count a day once when two chats both opened it
  rareChance: 0.01,        // golden variant, rolled once when the pet is born: that pet has the golden coat from the start, for nothing
  animals: ['penguin', 'chick', 'dog', 'bunny', 'fox', 'cactus'], // the animals that can be unlocked: the six common ones of sprites/zoo.py. The rare one is had only by who is born as it, and the ones of a skin pack by who installed it
  animalPrice: 100,        // what unlocking one costs, once: the animal a pet is born as is free, and one unlocked stays
  goldenPrice: 300,        // what the golden coat costs who was not born with it: a colour and nothing else, about a week of full days
  coatPrices: /** @type {Record<string, number>} */ ({ pastel: 150, terminal: 200 }), // the plain coats: a colour too, with no glint and no sparkle, and nobody is born with one

  // Coins and affection. Every coin earned by use or by a cuddle is also a point of affection; affection is never spent and never drops.
  // No streak of days, no timer, no random prize: the same use always earns the same.
  coinsTurn: 1,            // per turn ended...
  coinTurnsDay: 30,        // ...for the first this many turns of a day
  coinsCuddle: 2,          // per cuddle...
  coinCuddlesDay: 3,       // ...for the first this many cuddles of a day
  coinsFirstUse: 5,        // at the first turn or cuddle of a day
  coinsWelcome: 10,        // the gift at a return after backAfterMs: coins only, once per absence
  // What the shop asks. Only things to wear: nothing bought changes what the pet does. The cheapest come within a first session
  // (5 + a few turns or cuddles), the others in 1 to 3 days at 20 to 41 coins a day
  prices: /** @type {Record<string, number>} */ ({ shades: 10, mug: 12, balloon: 15, glasses: 20, eyepatch: 20, duck: 25, partyhat: 25, scarf: 30, cap: 30, sneakers: 35, boots: 35, lamp: 40, santa: 40, headphones: 45, hoodie: 45, backpack: 50, wand: 50, skateboard: 55, suitcase: 60, laptop: 65, sombrero: 70, wizard: 80 }),
  heartsAt: [10, 50, 150, 300, 500], // affection at which each of the five hearts fills
  // The stages: days the pet was used on, and affection gathered. Not the cache, not how lean a chat was
  grownAt: { days: 3, affection: 60 },
  bloomAt: { days: 20, affection: 500 },
  // The voice has two characters: the highest statistic speaks nearly always, the second highest now and then. Its share of the lines
  // goes from `near` when the two values are equal down to `far` when they are `gap` points apart or more
  voiceSecond: { near: 0.5, far: 0.05, gap: 36 },
  happyCuddleMs: 2 * 3_600_000, // content for this long after a cuddle...
  happyTurns: 10,          // ...or from this many turns in the day; calm otherwise, never sad
  legacyUnlocks: /** @type {Record<string, number>} */ ({ shades: 5, sombrero: 10, scarf: 15 }), // efficient sessions that unlocked these before the shop: who had them keeps them
  maxReads: 500,           // shortcut: oldest reads are dropped past this, raise if long sessions reread old files

  // The companion: what the pet says beyond the notes. One greeting when a chat opens, then a line only when there is something new.
  // A warning (a note, a long chat without lean) always holds the bubble: a line said meanwhile is not seen,
  // except the recap and the outline offer, which then sit on a second line. Nonsense, coffee and greeting are never said over a warning.
  talkRank: ['recap', 'tidy', 'voice', 'peer', 'greet', 'coffee', 'silly'], // most important first: a line on screen gives way only to one that ranks the same or higher
  talkUrgent: ['recap', 'voice', 'peer', 'greet'], // about something that just happened: these do not wait for talkGapMs
  talkGapMs: 3 * 60_000,   // at least this long between two lines; the outline offer, the coffee and the nonsense wait for a later turn
  talkShowMs: 8_000,       // a line stays at least this long, and until the next prompt
  resumeWithinMs: 12 * 3_600_000, // a chat left in this folder within this is worth a "pick it up?"
  backAfterMs: 3 * 86_400_000,    // no chat anywhere for this long is a return after a long pause
  marksMax: 30,            // chats remembered in the shared store...
  marksMs: 30 * 86_400_000, // ...and for how long
  peerGapMs: 5 * 60_000,   // another chat ending its turn is told at most this often
  peerMinTurnMs: 2 * 60_000, // ...only a turn that lasted this long, a job the person was waiting for
  peerAgainMs: 10 * 60_000,  // ...and the same chat no sooner than this
  peerActiveMs: 30 * 60_000, // ...and only to a chat used within this
  // The board of the chats: each open chat says it is alive every chatBeatMs; one silent for chatDeadMs counts as closed (it died
  // without saying so). A call the agent asked leave for, still not started after chatAskAfterMs, is a chat that may wait for an OK
  chatBeatMs: 20_000,
  chatDeadMs: 90_000,
  chatAskAfterMs: 5_000,
  recapTurnMs: 2 * 60_000, // a turn this long is a long one...
  recapMinWrong: 2,        // ...and gets a recap when at least this many things went wrong in it
  tidyAgainTurns: 15,      // turns of the chat before the outline is offered again
  coffeeTurns: 20,         // turns in a row, in one sitting, before "coffee break?"
  coffeeGapMs: 90 * 60_000, // at most one coffee break this often
  sitGapMs: 15 * 60_000,   // a pause this long ends a sitting
  sillyChance: 0.04,       // per calm turn
  sillyMinTurns: 12,       // turns of the chat before the first nonsense, and between two

  // The voice (engine/voice.js): off unless the person turns it on, because each line is a request to a small model, paid by their account
  voiceCapDay: 40,         // lines a day, over every chat
  voiceGapMs: 10 * 60_000, // at the end of a turn, at most one line this often, and the same wait holds during a turn that lasts longer than this...
  // each reason to speak waits at least this long since the last line for the same reason, so a slow connection or a burst of
  // events never sends a volley; `turn` and `long` wait voiceGapMs since any line
  voiceEvery: /** @type {Record<string, number>} */ ({ fail: 30_000, files: 30_000, cuddle: 20_000, say: 5_000, peer: 60_000 }),
  voiceMaxChars: 120,      // and no line is longer than this many characters, however narrow they are on screen
  voiceManyFiles: 5,       // ...but at once after a failed command, a cuddle, or a turn that changed this many files
  voiceMaxCols: 60,        // columns on screen (a Chinese character takes two): a line wider than this is dropped, not cut: the fixed line stays, and the call is counted as paid
  voiceRecall: 2,          // how many of its last lines are sent back to the model, so that the next one does not repeat them
  voiceMaxWords: 8,        // what the model is asked for
  voiceMaxTokens: 30,      // the reply's cap, as asked: 8 words are about 12 tokens. Claude Code 2.1.323 does not hold it (a cap of 5 gave 18 tokens, 40 gave 299): what keeps a reply short is the prompt
  voiceTimeoutMs: 4_000,   // a call slower than this is dropped: the fixed line stays
  voiceTailChars: 600,     // how much of the end of the assistant's reply is sent
  voiceEst: { input: 650, output: 75 }, // a line's tokens before one is measured here: measured in November 2026 over 112 lines of our own store (72,880 in, 8,563 out). The 75 out are for a line of about 12 tokens: the rest is the model's thinking, which a mod cannot switch off (only `effort`, already `low`)

  // The diary (engine/diary.js): a few lines the mod writes by itself in the store. Times, counts and folder names only
  waitCountMs: 2 * 3_600_000, // a chat whose turn ended counts as waiting for the person for this long, then no more: the count is never stuck
  workDays: 8,             // days of work counters kept for /pet diary: today and the week before
  remindShowMs: 20_000,    // how long a reminder holds the bubble
  remindStartMs: 15_000,   // a chat that opens shows the reminders this long after its greeting
  diaryMax: 40,            // lines kept; the oldest go
  diaryLongMs: 3 * 3_600_000, // a day with this much time at work is a long one
  diaryAwayDays: 3,        // a return after this many days without a chat is written down (and never said aloud: no word on the days away)
  diaryHabitMin: 5,        // chats opened, or sittings, before a habit is drawn from them
  diarySittings: 20,       // how many of the last sittings the usual length is taken from
  diaryFolders: 12,        // folders counted; the least used goes
  diaryRecall: 3,          // how many lines, at most, go to the model as memories when the comments are on
  saySaidChars: 300,       // how much of what the person writes after /pet say is sent to the model
  sayShowMs: 12_000,       // how long the pet's answer stays in the bubble
  cuddleShowMs: 5_000,     // how long the line of a cuddle holds the bubble, over any other line; the comment about it, when one comes, starts the time again

  // The recap (engine/voice.js `recap`), part of the comments: where the work got to, said once when the person is back after a pause
  recapAfterMs: 30 * 60_000, // the pause: this long after a turn ended with no new prompt, in a chat left open or in one closed and resumed
  recapChars: 16_000,      // how much text goes to the model in all: the start of the person's last prompt and the end of what the assistant wrote in the last turn
  recapPromptChars: 300,   // ...of which this much of the prompt, at most
  recapMaxCols: 120,       // columns on screen: a recap wider than this is cut at the last whole word that fits, never dropped (it was paid for)
  recapAskCols: 100,       // what the model is asked for, in characters (half of it in a language of wide characters): under the limit, so the cut is rare
  recapMaxTokens: 80,      // the reply's cap, as asked
  recapTimeoutMs: 20_000,  // a call slower than this is dropped: the pet stays silent. Live on 16 November 2026 the calls took 3.6 and 6.2 seconds (the model thinks) and one of three was lost at 8
}

// Most important first: decides which rate-limited cheer is kept for later.
const RANK = /** @type {CheerKind[]} */ (['evolve', 'lean'])

/** The parts a thing is worn on, in the order they are told: one thing on each at a time. `accessory` is a thing standing on the ground next to the pet. */
export const SLOTS = ['head', 'face', 'body', 'feet', 'accessory', 'coat']

/**
 * The shop: things to wear, bought with coins, each with its part. The order is the catalogue's, and the one of the drawings (sprites/zoo.py WEAR).
 * `month` (1 to 12) is the only month a thing is sold in: see `sells`.
 * @type {{ id: string, name: string, slot: string, price: number, month?: number }[]}
 */
export const SHOP = [
  { id: 'shades', name: 'sunglasses', slot: 'face' },
  { id: 'mug', name: 'a coffee mug', slot: 'accessory' },
  { id: 'balloon', name: 'a balloon', slot: 'accessory' },
  { id: 'glasses', name: 'round glasses', slot: 'face' },
  { id: 'eyepatch', name: 'an eye patch', slot: 'face' },
  { id: 'duck', name: 'a rubber duck', slot: 'accessory' },
  { id: 'partyhat', name: 'a party hat', slot: 'head' },
  { id: 'scarf', name: 'a red scarf', slot: 'body' },
  { id: 'cap', name: 'a travel cap', slot: 'head' },
  { id: 'sneakers', name: 'sneakers', slot: 'feet' },
  { id: 'boots', name: 'boots', slot: 'feet' },
  { id: 'lamp', name: 'a desk lamp', slot: 'accessory' },
  { id: 'santa', name: 'a Santa hat', slot: 'head', month: 12 },
  { id: 'headphones', name: 'headphones', slot: 'head' },
  { id: 'hoodie', name: 'a hoodie', slot: 'body' },
  { id: 'backpack', name: 'a backpack', slot: 'accessory' },
  { id: 'wand', name: 'a magic wand', slot: 'accessory' },
  { id: 'skateboard', name: 'a skateboard', slot: 'feet' },
  { id: 'suitcase', name: 'a suitcase', slot: 'accessory' },
  { id: 'laptop', name: 'a laptop', slot: 'accessory' },
  { id: 'sombrero', name: 'a sombrero', slot: 'head' },
  { id: 'wizard', name: "a wizard's hat", slot: 'head' },
].map(i => ({ ...i, price: RULES.prices[i.id] ?? 0 }))

/**
 * Whether the shop sells a thing at a moment: always, but for one with a `month`, sold only from the first to the last day of that
 * month by the clock of the person's machine. Who has it keeps it and wears it all year.
 * @param {string} id @param {number} t
 */
export function sells(id, t) {
  const month = SHOP.find(i => i.id === id)?.month
  return month === undefined || new Date(t).getMonth() + 1 === month
}

/** The crown: not sold. A pet grown to its last stage has it, on its head unless the person takes it off or picks a hat. */
export const CROWN = { id: 'crown', name: 'the crown', slot: 'head', price: 0 }
/** The golden coat: the pet's own colour turned to gold, on any animal at any stage. Sold apart from the things to wear, and a pet born golden has it. */
export const GOLDEN = { id: 'golden', name: 'a golden coat', slot: 'coat', price: RULES.goldenPrice }
/** The coats, cheapest first. The two plain ones are a colour like the golden one, with no glint and no sparkle; they go on by choice only. */
export const COATS = [
  { id: 'pastel', name: 'a pastel coat', slot: 'coat', price: RULES.coatPrices.pastel ?? 0 },
  { id: 'terminal', name: 'a terminal coat', slot: 'coat', price: RULES.coatPrices.terminal ?? 0 },
  GOLDEN,
]
/** Everything that can be bought: the things to wear, then the coats. */
export const SOLD = [...SHOP, ...COATS]
/**
 * The founder's keepsake: half the shell the pet hatched from, worn as a hat. Not sold. A pet born on or before FOUNDER_UNTIL has it
 * (`birth`), and who has it keeps it for ever. The one place the date is written: a local date of the person's machine.
 * The rule: 30 days after the day the repository goes public. The value here is provisional until that day: the person sets it then.
 */
export const FOUNDER_UNTIL = '2027-01-31'
export const EGGSHELL = { id: 'eggshell', name: 'half an eggshell', slot: 'head', price: 0 }
/** What a pet can own, in the order it is kept and told: the keepsake, then what is sold. */
export const OWNABLE = [EGGSHELL, ...SOLD]
/**
 * Everything a pet can have on: the crown, the founder's eggshell, then what is sold in its order, then what the person's skin packs bring (`extend`).
 * @type {{ id: string, name: string, slot: string, price: number, pack?: string, names?: Record<string, string> }[]}
 */
export const WEARABLE = [CROWN, EGGSHELL, ...SOLD]
/** The things and coats of the person's skin packs (engine/skins.js): theirs from the moment the pack is installed. Never bought, never kept in the pet. */
let extra = /** @type {string[]} */ ([])
/** Sets what the skin packs bring, in place of what they brought before. @param {{ id: string, name: string, slot: string, price: number, pack: string, names: Record<string, string> }[]} items */
export function extend(items) {
  WEARABLE.splice(1 + OWNABLE.length, WEARABLE.length, ...items)
  extra = items.map(i => i.id)
}
/** In what is kept: the head was left bare by choice, so the crown stays off. */
const BARE = 'nohead'
/** In what is kept, and what the person types: the coat of the pet's own colour, picked by who has the golden one. */
export const PLAIN = 'plain'

/** What a pet has to put on: the things bought, the crown once it is fully grown, and what the skin packs bring. @param {string[]} owned @param {string} stage */
export const closetOf = (owned, stage) => [...(stage === 'bloom' ? [CROWN.id] : []), ...owned, ...extra]

const slotOf = (/** @type {string} */ id) => WEARABLE.find(i => i.id === id)?.slot ?? ''
const inOrder = (/** @type {string[]} */ ids) => SLOTS.flatMap(slot => ids.filter(id => slotOf(id) === slot).slice(-1))
/**
 * How what is on is kept: the ids with a space between, `none` for no thing on, and `nohead` after them when the crown is there and
 * the head is bare: without it the crown is on. @param {string[]} closet @param {string[]} ids
 */
const kept = (closet, ids) => [...(ids.length ? ids : ['none']), ...(closet.includes(CROWN.id) && !ids.some(id => slotOf(id) === 'head') ? [BARE] : []), ...(closet.includes(GOLDEN.id) && !ids.includes(GOLDEN.id) ? [PLAIN] : [])].join(' ')

/**
 * What the pet has on, in the order of SLOTS: of the ids kept, the ones in the closet (the things owned, and the crown: `closetOf`),
 * one for each part (the last named wins). The crown is on whenever it is there and the head was not given a hat nor left bare.
 * A choice from before the parts, one id or none at all, still counts: with nothing owned among the ids kept, the pet wears the
 * last thing owned in the shop's order, as it did then. The golden coat is on whenever it is there and the plain one was not picked.
 * @param {string[]} closet @param {string} wear @returns {string[]}
 */
export function wornOf(closet, wear) {
  const have = WEARABLE.filter(i => closet.includes(i.id)), said = String(wear ?? '').split(/\s+/).filter(Boolean)
  const on = new Map()
  for (const id of said) { const item = have.find(i => i.id === id); if (item) on.set(item.slot, item.id) }
  const last = have.filter(i => i !== CROWN && i.slot !== GOLDEN.slot && !i.pack).at(-1) // a coat, or a thing of a pack, is put on by choice only
  if (!on.size && last && !said.includes('none') && !said.includes(BARE) && !(last.slot === 'head' && have.includes(CROWN))) on.set(last.slot, last.id) // a hat nobody named does not hide the crown
  if (!on.has('head') && have.includes(CROWN) && !said.includes(BARE)) on.set('head', CROWN.id)
  if (have.includes(GOLDEN) && !said.includes(PLAIN) && !on.has(GOLDEN.slot)) on.set(GOLDEN.slot, GOLDEN.id) // a coat of a pack, picked, goes over it
  return SLOTS.flatMap(slot => on.has(slot) ? [on.get(slot)] : [])
}

/** What is kept with an owned thing put on: it takes its part, and what was there comes off. @param {string[]} closet @param {string} wear @param {string} id */
export const putOn = (closet, wear, id) => kept(closet, closet.includes(id) && slotOf(id) ? inOrder([...wornOf(closet, wear), id]) : wornOf(closet, wear))

/** What is kept with one thing taken off, or with `none` everything worn: the coat is a colour, and stays as it is. @param {string[]} closet @param {string} wear @param {string} id */
export const takeOff = (closet, wear, id) => kept(closet, wornOf(closet, wear).filter(x => id === 'none' ? slotOf(x) === GOLDEN.slot : x !== id))

/** One part turned: the next thing owned for it (the crown first, then the shop's order), and after the last one nothing: for the coat, each one owned and then plain. @param {string[]} closet @param {string} wear @param {string} slot */
export function turnSlot(closet, wear, slot) {
  const have = WEARABLE.filter(i => i.slot === slot && closet.includes(i.id)).map(i => i.id)
  const now = wornOf(closet, wear).find(id => slotOf(id) === slot)
  const next = have[now ? have.indexOf(now) + 1 : 0]
  return next ? putOn(closet, wear, next) : now ? takeOff(closet, wear, now) : kept(closet, wornOf(closet, wear))
}

/** The day a moment falls in, by the clock of the person's machine. @param {number} t */
export const dayOf = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / 86_400_000)

/** The date a moment falls on, by the clock of the person's machine: `2027-01-31`. @param {number} t */
const dateOf = (t) => { const d = new Date(t); return [String(d.getFullYear()).padStart(4, '0'), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-') }

/** Whether a pet born at a moment is a founder's: born on or before FOUNDER_UNTIL, the whole of that day included. @param {number} born */
export const founder = (born) => born > 0 && dateOf(born) <= FOUNDER_UNTIL

/**
 * A pet with its birth known and what comes with it. One without a birth (a newborn, or a pet of a version before this one) takes
 * `known`, an earlier moment it is known to have lived at, else `now`: it was born by then. A founder's pet has the eggshell from
 * then on; a pet born later never gets it, and one that has it keeps it whatever the date: nothing here takes it away.
 * @template {{ born: number, owned: string[] }} T @param {T} s @param {number} now @param {number} [known] @returns {T}
 */
export function birth(s, now, known = 0) {
  const born = s.born > 0 ? s.born : known > 0 && known < now ? known : now
  const owned = founder(born) && !s.owned.includes(EGGSHELL.id) ? [EGGSHELL.id, ...s.owned] : s.owned
  return born === s.born && owned === s.owned ? s : { ...s, born, owned }
}

/** How many of the five hearts an affection fills. @param {number} affection */
export const hearts = (affection) => RULES.heartsAt.filter(n => affection >= n).length

/** @param {number} [roll] 0..1, decides the rare variant; adapters leave it out */
export function initialState(roll = Math.random()) {
  return {
    /** @type {'golden' | null} */ variant: roll < RULES.rareChance ? 'golden' : null,
    born: 0,        // when the pet was born; 0 until the adapter says (`birth`)
    life: { input: 0, cacheRead: 0 }, // all-time token counters, for the pet card
    turn: 0,
    coins: 0,
    affection: 0,   // every coin ever earned by use or cuddles: never spent, never lowered
    days: 0,        // days the pet was used on
    day: 0,         // the last of them (dayOf), with what was counted in it
    /** @type {number[]} */ lately: [], // the last days counted, the newest last: how two chats tell a day both counted from one only one did (`merge`)
    dayTurns: 0,
    dayCuddles: 0,
    cuddledAt: 0,
    giftAt: 0,      // when the last welcome-back gift was given
    /** @type {string[]} */ animals: [], // the animals unlocked, by name: the one the pet was born as is not here, it is always its own
    /** @type {string[]} */ owned: roll < RULES.rareChance ? [GOLDEN.id] : [], // what was bought, by id; who is born golden has the golden coat
    /** @type {Issue[]} */ issues: [],
    /** @type {{ kind: CheerKind, at: number, value?: number, until?: number } | null} */ cheer: null,
    lastCheerAt: 0,
    /** @type {{ kind: CheerKind, value: number } | null} */ queued: null,
    session: freshSession(),
  }
}

function freshSession() {
  return {
    /** @type {Record<string, number>} path(#range) -> mtime seen */ reads: {},
    /** @type {Record<string, { n: number, since: number }>} command -> failures since the last file edit, and the turn of the first */ blind: {},
    requests: 0,
    input: 0,
    cacheRead: 0,
    lastUsageAt: 0,
    expectRebuild: true, // first request and the one after a compaction write the cache by design
    contextPct: 0,
    context: 0,   // tokens the last request re-read: the size of the chat
    lean: false,  // the style is in effect, as the adapter says
    leanWait: false, // it is chosen, but waits for the next compaction or chat
    /** @type {Talk | null} */ talk: null,
    lastTalkAt: 0,
    turns: 0,     // turns of this chat
    turnAt: 0,    // when the running turn's prompt came, 0 between turns
    /** @type {Record<string, number>} program -> failures in the running turn; names only, never arguments */ fails: {},
    rereads: 0,   // in the running turn
    rebuilds: 0,
    tidyNext: 0,  // the turn of this chat from which the outline may be offered (again)
    sillyNext: RULES.sillyMinTurns,
    peerAt: 0,
    sit: 0,       // turns in a row in this sitting
    sitAt: 0,     // when the last one ended
    coffeeAt: 0,
  }
}

const clamp = (/** @type {number} */ n) => Math.max(0, Math.min(100, n))
const normCmd = (/** @type {string} */ c) => c.trim().replace(/\s+/g, ' ')

const WRAPPERS = ['sudo', 'env', 'time', 'nice', 'nohup', 'command', 'exec']
/**
 * A short print of a text that came from outside (a file's path, a command line): what the session keeps in its place, so that
 * neither stays in memory another plugin could read, and no such text is ever the name of a field (`__proto__` is one too).
 * Two texts are told apart by it, and nothing of them can be read back. FNV-1a, 32 bits. @param {string} text
 */
export function print(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return `h${(h >>> 0).toString(16).padStart(8, '0')}`
}
/** A value an object holds under a name of its own: what it inherits (`constructor`, `toString`) is not there. @param {Record<string, any>} o @param {string} k */
const own = (o, k) => Object.hasOwn(o, k) ? o[k] : undefined

/**
 * The program a command runs, as a bare name, or '' when it cannot be told safely. Arguments and VAR=value may hold a secret,
 * so nothing else of the command is ever shown or kept: a leading `cd dir &&` and wrappers like sudo are skipped, a path keeps its last part.
 * @param {string} cmd
 */
export function program(cmd) {
  let c = cmd.trim()
  for (let m; (m = /^cd\s+[^\s;&|'"`$]+\s*(&&|;)\s*/.exec(c));) c = c.slice(m[0].length)
  const word = c.split(/\s+/).find(w => !w.includes('=') && !WRAPPERS.includes(w)) ?? ''
  const name = word.split('/').pop() ?? ''
  return /^[\w.+-]{1,24}$/.test(name) && !(name in {}) ? name : '' // nor a name every object has: it would be read as a field of one
}

/** Whether nothing holds the bubble: no note or cheer, and no long chat without lean.
 * @param {State} s @param {number} now */
function calm(s, now) {
  const ss = s.session
  if (s.issues.some(i => i.untilTurn > s.turn || now < i.until)) return false
  if (s.cheer && (s.cheer.until === undefined || now < s.cheer.until)) return false
  return ss.lean || ss.context < RULES.heavyTokens
}

/**
 * @param {ReturnType<typeof initialState>} prev
 * @param {PetEvent} e
 */
export function reduce(prev, e) {
  const s = /** @type {State} */ (JSON.parse(JSON.stringify(prev))) // JSON clone: the state is JSON anyway, and a mod sandbox may lack structuredClone
  const ss = s.session
  /** A note: on screen for a while, and it costs the pet nothing.
   * @param {IssueKind} kind @param {string} [detail] @param {{ n?: number, turns?: number }} [more] */
  const issue = (kind, detail, more) => {
    s.issues = s.issues.filter(i => i.kind !== kind)
    s.issues.push({ kind, untilTurn: s.turn + RULES.issueTurns, until: e.t + RULES.issueMinMs, detail, ...more })
  }
  /** Coins, and as much affection. @param {number} n */
  const gain = (n) => { s.coins += n; s.affection += n }
  /** The first turn or cuddle of a day counts the day and brings its coins. */
  const use = () => {
    const d = dayOf(e.t)
    // The days only go forward: a new day is one strictly after the last counted. A clock behind the day kept (another time zone, a
    // clock set back, a store written by a machine ahead) leaves the turn in the day kept: same caps, no gift, no day counted again.
    // A pet with no day yet was never used, whatever its `day` reads
    if (s.days > 0 && d <= s.day) return
    s.day = d
    s.lately = [...s.lately.filter(x => x !== d), d].slice(-RULES.daysKept)
    s.days++
    s.dayTurns = s.dayCuddles = 0
    gain(RULES.coinsFirstUse)
  }
  /** @param {CheerKind} kind */
  const cheer = (kind, value = 0, force = false) => {
    if (!force && e.t - s.lastCheerAt < RULES.cheerGapMs) {
      if (!s.queued || RANK.indexOf(kind) < RANK.indexOf(s.queued.kind)) s.queued = { kind, value }
      return
    }
    s.cheer = { kind, at: e.t, value }
    s.lastCheerAt = e.t
  }

  /** Says a companion line, if the one on screen gives way and the gap since the last has passed. True when said.
   * @param {TalkKind} kind @param {Partial<Talk>} [more] */
  const say = (kind, more) => {
    const rank = (/** @type {TalkKind} */ k) => RULES.talkRank.indexOf(k)
    const on = ss.talk && (ss.talk.until === undefined || e.t < ss.talk.until) ? ss.talk : null
    if (on && rank(kind) > rank(on.kind)) return false
    if (!RULES.talkUrgent.includes(kind) && ss.lastTalkAt && e.t - ss.lastTalkAt < RULES.talkGapMs) return false
    // a recap or the outline offer that takes the place of a comment still on screen keeps it, as the line under its own
    const under = on?.kind === 'voice' && (kind === 'recap' || kind === 'tidy') ? { text: on.text, why: on.why } : null
    ss.talk = { kind, at: e.t, ...under, ...more }
    ss.lastTalkAt = e.t
    return true
  }

  const lean = (/** @type {boolean} */ on, wait = false) => {
    const heavy = s.issues.some(i => i.kind === 'heavy')
    if (on || wait) s.issues = s.issues.filter(i => i.kind !== 'heavy')
    // over a cheer still on screen (one announced at the start of the chat) this one waits its turn
    if (on && !ss.lean && (heavy || ss.leanWait)) cheer('lean', 0, !s.cheer || s.cheer.kind === 'lean' || (s.cheer.until !== undefined && e.t >= s.cheer.until))
    ss.lean = on
    ss.leanWait = wait && !on
  }

  switch (e.type) {
    case 'sessionStart':
      // a style that waited for the next chat enters now: the adapter's `lean` event cheers it. A sitting goes on across a /clear
      s.session = { ...freshSession(), leanWait: !!ss.leanWait, sit: ss.sit || 0, sitAt: ss.sitAt || 0, coffeeAt: ss.coffeeAt || 0 }
      s.issues = []
      s.cheer = null
      s.queued = null
      break

    case 'prompt': // the user is back at the keyboard: a held cheer has been seen
      if (s.cheer) s.cheer.until = Math.max(s.cheer.at + RULES.cheerShowMs, e.t)
      if (ss.talk) ss.talk.until = Math.max(ss.talk.at + RULES.talkShowMs, e.t)
      ss.turnAt = e.t
      ss.fails = {}
      ss.rereads = ss.rebuilds = 0
      // the cache has expired in the pause: this prompt sends the whole chat again, and so would the next after another pause
      if (e.turn !== false && ss.lastUsageAt && e.t - ss.lastUsageAt > RULES.coldAfterMs && ss.context >= RULES.coldTokens) issue('cold', String(Math.round(ss.context / 1000)))
      break

    case 'greet': { // one line when the chat opens; the adapter chose it from the marks other chats left
      // back after a long pause: a warm word and a small gift, once per absence. Never a word on the days away
      // a gift dated after now (a clock that was ahead once) would hold back every later one: it counts as given now
      if (s.giftAt > e.t) s.giftAt = e.t
      const gift = e.kind === 'back' && e.t - s.giftAt >= RULES.backAfterMs
      if (gift) { s.coins += RULES.coinsWelcome; s.giftAt = e.t }
      say('greet', { greet: e.kind, name: e.name, ago: e.ago, done: e.done, ...(gift && { n: RULES.coinsWelcome }), ...(e.buddy && { buddy: true }) })
      break
    }

    case 'cuddle':
      use()
      s.cuddledAt = e.t
      if (s.dayCuddles < RULES.coinCuddlesDay) { s.dayCuddles++; gain(RULES.coinsCuddle) }
      break

    case 'buy': { // refused without a word when unknown, owned already, too dear or out of its month: the adapter says why
      const item = SOLD.find(i => i.id === e.id)
      if (item && !s.owned.includes(item.id) && s.coins >= item.price && sells(item.id, e.t)) { s.coins -= item.price; s.owned.push(item.id) }
      break
    }

    case 'animal': { // an animal unlocked, once and for good. `free` is for the one a pet of before the prices was already shown as: it is kept, not paid
      if (!RULES.animals.includes(e.id) || s.animals.includes(e.id) || (!e.free && s.coins < RULES.animalPrice)) break
      if (!e.free) s.coins -= RULES.animalPrice
      s.animals.push(e.id)
      break
    }

    case 'voice': { // a line the model wrote: the recap and the outline offer say something the person can act on, so under them it is the second line
      const on = ss.talk && (ss.talk.until === undefined || e.t < ss.talk.until) ? ss.talk : null
      if (e.text && !say('voice', { text: e.text, why: e.why }) && (on?.kind === 'recap' || on?.kind === 'tidy')) ss.talk = { ...on, text: e.text, why: e.why }
      break
    }

    case 'peer': // another open chat ended a long turn: which one (its folder), how long ago, and `said`, the line of the small model when the comments are on
      // the fixed line is said at once; the model's, when it comes, takes its place while that news is still on screen
      if (e.said) { const on = ss.talk && (ss.talk.until === undefined || e.t < ss.talk.until) ? ss.talk : null; if (on?.kind === 'peer' && on.name === e.name) ss.talk = { ...on, said: e.said } }
      // a chat that may be waiting for an OK is told at once: it is stuck until the person goes there
      else if ((e.ask || e.t - ss.peerAt >= RULES.peerGapMs) && say('peer', { here: e.here, name: e.name, ago: e.ago ?? 0, ...(e.ask && { ask: true }) })) ss.peerAt = e.t
      break

    case 'read': {
      // kept: a print of the path and the range, never the path; the note names the file only, cleaned
      const key = print(e.range ? `${e.path}#${e.range}` : e.path)
      if (ss.reads[key] === e.mtime) { ss.rereads++; issue('dizzy', tidy(String(e.path).split(/[/\\]/).pop(), 40)) }
      else {
        delete ss.reads[key] // re-insert so the newest read is last
        ss.reads[key] = e.mtime
        const keys = Object.keys(ss.reads), [oldest] = keys
        if (oldest !== undefined && keys.length > RULES.maxReads) delete ss.reads[oldest]
      }
      break
    }

    case 'edit': // a file changed: failing again after this is test-fix-test, not a blind retry
      ss.blind = {}
      break

    case 'cmd': {
      const key = print(normCmd(e.cmd)) // a print of the command line, never the line: its arguments may hold a secret
      if (e.ok) delete ss.blind[key]
      else {
        const name = program(e.cmd), was = /** @type {any} */ (ss.blind[key])
        const b = ss.blind[key] = was && typeof was === 'object' ? was : { n: Number(was) || 0, since: s.turn } // a number is what an earlier version kept
        b.n++
        if (Object.keys(ss.fails).length < 8 || own(ss.fails, name || '?')) ss.fails[name || '?'] = (own(ss.fails, name || '?') ?? 0) + 1
        // the note keeps the program's name only: which one, how many times, over how many turns
        if (b.n >= RULES.loopFails) issue('loop', name, { n: b.n, turns: s.turn - b.since + 1 })
      }
      break
    }

    case 'usage': {
      const total = e.input + e.cacheRead + e.cacheWrite
      ss.requests++
      ss.input += total
      ss.cacheRead += e.cacheRead
      s.life.input += total
      s.life.cacheRead += e.cacheRead
      if (e.contextPct !== undefined) ss.contextPct = e.contextPct
      ss.context = total
      if (e.lean !== undefined) lean(e.lean, e.wait)
      const broke = !ss.expectRebuild && e.cacheWrite >= RULES.cacheBreakMinTokens && e.cacheWrite / (total || 1) > RULES.cacheBreakShare
      ss.expectRebuild = false
      const idle = ss.lastUsageAt ? e.t - ss.lastUsageAt : 0
      ss.lastUsageAt = e.t
      if (broke && idle > RULES.cacheTtlMs) issue('stomach', idle > 12 * RULES.cacheTtlMs ? 'ttl_expired_1h' : 'ttl_expired_5m')
      else if (broke) { ss.rebuilds++; issue('stomach') }
      if (ss.contextPct >= RULES.bloatedPct) issue('bloated', String(Math.round(ss.contextPct)))
      break
    }

    case 'lean': // the person switched the levers: the pet answers at once, not at the next request
      lean(e.on, e.wait)
      break

    case 'cacheMiss': // precise cause from Claude Code's prompt_cache, when the user's status line provides it
      ss.rebuilds++
      issue('stomach', e.cause)
      break

    case 'compact': {
      ss.reads = {}
      ss.expectRebuild = true
      ss.contextPct = 0
      ss.context = 0
      s.issues = s.issues.filter(i => i.kind !== 'bloated' && i.kind !== 'dizzy' && i.kind !== 'heavy' && i.kind !== 'cold')
      break
    }

    case 'turnEnd': {
      s.turn++
      if (ss.context >= RULES.heavyTokens && !ss.lean && !ss.leanWait) issue('heavy', String(Math.round(ss.context / 1000)))
      if (s.queued && e.t - s.lastCheerAt >= RULES.cheerGapMs) {
        const q = s.queued
        s.queued = null
        cheer(q.kind, q.value)
      }
      use()
      if (s.dayTurns < RULES.coinTurnsDay) { s.dayTurns++; gain(RULES.coinsTurn) }
      s.issues = s.issues.filter(i => i.untilTurn > s.turn || e.t < i.until)

      // the companion: at most one line per turn, the most useful first
      ss.turns++
      if (ss.sitAt && e.t - ss.sitAt > RULES.sitGapMs) ss.sit = 0
      ss.sit++
      ss.sitAt = e.t
      const failed = Object.values(ss.fails).reduce((a, b) => a + b, 0)
      if (ss.turnAt && e.t - ss.turnAt >= RULES.recapTurnMs && failed + ss.rereads + ss.rebuilds >= RULES.recapMinWrong) say('recap', { fails: ss.fails, rereads: ss.rereads, rebuilds: ss.rebuilds })
      else if (ss.context >= RULES.heavyTokens && ss.turns >= ss.tidyNext) { if (say('tidy')) ss.tidyNext = ss.turns + RULES.tidyAgainTurns }
      else if (!calm(s, e.t)) {} // chatter never talks over a warning
      else if (ss.sit >= RULES.coffeeTurns && (!ss.coffeeAt || e.t - ss.coffeeAt >= RULES.coffeeGapMs)) { if (say('coffee', { n: ss.sit })) { ss.coffeeAt = e.t; ss.sit = 0 } }
      else if (e.roll !== undefined && e.roll < RULES.sillyChance && ss.turns >= ss.sillyNext && say('silly', { n: e.roll / RULES.sillyChance })) ss.sillyNext = ss.turns + RULES.sillyMinTurns
      ss.turnAt = 0
      ss.fails = {}
      ss.rereads = ss.rebuilds = 0
      break
    }

  }
  if (stage(s) !== stage(prev)) cheer('evolve')
  return s
}

/** The stage a pet has grown to: by the days it was used on and the affection it gathered. @param {{ days: number, affection: number }} s */
export function stage(s) {
  const at = (/** @type {{ days: number, affection: number }} */ g) => s.days >= g.days && s.affection >= g.affection
  return at(RULES.bloomAt) ? 'bloom' : at(RULES.grownAt) ? 'healthy' : 'seedling'
}

const PRIORITY = /** @type {IssueKind[]} */ (['cold', 'loop', 'stomach', 'dizzy', 'heavy', 'bloated'])

/**
 * What to draw now: the sprite state plus the issue or cheer behind it.
 * `animate` is false once a cheer is only being held as a still pose.
 * `talk` is the companion's line still on screen; `calm` says no warning holds the bubble, so that line can be the main one.
 * `happy` is the only other humour there is: content after a cuddle or a day of much use, calm otherwise. Never sad.
 * `context` is what the chat weighs now: the tokens the last request of the main thread re-read, 0 while there is none yet.
 * @param {ReturnType<typeof initialState>} s
 * @param {number} now
 */
export function view(s, now) {
  const live = s.issues.filter(i => i.untilTurn > s.turn || now < i.until)
  const issue = PRIORITY.map(k => live.find(i => i.kind === k)).find(Boolean) ?? null
  const cheer = s.cheer && (s.cheer.until === undefined || now < s.cheer.until) ? s.cheer : null
  // a long chat is drawn as a full one, an expired cache as a rebuilt one
  const mood = issue ? (issue.kind === 'heavy' ? 'bloated' : issue.kind === 'cold' ? 'stomach' : issue.kind) : cheer ? 'cheer' : stage(s)
  const happy = (s.cuddledAt > 0 && now >= s.cuddledAt && now - s.cuddledAt < RULES.happyCuddleMs) || (s.day === dayOf(now) && s.dayTurns >= RULES.happyTurns)
  const animate = !cheer || now - cheer.at < RULES.cheerShowMs
  const said = s.session.talk
  const talk = said && (said.until === undefined || now < said.until) ? said : null
  return { talk, calm: calm(s, now), mood, happy, hearts: hearts(s.affection), coins: s.coins, issue, cheer, animate, context: s.session.context, long: s.session.context >= RULES.heavyTokens, lean: s.session.lean, wait: !!s.session.leanWait, turn: s.turn, variant: s.variant, owned: s.owned, animals: s.animals, closet: closetOf(s.owned, stage(s)) }
}

/**
 * Numbers for the shareable pet card. `next` is what the next stage asks, null for a pet fully grown.
 * @param {State} s
 */
export function card(s) {
  const now = stage(s)
  return {
    stage: now,
    variant: s.variant,
    affection: s.affection,
    hearts: hearts(s.affection),
    days: s.days,
    coins: s.coins,
    owned: s.owned,
    animals: s.animals,
    closet: closetOf(s.owned, now),
    next: now === 'bloom' ? null : now === 'healthy' ? RULES.bloomAt : RULES.grownAt,
  }
}

// One pet per person. Chats open together each hold a copy of the pet; the store holds the shared one. What is shared is listed here:
// everything else (the session, the notes and the cheer on screen) is the chat's own. `turn` is kept in the store only to start a new
// chat from: each chat counts its own, since its notes expire by it.
/** @typedef {{ variant: 'golden' | null, born: number, life: { input: number, cacheRead: number }, turn: number, coins: number, affection: number, days: number, day: number, lately: number[], dayTurns: number, dayCuddles: number, cuddledAt: number, giftAt: number, owned: string[], animals: string[], lastCheerAt: number }} Shared */

const MAX_TIME = 8.64e15 // the last moment a date can hold
const DEBT_MAX = 100_000 // how far under zero the stars are let go

/**
 * The shared part of a state, or of what the store holds, made whole: a missing or broken field reads as a newborn's.
 * A store kept by a version before the shop is read here too: its counters (health, knock-outs, efficient sessions) are left behind,
 * so the first write drops them, and what its efficient sessions had unlocked is owned.
 * @param {any} s @returns {Shared}
 */
export function shared(s) {
  const n = (/** @type {unknown} */ x, d = 0) => Number.isFinite(x) ? /** @type {number} */ (x) : d
  // a counter is a whole number from 0 up; a moment or a day is one a date can hold, else none
  const count = (/** @type {unknown} */ x) => Math.max(0, Math.floor(n(x)))
  const when = (/** @type {unknown} */ x, max = MAX_TIME) => { const v = Math.floor(n(x)); return v > 0 && v <= max ? v : 0 }
  const day = when(s?.day, MAX_TIME / 86_400_000), days = count(s?.days)
  const lately = [...new Set(Array.isArray(s?.lately) ? s.lately.map((/** @type {unknown} */ x) => when(x, MAX_TIME / 86_400_000)).filter((/** @type {number} */ x) => x > 0 && x <= day) : [])].sort((a, b) => a - b).slice(-RULES.daysKept)
  const had = Array.isArray(s?.owned) ? s.owned : Object.keys(RULES.legacyUnlocks).filter(id => n(s?.efficientSessions) >= (RULES.legacyUnlocks[id] ?? Infinity))
  return {
    variant: s?.variant === 'golden' ? 'golden' : null,
    born: when(s?.born),
    life: { input: count(s?.life?.input), cacheRead: count(s?.life?.cacheRead) },
    turn: count(s?.turn),
    // the stars can be under zero for a while: two chats spent the same ones at once (`merge`)
    coins: Math.max(-DEBT_MAX, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n(s?.coins)))),
    affection: Math.min(Number.MAX_SAFE_INTEGER, count(s?.affection)),
    days: Math.min(days, Number.MAX_SAFE_INTEGER),
    day,
    lately: days > 0 && day > 0 && !lately.includes(day) ? [...lately, day].slice(-RULES.daysKept) : lately, // a store of before the list: its last day is the one known
    dayTurns: count(s?.dayTurns),
    dayCuddles: count(s?.dayCuddles),
    cuddledAt: when(s?.cuddledAt),
    giftAt: when(s?.giftAt),
    owned: OWNABLE.map(i => i.id).filter(id => had.includes(id) || (id === GOLDEN.id && s?.variant === 'golden')),
    animals: RULES.animals.filter(id => Array.isArray(s?.animals) && s.animals.includes(id)),
    lastCheerAt: when(s?.lastCheerAt),
  }
}

/**
 * The shared pet after this chat's changes: what the store holds now, plus only what this chat changed since `base`, the shared pet
 * as this chat last saw it. So a chat never writes its whole copy over the progress another chat made meanwhile.
 * Days are counted by which days were seen, not by a difference: a day this chat counted and the store did not is one more, a day
 * both counted is one, with its first-use stars once (`lately`, the last days counted on each side).
 * Stars: what each chat spent is taken, so when two chats spent the same stars at once on two different things, both things stay
 * and the balance goes under zero. It is a debt that use repays: nothing can be bought until it is back to zero. The mod reads
 * the store before every purchase, so this takes two purchases in the same instant.
 * shortcut: two chats open together each count their own turns towards the day's cap until they next look at the store (every 10 s),
 * so a few coins over the cap can slip in; the same item bought in both at once is paid twice.
 * @param {Shared} stored @param {Shared} base @param {Shared} mine
 * @returns {Shared}
 */
export function merge(stored, base, mine) {
  const add = (/** @type {number} */ a, /** @type {number} */ was, /** @type {number} */ now) => Math.max(0, a + now - was)
  // what was counted in the day: the store's when it is a day ahead, else its own plus what this chat counted since it last looked
  const today = (/** @type {'dayTurns' | 'dayCuddles'} */ f) => stored.day > mine.day ? stored[f] : Math.max(0, (stored.day === mine.day ? stored[f] : 0) + mine[f] - (base.day === mine.day ? base[f] : 0))
  // the days this chat counted since it last looked, and of them the ones the store has counted too: those were opened twice,
  // so their first-use stars came once too many
  const opened = mine.lately.filter(d => !base.lately.includes(d)), both = opened.filter(d => stored.lately.includes(d))
  const twice = both.length * RULES.coinsFirstUse
  const gift = mine.giftAt > base.giftAt && stored.giftAt > base.giftAt ? RULES.coinsWelcome : 0
  return {
    variant: stored.variant ?? mine.variant,
    born: stored.born && mine.born ? Math.min(stored.born, mine.born) : stored.born || mine.born, // the earliest known
    life: { input: add(stored.life.input, base.life.input, mine.life.input), cacheRead: add(stored.life.cacheRead, base.life.cacheRead, mine.life.cacheRead) },
    turn: Math.max(stored.turn, mine.turn),
    coins: stored.coins + mine.coins - base.coins - twice - gift, // not held at zero: see the debt above
    affection: add(stored.affection, base.affection + twice, mine.affection),
    days: stored.days + opened.length - both.length,
    day: Math.max(stored.day, mine.day),
    lately: [...new Set([...stored.lately, ...mine.lately])].sort((a, b) => a - b).slice(-RULES.daysKept),
    dayTurns: today('dayTurns'),
    dayCuddles: today('dayCuddles'),
    cuddledAt: Math.max(stored.cuddledAt, mine.cuddledAt),
    giftAt: Math.max(stored.giftAt, mine.giftAt),
    owned: OWNABLE.map(i => i.id).filter(id => stored.owned.includes(id) || mine.owned.includes(id)),
    animals: RULES.animals.filter(id => stored.animals.includes(id) || mine.animals.includes(id)),
    lastCheerAt: Math.max(stored.lastCheerAt, mine.lastCheerAt),
  }
}

/**
 * A chat's state made whole for this version. What a reload finds in the session's memory, like what the store holds, may have been
 * written by any earlier version: every field of today's state is there afterwards with the right kind of value, a missing or broken
 * one as a newborn's, and the fields of earlier versions (health, ko, efficient sessions, cheers that no longer exist) are left out.
 * Adapters read a kept state through this and nothing else, so no drawing or command can meet an absent field.
 * A chat's copy with no list of things owned owns nothing of its own: what its efficient sessions had unlocked comes from the store (`shared`).
 * @param {any} raw @returns {State & { base?: Shared }}
 */
export function whole(raw) {
  const obj = (/** @type {any} */ x) => !!x && typeof x === 'object' && !Array.isArray(x)
  const known = (/** @type {any} */ x, /** @type {string[]} */ kinds) => obj(x) && kinds.includes(x.kind) && (x.at === undefined || Number.isFinite(x.at))
  const s = obj(raw) ? raw : {}, fresh = initialState(1)
  /** @type {any} */ const session = fresh.session
  // each field of the session keeps what was held when it is of the same kind as a fresh one's
  for (const [k, v] of Object.entries(obj(s.session) ? s.session : {})) if (k in session && k !== 'talk' && typeof v === typeof session[k] && obj(v) === obj(session[k])) session[k] = v
  if (known(s.session?.talk, RULES.talkRank)) session.talk = { ...s.session.talk, ...Object.fromEntries(['text', 'name', 'said'].flatMap(k => typeof s.session.talk[k] === 'string' ? [[k, tidy(s.session.talk[k], 120)]] : [])) }
  // what an earlier version kept of the outside: whole paths and command lines as the names of fields. Only prints stay (`print`)
  for (const k of ['reads', 'blind']) session[k] = Object.fromEntries(Object.entries(session[k]).filter(([key]) => /^h[0-9a-f]{8}$/.test(key)))
  session.fails = Object.fromEntries(Object.entries(session.fails).filter(([key, n]) => (key === '?' || /^[\w.+-]{1,24}$/.test(key)) && !(key in {}) && Number.isFinite(n)))
  return JSON.parse(JSON.stringify({
    ...fresh,
    ...shared({ ...s, owned: Array.isArray(s.owned) ? s.owned : [] }),
    issues: Array.isArray(s.issues) ? s.issues.filter((/** @type {any} */ i) => known(i, PRIORITY) && Number.isFinite(i.untilTurn) && Number.isFinite(i.until)).map((/** @type {any} */ i) => ({ ...i, ...(i.detail === undefined ? null : { detail: typeof i.detail === 'string' ? tidy(i.detail.split(/[/\\]/).pop(), 40) : '' }) })) : [],
    cheer: known(s.cheer, RANK) && Number.isFinite(s.cheer.at) ? s.cheer : null,
    queued: known(s.queued, RANK) ? s.queued : null,
    session,
    ...(obj(s.base) && { base: shared(s.base) }),
  }))
}

/**
 * What a chat does with the store: `pet` is the shared pet with this chat's changes in, `seen` is the store's own, to count the next
 * changes from when `pet` is not written. `stored` undefined is an empty store. `cur.base` is the shared pet as this chat last saw it.
 * @param {any} cur @param {unknown} stored
 * @returns {{ pet: Shared, seen: Shared | null }}
 */
export function sync(cur, stored) {
  const mine = shared(cur), seen = stored && typeof stored === 'object' ? shared(stored) : null
  return { pet: seen ? merge(seen, cur.base ? shared(cur.base) : mine, mine) : mine, seen }
}

/** The chat's state with the shared pet in; the chat keeps its own turn count. @param {any} cur @param {Shared} pet @param {Shared} base */
export const adopt = (cur, pet, base) => ({ ...cur, ...JSON.parse(JSON.stringify(pet)), turn: cur.turn, base })
