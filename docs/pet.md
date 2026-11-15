# The pet

How Cachito works, and every command. Comments: [comments.md](comments.md). What is kept and sent: [privacy.md](privacy.md).

## The band

The pet sits above the prompt with one dim row: its name, its stars, a count of your other chats and two buttons (`Tobo  ★ 29  ·  2 working · 1 waiting  ·  skin  pet`). When it has something to say, a speech bubble shows for some seconds, with its buttons under it. A narrow terminal drops the buttons first, then the bubble.

At the first start the pet is an egg, and hatches after 8 seconds.

As installed everything the pet says is fixed text on your screen: no model is asked and nothing enters the chat's context. A button only fills the prompt box.

## Affection, growth and stars

- **Hearts are affection.** They fill with use and cuddles and never empty. The pet is `happy` or `calm`, never sad.
- **Growth**: grown up at 3 days of use and 60 affection, a crown at 20 days and 500.
- **Stars**: 1 for each turn (the first 30 of a day), 2 for a cuddle (the first 3 of a day), 5 at the first use of a day, 10 when you are back after 3 days. Spending them never lowers affection.
- **One pet for all your chats**: they share the stars and your choices.

## The shop

`/pet shop` shows the catalogue, `/pet shop <item>` buys and puts on, `/pet wear <item>` puts on or takes off. Nothing sold changes what the pet does.

| Item | Stars | Item | Stars | Item | Stars |
|---|---|---|---|---|---|
| `shades` | 10 | `sneakers` | 35 | `suitcase` | 60 |
| `mug` | 12 | `boots` | 35 | `laptop` | 65 |
| `balloon` | 15 | `lamp` | 40 | `sombrero` | 70 |
| `glasses` | 20 | `santa` (December) | 40 | `wizard` | 80 |
| `eyepatch` | 20 | `headphones` | 45 | an animal | 100 |
| `duck` | 25 | `hoodie` | 45 | `pastel` coat | 150 |
| `partyhat` | 25 | `backpack` | 50 | `terminal` coat | 200 |
| `scarf` | 30 | `wand` | 50 | `golden` coat | 300 |
| `cap` | 30 | `skateboard` | 55 | | |

- **Parts**: one thing on each of `head`, `face`, `body`, `feet`, and one `accessory` beside the pet.
- **The crown** is not sold: a pet at its last stage has it.
- **Coats** (`pastel`, `terminal`, `golden`) are a colour only. One pet in a hundred is born golden; `/pet wear <coat>` and `/pet wear plain` switch.
- **The Santa hat** is sold from 1 to 31 December; once yours, it stays all year.
- **The founder's eggshell** (`eggshell`, half the shell as a hat) is not sold: a pet hatched by 31 January 2027 has it, and keeps it for ever.
  It is a keepsake kept in the pet's file on your machine, not something anyone checks or enforces.
- **Animals**: the one your pet was born as is yours. Each other common one (penguin, chick, dog, bunny, fox, cactus) is unlocked once with `/pet shop <animal>`; `/pet animal <name>` then switches freely. Name and character stay. A rare seventh is not sold.
- **Skin packs**: more animals, things and coats from JSON files in `~/.claude/cachito-skins/`. Data, never code; free. See [skins.md](skins.md).

## Notes and fixes

The pet notes where a session wastes tokens. A note is advice and costs nothing; a `fix` button puts the remedy in the prompt box.

| It notices | Guide |
|---|---|
| a long chat (about 60k tokens) without lean | [long-chat.md](fix/long-chat.md) |
| a file read again unchanged | [rereads.md](fix/rereads.md) |
| a command that failed three times in a row | [loops.md](fix/loops.md) |
| a rebuilt or expired cache | [cache-break.md](fix/cache-break.md) |
| a nearly full context | [context-full.md](fix/context-full.md) |

**After a long pause.** When you write after more than an hour away and the chat holds 100k tokens or more, the pet says the cache has expired and offers `/compact`. The hour is an assumption: the cache lasts 1 hour on a subscription and 5 minutes with an API key, and the pet cannot tell which you have. It never compacts by itself.

