// State contract of the Hatchling mod: what it keeps in `$.state`.

/** Which animation frame to draw: `n` counts ticks, `rare` is a rare-frame index or -1, `demo` the mood /pet demo forces ('' = none), `sleep` true after 5 idle minutes, `egg` the ticks left of the hatching at the first start (0 = hatched), `love` the ticks left of the hearts after a cuddle, `ask` the question about the voice while it waits for an answer ('' = none); `recap` the line about where the work got to, said after a pause and held until the next prompt ('' = none), and `recapAt` when that work was left (ms). */
export type HatchlingAnim = { n: number; rare: number; demo: string; sleep: boolean; egg: number; love: number; ask: string; note: string; noteFix: string; noteLeft: number; skin: number; idle: string; idleN: number; spark: number; hush: number; sig: string; sigAt: number; recap: string; recapAt: number }

/** What the person chose with /pet: band hidden or not, the accessory worn ('' = newest unlocked), the animal shown (a key of sprites/zoo.js) and the one rolled at birth, which /pet animal can always go back to; `diet` trims long command output, `style` adds the lean-work section to the system prompt, and is what /pet lean switches. Who the pet is: `seed` gives its name and character (engine/persona.js), `name` and `stats` (five values from 0 to 100, in the order of STATS in engine/persona.js) are the ones in use (a rename or an adoption changes them, the animal does not), `personality` and `hatched` (ms, 0 = unknown) come from an adopted /buddy, `asked` is true once the old /buddy was looked for; `cuddles` counts the cuddles and `cuddled` is the time of the last (ms, 0 = never); `voice` lets a small model write a line about the turn, off unless the person turns it on, and `voiceAsked` is true once the pet asked whether it may (or the person chose with /pet voice); `callme` is the name the person asked to be called by with /pet call me ('' = none told), never read from anywhere else. */
export type HatchlingPrefs = { hidden: boolean; wear: string; species: string; born: string; style: boolean; seed: number; name: string; stats: number[]; personality: string; hatched: number; asked: boolean; cuddles: number; cuddled: number; voice: boolean; voiceAsked: boolean; model: string; lang: string; missing: string; chats: boolean; callme: string }

declare module 'claude-code' {
  interface PluginState {
    /** `pet` is the engine's JSON state (engine/engine.js `State`), null until loaded. */
    hatchling: { pet: Record<string, unknown> | null; anim: HatchlingAnim; prefs: HatchlingPrefs }
  }
}
