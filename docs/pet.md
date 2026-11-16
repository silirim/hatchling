# The pet

How Hatchling works, and every command. Comments: [comments.md](comments.md). What is kept and sent: [privacy.md](privacy.md).

## The band

The pet sits above the prompt with one dim row: its name, its stars, how many of your other chats wait for you and two buttons (`Tobo  ★ 29  ·  2 chats wait for you  ·  skin  pet`). When it has something to say, a speech bubble shows for some seconds, with its buttons under it. A narrow terminal drops the buttons first, then the bubble.

**In the Claude apps.** In the desktop and mobile apps the pet is a small picture drawn from the same pixels (animal, age, coat and what it wears), with its name, its phrase and the same buttons beside it. It stands still there: the picture changes when the pet's state does, with no blink or gesture. It has an outline that reads on a light and on a dark app. VS Code keeps one row of text. Nothing more is sent or stored for it.

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
- **Skin packs**: more animals, things and coats from JSON files in `~/.claude/hatchling-skins/`. Data, never code; free. See [skins.md](skins.md).

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

**Briefox.** `/pet briefox on|off` switches the one sentence of [briefox](../README.md#briefox), `Be brief.`; off by default in the pet. In a chat over 30k tokens the switch waits for the next compaction or chat. With both plugins installed the sentence is sent once, and stays while either has it on. A choice made with `/pet lean` in an earlier version holds, and `/pet lean` is still answered.

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

The band counts the chats that wait for you: the waiting and the asking ones. A chat whose turn ended counts for 2 hours, then it is listed and no longer counted. When another chat ends a turn of 2 minutes or more, the pet says so once, with the folder's name. When one may be waiting for your OK it says so once too, with one toast; `/pet alerts on` adds a desktop notification, through the channel Claude Code is set to (off by default). `/pet chats` lists them: folder, state, since when.

**Names.** A chat you named yourself is told by that name, in the list (name, then folder and state), in the bubble and in the toast. The name Claude Code makes by itself, the folder with two hex digits (`workspace-5a`), says no more than the folder and is not shown.

**Titles**, off by default. `/pet chats titles on` adds to the list the title Claude Code gives each chat (`Fix the login bug   vodmax, working, 3 min ago`), 48 columns at most. It is read from the last title line of that chat's transcript, and nothing else of it is; it is kept in memory only, read again after 10 minutes, and shown nowhere but in `/pet chats`. A name you gave goes before a title, and this chat's own title is not read. It needs `tail` on the PATH; without it, or for a chat with no title yet, the list shows the folder. [privacy.md](privacy.md) has the detail.

**Chats without Hatchling.** About every 30 seconds one of your open chats runs `claude agents --json` (Claude Code 2.1.139 or later; 5 seconds at most), which lists every live session. A session that left no mark of its own is then counted and listed too: busy is working, one that waits for an approval is asking, and an idle one is waiting only after a look saw it go from busy to idle (an idle session never seen busy is left out: it may never have had a turn). Of each session only its id, folder and status are kept, whether it waits for an approval, and the name you gave it when you gave one: never a prompt, or the text of what it waits for. While that list is there, it also says who is still open: a chat whose session is no longer in it is not counted or listed as waiting, and after `/clear` a chat's earlier id is never shown as another chat. If the command is missing or fails, the chat stops trying and knows the others by their marks alone. Never in a headless run.

`/pet chats off` works both ways: your other chats no longer see this one, and this one no longer sees them and runs no command. A chat with the board off that has not had a turn yet has left no mark, so the others still learn of it from Claude Code's own list.

## Name and character

Every pet has a name and five statistics from 0 to 100, set at birth: `WIT`, `CURIOSITY`, `CALM`, `RIGOR`, `WARMTH`. No model is asked for them. The highest says most of the pet's lines. The `/pet` card shows them. Both outlive `/clear` and a change of animal.

## The work diary

`/pet diary` reports today and yesterday; `/pet diary today`, `yesterday` or `week` picks the days. For each day: how many chats you opened and in which folders, how many turns ended and how many files they changed, and which chats were left mid-turn or still wait for you. No model writes it: the counts are kept by day, for 8 days, and the last two come from the chat marks. Counts and folder names only.

The first greeting of a day says yesterday in one dim line under it (`yesterday: 3 chats, 2 folders; one left mid-turn in vodmax`), once a day over all your chats.

## Reminders

- `/pet remind <text>` keeps a line for you; `/pet remind in <20m|2h|1d> <text>` times it (minutes, hours or days, a year at most).
- `/pet reminders` lists them with their numbers; `/pet remind done <n>` removes one, `/pet remind done all` every one.
- At most 20, of 200 characters each, with control and escape characters taken out.
- **When the pet says them**, in its bubble for 20 seconds: a little after a chat opens, at your first prompt after 30 minutes away, and when a timed one falls due (in a chat you used in the last 30 minutes; otherwise at your return). It shows the first, and how many more. A reminder stays until you remove it.
- Reminders stay on this machine: never sent to the comments model, comments on or off, not on the picture of `/pet share`, not in the file of `/pet export`.
- When you set or list them, the answer is a line of this chat, as with any command, so this chat's assistant can read it. The bubble is drawn locally and is not a chat line.

## The pet's own diary

`/pet diary lines` shows it. At most 40 lines of times, counts and folder names, written on your machine with no model: milestones (first day, each stage, a week, a month), habits (the folder you work in most, your usual hours) and recent facts. The pet uses at most one memory a day in place of a plain greeting.

## Moving to another computer

The pet lives in the plugin store of one machine, not in your Claude account. To take it along:

1. `/pet export` writes `hatchling-share/hatchling-<name>-<date>.json` in your Claude Code config folder (`~/.claude`), for you alone (mode 0600), and prints its path.
2. Copy the file to the other computer yourself. Nothing is sent.
3. There, `/pet import <path>` checks the file and tells what would happen: the pet in the file, and the pet there that it would replace. `/pet import <path> yes` does it. The pet that was there is saved first, as `hatchling-<name>-<date>-backup-<time>.json` in the same folder, and its path is printed: importing that file brings it back.

The path may start with `~`, be relative to the chat's folder, and hold spaces. What is in the file: [privacy.md](privacy.md). A file with a field Hatchling does not know, a value out of range, a control character in a text, or an animal, item or coat that is not there is refused whole, with what is wrong in one line (in English); so is a file of a newer format, until Hatchling is updated. A pet shown as an animal of a skin pack, or wearing a thing of one, needs that pack installed first.

A pet kept under the project's earlier name moves the same way: [renamed.md](renamed.md).

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
| `/pet chats titles [on\|off]` | each chat's title in that list, read from its transcript's title line; off by default |
| `/pet alerts [on\|off]` | a desktop notification when another chat may be waiting for your OK; off by default |
| `/pet briefox <on\|off>` | the sentence `Be brief.` |
| `/pet comments <on\|off>` | comments by a small model, on your tokens |
| `/pet model [alias\|id\|default]` | the model of the comments: [comments.md](comments.md) |
| `/pet say <text>` | speak to the pet: [comments.md](comments.md) |
| `/pet diary [today\|yesterday\|week]` | the work report; today and yesterday by default |
| `/pet diary lines`, `/pet diary clear` | the pet's own diary; empty it and the work counters |
| `/pet remind <text>` | keep a reminder; `in <20m\|2h\|1d> <text>` times it, `done <n\|all>` removes |
| `/pet reminders` | list the reminders |
| `/pet share` | a colour picture to attach to a post, 800×420: the pet with what it wears, its name, animal, stage, character and stars; nothing about your work. Saved as `hatchling-share/hatchling-<name>.png` in your Claude Code config folder (`~/.claude`), written over each time. Node writes the PNG; without Node on the PATH the same picture is saved as an SVG |
| `/pet export` | save the pet to a file, for another computer: [above](#moving-to-another-computer) |
| `/pet import <path> [yes]` | bring in a pet saved with `/pet export`; asks first, and saves the pet that was there |
| `/pet lang <en\|es\|pt\|zh>` | the pet's language |
| `/pet adopt` | take your old `/buddy`'s name and personality: [privacy.md](privacy.md) |
| `/pet hide`, `/pet show` | hide or show the band |
| `/pet demo` | the egg again |
| `/pet help` | the commands, in the pet's language |