**Lean.** `/pet lean on|off` switches the eight lines of [cachito-lean](../README.md#cachito-lean); off by default in the pet. In a chat over 30k tokens the switch waits for the next compaction or chat. With both plugins installed the lines are sent once, and stay while either has them on.

## What else it says

- **A greeting** when a chat opens. If a chat in this folder stopped mid-turn, a `resume` button types `/resume`.
- **Failing commands**, by program name and count (`npm failed 4 times in a row`). Arguments are never named.
- **An outline for a long chat**: a button asks the agent to sum up where you are, fit to paste into a new chat.
- **`coffee break?`** after 20 turns in one sitting, and rarely a word of nonsense.

Lines come at least 3 minutes apart, and a warning comes first.

## Which chat needs me

With several chats open, each is in one of four states:

- **working**: a turn is running;
- **waiting**: its turn ended and you have not written yet;
- **asking**: a tool call has waited 5 seconds for your leave. The pet does not see the dialog itself, so it says "may be waiting for your OK";
- **closed**: it ended, or gave no sign of life for 90 seconds.

When another chat ends a turn of 2 minutes or more, or may be waiting for your OK, the pet says so once, with the folder's name. `/pet chats` lists them: folder, state, since when.

`/pet chats off` works both ways: your other chats no longer see this one, and this one no longer sees them.

## Name and character

Every pet has a name and five statistics from 0 to 100, set at birth: `WIT`, `CURIOSITY`, `CALM`, `RIGOR`, `WARMTH`. No model is asked for them. The highest says most of the pet's lines. The `/pet` card shows them. Both outlive `/clear` and a change of animal.

## The diary

At most 40 lines of times, counts and folder names, written on your machine with no model: milestones (first day, each stage, a week, a month), habits (the folder you work in most, your usual hours) and recent facts. The pet uses at most one memory a day in place of a plain greeting.

## Languages

English, Spanish, Portuguese and Simplified Chinese. A newborn takes your system's language when it is one of these. The bubble, the buttons and the short replies of commands are translated; command names and documents stay in English. Adding one: [development.md](development.md).

## Commands

| Command | What it does |
|---|---|
| `/pet` | the card: stage, hearts, character, stars, lean, comments and their cost |
| `/pet pet` | pet it; the `pet` button does the same |
| `/pet name <name>` | rename it |
| `/pet call me <name>` | tell the pet your name: it says it now and then, in a greeting or after a cuddle. Alone it shows the name, `nobody` forgets it. The pet knows only what you type here |
| `/pet shop [item]` | the catalogue; with an item, buy it |
| `/pet wear <item>` | put on or take off; `none` takes everything off |
| `/pet skin` | what is on each part; the `skin` button changes each |
| `/pet animal [name]` | switch animal; with no name, list yours |
| `/pet skins` | list your skin packs |
| `/pet chats [on\|off]` | the chats board; on by default |
| `/pet lean <on\|off>` | the eight lines |
| `/pet comments <on\|off>` | comments by a small model, on your tokens |
| `/pet model [alias\|id\|default]` | the model of the comments: [comments.md](comments.md) |
| `/pet say <text>` | speak to the pet: [comments.md](comments.md) |
| `/pet diary [clear]` | show or empty the diary |
| `/pet share` | a colour picture to attach to a post, 800×420: the pet with what it wears, its name, animal, stage, character and stars; nothing about your work. Saved as `cachito-share/cachito-<name>.png` in your Claude Code config folder (`~/.claude`), written over each time. Node writes the PNG; without Node on the PATH the same picture is saved as an SVG |
| `/pet lang <en\|es\|pt\|zh>` | the pet's language |
| `/pet adopt` | take your old `/buddy`'s name and personality: [privacy.md](privacy.md) |
| `/pet hide`, `/pet show` | hide or show the band |
| `/pet demo` | the egg again |
| `/pet help` | the commands, in the pet's language |
